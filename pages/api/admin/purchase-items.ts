import type { NextApiRequest, NextApiResponse } from "next";
import { query } from "../../../lib/db";
import { requireAdminApiSession } from "../../../lib/admin-access";

function parseCostInput(value: unknown) {
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

function parseImagePath(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const imagePath = value.trim();
  if (!imagePath) {
    return null;
  }

  return imagePath.startsWith("https://res.cloudinary.com/") ? imagePath : null;
}

function parseBrandInput(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const brand = value.trim();
  return brand.length > 0 ? brand.slice(0, 120) : null;
}

function parseCategoryName(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const name = value.trim();
  return name.length > 0 ? name.slice(0, 120) : null;
}

function parseCategoryId(value: unknown) {
  if (value == null || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : NaN;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireAdminApiSession(req, res);
  if (!session) {
    return;
  }

  if (req.method === "GET") {
    const result = await query<{
      id: number;
      name: string;
      brand: string | null;
      cost_cents: number;
      image_path: string | null;
      purchase_category_id: number | null;
      purchase_category_name: string | null;
      active: boolean;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT pci.id,
              pci.name,
              pci.brand,
              pci.cost_cents,
              pci.image_path,
              pci.purchase_category_id,
              pc.name AS purchase_category_name,
              pci.active,
              pci.created_at,
              pci.updated_at
       FROM purchase_catalog_items pci
       LEFT JOIN purchase_categories pc ON pc.id = pci.purchase_category_id
       ORDER BY pci.id DESC`,
    );

    return res.status(200).json({ items: result.rows });
  }

  if (req.method === "POST") {
    const body = req.body as Record<string, unknown>;
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const brand = parseBrandInput(body.brand);
    const cost = parseCostInput(body.cost);
    const purchaseCategoryId = parseCategoryId(body.purchaseCategoryId);
    const purchaseCategoryName = parseCategoryName(body.purchaseCategoryName);
    const active = parseActiveInput(body.active);
    const imagePath = parseImagePath(body.imagePath);

    if (!name) {
      return res.status(400).json({ error: "Nome obrigatório." });
    }

    if (!Number.isFinite(cost) || cost < 0) {
      return res.status(400).json({ error: "Custo inválido." });
    }

    let resolvedPurchaseCategoryId: number | null = null;

    if (Number.isInteger(purchaseCategoryId)) {
      const categoryResult = await query<{ id: number }>(
        "SELECT id FROM purchase_categories WHERE id = $1 LIMIT 1",
        [purchaseCategoryId],
      );

      if (categoryResult.rows.length === 0) {
        return res.status(400).json({ error: "Categoria não encontrada." });
      }

      resolvedPurchaseCategoryId = purchaseCategoryId;
    } else if (purchaseCategoryName) {
      const existingCategory = await query<{ id: number }>(
        "SELECT id FROM purchase_categories WHERE LOWER(name) = LOWER($1) LIMIT 1",
        [purchaseCategoryName],
      );

      if (existingCategory.rows.length > 0) {
        resolvedPurchaseCategoryId = existingCategory.rows[0].id;
      } else {
        const createdCategory = await query<{ id: number }>(
          `INSERT INTO purchase_categories (name, order_index)
           VALUES (
             $1,
             COALESCE((SELECT MAX(order_index) + 1 FROM purchase_categories), 1)
           )
           RETURNING id`,
          [purchaseCategoryName],
        );

        resolvedPurchaseCategoryId = createdCategory.rows[0].id;
      }
    }

    const result = await query<{ id: number }>(
      `INSERT INTO purchase_catalog_items (name, brand, cost_cents, image_path, purchase_category_id, active, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING id`,
      [name, brand, Math.round(cost * 100), imagePath, resolvedPurchaseCategoryId, active],
    );

    return res.status(201).json({ id: result.rows[0].id });
  }

  if (req.method === "PATCH") {
    const body = req.body as Record<string, unknown>;
    const id = parseId(body.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "Item inválido." });
    }

    const currentResult = await query<{
      id: number;
      name: string;
      brand: string | null;
      cost_cents: number;
      image_path: string | null;
      purchase_category_id: number | null;
      purchase_category_name: string | null;
      active: boolean;
    }>(
      `SELECT pci.id, pci.name, pci.brand, pci.cost_cents, pci.image_path, pci.purchase_category_id, pc.name AS purchase_category_name, pci.active
       FROM purchase_catalog_items pci
       LEFT JOIN purchase_categories pc ON pc.id = pci.purchase_category_id
       WHERE pci.id = $1
       LIMIT 1`,
      [id],
    );

    if (currentResult.rows.length === 0) {
      return res.status(404).json({ error: "Item não encontrado." });
    }

    const current = currentResult.rows[0];
    const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : current.name;
    const costInput = body.cost ?? current.cost_cents / 100;
    const cost = parseCostInput(costInput);
    const brand = body.brand == null ? current.brand : parseBrandInput(body.brand);
    const purchaseCategoryId =
      body.purchaseCategoryId == null ? current.purchase_category_id : parseCategoryId(body.purchaseCategoryId);
    const purchaseCategoryName = parseCategoryName(body.purchaseCategoryName);
    const active = body.active == null ? current.active : parseActiveInput(body.active);
    const imagePath =
      body.imagePath == null ? current.image_path : parseImagePath(body.imagePath);

    if (!Number.isFinite(cost) || cost < 0) {
      return res.status(400).json({ error: "Custo inválido." });
    }

    let resolvedPurchaseCategoryId: number | null = current.purchase_category_id;

    if (Number.isInteger(purchaseCategoryId)) {
      const categoryResult = await query<{ id: number }>(
        "SELECT id FROM purchase_categories WHERE id = $1 LIMIT 1",
        [purchaseCategoryId],
      );

      if (categoryResult.rows.length === 0) {
        return res.status(400).json({ error: "Categoria não encontrada." });
      }

      resolvedPurchaseCategoryId = purchaseCategoryId;
    } else if (purchaseCategoryName) {
      const existingCategory = await query<{ id: number }>(
        "SELECT id FROM purchase_categories WHERE LOWER(name) = LOWER($1) LIMIT 1",
        [purchaseCategoryName],
      );

      if (existingCategory.rows.length > 0) {
        resolvedPurchaseCategoryId = existingCategory.rows[0].id;
      } else {
        const createdCategory = await query<{ id: number }>(
          `INSERT INTO purchase_categories (name, order_index)
           VALUES (
             $1,
             COALESCE((SELECT MAX(order_index) + 1 FROM purchase_categories), 1)
           )
           RETURNING id`,
          [purchaseCategoryName],
        );

        resolvedPurchaseCategoryId = createdCategory.rows[0].id;
      }
    }

    const result = await query<{ id: number }>(
      `UPDATE purchase_catalog_items
       SET name = $1,
           brand = $2,
           cost_cents = $3,
           image_path = $4,
           purchase_category_id = $5,
           active = $6,
           updated_at = NOW()
       WHERE id = $7
       RETURNING id`,
      [name, brand, Math.round(cost * 100), imagePath, resolvedPurchaseCategoryId, active, id],
    );

    return res.status(200).json({ id: result.rows[0].id });
  }

  if (req.method === "DELETE") {
    const body = req.body as Record<string, unknown>;
    const id = parseId(body.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "Item inválido." });
    }

    const result = await query<{ id: number }>(
      "DELETE FROM purchase_catalog_items WHERE id = $1 RETURNING id",
      [id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Item não encontrado." });
    }

    return res.status(200).json({ id: result.rows[0].id });
  }

  return res.status(405).json({ error: "Método não permitido." });
}
