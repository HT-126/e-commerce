// Integration tests. Run: npm test  (needs the MySQL container from docker-compose.yml)
//
// Safety: the tests use their OWN database, "ecommerce_test". It is created from
// data/schema.sql at the start and dropped at the end. The real "ecommerce" database
// is never touched, because DB_NAME is set here BEFORE the app is imported.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";
import bcrypt from "bcrypt";

const TEST_DB = "ecommerce_test";
process.env.DB_NAME = TEST_DB;
process.env.DB_HOST ??= "127.0.0.1";
process.env.DB_USER ??= "root";
process.env.DB_PASSWORD ??= "root";
process.env.JWT_SECRET ??= "test-secret-test-secret-test-secret-123456";

const here = path.dirname(fileURLToPath(import.meta.url));
const schemaSql = fs.readFileSync(path.join(here, "../../data/schema.sql"), "utf8");

let admin; // direct connection used for setup and for checking the database
let server;
let pool;
let base;
const ids = {}; // ids of the seeded rows

before(async () => {
  admin = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    multipleStatements: true,
  });
  await admin.query(`DROP DATABASE IF EXISTS ${TEST_DB}`);
  await admin.query(`CREATE DATABASE ${TEST_DB}`);
  await admin.query(`USE ${TEST_DB}`);
  await admin.query(schemaSql);

  // One product with two variants: plenty of stock (20) and almost none (1)
  await admin.query("INSERT INTO categories (id, name) VALUES (1, 'Test')");
  await admin.query(
    `INSERT INTO products (id, handle, title, description, price_min, category_id)
     VALUES (1, 'test-product', 'Test product', 'desc', 10.00, 1)`,
  );
  await admin.query(
    `INSERT INTO product_variants (id, product_id, sku, color, size, price, stock_quantity) VALUES
     (1, 1, 'SKU-BIG', 'Red', 'M', 10.00, 20),
     (2, 1, 'SKU-ONE', 'Red', 'L', 12.50, 1)`,
  );
  ids.big = 1;
  ids.one = 2;

  // A second user with the admin role (made directly in the database)
  const hash = await bcrypt.hash("adminpass123", 4);
  await admin.query(
    "INSERT INTO users (email, password_hash, role) VALUES ('admin@test.com', ?, 'admin')",
    [hash],
  );

  // Import AFTER the env is set, so the app connects to the test database
  const { default: app } = await import("../src/app.js");
  ({ pool } = await import("../src/config/db.js"));
  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server?.close(resolve));
  await pool?.end();
  if (admin) {
    await admin.query(`DROP DATABASE IF EXISTS ${TEST_DB}`);
    await admin.end();
  }
});

// Small fetch helper. `cookie` is the "token=..." string of a logged-in user.
async function api(method, url, { body, cookie } = {}) {
  const res = await fetch(base + url, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data, res };
}

async function login(email, password) {
  const r = await api("POST", "/api/auth/login", { body: { email, password } });
  const cookie = r.res.headers.getSetCookie()[0]?.split(";")[0];
  return { ...r, cookie };
}

const stockOf = async (variantId) =>
  (await admin.query("SELECT stock_quantity s FROM product_variants WHERE id = ?", [variantId]))[0][0].s;

let customer; // cookie of the customer, filled by the auth tests
let adminCookie;
let orderId;

// ---------- auth ----------

test("register: rejects a short password with 400", async () => {
  const r = await api("POST", "/api/auth/register", {
    body: { email: "buyer@test.com", password: "12345" },
  });
  assert.equal(r.status, 400);
});

test("register: creates a customer, and a second time gives 409", async () => {
  const body = { email: "Buyer@Test.com", password: "buyer-pass-1" };
  const ok = await api("POST", "/api/auth/register", { body });
  assert.equal(ok.status, 201);
  assert.equal(ok.data.email, "buyer@test.com"); // email is lower-cased
  const dup = await api("POST", "/api/auth/register", { body });
  assert.equal(dup.status, 409);
});

