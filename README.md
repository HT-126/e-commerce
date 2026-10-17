# E-Commerce

A full-stack online shop: browse a ~2,000-product catalog, manage a cart, check out, leave reviews, and run the store from an admin dashboard.

- **Frontend:** React 19, Vite, React Router 7, Tailwind CSS 4
- **Backend:** Node.js, Express 5, MySQL 8 (`mysql2` pool), Zod validation
- **Auth:** JWT (`jose`) in an `httpOnly` cookie, passwords hashed with `bcrypt`
- **Infra:** MySQL runs in Docker via `docker-compose.yml`

## Features

**Shoppers**
- Product list with search, category filter, price range, sorting (price / rating) and pagination
- Category tree navigation (e.g. `Clothing > Dresses`)
- Product detail: image gallery, variant picker (color / size), stock status ("Sold out" variants cannot be added to the cart)
- Register / login / logout
- Cart (add, change quantity, remove)
- Checkout and order history with order detail pages
- Product reviews (1–5 stars, one review per user per product)

**Admin** (`/admin`, role `admin` only)
- Orders overview
- Income statistics
- Product variant management (price / stock)
- Review moderation (delete)

## Project structure

```
e-commerce/
├── client/                 # React SPA (Vite)
│   └── src/
│       ├── pages/          # Route pages (+ pages/admin)
│       ├── components/     # Header, ProductCard, VariantPicker, ...
│       ├── context/        # AuthContext
│       └── api.js          # fetch wrapper (credentials: include)
├── server/
│   └── src/
│       ├── routes/         # products, auth, cart, checkout, orders, reviews, categories, admin
│       ├── middleware/     # auth, validate (Zod), rateLimit, errorHandler
│       ├── schemas/        # Zod schemas for request input and import rows
│       ├── scripts/        # importProducts.js (data import)
│       └── config/db.js    # MySQL connection pool
├── data/
│   ├── products.json      # Source catalog (imported into MySQL)
│   └── schema.sql          # Database schema
└── docker-compose.yml      # MySQL 8
```

## Getting started

### Prerequisites
- Node.js 20+
- Docker (for MySQL) — or any local MySQL 8 instance

### 1. Start the database
```bash
docker compose up -d
```
This starts MySQL on port `3306` with database `ecommerce` (root password `root`, see `docker-compose.yml`).

### 2. Create the tables
```bash
docker exec -i ecommerce_mysql mysql -uroot -proot ecommerce < data/schema.sql
```
> `schema.sql` begins with `DROP TABLE IF EXISTS ...`, so running it again resets the database.

### 3. Configure and run the server
```bash
cd server
cp .env.example .env     # then set JWT_SECRET (min. 32 characters)
npm install
node src/scripts/importProducts.js   # one-time: import data/products.json
npm run dev                          # http://localhost:3000
```
Check it works: `GET http://localhost:3000/api/health` → `{"status":"ok","db":1}`.

### 4. Run the client
```bash
cd client
cp .env.example .env     # optional, defaults to http://localhost:3000
npm install
npm run dev              # http://localhost:5173
```

### 5. Create an admin user
Register a normal account in the UI, then promote it:
```bash
docker exec -i ecommerce_mysql mysql -uroot -proot ecommerce \
  -e "UPDATE users SET role='admin' WHERE email='you@example.com';"
```
Log in again and open `/admin`.

## Environment variables

**server/.env**

| Variable | Description |
|---|---|
| `PORT` | API port (default `3000`) |
| `CLIENT_ORIGIN` | Allowed CORS origin (default `http://localhost:5173`) |
| `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | MySQL connection |
| `JWT_SECRET` | Token signing secret, **min. 32 characters** (server refuses to start otherwise) |

**client/.env**

| Variable | Description |
|---|---|
| `VITE_API_URL` | API base URL (default `http://localhost:3000`) |

## API overview

| Area | Endpoints |
|---|---|
| Health | `GET /api/health` |
| Products | `GET /api/products` (query: `search`, `category` (id), `minPrice`, `maxPrice`, `minRating`, `sort`, `page`, `limit`), `GET /api/products/:handle` |
| Categories | `GET /api/categories` |
| Reviews | `GET/POST /api/products/:handle/reviews` |
| Auth | `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout` |
| Cart *(login)* | `GET/POST /api/cart`, `PATCH/DELETE /api/cart/:id` |
| Checkout *(login)* | `POST /api/checkout` |
| Orders *(login)* | `GET /api/orders`, `GET /api/orders/:id` |
| Admin *(admin)* | `GET /api/admin/stats`, `GET /api/admin/orders`, `GET /api/admin/variants`, `PATCH /api/admin/variants/:id`, `GET /api/admin/reviews`, `DELETE /api/admin/reviews/:id` |

## Design notes

- **Data import:** `importProducts.js` validates every product with Zod, builds the category tree (cached in a `Map` keyed by the full path, because names like `Shorts` exist under several parents), and inserts everything in **one transaction** — a failure leaves the database untouched. Invalid rows are skipped and logged to `data/import_skipped.json`.
- **Demo stock:** the source data has no inventory, so each variant is imported with an invented stock of **20** (`DEMO_STOCK`).
- **Prices:** money is `DECIMAL(10,2)`, never float. `products.price_min` is derived from the variants.
- **Checkout is server-trusted:** prices are read from the database (never from the client), cart rows are locked with `FOR UPDATE` inside a transaction to prevent double orders, and `order_items.unit_price` stores the price at purchase time.
- **Security:** Zod validation on all input, `httpOnly` + `sameSite=lax` cookie, rate limits on login (10 failed tries / 15 min) and register (5 / hour), 10 KB JSON body limit, `requireAuth` → `requireAdmin` guards on admin routes.

## Scripts

| Where | Command | Purpose |
|---|---|---|
| server | `npm run dev` | Start API with auto-reload |
| server | `node src/scripts/importProducts.js` | Import the catalog |
| client | `npm run dev` | Start Vite dev server |
| client | `npm run build` | Production build |
| client | `npm run lint` | ESLint |
