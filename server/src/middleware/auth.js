import { pool as db } from "../config/db.js";
import { verifyToken } from "../utils/token.js";

export async function requireAuth(req, res, next) {
  try {
    const token = req.cookies.token; // filled by cookie-parser
    if (!token) return res.status(401).json({ error: "Not logged in" });

    let payload;
    try {
      payload = await verifyToken(token);
    } catch {
      // wrong signature, expired, broken text... the user does not need to know which
      return res.status(401).json({ error: "Not logged in" });
    }

    // Read the user from the database every time, so a deleted user
    // or a changed role counts at once, not after 1 hour.
    const [rows] = await db.query(
      "SELECT id, email, role FROM users WHERE id = ?",
      [payload.sub],
    );
    if (rows.length === 0)
      return res.status(401).json({ error: "Not logged in" });

    req.user = rows[0];
    next();
  } catch (err) {
    next(err); // a real problem (like the database being down) is a 500
  }
}

// Must run AFTER requireAuth (it sets req.user, with the role from the database)
export function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Admin only" });
  }
  next();
}
