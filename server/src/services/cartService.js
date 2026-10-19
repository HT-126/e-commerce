import { pool as db } from "../config/db.js";
import { HttpError } from "../utils/httpError.js";

const MAX_PER_ITEM = 10;

export async function getCart(userId) {
  const [rows] = await db.query(
    `SELECT ci.variant_id, ci.quantity,
      v.price, v.color, v.size, v.stock_quantity,
      p.title, p.handle,
      (SELECT pi.url FROM product_images pi
        WHERE pi.product_id = p.id
        ORDER BY pi.position LIMIT 1) AS image_url
    FROM cart_items ci
    JOIN product_variants v ON v.id = ci.variant_id
    JOIN products p ON p.id = v.product_id
    WHERE ci.user_id = ?
    ORDER BY p.title, v.id`,
    [userId],
  );

  let total = 0;
  const items = rows.map((r) => {
    const price = Number(r.price); // mysql2 returns DECIMAL as a string
    const soldOut = r.stock_quantity <= 0;
    if (!soldOut) total += price * r.quantity;
    return {
      variantId: r.variant_id,
      name: r.title,
      handle: r.handle,
      color: r.color,
      size: r.size,
      imageUrl: r.image_url ?? null,
      price,
      quantity: r.quantity,
      soldOut, // true or false. The stock number is NOT sent.
    };
  });

  return { items, total: Math.round(total * 100) / 100 };
}

export async function addItem(userId, { variantId, quantity }) {
  // 1. Does the variant exist, and is it in stock?
  const [rows] = await db.query(
    "SELECT stock_quantity FROM product_variants WHERE id = ?",
    [variantId],
  );
  if (rows.length === 0) throw new HttpError(404, "Variant not found");
  if (rows[0].stock_quantity <= 0) throw new HttpError(409, "Sold out");

  // The cart line may never be above 10 or above the stock
  const cap = Math.min(MAX_PER_ITEM, rows[0].stock_quantity);

  const [existing] = await db.query(
    "SELECT quantity FROM cart_items WHERE user_id = ? AND variant_id = ?",
    [userId, variantId],
  );
  const wanted = (existing[0]?.quantity ?? 0) + quantity;

  // 2. Insert, or add to the old row if (user_id, variant_id) already exists.
  //    LEAST(...) keeps the total at the cap at most.
  await db.query(
    `INSERT INTO cart_items (user_id, variant_id, quantity)
     VALUES (?, ?, ?) AS new
     ON DUPLICATE KEY UPDATE quantity = LEAST(cart_items.quantity + new.quantity, ?)`,
    [userId, variantId, Math.min(quantity, cap), cap],
  );

  // Tell the client what is really in the cart, so it can show an honest message
  const [[line]] = await db.query(
    "SELECT quantity FROM cart_items WHERE user_id = ? AND variant_id = ?",
    [userId, variantId],
  );
  return { ok: true, quantity: line.quantity, capped: line.quantity < wanted };
}

// Sets the number (addItem adds to it)
export async function setQuantity(userId, variantId, quantity) {
  // Is it in MY cart, and is it still in stock?
  const [rows] = await db.query(
    `SELECT v.stock_quantity
     FROM cart_items ci
     JOIN product_variants v ON v.id = ci.variant_id
     WHERE ci.user_id = ? AND ci.variant_id = ?`,
    [userId, variantId],
  );
  if (rows.length === 0) throw new HttpError(404, "Not in cart");
  if (rows[0].stock_quantity <= 0) {
    throw new HttpError(409, "Sold out. You can only remove it.");
  }

  // Never above the stock, even if the client asks for more
  const finalQuantity = Math.min(quantity, rows[0].stock_quantity);
  await db.query(
    "UPDATE cart_items SET quantity = ? WHERE user_id = ? AND variant_id = ?",
    [finalQuantity, userId, variantId],
  );
  return { ok: true, quantity: finalQuantity };
}

// Allowed even when the item is sold out
export async function removeItem(userId, variantId) {
  const [result] = await db.query(
    "DELETE FROM cart_items WHERE user_id = ? AND variant_id = ?",
    [userId, variantId],
  );
  if (result.affectedRows === 0) throw new HttpError(404, "Not in cart");
}
