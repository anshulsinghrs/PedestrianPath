import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import * as apiSvc from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On mount, if a token is in localStorage try to fetch the user
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }
    apiSvc
      .me()
      .then(setUser)
      .catch(() => localStorage.removeItem('token'))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await apiSvc.login({ email, password });
    localStorage.setItem('token', res.token);
    setUser(res.user);
    return res.user;
  }, []);

  // Registration no longer returns a JWT — the server first requires
  // the user to click a verification link sent to their email. The
  // response carries { message, emailSent, email } and the modal
  // routes the user to a "check your inbox" screen.
  const register = useCallback(async (data) => {
    return await apiSvc.register(data);
  }, []);

  const verifyEmail = useCallback(async (token) => {
    const res = await apiSvc.verifyEmail(token);
    localStorage.setItem('token', res.token);
    setUser(res.user);
    return res.user;
  }, []);

  const resendVerification = useCallback(
    (email) => apiSvc.resendVerification(email),
    []
  );

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, verifyEmail, resendVerification, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
