import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { productSchema } from "../schemas/productRow.js";
import { pool as db } from "../config/db.js";

//Step 3: Read, validate and log (no database yet)
// Build the path from THIS file, so it works from any folder.
// (Before, "../data/products.json" only worked from inside server/)
const __dirname = path.dirname(fileURLToPath(import.meta.url)); //Tái tạo biến __dirname trong môi trường ES Modules
const dataDir = path.resolve(__dirname, "../../../data"); //Đi ngược lên 3 cấp và trỏ vào thư mục con data
const DEMO_STOCK = 20; // invented number, say so in your README // step 5

function loadProducts() {
  const raw = JSON.parse(
    fs.readFileSync(path.join(dataDir, "products.json"), "utf8"),
  );

  const valid = []; // clean data, ready for the database
  const skipped = []; // bad rows, for the log

  for (const product of raw) {
    const result = productSchema.safeParse(product);

    if (result.success) {
      //zod
      valid.push(result.data); // Zod. The cleaned product (only when success is true)
    } else {
      skipped.push({
        handle: product.handle,
        issues: result.error.issues // Zod .error: An error object (only when success is false), .issues: An array with one item per problem
          .slice(0, 3)
          .map((i) => `${i.path.join(".")}: ${i.message}`),
      });
    }
  }
  return { valid, skipped };
}

//step 4: Build the category tree
// "Apparel & Accessories > Clothing > Dresses" -> ["Clothing", "Dresses"]
// slice(1) drops the root, because it is the same for all products
function pathParts(fullPath) {
  return fullPath.split(" > ").slice(1);
}
// Returns a Map: "Clothing > Dresses" -> category id
const buildCategories = async (conn, products) => {
  const idByPath = new Map();

  for (const product of products) {
    let parentId = null; // top level has no parent
    let key = "";

    for (const name of pathParts(product.category.full_path)) {
      key = key ? `${key} > ${name}` : name;
      // Already handled in this run? Skip the database (saves thousands of queries)
      if (idByPath.has(key)) {
        parentId = idByPath.get(key);
        continue;
      }
      //does this category already exist? If yes, reuse it. If no, create it
      // Does it exist? "<=>" is the NULL-safe equal
      const [rows] = await conn.query(
        // .query
        "SELECT id FROM categories WHERE name = ? AND parent_id <=> ?",
        [name, parentId],
      );
      //check if yes
      let id;
      if (rows.length > 0) {
        id = rows[0].id; // exists: reuse it
      } else {
        const [result] = await conn.query(
          "INSERT INTO categories (name, parent_id) VALUES (?, ?)",
          [name, parentId],
        );
        id = result.insertId; // the new row's id
      }
      //
      idByPath.set(key, id);
      parentId = id; // the next level is a child of this one
    }
  }
  return idByPath;
};

// Step 5: Insert products, images and variants

const insertProducts = async (conn, product, idByPath) => {
  for (const p of product) {
    const minPrice = Math.min(...p.variants.map((v) => v.price_usd)); // Math.min compare number, not number in array
    const categoryId = idByPath.get(
      pathParts(p.category.full_path).join(" > "),
    );

    const [result] = await conn.query(
      `INSERT INTO products(handle, title, description, price_min, rating, rating_count, category_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        p.handle,
        p.title,
        p.description,
        minPrice,
        p.reviews.rating,
        p.reviews.count,
        categoryId,
      ],
    );
    const productId = result.insertId;

    await conn.query(
      "INSERT INTO product_images (product_id, url, alt, position) VALUES ?",
      [p.images.map((img, i) => [productId, img.url, img.alt, i])],
    ); // => [[[42, "img1.jpg", "Red shirt",   0], [42, "img2.jpg", "Blue shirt",  1], [42, "img3.jpg", "Green shirt", 2]]]

    await conn.query(
      `INSERT INTO product_variants
       (product_id, sku, color, size, price, compare_at_price, stock_quantity)
       VALUES ?`,
      [
        p.variants.map((v) => [
          productId,
          v.sku,
          v.options.Color,
          v.options.Size,
          v.price_usd,
          v.compare_at_price_usd,
          v.in_stock ? DEMO_STOCK : 0, // sold-out variants are kept, with 0
        ]),
      ],
    );
  }
};

const { valid, skipped } = loadProducts(); //const result = loadProducts(); const valid = result.valid; const skipped = result.skipped;
console.log(`Valid: ${valid.length}, skipped: ${skipped.length}`);
// Save the skipped rows
fs.writeFileSync(
  path.join(dataDir, "import_skipped.json"),
  JSON.stringify(skipped, null, 2),
);

const conn = await db.getConnection();
try {
  // Do not import twice
  const [[{ n }]] = await conn.query("SELECT COUNT(*) AS n FROM products");
  if (n > 0)
    throw new Error("products table is not empty. Re-run schema.sql first.");

  await conn.beginTransaction();
  const idByPath = await buildCategories(conn, valid);
  await insertProducts(conn, valid, idByPath);
  await conn.commit(); // all or nothing
  console.log(`Imported ${valid.length} products`);
} catch (err) {
  await conn.rollback(); // undo everything if one insert fails
  console.error("Import failed, rolled back:", err.message);
} finally {
  conn.release(); // give the connection back to the pool
  await db.end(); // close the pool, or the script never stops
}
