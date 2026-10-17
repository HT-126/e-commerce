import { Router } from "express";
import bcrypt from "bcrypt";
import { pool as db } from "../config/db.js";
import { validate } from "../middleware/validate.js";
import { requireAuth } from "../middleware/auth.js";
import { loginSchema, registerSchema } from "../schemas/auth.js";
import { signToken, authCookieOptions } from "../utils/token.js";
import { loginLimiter, registerLimiter } from "../middleware/rateLimit.js";

// A real bcrypt hash of a password nobody knows, made once at startup
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 12);
const router = Router();

router.post(
  "/register",
  registerLimiter,
  validate(registerSchema),
  async (req, res, next) => {
    try {
      const { email, password } = req.validated.body;

      // 12 = cost: each +1 doubles the work. About 0.25 s per hash, which is
      // nothing for one user but very slow for an attacker who tries millions.
      const passwordHash = await bcrypt.hash(password, 12);

      // "role" is not in this query on purpose: MySQL uses DEFAULT 'customer'
      const [result] = await db.query(
        "INSERT INTO users (email, password_hash) VALUES (?, ?)",
        [email, passwordHash],
      );

      res.status(201).json({ id: result.insertId, email });
    } catch (err) {
      // The UNIQUE on users.email rejected a second account with the same email
      if (err.code === "ER_DUP_ENTRY") {
        return res.status(409).json({ error: "Email is already registered" });
      }
      next(err);
    }
  },
);

router.post(
  "/login",
  loginLimiter,
  validate(loginSchema),
  async (req, res, next) => {
    try {
      const { email, password } = req.validated.body;

      const [rows] = await db.query(
        "SELECT id, email, role, password_hash FROM users WHERE email = ?",
        [email],
      );
      const user = rows[0];

      // Always run bcrypt, even when the email does not exist. Otherwise an unknown
      // email answers in 2 ms and a known one in 250 ms, and an attacker can
      // find out which emails have accounts just by measuring the time.
      const ok = await bcrypt.compare(
        password,
        user ? user.password_hash : DUMMY_HASH,
      );

      if (!user || !ok) {
        // Same message for both cases
        return res.status(401).json({ error: "Invalid email or password" });
      }

      const token = await signToken(user);
      res.cookie("token", token, authCookieOptions);
      res.json({ id: user.id, email: user.email, role: user.role });
    } catch (err) {
      next(err);
    }
  },
);

router.get("/me", requireAuth, (req, res) => {
  res.json(req.user);
});

router.post("/logout", (req, res) => {
  // clearCookie needs the same path/httpOnly/sameSite/secure as the cookie.
  // We remove maxAge: in Express 4, a maxAge here keeps the cookie alive.
  const { maxAge, ...clearOptions } = authCookieOptions;
  res.clearCookie("token", clearOptions);
  res.json({ ok: true });
});
export default router;
