import { pool as db } from "../config/db.js";
import { withTransaction } from "../utils/transaction.js";
import { HttpError } from "../utils/httpError.js";

// Never send a real email to other users: show only the first letter
const maskName = (email) => `${email[0]}***`;

// Public: the reviews of one product
export async function listReviews(handle, { page, limit }) {
  const [products] = await db.query(
    "SELECT id FROM products WHERE handle = ?",
    [handle],
  );
  if (products.length === 0) throw new HttpError(404, "Product not found");
  const productId = products[0].id;

  const [[{ total }]] = await db.query(
    "SELECT COUNT(*) AS total FROM reviews WHERE product_id = ?",
    [productId],
  );
  const [rows] = await db.query(
    `SELECT r.id, r.rating, r.comment, r.created_at, u.email
     FROM reviews r
     JOIN users u ON u.id = r.user_id
     WHERE r.product_id = ?
     ORDER BY r.created_at DESC, r.id DESC
     LIMIT ? OFFSET ?`,
    [productId, limit, (page - 1) * limit],
  );

  return {
    items: rows.map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      author: maskName(r.email),
      createdAt: r.created_at,
    })),
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

// Verified buyers only. Returns the product's new { rating, ratingCount }.
export function createReview(userId, handle, { rating, comment }) {
  return withTransaction(async (conn) => {
    // 1. The product. FOR UPDATE locks its row: two reviews of the same product
    //    now go one after the other, so no one overwrites the other's numbers.
    const [products] = await conn.query(
      "SELECT id, rating, rating_count FROM products WHERE handle = ? FOR UPDATE",
      [handle],
    );
    if (products.length === 0) throw new HttpError(404, "Product not found");
    const product = products[0];

    // 2. Verified purchase: did I buy any variant of this product?
    const [bought] = await conn.query(
      `SELECT 1
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       JOIN product_variants v ON v.id = oi.variant_id
       WHERE o.user_id = ? AND v.product_id = ?
       LIMIT 1`,
      [userId, product.id],
    );
    if (bought.length === 0) {
      throw new HttpError(
        403,
        "Only customers who bought this product can review it",
      );
    }

    // 3. The review. UNIQUE (user_id, product_id) stops a second one.
    try {
      await conn.query(
        "INSERT INTO reviews (product_id, user_id, rating, comment) VALUES (?, ?, ?, ?)",
        [product.id, userId, rating, comment],
      );
    } catch (err) {
      if (err.code === "ER_DUP_ENTRY") {
        throw new HttpError(409, "You already reviewed this product");
      }
      throw err;
    }

    // 4. New average from the OLD numbers (they include the imported ratings).
    //    rating is NULL when there are no ratings yet, so use 0 (the count is 0 then too).
    const oldCount = product.rating_count;
    const oldAvg = product.rating === null ? 0 : Number(product.rating);
    const newCount = oldCount + 1;
    const newAvg =
      Math.round(((oldAvg * oldCount + rating) / newCount) * 100) / 100;

    // 5. Save the numbers
    await conn.query(
      "UPDATE products SET rating = ?, rating_count = ? WHERE id = ?",
      [newAvg, newCount, product.id],
    );

    return { rating: newAvg, ratingCount: newCount };
  });
}
