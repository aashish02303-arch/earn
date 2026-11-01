import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import useStyle from '../useStyle.js';
import retro from '../retro.css?inline';
import css from '../landing.css?inline';
import Logo, { Mark } from './Logos.jsx';
import Computer from './Art.jsx';
import useSession from '../useSession.js';
import C from '../../server/config.js';   // every number on this page comes from your real rules

const R = n => '₹' + (Number.isInteger(n) ? n.toLocaleString('en-IN') : n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const perStep = C.microPerStep / 1e6;
const minInr = C.minWithdrawMicro / 1e6;
const refInr = C.referralMicro / 1e6;
const Arrow = () => <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true"><path d="M6 16L16 6M8 6h8v8" fill="none" stroke="#000" strokeWidth="2.6" /></svg>;

export default function Landing() {
  useStyle(retro); useStyle(css);
  const { user } = useSession();
  const go = user ? '/dashboard' : '/signup';
  const [menu, setMenu] = useState(false);
  const [steps, setSteps] = useState(3000);
  const worth = steps * perStep;
  const stepsToMin = Math.ceil(minInr / perStep);
  const daysTo = worth > 0 ? Math.ceil(minInr / worth) : null;
  const close = () => setMenu(false);

  const faq = [
    ['Is TaskNest free to join?', <>Yes. Creating an account costs nothing.</>],
    ['How much do I earn?', <>Every 1,000 steps earns {R(C.inrPer1000Steps)}. You can earn on up to {C.dailyStepCap.toLocaleString()} steps a day. Your balance is kept in rupees.</>],
    ['How are my steps counted?', <>Your phone’s motion sensor counts them while TaskNest is open on your phone with the screen on. iPhones ask for permission first. Steps are checked against the time that passed and the daily limit.</>],
    ['How do I get paid?', <>Once you reach {R(minInr)}, request a withdrawal. Pick UPI (paid in rupees), PayPal, or crypto: USDT, USDC or SOL on the Solana network. We review each request and pay it by hand, and you can follow its status with a reference number.</>],
    ['When do Amazon and Flipkart codes arrive?', <>They are coming soon. We will announce them here as soon as they are ready.</>],
    ['What if a request is rejected?', <>The full amount goes straight back to your balance.</>],
    ['How do referrals work?', <>Share your link. When your friend signs up and reaches {C.referralSteps.toLocaleString()} steps in total, you earn {R(refInr)}. It pays once per friend.</>],
    ['Which phones work?', <>Any modern phone browser over a secure link. Laptops have no motion sensor, so use your phone to walk.</>]
  ];

  return (
    <div className="page">
      <header className="nav">
        <div className="wrap nav-in">
          <Link className="logo" to="/"><span className="logo-i"><Mark /></span>tasknest</Link>
          <nav className={'links' + (menu ? ' open' : '')} aria-label="Main">
            <a href="#how" onClick={close}>How it works</a>
            <a href="#earn" onClick={close}>Earnings</a>
            <a href="#payouts" onClick={close}>Payouts</a>
            <a href="#faq" onClick={close}>FAQ</a>
            {!user && <Link to="/login" onClick={close}>Log in</Link>}
            <Link className="btn" to={go}>{user ? 'Dashboard' : 'Get started'}</Link>
          </nav>
          <button className="burger" aria-label="Menu" aria-expanded={menu} onClick={() => setMenu(!menu)}>{menu ? 'X' : '≡'}</button>
        </div>
      </header>

      <section className="wrap hero">
        <div>
          <h1>Walk.<br />Earn.<br />Cash out.</h1>
          <p className="sub">Every 1,000 steps earns you <b>{R(C.inrPer1000Steps)}</b>. Cash out from {R(minInr)} by UPI, PayPal or crypto.</p>
          <div className="row"><Link className="btn big" to={go}>{user ? 'Open dashboard' : 'Start walking free'}</Link><a className="btn big ghost" href="#how">How it works</a></div>
        </div>
        <div className="art"><Computer /></div>
      </section>

      <section className="wrap quick">
        <h3>Quick links</h3>
        <div className="tabs4">
          {[['How it works', '#how'], ['Earnings', '#earn'], ['Payouts', '#payouts'], ['FAQ', '#faq']].map(([t, h]) =>
            <a key={t} href={h}><span>{t}</span><Arrow /></a>)}
        </div>
      </section>

      <section id="how" className="dith">
        <div className="wrap">
          <h2 className="sech">How it works</h2>
          <div className="trio">
            {[['01', 'Sign up free', 'Make an account in a minute. Your own invite link is ready straight away.'],
              ['02', 'Walk with your phone', 'Open TaskNest, tap Start and walk. Your phone’s motion sensor counts each step.'],
              ['03', 'Cash out', 'Reach ' + R(minInr) + ', request a payout and follow it with a reference number.']].map(([n, t, d], i) =>
              <article className="card" data-t={`step-${i + 1}.html`} key={n}>
                <div className="band">{n}</div><h3>{t}</h3><p>{d}</p>
              </article>)}
          </div>
        </div>
      </section>

      <section id="earn" className="wrap earn">
        <div>
          <h2 className="sech">Earnings</h2>
          <p>Slide to a number of steps. These are the exact rates the app uses. The daily limit is {C.dailyStepCap.toLocaleString()} steps.</p>
          <ul className="ticks"><li>{R(C.inrPer1000Steps)} for every 1,000 steps</li><li>Balance kept in rupees</li><li>Cash out from {R(minInr)}</li><li>{R(refInr)} for every friend who walks {C.referralSteps.toLocaleString()} steps</li></ul>
        </div>
        <div className="card" data-t="calculator.exe">
          <label htmlFor="sl">Steps in a day</label>
          <div className="sv">{steps.toLocaleString()}</div>
          <input id="sl" type="range" min="0" max={C.dailyStepCap} step="250" value={steps} onChange={e => setSteps(+e.target.value)} />
          <div className="res">
            <div><span>You earn</span><b>{R(+worth.toFixed(2))}</b></div>
            <div><span>Steps for first payout</span><b>{stepsToMin.toLocaleString()}</b></div>
          </div>
          <p className="sm">{daysTo ? `Walk this much and you reach the ${R(minInr)} payout in ${daysTo} ${daysTo === 1 ? 'day' : 'days'}.` : 'Slide to see how fast you reach your first payout.'}</p>
        </div>
      </section>

      <section id="payouts" className="dith">
        <div className="wrap">
          <h2 className="sech">Payouts</h2>
          <div className="pay">
            <article className="card" data-t="upi.pay"><Logo m="upi" size={56} /><h3>UPI</h3><p>Paid in rupees to your UPI ID.</p><span className="tag paid">Available</span></article>
            <article className="card" data-t="paypal.pay"><Logo m="paypal" size={56} /><h3>PayPal</h3><p>Paid in US dollars.</p><span className="tag paid">Available</span></article>
            <article className="card" data-t="crypto.pay"><div className="coins"><Logo m="usdt" size={44} /><Logo m="usdc" size={44} /><Logo m="sol" size={44} /></div><h3>Crypto</h3><p>USDT, USDC or SOL on the Solana network.</p><span className="tag paid">Available</span></article>
            <article className="card soon" data-t="amazon.pay"><Logo m="amazon" size={56} /><h3>Amazon</h3><p>Gift code.</p><span className="tag">Coming soon</span></article>
            <article className="card soon" data-t="flipkart.pay"><Logo m="flipkart" size={56} /><h3>Flipkart</h3><p>Gift code.</p><span className="tag">Coming soon</span></article>
          </div>
          <p className="after">Minimum payout {R(minInr)}. Every request is reviewed and paid by hand.</p>
        </div>
      </section>

      <section className="wrap invite">
        <div className="card" data-t="invite.link">
          <h2 className="sech">Bring a friend. Earn {R(refInr)}.</h2>
          <p>Share your link. When your friend reaches {C.referralSteps.toLocaleString()} steps, {R(refInr)} lands in your balance.</p>
          <ol className="flow"><li><b>1</b>Share your link</li><li><b>2</b>Friend signs up and walks</li><li><b>3</b>You earn {R(refInr)}</li></ol>
          <Link className="btn big" to={go}>Get my invite link</Link>
        </div>
      </section>

      <section id="faq" className="dith">
        <div className="wrap narrow">
          <h2 className="sech">Questions</h2>
          {faq.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}
        </div>
      </section>

      <section className="wrap final">
        <h2 className="sech">Your first {R(C.inrPer1000Steps)} is 1,000 steps away.</h2>
        <p>Join free and start earning on your next walk.</p>
        <Link className="btn big" to={go}>{user ? 'Open dashboard' : 'Create my account'}</Link>
      </section>

      <footer className="foot"><div className="wrap foot-in">
        <Link className="logo" to="/"><span className="logo-i"><Mark size={26} /></span>tasknest</Link>
        <nav aria-label="Footer"><a href="#how">How it works</a><a href="#faq">FAQ</a>{user ? <Link to="/dashboard">Dashboard</Link> : <><Link to="/login">Log in</Link><Link to="/signup">Sign up</Link></>}</nav>
        <p>© {new Date().getFullYear()} TaskNest</p>
      </div></footer>
    </div>
  );
}