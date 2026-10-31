import { useEffect, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api, inr } from '../api.js';

const css = `
.stage{text-align:center}
.ring{width:min(240px,66vw);aspect-ratio:1;margin:4px auto 18px;border-radius:50%;background:conic-gradient(#000 var(--p,0%),#e9e9e9 0);border:3px solid #000;display:grid;place-items:center;transition:background .4s}
.ring div{width:82%;aspect-ratio:1;border-radius:50%;background:#fff;border:3px solid #000;display:grid;place-content:center}
.ring .n{font-size:3.1rem;font-weight:800;letter-spacing:-2px;line-height:1}
.ring .l{font-size:.85rem;font-weight:700;color:#4a4a4a}
.pulse .ring{animation:pulse 1.2s ease-in-out infinite}
@keyframes pulse{50%{transform:scale(1.025)}}
.stats{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:18px 0 10px}
.stats div{background:#e9e9e9;border:3px solid #000;padding:10px}
.stats b{display:block;font-size:1.4rem;font-weight:800}
.wave{background:#fff;border:3px solid #000;padding:10px 12px;margin:0 0 16px;text-align:left}
.wave canvas{width:100%;height:110px;display:block}
.wave .cap{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;font-size:.76rem;font-weight:700;margin-top:6px}
.dot{display:inline-block;width:10px;height:10px;border:2px solid #000;margin-right:5px;vertical-align:middle}
.how{display:grid;gap:14px;list-style:none;counter-reset:h}
.how li{display:grid;grid-template-columns:auto 1fr;gap:12px;align-items:start}
.how li::before{counter-increment:h;content:counter(h);width:30px;height:30px;background:#000;color:#fff;display:grid;place-items:center;font-weight:800}
.how b{display:block}
.how span{color:#4a4a4a;font-size:.9rem;font-weight:600}`;

const cv = a => { const m = a.reduce((x, y) => x + y, 0) / a.length; return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length) / m; };

