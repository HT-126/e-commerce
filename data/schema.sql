DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS cart_items;
DROP TABLE IF EXISTS reviews;
DROP TABLE IF EXISTS product_variants;
DROP TABLE IF EXISTS product_images;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS users;


CREATE TABLE categories (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  name      VARCHAR(100) NOT NULL,
  -- NULL = top level. Points to another row in this same table (tree).
  parent_id INT NULL,
  FOREIGN KEY (parent_id) REFERENCES categories(id),
  -- Remember: this does NOT stop two top-level rows with the same name.
  -- The import script must check before insert.
  UNIQUE (parent_id, name)
);

CREATE TABLE products (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  -- URL-friendly key. Titles repeat (49 duplicates), handles do not.
  handle       VARCHAR(255) NOT NULL UNIQUE,
  title        VARCHAR(255) NOT NULL,
  description  TEXT NOT NULL,
  -- The "from $X" price. Money = DECIMAL, never FLOAT.
  price_min    DECIMAL(10,2) NOT NULL,
  -- NULL for the 91 products with no rating
  rating       DECIMAL(3,2) NULL,
  rating_count INT NOT NULL DEFAULT 0,
  category_id  INT NOT NULL,
  FOREIGN KEY (category_id) REFERENCES categories(id),
  -- We will filter by category and price, so index them
  INDEX idx_products_category (category_id),
  INDEX idx_products_price (price_min)
);

CREATE TABLE product_images (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  -- Shopify URLs can be long, so 500 (I have not checked the real max)
  url        VARCHAR(500) NOT NULL,
  -- have not checked if alt is ever empty, so allow NULL
  alt        VARCHAR(255) NULL,
  -- Order in the gallery: 0 = first image
  position   INT NOT NULL DEFAULT 0,
  -- If a product is deleted, its images go too
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE product_variants (
  id                 INT AUTO_INCREMENT PRIMARY KEY,
  product_id         INT NOT NULL,
  -- Each sellable item has its own SKU (the bad bundle product had null SKUs, we skip it)
  sku                VARCHAR(100) NOT NULL UNIQUE,
  -- Allow NULL until verify every variant has both options
  color              VARCHAR(100) NULL,
  size               VARCHAR(50) NULL,
  price              DECIMAL(10,2) NOT NULL,-- NULL = no discount , price in variant bc some different variant has different price 
  compare_at_price   DECIMAL(10,2) NULL,
  -- Our own number (demo data), not from the dataset
  stock_quantity     INT NOT NULL DEFAULT 0,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  -- Safety net: stock can never be negative
  CHECK (stock_quantity >= 0)
);

CREATE TABLE users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  -- UNIQUE = no two accounts with the same email
  email         VARCHAR(255) NOT NULL UNIQUE,
  -- A bcrypt hash is about 60 characters. 255 is a safe size.
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('customer', 'admin') NOT NULL DEFAULT 'customer'
);

CREATE TABLE cart_items (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NOT NULL,
  -- The cart points to a VARIANT (Red, size M), not a product
  variant_id INT NOT NULL,
  quantity   INT NOT NULL DEFAULT 1,
  -- If a user is deleted, their cart goes too
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (variant_id) REFERENCES product_variants(id), -- FK: the schema stops a cart row from pointing to a variant that does not exist
  -- Quantity must be at least 1
  CHECK (quantity > 0),
  -- My suggestion (not in your draft): one row per user + variant
  UNIQUE (user_id, variant_id)
);

CREATE TABLE orders (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NOT NULL,
  total      DECIMAL(10,2) NOT NULL,
  -- MySQL fills this by itself when the row is inserted
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- No CASCADE on purpose: you cannot delete a user who has orders.
  -- Order history must not disappear.
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE order_items (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  order_id   INT NOT NULL,
  variant_id INT NOT NULL,
  quantity   INT NOT NULL,
  -- The price at the moment of checkout (a copy, not a link)
  unit_price DECIMAL(10,2) NOT NULL,
  -- If an order is deleted, its lines go too
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  -- No CASCADE: you cannot delete a variant that was already sold
  FOREIGN KEY (variant_id) REFERENCES product_variants(id),
  CHECK (quantity > 0)
);

CREATE TABLE reviews (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  user_id    INT NOT NULL,
  -- TINYINT is a small integer, enough for 1 to 5
  rating     TINYINT NOT NULL,
  -- NULL = rating only, no comment
  comment    TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CHECK (rating BETWEEN 1 AND 5),
  -- One review per user per product
  UNIQUE (user_id, product_id)
);