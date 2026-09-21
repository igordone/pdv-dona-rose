import type { NextApiRequest, NextApiResponse } from "next";
import { getPool } from "../../../lib/db";
import {
  getMercadoPayment,
  getMpCredentials,
  mapMercadoPagoStatus,
} from "../../../lib/mercadopago";
import { createHmac } from "crypto";

const PROCESSED_NOTIFICATIONS = new Set<string>();

function verifySignature(
  body: string,
  signature: string | null,
  secret: string,
): boolean {
  if (!secret) {
    return true;
  }

  if (!signature) {
    return false;
  }

  try {
    const expected = createHmac("sha256", secret).update(body).digest("hex");
    return signature === expected;
  } catch {
    return false;
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido." });
  }

  const body = req.body as Record<string, unknown> | null;
  const signature =
    typeof req.headers["x-signature"] === "string"
      ? req.headers["x-signature"]
      : null;

  if (!body || typeof body !== "object") {
    return res.status(400).json({ error: "Body inválido." });
  }

  const creds = await getMpCredentials();
  const bodyString = JSON.stringify(body);

  if (!verifySignature(bodyString, signature, creds.webhookSecret)) {
    return res.status(401).json({ error: "Assinatura inválida." });
  }

  const action = typeof body.action === "string" ? body.action : "";
  const data = body.data as Record<string, unknown> | undefined;
  const paymentId =
    typeof data?.id === "string"
      ? data.id
      : typeof data?.id === "number"
        ? String(data.id)
        : null;

  if (action !== "payment" || !paymentId) {
    return res.status(200).json({ received: true });
  }

  const idempotencyKey = `payment:${paymentId}`;
  if (PROCESSED_NOTIFICATIONS.has(idempotencyKey)) {
    return res.status(200).json({ received: true, duplicate: true });
  }

  const payment = await getMercadoPayment(paymentId);

  if (!payment) {
    return res.status(200).json({ received: true, error: "payment_not_found" });
  }

  const externalReference = payment.external_reference;

  if (!externalReference) {
    return res.status(200).json({ received: true, no_reference: true });
  }

  const orderId = Number(externalReference);
  if (!Number.isInteger(orderId) || orderId <= 0) {
    return res.status(200).json({ received: true, invalid_reference: true });
  }

  try {
    const client = await getPool().connect();

    try {
      const orderResult = await client.query<{ id: number; payment_status: string | null }>(
        `SELECT id, payment_status FROM orders WHERE id = $1`,
        [orderId],
      );

      if (orderResult.rows.length === 0) {
        return res.status(200).json({ received: true, order_not_found: true });
      }

      const currentStatus = orderResult.rows[0].payment_status;
      const newStatus = mapMercadoPagoStatus(payment.status);

      if (currentStatus === "aprovado" && newStatus === "aprovado") {
        PROCESSED_NOTIFICATIONS.add(idempotencyKey);
        return res.status(200).json({ received: true, already_processed: true });
      }

      await client.query(
        `UPDATE orders
         SET payment_status = $1,
             payment_id = $2,
             payment_confirmed_at = CASE WHEN $1 = 'aprovado' THEN COALESCE(payment_confirmed_at, NOW()) ELSE payment_confirmed_at END
         WHERE id = $3`,
        [newStatus, paymentId, orderId],
      );

      PROCESSED_NOTIFICATIONS.add(idempotencyKey);

      if (PROCESSED_NOTIFICATIONS.size > 1000) {
        const entries = Array.from(PROCESSED_NOTIFICATIONS);
        for (let i = 0; i < 500; i++) {
          PROCESSED_NOTIFICATIONS.delete(entries[i]);
        }
      }

      return res.status(200).json({ received: true, status: newStatus });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("webhook_mercadopago_error");
    return res.status(200).json({ received: true, error: "internal_error" });
  }
}
