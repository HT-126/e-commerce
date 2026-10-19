# E-Commerce

A full-stack online shop: browse a ~2,000-product catalog, keep a cart, check out, leave reviews, and run the store from an admin dashboard. React + Express + MySQL, runs fully in Docker.

**Quick links:** [Features](#features) · [Tech stack](#tech-stack) · [How it works](#how-it-works) · [Project structure](#project-structure) · [Database](#database) · [API](#api) · [Getting started](#getting-started) · [Scripts](#scripts) · [Ports](#ports) · [Common problems](#common-problems) · [Tests and checks](#tests-and-checks) · [Design decisions](#design-decisions) · [Security notes](#security-notes) · [Data source](#data-source) · [Known gaps](#known-gaps)

---

## Features

**Browsing**
- Product list with search, category filter (a category includes all its sub-categories), price range, sorting (rating / price) and paging
- Category menu that opens level by level on hover
- Product page: image gallery, color / size picker, sale price and discount, "Sold out" variants that cannot be added to the cart
- Reviews with 1–5 stars (one per user per product, only for customers who bought it)

**Accounts and shopping**
- Register, log in, log out (show / hide password)
- Cart with quantity limits (max 10 per line and never more than the stock), a badge with the item count on the cart icon
- Checkout and order history with order detail pages
- Toast messages, loading skeletons and empty states

**Admin** (`/admin`, role `admin` only)
- Orders overview and income statistics (revenue, best sellers, daily chart)
- Products: add a product with its variants, change price / compare price / stock, delete a product (not possible once it has been ordered)
- Review moderation (delete a review, the product rating is recalculated)

---

## Tech stack

| Part | What it uses |
|---|---|
| Frontend | React 19, Vite, React Router 7, Tailwind CSS 4 |
| Backend | Node.js 22, Express 5, `mysql2` (connection pool), Zod |
| Database | MySQL 8 |
| Auth | JWT (`jose`) in an `httpOnly` cookie, passwords hashed with `bcrypt` |
| Security | `helmet`, `cors`, `express-rate-limit` |
| Infra | Docker Compose: MySQL + API + client (nginx) |
| Tests | `node:test` integration tests against a throw-away database |

---

## How it works

```
Browser (React SPA)                         nginx :5174
   │  fetch(..., credentials: "include")
   ▼
Express API :3000
   route  ──►  controller  ──►  service  ──►  MySQL :3306
   (URL +      (HTTP in/out)    (rules + SQL)
    middleware)
```

- **Layers:** routes only wire a URL to middleware (auth, Zod validation, rate limits). Controllers read `req.validated` / `req.user` and send the response. Services hold the business rules and SQL and know nothing about `req` / `res`.
- **Errors:** services throw `HttpError(status, message, extra?)` for expected failures (404, 409, ...). `errorHandler` turns it into `{ error, ...extra }`. Anything else is logged on the server and answered with a generic 500. Controllers need no `try/catch` (Express 5 forwards rejected promises).
- **Transactions:** `withTransaction(fn)` commits when `fn` returns, rolls back when it throws, and always releases the connection. Used by checkout, review create / delete and the admin product and variant changes.
- **Login:** `POST /api/auth/login` sets an `httpOnly` cookie holding a 1-hour JWT. The token contains only the user id; the role is read from the database on every request, so a demoted admin loses power at once. The React app asks `GET /api/auth/me` on load to know who is logged in.
- **Cart and prices:** the browser sends only `{ variantId, quantity }`. Prices and stock always come from the database.
- **Client data loading:** the `useFetch` hook loads data per key and drops answers from old requests. Auth, cart count and toasts are small React contexts.

---

## Project structure

```
e-commerce/
├── client/                    # React SPA (Vite)
│   └── src/
│       ├── pages/             # Route pages (+ pages/admin)
│       ├── components/        # Header, CategoryNav, ProductCard, Skeleton, EmptyState, ...
│       ├── context/           # Auth, Cart (badge), Toast
│       ├── hooks/             # useFetch
│       └── api.js             # fetch wrapper (credentials: include)
├── server/
│   ├── src/
│   │   ├── routes/            # URL + middleware wiring only
│   │   ├── controllers/       # HTTP layer
│   │   ├── services/          # business logic + SQL
│   │   ├── middleware/        # auth, validate (Zod), rateLimit, errorHandler
│   │   ├── schemas/           # Zod schemas for request input and import rows
│   │   ├── utils/             # token, sql, slug, httpError, transaction
│   │   ├── scripts/           # importProducts.js (data import)
│   │   └── config/db.js       # MySQL connection pool
│   └── test/api.test.js       # integration tests
├── data/
│   ├── products.json          # source catalog (imported into MySQL)
│   └── schema.sql             # database schema
└── docker-compose.yml         # MySQL 8 + API + client
```

---

## Database

| Table | Contents |
|---|---|
| `categories` | Category tree (`parent_id`, unique per parent + name) |
| `products` | Handle (URL name), title, description, `price_min`, rating, rating count, category |
| `product_images` | Gallery images with a position |
| `product_variants` | Sellable items: SKU, color, size, price, compare-at price, stock |
| `users` | Email, bcrypt hash, role (`customer` / `admin`) |
| `cart_items` | One row per user + variant |
| `orders`, `order_items` | Orders; each line keeps the price paid (`unit_price`) |
| `reviews` | One per user per product, rating 1–5, optional comment |

- Money is `DECIMAL(10,2)`, never float. `products.price_min` is a copy of the lowest variant price and is kept in sync on price changes.
- `CHECK` constraints keep stock, quantity and ratings in range. Orders cannot be cascade-deleted with users, and variants that were sold cannot be deleted.
- `data/schema.sql` begins with `DROP TABLE IF EXISTS ...`. Docker loads it only on an **empty** data volume. Running it by hand resets the database.

**Import rules** (`importProducts.js`)
- Every product is validated with Zod; invalid rows are skipped and logged to `data/import_skipped.json`.
- The category tree is built first and cached by the full path (names like `Shorts` exist under several parents).
- Everything is inserted in **one transaction**: a failure leaves the database untouched.
- The source data has no inventory, so each in-stock variant gets an invented stock of **20** (`DEMO_STOCK`); sold-out variants get 0.

---

## API

| Area | Endpoints |
|---|---|
| Health | `GET /api/health` |
| Products | `GET /api/products` (query: `search`, `category`, `minPrice`, `maxPrice`, `minRating`, `sort`: `rating_desc` (default), `reviews_desc`, `newest`, `price_asc`, `price_desc`, `name_asc`, `name_desc`; `page`, `limit`), `GET /api/products/:handle` |
| Categories | `GET /api/categories` |
| Reviews | `GET /api/products/:handle/reviews`, `POST /api/products/:handle/reviews` *(login, buyers only)* |
| Auth | `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout` |
| Cart *(login)* | `GET /api/cart`, `POST /api/cart`, `PATCH /api/cart/:variantId`, `DELETE /api/cart/:variantId` |
| Checkout *(login)* | `POST /api/checkout` → `201 { orderId, total }` · `400` empty cart · `409` all lines sold out or not enough stock |
| Orders *(login)* | `GET /api/orders` (`page`, `limit`), `GET /api/orders/:id` |
| Admin *(admin)* | `GET /api/admin/stats` (`days`: 1–365 or `all`), `GET /api/admin/orders`, `GET /api/admin/variants`, `PATCH /api/admin/variants/:id`, `POST /api/admin/products`, `DELETE /api/admin/products/:id`, `GET /api/admin/reviews`, `DELETE /api/admin/reviews/:id` |

Errors always look like `{ "error": "message" }`. Validation errors (`400`) also carry `detail: [{ field, message }]`.

```bash
# Search dresses under $50, cheapest first
curl "http://localhost:3000/api/products?search=dress&maxPrice=50&sort=price_asc"

# Log in and keep the cookie, then read the cart
curl -c cookies.txt -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"secret123"}' http://localhost:3000/api/auth/login
curl -b cookies.txt http://localhost:3000/api/cart
```

---

## Getting started

### Option A: everything in Docker (recommended)

Requires Docker with Compose v2.

```bash
# 1a. Database passwords: copy the example, then set BOTH passwords (compose refuses to start without them)
cp .env.example .env
# 1b. API settings: copy the example, then set JWT_SECRET (min. 32 characters)
cp server/.env.example server/.env
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"   # a good secret

# 2. Build and start MySQL, API and client (tables are created on a new database)
docker compose up -d --build

# 3. Import the catalog ONCE (the API image has no data/, so run this on your machine)
cd server && npm install
DB_HOST=127.0.0.1 node src/scripts/importProducts.js
cd ..

# 4. Check
curl http://localhost:3000/api/health      # {"status":"ok","db":1}
```

Open http://localhost:5174, register an account, then [make it an admin](#create-an-admin-user).

| Task | Command |
|---|---|
| Start / stop (keeps data) | `docker compose up -d` / `docker compose down` |
| Logs | `docker compose logs -f api` (or `client`, `mysql-db`) |
| After changing **server** code | `docker compose up -d --build api` |
| After changing **client** code | `docker compose up -d --build client` |
| Reset everything (deletes the database!) | `docker compose down -v`, then repeat the first run |

Images contain a copy of the code made at build time, so a code change needs the `--build` command. `VITE_API_URL` is baked into the client at build time (`build.args` in the compose file).

### Option B: local development

Requires Node.js 20+ and Docker (for MySQL) or any local MySQL 8.

```bash
# 1. Database only (needs the .env with both passwords, see Option A)
docker compose up -d mysql-db
docker exec -i ecommerce_mysql mysql -uroot -p ecommerce < data/schema.sql   # only if the volume is not new

# 2. Server (http://localhost:3000)
cd server
cp .env.example .env          # then set JWT_SECRET
npm install
node src/scripts/importProducts.js
npm run dev

# 3. Client (http://localhost:5173), in another terminal
cd client
cp .env.example .env          # optional, defaults to http://localhost:3000
npm install
npm run dev
```

Do not run the Docker `api` and `npm run dev` at the same time: both use port 3000.

### Create an admin user

Register a normal account in the UI, then promote it:

```bash
docker exec -i ecommerce_mysql mysql -uroot -p ecommerce \
  -e "UPDATE users SET role='admin' WHERE email='you@example.com';"
```

Log in again and open `/admin`.

### Environment variables

**server/.env**

| Variable | Description |
|---|---|
| `PORT` | API port (default `3000`) |
| `CLIENT_ORIGIN` | Allowed CORS origin (default `http://localhost:5173`) |
| `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | MySQL connection |
| `JWT_SECRET` | Token signing secret, **min. 32 characters** (the server refuses to start otherwise) |
| `TRUST_PROXY` | Optional. Number of reverse proxies in front of the API (e.g. `1`). Leave unset when there is none: trusting `X-Forwarded-For` without a proxy lets anyone fake their IP and bypass the rate limiters. |

In Docker, `DB_*` and `CLIENT_ORIGIN` are set in `docker-compose.yml` and override `server/.env`; only `JWT_SECRET` is read from the file.

**.env** (next to `docker-compose.yml`, used by Docker; copy `.env.example`)

| Variable | Description |
|---|---|
| `MYSQL_ROOT_PASSWORD` | MySQL root password. Used for setup, the import script and the tests. **Required.** |
| `MYSQL_APP_PASSWORD` | Password of the limited `shop` user (rights only on the `ecommerce` database) that the API uses. **Required.** |

Both are read by MySQL only when the data volume is **empty**. For the local import script and the tests, `DB_PASSWORD` in `server/.env` must be the root password.

**Existing database from an older version** (volume created with `root`/`root`): the `shop` user does not exist yet. Put `MYSQL_ROOT_PASSWORD=root` (your old password) and a new `MYSQL_APP_PASSWORD` in `.env`, then create the user once:

```bash
docker compose up -d mysql-db
docker exec -i ecommerce_mysql mysql -uroot -p ecommerce -e \
  "CREATE USER IF NOT EXISTS 'shop'@'%' IDENTIFIED BY 'YOUR_APP_PASSWORD'; GRANT ALL ON ecommerce.* TO 'shop'@'%';"
docker compose up -d --build
```

**client/.env**: `VITE_API_URL`, the API base URL (default `http://localhost:3000`).

---

## Scripts

| Where | Command | Purpose |
|---|---|---|
| server | `npm run dev` | Start the API with auto-reload |
| server | `node src/scripts/importProducts.js` | Import the catalog |
| server | `npm test` | Integration tests |
| client | `npm run dev` | Vite dev server |
| client | `npm run build` | Production build |
| client | `npm run lint` | ESLint |

---

## Ports

| Service | Port | Notes |
|---|---|---|
| Client (nginx, Docker) | 5174 | not 5173, so it does not clash with the Vite dev server; if you change it, change `CLIENT_ORIGIN` too |
| Client (Vite dev) | 5173 | |
| API | 3000 | `/api/health` |
| MySQL | 3306 | bound to `127.0.0.1`, only reachable from your machine |

In Docker, all three published ports are bound to `127.0.0.1`. To share the app on your network, remove the `127.0.0.1:` prefix from `ports:` in `docker-compose.yml`.

---

## Common problems

| Problem | Cause and fix |
|---|---|
| `JWT_SECRET is missing or too short` | Set `JWT_SECRET` (32+ characters) in `server/.env` |
| `Cannot connect to the database` | MySQL is not running or not healthy yet: `docker compose ps`, then `docker compose logs mysql-db` |
| `required variable MYSQL_ROOT_PASSWORD is missing` | Create the `.env` file next to `docker-compose.yml` (`cp .env.example .env`) and set both passwords |
| API says `Access denied for user 'shop'` | The volume is older than the `shop` user: see "Existing database from an older version" above |
| Changed the root password but login to MySQL fails | MySQL reads the password only when the data volume is empty. Use `docker compose down -v` (deletes data) |
| Product list is empty | The catalog was not imported yet: run the import script (step 3 of Option A) |
| Port 3000 already in use | The Docker `api` and `npm run dev` are both running; stop one |
| Logged in, but every request says "Not logged in" | The cookie is not sent. Open the client on the same site as the API (`localhost`), and note the cookie is `Secure` when `NODE_ENV=production` (Docker); use Chrome or Firefox on `http://localhost` |
| CORS error in the browser | `CLIENT_ORIGIN` must equal the exact address in the address bar |
| `Too many attempts` (429) | Rate limit: 10 failed logins per 15 min (per IP and per email), 5 registrations per hour |
| `git`: "dubious ownership" on a WSL path | `git config --global --add safe.directory '<path>'` |

---

## Tests and checks

```bash
cd server && npm test      # needs the MySQL container
cd client && npm run lint && npm run build
```

- **23 integration tests** run against a throw-away database `ecommerce_test` (created from `data/schema.sql`, dropped at the end). `DB_NAME` is set before the app is imported, so the real `ecommerce` database is never touched.
- They cover registration and login (cookie flags), 401 / 403, hidden stock numbers, the search escape, cart limits, checkout (rollback, sold-out lines, empty cart), order ownership, verified-purchase reviews, rating recalculation, and admin price / stock / product add and delete.
- The register route allows 5 calls per hour per IP and the tests use 3, so do not add many register calls to the suite.
- There are no browser / UI tests.

---

## Design decisions

- **Checkout is server-trusted.** Prices are read from the database. Cart rows **and** variant rows are locked with `FOR UPDATE` in one transaction, so a double click cannot make two orders and an admin cannot change a price or stock mid-checkout. Stock is taken with `UPDATE ... WHERE stock_quantity >= ?`, which checks and changes in one step. `order_items.unit_price` stores the price at purchase time.
- **Sold-out lines at checkout** are skipped (the cart already leaves them out of its total) and stay in the cart; only bought lines are removed. A cart with only sold-out lines answers `409`. A line above the remaining stock answers `409` and nothing changes.
- **Ratings** are updated from the old average and count (imported products have ratings but no review rows). The result is rounded to 2 decimals, so it can drift a little over many reviews.
- **Deleting a product** also removes it from carts. A product that was ever ordered cannot be deleted, so order history stays complete.
- **Search and category filters use fixed SQL.** User text only goes into `?` values; sort and column names come from whitelists.

---

## Security notes

- Zod validates all input; JSON body limit is 10 KB; `helmet` sets security headers.
- `httpOnly` + `sameSite=lax` cookie; the JWT algorithm is pinned to HS256; the role is read from the database on each request.
- Login answers the same message and takes the same time for a wrong email and a wrong password.
- Rate limits: login (10 failed tries / 15 min, per IP and per email) and register (5 / hour).
- Orders are always filtered by the logged-in user; admin routes sit behind `requireAuth` → `requireAdmin`.
- React renders reviews and descriptions as text (no `dangerouslySetInnerHTML`), so a `<script>` in a comment is shown, not run.

---

## Data source

`data/products.json` is a product export (about 2,000 products with images, variants and ratings). Product images are loaded from the original shop's servers, so they can disappear; the app shows a placeholder when an image fails. Stock numbers are invented for the demo.

---

## Known gaps

- The login token cannot be revoked before it expires (1 hour); logout only clears the cookie.
- Registering reveals whether an email already has an account (`409`).
- Search uses `LIKE '%…%'`, which cannot use an index; fine for ~2,000 products, use a `FULLTEXT` index for much more.
- The `shop` database user has all rights on the `ecommerce` database; a stricter user could be limited to `SELECT, INSERT, UPDATE, DELETE`.
- The Docker setup is for local use: it is tied to `localhost`, has no HTTPS or reverse proxy, and sets no `TRUST_PROXY`.
- The category pop-out menus use hover, so on touch screens they are not usable yet.
- No browser / UI tests.
