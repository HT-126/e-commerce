import { Router } from "express";
import { pool as db } from "../config/db.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { orderIdSchema } from "../schemas/orders.js";

const router = Router();
router.use(requireAuth);

// My orders, newest first. No input, so no Zod.
router.get("/", async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT o.id, o.total, o.created_at, SUM(oi.quantity) AS item_count
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
       WHERE o.user_id = ?
       GROUP BY o.id
       ORDER BY o.created_at DESC, o.id DESC
       LIMIT 50`,
      [req.user.id], // from the cookie
    );
    res.json(
      rows.map((r) => ({
        id: r.id,
        total: Number(r.total), // DECIMAL arrives as a string
        itemCount: Number(r.item_count), // SUM arrives as a string too
        createdAt: r.created_at,
      })),
    );
  } catch (err) {
    next(err);
  }
});

// One order with its lines
router.get("/:id", validate(orderIdSchema), async (req, res, next) => {
  try {
    const { id } = req.validated.params;

    // "AND user_id = ?": an order of another user looks like "not found"
    const [orders] = await db.query(
      "SELECT id, total, created_at FROM orders WHERE id = ? AND user_id = ?",
      [id, req.user.id],
    );
    if (orders.length === 0)
      return res.status(404).json({ error: "Order not found" });

    const [lines] = await db.query(
      `SELECT oi.variant_id, oi.quantity, oi.unit_price,
              v.color, v.size, p.title, p.handle,
              (SELECT pi.url FROM product_images pi
                WHERE pi.product_id = p.id
                ORDER BY pi.position LIMIT 1) AS image_url
       FROM order_items oi
       JOIN product_variants v ON v.id = oi.variant_id
       JOIN products p ON p.id = v.product_id
       WHERE oi.order_id = ?
       ORDER BY oi.id`,
      [id],
    );

    res.json({
      id: orders[0].id,
      total: Number(orders[0].total),
      createdAt: orders[0].created_at,
      items: lines.map((l) => {
        const unitPrice = Number(l.unit_price); // the price AT CHECKOUT
        return {
          variantId: l.variant_id,
          name: l.title,
          handle: l.handle,
          color: l.color,
          size: l.size,
          imageUrl: l.image_url ?? null,
          unitPrice,
          quantity: l.quantity,
          lineTotal: Math.round(unitPrice * 100 * l.quantity) / 100,
        };
      }),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
