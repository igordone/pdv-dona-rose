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
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

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
      } catch {
        if (mounted) {
          setPixQrCode("");
          setPixKey("");
          setReceiverName("");
        }
      } finally {
        if (mounted) {
          setLoaded(true);
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
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ key, value }),
    });

    const payload = (await response.json().catch(() => null)) as { error?: string } | null;

    if (!response.ok) {
      throw new Error(payload?.error ?? "Falha ao salvar a configuração.");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    try {
      await Promise.all([
        saveSetting("pix_qrcode", pixQrCode),
        saveSetting("pix_key", pixKey),
        saveSetting("pix_receiver_name", receiverName),
      ]);

      toast({
        title: "Configurações salvas",
        description: "Os dados do PIX foram atualizados com sucesso.",
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Falha ao salvar",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <AdminLayout
      title="Configurações"
      subtitle="Ajuste a chave PIX, o nome do recebedor e o QR Code estático."
    >
      <div className="admin-config-page">
        <section className="card admin-config-hero">
          <div>
            <h2 className="admin-config-hero-title">PIX estático</h2>
            <p className="admin-config-hero-subtitle">
              Configure os dados que vão aparecer para o cliente depois que ele enviar um pedido via PIX.
            </p>
          </div>
          <span className="pill admin-config-hero-pill">Pagamento</span>
        </section>

        <form className="admin-config-stack" onSubmit={handleSubmit}>
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
                  <button className="btn btn-primary admin-config-submit" type="submit" disabled={loading || !loaded}>
                    {loading ? "Salvando..." : "Salvar configurações"}
                  </button>
                </div>
              </div>
            </div>
          </section>
        </form>

        <section className="card admin-config-callout">
          <div className="admin-config-callout-icon">
            <span className="material-symbols-outlined" aria-hidden="true">
              visibility
            </span>
          </div>
          <div className="admin-config-callout-copy">
            <h3 className="admin-config-callout-title">O que o cliente vê</h3>
            <p className="admin-config-callout-text">
              Depois que o pedido com pagamento PIX é enviado, mostramos o QR Code, a chave, o nome do recebedor,
              o valor exato e o código do pedido para conferência no balcão.
            </p>
          </div>
        </section>

        <section className="admin-config-benefits">
          <ConfigFeatureCard
            icon="shield"
            title="Transações Seguras"
            description="Protocolos PIX de alta confiabilidade."
          />
          <ConfigFeatureCard
            icon="bolt"
            title="Confirmação Instantânea"
            description="Agilize a fila do balcão e entregas."
          />
        </section>
      </div>
    </AdminLayout>
  );
}

