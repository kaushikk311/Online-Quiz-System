import { createContext, useContext, useState, useCallback } from 'react';
import * as auth from '../services/auth.js';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => auth.currentUser());
  const signIn = useCallback((username, password) => {
    const r = auth.login(username, password);
    if (r.ok) setUser(r.data);
    return r;
  }, []);
  const signOut = useCallback(() => { auth.logout(); setUser(null); }, []);
  const refresh = useCallback(() => setUser(auth.currentUser()), []);
  return <Ctx.Provider value={{ user, signIn, signOut, refresh }}>{children}</Ctx.Provider>;
}
