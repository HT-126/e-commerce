import { Router } from "express";
import { pool as db } from "../config/db.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import {
  addToCartSchema,
  updateCartSchema,
  removeFromCartSchema,
} from "../schemas/cart.js";

const router = Router();
const MAX_PER_ITEM = 10;

// Every cart route needs a logged-in user, so we put it once at the top.
router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
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
      [req.user.id], // again: the id comes from the cookie
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

    res.json({ items, total: Math.round(total * 100) / 100 });
  } catch (err) {
    next(err);
  }
});

router.post("/", validate(addToCartSchema), async (req, res, next) => {
  try {
    const { variantId, quantity } = req.validated.body;
    const userId = req.user.id; // from the cookie, NEVER from the body

    // 1. Does the variant exist, and is it in stock?
    const [rows] = await db.query(
      "SELECT stock_quantity FROM product_variants WHERE id = ?",
      [variantId],
    );
    if (rows.length === 0)
      return res.status(404).json({ error: "Variant not found" });
    if (rows[0].stock_quantity <= 0)
      return res.status(409).json({ error: "Sold out" });

    // 2. Insert, or add to the old row if (user_id, variant_id) already exists.
    //    LEAST(...) keeps the total at 10 at most.
    await db.query(
      `INSERT INTO cart_items (user_id, variant_id, quantity)
       VALUES (?, ?, ?) AS new
       ON DUPLICATE KEY UPDATE quantity = LEAST(cart_items.quantity + new.quantity, ?)`,
      [userId, variantId, quantity, MAX_PER_ITEM],
    );

    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Change the quantity. PATCH SETS the number (POST adds to it).
router.patch(
  "/:variantId",
  validate(updateCartSchema),
  async (req, res, next) => {
    try {
      const { variantId } = req.validated.params;
      const { quantity } = req.validated.body;
      const userId = req.user.id; // from the cookie

      // Is it in MY cart, and is it still in stock?
      const [rows] = await db.query(
        `SELECT v.stock_quantity
       FROM cart_items ci
       JOIN product_variants v ON v.id = ci.variant_id
       WHERE ci.user_id = ? AND ci.variant_id = ?`,
        [userId, variantId],
      );
      if (rows.length === 0)
        return res.status(404).json({ error: "Not in cart" });
      if (rows[0].stock_quantity <= 0) {
        return res
          .status(409)
          .json({ error: "Sold out. You can only remove it." });
      }

      await db.query(
        "UPDATE cart_items SET quantity = ? WHERE user_id = ? AND variant_id = ?",
        [quantity, userId, variantId],
      );
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  },
);

// Remove one item. Allowed even when it is sold out.
router.delete(
  "/:variantId",
  validate(removeFromCartSchema),
  async (req, res, next) => {
    try {
      const { variantId } = req.validated.params;
      const [result] = await db.query(
        "DELETE FROM cart_items WHERE user_id = ? AND variant_id = ?",
        [req.user.id, variantId],
      );
      if (result.affectedRows === 0)
        return res.status(404).json({ error: "Not in cart" });
      res.status(204).end(); // success, nothing to send back
    } catch (err) {
      next(err);
    }
  },
);

export default router;
