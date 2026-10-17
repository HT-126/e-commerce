import { createContext, useContext, useEffect, useState } from "react";
import * as api from "../api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // null = not logged in
  const [loading, setLoading] = useState(true); // true until the first /me answer

  useEffect(() => {
    api
      .getMe()
      .then(setUser)
      .catch(() => setUser(null)) // 401 just means "not logged in"
      .finally(() => setLoading(false));
  }, []);

  async function login(email, password) {
    const u = await api.login(email, password); // throws on 401 / 400 / 429
    setUser(u);
    return u;
  }

  async function logout() {
    await api.logout();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}