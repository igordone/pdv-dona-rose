import type { NextApiRequest, NextApiResponse } from "next";
import { query } from "../../../lib/db";

function parseId(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : NaN;
}

function normalizeStatus(status: string) {
  if (status === "pending") return "pendente";
  if (status === "completed") return "concluido";
  if (status === "cancelled") return "cancelado";
  return status;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Método não permitido." });
  }

  const id = parseId(req.query.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "Pedido inválido." });
  }

  const sessionId =
    typeof req.query.session_id === "string"
      ? req.query.session_id.trim()
      : typeof req.query.sessionId === "string"
        ? req.query.sessionId.trim()
        : "";

  if (!sessionId) {
    return res.status(400).json({ error: "Sessão inválida." });
  }

  try {
    const orderResult = await query<{
      id: number;
      order_code: string | null;
      session_id: string | null;
      client_name: string | null;
      client_phone: string | null;
      delivery_method: string;
      delivery_address: string | null;
      payment_method: string;
      payment_confirmed_at: string | null;
      status: string;
      pending_at: string;
      preparing_at: string | null;
      on_way_at: string | null;
      completed_at: string | null;
      cancelled_at: string | null;
      total_cents: number;
      notes: string | null;
      created_at: string;
    }>(
      `SELECT id, order_code, session_id, client_name, client_phone, delivery_method, delivery_address, payment_method,
              payment_confirmed_at,
              CASE
                WHEN status = 'pending' THEN 'pendente'
                WHEN status = 'completed' THEN 'concluido'
                WHEN status = 'cancelled' THEN 'cancelado'
                ELSE status
              END AS status,
              pending_at, preparing_at, on_way_at, completed_at, cancelled_at,
              total_cents, notes, created_at
       FROM orders
       WHERE id = $1
         AND session_id = $2`,
      [id, sessionId],
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: "Pedido não encontrado." });
    }

    const itemsResult = await query<{
      order_id: number;
      product_name: string;
      quantity: number;
      unit_price_cents: number;
      subtotal_cents: number;
    }>(
      `SELECT order_id, product_name, quantity, unit_price_cents, subtotal_cents
       FROM order_items
       WHERE order_id = $1
       ORDER BY id ASC`,
      [id],
    );

    const order = orderResult.rows[0];

    return res.status(200).json({
      order: {
        ...order,
        status: normalizeStatus(order.status),
      },
      items: itemsResult.rows,
    });
  } catch (error) {
    console.error("order_detail_error", error);
    return res.status(500).json({ error: "Falha ao carregar o pedido." });
  }
}
