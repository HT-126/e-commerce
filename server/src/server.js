import "dotenv/config";
import app from "./app.js";
import { pool } from "./config/db.js";

const port = process.env.PORT || 3000;

// Fail at startup, with a clear message, if the database is not reachable
try {
  await pool.query("SELECT 1");
} catch (err) {
  console.error("Cannot connect to the database:", err.message);
  process.exit(1);
}

const server = app.listen(port, () =>
  console.log(`Server running on http://localhost:${port}`),
);

// "docker stop" sends SIGTERM: finish the running requests, close the pool, then exit
function shutdown(signal) {
  console.log(`${signal} received, shutting down`);
  server.close(async () => {
    await pool.end().catch(() => {});
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref(); // do not wait forever
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
