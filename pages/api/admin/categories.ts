import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { query } from "../../../lib/db";
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
      "SELECT id, name FROM categories ORDER BY name ASC",
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
      "INSERT INTO categories (name) VALUES ($1) RETURNING id",
      [name],
    );

    return res.status(201).json({ id: result.rows[0].id });
  }

  if (req.method === "PATCH") {
    const body = req.body as Record<string, unknown>;
    const id = parseId(body.id);
    const name = typeof body.name === "string" ? body.name.trim() : "";

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
