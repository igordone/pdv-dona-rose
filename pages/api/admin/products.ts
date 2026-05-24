import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { query } from "../../../lib/db";
import { ensureCatalogSchema } from "../../../lib/schema";

async function ensureAdmin(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session?.user) {
    res.status(401).json({ error: "Nao autenticado." });
    return null;
  }

  return session;
}

function parsePriceInput(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : NaN;
  }

  if (typeof value !== "string") {
    return NaN;
  }

  const normalized = value.trim().replace(/\s+/g, "");

  if (!normalized) {
    return NaN;
  }

  if (normalized.includes(",")) {
    return Number(normalized.replace(/\./g, "").replace(",", "."));
  }

  return Number(normalized);
}

function parseActiveInput(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return value === "true" || value === "active" || value === "1";
  }

  if (typeof value === "number") {
    return value === 1;
  }

  return true;
}

function parseId(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : NaN;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const session = await ensureAdmin(req, res);
    if (!session) {
      return;
    }

    try {
      await ensureCatalogSchema();
    } catch (error) {
      console.warn("ensure_catalog_schema_error", error);
      return res.status(500).json({ error: "Falha ao preparar o banco de categorias." });
    }

    if (req.method === "GET") {
      try {
        const result = await query<{
          id: number;
          name: string;
          price_cents: number;
          quantity: number;
          active: boolean;
          image_path: string | null;
          category_id: number | null;
          category_name: string | null;
        }>(
          `SELECT p.id, p.name, p.price_cents, p.quantity, p.active, p.image_path, p.category_id, c.name AS category_name
           FROM products p
           LEFT JOIN categories c ON c.id = p.category_id
           ORDER BY p.id DESC`,
        );

        return res.status(200).json({ items: result.rows });
      } catch (error) {
        console.warn("products_join_fallback", error);

        try {
          const fallback = await query<{
            id: number;
            name: string;
            price_cents: number;
            quantity: number;
            active: boolean;
            image_path: string | null;
            category_id: number | null;
            category_name: string | null;
          }>(
            `SELECT id, name, price_cents, quantity, active, image_path, category_id, NULL::text AS category_name
             FROM products
             ORDER BY id DESC`,
          );

          return res.status(200).json({ items: fallback.rows });
        } catch (fallbackError) {
          console.error("products_get_error", fallbackError);
          return res.status(200).json({ items: [] });
        }
      }
    }

    if (req.method === "POST") {
      try {
        const body = req.body as Record<string, unknown>;
        const name = typeof body.name === "string" ? body.name.trim() : "";
        const price = parsePriceInput(body.price);
        const quantityRaw = body.quantity == null ? 0 : Number(body.quantity);
        const quantity = Number.isInteger(quantityRaw) && quantityRaw >= 0 ? quantityRaw : 0;
        const categoryId = parseId(body.categoryId);
        const active = parseActiveInput(body.active);
        const imagePath =
          typeof body.imagePath === "string" && body.imagePath.startsWith("https://res.cloudinary.com/")
            ? body.imagePath
            : null;

        if (!name) {
          return res.status(400).json({ error: "Nome obrigatorio." });
        }

        if (!Number.isFinite(price) || price < 0) {
          return res.status(400).json({ error: "Preco invalido." });
        }

        if (!Number.isInteger(quantity) || quantity < 0) {
          return res.status(400).json({ error: "Quantidade invalida." });
        }

        if (!Number.isInteger(categoryId) || categoryId <= 0) {
          return res.status(400).json({ error: "Categoria obrigatoria." });
        }

        const categoryResult = await query<{ id: number }>(
          "SELECT id FROM categories WHERE id = $1 LIMIT 1",
          [categoryId],
        );

        if (categoryResult.rows.length === 0) {
          return res.status(400).json({ error: "Categoria nao encontrada." });
        }

        const result = await query<{ id: number }>(
          `INSERT INTO products (name, price_cents, quantity, active, image_path, category_id)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id`,
          [name, Math.round(price * 100), quantity, active, imagePath, categoryId],
        );

        return res.status(201).json({ id: result.rows[0].id });
      } catch (error) {
        console.error("products_create_error", error);
        return res.status(500).json({ error: "Falha ao criar o produto." });
      }
    }

    if (req.method === "PATCH") {
      try {
        const body = req.body as Record<string, unknown>;
        const id = parseId(body.id);

        if (!Number.isInteger(id) || id <= 0) {
          return res.status(400).json({ error: "Produto invalido." });
        }

        const currentResult = await query<{
          id: number;
          name: string;
          price_cents: number;
          image_path: string | null;
          category_id: number | null;
          active: boolean;
        }>(
          "SELECT id, name, price_cents, image_path, category_id, active FROM products WHERE id = $1 LIMIT 1",
          [id],
        );

        if (currentResult.rows.length === 0) {
          return res.status(404).json({ error: "Produto nao encontrado." });
        }

        const current = currentResult.rows[0];
        const name =
          typeof body.name === "string" && body.name.trim().length > 0
            ? body.name.trim()
            : current.name;
        const priceInput = body.price ?? current.price_cents / 100;
        const price = parsePriceInput(priceInput);
        const categoryId = body.categoryId == null ? current.category_id : parseId(body.categoryId);
        const active = body.active == null ? current.active : parseActiveInput(body.active);
        const imagePath =
          typeof body.imagePath === "string" && body.imagePath.startsWith("https://res.cloudinary.com/")
            ? body.imagePath
            : current.image_path;

        if (!Number.isFinite(price) || price < 0) {
          return res.status(400).json({ error: "Preco invalido." });
        }

        if (categoryId != null) {
          const categoryResult = await query<{ id: number }>(
            "SELECT id FROM categories WHERE id = $1 LIMIT 1",
            [categoryId],
          );

          if (categoryResult.rows.length === 0) {
            return res.status(400).json({ error: "Categoria nao encontrada." });
          }
        }

        const result = await query<{ id: number }>(
          `UPDATE products
           SET name = $1,
               price_cents = $2,
               active = $3,
               image_path = $4,
               category_id = $5,
               updated_at = NOW()
           WHERE id = $6
           RETURNING id`,
          [name, Math.round(price * 100), active, imagePath, categoryId, id],
        );

        return res.status(200).json({ id: result.rows[0].id });
      } catch (error) {
        console.error("products_update_error", error);
        return res.status(500).json({ error: "Falha ao atualizar o produto." });
      }
    }

    if (req.method === "DELETE") {
      try {
        const body = req.body as Record<string, unknown>;
        const id = parseId(body.id);

        if (!Number.isInteger(id) || id <= 0) {
          return res.status(400).json({ error: "Produto invalido." });
        }

        const result = await query<{ id: number }>("DELETE FROM products WHERE id = $1 RETURNING id", [
          id,
        ]);

        if (result.rows.length === 0) {
          return res.status(404).json({ error: "Produto nao encontrado." });
        }

        return res.status(200).json({ id: result.rows[0].id });
      } catch (error) {
        console.error("products_delete_error", error);
        return res.status(500).json({ error: "Falha ao remover o produto." });
      }
    }

    return res.status(405).json({ error: "Metodo nao permitido." });
  } catch (error) {
    console.error("products_handler_error", error);
    return res.status(500).json({ error: "Falha inesperada ao processar o produto." });
  }
}
