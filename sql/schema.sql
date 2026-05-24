CREATE TABLE IF NOT EXISTS employees (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(180) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(40) NOT NULL DEFAULT 'employee',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  image_path VARCHAR(255),
  category_id INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS image_path VARCHAR(255);

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS category_id INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'products_category_id_fkey'
  ) THEN
    ALTER TABLE products
      ADD CONSTRAINT products_category_id_fkey
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  client_name VARCHAR(120),
  client_phone VARCHAR(30),
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  total_cents INTEGER NOT NULL DEFAULT 0 CHECK (total_cents >= 0),
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  product_name VARCHAR(150) NOT NULL,
  unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  subtotal_cents INTEGER NOT NULL CHECK (subtotal_cents >= 0)
);

CREATE TABLE IF NOT EXISTS losses (
  id SERIAL PRIMARY KEY,
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  product_name VARCHAR(150),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  observation TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

INSERT INTO categories (name)
SELECT 'Bebidas'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Bebidas');

INSERT INTO categories (name)
SELECT 'Fritos'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Fritos');

INSERT INTO categories (name)
SELECT 'Assados'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Assados');

INSERT INTO products (name, price_cents, quantity, active, category_id)
SELECT 'Coxinha', 700, 30, TRUE, (SELECT id FROM categories WHERE name = 'Fritos' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Coxinha');

INSERT INTO products (name, price_cents, quantity, active, category_id)
SELECT 'Kibe', 700, 25, TRUE, (SELECT id FROM categories WHERE name = 'Fritos' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Kibe');

INSERT INTO products (name, price_cents, quantity, active, category_id)
SELECT 'Pastel', 900, 20, TRUE, (SELECT id FROM categories WHERE name = 'Fritos' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Pastel');
