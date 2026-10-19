import { pool as db } from "../config/db.js";
import { HttpError } from "../utils/httpError.js";

// My orders, newest first, one page at a time
export async function listOrders(userId, { page, limit }) {
  const [[{ total }]] = await db.query(
    "SELECT COUNT(*) AS total FROM orders WHERE user_id = ?",
    [userId],
  );
  const [rows] = await db.query(
    `SELECT o.id, o.total, o.created_at, SUM(oi.quantity) AS item_count
     FROM orders o
     JOIN order_items oi ON oi.order_id = o.id
     WHERE o.user_id = ?
     GROUP BY o.id
     ORDER BY o.created_at DESC, o.id DESC
     LIMIT ? OFFSET ?`,
    [userId, limit, (page - 1) * limit],
  );
  return {
    items: rows.map((r) => ({
      id: r.id,
      total: Number(r.total), // DECIMAL arrives as a string
      itemCount: Number(r.item_count), // SUM arrives as a string too
      createdAt: r.created_at,
    })),
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

// One order with its lines
export async function getOrder(userId, id) {
  // "AND user_id = ?": an order of another user looks like "not found"
  const [orders] = await db.query(
    "SELECT id, total, created_at FROM orders WHERE id = ? AND user_id = ?",
    [id, userId],
  );
  if (orders.length === 0) throw new HttpError(404, "Order not found");

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

  return {
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
  };
}
