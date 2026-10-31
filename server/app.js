import './env.js';
import express from 'express';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import connect, { explain } from './db.js';
import C from './config.js';
import { User, Steps, Tx, Withdrawal } from './models.js';

const app = express();
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());
// Open /api/health in your browser. It shows what the server can see (never your password) and why a connection fails.
app.get('/api/health', async (req, res) => {
  const uri = process.env.MONGODB_URI || '';
  const info = {
    envFound: !!uri,
    jwtSecretFound: !!process.env.JWT_SECRET,
    rules: { inrPer1000Steps: C.inrPer1000Steps, minWithdrawInr: C.minWithdrawMicro / 1e6, referralInr: C.referralMicro / 1e6, dailyStepCap: C.dailyStepCap, usdInr: C.usdInr },
    startsWithMongodb: /^mongodb(\+srv)?:\/\//.test(uri),
    hasAngleBrackets: /[<>]/.test(uri),
    hasQuotesOrSpaces: /["'\s]/.test(uri)
  };
  try {
    const u = new URL(uri);
    info.host = u.hostname; info.user = decodeURIComponent(u.username);
    info.database = u.pathname.replace('/', '') || '(none: add /tasknest before the ?)';
  } catch { info.host = '(could not read the link)'; }
  try { await connect(); info.connected = true; res.json(info); }
  catch (e) { info.connected = false; info.problem = explain(e); info.rawError = String(e.message).slice(0, 300); res.status(500).json(info); }
});

app.use(async (req, res, next) => {
  try { await connect(); next(); }
  catch (e) { console.error('DB connection failed:', e.message); res.status(500).json({ error: 'Database is not connected. ' + explain(e) }); }
});


const wrap = fn => (req, res) => fn(req, res).catch(e => { console.error(e); res.status(500).json({ error: 'Something went wrong.' }); });
const day = (o = 0) => new Date(Date.now() + 19800000 + o * 864e5).toISOString().slice(0, 10);   // India date
const pub = u => ({ name: u.name, email: u.email, referralCode: u.referralCode, balanceMicro: u.balanceMicro, totalSteps: u.totalSteps, isAdmin: u.isAdmin });
const isAdminEmail = e => !!process.env.ADMIN_EMAIL && e.toLowerCase() === process.env.ADMIN_EMAIL.toLowerCase();
const publicConfig = { usdInr: C.usdInr, inrPer1000Steps: C.inrPer1000Steps, microPerStep: C.microPerStep, dailyStepCap: C.dailyStepCap, referralMicro: C.referralMicro, referralSteps: C.referralSteps, minWithdrawMicro: C.minWithdrawMicro, methods: C.methods, comingSoon: C.comingSoon, cryptoAssets: C.cryptoAssets, cryptoNetwork: C.cryptoNetwork };

function setCookie(res, u) {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is missing');
  const t = jwt.sign({ id: u._id }, process.env.JWT_SECRET, { expiresIn: '30d' });
  res.cookie('tn', t, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 30 * 864e5 });
}
async function auth(req, res, next) {
  try {
    const p = jwt.verify(req.cookies.tn, process.env.JWT_SECRET);
    const u = await User.findById(p.id);
    if (!u) throw new Error('no user');
    req.user = u; next();
  } catch { res.status(401).json({ error: 'Please log in.' }); }
}
const adminOnly = (req, res, next) => req.user.isAdmin ? next() : res.status(403).json({ error: 'Admins only.' });

// ---------- Auth ----------
app.post('/api/auth/signup', wrap(async (req, res) => {
  const name = String(req.body.name || '').trim().slice(0, 60);
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const ref = String(req.body.ref || '').trim().toLowerCase();
  if (!name || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8)
    return res.status(400).json({ error: 'Enter your name, a valid email and a password of 8+ characters.' });
  if (await User.exists({ email })) return res.status(409).json({ error: 'This email is already registered.' });
  const referrer = ref ? await User.findOne({ referralCode: ref }) : null;
  const u = await User.create({
    name, email, passwordHash: await bcrypt.hash(password, 10),
    referralCode: crypto.randomBytes(4).toString('hex'),
    referredBy: referrer ? referrer._id : undefined, isAdmin: isAdminEmail(email)
  });
  setCookie(res, u);
  res.json({ user: pub(u) });
}));

