import type { NextApiRequest, NextApiResponse } from "next";
import { query } from "../../../lib/db";
import { requireAdminApiSession } from "../../../lib/admin-access";

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

function parseBrandInput(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const brand = value.trim();
  return brand.length > 0 ? brand.slice(0, 120) : null;
}

function parseId(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : NaN;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireAdminApiSession(req, res);
  if (!session) {
    return;
  }

  if (req.method === "GET") {
      try {
        const result = await query<{
          id: number;
          name: string;
          price_cents: number;
          cost_cents: number;
          quantity: number;
          active: boolean;
          image_path: string | null;
          brand: string | null;
          category_id: number | null;
          category_name: string | null;
        }>(
          `SELECT p.id, p.name, p.price_cents, p.cost_cents, p.quantity, p.active, p.image_path, p.brand, p.category_id, c.name AS category_name
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
            cost_cents: number;
            quantity: number;
            active: boolean;
            image_path: string | null;
            brand: string | null;
            category_id: number | null;
            category_name: string | null;
          }>(
            `SELECT id, name, price_cents, cost_cents, quantity, active, image_path, brand, category_id, NULL::text AS category_name
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
        const cost = parsePriceInput(body.cost);
        const brand = parseBrandInput(body.brand);
        const quantityRaw = body.quantity == null ? 0 : Number(body.quantity);
        const quantity = Number.isInteger(quantityRaw) && quantityRaw >= 0 ? quantityRaw : 0;
        const categoryId = parseId(body.categoryId);
        const active = parseActiveInput(body.active);
        const imagePath =
          typeof body.imagePath === "string" && body.imagePath.startsWith("https://res.cloudinary.com/")
            ? body.imagePath
            : null;

        if (!name) {
          return res.status(400).json({ error: "Nome obrigatório." });
        }

        if (!Number.isFinite(price) || price < 0) {
          return res.status(400).json({ error: "Preço inválido." });
        }

        if (!Number.isFinite(cost) || cost < 0) {
          return res.status(400).json({ error: "Preço de custo inválido." });
        }

        if (!Number.isInteger(quantity) || quantity < 0) {
          return res.status(400).json({ error: "Quantidade inválida." });
        }

        if (!Number.isInteger(categoryId) || categoryId <= 0) {
          return res.status(400).json({ error: "Categoria obrigatória." });
        }

        const categoryResult = await query<{ id: number }>(
          "SELECT id FROM categories WHERE id = $1 LIMIT 1",
          [categoryId],
        );

        if (categoryResult.rows.length === 0) {
          return res.status(400).json({ error: "Categoria não encontrada." });
        }

        const result = await query<{ id: number }>(
          `INSERT INTO products (name, price_cents, cost_cents, brand, quantity, active, image_path, category_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING id`,
          [name, Math.round(price * 100), Math.round(cost * 100), brand, quantity, active, imagePath, categoryId],
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
          return res.status(400).json({ error: "Produto inválido." });
        }

        const currentResult = await query<{
          id: number;
          name: string;
          price_cents: number;
          cost_cents: number;
          quantity: number;
          image_path: string | null;
          brand: string | null;
          category_id: number | null;
          active: boolean;
        }>(
          "SELECT id, name, price_cents, cost_cents, quantity, image_path, brand, category_id, active FROM products WHERE id = $1 LIMIT 1",
          [id],
        );

        if (currentResult.rows.length === 0) {
          return res.status(404).json({ error: "Produto não encontrado." });
        }

        const current = currentResult.rows[0];
        const name =
          typeof body.name === "string" && body.name.trim().length > 0
            ? body.name.trim()
            : current.name;
        const priceInput = body.price ?? current.price_cents / 100;
        const price = parsePriceInput(priceInput);
        const costInput = body.cost ?? current.cost_cents / 100;
        const cost = parsePriceInput(costInput);
        const quantityInput = body.quantity ?? current.quantity;
        const quantityRaw = Number(quantityInput);
        const quantity = Number.isInteger(quantityRaw) && quantityRaw >= 0 ? quantityRaw : current.quantity;
        const brand =
          body.brand == null
            ? current.brand
            : parseBrandInput(body.brand);
        const categoryId = body.categoryId == null ? current.category_id : parseId(body.categoryId);
        const active = body.active == null ? current.active : parseActiveInput(body.active);
        const imagePath =
          typeof body.imagePath === "string" && body.imagePath.startsWith("https://res.cloudinary.com/")
            ? body.imagePath
            : current.image_path;

        if (!Number.isFinite(price) || price < 0) {
          return res.status(400).json({ error: "Preço inválido." });
        }

        if (!Number.isFinite(cost) || cost < 0) {
          return res.status(400).json({ error: "Preço de custo inválido." });
        }

        if (categoryId != null) {
          const categoryResult = await query<{ id: number }>(
            "SELECT id FROM categories WHERE id = $1 LIMIT 1",
            [categoryId],
          );

          if (categoryResult.rows.length === 0) {
            return res.status(400).json({ error: "Categoria não encontrada." });
          }
        }

        const result = await query<{ id: number }>(
          `UPDATE products
           SET name = $1,
               price_cents = $2,
               cost_cents = $3,
               quantity = $4,
               brand = $5,
               active = $6,
               image_path = $7,
               category_id = $8,
               updated_at = NOW()
           WHERE id = $9
           RETURNING id`,
          [
            name,
            Math.round(price * 100),
            Math.round(cost * 100),
            quantity,
            brand,
            active,
            imagePath,
            categoryId,
            id,
          ],
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
          return res.status(400).json({ error: "Produto inválido." });
        }

        const result = await query<{ id: number }>("DELETE FROM products WHERE id = $1 RETURNING id", [
          id,
        ]);

        if (result.rows.length === 0) {
          return res.status(404).json({ error: "Produto não encontrado." });
        }

        return res.status(200).json({ id: result.rows[0].id });
      } catch (error) {
        console.error("products_delete_error", error);
        return res.status(500).json({ error: "Falha ao remover o produto." });
      }
    }

  return res.status(405).json({ error: "Método não permitido." });
}
