import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  // Wait for /me. Without this, a logged-in user is sent to /login on every refresh.
  if (loading) return <p className="container">Loading...</p>;

  if (!user) {
    // "replace" so the Back button does not return to the guarded page
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return children;
}