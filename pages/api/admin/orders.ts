import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { query } from "../../../lib/db";

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

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Método não permitido." });
  }

  const todayResult = await query<{
    id: number;
    client_name: string | null;
    client_phone: string | null;
    status: string;
    total_cents: number;
    notes: string | null;
    created_at: string;
  }>(
    `SELECT id, client_name, client_phone, status, total_cents, notes, created_at
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
  });
}
