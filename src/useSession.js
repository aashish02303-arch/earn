import { useEffect, useState } from 'react';
import { api } from './api.js';
// { loading, user }: user is set when the browser still has a valid login (the cookie lasts 30 days).
export default function useSession() {
  const [s, setS] = useState({ loading: true, user: null });
  useEffect(() => {
    api('/me').then(d => setS({ loading: false, user: d.user })).catch(() => setS({ loading: false, user: null }));
  }, []);
  return s;
}