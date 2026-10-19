import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/useAuth.js";
import PasswordInput from "../components/PasswordInput.jsx";


export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const location = useLocation();

  async function handleSubmit(e) {
    e.preventDefault();
    // Read the form BEFORE any await (the event is gone after that)
    const form = new FormData(e.currentTarget);
    setError("");
    setSubmitting(true);
    try {
      await login(form.get("email"), form.get("password"));
      navigate(location.state?.from || "/", { replace: true });
    } catch (err) {
      setError(err.message); // "Invalid email or password", "Too many attempts..."
    } finally {
      setSubmitting(false);
    }
  }

return (
  <main className="mx-auto max-w-sm p-4">
    <h1 className="mb-4 text-2xl font-bold">Log in</h1>
    <form onSubmit={handleSubmit} className="grid gap-3">
      <label className="grid gap-1 text-sm font-medium">
        Email
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="rounded-md border border-gray-300 px-3 py-2 text-base font-normal focus:border-accent focus:outline-none"
        />
      </label>
      <label className="grid gap-1 text-sm font-medium">
        Password
        <PasswordInput
          name="password"
          required
          maxLength={72}
          autoComplete="current-password"
        />
      </label>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <button
        disabled={submitting}
        className="rounded-md bg-accent py-2 text-white hover:bg-accent-hover disabled:bg-gray-400"
      >
        {submitting ? "Logging in..." : "Log in"}
      </button>
    </form>
    <p className="mt-4 text-sm">
      No account? <Link to="/register" className="underline">Register</Link>
    </p>
  </main>
);
}