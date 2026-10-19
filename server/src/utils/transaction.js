import { pool } from "../config/db.js";

// Runs fn(conn) in one transaction. Commits when fn returns, rolls back when it throws
// (an HttpError thrown inside also undoes everything), and always gives the connection back.
export async function withTransaction(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback().catch(() => {}); // ignore a rollback error
    throw err;
  } finally {
    conn.release();
  }
}