app.post('/api/auth/login', wrap(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const u = await User.findOne({ email });
  if (!u || !(await bcrypt.compare(String(req.body.password || ''), u.passwordHash)))
    return res.status(401).json({ error: 'Wrong email or password.' });
  if (isAdminEmail(email) && !u.isAdmin) { u.isAdmin = true; await u.save(); }
  setCookie(res, u);
  res.json({ user: pub(u) });
}));

app.post('/api/auth/logout', (req, res) => { res.clearCookie('tn'); res.json({ ok: true }); });

// ---------- Account ----------
app.get('/api/me', auth, wrap(async (req, res) => {
  const s = await Steps.findOne({ userId: req.user._id, day: day() });
  res.json({ user: pub(req.user), today: s ? s.steps : 0, config: publicConfig });
}));

app.get('/api/dashboard', auth, wrap(async (req, res) => {
  const id = req.user._id;
  const [week, tx, invited, completed] = await Promise.all([
    Steps.find({ userId: id, day: { $gte: day(-6) } }).lean(),
    Tx.find({ userId: id }).sort({ _id: -1 }).limit(8).lean(),
    User.countDocuments({ referredBy: id }),
    User.countDocuments({ referredBy: id, referralPaid: true })
  ]);
  res.json({ week, tx, invited, completed });
}));

// ---------- Steps ----------
// The phone sends how many steps it counted. The server decides how many are believable.
app.post('/api/steps/sync', auth, wrap(async (req, res) => {
  const u = req.user, d = day();
  const cur = Math.min(Math.max(parseInt(req.body.today) || 0, 0), C.dailyStepCap);
  await Steps.updateOne({ userId: u._id, day: d }, { $setOnInsert: { steps: 0 } }, { upsert: true }).catch(() => {});
  const rec = await Steps.findOne({ userId: u._id, day: d });
  const old = rec.steps;
  const elapsed = u.lastSyncAt ? (Date.now() - u.lastSyncAt) / 1000 : 60;
  const allowed = Math.floor(Math.min(elapsed, C.maxCreditSeconds) * C.maxStepsPerSec);   // time-based limit
  const delta = Math.min(cur - old, allowed);
  const none = { today: old, credited: 0, balanceMicro: u.balanceMicro, totalSteps: u.totalSteps };
  if (delta <= 0) return res.json(none);

  const won = await Steps.findOneAndUpdate({ _id: rec._id, steps: old }, { $set: { steps: old + delta } });
  if (!won) return res.json(none);                       // another sync got there first: never credit twice

  const amt = delta * C.microPerStep;
  const nu = await User.findByIdAndUpdate(u._id, { $inc: { balanceMicro: amt, totalSteps: delta }, $set: { lastSyncAt: new Date() } }, { new: true });
  await Tx.create({ userId: u._id, kind: 'steps', amountMicro: amt, note: delta + ' steps' });

  // Referral reward: pays once, when the invited friend reaches the step goal
  if (nu.referredBy && !nu.referralPaid && nu.totalSteps >= C.referralSteps) {
    const first = await User.findOneAndUpdate({ _id: nu._id, referralPaid: false }, { $set: { referralPaid: true } });
    if (first) {
      await User.updateOne({ _id: nu.referredBy }, { $inc: { balanceMicro: C.referralMicro } });
      await Tx.create({ userId: nu.referredBy, kind: 'referral', amountMicro: C.referralMicro, note: 'A friend reached ' + C.referralSteps + ' steps' });
    }
  }
  res.json({ today: old + delta, credited: delta, balanceMicro: nu.balanceMicro, totalSteps: nu.totalSteps });
}));

