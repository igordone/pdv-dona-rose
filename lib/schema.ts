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
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
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
    ALTER TABLE losses
      ADD COLUMN IF NOT EXISTS product_name VARCHAR(150);
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
