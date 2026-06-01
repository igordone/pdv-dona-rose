import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]";
import { getPool } from "../../../../lib/db";

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

function normalizeStatus(status: unknown) {
  if (status === "pending") return "pendente";
  if (status === "completed") return "concluido";
  if (status === "cancelled") return "cancelado";

  return status;
}

function isPaymentConfirmationAction(value: unknown) {
  return value === "confirm_payment" || value === "confirmar_pagamento";
}

const allowedStatuses = new Set([
  "pendente",
  "em_preparo",
  "a_caminho",
  "concluido",
  "cancelado",
]);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const id = parseId(req.query.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "Pedido inválido." });
  }

  if (req.method !== "PATCH") {
    return res.status(405).json({ error: "Método não permitido." });
  }

  const session = await ensureAdmin(req, res);
  if (!session) {
    return;
  }

  const body = req.body as Record<string, unknown>;
  const isConfirmingPayment = isPaymentConfirmationAction(body.action) || body.paymentConfirmed === true;
  const nextStatus = normalizeStatus(body.status);

  if (!isConfirmingPayment && (typeof nextStatus !== "string" || !allowedStatuses.has(nextStatus))) {
    return res.status(400).json({ error: "Status inválido." });
  }

  try {
    const client = await getPool().connect();
    try {
      const result = isConfirmingPayment
        ? await client.query<{
            id: number;
            status: string;
            payment_confirmed_at: string | null;
          }>(
            `UPDATE orders
             SET payment_confirmed_at = COALESCE(payment_confirmed_at, NOW())
             WHERE id = $1
             RETURNING id, status, payment_confirmed_at`,
            [id],
          )
        : await client.query<{
            id: number;
            status: string;
            payment_confirmed_at: string | null;
          }>(
            `UPDATE orders
             SET status = $2::varchar,
                 preparing_at = CASE WHEN $2::varchar = 'em_preparo' AND preparing_at IS NULL THEN NOW() ELSE preparing_at END,
                 on_way_at = CASE WHEN $2::varchar = 'a_caminho' AND on_way_at IS NULL THEN NOW() ELSE on_way_at END,
                 completed_at = CASE WHEN $2::varchar = 'concluido' AND completed_at IS NULL THEN NOW() ELSE completed_at END,
                 cancelled_at = CASE WHEN $2::varchar = 'cancelado' AND cancelled_at IS NULL THEN NOW() ELSE cancelled_at END
             WHERE id = $1
             RETURNING id, status, payment_confirmed_at`,
            [id, nextStatus],
          );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Pedido não encontrado." });
      }

      return res.status(200).json({
        id: result.rows[0].id,
        status: normalizeStatus(result.rows[0].status),
        payment_confirmed_at: result.rows[0].payment_confirmed_at,
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("order_status_update_error", error);
    return res.status(500).json({ error: "Falha ao atualizar o pedido." });
  }
}
