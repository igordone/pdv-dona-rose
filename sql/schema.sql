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
  cost_cents INTEGER NOT NULL DEFAULT 0 CHECK (cost_cents >= 0),
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

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS cost_cents INTEGER NOT NULL DEFAULT 0;

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
  order_code VARCHAR(4) NOT NULL,
  order_code_date DATE NOT NULL DEFAULT CURRENT_DATE,
  session_id VARCHAR(36),
  client_name VARCHAR(120),
  client_phone VARCHAR(30),
  delivery_method VARCHAR(20) NOT NULL DEFAULT 'pickup',
  delivery_address TEXT,
  payment_method VARCHAR(20) NOT NULL DEFAULT 'cash',
  payment_confirmed_at TIMESTAMP,
  status VARCHAR(30) NOT NULL DEFAULT 'pendente',
  pending_at TIMESTAMP NOT NULL DEFAULT NOW(),
  preparing_at TIMESTAMP,
  on_way_at TIMESTAMP,
  completed_at TIMESTAMP,
  cancelled_at TIMESTAMP,
  total_cents INTEGER NOT NULL DEFAULT 0 CHECK (total_cents >= 0),
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS orders_order_code_unique
  ON orders(order_code_date, order_code);

CREATE TABLE IF NOT EXISTS order_code_sequences (
  code_date DATE PRIMARY KEY,
  last_sequence INTEGER NOT NULL DEFAULT 0
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

CREATE TABLE IF NOT EXISTS settings (
  key VARCHAR PRIMARY KEY,
  value TEXT
);