test("login: wrong password gives 401, right password sets an httpOnly cookie", async () => {
  const bad = await login("buyer@test.com", "wrong-password");
  assert.equal(bad.status, 401);

  const ok = await login("buyer@test.com", "buyer-pass-1");
  assert.equal(ok.status, 200);
  assert.equal(ok.data.role, "customer");
  assert.match(ok.res.headers.getSetCookie()[0], /HttpOnly/i);
  customer = ok.cookie;

  adminCookie = (await login("admin@test.com", "adminpass123")).cookie;
  assert.ok(adminCookie);
});

test("protected routes: 401 without a cookie, 403 for a customer on admin routes", async () => {
  assert.equal((await api("GET", "/api/cart")).status, 401);
  assert.equal((await api("GET", "/api/admin/stats")).status, 401);
  assert.equal((await api("GET", "/api/admin/stats", { cookie: customer })).status, 403);
  assert.equal((await api("GET", "/api/admin/stats", { cookie: adminCookie })).status, 200);
});

// ---------- products ----------

test("product detail: hides the real stock number, unknown handle is 404", async () => {
  const ok = await api("GET", "/api/products/test-product");
  assert.equal(ok.status, 200);
  assert.equal(ok.data.variants[0].in_stock, true);
  assert.equal("stock_quantity" in ok.data.variants[0], false);
  assert.equal((await api("GET", "/api/products/nope")).status, 404);
});

test("product search: % and _ are normal characters, not wildcards", async () => {
  const all = await api("GET", "/api/products?search=Test");
  assert.equal(all.data.total, 1);
  for (const s of ["%25", "_", "T%25t"]) {
    const r = await api("GET", `/api/products?search=${s}`);
    assert.equal(r.data.total, 0, `search "${s}" must not match everything`);
  }
});

// ---------- cart ----------

test("cart: a line is capped at 10 and the answer says so", async () => {
  const add = (quantity) =>
    api("POST", "/api/cart", { cookie: customer, body: { variantId: ids.big, quantity } });

  assert.deepEqual((await add(4)).data, { ok: true, quantity: 4, capped: false });
  assert.deepEqual((await add(4)).data, { ok: true, quantity: 8, capped: false });
  assert.deepEqual((await add(4)).data, { ok: true, quantity: 10, capped: true });
});

test("cart: a line is capped by the stock too", async () => {
  const r = await api("POST", "/api/cart", {
    cookie: customer,
    body: { variantId: ids.one, quantity: 5 }, // only 1 in stock
  });
  assert.equal(r.status, 201);
  assert.equal(r.data.quantity, 1);
  assert.equal(r.data.capped, true);

  const patch = await api("PATCH", `/api/cart/${ids.one}`, {
    cookie: customer,
    body: { quantity: 9 },
  });
  assert.equal(patch.data.quantity, 1);
});

test("cart: unknown variant is 404, bad body is 400", async () => {
  const missing = await api("POST", "/api/cart", {
    cookie: customer,
    body: { variantId: 9999, quantity: 1 },
  });
  assert.equal(missing.status, 404);
  const bad = await api("POST", "/api/cart", {
    cookie: customer,
    body: { variantId: ids.big, quantity: 99 },
  });
  assert.equal(bad.status, 400);
});

// ---------- checkout ----------

test("checkout: not enough stock gives 409 and changes nothing", async () => {
  // 10 of "big" are in the cart, but only 5 are left (still in stock, so not skipped)
  const before = await stockOf(ids.big);
  await admin.query("UPDATE product_variants SET stock_quantity = 5 WHERE id = ?", [ids.big]);

  const r = await api("POST", "/api/checkout", { cookie: customer });
  assert.equal(r.status, 409);
  assert.equal(await stockOf(ids.big), 5); // the whole transaction was undone
  assert.equal(await stockOf(ids.one), 1);
  const [[{ n }]] = await admin.query("SELECT COUNT(*) n FROM orders");
  assert.equal(n, 0);

  await admin.query("UPDATE product_variants SET stock_quantity = ? WHERE id = ?", [before, ids.big]);
});

