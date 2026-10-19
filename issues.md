# Code review issues

Two full reviews of the project (server, client, database, Docker). Each issue has the
problem, the code, why it matters and how it was or can be fixed.

**Status key:** ✅ fixed · 🟡 open (accepted or needs a decision) · ⚪ not verified

| # | Issue | Area | Severity | Status |
|---|---|---|---|---|
| 1 | Error message leaked to the client | Server | High | ✅ |
| 2 | Stray files in the repo folder | Repo | Low | ✅ (`note.txt` kept) |
| 3 | MySQL exposed on all interfaces | Docker | Medium | ✅ |
| 4 | Cart line not limited by stock, silent cap | Server + client | Medium | ✅ |
| 5 | Admin pages stuck after one error | Client | Medium | ✅ |
| 6 | Password rule differs between client and server | Client + server | Medium | ✅ |
| 7 | Crash on a product with no variants | Client | Low | ✅ |
| 8 | Logout and session expiry handling | Client | Medium | ✅ |
| 9 | Product list URL edge cases | Client | Low | ✅ |
| 10 | LIKE wildcards in search text | Server | Low | ✅ |
| 11 | Order list had no paging | Server + client | Low | ✅ |
| 12 | Login limited per IP only | Server | Medium | ✅ |
| 13 | No DB check at startup, no graceful shutdown | Server | Medium | ✅ |
| 14 | No security headers, no `trust proxy` | Server | Medium | ✅ |
| 15 | nginx without gzip, cache or headers | Docker | Low | ✅ |
| 16 | Hardcoded DB password, password on command line | Docker | Low | ✅ |
| 17 | No tests | Project | Medium | ✅ |
| 18 | Small cosmetic problems | Mixed | Low | ✅ |
| 25 | Product list route still leaked `err.message` (missed by #1) | Server | Medium | ✅ |
| 26 | Checkout did not lock variant rows (price race with admin) | Server | Medium | ✅ |
| 27 | One sold-out line blocked the whole checkout | Server | Medium | ✅ |
| 19 | Rating average is updated incrementally | Server | Low | 🟡 |
| 20 | JWT cannot be revoked | Server | Low | 🟡 |
| 21 | Register reveals which emails exist | Server | Low | 🟡 |
| 22 | `LIKE '%…%'` cannot use an index | Server / DB | Low | 🟡 |
| 23 | API connects to MySQL as `root` | Docker | Low | 🟡 |
| 24 | Browser behaviour not checked | Client | — | ⚪ |

---

## ✅ Fixed

### 1. Error message leaked to the client
**File:** `server/src/routes/products.js` (product detail route)

```js
} catch (err) {
  return res.status(500).json({ error: err.message });   // BEFORE
}
```

**Problem:** `err.message` from MySQL can contain table names, column names or parts of the
SQL. Every other route sends errors to the shared error handler, which logs the details on
the server and answers with a generic message. This one route did not.

**Fix:**
```js
} catch (err) {
  next(err);   // errorHandler logs it and sends { error: "Internal server error" }
}
```

---

### 2. Stray files in the repo folder
**Files:** `server/cookies.txt`, `server/node`, `data/products.json:Zone.Identifier`,
`server/src/note.txt`

- `cookies.txt` held a real login JWT written by `curl -c` during testing.
- `server/node` was an empty file (a typo from a shell command).
- `Zone.Identifier` is a Windows download marker.
- `note.txt` holds personal study notes (30 KB).

All four are in `.gitignore`, so none were committed. Still, a token on disk is a bad habit.

**Fix:** deleted the first three. `note.txt` was **kept on purpose**; it is ignored by git.

---

### 3. MySQL exposed on all interfaces
**File:** `docker-compose.yml`

```yaml
ports:
  - "3306:3306"            # BEFORE: reachable from the whole network
```

**Problem:** with the default `root/root` login, anyone on the same network could connect.

**Fix:**
```yaml
ports:
  - "127.0.0.1:3306:3306"  # only this computer
```
The obsolete `version: '3.8'` line was removed at the same time.

---

### 4. Cart line not limited by stock, silent cap
**Files:** `server/src/routes/cart.js`, `client/src/pages/ProductDetailPage.jsx`

```js
// BEFORE: only the maximum of 10 was applied, stock was ignored
quantity = LEAST(cart_items.quantity + new.quantity, ?)   // param: MAX_PER_ITEM
res.status(201).json({ ok: true });                       // always "ok"
```

**Problem:**
1. A user could hold 10 of an item with 2 in stock (checkout refused it later with a 409).
2. When the cap was hit, the server said `ok` and the page said "Added to cart".
3. `PATCH` only limited the number to 10, not to stock.

**Fix:**
```js
const cap = Math.min(MAX_PER_ITEM, rows[0].stock_quantity);
const [existing] = await db.query(
  "SELECT quantity FROM cart_items WHERE user_id = ? AND variant_id = ?", [userId, variantId]);
const wanted = (existing[0]?.quantity ?? 0) + quantity;

await db.query(/* INSERT ... ON DUPLICATE KEY UPDATE quantity = LEAST(old + new, ?) */,
  [userId, variantId, Math.min(quantity, cap), cap]);

const [[line]] = await db.query("SELECT quantity FROM cart_items WHERE user_id = ? AND variant_id = ?", [userId, variantId]);
res.status(201).json({ ok: true, quantity: line.quantity, capped: line.quantity < wanted });
```
`PATCH` now uses `Math.min(quantity, stock_quantity)`. The product page shows
"Cart limit reached: you have N of this item" when `capped` is true.

**Note:** checkout still does the final atomic stock check
(`UPDATE ... WHERE stock_quantity >= ?`). The cart check is only for honest messages.

---

### 5. Admin pages stuck after one error
**Files:** `AdminProductsPage.jsx`, `AdminReviewsPage.jsx`, `AdminIncomePage.jsx`

```js
.catch((e) => !ignore && setError(e.message));   // BEFORE: error is never cleared
...
if (error) return <p className="text-red-600">{error}</p>;   // so this stays forever
```

**Problem:** one failed request (network blip, expired token) replaced the page with an
error message, even after changing page or search. Only a full reload helped. An expired
token also showed "Not logged in" instead of sending the user to the login page.

**Fix:** clear the error when a request succeeds, and redirect on 401:
```js
.then((d) => { if (ignore) return; setData(d); setError(""); })
.catch((e) => {
  if (ignore) return;
  if (e.status === 401) navigate("/login", { state: { from: "/admin/products" } });
  else setError(e.message);
});
```
(Clearing in the success handler, not at the start of the effect, keeps the
`react-hooks/set-state-in-effect` lint rule happy.)

---

### 6. Password rule differs between client and server
**Files:** `client/src/pages/RegisterPage.jsx`, `server/src/schemas/auth.js`

The label said "8 to 72 characters", the server accepted 6. The label was changed to
"6 to 72 characters" so both now match.

**If you want a stronger rule later:** change `.min(6)` to `.min(8)` in `registerSchema`
only. Do not touch the login schema: it must keep accepting short passwords of older
accounts.

---

### 7. Crash on a product with no variants
**File:** `client/src/pages/ProductDetailPage.jsx`

```js
setVariant(p.variants.find((v) => v.in_stock) ?? p.variants[0]);   // undefined if empty
...
variant.compare_at_price !== null   // TypeError
```

**Fix:** a guard before the page uses `variant`:
```jsx
if (!product || !variant) {
  return <main>...<p>This product is not available.</p>...</main>;
}
```
The imported data probably never has this, but the API allows it.

---

### 8. Logout and session expiry handling
**Files:** `client/src/context/AuthContext.jsx`, `client/src/api.js`

**Problems:**
- `logout()` had no `try/catch`: a network failure gave an unhandled rejection and the
  user stayed "logged in" on screen.
- After the 1-hour token ended, the header kept showing Cart, Orders and Admin until some
  page happened to get a 401. Each page handled 401 on its own.

**Fix:** `api.js` fires an event on any 401 (except `/me` and `/login`, where it is normal):
```js
if (res.status === 401 && !path.startsWith("/api/auth/me") && !path.startsWith("/api/auth/login")) {
  window.dispatchEvent(new Event("auth:expired"));
}
```
`AuthContext` listens and clears the user, so `RequireAuth` redirects to login. `logout()`
now clears the user even if the request fails.

---

### 9. Product list URL edge cases
**File:** `client/src/pages/ProductListPage.jsx`

- `?page=1.5` was sent to the server, which answered 400 and showed an error.
- A page past the last one showed "No products found" under "Page 5 of 3".

**Fix:**
```js
const rawPage = Number(searchParams.get("page"));
const page = Number.isInteger(rawPage) && rawPage >= 1 ? rawPage : 1;
```
plus a "There is nothing on page N. Go to the last page" message when `items` is empty but
`total > 0`.

---

### 10. LIKE wildcards in search text
**Files:** `server/src/routes/products.js`, `server/src/routes/admin.js`

```js
params.push(`%${search}%`);   // BEFORE: a search for "%" or "_" matched everything
```

**Fix:** new helper `server/src/utils/sql.js`
```js
export const escapeLike = (s) => s.replace(/[\\%_]/g, "\\$&");
```
used as `` `%${escapeLike(search)}%` ``. Check: searching `%` now returns the 5 products
that really contain `%` in the title. (This was never an SQL injection: values were
always parameterised.)

---

### 11. Order list had no paging
**Files:** `server/src/routes/orders.js`, `server/src/schemas/orders.js`,
`client/src/pages/OrdersPage.jsx`

The list was a hard `LIMIT 50` with no way to see older orders.

**Fix:** `GET /api/orders?page=&limit=` now answers
`{ items, total, page, totalPages }` (validated with Zod: `page >= 1`, `limit` 1..50,
default 10). The Orders page has a "Load more" button.
**This changes the response shape** (array → object), so any other client must be updated.

---

### 12. Login limited per IP only
**File:** `server/src/middleware/rateLimit.js`

An attacker with many IPs could try passwords for one account without limit.

**Fix:** a second limiter keyed by the (trimmed, lower-cased) email:
```js
export const loginAccountLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 10, skipSuccessfulRequests: true,
  keyGenerator: (req) => `login:${String(req.body?.email ?? "").trim().toLowerCase()}`,
  ...
});
```
Used in `routes/auth.js` after `loginLimiter`. **Side effect:** someone can lock a known
account for 15 minutes by failing 10 logins on purpose. That is the usual trade-off.

---

### 13. No DB check at startup, no graceful shutdown
**File:** `server/src/server.js`

The server started even if MySQL was down (the first request then failed), and was killed
in the middle of requests on `docker stop`.

**Fix:** `await pool.query("SELECT 1")` before `listen` (exit 1 with a clear message on
failure), and `SIGTERM`/`SIGINT` handlers that call `server.close()`, then `pool.end()`,
with a 10-second safety timeout. Measured: `docker stop` takes about 1.2 s.

---

### 14. No security headers, no `trust proxy`
**File:** `server/src/app.js`

- Added `helmet()` (`helmet@^8`): CSP, `X-Content-Type-Options`, `X-Frame-Options`, HSTS, ...
- Added **opt-in** proxy trust: `TRUST_PROXY=1` (number of proxies). It is **off by default**
  because trusting `X-Forwarded-For` with no proxy lets anyone fake their IP and bypass the
  rate limiters.

---

### 15. nginx without gzip, cache or headers
**File:** `client/nginx.conf`

Added gzip; `Cache-Control: public, max-age=31536000, immutable` for `/assets/` (Vite puts
a hash in the file name); `no-cache` for `index.html` (so users never keep an old app);
`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`.
nginx does not inherit `add_header` into a block that defines its own, so the security
headers are repeated inside `location /`.

---

### 16. Hardcoded DB password, password on command line
**File:** `docker-compose.yml`

- The healthcheck used `mysqladmin ping -proot` (password visible in the process list,
  plus a warning).
- `root` appeared in two places.

**Fix:** one setting for both services, default `root`:
```yaml
MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD:-root}     # mysql-db
DB_PASSWORD: ${MYSQL_ROOT_PASSWORD:-root}             # api
test: ["CMD-SHELL", "MYSQL_PWD=$$MYSQL_ROOT_PASSWORD mysqladmin ping -h 127.0.0.1 -uroot"]
```
**Important:** MySQL only reads the root password when the data volume is **empty**. An
existing volume keeps its old password, so changing the variable later has no effect on it.

---

### 17. No tests
**Files:** `server/test/api.test.js`, `server/package.json` (`npm test`)

17 integration tests (`node:test`) run against a throw-away database `ecommerce_test`
(created from `data/schema.sql`, dropped at the end). `DB_NAME` is set before the app is
imported, so the real `ecommerce` database is never touched.

They cover: register / login / cookie flags, 401 and 403, hidden stock number, the search
escape, cart caps, checkout rollback and success, empty-cart 400, paged orders, order
ownership, verified-purchase reviews, rating reset on review delete, and admin price/stock
updates.

**Run:** `cd server && npm test` (MySQL container must be up).
**Limits:** the register route allows 5 calls per hour per IP and the tests use 3, so do
not add many more register calls to the suite. There are no browser/UI tests.

---

### 18. Small cosmetic problems
- Two near-identical "sold-out" notes in `CartPage.jsx` → one left.
- A comment in `app.js` ("Before the routes. Without this, req.body is undefined.") sat
  above the auth router and described `express.json()` → removed.
- `api.js` sent `Content-Type: application/json` on every request, including GET and
  DELETE, which forces a CORS preflight for nothing → now only when there is a body.

---

### 25. Product list route still leaked `err.message`
**File:** `server/src/routes/products.js` (list route, `GET /api/products`)

```js
} catch (err) {
  return res.status(500).json({ error: err.message });   // BEFORE
}
```

**Problem:** #1 fixed only the detail route. The list route still sent raw MySQL messages
(table names, column names, SQL fragments) to the client.

**Fix:** `next(err);` so the error handler logs it and answers with a generic 500.

---

### 26. Checkout did not lock variant rows
**File:** `server/src/routes/checkout.js`

**Problem:** `FOR UPDATE OF ci` locked only the cart rows. The price was read from
`product_variants` without a lock, so an admin `PATCH /variants/:id` between the read and the
commit could make the order record (and charge) the old price.

**Fix:** `FOR UPDATE OF ci, v`. Rows are still locked in `ORDER BY ci.variant_id` order, and
the admin PATCH locks a single variant row, so no new deadlock pattern.

---

### 27. One sold-out line blocked the whole checkout
**File:** `server/src/routes/checkout.js`

**Problem:** `GET /cart` leaves sold-out lines out of its total, but `POST /checkout` tried to
buy every line and returned 409 on the first sold-out one. The customer saw a total that
checkout then refused.

**Fix:** checkout now buys only lines with `stock_quantity > 0` (reliable, since the rows are
locked). Sold-out lines stay in the cart and only the bought lines are deleted. If every line
is sold out the answer is 409 `All items in your cart are sold out`. A line whose quantity is
above the remaining stock still gives the 409 `Not enough stock: <title>`.
The client needed no change: `CartPage` already shows the sold-out lines and refreshes the cart.

**Tests:** `server/test/api.test.js` was updated (19 tests, all pass). The old
"not enough stock" test used a sold-out line to force the 409; it now uses a line whose
quantity is above the remaining stock. A new test covers a cart with only sold-out lines
(409, cart kept, no order). A last test covers a mixed cart (sold-out line skipped and kept, the rest bought and charged).

---

## 🟡 Open

### 19. Rating average is updated incrementally
**Files:** `server/src/routes/reviews.js` (POST), `server/src/routes/admin.js` (DELETE)

```js
const newAvg = Math.round(((oldAvg * oldCount + rating) / newCount) * 100) / 100;
```

**Problem:** every update rounds to 2 decimals and builds on the rounded value, so the
average can drift a little over many reviews. The admin delete needs a clamp
(`Math.min(5, Math.max(1, ...))`) because rounding can push the result out of 1..5.

**Why it is still open:** the imported products have ratings (`rating`, `rating_count`)
but **no rows in `reviews`**. Recomputing with `AVG(rating)` over `reviews` would throw the
imported ratings away. Decision taken: keep this approach.

**If you want it exact later:** add `rating_sum INT NOT NULL DEFAULT 0` to `products`,
fill it once with `ROUND(rating * rating_count)`, then on each change update
`rating_sum` and `rating_count` and compute `rating = ROUND(rating_sum / rating_count, 2)`.
This needs a migration of the live database.

---

### 20. JWT cannot be revoked
**Files:** `server/src/utils/token.js`, `server/src/routes/auth.js`

Logout only clears the cookie. A copied token stays valid until it expires (1 hour). The
role is read from the database on every request, so a demoted admin loses power at once,
but a password change (there is no such feature yet) would not end old sessions.

**Fix if needed:** add `token_version INT NOT NULL DEFAULT 0` to `users`, put it in the
token (`new SignJWT({ v: user.token_version })`), compare it in `requireAuth`, and
increment it on logout-everywhere or password change. Needs a migration. With a 1-hour
lifetime this was judged acceptable.

---

### 21. Register reveals which emails exist
**File:** `server/src/routes/auth.js`

```js
if (err.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "Email is already registered" });
```

Anyone can test whether an email has an account. Login is already protected against this
(same message, same timing).

**Fix if needed:** answer 201 for every register and send an email ("you already have an
account" or "confirm your address"). That needs an email service, so it is a product
decision. The register limiter (5 per hour per IP) slows down mass checks.

---

### 22. `LIKE '%…%'` cannot use an index
**File:** `server/src/routes/products.js`

A leading `%` forces a scan of every row. About 2,000 products is fine.

**Fix when the catalog grows:**
```sql
ALTER TABLE products ADD FULLTEXT INDEX ft_products_title (title);
-- WHERE MATCH(title) AGAINST (? IN BOOLEAN MODE)
```
Note that FULLTEXT matches whole words (and minimum word length applies), so results
differ from substring search.

---

### 23. API connects to MySQL as `root`
**File:** `docker-compose.yml`

The app has full rights on the server. Better: a user that only owns the `ecommerce`
database.
```sql
CREATE USER 'shop'@'%' IDENTIFIED BY '...';
GRANT SELECT, INSERT, UPDATE, DELETE ON ecommerce.* TO 'shop'@'%';
```
and `DB_USER=shop` for the API. Schema changes (`schema.sql`) still run as root.
Not done because it needs the user to exist in the existing volume.

---

## ⚪ Not verified

### 24. Browser behaviour
Everything was tested with `curl` and the test suite, **not** in a real browser:
- `helmet` sends `Cross-Origin-Resource-Policy: same-origin`. This should not affect
  CORS `fetch` calls from `http://localhost:5174` (preflight and CORS headers look right
  in `curl`), but click through login, cart and checkout once. If something is blocked,
  set `helmet({ crossOriginResourcePolicy: { policy: "cross-site" } })`.
- Untested in the UI: "Load more" on Orders, the logout-on-401 behaviour, the
  "Go to the last page" link, the admin 401 redirect.
- Cookies: the client (`:5174`) and the API (`:3000`) are on the same site (`localhost`), so
  `sameSite: "lax"` works. If you deploy them on **different domains**, the login cookie
  will not be sent; put both behind one domain (reverse proxy) or change the cookie
  settings.

---

## Checked and fine (no action)
- All SQL uses parameters; the sort and the `SET` column list come from fixed whitelists.
- Checkout: one transaction, row locks in a fixed order, atomic stock check, DB prices,
  `unit_price` copied to the order line.
- Orders are filtered by `user_id`; admin routes sit behind `requireAuth` + `requireAdmin`.
- JWT algorithm is pinned, secret length is checked at startup, role read from the DB.
- Reviews and admin pages render text through React (no `dangerouslySetInnerHTML`).
- `schema.sql`: stock/quantity/rating `CHECK`s, `UNIQUE(user_id, product_id)`, no cascade
  on orders; foreign keys create the needed indexes.
