import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { getPool, query } from "../../../lib/db";

async function ensureAdmin(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session?.user) {
    res.status(401).json({ error: "Não autenticado." });
    return null;
  }

  return session;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await ensureAdmin(req, res);
  if (!session) {
    return;
  }

  if (req.method === "GET") {
    const result = await query<{
      id: number;
      product_id: number | null;
      product_name: string;
      quantity: number;
      observation: string;
      created_at: string;
    }>(
      `SELECT l.id, l.product_id, COALESCE(l.product_name, p.name) AS product_name, l.quantity, l.observation, l.created_at
       FROM losses l
       LEFT JOIN products p ON p.id = l.product_id
       ORDER BY l.created_at DESC`,
    );

    return res.status(200).json({ items: result.rows });
  }

  if (req.method === "POST") {
    const body = req.body as Record<string, unknown>;
    const productId = Number(body.productId);
    const quantity = Number(body.quantity);
    const observation = typeof body.observation === "string" ? body.observation.trim() : "";

    if (!Number.isInteger(productId) || productId <= 0) {
      return res.status(400).json({ error: "Produto inválido." });
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      return res.status(400).json({ error: "Quantidade inválida." });
    }

    if (!observation) {
      return res.status(400).json({ error: "Observação obrigatória." });
    }

    const productResult = await query<{ id: number; name: string }>(
      "SELECT id, name FROM products WHERE id = $1 LIMIT 1",
      [productId],
    );

    if (productResult.rows.length === 0) {
      return res.status(400).json({ error: "Produto não encontrado." });
    }

    const client = await getPool().connect();

    try {
      await client.query("BEGIN");

      await client.query(
        "INSERT INTO losses (product_id, product_name, quantity, observation) VALUES ($1, $2, $3, $4)",
        [productId, productResult.rows[0].name, quantity, observation],
      );

      await client.query(
        "UPDATE products SET quantity = GREATEST(quantity - $1, 0), updated_at = NOW() WHERE id = $2",
        [quantity, productId],
      );

      await client.query("COMMIT");

      return res.status(201).json({ message: "Perda registrada." });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  return res.status(405).json({ error: "Método não permitido." });
}
