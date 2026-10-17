import { Router } from "express";
import { pool as db } from "../config/db.js"; // same import as in cart.js
import { validate } from "../middleware/validate.js";
import {
  adminOrdersSchema,
  adminStatsSchema,
  adminVariantsSchema,
  updateVariantSchema,
  adminReviewsSchema,
  deleteReviewSchema,
} from "../schemas/admin.js";

// requireAuth and requireAdmin are added in app.js, once for ALL admin routes
const router = Router();
const rowsOf = async (sql, params) => (await db.query(sql, params))[0];

// Income and sales numbers
router.get("/stats", validate(adminStatsSchema), async (req, res, next) => {
  try {
    const { days } = req.validated.query;

    // Five independent read-only queries: run them at the same time
    const [all, items, period, daily, top] = await Promise.all([
      rowsOf(
        "SELECT COUNT(*) AS orders, COALESCE(SUM(total), 0) AS revenue FROM orders",
      ),
      rowsOf("SELECT COALESCE(SUM(quantity), 0) AS items FROM order_items"),
      rowsOf(
        `SELECT COUNT(*) AS orders, COALESCE(SUM(total), 0) AS revenue
         FROM orders
         WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)`,
        [days],
      ),
      // DATE_FORMAT gives a plain "2026-10-17" text (a DATE would become a JS Date and shift by time zone)
      rowsOf(
        `SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS day,
                COUNT(*) AS orders, SUM(total) AS revenue
         FROM orders
         WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
         GROUP BY day
         ORDER BY day`,
        [days],
      ),
      // Best sellers by money, using unit_price (what customers really paid)
      rowsOf(
        `SELECT p.id, p.title, p.handle,
                SUM(oi.quantity) AS units,
                SUM(oi.quantity * oi.unit_price) AS revenue
         FROM order_items oi
         JOIN product_variants v ON v.id = oi.variant_id
         JOIN products p ON p.id = v.product_id
         GROUP BY p.id, p.title, p.handle
         ORDER BY revenue DESC
         LIMIT 5`,
      ),
    ]);

    const allOrders = Number(all[0].orders);
    const allRevenue = Number(all[0].revenue); // SUM of DECIMAL arrives as a string

    res.json({
      days,
      allTime: {
        revenue: allRevenue,
        orders: allOrders,
        itemsSold: Number(items[0].items),
        // average money per order (guard: no division by zero)
        averageOrder:
          allOrders === 0
            ? 0
            : Math.round((allRevenue / allOrders) * 100) / 100,
      },
      period: {
        revenue: Number(period[0].revenue),
        orders: Number(period[0].orders),
      },
      // Days without orders are not returned. The React chart will fill them with 0.
      daily: daily.map((d) => ({
        day: d.day,
        orders: Number(d.orders),
        revenue: Number(d.revenue),
      })),
      topProducts: top.map((t) => ({
        id: t.id,
        title: t.title,
        handle: t.handle,
        units: Number(t.units),
        revenue: Number(t.revenue),
      })),
    });
  } catch (err) {
    next(err);
  }
});

