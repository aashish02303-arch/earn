import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api, inr } from '../api.js';

const when = x => x ? new Date(x).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

// ---------------- Payout requests ----------------
function Payouts({ me, notify }) {
  const rate = me.config.usdInr;
  const [status, setStatus] = useState('pending');
  const [items, setItems] = useState([]);
  const load = () => api('/admin/withdrawals?status=' + status).then(d => setItems(d.items)).catch(e => notify(e.message));
  useEffect(() => { load(); }, [status]);
  async function act(id, s) {
    if (s === 'rejected' && !confirm('Reject this request and return the money to the user?')) return;
    try { await api('/admin/withdrawals/' + id, { body: { status: s } }); notify('Done'); load(); } catch (e) { notify(e.message); }
  }
  const how = x => x.method === 'upi' ? 'Send ' + inr(x.amountMicro) + ' by UPI'
    : x.method === 'paypal' ? 'Send $' + (x.amountMicro / 1e6 / rate).toFixed(2) + ' by PayPal'
    : x.asset === 'SOL' ? 'Send SOL worth ' + inr(x.amountMicro) + ' (Solana)'
    : 'Send ' + (x.amountMicro / 1e6 / rate).toFixed(2) + ' ' + x.asset + ' (Solana)';
  return (<>
    <div className="row" style={{ margin: '0 0 24px' }}>
      {['pending', 'paid', 'rejected'].map(s => <button key={s} className={'btn ' + (s === status ? '' : 'ghost')} onClick={() => setStatus(s)}>{s}</button>)}
    </div>
    <div className="card" data-t="requests.log" style={{ marginRight: 8 }}>
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
  </>);
}

