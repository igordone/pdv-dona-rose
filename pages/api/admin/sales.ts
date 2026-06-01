import type { NextApiRequest, NextApiResponse } from "next";
import { query } from "../../../lib/db";
import { requireAdminApiSession } from "../../../lib/admin-access";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireAdminApiSession(req, res);
  if (!session) {
    return;
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Método não permitido." });
  }

  const ordersResult = await query<{
    id: number;
    order_code: string | null;
    client_name: string | null;
    client_phone: string | null;
    status: string;
    total_cents: number;
    notes: string | null;
    created_at: string;
    order_date: string;
  }>(
    `SELECT id, order_code, client_name, client_phone,
            CASE
              WHEN status = 'pending' THEN 'pendente'
              WHEN status = 'completed' THEN 'concluido'
              WHEN status = 'cancelled' THEN 'cancelado'
              ELSE status
            END AS status,
            total_cents, notes, created_at, created_at::date::text AS order_date
     FROM orders
     WHERE status IN ('concluido', 'completed')
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
    [ordersResult.rows.map((order) => order.id)],
  );

  return res.status(200).json({
    orders: ordersResult.rows,
    items: itemsResult.rows,
  });
}
