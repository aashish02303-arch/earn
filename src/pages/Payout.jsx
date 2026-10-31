import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import useStyle from '../useStyle.js';
import retro from '../retro.css?inline';
import css from '../payout.css?inline';
import Logo from './Logos.jsx';
import { api, inr } from '../api.js';

const M = {
  upi: { name: 'UPI', sub: 'Paid in rupees', label: 'UPI ID', ph: 'name@bank', note: 'Rupees are sent to this UPI ID.' },
  paypal: { name: 'PayPal', sub: 'Paid in USD', label: 'PayPal email', ph: 'you@example.com', note: 'US dollars are sent to this PayPal account.' },
  crypto: { name: 'Crypto', sub: 'USDT · USDC · SOL', label: 'Solana wallet address', ph: 'Paste your Solana address', note: 'Sent on the Solana network only. Crypto sent to an address from another network cannot be recovered.' },
  amazon: { name: 'Amazon', sub: 'Gift code', soon: true },
  flipkart: { name: 'Flipkart', sub: 'Gift code', soon: true }
};
const ASSETS = ['USDT', 'USDC', 'SOL'];
const EMAIL = /^\S+@\S+\.\S+$/;
function valid(m, d) {
  d = d.trim();
  if (m === 'upi') return /^[a-zA-Z0-9._-]{2,64}@[a-zA-Z][a-zA-Z0-9.-]{1,30}$/.test(d);
  if (m === 'crypto') return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(d);
  return EMAIL.test(d);
}
function mask(m, d, asset) {
  if (m === 'crypto') return (asset ? asset + ' · ' : '') + d.slice(0, 4) + '…' + d.slice(-4);
  const [a, b] = d.split('@'); return b ? a.slice(0, 2) + '•••@' + b : d;
}
const when = x => new Date(x).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const wait = ms => new Promise(r => setTimeout(r, ms));
const STAGES = ['Verifying your details', 'Securing your request', 'Sending for review'];

