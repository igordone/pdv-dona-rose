import type { NextApiRequest, NextApiResponse } from "next";
import { getPool } from "../../lib/db";
import { consumeRateLimit, getRequestRateLimitKey } from "../../lib/rate-limit";

type Body = {
  sessionId?: string;
  session_id?: string;
  clientName?: string;
  clientPhone?: string;
  notes?: string;
  deliveryMethod?: string;
  deliveryAddress?: string;
  deliveryApartment?: string;
  deliveryBlock?: string;
  paymentMethod?: string;
  items?: Array<{ productId: unknown; quantity: unknown }>;
};

function parsePositiveInteger(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : NaN;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido." });
  }

  const body = req.body as Body;
  const sessionId =
    typeof body.sessionId === "string"
      ? body.sessionId.trim()
      : typeof body.session_id === "string"
        ? body.session_id.trim()
        : "";
  const clientName = typeof body.clientName === "string" ? body.clientName.trim() : "";
  const clientPhone = typeof body.clientPhone === "string" ? body.clientPhone.trim() : "";
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";
  const deliveryMethod = body.deliveryMethod === "delivery" ? "delivery" : "pickup";
  const deliveryApartment = typeof body.deliveryApartment === "string" ? body.deliveryApartment.trim() : "";
  const deliveryBlock = typeof body.deliveryBlock === "string" ? body.deliveryBlock.trim() : "";
  const paymentMethod = body.paymentMethod === "card" || body.paymentMethod === "pix" ? body.paymentMethod : "cash";
  const items = Array.isArray(body.items) ? body.items : [];

  if (items.length === 0) {
    return res.status(400).json({ error: "Adicione ao menos um item ao pedido." });
  }

  const requestIp =
    typeof req.headers["x-forwarded-for"] === "string"
      ? req.headers["x-forwarded-for"].split(",")[0]?.trim() ?? null
      : typeof req.socket.remoteAddress === "string"
        ? req.socket.remoteAddress
      : null;
  const rateLimitKey = getRequestRateLimitKey(requestIp, sessionId);
  const rateLimit = consumeRateLimit(rateLimitKey, 5, 60_000);

  if (!rateLimit.allowed) {
    const retryAfterSeconds = Math.max(1, Math.ceil((rateLimit.resetAt - Date.now()) / 1000));
    res.setHeader("Retry-After", String(retryAfterSeconds));
    return res.status(429).json({ error: "Muitas tentativas. Aguarde alguns segundos e tente novamente." });
  }

  if (!sessionId) {
    return res.status(400).json({ error: "Sessão inválida." });
  }

  if (deliveryMethod === "delivery" && (!clientName || !deliveryApartment || !deliveryBlock)) {
    return res.status(400).json({ error: "Informe nome, apartamento e bloco para entrega." });
  }

  const normalizedItemsMap = new Map<number, number>();

  for (const item of items) {
    const productId = parsePositiveInteger(
      (item as { productId?: unknown; id?: unknown }).productId ?? (item as { productId?: unknown; id?: unknown }).id,
    );
    const quantity = parsePositiveInteger((item as { quantity?: unknown }).quantity);

    if (!Number.isInteger(productId) || !Number.isInteger(quantity)) {
      return res.status(400).json({ error: "Existem itens inválidos no pedido." });
    }

    normalizedItemsMap.set(productId, (normalizedItemsMap.get(productId) ?? 0) + quantity);
  }

  const normalizedItems = Array.from(normalizedItemsMap.entries()).map(([productId, quantity]) => ({
    productId,
    quantity,
  }));

  const productIds = normalizedItems.map((item) => item.productId);

  try {
    const client = await getPool().connect();

    try {
      await client.query("BEGIN");

      const productsResult = await client.query<{
        id: number;
        name: string;
        price_cents: number;
        active: boolean;
      }>(
        `SELECT id, name, price_cents, active
         FROM products
         WHERE id = ANY($1::int[]) AND active = TRUE
         FOR UPDATE`,
        [productIds],
      );

      if (productsResult.rows.length !== normalizedItems.length) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Um ou mais produtos não estão disponíveis." });
      }

      const productMap = new Map(productsResult.rows.map((product) => [product.id, product]));
      let totalCents = 0;

      for (const item of normalizedItems) {
        const product = productMap.get(item.productId);
        if (!product) {
          await client.query("ROLLBACK");
          return res.status(400).json({ error: "Um ou mais produtos não estão disponíveis." });
        }

        totalCents += product.price_cents * item.quantity;
      }

      const orderCodeResult = await client.query<{ code_date: string; last_sequence: number }>(
        `
        INSERT INTO order_code_sequences (code_date, last_sequence)
        VALUES (CURRENT_DATE, 1)
        ON CONFLICT (code_date)
        DO UPDATE SET last_sequence = order_code_sequences.last_sequence + 1
          WHERE order_code_sequences.last_sequence < 9999
        RETURNING code_date, last_sequence
        `,
      );

      if (orderCodeResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Limite diário de códigos de pedido atingido." });
      }

      const orderCodeDate = orderCodeResult.rows[0].code_date;
      const orderCode = String(orderCodeResult.rows[0].last_sequence).padStart(4, "0");

      // Estoque nao e decrementado por venda: a disponibilidade do cardapio
      // e controlada manualmente pelo operador na Gestao, enquanto a entrada
      // real de estoque fica registrada pelo modulo de Compras.
      const orderResult = await client.query<{ id: number; order_code: string }>(
        `INSERT INTO orders (order_code, order_code_date, session_id, client_name, client_phone, notes, delivery_method, delivery_address, payment_method, status, pending_at, total_cents)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pendente', NOW(), $10)
         RETURNING id, order_code`,
        [
          orderCode,
          orderCodeDate,
          sessionId,
          clientName || null,
          clientPhone || null,
          notes || null,
          deliveryMethod,
          deliveryMethod === "delivery"
            ? `Apartamento: ${deliveryApartment} | Bloco: ${deliveryBlock}`
            : null,
          paymentMethod,
          totalCents,
        ],
      );

      const orderId = orderResult.rows[0].id;

      for (const item of normalizedItems) {
        const product = productMap.get(item.productId);
        if (!product) {
          continue;
        }

        const subtotalCents = product.price_cents * item.quantity;

        await client.query(
          `INSERT INTO order_items (order_id, product_id, product_name, unit_price_cents, quantity, subtotal_cents)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [orderId, product.id, product.name, product.price_cents, item.quantity, subtotalCents],
        );
      }

      await client.query("COMMIT");

      return res.status(201).json({
        orderId,
        orderCode,
        totalCents,
        message: "Pedido enviado com sucesso.",
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("order_create_error", error);
    return res.status(500).json({ error: "Falha ao enviar o pedido." });
  }
}
