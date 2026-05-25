import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { getPool, query } from "../../../lib/db";
import { ensureCatalogSchema } from "../../../lib/schema";

async function ensureAdmin(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session?.user) {
    res.status(401).json({ error: "Não autenticado." });
    return null;
  }

  return session;
}

function parseId(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : NaN;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await ensureAdmin(req, res);
  if (!session) {
    return;
  }

  try {
    await ensureCatalogSchema();
  } catch (error) {
    console.error("ensure_catalog_schema_error", error);
    return res.status(500).json({ error: "Falha ao preparar o banco de categorias." });
  }

  if (req.method === "GET") {
    const result = await query<{ id: number; name: string }>(
      "SELECT id, name FROM categories ORDER BY order_index ASC, id ASC",
    );

    return res.status(200).json({ items: result.rows });
  }

  if (req.method === "POST") {
    const body = req.body as Record<string, unknown>;
    const name = typeof body.name === "string" ? body.name.trim() : "";

    if (!name) {
      return res.status(400).json({ error: "Nome da categoria obrigatório." });
    }

    const existsResult = await query<{ id: number }>(
      "SELECT id FROM categories WHERE LOWER(name) = LOWER($1) LIMIT 1",
      [name],
    );

    if (existsResult.rows.length > 0) {
      return res.status(400).json({ error: "Categoria já existe." });
    }

    const result = await query<{ id: number }>(
      `INSERT INTO categories (name, order_index)
       VALUES (
         $1,
         COALESCE((SELECT MAX(order_index) + 1 FROM categories), 1)
       )
       RETURNING id`,
      [name],
    );

    return res.status(201).json({ id: result.rows[0].id });
  }

  if (req.method === "PATCH") {
    const body = req.body as Record<string, unknown>;
    const id = parseId(body.id);
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const orderIds = Array.isArray(body.orderIds)
      ? body.orderIds.map((value) => parseId(value)).filter((value) => Number.isInteger(value) && value > 0)
      : null;

    if (orderIds && orderIds.length > 0) {
      const uniqueOrderIds = Array.from(new Set(orderIds));

      if (uniqueOrderIds.length !== orderIds.length) {
        return res.status(400).json({ error: "Ordem de categorias inválida." });
      }

      const existingResult = await query<{ id: number }>(
        "SELECT id FROM categories ORDER BY order_index ASC, id ASC",
      );
      const existingIds = existingResult.rows.map((row) => row.id);

      if (
        uniqueOrderIds.length !== existingIds.length ||
        uniqueOrderIds.some((categoryId) => !existingIds.includes(categoryId))
      ) {
        return res.status(400).json({ error: "Ordem de categorias inválida." });
      }

      const client = await getPool().connect();

      try {
        await client.query("BEGIN");

        for (let index = 0; index < uniqueOrderIds.length; index += 1) {
          await client.query("UPDATE categories SET order_index = $1 WHERE id = $2", [
            index + 1,
            uniqueOrderIds[index],
          ]);
        }

        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        console.error("category_reorder_error", error);
        return res.status(500).json({ error: "Falha ao reordenar categorias." });
      } finally {
        client.release();
      }

      return res.status(200).json({ ok: true });
    }

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "Categoria inválida." });
    }

    if (!name) {
      return res.status(400).json({ error: "Nome da categoria obrigatório." });
    }

    const existsResult = await query<{ id: number }>(
      "SELECT id FROM categories WHERE LOWER(name) = LOWER($1) AND id <> $2 LIMIT 1",
      [name, id],
    );

    if (existsResult.rows.length > 0) {
      return res.status(400).json({ error: "Outra categoria já usa esse nome." });
    }

    const result = await query<{ id: number }>(
      "UPDATE categories SET name = $1 WHERE id = $2 RETURNING id",
      [name, id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Categoria não encontrada." });
    }

    return res.status(200).json({ id: result.rows[0].id });
  }

  if (req.method === "DELETE") {
    const body = req.body as Record<string, unknown>;
    const id = parseId(body.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "Categoria inválida." });
    }

    const result = await query<{ id: number }>("DELETE FROM categories WHERE id = $1 RETURNING id", [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Categoria não encontrada." });
    }

    return res.status(200).json({ id: result.rows[0].id });
  }

  return res.status(405).json({ error: "Método não permitido." });
}
