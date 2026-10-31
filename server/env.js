import dns from 'node:dns';

// On your own computer only: some internet providers block the DNS lookup that mongodb+srv:// links need
// ("Cannot find the cluster address"). Using public DNS servers fixes it. Vercel does not need this.
if (process.env.NODE_ENV !== 'production') {
  try { dns.setServers(['8.8.8.8', '1.1.1.1']); dns.setDefaultResultOrder('ipv4first'); } catch { /* ignore */ }
}

// Backup way to give the server its secrets. If .env is not being read, put them in server/local.config.js instead.
// That file is listed in .gitignore, so it is never uploaded to GitHub. On Vercel, use Environment Variables.
let local = {};
try { local = (await import('./local.config.js')).default || {}; } catch { /* no local file: that's fine */ }
for (const k of ['MONGODB_URI', 'JWT_SECRET', 'ADMIN_EMAIL']) {
  if (!process.env[k] && local[k]) process.env[k] = local[k];
}