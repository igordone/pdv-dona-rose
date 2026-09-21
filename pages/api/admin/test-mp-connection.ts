import type { NextApiRequest, NextApiResponse } from "next";
import { requireAdminApiSession } from "../../../lib/admin-access";
import { testMpConnection } from "../../../lib/mercadopago";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Método não permitido." });
  }

  const session = await requireAdminApiSession(req, res);
  if (!session) {
    return;
  }

  const result = await testMpConnection();

  return res.status(200).json(result);
}