// All orders of all users
router.get("/orders", validate(adminOrdersSchema), async (req, res, next) => {
  try {
    const { page, limit } = req.validated.query;

    const [[{ total }]] = await db.query(
      "SELECT COUNT(*) AS total FROM orders",
    );
    const [rows] = await db.query(
      `SELECT o.id, o.total, o.created_at, u.email, SUM(oi.quantity) AS item_count
       FROM orders o
       JOIN users u ON u.id = o.user_id
       JOIN order_items oi ON oi.order_id = o.id
       GROUP BY o.id, u.email
       ORDER BY o.created_at DESC, o.id DESC
       LIMIT ? OFFSET ?`,
      [limit, (page - 1) * limit],
    );

    res.json({
      items: rows.map((r) => ({
        id: r.id,
        email: r.email, // the admin may see the full email
        total: Number(r.total),
        itemCount: Number(r.item_count),
        createdAt: r.created_at,
      })),
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err) {
    next(err);
  }
});

// All variants with the REAL stock number (admin only)
router.get(
  "/variants",
  validate(adminVariantsSchema),
  async (req, res, next) => {
    try {
      const { page, limit, search } = req.validated.query;

      // "where" is fixed text chosen by the code. The user's text only goes into the "?" values.
      const where = search ? "WHERE p.title LIKE ? OR v.sku LIKE ?" : "";
      const params = search ? [`%${search}%`, `%${search}%`] : [];

      const [[{ total }]] = await db.query(
        `SELECT COUNT(*) AS total
       FROM product_variants v JOIN products p ON p.id = v.product_id ${where}`,
        params,
      );
      const [rows] = await db.query(
        `SELECT v.id, v.sku, v.color, v.size, v.price, v.compare_at_price, v.stock_quantity,
              p.title, p.handle
       FROM product_variants v
       JOIN products p ON p.id = v.product_id
       ${where}
       ORDER BY p.title, v.id
       LIMIT ? OFFSET ?`,
        [...params, limit, (page - 1) * limit],
      );

      res.json({
        items: rows.map((r) => ({
          id: r.id,
          sku: r.sku,
          title: r.title,
          handle: r.handle,
          color: r.color,
          size: r.size,
          price: Number(r.price),
          compareAtPrice:
            r.compare_at_price === null ? null : Number(r.compare_at_price),
          stockQuantity: r.stock_quantity,
        })),
        total,
        page,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      });
    } catch (err) {
      next(err);
    }
  },
);

// Change price, compare price and/or stock of one variant
router.patch(
  "/variants/:id",
  validate(updateVariantSchema),
  async (req, res, next) => {
    let conn;
    try {
      const { id } = req.validated.params;
      const body = req.validated.body;

      conn = await db.getConnection();
      await conn.beginTransaction();

      // 1. The variant (locked while we change it)
      const [rows] = await conn.query(
        "SELECT product_id, price, compare_at_price FROM product_variants WHERE id = ? FOR UPDATE",
        [id],
      );
      if (rows.length === 0) {
        await conn.rollback();
        return res.status(404).json({ error: "Variant not found" });
      }
      const current = rows[0];

      // 2. The rule from the import: a discount price must be higher than the price (or null)
      const finalPrice = body.price ?? Number(current.price);
      const finalCompare =
        body.compareAtPrice !== undefined
          ? body.compareAtPrice
          : current.compare_at_price === null
            ? null
            : Number(current.compare_at_price);
      if (finalCompare !== null && finalCompare <= finalPrice) {
        await conn.rollback();
        return res.status(400).json({
          error:
            "compareAtPrice must be higher than price (or null for no discount)",
        });
      }

      // 3. Only the fields that were sent. Column names are fixed text, values are "?".
      const sets = [];
      const values = [];
      if (body.price !== undefined) {
        sets.push("price = ?");
        values.push(body.price);
      }
      if (body.compareAtPrice !== undefined) {
        sets.push("compare_at_price = ?");
        values.push(body.compareAtPrice); // null is allowed
      }
      if (body.stockQuantity !== undefined) {
        sets.push("stock_quantity = ?");
        values.push(body.stockQuantity);
      }
      await conn.query(
        `UPDATE product_variants SET ${sets.join(", ")} WHERE id = ?`,
        [...values, id],
      );

      // 4. Keep the copy "price_min" in sync
      if (body.price !== undefined) {
        await conn.query(
          `UPDATE products
         SET price_min = (SELECT MIN(price) FROM product_variants WHERE product_id = ?)
         WHERE id = ?`,
          [current.product_id, current.product_id],
        );
      }

      await conn.commit();
      res.json({ ok: true });
    } catch (err) {
      if (conn) await conn.rollback().catch(() => {});
      next(err);
    } finally {
      if (conn) conn.release();
    }
  },
);

// Newest reviews first. Admin sees the full email (the public API masks it).
router.get("/reviews", validate(adminReviewsSchema), async (req, res, next) => {
  try {
    const { page, limit } = req.validated.query;

    const [[{ total }]] = await db.query(
      "SELECT COUNT(*) AS total FROM reviews",
    );
    const [rows] = await db.query(
      `SELECT r.id, r.rating, r.comment, r.created_at, u.email, p.title, p.handle
       FROM reviews r
       JOIN users u ON u.id = r.user_id
       JOIN products p ON p.id = r.product_id
       ORDER BY r.created_at DESC, r.id DESC
       LIMIT ? OFFSET ?`,
      [limit, (page - 1) * limit],
    );

    res.json({
      items: rows.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        email: r.email,
        productTitle: r.title,
        handle: r.handle,
        createdAt: r.created_at,
      })),
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err) {
    next(err);
  }
});

// Delete one review and fix the product's rating
router.delete(
  "/reviews/:id",
  validate(deleteReviewSchema),
  async (req, res, next) => {
    let conn;
    try {
      const { id } = req.validated.params;

      conn = await db.getConnection();
      await conn.beginTransaction();

      // 1. Which review? (plain read, no lock yet)
      const [reviews] = await conn.query(
        "SELECT product_id, rating FROM reviews WHERE id = ?",
        [id],
      );
      if (reviews.length === 0) {
        await conn.rollback();
        return res.status(404).json({ error: "Review not found" });
      }
      const review = reviews[0];

      // 2. Lock the product first (same order as POST review -> no deadlock)
      const [products] = await conn.query(
        "SELECT rating, rating_count FROM products WHERE id = ? FOR UPDATE",
        [review.product_id],
      );
      const product = products[0];

      // 3. Delete. If 0 rows, another admin already deleted it: do not subtract twice.
      const [result] = await conn.query("DELETE FROM reviews WHERE id = ?", [
        id,
      ]);
      if (result.affectedRows === 0) {
        await conn.rollback();
        return res.status(404).json({ error: "Review not found" });
      }

      // 4. New numbers from the OLD numbers
      const newCount = Math.max(0, product.rating_count - 1);
      let newAvg = null; // no ratings left -> NULL
      if (newCount > 0) {
        const oldAvg = Number(product.rating);
        const raw = (oldAvg * product.rating_count - review.rating) / newCount;
        // Rounding can drift a little, so keep the result between 1 and 5
        newAvg = Math.min(5, Math.max(1, Math.round(raw * 100) / 100));
      }

      // 5. Save
      await conn.query(
        "UPDATE products SET rating = ?, rating_count = ? WHERE id = ?",
        [newAvg, newCount, review.product_id],
      );

      await conn.commit();
      res.json({ rating: newAvg, ratingCount: newCount });
    } catch (err) {
      if (conn) await conn.rollback().catch(() => {});
      next(err);
    } finally {
      if (conn) conn.release();
    }
  },
);

export default router;
