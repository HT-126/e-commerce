import { createContext, useContext } from "react";

// Kept apart from AuthProvider so that AuthContext.jsx exports only a component
// (needed for Vite's fast refresh).
export const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}
