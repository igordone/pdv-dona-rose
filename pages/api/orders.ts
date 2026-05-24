import type { NextApiRequest, NextApiResponse } from "next";
import { getPool } from "../../lib/db";

type Body = {
  clientName?: string;
  clientPhone?: string;
  notes?: string;
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
  const clientName = typeof body.clientName === "string" ? body.clientName.trim() : "";
  const clientPhone = typeof body.clientPhone === "string" ? body.clientPhone.trim() : "";
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";
  const items = Array.isArray(body.items) ? body.items : [];

  if (items.length === 0) {
    return res.status(400).json({ error: "Adicione ao menos um item ao pedido." });
  }

  const normalizedItemsMap = new Map<number, number>();

  for (const item of items) {
    const productId = parsePositiveInteger((item as { productId?: unknown; id?: unknown }).productId ?? (item as { productId?: unknown; id?: unknown }).id);
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

      const orderResult = await client.query<{ id: number }>(
        `INSERT INTO orders (client_name, client_phone, notes, status, total_cents)
         VALUES ($1, $2, $3, 'pending', $4)
         RETURNING id`,
        [clientName || null, clientPhone || null, notes || null, totalCents],
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
