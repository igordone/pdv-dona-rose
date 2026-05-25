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
    ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMP NULL;
  `);

  await query(`
    ALTER TABLE losses
      ADD COLUMN IF NOT EXISTS unit_price_cents INTEGER NOT NULL DEFAULT 0;
  `);

  await query(`
    UPDATE losses
    SET unit_price_cents = COALESCE(NULLIF(losses.unit_price_cents, 0), p.price_cents, 0)
    FROM products p
    WHERE losses.product_id = p.id
      AND losses.unit_price_cents = 0;
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
    DECLARE constraint_name text;
    BEGIN
      SELECT con.conname INTO constraint_name
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_attribute attr ON attr.attrelid = rel.oid AND attr.attnum = ANY(con.conkey)
      WHERE rel.relname = 'order_items'
        AND con.contype = 'f'
        AND attr.attname = 'product_id'
      LIMIT 1;

      IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE order_items DROP CONSTRAINT %I', constraint_name);
      END IF;

      SELECT con.conname INTO constraint_name
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_attribute attr ON attr.attrelid = rel.oid AND attr.attnum = ANY(con.conkey)
      WHERE rel.relname = 'losses'
        AND con.contype = 'f'
        AND attr.attname = 'product_id'
      LIMIT 1;

      IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE losses DROP CONSTRAINT %I', constraint_name);
      END IF;
    END $$;
  `);

  await query(`
    ALTER TABLE order_items
      ADD CONSTRAINT order_items_product_id_fkey
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;
  `);

  await query(`
    ALTER TABLE losses
      ADD CONSTRAINT losses_product_id_fkey
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;
  `);

  await query(`
    INSERT INTO categories (name)
    SELECT 'Bebidas'
    WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Bebidas');
  `);

  await query(`
    INSERT INTO categories (name)
    SELECT 'Fritos'
    WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Fritos');
  `);

  await query(`
    INSERT INTO categories (name)
    SELECT 'Assados'
    WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Assados');
  `);

  schemaReady = true;
}
