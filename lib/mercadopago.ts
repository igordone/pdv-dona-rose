import { MercadoPagoConfig, Preference, Payment } from "mercadopago";
import { query } from "./db";
import { decrypt } from "./crypto";

const NEXTAUTH_URL = process.env.NEXTAUTH_URL || "http://localhost:3000";
const MP_TIMEOUT_MS = 10000;
const CACHE_TTL_MS = 60_000;

interface MpCredentials {
  accessToken: string;
  publicKey: string;
  webhookSecret: string;
}

let credentialsCache: (MpCredentials & { expiresAt: number }) | null = null;

export function invalidateCredentialsCache(): void {
  credentialsCache = null;
}

export async function getMpCredentials(): Promise<MpCredentials> {
  if (credentialsCache && Date.now() < credentialsCache.expiresAt) {
    return credentialsCache;
  }

  let accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN || "";
  let publicKey = process.env.MERCADO_PAGO_PUBLIC_KEY || "";
  let webhookSecret = process.env.MERCADO_PAGO_WEBHOOK_SECRET || "";

  try {
    const result = await query<{ key: string; value: string | null }>(
      `SELECT key, value FROM settings
       WHERE key IN ('mp_access_token', 'mp_public_key', 'mp_webhook_secret')`,
    );

    for (const row of result.rows) {
      if (!row.value) {
        continue;
      }

      switch (row.key) {
        case "mp_access_token":
          accessToken = decrypt(row.value);
          break;
        case "mp_public_key":
          publicKey = row.value;
          break;
        case "mp_webhook_secret":
          webhookSecret = decrypt(row.value);
          break;
      }
    }
  } catch {
    // Fallback para environment variables
  }

  credentialsCache = {
    accessToken,
    publicKey,
    webhookSecret,
    expiresAt: Date.now() + CACHE_TTL_MS,
  };

  return credentialsCache;
}

export async function isMercadoPagoConfigured(): Promise<boolean> {
  const creds = await getMpCredentials();
  return Boolean(creds.accessToken && creds.publicKey);
}

export async function getMercadoPagoPublicKey(): Promise<string | null> {
  const creds = await getMpCredentials();
  return creds.publicKey || null;
}

function getClient(accessToken: string): MercadoPagoConfig | null {
  if (!accessToken) {
    return null;
  }
  return new MercadoPagoConfig({ accessToken });
}

export function getWebhookUrl(host?: string): string {
  const appUrl = process.env.APP_URL || host || "localhost:3000";
  const protocol = appUrl.includes("localhost") ? "http" : "https";
  return `${protocol}://${appUrl}/api/webhooks/mercadopago`;
}

export type MercadoPreferenceResult =
  | {
      ok: true;
      preferenceId: string;
      initPoint: string;
    }
  | { ok: false; error: string };

export type PixPaymentResult =
  | {
      ok: true;
      orderId: string;
      paymentId: string;
      qrCodeBase64: string;
      copiaECola: string;
      ticketUrl: string;
    }
  | { ok: false; error: string };

