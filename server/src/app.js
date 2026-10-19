import express from "express";
import cors from "cors";
import helmet from "helmet";
import { pool } from "./config/db.js";
import productsRouter from "./routes/products.js";
import authRouter from "./routes/auth.js";
import { errorHandler } from "./middleware/errorHandler.js";
import cookieParser from "cookie-parser";
import cartRouter from "./routes/cart.js";
import categoriesRouter from "./routes/categories.js";
import checkoutRouter from "./routes/checkout.js";
import ordersRouter from "./routes/orders.js";
import reviewsRouter from "./routes/reviews.js";
import { requireAuth, requireAdmin } from "./middleware/auth.js";
import adminRouter from "./routes/admin.js";

const app = express();

// Behind a reverse proxy, set TRUST_PROXY to the number of proxies (e.g. 1).
// Off by default: trusting X-Forwarded-For with no proxy lets anyone fake their IP
// and get around the rate limiters.
if (process.env.TRUST_PROXY) {
  const n = Number(process.env.TRUST_PROXY);
  app.set("trust proxy", Number.isNaN(n) ? process.env.TRUST_PROXY : n);
}

app.use(helmet()); // security headers
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
    // Needed for the login cookie in Feature 4 (browsers refuse "*" with this)
    credentials: true,
  }),
);
app.use(express.json({ limit: "10kb" })); // a small limit stops huge bodies
app.use(cookieParser());

// Health check: proves the server AND the database work
app.get("/api/health", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT 1 AS ok");
    res.json({ status: "ok", db: rows[0].ok });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ status: "error", message: "Database not reachable" });
  }
});

app.use("/api/products", productsRouter);
app.use("/api/products", reviewsRouter);

app.use("/api/auth", authRouter);

app.use("/api/cart", cartRouter);
app.use("/api/categories", categoriesRouter);
app.use("/api/checkout", checkoutRouter);
app.use("/api/orders", ordersRouter);
// Order matters: requireAuth first, then requireAdmin, then the admin routes
app.use("/api/admin", requireAuth, requireAdmin, adminRouter);

// Unknown API path -> JSON instead of the default HTML page
app.use("/api", (req, res) => res.status(404).json({ error: "Not found" }));
app.use(errorHandler); // must be LAST
export default app;
