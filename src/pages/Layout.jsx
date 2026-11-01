import { useCallback, useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import useStyle from '../useStyle.js';
import retro from '../retro.css?inline';
import css from '../app.css?inline';
import { Mark } from './Logos.jsx';
import { api } from '../api.js';

export default function Layout() {
  useStyle(retro); useStyle(css);
  const nav = useNavigate();
  const [me, setMe] = useState(null);
  const [toast, setToast] = useState('');
  const timer = useRef();
  const notify = m => { setToast(m); clearTimeout(timer.current); timer.current = setTimeout(() => setToast(''), 3800); };
  const reload = useCallback(async () => {
    try { setMe(await api('/me')); }
    catch (e) {
      if (e.status === 401) nav('/login');
      else if (e.status === 403) { await api('/auth/logout', { method: 'POST' }).catch(() => {}); nav('/login?banned=1'); }
      else notify(e.message);
    }
  }, []);
  useEffect(() => { reload(); }, []);
  const logout = async () => { await api('/auth/logout', { method: 'POST' }); nav('/'); };

  const L = [['/dashboard', '', 'Home'], ['/walk', '', 'Walk'], ['/payout', '', 'Payout']];
  if (me?.user.isAdmin) L.push(['/admin', '', 'Admin']);

  return (<>
    <div className="page">
    <nav className="top"><div className="container bar">
      <a className="logo" href="/"><i><Mark /></i><span>tasknest</span></a>
      <div className="links">
        {L.map(l => <NavLink key={l[0]} to={l[0]}>{l[2]}</NavLink>)}
        <button className="btn" onClick={logout}>Log out</button>
      </div>
    </div></nav>
    <div className="page-body">{me ? <Outlet context={{ me, reload, notify }} /> : <main className="container"><p className="lead" style={{ marginTop: 40 }}>Loading…</p></main>}</div>
    </div>
    <div className="tabbar">{L.map(l => <NavLink key={l[0]} to={l[0]}>{l[2]}</NavLink>)}</div>
    <div id="msg" className={toast ? 'on' : ''} role="status" aria-live="polite">{toast}</div>
  </>);
}