test("checkout: a cart with only sold-out lines is 409 and keeps the cart", async () => {
  await admin.query("UPDATE product_variants SET stock_quantity = 0 WHERE id = ?", [ids.one]);
  await admin.query("DELETE FROM cart_items WHERE variant_id = ?", [ids.big]);

  const r = await api("POST", "/api/checkout", { cookie: customer });
  assert.equal(r.status, 409);
  const [[{ n }]] = await admin.query("SELECT COUNT(*) n FROM cart_items");
  assert.equal(n, 1); // the sold-out line stays so the customer can remove it
  const [[{ orders }]] = await admin.query("SELECT COUNT(*) orders FROM orders");
  assert.equal(orders, 0);

  // restore the cart for the next test
  await admin.query("UPDATE product_variants SET stock_quantity = 1 WHERE id = ?", [ids.one]);
  await api("POST", "/api/cart", { cookie: customer, body: { variantId: ids.big, quantity: 10 } });
});

test("checkout: takes stock, uses the database price, empties the cart", async () => {
  const r = await api("POST", "/api/checkout", { cookie: customer });
  assert.equal(r.status, 201);
  orderId = r.data.orderId;
  assert.equal(r.data.total, 112.5); // 10 x 10.00 + 1 x 12.50

  assert.equal(await stockOf(ids.big), 10);
  assert.equal(await stockOf(ids.one), 0);

  const [[{ n }]] = await admin.query("SELECT COUNT(*) n FROM cart_items");
  assert.equal(n, 0);
});

test("checkout: an empty cart is 400 (no double order)", async () => {
  const r = await api("POST", "/api/checkout", { cookie: customer });
  assert.equal(r.status, 400);
});

// ---------- orders and reviews ----------

test("orders: the list is paged", async () => {
  const r = await api("GET", "/api/orders?limit=1", { cookie: customer });
  assert.equal(r.status, 200);
  assert.equal(r.data.items.length, 1);
  assert.equal(r.data.total, 1);
  assert.equal(r.data.totalPages, 1);
  assert.equal((await api("GET", "/api/orders?page=0", { cookie: customer })).status, 400);
});

test("orders: the owner sees the order, another user gets 404", async () => {
  const mine = await api("GET", `/api/orders/${orderId}`, { cookie: customer });
  assert.equal(mine.status, 200);
  assert.equal(mine.data.items.length, 2);

  const other = await api("GET", `/api/orders/${orderId}`, { cookie: adminCookie });
  assert.equal(other.status, 404);
});

test("reviews: only buyers can review, once, and the rating is updated", async () => {
  const review = (cookie, rating) =>
    api("POST", "/api/products/test-product/reviews", { cookie, body: { rating, comment: "ok" } });

  assert.equal((await review(adminCookie, 5)).status, 403); // never bought it

  const first = await review(customer, 4);
  assert.equal(first.status, 201);
  assert.deepEqual(first.data, { rating: 4, ratingCount: 1 });

  assert.equal((await review(customer, 5)).status, 409); // one review per product
});

test("admin: deleting a review resets the product rating", async () => {
  const [[{ id }]] = await admin.query("SELECT id FROM reviews LIMIT 1");
  const r = await api("DELETE", `/api/admin/reviews/${id}`, { cookie: adminCookie });
  assert.equal(r.status, 200);
  assert.deepEqual(r.data, { rating: null, ratingCount: 0 });
});

test("admin: price and stock update keeps price_min in sync", async () => {
  const r = await api("PATCH", `/api/admin/variants/${ids.big}`, {
    cookie: adminCookie,
    body: { price: 8, stockQuantity: 50 },
  });
  assert.equal(r.status, 200);
  const [[p]] = await admin.query("SELECT price_min FROM products WHERE id = 1");
  assert.equal(Number(p.price_min), 8);
  assert.equal(await stockOf(ids.big), 50);

  // a discount price must be higher than the price
  const bad = await api("PATCH", `/api/admin/variants/${ids.big}`, {
    cookie: adminCookie,
    body: { compareAtPrice: 5 },
  });
  assert.equal(bad.status, 400);
});

