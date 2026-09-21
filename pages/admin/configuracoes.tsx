import type { GetServerSideProps } from "next";
import { useEffect, useState, type FormEvent } from "react";
import { CldUploadWidget } from "next-cloudinary";
import { AdminLayout } from "../../components/AdminLayout";
import { useFeedback } from "../../components/Feedback";
import { requireAdminPageSession } from "../../lib/admin-access";

type SettingsResponse =
  | {
      settings: Array<{ key: string; value: string | null }>;
    }
  | {
      setting: { key: string; value: string | null };
    }
  | {
      error: string;
    };

type SettingsMap = Record<string, string>;

type MpConnectionResult = {
  connected: boolean;
  nickname?: string;
  siteId?: string;
  environment?: string;
  error?: string;
};

export const getServerSideProps: GetServerSideProps = async (context) => {
  const adminRedirect = await requireAdminPageSession(context);
  if (adminRedirect) {
    return adminRedirect;
  }

  return { props: {} };
};

function normalizeSettings(settings: Array<{ key: string; value: string | null }>) {
  return settings.reduce<SettingsMap>((acc, setting) => {
    acc[setting.key] = setting.value ?? "";
    return acc;
  }, {});
}

function ConfigFeatureCard({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <article className="card card-pad admin-config-feature-card">
      <div className="admin-config-feature-icon">
        <span className="material-symbols-outlined" aria-hidden="true">
          {icon}
        </span>
      </div>
      <div>
        <strong className="admin-config-feature-title">{title}</strong>
        <p className="admin-config-feature-description">{description}</p>
      </div>
    </article>
  );
}

