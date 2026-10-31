import mongoose from 'mongoose';
// Reuse one connection between serverless calls (Vercel keeps warm instances alive)
const cache = globalThis._mongo || (globalThis._mongo = { conn: null, p: null });

// Turns a scary MongoDB error into a plain instruction
export function explain(e) {
  const m = String((e && e.message) || e);
  if (/MONGODB_URI is missing/.test(m))
    return 'MONGODB_URI was not found. Create a file named .env (not .env.example) in the project root, paste your link in it, then stop and restart npm run dev. On Vercel, add it under Environment Variables and redeploy.';
  if (/bad auth|Authentication failed/i.test(m))
    return 'Wrong database username or password. Check the user in Atlas > Database Access. If the password has symbols like @ or #, replace them (@ becomes %40, # becomes %23).';
  if (/Invalid scheme|Invalid connection string|must be escaped|Unescaped|URI must/i.test(m))
    return 'The link format is wrong. It must start with mongodb+srv:// and must not contain the < > brackets around the password.';
  if (/querySrv|ENOTFOUND|EAI_AGAIN/i.test(m))
    return 'Cannot find the cluster address. Check the host in MONGODB_URI (it looks like cluster0.abcde.mongodb.net) and your internet or DNS. Try another network, or Atlas’s non-SRV connection string.';
  if (/timed out|Server selection|ReplicaSetNoPrimary|ECONNREFUSED|whitelist|ETIMEDOUT/i.test(m))
    return 'Atlas is not letting this computer in. In Atlas open Network Access > Add IP Address > Allow Access From Anywhere (0.0.0.0/0), wait 1 to 2 minutes, then try again. Also check the cluster is not paused.';
  return 'Could not connect: ' + m;
}

export default async function connect() {
  if (cache.conn) return cache.conn;
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is missing');
  cache.p = cache.p || mongoose.connect(process.env.MONGODB_URI, { bufferCommands: false, serverSelectionTimeoutMS: 8000 });
  try {
    cache.conn = await cache.p;
    return cache.conn;
  } catch (e) {
    cache.p = null; cache.conn = null;      // forget the failure so the next request can try again after you fix it
    throw e;
  }
}