// Runs last on purpose: it adds a second order, which the order tests above do not expect.
test("checkout: a sold-out line is skipped and stays in the cart, the rest is bought", async () => {
  await admin.query("UPDATE product_variants SET stock_quantity = 3 WHERE id = ?", [ids.one]);
  const add = (variantId, quantity) =>
    api("POST", "/api/cart", { cookie: customer, body: { variantId, quantity } });
  assert.equal((await add(ids.one, 2)).status, 201);
  assert.equal((await add(ids.big, 1)).status, 201);
  // "big" sells out after it was put in the cart
  await admin.query("UPDATE product_variants SET stock_quantity = 0 WHERE id = ?", [ids.big]);

  const r = await api("POST", "/api/checkout", { cookie: customer });
  assert.equal(r.status, 201);
  assert.equal(r.data.total, 25); // 2 x 12.50, the sold-out line is not charged

  const [lines] = await admin.query("SELECT variant_id, quantity FROM order_items WHERE order_id = ?", [
    r.data.orderId,
  ]);
  assert.deepEqual(lines, [{ variant_id: ids.one, quantity: 2 }]);
  assert.equal(await stockOf(ids.one), 1);
  assert.equal(await stockOf(ids.big), 0); // untouched, not driven negative

  const cart = await api("GET", "/api/cart", { cookie: customer });
  assert.equal(cart.data.items.length, 1);
  assert.equal(cart.data.items[0].variantId, ids.big);
  assert.equal(cart.data.items[0].soldOut, true);
});

// ---------- admin: add and delete a product ----------

test("admin: add a product, with a unique handle and SKU, and only for admins", async () => {
  const body = (title, sku) => ({
    title,
    description: "A new thing",
    categoryId: 1,
    imageUrl: "https://example.com/new.jpg",
    variants: [{ sku, color: "Blue", size: "S", price: 20, stockQuantity: 5 }],
  });
  const post = (b, cookie = adminCookie) => api("POST", "/api/admin/products", { cookie, body: b });

  assert.equal((await post(body("New Thing", "NT-1"), customer)).status, 403);

  const created = await post(body("New Thing", "NT-1"));
  assert.equal(created.status, 201);
  assert.equal(created.data.handle, "new-thing");

  const shown = await api("GET", "/api/products/new-thing");
  assert.equal(shown.status, 200);
  assert.equal(shown.data.variants[0].in_stock, true);
  assert.equal(shown.data.images.length, 1);
  const [[p]] = await admin.query("SELECT price_min FROM products WHERE handle = 'new-thing'");
  assert.equal(Number(p.price_min), 20);

  // same title again: the handle gets a number. Same SKU again: 409.
  assert.equal((await post(body("New Thing", "NT-2"))).data.handle, "new-thing-2");
  assert.equal((await post(body("Other", "NT-1"))).status, 409);

  // bad input: unknown category, discount not above price, no variants
  assert.equal((await post({ ...body("X", "X-1"), categoryId: 999 })).status, 400);
  const badDiscount = body("X", "X-1");
  badDiscount.variants[0].compareAtPrice = 10;
  assert.equal((await post(badDiscount)).status, 400);
  assert.equal((await post({ ...body("X", "X-1"), variants: [] })).status, 400);
});

test("admin: delete a product removes it from carts; an ordered product cannot be deleted", async () => {
  const [[{ id }]] = await admin.query("SELECT id FROM products WHERE handle = 'new-thing'");
  const [[{ vid }]] = await admin.query("SELECT id AS vid FROM product_variants WHERE sku = 'NT-1'");
  assert.equal(
    (await api("POST", "/api/cart", { cookie: customer, body: { variantId: vid, quantity: 1 } })).status,
    201,
  );

  const del = await api("DELETE", `/api/admin/products/${id}`, { cookie: adminCookie });
  assert.equal(del.status, 200);
  assert.equal((await api("GET", "/api/products/new-thing")).status, 404);
  const [[{ n }]] = await admin.query("SELECT COUNT(*) n FROM cart_items WHERE variant_id = ?", [vid]);
  assert.equal(n, 0);
  assert.equal((await api("DELETE", `/api/admin/products/${id}`, { cookie: adminCookie })).status, 404);

  // product 1 was bought in the checkout tests
  const ordered = await api("DELETE", "/api/admin/products/1", { cookie: adminCookie });
  assert.equal(ordered.status, 409);
  assert.equal((await api("GET", "/api/products/test-product")).status, 200);
});