export default function AdminConfiguracoesPage() {
  const { toast } = useFeedback();

  const [pixQrCode, setPixQrCode] = useState("");
  const [pixKey, setPixKey] = useState("");
  const [receiverName, setReceiverName] = useState("");
  const [pixLoading, setPixLoading] = useState(false);
  const [pixLoaded, setPixLoaded] = useState(false);

  const [mpAccessToken, setMpAccessToken] = useState("");
  const [mpPublicKey, setMpPublicKey] = useState("");
  const [mpWebhookSecret, setMpWebhookSecret] = useState("");
  const [mpLoading, setMpLoading] = useState(false);
  const [mpLoaded, setMpLoaded] = useState(false);

  const [connectionStatus, setConnectionStatus] = useState<MpConnectionResult | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);

  const [showAccessToken, setShowAccessToken] = useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadSettings() {
      try {
        const response = await fetch("/api/settings?all=1");
        const payload = (await response.json().catch(() => null)) as SettingsResponse | null;

        if (!mounted || !response.ok || !payload || "error" in payload) {
          return;
        }

        const settings = "settings" in payload ? payload.settings : [payload.setting];
        const mapped = normalizeSettings(settings);

        setPixQrCode(mapped.pix_qrcode ?? "");
        setPixKey(mapped.pix_key ?? "");
        setReceiverName(mapped.pix_receiver_name ?? "");
        setMpAccessToken(mapped.mp_access_token ?? "");
        setMpPublicKey(mapped.mp_public_key ?? "");
        setMpWebhookSecret(mapped.mp_webhook_secret ?? "");
      } catch {
        if (mounted) {
          setPixQrCode("");
          setPixKey("");
          setReceiverName("");
          setMpAccessToken("");
          setMpPublicKey("");
          setMpWebhookSecret("");
        }
      } finally {
        if (mounted) {
          setPixLoaded(true);
          setMpLoaded(true);
        }
      }
    }

    void loadSettings();

    return () => {
      mounted = false;
    };
  }, []);

  async function saveSetting(key: string, value: string) {
    const response = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value }),
    });

    const payload = (await response.json().catch(() => null)) as { error?: string; skipped?: boolean } | null;

    if (!response.ok) {
      throw new Error(payload?.error ?? "Falha ao salvar a configuração.");
    }
  }

  async function handlePixSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPixLoading(true);

    try {
      await Promise.all([
        saveSetting("pix_qrcode", pixQrCode),
        saveSetting("pix_key", pixKey),
        saveSetting("pix_receiver_name", receiverName),
      ]);

      toast({
        title: "Configurações salvas",
        description: "Os dados do PIX estático foram atualizados.",
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Falha ao salvar",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "error",
      });
    } finally {
      setPixLoading(false);
    }
  }

  async function handleMpSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMpLoading(true);

    try {
      await Promise.all([
        saveSetting("mp_access_token", mpAccessToken),
        saveSetting("mp_public_key", mpPublicKey),
        saveSetting("mp_webhook_secret", mpWebhookSecret),
      ]);

      setConnectionStatus(null);

      toast({
        title: "Credenciais salvas",
        description: "As credenciais do Mercado Pago foram atualizadas. Teste a conexão para verificar.",
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Falha ao salvar",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "error",
      });
    } finally {
      setMpLoading(false);
    }
  }

  async function testConnection() {
    setTestingConnection(true);
    setConnectionStatus(null);

    try {
      const response = await fetch("/api/admin/test-mp-connection");
      const result = (await response.json().catch(() => null)) as MpConnectionResult | null;

      if (!response.ok || !result) {
        setConnectionStatus({ connected: false, error: "Falha ao testar conexão." });
        return;
      }

      setConnectionStatus(result);
    } catch {
      setConnectionStatus({ connected: false, error: "Erro de conexão." });
    } finally {
      setTestingConnection(false);
    }
  }

  return (
    <AdminLayout
      title="Configurações"
      subtitle="Configure o gateway de pagamento, PIX estático e dados do estabelecimento."
    >
      <div className="admin-config-page">

        <section className="card admin-config-hero">
          <div>
            <h2 className="admin-config-hero-title">Gateway de Pagamento</h2>
            <p className="admin-config-hero-subtitle">
              Configure as credenciais do Mercado Pago para aceitar pagamentos PIX automaticamente.
            </p>
          </div>
          {connectionStatus?.connected ? (
            <span className="pill admin-config-hero-pill" style={{ background: "rgba(34,197,94,0.12)", color: "var(--success, #16a34a)" }}>
              Conectado
            </span>
          ) : (
            <span className="pill admin-config-hero-pill" style={{ background: "rgba(239,68,68,0.12)", color: "var(--danger, #dc2626)" }}>
              Não configurado
            </span>
          )}
        </section>

        {connectionStatus?.connected && connectionStatus.nickname ? (
          <section className="card admin-config-callout" style={{ borderLeftColor: "var(--success, #16a34a)" }}>
            <div className="admin-config-callout-icon" style={{ background: "rgba(34,197,94,0.14)" }}>
              <span className="material-symbols-outlined" style={{ color: "var(--success, #16a34a)" }}>
                check_circle
              </span>
            </div>
            <div className="admin-config-callout-copy">
              <h3 className="admin-config-callout-title">Conectado como {connectionStatus.nickname}</h3>
              <p className="admin-config-callout-text">
                Ambiente: {connectionStatus.environment} · Site: {connectionStatus.siteId}
              </p>
            </div>
          </section>
        ) : connectionStatus && !connectionStatus.connected ? (
          <section className="card admin-config-callout" style={{ borderLeftColor: "var(--danger, #dc2626)" }}>
            <div className="admin-config-callout-icon" style={{ background: "rgba(239,68,68,0.14)" }}>
              <span className="material-symbols-outlined" style={{ color: "var(--danger, #dc2626)" }}>
                error
              </span>
            </div>
            <div className="admin-config-callout-copy">
              <h3 className="admin-config-callout-title">Falha na conexão</h3>
              <p className="admin-config-callout-text">
                {connectionStatus.error ?? "Verifique as credenciais e tente novamente."}
              </p>
            </div>
          </section>
        ) : null}

        <form className="admin-config-stack" onSubmit={handleMpSubmit}>
          <section className="card admin-config-main-card">
            <div className="admin-config-form-column" style={{ padding: "22px 24px 24px" }}>

                <label className="public-form-field admin-config-field">
                  <span className="public-form-label">Access Token</span>
                  <div style={{ position: "relative" }}>
                    <input
                      className="input admin-config-input"
                      type={showAccessToken ? "text" : "password"}
                      value={mpAccessToken}
                      onChange={(event) => setMpAccessToken(event.target.value)}
                      placeholder="APP_USR-... ou deixe em branco para manter"
                      style={{ paddingRight: 48 }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowAccessToken(!showAccessToken)}
                      style={{
                        position: "absolute",
                        right: 8,
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: 4,
                        color: "var(--muted)",
                      }}
                      aria-label={showAccessToken ? "Ocultar token" : "Mostrar token"}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                        {showAccessToken ? "visibility_off" : "visibility"}
                      </span>
                    </button>
                  </div>
                  <span className="muted" style={{ fontSize: 12 }}>
                    Deixe vazio ou com •••• para manter o valor atual.
                  </span>
                </label>

                <label className="public-form-field admin-config-field">
                  <span className="public-form-label">Public Key</span>
                  <input
                    className="input admin-config-input"
                    value={mpPublicKey}
                    onChange={(event) => setMpPublicKey(event.target.value)}
                    placeholder="APP_USR-..."
                  />
                </label>

                <label className="public-form-field admin-config-field">
                  <span className="public-form-label">Webhook Secret (opcional)</span>
                  <div style={{ position: "relative" }}>
                    <input
                      className="input admin-config-input"
                      type={showWebhookSecret ? "text" : "password"}
                      value={mpWebhookSecret}
                      onChange={(event) => setMpWebhookSecret(event.target.value)}
                      placeholder="Segredo para validar notificações"
                      style={{ paddingRight: 48 }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowWebhookSecret(!showWebhookSecret)}
                      style={{
                        position: "absolute",
                        right: 8,
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: 4,
                        color: "var(--muted)",
                      }}
                      aria-label={showWebhookSecret ? "Ocultar segredo" : "Mostrar segredo"}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                        {showWebhookSecret ? "visibility_off" : "visibility"}
                      </span>
                    </button>
                  </div>
                  <span className="muted" style={{ fontSize: 12 }}>
                    Valida a assinatura das notificações do Mercado Pago.
                  </span>
                </label>

                <div className="admin-config-actions" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <button
                    className="btn btn-primary admin-config-submit"
                    type="submit"
                    disabled={mpLoading || !mpLoaded}
                  >
                    {mpLoading ? "Salvando..." : "Salvar credenciais"}
                  </button>
                  <button
                    className="btn btn-ghost"
                    type="button"
                    onClick={testConnection}
                    disabled={testingConnection}
                    style={{ border: "1px solid var(--line)", minHeight: 48, borderRadius: 14 }}
                  >
                    {testingConnection ? "Testando..." : "Testar conexão"}
                  </button>
                </div>

              </div>
          </section>
        </form>

        <section className="card admin-config-callout">
          <div className="admin-config-callout-icon">
            <span className="material-symbols-outlined" aria-hidden="true">
              link
            </span>
          </div>
          <div className="admin-config-callout-copy">
            <h3 className="admin-config-callout-title">URL do Webhook</h3>
            <p className="admin-config-callout-text" style={{ fontFamily: "monospace", fontSize: 13, wordBreak: "break-all" }}>
              {typeof window !== "undefined" ? `${window.location.origin}/api/webhooks/mercadopago` : "Carregando..."}
            </p>
            <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
              Configure esta URL no painel do Mercado Pago em Webhooks. Em desenvolvimento local, use ngrok.
            </p>
          </div>
        </section>

        <section className="card admin-config-hero" style={{ marginTop: 8 }}>
          <div>
            <h2 className="admin-config-hero-title">PIX estático (Fallback)</h2>
            <p className="admin-config-hero-subtitle">
              Usado quando o Mercado Pago está indisponível. Configure os dados para o cliente pagar manualmente.
            </p>
          </div>
          <span className="pill admin-config-hero-pill">Fallback</span>
        </section>

        <form className="admin-config-stack" onSubmit={handlePixSubmit}>
          <section className="card admin-config-main-card">
            <div className="admin-config-main-grid">
              <div className="admin-config-upload-column">
                <CldUploadWidget
                  signatureEndpoint="/api/cloudinary/signature"
                  onSuccess={(result) => {
                    const info = result.info;
                    if (info && typeof info === "object" && "secure_url" in info) {
                      setPixQrCode(String(info.secure_url));
                    }
                  }}
                  options={{
                    sources: ["local"],
                    multiple: false,
                    maxFiles: 1,
                  }}
                >
                  {({ open }) => (
                    <button type="button" className="admin-config-upload-button" onClick={() => open()}>
                      {pixQrCode ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={pixQrCode}
                          alt="Pré-visualização do QR Code PIX"
                          className="admin-config-upload-preview"
                        />
                      ) : (
                        <div className="admin-config-upload-placeholder">
                          <span className="material-symbols-outlined" aria-hidden="true">
                            qr_code_2
                          </span>
                          <span>Enviar QR Code</span>
                        </div>
                      )}
                    </button>
                  )}
                </CldUploadWidget>

                <div className="admin-config-helper">
                  <strong>Imagem atual</strong>
                  <span>{pixQrCode ? "QR Code configurado" : "Nenhum QR Code enviado ainda."}</span>
                </div>
              </div>

              <div className="admin-config-form-column">
                <label className="public-form-field admin-config-field">
                  <span className="public-form-label">Chave PIX</span>
                  <input
                    className="input admin-config-input"
                    value={pixKey}
                    onChange={(event) => setPixKey(event.target.value)}
                    placeholder="E-mail, telefone ou chave aleatória"
                  />
                </label>

                <label className="public-form-field admin-config-field">
                  <span className="public-form-label">Nome do recebedor</span>
                  <input
                    className="input admin-config-input"
                    value={receiverName}
                    onChange={(event) => setReceiverName(event.target.value)}
                    placeholder="Nome que aparece na confirmação"
                  />
                </label>

                <div className="admin-config-actions">
                  <button className="btn btn-primary admin-config-submit" type="submit" disabled={pixLoading || !pixLoaded}>
                    {pixLoading ? "Salvando..." : "Salvar fallback"}
                  </button>
                </div>
              </div>
            </div>
          </section>
        </form>

        <section className="admin-config-benefits">
          <ConfigFeatureCard
            icon="shield"
            title="Credenciais Criptografadas"
            description="Access Token e Webhook Secret são criptografados com AES-256-GCM no banco de dados."
          />
          <ConfigFeatureCard
            icon="bolt"
            title="Fallback Automático"
            description="Se o Mercado Pago falhar, o PIX estático entra automaticamente sem intervenção."
          />
          <ConfigFeatureCard
            icon="sync"
            title="Confirmação Automática"
            description="Pagamentos via gateway são confirmados automaticamente pelo webhook."
          />
        </section>
      </div>
    </AdminLayout>
  );
}
