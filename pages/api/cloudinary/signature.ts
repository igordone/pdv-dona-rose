import type { NextApiRequest, NextApiResponse } from "next";
import { getCloudinaryConnection, signCloudinaryParams } from "../../../lib/cloudinary";
import { requireAdminApiSession } from "../../../lib/admin-access";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido." });
  }

  try {
    const session = await requireAdminApiSession(req, res);
    if (!session) {
      return;
    }

    const body = req.body as { paramsToSign?: Record<string, unknown> };
    const paramsToSign = body.paramsToSign ?? {};
    const { apiKey } = getCloudinaryConnection();

    return res.status(200).json({
      signature: signCloudinaryParams(paramsToSign),
      apiKey,
    });
  } catch (error) {
    console.error("cloudinary_signature_error", error);
    return res.status(500).json({ error: "Falha ao gerar assinatura do upload." });
  }
}
