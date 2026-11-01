import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import useStyle from '../useStyle.js';
import retro from '../retro.css?inline';
import css from '../auth.css?inline';
import { Mark } from './Logos.jsx';
import Computer from './Art.jsx';
import useSession from '../useSession.js';
import { api } from '../api.js';

export default function Auth({ mode }) {
  useStyle(retro); useStyle(css);
  const nav = useNavigate();
  const [q] = useSearchParams();
  const signup = mode === 'signup';
  const [f, setF] = useState({ name: '', email: '', password: '', terms: false });
  const [err, setErr] = useState({});
  const [status, setStatus] = useState(q.get('banned') ? 'Your account has been suspended.' : '');
  const { user } = useSession();
  useEffect(() => { if (user) nav('/dashboard', { replace: true }); }, [user]);
  const [forgot, setForgot] = useState(false);
  const [fmail, setFmail] = useState('');
  const [fdone, setFdone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  const set = k => e => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const go = p => nav(p + (q.get('ref') ? '?ref=' + q.get('ref') : ''));

  async function submit(e) {
    e.preventDefault();
    const er = {};
    if (signup && !f.name.trim()) er.name = 'Enter your name.';
    if (!/^\S+@\S+\.\S+$/.test(f.email)) er.email = 'Enter a valid email, like you@example.com.';
    if (f.password.length < 8) er.password = 'Use at least 8 characters.';
    if (signup && !f.terms) er.terms = 'Tick the box to continue.';
    setErr(er);
    if (Object.keys(er).length) return;
    setBusy(true); setStatus('One moment…');
    try {
      await api(signup ? '/auth/signup' : '/auth/login', { body: { name: f.name, email: f.email, password: f.password, ref: q.get('ref') || '' } });
      nav('/dashboard');
    } catch (x) { setStatus(x.message); setBusy(false); }
  }

  return (
    <div className="page">
      <header className="nav"><div className="wrap nav-in">
        <Link className="logo" to="/" aria-label="TaskNest home"><span className="logo-i"><Mark /></span>tasknest</Link>
        <Link className="btn ghost" to="/">Back to home</Link>
      </div></header>
      <main className="wrap authwrap">
        <div className="card" data-t={signup ? 'signup.exe' : 'login.exe'}>
          <div className="tabs" role="tablist" aria-label="Account">
            <button role="tab" aria-selected={!signup} onClick={() => go('/login')}>Log in</button>
            <button role="tab" aria-selected={signup} onClick={() => go('/signup')}>Sign up</button>
          </div>
          <h1>{signup ? 'Join the nest' : 'Welcome back'}</h1>
          <p className="sub">{signup ? 'Create your account and start walking.' : 'Log in to see your steps and rewards.'}</p>
          <form onSubmit={submit} noValidate>
            {signup && <div className="field"><label htmlFor="name">Your name</label>
              <input className="in" id="name" autoComplete="name" placeholder="Aarav Sharma" value={f.name} onChange={set('name')} aria-invalid={!!err.name} />
              <div className="err">{err.name}</div></div>}
            <div className="field"><label htmlFor="email">Email</label>
              <input className="in" id="email" type="email" autoComplete="email" placeholder="you@example.com" value={f.email} onChange={set('email')} aria-invalid={!!err.email} />
              <div className="err">{err.email}</div></div>
            <div className="field"><label htmlFor="pw">Password</label>
              <div className="pw">
                <input className="in" id="pw" type={show ? 'text' : 'password'} autoComplete={signup ? 'new-password' : 'current-password'} placeholder="At least 8 characters" value={f.password} onChange={set('password')} aria-invalid={!!err.password} />
                <button className="show" type="button" onClick={() => setShow(!show)} aria-pressed={show}>{show ? 'Hide' : 'Show'}</button>
              </div>
              <div className="err">{err.password}</div>
              {!signup && <button type="button" className="forgot" onClick={() => { setForgot(true); setFdone(false); }}>Forgot password?</button>}</div>
            {signup && <div className="field"><label className="check"><input type="checkbox" checked={f.terms} onChange={set('terms')} /> I agree to the terms and privacy policy.</label>
              <div className="err">{err.terms}</div></div>}
            <button className="btn big full" type="submit" disabled={busy}>{signup ? 'Create account' : 'Log in'}</button>
          </form>
          <div id="status" className={status ? 'on' : ''} role="status" aria-live="polite">{status}</div>
          <p className="switch">{signup ? 'Already have an account? ' : 'New here? '}
            <button type="button" onClick={() => go(signup ? '/login' : '/signup')}>{signup ? 'Log in' : 'Create an account'}</button></p>
        </div>
        <div className="side" aria-hidden="true"><Computer /></div>
      </main>
      {forgot && (
        <div className="ov" onMouseDown={e => { if (e.target === e.currentTarget) setForgot(false); }}>
          <div className="sheet" data-t="forgot.exe" role="dialog" aria-modal="true" aria-label="Forgot password">
            <h3>Forgot your password?</h3>
            {!fdone ? <>
              <p className="sm" style={{ margin: '6px 0 14px' }}>Enter your email and we will send you a link to choose a new one.</p>
              <label htmlFor="fm">Email</label>
              <input className="in" id="fm" type="email" placeholder="you@example.com" value={fmail} onChange={e => setFmail(e.target.value)} />
              <div className="two"><button className="btn ghost" onClick={() => setForgot(false)}>Cancel</button>
                <button className="btn" disabled={!/^\S+@\S+\.\S+$/.test(fmail)} onClick={() => setFdone(true)}>Send reset link</button></div>
            </> : <>
              <p style={{ margin: '8px 0 16px', fontWeight: 700 }}>Password reset is coming soon. It is not switched on yet.</p>
              <button className="btn full" onClick={() => setForgot(false)}>Close</button>
            </>}
          </div>
        </div>
      )}
    </div>
  );
}