export default function Payout() {
  useStyle(retro); useStyle(css);
  const { me, reload, notify } = useOutletContext();
  const { user, config: c } = me;
  const [method, setMethod] = useState('upi');
  const [asset, setAsset] = useState('USDT');
  const [details, setDetails] = useState('');
  const [amount, setAmount] = useState('');           // in rupees
  const [items, setItems] = useState(null);
  const [filter, setFilter] = useState('all');
  const [modal, setModal] = useState('');              // '' | review | process | done | error
  const [agree, setAgree] = useState(false);
  const [stage, setStage] = useState(0);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState('');

  const load = () => api('/withdrawals').then(d => setItems(d.items)).catch(e => notify(e.message));
  useEffect(() => { load(); }, []);
  useEffect(() => {
    const k = e => { if (e.key === 'Escape' && modal !== 'process') setModal(''); };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [modal]);

  const m = M[method];
  const micro = Math.round((parseFloat(amount) || 0) * 1e6);
  const usdVal = micro / 1e6 / c.usdInr;
  const okDetails = valid(method, details);
  const minMicro = c.minWithdrawMicro;
  const canAfford = user.balanceMicro >= minMicro;
  const amtBad = micro > 0 && (micro < minMicro ? 'Minimum is ' + inr(minMicro) : micro > user.balanceMicro ? 'More than your balance' : '');
  const ready = okDetails && micro >= minMicro && micro <= user.balanceMicro;
  const receive = method === 'upi' ? inr(micro) + ' by UPI'
    : method === 'paypal' ? '≈ $' + usdVal.toFixed(2) + ' USD'
    : asset === 'SOL' ? 'SOL worth ' + inr(micro)
    : '≈ ' + usdVal.toFixed(2) + ' ' + asset;
  const setPct = p => setAmount((Math.floor(user.balanceMicro * p / 1e6) / 100).toFixed(2));
  const title = x => M[x.method].name + (x.asset ? ' · ' + x.asset : '');

  async function send() {
    setModal('process'); setStage(0); setErr('');
    const p = api('/withdrawals', { body: { method, asset: method === 'crypto' ? asset : undefined, details: details.trim(), amountMicro: micro } })
      .then(v => ({ v }), e => ({ e }));
    await wait(800); setStage(1); await wait(800); setStage(2);
    const r = await p; await wait(600);
    if (r.e) { setErr(r.e.message); setModal('error'); return; }
    setResult(r.v.withdrawal); setModal('done'); setDetails(''); setAmount(''); setAgree(false);
    load(); reload();
  }

  const shown = (items || []).filter(x => filter === 'all' || x.status === filter);
  const copy = async t => { try { await navigator.clipboard.writeText(t); notify('Reference copied'); } catch { notify(t); } };

  return (
    <main className="container">
      <div className="pay-head"><h1>Withdraw</h1><span className="secure">SECURE PAYOUT</span></div>
      <p className="lead">Every request gets a reference number and is reviewed before it is paid.</p>

      <div className="pay-grid">
        <section className="card" data-t="withdraw.exe">
          <div className="sec">
            <p className="step-title"><i>1</i>Choose how to get paid</p>
            <fieldset className="tiles">
              <legend style={{ position: 'absolute', left: -9999 }}>Payout method</legend>
              {Object.entries(M).map(([k, v]) => (
                <label className={'tile' + (v.soon ? ' soon' : '')} key={k}>
                  <input type="radio" name="method" disabled={!!v.soon} checked={method === k} onChange={() => { setMethod(k); setDetails(''); }} />
                  <div><Logo m={k} size={38} /><span><b>{v.name}</b>{v.soon ? <span className="soon-tag">Coming soon</span> : <small>{v.sub}</small>}</span></div>
                </label>
              ))}
            </fieldset>
          </div>

          <div className="sec">
            <p className="step-title"><i>2</i>Where should we send it?</p>
            {method === 'crypto' && <>
              <label>Coin (all on the Solana network)</label>
              <div className="assets" role="radiogroup" aria-label="Coin">
                {ASSETS.map(a => (
                  <label className="asset" key={a}><input type="radio" name="asset" checked={asset === a} onChange={() => setAsset(a)} />
                    <div><Logo m={a.toLowerCase()} size={28} />{a}</div></label>
                ))}
              </div>
            </>}
            <label htmlFor="det">{m.label}</label>
            <div className="field-wrap">
              <input className="in" id="det" autoComplete="off" spellCheck="false" maxLength={200} placeholder={m.ph} value={details} onChange={e => setDetails(e.target.value)} />
              {okDetails && <span className="ok" aria-label="Looks valid">✓</span>}
            </div>
            <p className={'hint' + (details && !okDetails ? ' bad' : '')}>{details && !okDetails ? 'This does not look right. Please check it.' : m.note}</p>
          </div>

          <div className="sec" style={{ marginBottom: 0 }}>
            <p className="step-title"><i>3</i>How much?</p>
            <div className="amt"><span>₹</span><input inputMode="decimal" type="number" step="0.01" min="0" placeholder="0.00" aria-label="Amount in rupees" value={amount} onChange={e => setAmount(e.target.value)} /></div>
            <div className="chips">
              <button type="button" disabled={!canAfford} onClick={() => setAmount((minMicro / 1e6).toFixed(2))}>Minimum</button>
              <button type="button" disabled={!canAfford} onClick={() => setPct(50)}>50%</button>
              <button type="button" disabled={!canAfford} onClick={() => setPct(100)}>Max</button>
            </div>
            <p className={'hint' + (amtBad ? ' bad' : '')}>{amtBad || (canAfford ? 'Minimum ' + inr(minMicro) : 'You need at least ' + inr(minMicro) + ' to withdraw.')}</p>
            <div className="recv"><span>You receive</span><span>{micro ? receive : '—'}</span></div>
            <button className="btn cta" disabled={!ready} onClick={() => { setAgree(false); setModal('review'); }}>Review withdrawal</button>
          </div>
        </section>

        <aside style={{ display: 'grid', gap: 18 }}>
          <section className="card green" data-t="balance.txt">
            <h2>Available balance</h2>
            <div className="big">{inr(user.balanceMicro)}</div>
            <p className="sm">Minimum withdrawal {inr(minMicro)}</p>
          </section>
          <section className="card" data-t="security.txt">
            <h2>Your money is protected</h2>
            <ul className="trust">
              <li><span>■</span><span>The amount is held the moment you request, so it can never be spent twice.</span></li>
              <li><span>■</span><span>Every request has a reference number you can quote to us.</span></li>
              <li><span>■</span><span>If a request is rejected, the full amount returns to your balance.</span></li>
            </ul>
          </section>
        </aside>
      </div>

      <section className="card" data-t="transactions.log">
        <div className="txhead">
          <h2>Transactions</h2>
          <div className="filters" role="group" aria-label="Filter transactions">
            {['all', 'pending', 'paid', 'rejected'].map(f => <button key={f} aria-pressed={filter === f} onClick={() => setFilter(f)}>{f}</button>)}
          </div>
        </div>
        <ul className="txns">
          {items === null && <li className="empty">Loading…</li>}
          {items && shown.length === 0 && <li className="empty">{items.length ? 'Nothing in this filter.' : 'No withdrawals yet. Your requests will appear here.'}</li>}
          {shown.map(x => {
            const rej = x.status === 'rejected', paid = x.status === 'paid';
            return (
              <li className="txn" key={x._id}>
                <Logo m={x.asset ? x.asset.toLowerCase() : x.method} size={42} />
                <div>
                  <div className="t1">{title(x)} · {mask(x.method, x.details, '')}</div>
                  <div className="t2">{x.ref || 'Earlier request'} · {when(x.createdAt)}{x.ref && <button className="copy" onClick={() => copy(x.ref)}>Copy</button>}</div>
                </div>
                <div className="amtcol"><b>{inr(x.amountMicro)}</b></div>
                <div className="tl" aria-label={'Status: ' + x.status}>
                  <i className="on" /><em>Submitted</em>
                  <i className={paid || rej ? 'on' : 'act'} /><em>Under review</em>
                  <i className={paid ? 'on' : rej ? 'bad' : ''} /><em style={{ fontWeight: 800 }}>{rej ? 'Rejected · refunded' : 'Paid'}</em>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {modal && (
        <div className="ov" onMouseDown={e => { if (e.target === e.currentTarget && modal !== 'process') setModal(''); }}>
          <div className="sheet" data-t="withdraw.exe" role="dialog" aria-modal="true" aria-label="Withdrawal">
            {modal === 'review' && <>
              <h3>Confirm your withdrawal</h3>
              <div className="sum">
                <div><span>Method</span><span className="who"><Logo m={method === 'crypto' ? asset.toLowerCase() : method} size={26} />{method === 'crypto' ? asset + ' (Solana)' : m.name}</span></div>
                <div><span>Send to</span><b>{mask(method, details.trim(), '')}</b></div>
                <div><span>Amount</span><b>{inr(micro)}</b></div>
                <div><span>You receive</span><b>{receive}</b></div>
                <div><span>Balance after</span><b>{inr(user.balanceMicro - micro)}</b></div>
              </div>
              <label className="agree"><input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} />I checked that these details are correct. A wrong address or ID cannot always be recovered.</label>
              <div className="two"><button className="btn ghost" onClick={() => setModal('')}>Back</button><button className="btn" disabled={!agree} onClick={send}>Confirm &amp; send</button></div>
            </>}
            {modal === 'process' && <div className="proc">
              <div className="spin" aria-hidden="true" />
              <h3 style={{ marginBottom: 0 }}>Processing your request</h3>
              <p className="sm">Please keep this window open.</p>
              <ul className="stages" role="status">
                {STAGES.map((t, i) => <li key={t} className={(i <= stage ? 'on ' : '') + (i < stage ? 'done' : '')}><i>{i < stage ? '✓' : ''}</i>{t}</li>)}
              </ul>
            </div>}
            {modal === 'done' && result && <div className="receipt">
              <svg className="tick" viewBox="0 0 72 72" aria-hidden="true"><circle cx="36" cy="36" r="30" /><path d="M23 37l9 9 18-20" /></svg>
              <h3>Request sent</h3>
              <p className="sm">We will review it and pay you by hand. You can follow the status below.</p>
              <div className="refbox">{result.ref}<button className="copy" onClick={() => copy(result.ref)}>Copy</button></div>
              <div className="sum" style={{ textAlign: 'left' }}>
                <div><span>Method</span><span className="who"><Logo m={result.asset ? result.asset.toLowerCase() : result.method} size={26} />{title(result)}</span></div>
                <div><span>Amount</span><b>{inr(result.amountMicro)}</b></div>
                <div><span>Status</span><span className="tag pending">pending</span></div>
              </div>
              <button className="btn cta" onClick={() => setModal('')}>Done</button>
            </div>}
            {modal === 'error' && <div className="receipt">
              <h3>We could not send it</h3>
              <p className="sm" style={{ marginBottom: 16 }}>{err} Your balance was not changed.</p>
              <div className="two"><button className="btn ghost" onClick={() => setModal('')}>Close</button><button className="btn" onClick={() => setModal('review')}>Try again</button></div>
            </div>}
          </div>
        </div>
      )}
    </main>
  );
}