export default function Walk() {
  const { me } = useOutletContext();
  const cfg = me.config;
  const canvas = useRef(null);
  // Live counters live in a ref so 60 sensor readings a second never slow the page down
  const r = useRef({ serverToday: me.today, pending: 0, session: 0, credited: 0, running: false, got: false, linear: false, syncing: false,
    base: 0, sm: 0, prev: 0, last: -1e9, streak: 0, counted: 0, iv: [], thr: 1.2, timer: null, wake: null, raf: 0, buf: [], marks: [] });
  const [v, setV] = useState({ session: 0, total: me.today, credited: 0 });
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState('Tap start, then put your phone in your hand or pocket.');
  const [sens, setSens] = useState('1.2');
  const [sensor, setSensor] = useState('');

  const draw = () => { const s = r.current; setV({ session: s.session, total: Math.min(cfg.dailyStepCap, s.serverToday + s.pending), credited: s.credited }); };
  function add(n) {
    const s = r.current;
    if (n <= 0 || s.serverToday + s.pending >= cfg.dailyStepCap) return;
    s.session += n; s.pending += n; draw();
  }

  // ---- THE STEP COUNTER ----
  const onMotion = useRef(e => {
    const s = r.current;
    let raw;
    const l = e.acceleration;
    if (l && l.x != null) {                                    // best: the phone already removed gravity for us
      s.linear = true; raw = Math.hypot(l.x, l.y, l.z);
    } else {                                                   // fallback: remove gravity ourselves with a slow average
      const g = e.accelerationIncludingGravity;
      if (!g || g.x == null) return;
      const m = Math.hypot(g.x, g.y, g.z);
      s.base = s.base ? s.base * 0.98 + m * 0.02 : m;
      raw = Math.abs(m - s.base);
    }
    s.got = true;
    s.sm = s.sm * 0.65 + raw * 0.35;                           // smooth out tiny jitter
    const now = performance.now();
    s.buf.push({ t: now, v: s.sm });
    while (s.buf.length && now - s.buf[0].t > 4200) s.buf.shift();

    if (s.sm > s.thr && s.prev <= s.thr && now - s.last > 300) {   // a new bounce (max ~3 per second)
      const dt = now - s.last;
      if (dt > 1500) { s.iv = []; s.streak = 1; s.counted = 0; }   // long pause: start a fresh walk
      else { s.iv.push(dt); if (s.iv.length > 4) s.iv.shift(); s.streak++; }
      s.last = now;
      const steady = s.iv.length >= 3 && cv(s.iv) < 0.4;           // is the rhythm steady like walking?
      if (steady) { add(s.streak - s.counted); s.counted = s.streak; s.marks.push({ t: now, v: s.sm }); }
    }
    s.prev = s.sm;
  }).current;

  function paint() {
    const c = canvas.current, s = r.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1, w = c.clientWidth, h = c.clientHeight;
    if (c.width !== Math.round(w * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    const g = c.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    const now = performance.now(), span = 4000, YMAX = 6;
    const y = q => h - 4 - Math.min(Math.max(q, 0), YMAX) / YMAX * (h - 8);
    const x = t => w - (now - t) / span * w;
    s.marks = s.marks.filter(m => now - m.t < span);
    g.setLineDash([5, 5]); g.strokeStyle = '#777'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(0, y(s.thr)); g.lineTo(w, y(s.thr)); g.stroke(); g.setLineDash([]);
    g.strokeStyle = '#000'; g.lineWidth = 2; g.beginPath();
    s.buf.forEach((p, i) => { i ? g.lineTo(x(p.t), y(p.v)) : g.moveTo(x(p.t), y(p.v)); }); g.stroke();
    g.fillStyle = '#000'; g.strokeStyle = '#fff'; g.lineWidth = 2;
    s.marks.forEach(m => { g.beginPath(); g.arc(x(m.t), y(m.v), 5, 0, 7); g.fill(); g.stroke(); });
  }
  const loop = () => { paint(); r.current.raf = requestAnimationFrame(loop); };

  async function sync() {
    const s = r.current;
    if (!s.pending || s.syncing) return;
    s.syncing = true;
    const send = s.pending;
    try {
      const d = await api('/steps/sync', { body: { today: s.serverToday + send } });
      s.pending -= send; s.credited += d.credited; s.serverToday = d.today;
      if (d.credited < send) setStatus('Some steps were not counted because they came too fast.');
      else if (s.running) setStatus('Walking… steps saved ✔');
    } catch { setStatus('Could not save steps. Will try again.'); }
    s.syncing = false; draw();
  }
  async function keepAwake() { try { if ('wakeLock' in navigator) r.current.wake = await navigator.wakeLock.request('screen'); } catch {} }

  async function start() {
    const s = r.current;
    if (!window.isSecureContext) return setStatus('Motion sensors need HTTPS. Open the secure version of this site.');
    if (!('DeviceMotionEvent' in window)) return setStatus('No motion sensor found. Open this page on your phone.');
    if (typeof DeviceMotionEvent.requestPermission === 'function') {          // iPhone asks permission
      try { if (await DeviceMotionEvent.requestPermission() !== 'granted') return setStatus('Motion access was denied. Allow it in Safari settings and try again.'); }
      catch { return setStatus('Could not get motion access. Tap start again.'); }
    }
    Object.assign(s, { thr: parseFloat(sens), base: 0, sm: 0, prev: 0, streak: 0, counted: 0, iv: [], last: -1e9, got: false, running: true, buf: [], marks: [] });
    window.addEventListener('devicemotion', onMotion);
    s.timer = setInterval(sync, 20000);
    cancelAnimationFrame(s.raf); loop();
    setRunning(true); setSensor(''); setStatus('Walking… keep the screen on.');
    keepAwake();
    setTimeout(() => {
      if (!s.running) return;
      if (!s.got) { stop(); setStatus('No sensor data received. Use a phone with HTTPS.'); }
      else setSensor(s.linear ? 'Motion sensor: ready' : 'Motion sensor: ready (basic mode)');
    }, 2500);
  }

  async function stop() {
    const s = r.current;
    s.running = false;
    window.removeEventListener('devicemotion', onMotion);
    clearInterval(s.timer); cancelAnimationFrame(s.raf);
    setRunning(false);
    if (s.wake) { try { await s.wake.release(); } catch {} s.wake = null; }
    await sync();
    if (s.got) setStatus('Stopped. Your steps are saved.');
  }

  useEffect(() => {
    const vis = () => { if (document.hidden) sync(); else if (r.current.running) { keepAwake(); setStatus('Welcome back. Keep this page open while you walk.'); } };
    document.addEventListener('visibilitychange', vis);
    return () => { document.removeEventListener('visibilitychange', vis); if (r.current.running) stop(); };
  }, []);

  const full = v.total >= cfg.dailyStepCap;
  return (
    <main className="container" style={{ maxWidth: 680 }}>
      <style>{css}</style>
      <h1>Walk &amp; earn</h1>
      <p className="lead">Keep this page open with the screen on while you walk. Your phone counts the steps.</p>

      <section className={'card stage' + (running ? ' pulse' : '')} data-t="walk.exe">
        <div className="ring" style={{ '--p': Math.min(100, v.total / cfg.dailyStepCap * 100) + '%' }}>
          <div><span className="n">{v.session.toLocaleString()}</span><span className="l">steps this session</span></div>
        </div>
        <p role="status" aria-live="polite" style={{ minHeight: '1.6em', fontWeight: 800, marginBottom: 14 }}>{status}</p>
        <div className="wave">
          <canvas ref={canvas} aria-label="Live graph of your phone movement. Red dots are counted steps." role="img" />
          <div className="cap">
            <span><i className="dot" style={{ background: '#000' }} />Your movement</span>
            <span><i className="dot" style={{ background: '#777' }} />Step line (dashed)</span>
            <span><i className="dot" style={{ background: '#fff' }} />Counted step</span>
          </div>
          {sensor && <div className="cap"><span>{sensor}</span></div>}
        </div>
        <label htmlFor="sens" className="sm">Sensitivity</label>
        <select className="in" id="sens" style={{ maxWidth: 240, margin: '0 auto 14px', display: 'block' }} value={sens} disabled={running} onChange={e => setSens(e.target.value)}>
          <option value="1.2">Normal</option><option value="0.8">High (counts light steps)</option><option value="1.8">Low (ignores small bumps)</option>
        </select>
        <button className="btn" style={{ minWidth: 200, fontSize: '1.1rem' }} onClick={() => running ? stop() : start()}>{running ? '■ Stop' : '▶ Start walking'}</button>
        <div className="stats">
          <div><b>{v.total.toLocaleString()}</b><span className="sm">counted today</span></div>
          <div><b>{inr(v.credited * cfg.microPerStep)}</b><span className="sm">earned this session</span></div>
        </div>
        <p className="sm">{full ? 'Daily limit reached. Come back tomorrow!' : 'Daily limit: ' + cfg.dailyStepCap.toLocaleString() + ' steps'}</p>
      </section>

      <section className="card" style={{ marginTop: 34 }} data-t="how-it-works.txt">
        <h2>How your steps are counted</h2>
        <ol className="how">
          <li><div><b>Your phone feels every bounce</b><span>The browser reads the motion sensor about 60 times a second. Each footstep makes a small bump.</span></div></li>
          <li><div><b>We smooth it and find the bumps</b><span>Tiny jitters are filtered out. A bump counts only when it rises above the dashed line.</span></div></li>
          <li><div><b>We check it looks like walking</b><span>Steps must come in a steady rhythm, about 2 to 3 per second. Random shakes and single jolts are ignored.</span></div></li>
          <li><div><b>The server double-checks</b><span>Steps are saved every 20 seconds. The server only accepts what is possible in the time that passed, up to the daily limit.</span></div></li>
        </ol>
        <p className="sm" style={{ marginTop: 14 }}>Works while this page is open with the screen on, on a phone over HTTPS.</p>
      </section>
    </main>
  );
}