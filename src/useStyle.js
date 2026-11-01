import { useInsertionEffect } from 'react';
// Each group of pages (landing, login, app) has its own stylesheet. It is added BEFORE the browser paints
// (useInsertionEffect), so you never see the page without its design, then removed when the page closes.
export default function useStyle(css) {
  useInsertionEffect(() => {
    const s = document.createElement('style');
    s.textContent = css;
    document.head.appendChild(s);
    return () => s.remove();
  }, [css]);
}