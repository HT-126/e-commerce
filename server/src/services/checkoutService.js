import { withTransaction } from "../utils/transaction.js";
import { HttpError } from "../utils/httpError.js";

// Buys the in-stock lines of the user's cart. Returns { orderId, total }.
// Any HttpError thrown inside undoes the whole transaction.
export function checkout(userId) {
  return withTransaction(async (conn) => {
    // 1. My cart, with the price from the DATABASE.
    //    FOR UPDATE OF ci locks my cart rows: if I double-click, the 2nd request waits,
    //    then sees an empty cart (no double order).
    //    FOR UPDATE OF v also locks the variant rows, so an admin cannot change the
    //    price or stock between this read and the commit.
    //    ORDER BY variant id: everybody locks in the same order (avoids deadlocks).
    const [cartRows] = await conn.query(
      `SELECT ci.variant_id, ci.quantity, v.price, v.stock_quantity, p.title
       FROM cart_items ci
       JOIN product_variants v ON v.id = ci.variant_id
       JOIN products p ON p.id = v.product_id
       WHERE ci.user_id = ?
       ORDER BY ci.variant_id
       FOR UPDATE OF ci, v`,
      [userId],
    );
    if (cartRows.length === 0) throw new HttpError(400, "Cart is empty");

    // Sold-out lines are not bought (the cart already leaves them out of its total).
    // They stay in the cart so the customer can remove them.
    const items = cartRows.filter((r) => r.stock_quantity > 0);
    if (items.length === 0) {
      throw new HttpError(409, "All items in your cart are sold out");
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
        // Not enough stock. The transaction wrapper undoes everything done so far.
        throw new HttpError(409, `Not enough stock: ${item.title}`, {
          variantId: item.variant_id,
        });
      }
      totalCents += Math.round(Number(item.price) * 100) * item.quantity;
    }
    const total = totalCents / 100;

    // 3. The order
    const [orderResult] = await conn.query(
      "INSERT INTO orders (user_id, total) VALUES (?, ?)",
      [userId, total],
    );
    const orderId = orderResult.insertId;

    // 4. The lines. unit_price is a COPY of the price now.
    const lines = items.map((i) => [orderId, i.variant_id, i.quantity, i.price]);
    await conn.query(
      "INSERT INTO order_items (order_id, variant_id, quantity, unit_price) VALUES ?",
      [lines],
    );

    // 5. Remove only the lines that were bought
    await conn.query(
      "DELETE FROM cart_items WHERE user_id = ? AND variant_id IN (?)",
      [userId, items.map((i) => i.variant_id)],
    );

    return { orderId, total };
  });
}
