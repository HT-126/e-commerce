import { Router } from "express";
import { pool as db } from "../config/db.js"; // same import as in cart.js
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.post("/", async (req, res, next) => {
  let conn; // one connection for the whole transaction
  try {
    conn = await db.getConnection();
    await conn.beginTransaction();

    // 1. My cart, with the price from the DATABASE.
    //    FOR UPDATE OF ci locks my cart rows: if I double-click, the 2nd request waits,
    //    then sees an empty cart (no double order).
    //    ORDER BY variant id: everybody locks in the same order (avoids deadlocks).
    const [items] = await conn.query(
      `SELECT ci.variant_id, ci.quantity, v.price, p.title
       FROM cart_items ci
       JOIN product_variants v ON v.id = ci.variant_id
       JOIN products p ON p.id = v.product_id
       WHERE ci.user_id = ?
       ORDER BY ci.variant_id
       FOR UPDATE OF ci`,
      [req.user.id],
    );
    if (items.length === 0) {
      await conn.rollback();
      return res.status(400).json({ error: "Cart is empty" });
    }

    // 2. Take the stock. The check and the change are ONE statement.
    let totalCents = 0; // money in cents (whole numbers): no 0.1 + 0.2 problem
    for (const item of items) {
      const [result] = await conn.query(
        `UPDATE product_variants
         SET stock_quantity = stock_quantity - ?
         WHERE id = ? AND stock_quantity >= ?`,
        [item.quantity, item.variant_id, item.quantity],
      );
      if (result.affectedRows === 0) {
        // Not enough stock (or sold out). Undo everything done so far.
        await conn.rollback();
        return res.status(409).json({
          error: `Not enough stock: ${item.title}`,
          variantId: item.variant_id,
        });
      }
      totalCents += Math.round(Number(item.price) * 100) * item.quantity;
    }
    const total = totalCents / 100;

    // 3. The order
    const [orderResult] = await conn.query(
      "INSERT INTO orders (user_id, total) VALUES (?, ?)",
      [req.user.id, total],
    );
    const orderId = orderResult.insertId;

    // 4. The lines. unit_price is a COPY of the price now.
    const lines = items.map((i) => [
      orderId,
      i.variant_id,
      i.quantity,
      i.price,
    ]);
    await conn.query(
      "INSERT INTO order_items (order_id, variant_id, quantity, unit_price) VALUES ?",
      [lines],
    );

    // 5. Empty my cart
    await conn.query("DELETE FROM cart_items WHERE user_id = ?", [req.user.id]);

    await conn.commit();
    res.status(201).json({ orderId, total });
  } catch (err) {
    if (conn) await conn.rollback().catch(() => {}); // undo, ignore a rollback error
    next(err);
  } finally {
    if (conn) conn.release(); // ALWAYS give the connection back to the pool
  }
});

export default router;
