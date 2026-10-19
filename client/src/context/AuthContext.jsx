import { useEffect, useState } from "react";
import * as api from "../api.js";
import { AuthContext } from "./useAuth.js";

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

  // A request got 401: the session is over, even if the page did not notice
  useEffect(() => {
    const onExpired = () => setUser(null);
    window.addEventListener("auth:expired", onExpired);
    return () => window.removeEventListener("auth:expired", onExpired);
  }, []);

  async function logout() {
    try {
      await api.logout();
    } catch {
      // The server could not be reached. The user still wanted out, and the
      // cookie ends by itself after 1 hour, so clear the screen state anyway.
    }
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
