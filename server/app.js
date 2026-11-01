import './env.js';
import express from 'express';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import mongoose from 'mongoose';
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
  let p;
  try { p = jwt.verify(req.cookies.tn, process.env.JWT_SECRET); }
  catch { return res.status(401).json({ error: 'Please log in.' }); }          // no cookie, or expired: log in again
  try {
    const u = await User.findById(p.id);
    if (!u) return res.status(401).json({ error: 'Please log in.' });         // the account no longer exists
    if (u.banned) return res.status(403).json({ error: 'Your account has been suspended.', banned: true });
    req.user = u; next();
  } catch (e) {                                                                // a database hiccup is NOT a logout
    console.error('auth lookup failed:', e.message);
    res.status(503).json({ error: 'The server is busy. Please try again.' });
  }
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
  if (u.banned) return res.status(403).json({ error: 'Your account has been suspended.', banned: true });
  if (isAdminEmail(email) && !u.isAdmin) { u.isAdmin = true; await u.save(); }
  setCookie(res, u);
  res.json({ user: pub(u) });
}));

app.post('/api/auth/logout', (req, res) => { res.clearCookie('tn'); res.json({ ok: true }); });

// ---------- Account ----------
app.get('/api/me', auth, wrap(async (req, res) => {
  setCookie(res, req.user);                                                  // keep the login alive: 30 more days
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

// ---------- Admin: users ----------
const esc = t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const goodId = (req, res, next) => mongoose.isValidObjectId(req.params.id) ? next() : res.status(400).json({ error: 'Bad user id.' });
const target = async (req, res) => {
  const u = await User.findById(req.params.id);
  if (!u) { res.status(404).json({ error: 'User not found.' }); return null; }
  return u;
};

app.get('/api/admin/users', auth, adminOnly, wrap(async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 60);
  const find = q ? { $or: ['name', 'email', 'referralCode'].map(k => ({ [k]: { $regex: esc(q), $options: 'i' } })) } : {};
  const users = await User.find(find).select('name email balanceMicro totalSteps banned isAdmin referralCode createdAt').sort({ _id: -1 }).limit(30).lean();
  res.json({ users });
}));

app.get('/api/admin/users/:id', auth, adminOnly, goodId, wrap(async (req, res) => {
  const user = await User.findById(req.params.id).select('-passwordHash').lean();
  if (!user) return res.status(404).json({ error: 'User not found.' });
  const [referredBy, invited, tx, pending] = await Promise.all([
    user.referredBy ? User.findById(user.referredBy).select('name email referralCode').lean() : null,
    User.find({ referredBy: user._id }).select('name email totalSteps referralPaid').sort({ _id: -1 }).limit(50).lean(),
    Tx.find({ userId: user._id }).sort({ _id: -1 }).limit(10).lean(),
    Withdrawal.countDocuments({ userId: user._id, status: 'pending' })
  ]);
  res.json({ user, referredBy, invited, tx, pending });
}));

// Add or remove money (any amount, with a note the user can see in their activity)
app.post('/api/admin/users/:id/balance', auth, adminOnly, goodId, wrap(async (req, res) => {
  const u = await target(req, res); if (!u) return;
  const inr = Number(req.body.amountInr), mode = req.body.mode;
  if (!(inr >= 0.01 && inr <= 1000000) || !['add', 'remove'].includes(mode)) return res.status(400).json({ error: 'Enter an amount from 0.01 to 10,00,000 rupees.' });
  const micro = Math.round(inr * 1e6), note = String(req.body.note || '').trim().slice(0, 80);
  const nu = await User.findOneAndUpdate(
    mode === 'add' ? { _id: u._id } : { _id: u._id, balanceMicro: { $gte: micro } },
    { $inc: { balanceMicro: mode === 'add' ? micro : -micro } }, { new: true });
  if (!nu) return res.status(400).json({ error: 'This user only has ' + (u.balanceMicro / 1e6).toFixed(2) + ' rupees.' });
  await Tx.create({ userId: u._id, kind: 'admin', amountMicro: mode === 'add' ? micro : -micro, note: 'Admin: ' + (note || (mode === 'add' ? 'money added' : 'money removed')) });
  res.json({ balanceMicro: nu.balanceMicro });
}));

// Ban or unban. A banned user is logged out on their next request and cannot log in.
app.post('/api/admin/users/:id/ban', auth, adminOnly, goodId, wrap(async (req, res) => {
  const u = await target(req, res); if (!u) return;
  if (u.isAdmin) return res.status(400).json({ error: 'You cannot ban an admin.' });
  const banned = !!req.body.banned;
  await User.updateOne({ _id: u._id }, { $set: { banned, bannedReason: banned ? String(req.body.reason || '').slice(0, 120) : '' } });
  res.json({ banned });
}));

// Referral tools: 'detach' removes this user from whoever invited them (optionally taking the reward back),
// 'clearInvited' removes everyone this user invited.
app.post('/api/admin/users/:id/referral', auth, adminOnly, goodId, wrap(async (req, res) => {
  const u = await target(req, res); if (!u) return;
  if (req.body.action === 'detach') {
    if (!u.referredBy) return res.status(400).json({ error: 'This user was not invited by anyone.' });
    let took = 0;
    if (req.body.takeBack && u.referralPaid) {
      const ref = await User.findById(u.referredBy);
      if (ref) {
        took = Math.min(ref.balanceMicro, C.referralMicro);
        if (took > 0) {
          const ok = await User.findOneAndUpdate({ _id: ref._id, balanceMicro: { $gte: took } }, { $inc: { balanceMicro: -took } });
          if (ok) await Tx.create({ userId: ref._id, kind: 'admin', amountMicro: -took, note: 'Admin: referral reward taken back' }); else took = 0;
        }
      }
    }
    await User.updateOne({ _id: u._id }, { $unset: { referredBy: 1 }, $set: { referralPaid: false } });
    return res.json({ ok: true, tookMicro: took });
  }
  if (req.body.action === 'clearInvited') {
    const r = await User.updateMany({ referredBy: u._id }, { $unset: { referredBy: 1 }, $set: { referralPaid: false } });
    return res.json({ ok: true, cleared: r.modifiedCount });
  }
  res.status(400).json({ error: 'Unknown action.' });
}));

// Delete a user for good. Must type their email, and they cannot have a pending payout.
app.delete('/api/admin/users/:id', auth, adminOnly, goodId, wrap(async (req, res) => {
  const u = await target(req, res); if (!u) return;
  if (u.isAdmin) return res.status(400).json({ error: 'You cannot delete an admin.' });
  if (String(req.body.confirmEmail || '').trim().toLowerCase() !== u.email) return res.status(400).json({ error: 'Type the user\'s exact email to confirm.' });
  if (await Withdrawal.exists({ userId: u._id, status: 'pending' })) return res.status(400).json({ error: 'This user has a pending payout. Pay or reject it first.' });
  await User.updateMany({ referredBy: u._id }, { $unset: { referredBy: 1 }, $set: { referralPaid: false } });
  await Promise.all([Steps.deleteMany({ userId: u._id }), Tx.deleteMany({ userId: u._id }), User.deleteOne({ _id: u._id })]);
  res.json({ ok: true });
}));

export default app;