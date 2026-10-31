import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api, inr } from '../api.js';

// Open this page as the admin (the email in ADMIN_EMAIL). Pay the user yourself, then press "Mark paid".
export default function Admin() {
  const { me, notify } = useOutletContext();
  const rate = me.config.usdInr;
  const [status, setStatus] = useState('pending');
  const [items, setItems] = useState([]);
  const load = () => api('/admin/withdrawals?status=' + status).then(d => setItems(d.items)).catch(e => notify(e.message));
  useEffect(() => { if (me.user.isAdmin) load(); }, [status]);
  if (!me.user.isAdmin) return <main className="container"><h1>Admin</h1><p className="lead">This page is only for the admin account.</p></main>;

  async function act(id, s) {
    if (s === 'rejected' && !confirm('Reject this request and return the money to the user?')) return;
    try { await api('/admin/withdrawals/' + id, { body: { status: s } }); notify('Done'); load(); } catch (e) { notify(e.message); }
  }
  const how = x => x.method === 'upi' ? 'Send ' + inr(x.amountMicro) + ' by UPI'
    : x.method === 'paypal' ? 'Send $' + (x.amountMicro / 1e6 / rate).toFixed(2) + ' by PayPal'
    : x.asset === 'SOL' ? 'Send SOL worth ' + inr(x.amountMicro) + ' (Solana)'
    : 'Send ' + (x.amountMicro / 1e6 / rate).toFixed(2) + ' ' + x.asset + ' (Solana)';
  return (
    <main className="container">
      <h1>Payout requests</h1>
      <p className="lead">Send the money yourself, then mark the request as paid.</p>
      <div className="row" style={{ marginBottom: 18 }}>
        {['pending', 'paid', 'rejected'].map(s => <button key={s} className={'btn ' + (s === status ? '' : 'ghost')} onClick={() => setStatus(s)}>{s}</button>)}
      </div>
      <div className="card" data-t="requests.log">
        <ul className="list">
          {items.length === 0 && <li>Nothing here</li>}
          {items.map(x => (
            <li key={x._id} style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <span>
                <b>{x.ref || 'old request'}</b> · <b>{inr(x.amountMicro)}</b><br />
                <span className="sm">{how(x)}</span><br />
                <span className="sm">{x.userId?.name} · {x.userId?.email}</span><br />
                <span className="sm">To: {x.details}</span>
              </span>
              {x.status === 'pending' && <span className="row" style={{ margin: 0 }}>
                <button className="btn" onClick={() => act(x._id, 'paid')}>Mark paid</button>
                <button className="btn ghost" onClick={() => act(x._id, 'rejected')}>Reject</button>
              </span>}
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}