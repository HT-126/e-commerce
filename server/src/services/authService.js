import bcrypt from "bcrypt";
import { pool as db } from "../config/db.js";
import { HttpError } from "../utils/httpError.js";

// A real bcrypt hash of a password nobody knows, made once at startup
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 12);

export async function register(email, password) {
  // 12 = cost: each +1 doubles the work. About 0.25 s per hash, which is
  // nothing for one user but very slow for an attacker who tries millions.
  const passwordHash = await bcrypt.hash(password, 12);

  try {
    // "role" is not in this query on purpose: MySQL uses DEFAULT 'customer'
    const [result] = await db.query(
      "INSERT INTO users (email, password_hash) VALUES (?, ?)",
      [email, passwordHash],
    );
    return { id: result.insertId, email };
  } catch (err) {
    // The UNIQUE on users.email rejected a second account with the same email
    if (err.code === "ER_DUP_ENTRY") {
      throw new HttpError(409, "Email is already registered");
    }
    throw err;
  }
}

// Returns { id, email, role } or throws 401
export async function authenticate(email, password) {
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
    throw new HttpError(401, "Invalid email or password");
  }
  return { id: user.id, email: user.email, role: user.role };
}
