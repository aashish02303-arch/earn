import { useEffect } from 'react';
// Each group of pages (landing, login, app) has its own stylesheet. It is added when the page opens and removed when it closes,
// so the designs never clash and each page looks exactly like the original.
export default function useStyle(css) {
  useEffect(() => {
    const s = document.createElement('style');
    s.textContent = css;
    document.head.appendChild(s);
    return () => s.remove();
  }, [css]);
}
