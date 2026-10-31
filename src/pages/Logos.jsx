import { useState } from 'react';
// Simple brand-style badges drawn as SVG. For production, swap these for the official logo files
// (PayPal, UPI, Tether, Amazon, Flipkart brand kits) and keep the same <Logo m="upi" /> usage.
function Fallback({ m, size = 44 }) {
  const st = { width: size, height: size, flex: 'none', display: 'block' };
  const F = 'Arial, Helvetica, sans-serif';
  const box = <rect width="48" height="48" rx="12" fill="#fff" stroke="#e5e5dc" />;
  switch (m) {
    case 'upi': return (
      <svg viewBox="0 0 48 48" style={st} role="img" aria-label="UPI">{box}
        <text x="24" y="26" fontSize="15" fontWeight="900" fontStyle="italic" textAnchor="middle" fill="#2b2f6b" fontFamily={F}>UPI</text>
        <path d="M13 36l8-5-2 7z" fill="#F37021" /><path d="M22 36l8-5-2 7z" fill="#097939" />
      </svg>);
    case 'paypal': return (
      <svg viewBox="0 0 48 48" style={st} role="img" aria-label="PayPal">{box}
        <text x="17" y="35" fontSize="28" fontWeight="900" fontStyle="italic" fill="#009cde" fontFamily={F}>P</text>
        <text x="21" y="32" fontSize="28" fontWeight="900" fontStyle="italic" fill="#003087" fontFamily={F}>P</text>
      </svg>);
    case 'crypto': return (
      <svg viewBox="0 0 48 48" style={st} role="img" aria-label="Crypto (USDT)">
        <circle cx="24" cy="24" r="24" fill="#26A17B" />
        <text x="24" y="33" fontSize="26" fontWeight="900" textAnchor="middle" fill="#fff" fontFamily={F}>₮</text>
      </svg>);
    case 'usdt': return (
      <svg viewBox="0 0 48 48" style={st} role="img" aria-label="USDT"><circle cx="24" cy="24" r="24" fill="#26A17B" />
        <text x="24" y="33" fontSize="26" fontWeight="900" textAnchor="middle" fill="#fff" fontFamily={F}>₮</text></svg>);
    case 'usdc': return (
      <svg viewBox="0 0 48 48" style={st} role="img" aria-label="USDC"><circle cx="24" cy="24" r="24" fill="#2775CA" />
        <circle cx="24" cy="24" r="14" fill="none" stroke="#fff" strokeWidth="2.5" />
        <text x="24" y="31" fontSize="19" fontWeight="900" textAnchor="middle" fill="#fff" fontFamily={F}>$</text></svg>);
    case 'sol': return (
      <svg viewBox="0 0 48 48" style={st} role="img" aria-label="Solana (SOL)">
        <defs><linearGradient id="solg" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="#9945FF" /><stop offset="1" stopColor="#14F195" /></linearGradient></defs>
        <circle cx="24" cy="24" r="24" fill="#16161d" />
        <path d="M15 17h20l-3.5 4H11.5z M11.5 26.5H31.5L35 30.5H15z M15 33.5h20l-3.5 4H11.5z" transform="translate(0 -5)" fill="url(#solg)" /></svg>);
    case 'amazon': return (
      <svg viewBox="0 0 48 48" style={st} role="img" aria-label="Amazon">{box}
        <text x="24" y="28" fontSize="26" fontWeight="900" textAnchor="middle" fill="#111" fontFamily={F}>a</text>
        <path d="M12 33q12 7 24 0" stroke="#FF9900" strokeWidth="3" fill="none" strokeLinecap="round" />
      </svg>);
    case 'flipkart': return (
      <svg viewBox="0 0 48 48" style={st} role="img" aria-label="Flipkart">
        <rect width="48" height="48" rx="12" fill="#2874F0" />
        <text x="24" y="34" fontSize="27" fontWeight="900" textAnchor="middle" fill="#FFE500" fontFamily={F}>f</text>
      </svg>);
    default: return null;
  }
}

// Uses your own logo file from /public/logos/ (upi.svg, paypal.png ...). If the file is missing, the drawn logo above is shown.
const EXT = ['svg', 'png', 'webp'];
function LogoImg({ m, size }) {
  const [i, setI] = useState(0);
  if (i >= EXT.length) return <span className="lg"><Fallback m={m} size={size} /></span>;
  return <img className="lg" src={`/logos/${m}.${EXT[i]}`} alt={m.toUpperCase()} width={size} height={size}
    style={{ width: size, height: size, objectFit: 'contain', flex: 'none', display: 'block' }} onError={() => setI(i + 1)} />;
}
export default function Logo({ m, size = 44 }) { return <LogoImg key={m} m={m} size={size} />; }

export function Mark({ size = 32 }) {
  return (<svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true"><rect x="2" y="2" width="28" height="28" rx="6" fill="#000" />
    <rect x="7" y="7" width="18" height="18" rx="4" fill="#fff" /><circle cx="16" cy="16" r="5" fill="#000" /><circle cx="18" cy="14" r="1.6" fill="#fff" /></svg>);
}