import { query } from "./db";

let schemaReady = false;

export async function ensureCatalogSchema() {
  if (schemaReady) {
    return;
  }

  await query(`
    CREATE TABLE IF NOT EXISTS categories (
      id SERIAL PRIMARY KEY,
      name VARCHAR(120) NOT NULL UNIQUE,
      order_index INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    ALTER TABLE categories
      ADD COLUMN IF NOT EXISTS order_index INTEGER NOT NULL DEFAULT 0;
  `);

  await query(`
    WITH ordered_categories AS (
      SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) AS new_order_index
      FROM categories
    )
    UPDATE categories
    SET order_index = ordered_categories.new_order_index
    FROM ordered_categories
    WHERE categories.id = ordered_categories.id
      AND categories.order_index = 0;
  `);

  await query(`
    ALTER TABLE products
      ADD COLUMN IF NOT EXISTS image_path VARCHAR(255);
  `);

  await query(`
    ALTER TABLE products
      ADD COLUMN IF NOT EXISTS category_id INTEGER;
  `);

  await query(`
    ALTER TABLE products
      ADD COLUMN IF NOT EXISTS cost_cents INTEGER NOT NULL DEFAULT 0;
  `);

  await query(`
    ALTER TABLE products
      ADD COLUMN IF NOT EXISTS brand VARCHAR(120);
  `);

  await query(`
    ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMP NULL;
  `);

  await query(`
    ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS order_code VARCHAR(4);
  `);

  await query(`
    ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS order_code_date DATE;
  `);

  await query(`
    UPDATE orders
    SET order_code_date = COALESCE(order_code_date, created_at::date, pending_at::date, CURRENT_DATE);
  `);

  await query(`
    ALTER TABLE orders
      ALTER COLUMN order_code_date SET DEFAULT CURRENT_DATE;
  `);

  await query(`
    ALTER TABLE orders
      ALTER COLUMN order_code_date SET NOT NULL;
  `);

  await query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'orders_order_code_key'
          AND conrelid = 'orders'::regclass
      ) THEN
        EXECUTE 'ALTER TABLE orders DROP CONSTRAINT orders_order_code_key';
      END IF;

      IF EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE schemaname = current_schema()
          AND tablename = 'orders'
          AND indexname = 'orders_order_code_unique'
      ) THEN
        EXECUTE 'DROP INDEX orders_order_code_unique';
      END IF;
    END $$;
  `);

  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS orders_order_code_unique
      ON orders(order_code_date, order_code);
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS order_code_sequences (
      code_date DATE PRIMARY KEY,
      last_sequence INTEGER NOT NULL DEFAULT 0
    );
  `);

  await query(`
    ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS session_id VARCHAR(36);
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS settings (
      key VARCHAR PRIMARY KEY,
      value TEXT
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS purchases (
      id SERIAL PRIMARY KEY,
      batch_id VARCHAR(36),
      operator_name VARCHAR(120),
      purchase_date DATE NOT NULL,
      observation TEXT,
      total_cents INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS purchase_items (
      id SERIAL PRIMARY KEY,
      purchase_id INTEGER NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
      source_type VARCHAR(20) NOT NULL DEFAULT 'menu',
      source_id INTEGER,
      product_id INTEGER NULL REFERENCES products(id) ON DELETE SET NULL,
      product_name VARCHAR(150) NOT NULL,
      brand VARCHAR(120),
      quantity INTEGER NOT NULL,
      unit_cost_cents INTEGER NOT NULL DEFAULT 0,
      subtotal_cents INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS purchase_catalog_items (
      id SERIAL PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      brand VARCHAR(120),
      cost_cents INTEGER NOT NULL DEFAULT 0,
      image_path VARCHAR(255),
      purchase_category_id INTEGER,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS purchase_categories (
      id SERIAL PRIMARY KEY,
      name VARCHAR(120) NOT NULL UNIQUE,
      order_index INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    ALTER TABLE purchase_categories
      ADD COLUMN IF NOT EXISTS order_index INTEGER NOT NULL DEFAULT 0;
  `);

  await query(`
    WITH ordered_purchase_categories AS (
      SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) AS new_order_index
      FROM purchase_categories
    )
    UPDATE purchase_categories
    SET order_index = ordered_purchase_categories.new_order_index
    FROM ordered_purchase_categories
    WHERE purchase_categories.id = ordered_purchase_categories.id
      AND purchase_categories.order_index = 0;
  `);

  await query(`
    ALTER TABLE purchase_catalog_items
      ADD COLUMN IF NOT EXISTS purchase_category_id INTEGER;
  `);

  await query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'purchase_catalog_items_purchase_category_id_fkey'
      ) THEN
        ALTER TABLE purchase_catalog_items
          ADD CONSTRAINT purchase_catalog_items_purchase_category_id_fkey
          FOREIGN KEY (purchase_category_id) REFERENCES purchase_categories(id) ON DELETE SET NULL;
      END IF;
    END $$;
  `);

  await query(`
    ALTER TABLE purchase_items
      ADD COLUMN IF NOT EXISTS source_type VARCHAR(20) NOT NULL DEFAULT 'menu';
  `);

  await query(`
    ALTER TABLE purchase_items
      ADD COLUMN IF NOT EXISTS source_id INTEGER;
  `);

  await query(`
    ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS delivery_method VARCHAR(20) NOT NULL DEFAULT 'pickup';
  `);

  await query(`
    ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS delivery_address TEXT;
  `);

  await query(`
    ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20) NOT NULL DEFAULT 'cash';
  `);

  await query(`
    ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS payment_confirmed_at TIMESTAMP NULL;
  `);

  await query(`
    ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS pending_at TIMESTAMP NOT NULL DEFAULT NOW();
  `);

  await query(`
    ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS preparing_at TIMESTAMP NULL;
  `);

  await query(`
    ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS on_way_at TIMESTAMP NULL;
  `);

  await query(`
    ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP NULL;
  `);

  await query(`
    ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP NULL;
  `);

  await query(`
    UPDATE orders
    SET pending_at = COALESCE(created_at, pending_at, NOW())
    WHERE pending_at IS NULL OR pending_at <> created_at;
  `);

  await query(`
    UPDATE orders
    SET status = CASE
      WHEN status = 'pending' THEN 'pendente'
      WHEN status = 'completed' THEN 'concluido'
      WHEN status = 'cancelled' THEN 'cancelado'
      ELSE status
    END
    WHERE status IN ('pending', 'completed', 'cancelled');
  `);

  await query(`
    ALTER TABLE orders
      ALTER COLUMN status SET DEFAULT 'pendente';
  `);

  await query(`
    ALTER TABLE losses
      ADD COLUMN IF NOT EXISTS unit_price_cents INTEGER NOT NULL DEFAULT 0;
  `);

  await query(`
    UPDATE losses
    SET unit_price_cents = COALESCE(p.cost_cents, losses.unit_price_cents, 0)
    FROM products p
    WHERE losses.product_id = p.id
      AND p.cost_cents IS NOT NULL;
  `);

  await query(`
    ALTER TABLE losses
      ADD COLUMN IF NOT EXISTS product_name VARCHAR(150);
  `);

  await query(`
    ALTER TABLE losses
      ADD COLUMN IF NOT EXISTS batch_id VARCHAR(36);
  `);

  await query(`
    ALTER TABLE losses
      ADD COLUMN IF NOT EXISTS operator_name VARCHAR(120);
  `);

  await query(`
    ALTER TABLE losses
      ADD COLUMN IF NOT EXISTS loss_date DATE;
  `);

  await query(`
    UPDATE losses
    SET loss_date = COALESCE(loss_date, created_at::date, CURRENT_DATE);
  `);

  await query(`
    ALTER TABLE losses
      ALTER COLUMN loss_date SET DEFAULT CURRENT_DATE;
  `);

  await query(`
    ALTER TABLE losses
      ALTER COLUMN loss_date SET NOT NULL;
  `);

  await query(`
    ALTER TABLE order_items
      ALTER COLUMN product_id DROP NOT NULL;
  `);

  await query(`
    ALTER TABLE losses
      ALTER COLUMN product_id DROP NOT NULL;
  `);

  await query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'order_items_product_id_fkey'
          AND conrelid = 'order_items'::regclass
      ) THEN
        EXECUTE 'ALTER TABLE order_items DROP CONSTRAINT order_items_product_id_fkey';
      END IF;

      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'order_items_product_id_fkey'
          AND conrelid = 'order_items'::regclass
      ) THEN
        EXECUTE '
          ALTER TABLE order_items
            ADD CONSTRAINT order_items_product_id_fkey
            FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
        ';
      END IF;

      IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'losses_product_id_fkey'
          AND conrelid = 'losses'::regclass
      ) THEN
        EXECUTE 'ALTER TABLE losses DROP CONSTRAINT losses_product_id_fkey';
      END IF;

      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'losses_product_id_fkey'
          AND conrelid = 'losses'::regclass
      ) THEN
        EXECUTE '
          ALTER TABLE losses
            ADD CONSTRAINT losses_product_id_fkey
            FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
        ';
      END IF;
    END $$;
  `);

  schemaReady = true;
}
