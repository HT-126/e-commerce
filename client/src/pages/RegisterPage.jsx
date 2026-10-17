import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { register } from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";

export default function RegisterPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState(""); // general error (409, 429, ...)
  const [fieldErrors, setFieldErrors] = useState({}); // { email: "...", password: "..." }
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    const form = new FormData(e.currentTarget); // read BEFORE any await
    const email = form.get("email");
    const password = form.get("password");

    setError("");
    setFieldErrors({});
    setSubmitting(true);
    try {
      await register(email, password); // 201 or throws
      await login(email, password); // sets the cookie and the user in context
      navigate("/");
    } catch (err) {
      if (err.status === 400 && Array.isArray(err.details)) {
        // "body.password" -> "password"
        const map = {};
        for (const d of err.details) {
          const name = d.field.split(".").pop();
          if (!map[name]) map[name] = d.message; // keep the first message per field
        }
        setFieldErrors(map);
      } else {
        setError(err.message);
      }
    } finally {
      setSubmitting(false);
    }
  }

return (
  <main className="mx-auto max-w-sm p-4">
    <h1 className="mb-4 text-2xl font-bold">Register</h1>
    <form onSubmit={handleSubmit} className="grid gap-3" noValidate>
      <label className="grid gap-1 text-sm font-medium">
        Email
        <input
          name="email"
          type="email"
          autoComplete="email"
          className="rounded-md border border-gray-300 px-3 py-2 text-base font-normal focus:border-gray-900 focus:outline-none"
        />
        {fieldErrors.email && (
          <span className="text-sm font-normal text-red-700">{fieldErrors.email}</span>
        )}
      </label>
      <label className="grid gap-1 text-sm font-medium">
        Password (8 to 72 characters)
        <input
          name="password"
          type="password"
          maxLength={72}
          autoComplete="new-password"
          className="rounded-md border border-gray-300 px-3 py-2 text-base font-normal focus:border-gray-900 focus:outline-none"
        />
        {fieldErrors.password && (
          <span className="text-sm font-normal text-red-700">{fieldErrors.password}</span>
        )}
      </label>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <button
        disabled={submitting}
        className="rounded-md bg-gray-900 py-2 text-white hover:bg-gray-700 disabled:bg-gray-400"
      >
        {submitting ? "Creating..." : "Create account"}
      </button>
    </form>
    <p className="mt-4 text-sm">
      Have an account? <Link to="/login" className="underline">Log in</Link>
    </p>
  </main>
);
}