import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { api, inr, dayIST } from '../api.js';

export default function Dashboard() {
  const { me, notify } = useOutletContext();
  const { user, config: c, today } = me;
  const [d, setD] = useState(null);
  useEffect(() => { api('/dashboard').then(setD).catch(e => notify(e.message)); }, []);

  const link = location.origin + '/signup?ref=' + user.referralCode;
  const map = {};
  (d?.week || []).forEach(x => { map[x.day] = x.steps; });
  const copy = async () => { try { await navigator.clipboard.writeText(link); notify('Link copied'); } catch { notify('Select the link and copy it'); } };

  return (
    <main className="container">
      <h1>Hi, {user.name || 'friend'}</h1>
      <p className="lead">Walk, earn and invite friends. Here is your day at a glance.</p>
      <div className="grid">
        <section className="card green" data-t="balance.txt">
          <h2>Your balance</h2>
          <div className="big">{inr(user.balanceMicro)}</div>
          <p className="sm">Paid in rupees · minimum payout {inr(c.minWithdrawMicro)}</p>
          <div className="row"><Link className="btn alt" to="/payout">Withdraw</Link></div>
        </section>
        <section className="card" data-t="today.exe">
          <h2>Today’s steps</h2>
          <div className="big">{today.toLocaleString()}</div>
          <div className="meter"><div style={{ width: Math.min(100, today / c.dailyStepCap * 100) + '%' }} /></div>
          <p className="sm">Limit {c.dailyStepCap.toLocaleString()} steps a day · ₹{c.inrPer1000Steps} per 1,000 steps</p>
          <div className="row"><Link className="btn" to="/walk">Start walking</Link></div>
        </section>
        <section className="card full" data-t="last-7-days.chart">
          <h2>Last 7 days</h2>
          <div className="week" role="img" aria-label="Steps per day for the last 7 days">
            {[6, 5, 4, 3, 2, 1, 0].map(i => {
              const day = dayIST(-i), v = map[day] || 0;
              return <div key={day} className={i === 0 ? 'now' : ''}>
                <b style={{ height: Math.max(3, v / c.dailyStepCap * 100) + '%' }} title={v + ' steps'} />
                <span>{new Date(day + 'T00:00:00Z').toLocaleDateString('en', { weekday: 'short', timeZone: 'UTC' })}</span>
              </div>;
            })}
          </div>
          <p className="sm" style={{ marginTop: 12 }}>All-time steps: {Number(user.totalSteps).toLocaleString()}</p>
        </section>
        <section className="card purple" data-t="invite.link">
          <h2>Invite friends</h2>
          <p className="sm" style={{ marginBottom: 12 }}>Earn {inr(c.referralMicro)} for every friend who reaches {c.referralSteps.toLocaleString()} steps.</p>
          <input className="in" readOnly value={link} aria-label="Your invite link" onFocus={e => e.target.select()} />
          <button className="btn" onClick={copy}>Copy link</button>
          <p style={{ marginTop: 14 }}><span className="tag">{d?.invited ?? 0} invited</span> <span className="tag">{d?.completed ?? 0} completed</span></p>
        </section>
        <section className="card" data-t="activity.log">
          <h2>Recent activity</h2>
          <ul className="list">
            {(d?.tx || []).length === 0 && <li>Nothing yet</li>}
            {(d?.tx || []).map(x => <li key={x._id}><span>{x.note || x.kind}</span>
              <span className={x.amountMicro > 0 ? 'pos' : 'neg'}>{x.amountMicro > 0 ? '+' : ''}{inr(x.amountMicro)}</span></li>)}
          </ul>
        </section>
      </div>
    </main>
  );
}