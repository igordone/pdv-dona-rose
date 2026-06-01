import { randomUUID } from "crypto";
import type { NextApiRequest, NextApiResponse } from "next";
import { getPool, query } from "../../../lib/db";
import { requireAdminApiSession } from "../../../lib/admin-access";

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type PurchaseSourceType = "menu" | "purchase";

function getLocalDateKey(date = new Date()) {
  return date.toLocaleDateString("en-CA");
}

function parsePurchaseItems(body: Record<string, unknown>) {
  if (!Array.isArray(body.items)) {
    return [];
  }

  return body.items
    .map((item) => {
      const value = item as Record<string, unknown>;
      const legacyProductId = Number(value.productId);
      const sourceTypeRaw =
        typeof value.sourceType === "string" && value.sourceType.trim()
          ? value.sourceType.trim()
          : Number.isInteger(legacyProductId) && legacyProductId > 0
            ? "menu"
            : "";
      const sourceType = sourceTypeRaw === "menu" || sourceTypeRaw === "purchase" ? sourceTypeRaw : "";
      const sourceId = Number(value.sourceId ?? value.productId);
      const quantity = Number(value.quantity);

      return {
        sourceType,
        sourceId,
        quantity,
      };
    })
    .filter(
      (item) =>
        (item.sourceType === "menu" || item.sourceType === "purchase") &&
        Number.isInteger(item.sourceId) &&
        item.sourceId > 0 &&
        Number.isInteger(item.quantity) &&
        item.quantity > 0,
    ) as Array<{
    sourceType: PurchaseSourceType;
    sourceId: number;
    quantity: number;
  }>;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireAdminApiSession(req, res);
  if (!session) {
    return;
  }

  if (req.method === "GET") {
    const result = await query<{
      id: number;
      batch_id: string | null;
      operator_name: string | null;
      purchase_date: string;
      observation: string | null;
      total_cents: number;
      created_at: string;
      item_id: number;
      source_type: string;
      source_id: number | null;
      product_id: number | null;
      product_name: string;
      brand: string | null;
      quantity: number;
      unit_cost_cents: number;
      subtotal_cents: number;
    }>(
      `SELECT p.id,
              p.batch_id,
              p.operator_name,
              p.purchase_date::text AS purchase_date,
              p.observation,
              p.total_cents,
              p.created_at,
              pi.id AS item_id,
              pi.source_type,
              pi.source_id,
              pi.product_id,
              COALESCE(pi.product_name, pr.name) AS product_name,
              COALESCE(pi.brand, pr.brand) AS brand,
              pi.quantity,
              pi.unit_cost_cents,
              pi.subtotal_cents
       FROM purchases p
       LEFT JOIN purchase_items pi ON pi.purchase_id = p.id
       LEFT JOIN products pr ON pr.id = pi.product_id
       ORDER BY p.purchase_date DESC, p.created_at DESC, p.id DESC, pi.id ASC`,
    );

    return res.status(200).json({ items: result.rows });
  }

  if (req.method === "POST") {
    const body = req.body as Record<string, unknown>;
    const purchaseDate =
      typeof body.purchaseDate === "string" && body.purchaseDate.trim() ? body.purchaseDate.trim() : getLocalDateKey();
    const observation = typeof body.observation === "string" ? body.observation.trim() : "";
    const operatorName =
      typeof session.user?.name === "string" && session.user.name.trim() ? session.user.name.trim() : "Colaborador";
    const items = parsePurchaseItems(body);

    if (items.length === 0) {
      return res.status(400).json({ error: "Adicione ao menos um item comprado." });
    }

    const client = await getPool().connect();
    const batchId = randomUUID();

    try {
      await client.query("BEGIN");

      let totalCents = 0;
      const insertedItems: Array<{
        id: number;
        batch_id: string | null;
        operator_name: string | null;
        purchase_date: string;
        observation: string | null;
        total_cents: number;
        created_at: string;
        item_id: number;
        source_type: PurchaseSourceType;
        source_id: number | null;
        product_id: number | null;
        product_name: string;
        brand: string | null;
        quantity: number;
        unit_cost_cents: number;
        subtotal_cents: number;
      }> = [];

      const productMap = new Map<
        number,
        {
          id: number;
          name: string;
          brand: string | null;
          cost_cents: number;
        }
      >();

      const catalogMap = new Map<
        number,
        {
          id: number;
          name: string;
          brand: string | null;
          cost_cents: number;
        }
      >();

      for (const item of items) {
        if (item.sourceType === "menu") {
          const productResult = await client.query<{
            id: number;
            name: string;
            brand: string | null;
            cost_cents: number;
          }>("SELECT id, name, brand, cost_cents FROM products WHERE id = $1 LIMIT 1", [item.sourceId]);

          if (productResult.rows.length === 0) {
            throw new HttpError(400, "Item do cardápio não encontrado.");
          }

          productMap.set(item.sourceId, productResult.rows[0]);
          continue;
        }

        const catalogResult = await client.query<{
          id: number;
          name: string;
          brand: string | null;
          cost_cents: number;
        }>("SELECT id, name, brand, cost_cents FROM purchase_catalog_items WHERE id = $1 LIMIT 1", [
          item.sourceId,
        ]);

        if (catalogResult.rows.length === 0) {
          throw new HttpError(400, "Item de compra não encontrado.");
        }

        catalogMap.set(item.sourceId, catalogResult.rows[0]);
      }

      const purchaseResult = await client.query<{
        id: number;
        batch_id: string | null;
        operator_name: string | null;
        purchase_date: string;
        observation: string | null;
        total_cents: number;
        created_at: string;
      }>(
        `INSERT INTO purchases (batch_id, operator_name, purchase_date, observation, total_cents)
         VALUES ($1, $2, $3, $4, 0)
         RETURNING id, batch_id, operator_name, purchase_date::text AS purchase_date, observation, total_cents, created_at`,
        [batchId, operatorName, purchaseDate, observation || null],
      );

      const purchase = purchaseResult.rows[0];

      for (const item of items) {
        const sourceItem = item.sourceType === "menu" ? productMap.get(item.sourceId) : catalogMap.get(item.sourceId);

        if (!sourceItem) {
          throw new HttpError(400, item.sourceType === "menu" ? "Item do cardápio não encontrado." : "Item de compra não encontrado.");
        }

        const unitCostCents = sourceItem.cost_cents ?? 0;
        const subtotalCents = unitCostCents * item.quantity;
        totalCents += subtotalCents;

        const insertedResult = await client.query<{
          id: number;
          source_type: PurchaseSourceType;
          source_id: number | null;
          product_id: number | null;
          product_name: string;
          brand: string | null;
          quantity: number;
          unit_cost_cents: number;
          subtotal_cents: number;
        }>(
          `INSERT INTO purchase_items (
              purchase_id,
              source_type,
              source_id,
              product_id,
              product_name,
              brand,
              quantity,
              unit_cost_cents,
              subtotal_cents
            )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING id, source_type, source_id, product_id, product_name, brand, quantity, unit_cost_cents, subtotal_cents`,
          [
            purchase.id,
            item.sourceType,
            item.sourceId,
            item.sourceType === "menu" ? sourceItem.id : null,
            sourceItem.name,
            sourceItem.brand,
            item.quantity,
            unitCostCents,
            subtotalCents,
          ],
        );

        if (item.sourceType === "menu") {
          await client.query("UPDATE products SET quantity = quantity + $1, updated_at = NOW() WHERE id = $2", [
            item.quantity,
            sourceItem.id,
          ]);
        }

        insertedItems.push({
          ...purchase,
          total_cents: subtotalCents,
          item_id: insertedResult.rows[0].id,
          source_type: insertedResult.rows[0].source_type,
          source_id: insertedResult.rows[0].source_id,
          product_id: insertedResult.rows[0].product_id,
          product_name: insertedResult.rows[0].product_name,
          brand: insertedResult.rows[0].brand,
          quantity: insertedResult.rows[0].quantity,
          unit_cost_cents: insertedResult.rows[0].unit_cost_cents,
          subtotal_cents: insertedResult.rows[0].subtotal_cents,
        });
      }

      await client.query("UPDATE purchases SET total_cents = $1 WHERE id = $2", [totalCents, purchase.id]);

      await client.query("COMMIT");

      return res.status(201).json({
        message: "Compra registrada.",
        items: insertedItems.map((item) => ({
          ...item,
          total_cents: totalCents,
        })),
      });
    } catch (error) {
      await client.query("ROLLBACK");
      const message = error instanceof Error ? error.message : "Falha ao registrar compra.";
      const status = error instanceof HttpError ? error.status : 500;
      return res.status(status).json({ error: message });
    } finally {
      client.release();
    }
  }

  return res.status(405).json({ error: "Método não permitido." });
}
