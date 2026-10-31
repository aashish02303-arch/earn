export async function api(path, opts = {}) {
  const r = await fetch('/api' + path, {
    method: opts.method || (opts.body ? 'POST' : 'GET'),
    headers: opts.body ? { 'Content-Type': 'application/json' } : {},
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    credentials: 'same-origin'
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(d.error || 'Request failed'); e.status = r.status; throw e; }
  return d;
}
// Money is stored in micro-rupees. inr() shows rupees, usdOf() shows the dollar value.
export const inr = m => (m < 0 ? '−' : '') + '₹' + Math.abs(m / 1e6).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const usdOf = (m, rate) => '$' + (m / 1e6 / rate).toFixed(2);
export const dayIST = (o = 0) => new Date(Date.now() + 19800000 + o * 864e5).toISOString().slice(0, 10);