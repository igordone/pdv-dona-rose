import type { NextApiRequest, NextApiResponse } from "next";
import { query } from "../../lib/db";
import { requireAdminApiSession } from "../../lib/admin-access";
import { encrypt, isEncrypted, maskToken } from "../../lib/crypto";
import { invalidateCredentialsCache } from "../../lib/mercadopago";

const PUBLIC_SETTING_KEYS = new Set([
  "pix_qrcode",
  "pix_key",
  "pix_receiver_name",
  "mp_public_key",
]);

const SENSITIVE_KEYS = new Set(["mp_access_token", "mp_webhook_secret"]);

const ENCRYPTED_KEYS = new Set(["mp_access_token", "mp_webhook_secret"]);

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

function maskSettingValue(key: string, value: string | null): string | null {
  if (!value) {
    return value;
  }

  if (SENSITIVE_KEYS.has(key)) {
    return maskToken(value);
  }

  return value;
}

function isMaskedValue(value: string): boolean {
  return value.startsWith("••••");
}

function shouldSkipSave(key: string, value: string): boolean {
  if (!value || !SENSITIVE_KEYS.has(key)) {
    return false;
  }

  return isMaskedValue(value);
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

        const masked = result.rows.map((row) => ({
          key: row.key,
          value: maskSettingValue(row.key, row.value),
        }));

        return res.status(200).json({ settings: masked });
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

        const row = result.rows[0];

        return res.status(200).json({
          setting: {
            key: row?.key ?? key,
            value: row ? maskSettingValue(row.key, row.value) : null,
          },
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
      const rawValue = parseSettingValue(body.value);

      if (!key) {
        return res.status(400).json({ error: "Chave inválida." });
      }

      if (SENSITIVE_KEYS.has(key) && shouldSkipSave(key, rawValue)) {
        return res.status(200).json({ setting: { key, value: maskToken("skip") }, skipped: true });
      }

      let valueToSave = rawValue;

      if (ENCRYPTED_KEYS.has(key) && rawValue && !isEncrypted(rawValue)) {
        valueToSave = encrypt(rawValue);
      }

      const result = await query<{ key: string; value: string | null }>(
        `INSERT INTO settings (key, value)
         VALUES ($1, $2)
         ON CONFLICT (key)
         DO UPDATE SET value = EXCLUDED.value
         RETURNING key, value`,
        [key, valueToSave],
      );

      if (SENSITIVE_KEYS.has(key) || key === "mp_public_key") {
        invalidateCredentialsCache();

        await query(
          `INSERT INTO settings (key, value)
           VALUES ('mp_settings_updated_at', NOW()::text)
           ON CONFLICT (key)
           DO UPDATE SET value = NOW()::text`,
        );
      }

      return res.status(200).json({
        setting: {
          key: result.rows[0].key,
          value: maskSettingValue(result.rows[0].key, result.rows[0].value),
        },
      });
    }

    return res.status(405).json({ error: "Método não permitido." });
  } catch (error) {
    console.error("settings_error");
    return res.status(500).json({ error: "Falha ao carregar as configurações." });
  }
}
