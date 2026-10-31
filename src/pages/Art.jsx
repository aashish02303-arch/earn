import C from '../../server/config.js';
// Retro computer drawing. The text on the screen comes from your real rate.
export default function Computer() {
  return (
    <svg viewBox="0 0 440 360" role="img" aria-label="A retro computer showing a step counter" style={{ width: '100%', height: 'auto', display: 'block' }}>
      <g fill="#fff" stroke="#000" strokeWidth="4"><circle cx="62" cy="64" r="8" /><circle cx="100" cy="34" r="6" /><circle cx="36" cy="112" r="5" /></g>
      <path d="M40 332h360" stroke="#000" strokeWidth="4" />
      <rect x="96" y="288" width="250" height="34" fill="#c6c6c6" stroke="#000" strokeWidth="4" />
      <rect x="150" y="322" width="140" height="10" fill="#000" />
      <rect x="120" y="50" width="210" height="238" rx="30" fill="#000" />
      <rect x="136" y="66" width="178" height="206" rx="20" fill="#c6c6c6" />
      <rect x="150" y="80" width="150" height="178" rx="14" fill="#000" />
      <circle cx="225" cy="150" r="46" fill="none" stroke="#fff" strokeWidth="12" strokeDasharray="215 80" transform="rotate(-90 225 150)" />
      <text x="225" y="159" textAnchor="middle" fill="#fff" fontSize="26" fontWeight="800" fontFamily="'Baloo 2',sans-serif">1,000</text>
      <text x="225" y="226" textAnchor="middle" fill="#fff" fontSize="17" fontWeight="700" fontFamily="'Baloo 2',sans-serif">steps = ₹{C.inrPer1000Steps}</text>
      <path d="M330 140q70 6 44 96q-10 44-70 50" fill="none" stroke="#000" strokeWidth="4" />
      <g fill="#fff" stroke="#000" strokeWidth="4"><rect x="372" y="296" width="22" height="30" rx="10" /><rect x="402" y="300" width="18" height="26" rx="9" /></g>
    </svg>
  );
}