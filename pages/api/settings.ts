import type { NextApiRequest, NextApiResponse } from "next";
import { query } from "../../lib/db";
import { requireAdminApiSession } from "../../lib/admin-access";

const PUBLIC_SETTING_KEYS = new Set(["pix_qrcode", "pix_key", "pix_receiver_name"]);

function parseSettingKey(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseSettingValue(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  if (value == null) {
    return "";
  }

  return String(value);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === "GET") {
      const key = parseSettingKey(req.query.key);
      const isAdminView = req.query.all === "1" || req.query.all === "true";

      if (isAdminView) {
        const session = await requireAdminApiSession(req, res);
        if (!session) {
          return;
        }

        const result = await query<{ key: string; value: string | null }>(
          "SELECT key, value FROM settings ORDER BY key ASC",
        );

        return res.status(200).json({ settings: result.rows });
      }

      if (key) {
        if (!PUBLIC_SETTING_KEYS.has(key)) {
          const session = await requireAdminApiSession(req, res);
          if (!session) {
            return;
          }
        }

        const result = await query<{ key: string; value: string | null }>(
          "SELECT key, value FROM settings WHERE key = $1 LIMIT 1",
          [key],
        );

        return res.status(200).json({
          setting: result.rows[0] ?? { key, value: null },
        });
      }

      const result = await query<{ key: string; value: string | null }>(
        "SELECT key, value FROM settings WHERE key = ANY($1::text[]) ORDER BY key ASC",
        [Array.from(PUBLIC_SETTING_KEYS)],
      );

      return res.status(200).json({ settings: result.rows });
    }

    if (req.method === "POST") {
      const session = await requireAdminApiSession(req, res);
      if (!session) {
        return;
      }

      const body = req.body as Record<string, unknown>;
      const key = parseSettingKey(body.key);
      const value = parseSettingValue(body.value);

      if (!key) {
        return res.status(400).json({ error: "Chave invalida." });
      }

      const result = await query<{ key: string; value: string | null }>(
        `INSERT INTO settings (key, value)
         VALUES ($1, $2)
         ON CONFLICT (key)
         DO UPDATE SET value = EXCLUDED.value
         RETURNING key, value`,
        [key, value],
      );

      return res.status(200).json({ setting: result.rows[0] });
    }

    return res.status(405).json({ error: "Método não permitido." });
  } catch (error) {
    console.error("settings_error", error);
    return res.status(500).json({ error: "Falha ao carregar as configurações." });
  }
}
