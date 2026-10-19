import { pool as db } from "../config/db.js";
import { withTransaction } from "../utils/transaction.js";
import { escapeLike } from "../utils/sql.js";
import { HttpError } from "../utils/httpError.js";
import { slugify } from "../utils/slug.js";

const rowsOf = async (sql, params) => (await db.query(sql, params))[0];
const totalPages = (total, limit) => Math.max(1, Math.ceil(total / limit));

// Income and sales numbers
export async function getStats(days) {
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

  return {
    days,
    allTime: {
      revenue: allRevenue,
      orders: allOrders,
      itemsSold: Number(items[0].items),
      // average money per order (guard: no division by zero)
      averageOrder:
        allOrders === 0 ? 0 : Math.round((allRevenue / allOrders) * 100) / 100,
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
  };
}

// All orders of all users
export async function listOrders({ page, limit }) {
  const [[{ total }]] = await db.query("SELECT COUNT(*) AS total FROM orders");
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

  return {
    items: rows.map((r) => ({
      id: r.id,
      email: r.email, // the admin may see the full email
      total: Number(r.total),
      itemCount: Number(r.item_count),
      createdAt: r.created_at,
    })),
    total,
    page,
    totalPages: totalPages(total, limit),
  };
}

// All variants with the REAL stock number
export async function listVariants({ page, limit, search }) {
  // "where" is fixed text chosen by the code. The user's text only goes into the "?" values.
  const where = search ? "WHERE p.title LIKE ? OR v.sku LIKE ?" : "";
  const like = search ? `%${escapeLike(search)}%` : null;
  const params = search ? [like, like] : [];

  const [[{ total }]] = await db.query(
    `SELECT COUNT(*) AS total
     FROM product_variants v JOIN products p ON p.id = v.product_id ${where}`,
    params,
  );
  const [rows] = await db.query(
    `SELECT v.id, v.product_id, v.sku, v.color, v.size, v.price, v.compare_at_price, v.stock_quantity,
            p.title, p.handle
     FROM product_variants v
     JOIN products p ON p.id = v.product_id
     ${where}
     ORDER BY p.title, v.id
     LIMIT ? OFFSET ?`,
    [...params, limit, (page - 1) * limit],
  );

  return {
    items: rows.map((r) => ({
      id: r.id,
      productId: r.product_id,
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
    totalPages: totalPages(total, limit),
  };
}

// Change price, compare price and/or stock of one variant
export function updateVariant(id, body) {
  return withTransaction(async (conn) => {
    // 1. The variant (locked while we change it)
    const [rows] = await conn.query(
      "SELECT product_id, price, compare_at_price FROM product_variants WHERE id = ? FOR UPDATE",
      [id],
    );
    if (rows.length === 0) throw new HttpError(404, "Variant not found");
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
      throw new HttpError(
        400,
        "compareAtPrice must be higher than price (or null for no discount)",
      );
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

    return { ok: true };
  });
}

// Newest reviews first. Admin sees the full email (the public API masks it).
export async function listReviews({ page, limit }) {
  const [[{ total }]] = await db.query("SELECT COUNT(*) AS total FROM reviews");
  const [rows] = await db.query(
    `SELECT r.id, r.rating, r.comment, r.created_at, u.email, p.title, p.handle
     FROM reviews r
     JOIN users u ON u.id = r.user_id
     JOIN products p ON p.id = r.product_id
     ORDER BY r.created_at DESC, r.id DESC
     LIMIT ? OFFSET ?`,
    [limit, (page - 1) * limit],
  );

  return {
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
    totalPages: totalPages(total, limit),
  };
}

// Delete one review and fix the product's rating
export function deleteReview(id) {
  return withTransaction(async (conn) => {
    // 1. Which review? (plain read, no lock yet)
    const [reviews] = await conn.query(
      "SELECT product_id, rating FROM reviews WHERE id = ?",
      [id],
    );
    if (reviews.length === 0) throw new HttpError(404, "Review not found");
    const review = reviews[0];

    // 2. Lock the product first (same order as POST review -> no deadlock)
    const [products] = await conn.query(
      "SELECT rating, rating_count FROM products WHERE id = ? FOR UPDATE",
      [review.product_id],
    );
    const product = products[0];

    // 3. Delete. If 0 rows, another admin already deleted it: do not subtract twice.
    const [result] = await conn.query("DELETE FROM reviews WHERE id = ?", [id]);
    if (result.affectedRows === 0) throw new HttpError(404, "Review not found");

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

    return { rating: newAvg, ratingCount: newCount };
  });
}

// A new product with its variants and (optional) first image. Returns { id, handle }.
export function createProduct(body) {
  return withTransaction(async (conn) => {
    const [categories] = await conn.query(
      "SELECT id FROM categories WHERE id = ?",
      [body.categoryId],
    );
    if (categories.length === 0) throw new HttpError(400, "Category not found");

    // The handle is the product's URL name. Add -2, -3, ... until it is free.
    const base = slugify(body.title);
    let handle = base;
    for (let n = 2; ; n++) {
      const [taken] = await conn.query("SELECT 1 FROM products WHERE handle = ?", [handle]);
      if (taken.length === 0) break;
      handle = `${base}-${n}`;
    }

    const priceMin = Math.min(...body.variants.map((v) => v.price));
    try {
      const [product] = await conn.query(
        `INSERT INTO products (handle, title, description, price_min, category_id)
         VALUES (?, ?, ?, ?, ?)`,
        [handle, body.title, body.description, priceMin, body.categoryId],
      );
      const productId = product.insertId;

      if (body.imageUrl) {
        await conn.query(
          "INSERT INTO product_images (product_id, url, alt, position) VALUES (?, ?, ?, 0)",
          [productId, body.imageUrl, body.title],
        );
      }

      await conn.query(
        `INSERT INTO product_variants
           (product_id, sku, color, size, price, compare_at_price, stock_quantity)
         VALUES ?`,
        [
          body.variants.map((v) => [
            productId,
            v.sku,
            v.color || null,
            v.size || null,
            v.price,
            v.compareAtPrice ?? null,
            v.stockQuantity,
          ]),
        ],
      );
      return { id: productId, handle };
    } catch (err) {
      if (err.code === "ER_DUP_ENTRY") {
        const what = /sku/i.test(err.message) ? "A SKU is already used by another variant" : "Please try again";
        throw new HttpError(409, what);
      }
      throw err;
    }
  });
}

// Deletes a product with its images, variants and reviews (ON DELETE CASCADE) and removes it
// from carts. A product that was ever ordered cannot be deleted: order history must stay.
export function deleteProduct(id) {
  return withTransaction(async (conn) => {
    const [products] = await conn.query(
      "SELECT id FROM products WHERE id = ? FOR UPDATE",
      [id],
    );
    if (products.length === 0) throw new HttpError(404, "Product not found");

    const [ordered] = await conn.query(
      `SELECT 1 FROM order_items oi
       JOIN product_variants v ON v.id = oi.variant_id
       WHERE v.product_id = ? LIMIT 1`,
      [id],
    );
    if (ordered.length > 0) {
      throw new HttpError(
        409,
        "This product has been ordered, so it cannot be deleted. Set its stock to 0 instead.",
      );
    }

    try {
      await conn.query(
        `DELETE ci FROM cart_items ci
         JOIN product_variants v ON v.id = ci.variant_id
         WHERE v.product_id = ?`,
        [id],
      );
      await conn.query("DELETE FROM products WHERE id = ?", [id]);
    } catch (err) {
      // An order was placed at the same moment
      if (err.code === "ER_ROW_IS_REFERENCED_2") {
        throw new HttpError(409, "This product has just been ordered, so it cannot be deleted.");
      }
      throw err;
    }
    return { ok: true };
  });
}
