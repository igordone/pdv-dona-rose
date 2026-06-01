import type { NextApiRequest, NextApiResponse } from "next";
import { query } from "../../lib/db";

type ResponseBody =
  | {
      items: Array<{
        id: number;
        name: string;
        price_cents: number;
        quantity: number;
        active: boolean;
        image_path: string | null;
        category_id: number | null;
        category_name: string | null;
      }>;
    }
  | { error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseBody>,
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Método não permitido." });
  }

  try {
    const result = await query<{
      id: number;
      name: string;
      price_cents: number;
      quantity: number;
      active: boolean;
      image_path: string | null;
      category_id: number | null;
      category_name: string | null;
    }>(
      `SELECT p.id, p.name, p.price_cents, p.quantity, p.active, p.image_path, p.category_id, c.name AS category_name
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.active = TRUE
       ORDER BY COALESCE(c.name, 'ZZZ'), p.name ASC`,
    );

    return res.status(200).json({ items: result.rows });
  } catch (error) {
    console.error("menu_error", error);
    return res.status(500).json({ error: "Falha ao carregar o cardápio." });
  }
}
