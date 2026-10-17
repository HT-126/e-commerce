import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext"; // match RequireAuth's import

export default function RequireAdmin() {
  const { user, loading } = useAuth();

  // 1. Still asking the server "who am I?" -> do not redirect yet
  if (loading) return <p className="p-6">Loading...</p>;
  // 2. Not logged in -> login page
  if (!user) return <Navigate to="/login" replace />;
  // 3. Logged in but a customer -> home (the server would say 403 anyway)
  if (user.role !== "admin") return <Navigate to="/" replace />;

  return <Outlet />; // show the admin pages
}