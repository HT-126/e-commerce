import { Router } from "express";
import { pool as db } from "../config/db.js";
import { validate } from "../middleware/validate.js";
import { listProductsSchema } from "../schemas/productQuery.js";
import { productDetailSchema } from "../schemas/productDetail.js";

const router = Router();

// Fixed SQL text for each allowed sort.
// "p.id" at the end makes the order stable, so pages do not repeat rows.
const SORTS = {
  price_asc: "p.price_min ASC, p.id ASC",
  price_desc: "p.price_min DESC, p.id ASC",
  rating_desc: "p.rating DESC, p.rating_count DESC, p.id ASC",
};

//step3
const getCategoryIds = async (categoryId) => {
  const [rows] = await db.query(
    `WITH RECURSIVE tree AS(
      SELECT id FROM categories WHERE id = ?
      UNION ALL
      SELECT c.id FROM categories c JOIN tree t ON c.parent_id=t.id
    )
     SELECT id from tree `,
    [categoryId],
  );
  return rows.map((r) => r.id);
};

router.get("/", validate(listProductsSchema), async (req, res, next) => {
  try {
    const {
      page,
      limit,
      search,
      minPrice,
      maxPrice,
      minRating,
      sort,
      category,
    } = req.validated.query;

    const where = [];
    const params = [];

    //step 3
    if (category !== undefined) {
      const ids = await getCategoryIds(category);
      if (ids.length === 0) {
        // Unknown category: empty list is correct. "IN ()" would be a SQL error.
        return res.json({ items: [], page, limit, total: 0, totalPages: 0 });
      }
      where.push("p.category_id IN (?)");
      params.push(ids); // mysql2 turns an array into 5, 6, 7, ...
    }

    //step 2
    if (search) {
      where.push("p.title LIKE ?");
      params.push(`%${search}%`); // %search% => abc search, search abc
    }
    if (minPrice !== undefined) {
      where.push("p.price_min >= ?");
      params.push(minPrice);
    }
    if (maxPrice !== undefined) {
      where.push("p.price_min <= ?");
      params.push(maxPrice);
    }
    if (minRating !== undefined) {
      where.push("p.rating >= ?");
      params.push(minRating);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    // Query 1: how many products match (for the page buttons)
    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM products p ${whereSql}`,
      params,
    );
    // Query 2: one page of products
    const [rows] = await db.query(
      `SELECT p.id, p.handle, p.title, p.price_min, p.rating, p.rating_count,
        (SELECT i.url FROM product_images i WHERE i.product_id = p.id ORDER BY i.position LIMIT 1) AS image_url,
        EXISTS(SELECT 1 FROM product_variants v WHERE v.product_id = p.id AND v.stock_quantity > 0) AS in_stock
      FROM products p
      ${whereSql}
      ORDER BY ${SORTS[sort]}
      LIMIT ? OFFSET ?`,
      [...params, limit, (page - 1) * limit],
    ); //select các cột=>lấy ảnh=>ktra còn hàng=>WHERE, ORDER BY, LIMIT, OFFSET=>Truyền params
    res.json({
      items: rows.map((r) => ({
        id: r.id,
        handle: r.handle,
        title: r.title,
        // mysql2 returns DECIMAL as a string ("28.99"), so convert it
        price_min: Number(r.price_min),
        rating: r.rating === null ? null : Number(r.rating),
        rating_count: r.rating_count,
        image_url: r.image_url,
        in_stock: Boolean(r.in_stock), // true/false, never the number
      })),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.get(
  "/:handle",
  validate(productDetailSchema),
  async (req, res, next) => {
    try {
      const { handle } = req.validated.params;
      // Query 1: the product + its category name
      const [products] = await db.query(
        `SELECT p.id, p.handle, p.title, p.description, p.rating, p.rating_count,
              c.id AS category_id, c.name AS category_name
        FROM products p
        JOIN categories c ON c.id = p.category_id
        WHERE p.handle = ?`,
        [handle], // handle lấy từ param
      );
      // Format was fine but nothing found = 404 (bad format was 400 above)
      if (products.length === 0) {
        return res.status(404).json({ error: "Product not found" });
      }
      const p = products[0];

      // Query 2: images in gallery order
      const [images] = await db.query(
        `SELECT url, alt FROM product_images WHERE product_id = ? ORDER BY position`,
        [p.id],
      );

      // Query 3: variants (id is needed later for the cart)
      const [variants] = await db.query(
        `SELECT id, color, size, price, compare_at_price, stock_quantity 
        FROM product_variants WHERE product_id = ? ORDER BY id`,
        [p.id],
      );

      res.json({
        id: p.id,
        handle: p.handle,
        title: p.title,
        description: p.description,
        rating: p.rating === null ? null : Number(p.rating),
        rating_count: p.rating_count,
        category: { id: p.category_id, name: p.category_name },
        images,
        variants: variants.map((v) => ({
          id: v.id,
          color: v.color,
          size: v.size,
          price: Number(v.price),
          compare_at_price:
            v.compare_at_price === null ? null : Number(v.compare_at_price),
          in_stock: v.stock_quantity > 0, // the real number stays on the server
        })),
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },
);

export default router;