// ---------------- Users ----------------
function Users({ me, notify }) {
  const [q, setQ] = useState('');
  const [list, setList] = useState(null);
  const [sel, setSel] = useState(null);
  const [d, setD] = useState(null);
  const [amt, setAmt] = useState('');
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const [takeBack, setTakeBack] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState('');
  const find = e => { if (e) e.preventDefault(); return api('/admin/users?q=' + encodeURIComponent(q)).then(r => setList(r.users)).catch(x => notify(x.message)); };
  const loadD = id => api('/admin/users/' + id).then(setD).catch(x => notify(x.message));
  useEffect(() => { find(); }, []);
  useEffect(() => { if (sel) { setD(null); setConfirmEmail(''); setTakeBack(false); loadD(sel); } }, [sel]);

  const run = async (fn, ok) => { try { await fn(); notify(ok); await loadD(sel); find(); } catch (x) { notify(x.message); } };
  const post = (path, body) => api('/admin/users/' + sel + path, { body });
  const money = mode => {
    const n = parseFloat(amt);
    if (!(n > 0)) return notify('Enter an amount in rupees.');
    if (!confirm((mode === 'add' ? 'Add ' : 'Remove ') + '₹' + n + (mode === 'add' ? ' to ' : ' from ') + d.user.email + '?')) return;
    run(() => post('/balance', { amountInr: n, mode, note }), mode === 'add' ? 'Money added' : 'Money removed');
    setAmt(''); setNote('');
  };
  const ban = b => { if (confirm((b ? 'Ban ' : 'Unban ') + d.user.email + '?')) run(() => post('/ban', { banned: b, reason }), b ? 'User banned' : 'User unbanned'); };
  const detach = () => { if (confirm('Remove ' + d.user.email + ' from the person who invited them?')) run(() => post('/referral', { action: 'detach', takeBack }), 'Referral link removed'); };
  const clearInv = () => { if (confirm('Remove all ' + d.invited.length + ' people this user invited?')) run(() => post('/referral', { action: 'clearInvited' }), 'Invites removed'); };
  const del = async () => {
    try { await api('/admin/users/' + sel, { method: 'DELETE', body: { confirmEmail } }); notify('User deleted'); setSel(null); setD(null); find(); }
    catch (x) { notify(x.message); }
  };

  const u = d?.user;
  return (
    <div className="admingrid">
      <section className="card" data-t="users.log">
        <form onSubmit={find}>
          <input className="in" placeholder="Search name, email or code" value={q} onChange={e => setQ(e.target.value)} aria-label="Search users" />
          <button className="btn full" style={{ width: '100%' }} type="submit">Search</button>
        </form>
        <ul className="list" style={{ marginTop: 14 }}>
          {list === null && <li>Loading…</li>}
          {list && list.length === 0 && <li>No users found</li>}
          {list && list.map(x => (
            <li key={x._id} style={{ padding: 0 }}>
              <button className="urow" aria-current={sel === x._id} onClick={() => setSel(x._id)}>
                {x.name || 'No name'}{x.banned ? ' · BANNED' : ''}{x.isAdmin ? ' · ADMIN' : ''}
                <small>{x.email} · {inr(x.balanceMicro)}</small>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <div className="stack">
        {!sel && <section className="card" data-t="select-a-user.txt"><p>Pick a user on the left to see their details and use the admin tools.</p></section>}
        {sel && !d && <section className="card" data-t="loading.txt"><p>Loading…</p></section>}
        {u && <>
          <section className="card" data-t="user.txt">
            <div className="big">{inr(u.balanceMicro)}</div>
            <p style={{ margin: '6px 0 14px' }}>{u.banned ? <span className="tag rejected">Banned{u.bannedReason ? ': ' + u.bannedReason : ''}</span> : <span className="tag paid">Active</span>} {u.isAdmin && <span className="tag">Admin</span>}</p>
            <dl className="kv">
              <dt>Name</dt><dd>{u.name || '—'}</dd>
              <dt>Email</dt><dd>{u.email}</dd>
              <dt>All-time steps</dt><dd>{Number(u.totalSteps).toLocaleString()}</dd>
              <dt>Invite code</dt><dd>{u.referralCode}</dd>
              <dt>Joined</dt><dd>{when(u.createdAt)}</dd>
              <dt>Pending payouts</dt><dd>{d.pending}</dd>
            </dl>
          </section>

          <section className="card" data-t="money.exe">
            <label htmlFor="am">Amount in rupees</label>
            <input className="in" id="am" type="number" min="0" step="0.01" inputMode="decimal" placeholder="0.00" value={amt} onChange={e => setAmt(e.target.value)} />
            <label htmlFor="nt">Note (the user sees it in their activity)</label>
            <input className="in" id="nt" maxLength={80} placeholder="For example: bonus, correction" value={note} onChange={e => setNote(e.target.value)} />
            <div className="two2"><button className="btn" onClick={() => money('add')}>Add money</button><button className="btn ghost" onClick={() => money('remove')}>Remove money</button></div>
          </section>

          <section className="card" data-t="status.exe">
            {u.isAdmin ? <p>Admin accounts cannot be banned.</p> : <>
              <label htmlFor="rs">Reason (optional)</label>
              <input className="in" id="rs" maxLength={120} placeholder="For example: fake steps" value={reason} onChange={e => setReason(e.target.value)} />
              {u.banned ? <button className="btn" onClick={() => ban(false)}>Unban this user</button> : <button className="btn" onClick={() => ban(true)}>Ban this user</button>}
              <p className="sm" style={{ marginTop: 10 }}>A banned user is logged out and cannot log in. Their money and history stay as they are.</p>
            </>}
          </section>

          <section className="card" data-t="referral.log">
            <dl className="kv">
              <dt>Invited by</dt><dd>{d.referredBy ? `${d.referredBy.name || 'No name'} (${d.referredBy.email})` : 'No one'}</dd>
              <dt>Reward paid</dt><dd>{d.referredBy ? (u.referralPaid ? 'Yes' : 'Not yet') : '—'}</dd>
              <dt>People invited</dt><dd>{d.invited.length} · {d.invited.filter(x => x.referralPaid).length} completed</dd>
            </dl>
            {d.invited.length > 0 && <ul className="list" style={{ marginTop: 10 }}>
              {d.invited.map(x => <li key={x._id}><span>{x.name || 'No name'}<br /><span className="sm">{x.email} · {Number(x.totalSteps).toLocaleString()} steps</span></span>
                <span className={'tag' + (x.referralPaid ? ' paid' : '')}>{x.referralPaid ? 'Completed' : 'Walking'}</span></li>)}
            </ul>}
            <div style={{ marginTop: 16 }}>
              {d.referredBy && <>
                {u.referralPaid && <label className="check" style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}><input type="checkbox" checked={takeBack} onChange={e => setTakeBack(e.target.checked)} />Also take the reward back from the person who invited them</label>}
                <button className="btn" onClick={detach}>Remove referral link</button>{' '}
              </>}
              {d.invited.length > 0 && <button className="btn ghost" onClick={clearInv}>Remove all their invites</button>}
            </div>
          </section>

          <section className="card" data-t="recent.log">
            <ul className="list">
              {d.tx.length === 0 && <li>No activity yet</li>}
              {d.tx.map(x => <li key={x._id}><span>{x.note || x.kind}</span><span className={x.amountMicro > 0 ? 'pos' : 'neg'}>{x.amountMicro > 0 ? '+' : ''}{inr(x.amountMicro)}</span></li>)}
            </ul>
          </section>

          {!u.isAdmin && <section className="card" data-t="delete.exe">
            <p className="sm" style={{ marginBottom: 10 }}>This deletes the user, their steps and their activity for good. It cannot be undone. Type their email to confirm.</p>
            <input className="in" placeholder={u.email} value={confirmEmail} onChange={e => setConfirmEmail(e.target.value)} aria-label="Type the email to confirm" />
            <button className="btn" disabled={confirmEmail.trim().toLowerCase() !== u.email} onClick={del}>Delete user</button>
          </section>}
        </>}
      </div>
    </div>
  );
}

export default function Admin() {
  const { me, notify } = useOutletContext();
  const [tab, setTab] = useState('payouts');
  if (!me.user.isAdmin) return <main className="container"><h1>Admin</h1><p className="lead">This page is only for the admin account.</p></main>;
  return (
    <main className="container" style={{ width: 'min(1080px,92%)' }}>
      <h1>Admin</h1>
      <div className="row" style={{ margin: '0 0 28px' }}>
        <button className={'btn ' + (tab === 'payouts' ? '' : 'ghost')} onClick={() => setTab('payouts')}>Payouts</button>
        <button className={'btn ' + (tab === 'users' ? '' : 'ghost')} onClick={() => setTab('users')}>Users</button>
      </div>
      {tab === 'payouts' ? <Payouts me={me} notify={notify} /> : <Users me={me} notify={notify} />}
    </main>
  );
}