// ---------- Withdrawals (paid manually by you) ----------
const EMAIL = /^\S+@\S+\.\S+$/;
function checkDetails(method, details, network) {
  if (method === 'upi') return /^[a-zA-Z0-9._-]{2,64}@[a-zA-Z][a-zA-Z0-9.-]{1,30}$/.test(details) ? null : 'Enter a valid UPI ID, like name@bank.';
  if (method === 'crypto')
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(details) ? null : 'That does not look like a Solana wallet address.';
  return EMAIL.test(details) ? null : 'Enter a valid email address.';
}

app.get('/api/withdrawals', auth, wrap(async (req, res) => {
  res.json({ items: await Withdrawal.find({ userId: req.user._id }).sort({ _id: -1 }).limit(50).lean() });
}));

app.post('/api/withdrawals', auth, wrap(async (req, res) => {
  const method = String(req.body.method), details = String(req.body.details || '').trim().slice(0, 200);
  const network = method === 'crypto' ? C.cryptoNetwork : undefined;
  const asset = method === 'crypto' ? String(req.body.asset || '') : undefined;
  const amt = Math.round(Number(req.body.amountMicro));
  if (C.comingSoon.includes(method)) return res.status(400).json({ error: 'Amazon and Flipkart payouts are coming soon.' });
  if (!C.methods.includes(method)) return res.status(400).json({ error: 'Choose a payout method.' });
  if (method === 'crypto' && !C.cryptoAssets.includes(asset)) return res.status(400).json({ error: 'Choose USDT, USDC or SOL.' });
  const bad = checkDetails(method, details, network);
  if (bad) return res.status(400).json({ error: bad });
  if (!(amt >= C.minWithdrawMicro)) return res.status(400).json({ error: 'The minimum withdrawal is ₹' + C.minWithdrawMicro / 1e6 + '.' });
  const u = await User.findOneAndUpdate({ _id: req.user._id, balanceMicro: { $gte: amt } }, { $inc: { balanceMicro: -amt } }, { new: true });
  if (!u) return res.status(400).json({ error: 'Not enough balance.' });
  let w;
  try {
    w = await Withdrawal.create({ userId: u._id, method, network, asset, details, amountMicro: amt, ref: 'TN-' + crypto.randomBytes(4).toString('hex').toUpperCase() });
  } catch (e) {                                           // never lose the user's money if saving fails
    await User.updateOne({ _id: u._id }, { $inc: { balanceMicro: amt } });
    throw e;
  }
  await Tx.create({ userId: u._id, kind: 'withdrawal', amountMicro: -amt, note: w.ref + ' · ' + method });
  res.json({ withdrawal: w, balanceMicro: u.balanceMicro });
}));

// ---------- Admin ----------
app.get('/api/admin/withdrawals', auth, adminOnly, wrap(async (req, res) => {
  const status = ['pending', 'paid', 'rejected'].includes(req.query.status) ? req.query.status : 'pending';
  res.json({ items: await Withdrawal.find({ status }).sort({ _id: 1 }).limit(100).populate('userId', 'name email').lean() });
}));

app.post('/api/admin/withdrawals/:id', auth, adminOnly, wrap(async (req, res) => {
  const status = req.body.status;
  if (!['paid', 'rejected'].includes(status)) return res.status(400).json({ error: 'Bad status.' });
  const w = await Withdrawal.findOneAndUpdate({ _id: req.params.id, status: 'pending' }, { $set: { status, adminNote: String(req.body.note || '').slice(0, 200) } }, { new: true });
  if (!w) return res.status(404).json({ error: 'Already handled or not found.' });
  if (status === 'rejected') {                                   // money goes back to the user
    await User.updateOne({ _id: w.userId }, { $inc: { balanceMicro: w.amountMicro } });
    await Tx.create({ userId: w.userId, kind: 'refund', amountMicro: w.amountMicro, note: 'Withdrawal rejected' });
  }
  res.json({ ok: true });
}));

export default app;