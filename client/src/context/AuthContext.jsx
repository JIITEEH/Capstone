import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setUnauthorizedHandler, tokenStore } from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(() => Boolean(tokenStore.get()));

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
  }, []);

  // Restore the session from a saved token
  useEffect(() => {
    setUnauthorizedHandler(logout);
    if (!tokenStore.get()) return;
    api
      .me()
      .then(({ user }) => setUser(user))
      .catch((err) => {
        // Only a rejected token ends the session; a network hiccup keeps it for the next load
        if (err.status === 401) logout();
      })
      .finally(() => setLoading(false));
  }, [logout]);

  const startSession = useCallback(({ token, user }, remember = true) => {
    tokenStore.set(token, { remember });
    setUser(user);
    return user;
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      login: async (email, password, remember = false) =>
        startSession(await api.login(email, password, remember), remember),
      register: async (data) => startSession(await api.register(data)),
      logout,
      setUser,
    }),
    [user, loading, logout, startSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
