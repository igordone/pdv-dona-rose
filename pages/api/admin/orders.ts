import type { NextApiRequest, NextApiResponse } from "next";
import { getPool, query } from "../../../lib/db";
import { requireAdminApiSession } from "../../../lib/admin-access";

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
      const unreadResult = await query<{ unread_count: number }>(
        `SELECT COUNT(*)::int AS unread_count
         FROM orders
         WHERE created_at::date = CURRENT_DATE
           AND viewed_at IS NULL`,
      );

      if (req.query.summary === "1") {
        return res.status(200).json({ unread_count: unreadResult.rows[0]?.unread_count ?? 0 });
      }

      const todayResult = await query<{
        id: number;
        order_code: string | null;
        client_name: string | null;
        client_phone: string | null;
        delivery_method: string;
        delivery_address: string | null;
        payment_method: string;
        payment_confirmed_at: string | null;
        status: string;
        total_cents: number;
        notes: string | null;
        created_at: string;
        viewed_at: string | null;
      }>(
        `SELECT id, order_code, client_name, client_phone, delivery_method, delivery_address, payment_method, payment_confirmed_at,
                CASE
                  WHEN status = 'pending' THEN 'pendente'
                  WHEN status = 'completed' THEN 'concluido'
                  WHEN status = 'cancelled' THEN 'cancelado'
                  ELSE status
                END AS status,
                total_cents, notes, created_at, viewed_at
         FROM orders
         WHERE created_at::date = CURRENT_DATE
         ORDER BY created_at DESC`,
      );

      const itemsResult = await query<{
        order_id: number;
        product_name: string;
        quantity: number;
        unit_price_cents: number;
        subtotal_cents: number;
      }>(
        `SELECT order_id, product_name, quantity, unit_price_cents, subtotal_cents
         FROM order_items
         WHERE order_id = ANY($1::int[])`,
        [todayResult.rows.map((order) => order.id)],
      );

      return res.status(200).json({
        orders: todayResult.rows,
        items: itemsResult.rows,
        unread_count: unreadResult.rows[0]?.unread_count ?? 0,
      });
    }

    if (req.method === "PATCH") {
      const body = req.body as Record<string, unknown>;
      const id = parseId(body.id);

      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ error: "Pedido inválido." });
      }

      const client = await getPool().connect();

      try {
        const result = await client.query<{
          id: number;
          viewed_at: string | null;
        }>(
          `UPDATE orders
           SET viewed_at = COALESCE(viewed_at, NOW())
           WHERE id = $1
           RETURNING id, viewed_at`,
          [id],
        );

        if (result.rows.length === 0) {
          return res.status(404).json({ error: "Pedido não encontrado." });
        }

        return res.status(200).json({ id: result.rows[0].id, viewed_at: result.rows[0].viewed_at });
      } finally {
        client.release();
      }
    }

  return res.status(405).json({ error: "Método não permitido." });
}