export async function createPixPayment(params: {
  orderId: number;
  orderCode: string;
  totalCents: number;
  clientEmail: string;
  host?: string;
}): Promise<PixPaymentResult> {
  const creds = await getMpCredentials();

  if (!creds.accessToken) {
    return { ok: false, error: "Mercado Pago não configurado." };
  }

  const title = `Pedido ${params.orderCode || params.orderId} - Salgados da Dona Rose`;

  try {
    const response = await fetch("https://api.mercadopago.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${creds.accessToken}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": `order-${params.orderId}-${Date.now()}`,
      },
      body: JSON.stringify({
        type: "online",
        total_amount: (params.totalCents / 100).toFixed(2),
        external_reference: String(params.orderId),
        processing_mode: "automatic",
        description: title,
        payer: {
          email: params.clientEmail,
        },
        transactions: {
          payments: [
            {
              amount: (params.totalCents / 100).toFixed(2),
              payment_method: {
                id: "pix",
                type: "bank_transfer",
              },
            },
          ],
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      const errorMessage =
        errorData?.message ?? errorData?.error ?? `HTTP ${response.status}`;
      console.error("mercadopago_orders_api_error", errorMessage);
      return { ok: false, error: `Erro ao criar pagamento PIX: ${errorMessage}` };
    }

    const data = (await response.json()) as {
      id: string;
      status: string;
      transactions?: {
        payments?: Array<{
          id: string;
          payment_method?: {
            qr_code_base64?: string;
            qr_code?: string;
            ticket_url?: string;
          };
        }>;
      };
    };

    const payment = data.transactions?.payments?.[0];
    const qrCodeBase64 = payment?.payment_method?.qr_code_base64 ?? "";
    const copiaECola = payment?.payment_method?.qr_code ?? "";
    const ticketUrl = payment?.payment_method?.ticket_url ?? "";

    if (!qrCodeBase64 && !copiaECola) {
      console.error("mercadopago_orders_no_pix_data", data);
      return { ok: false, error: "Dados do PIX não foram retornados." };
    }

    return {
      ok: true,
      orderId: data.id ?? "",
      paymentId: payment?.id ?? "",
      qrCodeBase64,
      copiaECola,
      ticketUrl,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro desconhecido";

    console.error("mercadopago_create_pix_error");

    if (message.includes("abort") || message.includes("timeout")) {
      return { ok: false, error: "Timeout ao conectar com Mercado Pago." };
    }

    return { ok: false, error: `Erro ao criar pagamento PIX: ${message}` };
  }
}

export async function createMercadoPreference(params: {
  orderId: number;
  orderCode: string;
  totalCents: number;
  items: Array<{ name: string; quantity: number; unitPriceCents: number }>;
  host?: string;
}): Promise<MercadoPreferenceResult> {
  const creds = await getMpCredentials();
  const client = getClient(creds.accessToken);

  if (!client) {
    return { ok: false, error: "Mercado Pago não configurado." };
  }

  const webhookUrl = getWebhookUrl(params.host);

  const preference = new Preference(client);

  const title =
    params.items.length === 1
      ? `${params.items[0].name} - Pedido #${params.orderId}`
      : `Pedido #${params.orderId} - Salgados da Dona Rose`;

  try {
    const result = await preference.create({
      body: {
        items: [
          {
            id: String(params.orderId),
            title,
            quantity: 1,
            unit_price: params.totalCents / 100,
            currency_id: "BRL",
          },
        ],
        external_reference: String(params.orderId),
        notification_url: webhookUrl,
        binary_mode: true,
        expires: true,
        expiration_date_to: new Date(
          Date.now() + 30 * 60 * 1000,
        ).toISOString(),
        payment_methods: {
          excluded_payment_types: [
            { id: "credit_card" },
            { id: "debit_card" },
            { id: "bolbex" },
            { id: "ticket" },
          ],
          installments: 1,
        },
        statement_descriptor: "SALGADOS DA ROSE",
        metadata: {
          order_id: params.orderId,
          order_code: params.orderCode,
        },
        back_urls: {
          success: `${NEXTAUTH_URL}?payment=success&order=${params.orderId}`,
          failure: `${NEXTAUTH_URL}?payment=failure&order=${params.orderId}`,
          pending: `${NEXTAUTH_URL}?payment=pending&order=${params.orderId}`,
        },
      },
    });

    const initPoint =
      typeof result.init_point === "string" ? result.init_point : "";
    const sandboxInitPoint =
      typeof result.sandbox_init_point === "string"
        ? result.sandbox_init_point
        : "";

    const checkoutUrl = sandboxInitPoint || initPoint;

    if (!checkoutUrl) {
      return { ok: false, error: "URL de checkout não foi gerada." };
    }

    return {
      ok: true,
      preferenceId: result.id ?? "",
      initPoint: checkoutUrl,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro desconhecido";

    console.error("mercadopago_create_preference_error");

    if (message.includes("abort") || message.includes("timeout")) {
      return { ok: false, error: "Timeout ao conectar com Mercado Pago." };
    }

    return { ok: false, error: `Erro ao criar checkout: ${message}` };
  }
}

export type MercadoPaymentResult = {
  id: number;
  status: string;
  external_reference: string | null;
  transaction_amount: number;
};

export async function getMercadoPayment(
  paymentId: string,
): Promise<MercadoPaymentResult | null> {
  const creds = await getMpCredentials();
  const client = getClient(creds.accessToken);

  if (!client) {
    return null;
  }

  const paymentClient = new Payment(client);

  try {
    const result = await paymentClient.get({ id: paymentId });

    return {
      id: result.id ?? 0,
      status: result.status ?? "unknown",
      external_reference: result.external_reference ?? null,
      transaction_amount: result.transaction_amount ?? 0,
    };
  } catch {
    return null;
  }
}

export function mapMercadoPagoStatus(
  mpStatus: string,
): "pendente" | "processando" | "aprovado" | "rejeitado" | "cancelado" | "reembolsado" {
  switch (mpStatus) {
    case "approved":
    case "paid":
      return "aprovado";
    case "pending":
    case "in_process":
    case "in_review":
    case "action_required":
    case "waiting_transfer":
      return "processando";
    case "rejected":
    case "refused":
      return "rejeitado";
    case "cancelled":
    case "expired":
    case "voided":
      return "cancelado";
    case "refunded":
    case "charged_back":
      return "reembolsado";
    default:
      return "pendente";
  }
}

export async function testMpConnection(): Promise<{
  connected: boolean;
  nickname?: string;
  siteId?: string;
  environment?: string;
  error?: string;
}> {
  const creds = await getMpCredentials();

  if (!creds.accessToken) {
    return { connected: false, error: "Access Token não configurado." };
  }

  try {
    const response = await fetch("https://api.mercadopago.com/users/me", {
      headers: { Authorization: `Bearer ${creds.accessToken}` },
    });

    if (!response.ok) {
      return { connected: false, error: "Credenciais inválidas." };
    }

    const data = (await response.json()) as {
      nickname?: string;
      site_id?: string;
      tags?: string[];
    };

    const isTestUser = data.tags?.includes("test_user") ?? false;

    return {
      connected: true,
      nickname: data.nickname ?? "Desconhecido",
      siteId: data.site_id ?? "Desconhecido",
      environment: isTestUser ? "sandbox" : "produção",
    };
  } catch {
    return { connected: false, error: "Falha ao conectar com Mercado Pago." };
  }
}

export function verifyWebhookSignature(
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

  return true;
}
