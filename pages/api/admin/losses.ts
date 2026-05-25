import { randomUUID } from "crypto";
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { getPool, query } from "../../../lib/db";
import { ensureCatalogSchema } from "../../../lib/schema";

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function ensureAdmin(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session?.user) {
    res.status(401).json({ error: "Não autenticado." });
    return null;
  }

  return session;
}

function getLocalDateKey(date = new Date()) {
  return date.toLocaleDateString("en-CA");
}

function parseLossItems(body: Record<string, unknown>) {
  if (Array.isArray(body.items)) {
    return body.items
      .map((item) => ({
        productId: Number((item as Record<string, unknown>).productId),
        quantity: Number((item as Record<string, unknown>).quantity),
      }))
      .filter((item) => Number.isInteger(item.productId) && item.productId > 0 && Number.isInteger(item.quantity) && item.quantity > 0);
  }

  const productId = Number(body.productId);
  const quantity = Number(body.quantity);

  if (Number.isInteger(productId) && productId > 0 && Number.isInteger(quantity) && quantity > 0) {
    return [{ productId, quantity }];
  }

  return [];
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await ensureAdmin(req, res);
  if (!session) {
    return;
  }

  await ensureCatalogSchema();

  if (req.method === "GET") {
    const result = await query<{
      id: number;
      batch_id: string | null;
      operator_name: string | null;
      loss_date: string;
      product_id: number | null;
      product_name: string;
      quantity: number;
      observation: string;
      unit_price_cents: number;
      total_cents: number;
      created_at: string;
    }>(
      `SELECT l.id,
              l.batch_id,
              l.operator_name,
              l.loss_date::text AS loss_date,
              l.product_id,
              COALESCE(l.product_name, p.name) AS product_name,
              l.quantity,
              l.observation,
              COALESCE(NULLIF(l.unit_price_cents, 0), p.price_cents, 0) AS unit_price_cents,
              COALESCE(NULLIF(l.unit_price_cents, 0), p.price_cents, 0) * l.quantity AS total_cents,
              l.created_at
       FROM losses l
       LEFT JOIN products p ON p.id = l.product_id
       ORDER BY l.loss_date DESC, l.created_at DESC, l.id DESC`,
    );

    return res.status(200).json({ items: result.rows });
  }

  if (req.method === "POST") {
    const body = req.body as Record<string, unknown>;
    const observation = typeof body.observation === "string" ? body.observation.trim() : "";
    const lossDate = typeof body.lossDate === "string" && body.lossDate.trim() ? body.lossDate.trim() : getLocalDateKey();
    const operatorName = typeof session.user?.name === "string" && session.user.name.trim() ? session.user.name.trim() : "Colaborador";
    const items = parseLossItems(body);

    if (items.length === 0) {
      return res.status(400).json({ error: "Adicione ao menos um produto perdido." });
    }

    if (!observation) {
      return res.status(400).json({ error: "Observação obrigatória." });
    }

    const client = await getPool().connect();
    const batchId = randomUUID();

    try {
      await client.query("BEGIN");

      const insertedItems: Array<{
        id: number;
        batch_id: string | null;
        operator_name: string | null;
        loss_date: string;
        product_id: number | null;
        product_name: string;
        quantity: number;
        observation: string;
        unit_price_cents: number;
        total_cents: number;
        created_at: string;
      }> = [];

      for (const item of items) {
        const productResult = await client.query<{ id: number; name: string; price_cents: number }>(
          "SELECT id, name, price_cents FROM products WHERE id = $1 LIMIT 1",
          [item.productId],
        );

        if (productResult.rows.length === 0) {
          throw new HttpError(400, "Produto não encontrado.");
        }

        const product = productResult.rows[0];

        const insertedResult = await client.query<{
          id: number;
          batch_id: string | null;
          operator_name: string | null;
          loss_date: string;
          product_id: number | null;
          product_name: string;
          quantity: number;
          observation: string;
          unit_price_cents: number;
          created_at: string;
        }>(
          `INSERT INTO losses (
              product_id,
              product_name,
              quantity,
              observation,
              unit_price_cents,
              batch_id,
              operator_name,
              loss_date
            )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING id, batch_id, operator_name, loss_date::text AS loss_date, product_id, product_name, quantity, observation, unit_price_cents, created_at`,
          [product.id, product.name, item.quantity, observation, product.price_cents ?? 0, batchId, operatorName, lossDate],
        );

        await client.query(
          "UPDATE products SET quantity = GREATEST(quantity - $1, 0), updated_at = NOW() WHERE id = $2",
          [item.quantity, product.id],
        );

        const insertedLoss = insertedResult.rows[0];
        insertedItems.push({
          ...insertedLoss,
          total_cents: (insertedLoss.unit_price_cents ?? 0) * insertedLoss.quantity,
        });
      }

      await client.query("COMMIT");

      return res.status(201).json({
        message: "Perda registrada.",
        items: insertedItems,
      });
    } catch (error) {
      await client.query("ROLLBACK");
      const message = error instanceof Error ? error.message : "Falha ao registrar perda.";
      const status = error instanceof HttpError ? error.status : 500;
      return res.status(status).json({ error: message });
    } finally {
      client.release();
    }
  }

  return res.status(405).json({ error: "Método não permitido." });
}
