import { useEffect, useMemo, useState } from "react";
import { CldImage } from "next-cloudinary";
import type { Product } from "../types/domain";
import { useFeedback } from "../components/Feedback";
import { getSessionId } from "../lib/session";

type CartItem = {
  id: number;
  name: string;
  price_cents: number;
  quantity: number;
  image_path?: string | null;
};

type MenuResponse = {
  items: Product[];
};

type PublicOrderStatus = "pendente" | "em_preparo" | "a_caminho" | "concluido" | "cancelado";

type PublicOrderItem = {
  order_id: number;
  product_name: string;
  quantity: number;
  unit_price_cents: number;
  subtotal_cents: number;
};

type PublicOrder = {
  id: number;
  order_code: string | null;
  client_name: string | null;
  client_phone: string | null;
  delivery_method: string;
  delivery_address: string | null;
  payment_method: string;
  payment_confirmed_at: string | null;
  status: PublicOrderStatus;
  pending_at: string;
  preparing_at: string | null;
  on_way_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  total_cents: number;
  notes: string | null;
  created_at: string;
  viewed_at: string | null;
};

type PublicOrderResponse = {
  order: PublicOrder;
  items: PublicOrderItem[];
};

type SystemSetting = {
  key: string;
  value: string | null;
};

type SystemSettingsMap = Record<string, string>;

type OrderStep = {
  key: number;
  label: string;
  icon: string;
  time: string | null;
};

type OrderConfirmation = {
  orderId: number;
  orderCode: string | null;
  totalCents: number;
  paymentMethod: "cash" | "card" | "pix";
};

const TRACKED_ORDERS_STORAGE_KEY = "pdv-dona-rose:tracked-orders";
const PIX_CONFIRMATION_STORAGE_KEY = "pdv-dona-rose:last-pix-confirmation";

function getCategoryIcon(category: string) {
  const normalized = category.trim().toLowerCase();

  if (normalized === "assados") {
    return "bakery_dining";
  }

  if (normalized === "fritos") {
    return "skillet";
  }

  if (normalized === "bebidas") {
    return "local_drink";
  }

  return "category";
}

function formatPriceParts(cents: number) {
  const value = (cents / 100).toFixed(2);
  const [whole, decimal] = value.split(".");

  return { whole, decimal };
}

function formatClock(value?: string | null) {
  if (!value) {
    return "--:--";
  }

  const date = new Date(value);
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatDateLabel(value?: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  const today = new Date();
  const sameDay =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();

  const shortDate = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);

  return sameDay ? `Feito hoje, ${formatClock(value)}` : `Feito em ${shortDate}, ${formatClock(value)}`;
}

function formatDeliveryAddress(deliveryAddress: string | null) {
  if (!deliveryAddress) {
    return "Retirar no local";
  }

  return deliveryAddress
    .replace("Apartamento:", "Apartamento")
    .replace("|", "·")
    .replace(/\s+/g, " ")
    .replace("· Bloco:", "· Bloco")
    .trim();
}

function formatPaymentMethod(paymentMethod: string) {
  if (paymentMethod === "cash") {
    return "Dinheiro";
  }

  if (paymentMethod === "card") {
    return "Cartão";
  }

  if (paymentMethod === "pix") {
    return "Pix";
  }

  return paymentMethod;
}

function getOrderStatusMeta(status: PublicOrderStatus) {
  if (status === "pendente") {
    return {
      label: "Pendente",
      tone: "warning",
      icon: "circle",
    };
  }

  if (status === "em_preparo") {
    return {
      label: "Em preparo",
      tone: "warning",
      icon: "circle",
    };
  }

  if (status === "a_caminho") {
    return {
      label: "A caminho",
      tone: "info",
      icon: "circle",
    };
  }

  if (status === "concluido") {
    return {
      label: "Concluído",
      tone: "success",
      icon: "check",
    };
  }

  return {
    label: "Cancelado",
    tone: "danger",
    icon: "close",
  };
}

function getOrderCardClass(status: PublicOrderStatus) {
  return `public-order-history-card public-order-history-card--${status}`;
}

function getStepState(status: PublicOrderStatus, stepNumber: number) {
  if (status === "cancelado") {
    return "public-order-step--cancelled";
  }

  if (status === "concluido") {
    if (stepNumber < 4) {
      return "public-order-step--done";
    }

    return "public-order-step--current-warning";
  }

  if (status === "a_caminho") {
    if (stepNumber <= 2) {
      return "public-order-step--done";
    }

    if (stepNumber === 3) {
      return "public-order-step--current-warning";
    }

    return "public-order-step--upcoming";
  }

  if (status === "em_preparo") {
    if (stepNumber === 1) {
      return "public-order-step--done";
    }

    if (stepNumber === 2) {
      return "public-order-step--current-warning";
    }

    return "public-order-step--upcoming";
  }

  if (stepNumber === 1) {
    return "public-order-step--current-warning";
  }

  return "public-order-step--upcoming";
}

function getOrderStepProgress(status: PublicOrderStatus) {
  if (status === "em_preparo") {
    return "33%";
  }

  if (status === "a_caminho") {
    return "66%";
  }

  if (status === "concluido") {
    return "100%";
  }

  return "0%";
}

function getOrderStepIcon(status: PublicOrderStatus, stepNumber: number) {
  const state = getStepState(status, stepNumber);

  if (state.includes("done")) {
    return "check";
  }

  if (state.includes("cancelled")) {
    return "close";
  }

  return String(stepNumber);
}

function getOrderStepTime(order: PublicOrder, stepNumber: number) {
  if (stepNumber === 1) {
    return formatClock(order.pending_at ?? order.created_at);
  }

  if (stepNumber === 2) {
    return formatClock(order.preparing_at);
  }

  if (stepNumber === 3) {
    return formatClock(order.on_way_at);
  }

  if (stepNumber === 4) {
    return formatClock(order.completed_at);
  }

  return "--:--";
}

function getTrackedOrderStorageKey(sessionId: string | null) {
  return sessionId ? `${TRACKED_ORDERS_STORAGE_KEY}:${sessionId}` : TRACKED_ORDERS_STORAGE_KEY;
}

function readTrackedOrderIds(sessionId: string | null) {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(getTrackedOrderStorageKey(sessionId));
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0);
  } catch {
    return [];
  }
}

function storeTrackedOrderIds(sessionId: string | null, ids: number[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(getTrackedOrderStorageKey(sessionId), JSON.stringify(ids));
}

function getPixConfirmationStorageKey(sessionId: string | null) {
  return sessionId ? `${PIX_CONFIRMATION_STORAGE_KEY}:${sessionId}` : PIX_CONFIRMATION_STORAGE_KEY;
}

function readPixConfirmation(sessionId: string | null) {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(getPixConfirmationStorageKey(sessionId));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<OrderConfirmation> | null;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    if (typeof parsed.orderId !== "number" || !Number.isInteger(parsed.orderId) || parsed.orderId <= 0) {
      return null;
    }

    if (parsed.paymentMethod !== "pix") {
      return null;
    }

    return {
      orderId: parsed.orderId,
      orderCode: typeof parsed.orderCode === "string" ? parsed.orderCode : null,
      totalCents: typeof parsed.totalCents === "number" ? parsed.totalCents : 0,
      paymentMethod: "pix",
    } satisfies OrderConfirmation;
  } catch {
    return null;
  }
}

function storePixConfirmation(sessionId: string | null, confirmation: OrderConfirmation) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(getPixConfirmationStorageKey(sessionId), JSON.stringify(confirmation));
}

function clearPixConfirmation(sessionId: string | null) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(getPixConfirmationStorageKey(sessionId));
}

async function readJsonResponse<T>(response: Response): Promise<T | { error: string }> {
  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    const text = await response.text();
    return {
      error: text.trim() || "Resposta inválida do servidor.",
    };
  }

  return (await response.json()) as T | { error: string };
}

function SessionOrderCard({
  order,
  items,
  canReopenPix,
  onReopenPix,
}: {
  order: PublicOrder;
  items: PublicOrderItem[];
  canReopenPix: boolean;
  onReopenPix: () => void;
}) {
  const statusMeta = getOrderStatusMeta(order.status);
  const isPixAwaitingConfirmation = order.payment_method === "pix" && !order.payment_confirmed_at;
  const stepProgress = isPixAwaitingConfirmation ? "0%" : getOrderStepProgress(order.status);
  const orderCodeLabel = order.order_code ? `Código ${order.order_code}` : "Código indisponível";
  const orderDateLabel = formatDateLabel(
    order.completed_at ?? order.on_way_at ?? order.preparing_at ?? order.pending_at,
  );
  const steps: OrderStep[] = [
    {
      key: 1,
      label: "Pendente",
      icon: getOrderStepIcon(order.status, 1),
      time: getOrderStepTime(order, 1),
    },
    {
      key: 2,
      label: "Em preparo",
      icon: getOrderStepIcon(order.status, 2),
      time: getOrderStepTime(order, 2),
    },
    {
      key: 3,
      label: "A caminho",
      icon: getOrderStepIcon(order.status, 3),
      time: getOrderStepTime(order, 3),
    },
    {
      key: 4,
      label: "Concluído",
      icon: getOrderStepIcon(order.status, 4),
      time: getOrderStepTime(order, 4),
    },
  ];

  return (
    <article className={`${getOrderCardClass(order.status)} public-session-order-card`}>
      <div className="public-order-history-top public-session-order-top">
        <div className="public-session-order-top-row">
          <div className="public-order-history-heading public-session-order-heading">
            <div className="public-session-order-title-row">
              <span className="public-session-order-title">Pedido #{order.id}</span>
              <span className={`public-order-status-pill public-order-status-pill--${statusMeta.tone}`}>
                <span className="material-symbols-outlined" aria-hidden="true">
                  {statusMeta.icon}
                </span>
                {statusMeta.label}
              </span>
              <span className="public-session-order-meta">
                <span className="material-symbols-outlined" aria-hidden="true">
                  confirmation_number
                </span>
                {orderCodeLabel}
              </span>
              <span className="public-session-order-meta">
                <span className="material-symbols-outlined" aria-hidden="true">
                  schedule
                </span>
                {orderDateLabel}
              </span>
            </div>
          </div>

          <div className="public-order-total public-session-order-total">
            <span className="public-order-total-label public-session-order-total-label">Total</span>
            <span className="public-order-total-value public-session-order-total-value">
              <span className="public-order-total-currency">R$</span>
              <span>{formatPriceParts(order.total_cents).whole}</span>
              <span className="public-order-total-decimal">.{formatPriceParts(order.total_cents).decimal}</span>
            </span>
          </div>
        </div>
      </div>

      {isPixAwaitingConfirmation ? (
        <div className="public-session-order-payment-banner">
          <span className="material-symbols-outlined" aria-hidden="true">
            hourglass_top
          </span>
          <div className="public-session-order-payment-copy">
            <strong>Pagamento PIX aguardando confirmação</strong>
            <span>
              Você já sinalizou que pagou. Os processos do pedido aparecerão aqui depois que o estabelecimento
              confirmar o pagamento.
            </span>
          </div>
        </div>
      ) : (
        <div
          className="public-order-stepper public-session-order-stepper"
          style={{ ["--order-step-progress" as string]: stepProgress }}
        >
          {steps.map((step) => (
            <div
              key={step.key}
              className={`public-order-step public-session-order-step ${getStepState(order.status, step.key)}`}
            >
              <div className="public-order-step-index public-session-order-step-index" aria-hidden="true">
                {step.icon === "check" || step.icon === "close" ? (
                  <span className="material-symbols-outlined">{step.icon}</span>
                ) : (
                  <span className="public-session-order-step-index-number">{step.icon}</span>
                )}
              </div>
              <div className="public-order-step-label public-session-order-step-label">{step.label}</div>
              <div className="public-order-step-time public-session-order-step-time">{step.time}</div>
            </div>
          ))}
        </div>
      )}

      <div className="public-order-divider public-session-order-divider" />

      <div>
        <div className="public-order-items-heading public-session-order-items-heading">Itens do pedido · {items.length}</div>
        <div className="public-order-items-list public-session-order-items-list">
          {items.map((item) => {
            const subtotalParts = formatPriceParts(item.subtotal_cents);

            return (
              <div
                key={`${item.order_id}-${item.product_name}`}
                className="public-order-item-row public-session-order-item-row"
              >
                <div className="public-order-item-left public-session-order-item-left">
                  <span className="public-order-item-qty public-session-order-item-qty">{item.quantity}×</span>
                  <span className="public-order-item-name public-session-order-item-name">{item.product_name}</span>
                </div>
                <div className="public-order-item-price public-session-order-item-price">
                  <span className="public-price-currency">R$</span>
                  <span>{subtotalParts.whole}</span>
                  <span className="public-price-decimal">.{subtotalParts.decimal}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="public-order-divider public-session-order-divider" />

      <div className="public-order-footer-grid public-session-order-footer">
        <div className="public-order-footer-block public-session-order-footer-block">
          <span className="public-order-footer-label public-session-order-footer-label">Pagamento</span>
          <span className="public-order-footer-value public-session-order-footer-value">
            {formatPaymentMethod(order.payment_method)}
          </span>
        </div>
        <div className="public-order-footer-block public-session-order-footer-block">
          <span className="public-order-footer-label public-session-order-footer-label">Entrega</span>
          <span className="public-order-footer-value public-session-order-footer-value">
            {formatDeliveryAddress(order.delivery_address)}
          </span>
        </div>
        <div className="public-order-footer-block public-session-order-footer-block">
          <span className="public-order-footer-label public-session-order-footer-label">Cliente</span>
          <span className="public-order-footer-value public-session-order-footer-value">
            {order.client_name || "Sem nome"}
          </span>
        </div>
      </div>

      {canReopenPix ? (
        <div className="public-session-order-reopen-row">
          <div className="public-session-order-reopen-copy">
            <strong>Pagamento PIX pendente</strong>
            <span>Se você fechou a janela antes de pagar, pode reabri-la agora.</span>
          </div>
          <button type="button" className="btn btn-primary public-session-order-reopen-button" onClick={onReopenPix}>
            Reabrir PIX
          </button>
        </div>
      ) : null}
    </article>
  );
}

function OrderConfirmationModal({
  confirmation,
  settings,
  copiedPixKey,
  onCopyPixKey,
  onClose,
  onGoToOrders,
}: {
  confirmation: OrderConfirmation;
  settings: SystemSettingsMap;
  copiedPixKey: boolean;
  onCopyPixKey: () => void;
  onClose: () => void;
  onGoToOrders: () => void;
}) {
  const isPix = confirmation.paymentMethod === "pix";
  const pixQrCode = settings.pix_qrcode ?? "";
  const pixKey = settings.pix_key ?? "";
  const receiverName = settings.pix_receiver_name ?? "";
  const totalParts = formatPriceParts(confirmation.totalCents);

  return (
    <div
      role="presentation"
      onClick={onClose}
      className="public-confirmation-overlay"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-confirmation-title"
        onClick={(event) => event.stopPropagation()}
        className="card public-confirmation-card"
      >
        <div className="public-confirmation-header">
          <div className="public-confirmation-header-copy">
            <span className="pill public-confirmation-pill">Pedido enviado</span>
            <h2 id="order-confirmation-title" className="section-title" style={{ marginBottom: 0 }}>
              Pedido #{confirmation.orderId}
            </h2>
            <div className="public-confirmation-meta">
              {confirmation.orderCode ? <span>Código: {confirmation.orderCode}</span> : null}
              <span>{formatPaymentMethod(confirmation.paymentMethod)}</span>
            </div>
          </div>

          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Fechar
          </button>
        </div>

        <div className="public-confirmation-total">
          <span className="public-confirmation-total-label">Valor exato do pedido</span>
          <span className="public-confirmation-total-value">
            <span className="public-price-currency">R$</span>
            <span>{totalParts.whole}</span>
            <span className="public-price-decimal">.{totalParts.decimal}</span>
          </span>
        </div>

        {isPix ? (
          <section className="public-pix-block">
            <div className="public-pix-block-header">
              <div>
                <h3 className="section-title" style={{ marginBottom: 4 }}>
                  Pague com PIX
                </h3>
                <p className="subtitle" style={{ margin: 0 }}>
                  Após realizar o pagamento, aguarde a confirmação do estabelecimento.
                </p>
              </div>
            </div>

            <div className="public-pix-grid">
              <div className="public-pix-qr card">
                {pixQrCode ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={pixQrCode} alt="QR Code PIX" className="public-pix-qr-image" />
                ) : (
                  <div className="public-pix-qr-empty">
                    <span className="material-symbols-outlined" aria-hidden="true">
                      qr_code_2
                    </span>
                    <span>QR Code indisponível</span>
                  </div>
                )}
              </div>

              <div className="public-pix-details">
                <div className="public-pix-detail-card card">
                  <div className="public-pix-detail-label">Chave PIX</div>
                  <div className="public-pix-detail-copy-row">
                    <div className="public-pix-detail-value">{pixKey || "Não configurada"}</div>
                    <button
                      type="button"
                      className="btn btn-primary public-pix-copy-icon-button"
                      onClick={onCopyPixKey}
                      disabled={!pixKey}
                      aria-label={copiedPixKey ? "Chave PIX copiada" : "Copiar chave PIX"}
                      title={copiedPixKey ? "Chave PIX copiada" : "Copiar chave PIX"}
                    >
                      <span className="material-symbols-outlined" aria-hidden="true">
                        content_copy
                      </span>
                      <span className="sr-only">Copiar chave PIX</span>
                    </button>
                  </div>
                </div>

                <div className="public-pix-detail-card card">
                  <div className="public-pix-detail-label">Nome do recebedor</div>
                  <div className="public-pix-detail-value">{receiverName || "Não configurado"}</div>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        <div className="public-confirmation-actions">
          <button type="button" className="btn btn-primary" onClick={onGoToOrders}>
            Já paguei, acompanhar pedido
          </button>
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const { toast } = useFeedback();
  const [items, setItems] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState("Todas");
  const [activeTab, setActiveTab] = useState<"cardapio" | "pedidos">("cardapio");
  const [deliveryMethod, setDeliveryMethod] = useState<"pickup" | "delivery">("pickup");
  const [deliveryApartment, setDeliveryApartment] = useState("");
  const [deliveryBlock, setDeliveryBlock] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | "pix">("cash");
  const [trackedOrderIds, setTrackedOrderIds] = useState<number[]>([]);
  const [trackedOrdersLoaded, setTrackedOrdersLoaded] = useState(false);
  const [trackedOrders, setTrackedOrders] = useState<PublicOrderResponse[]>([]);
  const [systemSettings, setSystemSettings] = useState<SystemSettingsMap>({});
  const [confirmation, setConfirmation] = useState<OrderConfirmation | null>(null);
  const [copiedPixKey, setCopiedPixKey] = useState(false);
  const [savedPixConfirmation, setSavedPixConfirmation] = useState<OrderConfirmation | null>(null);

  useEffect(() => {
    void fetch("/api/menu")
      .then((response) => response.json() as Promise<MenuResponse>)
      .then((data) => setItems(data.items ?? []))
      .catch(() => setItems([]));
  }, []);

  useEffect(() => {
    let mounted = true;

    void fetch("/api/settings")
      .then((response) => response.json() as Promise<{ settings?: SystemSetting[] }>)
      .then((data) => {
        if (!mounted) {
          return;
        }

        const map = (data.settings ?? []).reduce<SystemSettingsMap>((acc, setting) => {
          acc[setting.key] = setting.value ?? "";
          return acc;
        }, {});

        setSystemSettings(map);
      })
      .catch(() => {
        if (mounted) {
          setSystemSettings({});
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const sessionId = getSessionId();
    const ids = readTrackedOrderIds(sessionId);
    setTrackedOrderIds(ids);
    setTrackedOrdersLoaded(true);
  }, []);

  useEffect(() => {
    const sessionId = getSessionId();
    const storedConfirmation = readPixConfirmation(sessionId);

    if (storedConfirmation) {
      setSavedPixConfirmation(storedConfirmation);
    }
  }, []);

  useEffect(() => {
    if (!trackedOrdersLoaded) {
      return;
    }

    const sessionId = getSessionId();
    storeTrackedOrderIds(sessionId, trackedOrderIds);
  }, [trackedOrderIds, trackedOrdersLoaded]);

  useEffect(() => {
    if (trackedOrderIds.length === 0) {
      return;
    }

    const sessionId = getSessionId() ?? "";
    if (!sessionId) {
      return;
    }

    let cancelled = false;

    async function loadTrackedOrders() {
      const responses = await Promise.all(
        trackedOrderIds.map(async (id) => {
          try {
            const response = await fetch(`/api/orders/${id}?session_id=${encodeURIComponent(sessionId)}`);
            const payload = (await readJsonResponse<PublicOrderResponse>(response)) as PublicOrderResponse;

            if (!response.ok || !payload || !("order" in payload)) {
              return null;
            }

            return payload;
          } catch {
            return null;
          }
        }),
      );

      if (cancelled) {
        return;
      }

      const validResponses = responses.filter((entry): entry is PublicOrderResponse => Boolean(entry));
      validResponses.sort((left, right) => right.order.id - left.order.id);
      setTrackedOrders(validResponses);
    }

    void loadTrackedOrders();

    const interval = window.setInterval(() => {
      void loadTrackedOrders();
    }, 10_000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [trackedOrderIds]);

  const totalCents = useMemo(
    () => cart.reduce((sum, item) => sum + item.price_cents * item.quantity, 0),
    [cart],
  );

  const categories = useMemo(() => {
    const uniqueCategories = Array.from(
      new Set(items.map((item) => item.category_name).filter((value): value is string => Boolean(value))),
    );

    return ["Todas", ...uniqueCategories];
  }, [items]);

  const visibleItems =
    activeCategory === "Todas"
      ? items
      : items.filter((item) => item.category_name === activeCategory);

  const activeSessionOrders = trackedOrders.filter(
    (entry) => entry.order.status !== "concluido" && entry.order.status !== "cancelado",
  );
  const totalTrackedOrders = trackedOrders.length > 0 ? trackedOrders.length : trackedOrderIds.length;
  const activeBadgeLabel =
    activeSessionOrders.length > 0
      ? `${activeSessionOrders.length} pedido${activeSessionOrders.length === 1 ? "" : "s"} em andamento`
      : `${totalTrackedOrders} pedido${totalTrackedOrders === 1 ? "" : "s"}`;
  const pendingPixConfirmation =
    savedPixConfirmation?.paymentMethod === "pix" ? savedPixConfirmation : null;
  const pendingPixOrder = pendingPixConfirmation
    ? trackedOrders.find((entry) => entry.order.id === pendingPixConfirmation.orderId)?.order ?? null
    : null;
  const pendingPixLabel = pendingPixConfirmation
    ? pendingPixConfirmation.orderCode
      ? `Pedido ${pendingPixConfirmation.orderId} · Código ${pendingPixConfirmation.orderCode}`
      : `Pedido ${pendingPixConfirmation.orderId}`
    : "";
  const pendingPixIsOpen = Boolean(
    pendingPixConfirmation &&
      (!pendingPixOrder ||
        (!pendingPixOrder.payment_confirmed_at &&
          pendingPixOrder.status !== "concluido" &&
          pendingPixOrder.status !== "cancelado")),
  );

  useEffect(() => {
    if (!trackedOrdersLoaded || !pendingPixConfirmation) {
      return;
    }

    const currentOrder = trackedOrders.find((entry) => entry.order.id === pendingPixConfirmation.orderId)?.order;
    if (!currentOrder) {
      return;
    }

    if (
      currentOrder.payment_confirmed_at ||
      currentOrder.status === "concluido" ||
      currentOrder.status === "cancelado"
    ) {
      const sessionId = getSessionId();
      clearPixConfirmation(sessionId);
      setSavedPixConfirmation(null);

      if (confirmation?.orderId === pendingPixConfirmation.orderId) {
        setConfirmation(null);
        setCopiedPixKey(false);
      }
    }
  }, [confirmation, pendingPixConfirmation, trackedOrders, trackedOrdersLoaded]);

  useEffect(() => {
    if (!copiedPixKey) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setCopiedPixKey(false);
    }, 2000);

    return () => window.clearTimeout(timer);
  }, [copiedPixKey]);

  function closeConfirmationModal() {
    setConfirmation(null);
    setCopiedPixKey(false);
  }

  function goToOrdersFromConfirmation() {
    setActiveTab("pedidos");
    closeConfirmationModal();
  }

  function reopenPixConfirmation() {
    if (!pendingPixConfirmation || !pendingPixIsOpen) {
      return;
    }

    setConfirmation(pendingPixConfirmation);
    setCopiedPixKey(false);
  }

  async function copyPixKeyToClipboard() {
    const pixKey = systemSettings.pix_key ?? "";
    if (!pixKey) {
      toast({
        title: "Chave PIX indisponível",
        description: "A configuração ainda não foi preenchida.",
        variant: "warning",
      });
      return;
    }

    try {
      await navigator.clipboard.writeText(pixKey);
      setCopiedPixKey(true);
      toast({
        title: "Chave PIX copiada",
        description: "Você já pode colar a chave no app do banco.",
        variant: "success",
      });
    } catch {
      toast({
        title: "Não foi possível copiar",
        description: "Tente selecionar a chave manualmente.",
        variant: "error",
      });
    }
  }

  function addItem(product: Product) {
    setCart((current) => {
      const exists = current.find((item) => item.id === product.id);
      if (exists) {
        return current.map((item) =>
          item.id === product.id
            ? {
                ...item,
                quantity: item.quantity + 1,
                image_path: item.image_path ?? product.image_path ?? null,
              }
            : item,
        );
      }

      return [
        ...current,
        {
          id: product.id,
          name: product.name,
          price_cents: product.price_cents,
          quantity: 1,
          image_path: product.image_path ?? null,
        },
      ];
    });
  }

  function removeItem(productId: number) {
    setCart((current) =>
      current
        .map((item) => (item.id === productId ? { ...item, quantity: item.quantity - 1 } : item))
        .filter((item) => item.quantity > 0),
    );
  }

  async function submitOrder() {
    if (deliveryMethod === "delivery" && !clientName.trim()) {
      setMessage("Informe o nome para a entrega.");
      toast({
        title: "Falha ao enviar o pedido",
        description: "Informe o nome para a entrega.",
        variant: "error",
      });
      return;
    }

    if (deliveryMethod === "delivery" && (!deliveryApartment.trim() || !deliveryBlock.trim())) {
      setMessage("Informe o apartamento e o bloco para a entrega.");
      toast({
        title: "Falha ao enviar o pedido",
        description: "Informe o apartamento e o bloco para a entrega.",
        variant: "error",
      });
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const sessionId = getSessionId();

      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          session_id: sessionId,
          clientName,
          clientPhone,
          notes,
          deliveryMethod,
          deliveryApartment,
          deliveryBlock,
          paymentMethod,
          items: cart.map((item) => ({
            productId: item.id,
            quantity: item.quantity,
          })),
        }),
      });

      const data = (await readJsonResponse<{
        error?: string;
        message?: string;
        orderId?: number;
        orderCode?: string;
      }>(
        response,
      )) as {
        error?: string;
        message?: string;
        orderId?: number;
        orderCode?: string;
      };

      if (!response.ok) {
        setMessage(data.error ?? "Não foi possível enviar o pedido.");
        toast({
          title: "Falha ao enviar o pedido",
          description: data.error ?? "Verifique os itens e tente novamente.",
          variant: "error",
        });
        return;
      }

      setMessage("Pedido enviado com sucesso");
      toast({
        title: "Pedido enviado com sucesso",
        description: data.orderCode ? `Código do pedido: ${data.orderCode}` : undefined,
        variant: "success",
        durationMs: 3600,
      });

      if (data.orderId) {
        setTrackedOrderIds((current) => {
          const next = Array.from(new Set([data.orderId as number, ...current]));
          return next;
        });
      }

      const nextConfirmation = {
        orderId: data.orderId ?? 0,
        orderCode: data.orderCode ?? null,
        totalCents,
        paymentMethod,
      };

      setConfirmation(nextConfirmation);
      setCopiedPixKey(false);

      if (paymentMethod === "pix") {
        setSavedPixConfirmation(nextConfirmation);
        storePixConfirmation(sessionId, nextConfirmation);
      }

      setCart([]);
      setClientName("");
      setClientPhone("");
      setNotes("");
      setDeliveryMethod("pickup");
      setDeliveryApartment("");
      setDeliveryBlock("");
      setPaymentMethod("cash");
    } catch (error) {
      const isNetworkError =
        error instanceof TypeError ||
        (error instanceof Error && /failed to fetch|networkerror|fetch/i.test(error.message));
      const message = isNetworkError
        ? "Falha de conexão. Verifique sua internet e tente novamente."
        : error instanceof Error
          ? error.message
          : "Não foi possível enviar o pedido. Verifique sua conexão e tente novamente.";
      setMessage("Não foi possível enviar o pedido.");
      toast({
        title: "Falha ao enviar o pedido",
        description: message,
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page public-page">
      <div className="container public-shell">
        <section className="card card-pad public-hero">
          <div className="public-hero-layout">
            <div className="public-hero-copy">
              <div
                className="pill"
                style={{
                  width: "fit-content",
                  borderRadius: 999,
                  padding: "5px 12px",
                  background: "var(--brand-tint)",
                }}
              >
                Cardápio via QR Code
              </div>

              <div className="public-hero-copy">
                <h1 className="title" style={{ marginBottom: 0 }}>
                  Salgados da Dona Rose
                </h1>
                <p className="subtitle" style={{ maxWidth: 780 }}>
                  {activeTab === "pedidos"
                    ? "Acompanhe o status do seu pedido em tempo real"
                    : "Adicione os itens ao pedido e envie direto para nós."}
                </p>
              </div>

          {message ? <div className="public-message-pill">{message}</div> : null}

              {!confirmation && pendingPixIsOpen ? (
                <div className="card public-pix-reopen-banner">
                  <div className="public-pix-reopen-copy">
                    <div className="public-pix-reopen-title">Pagamento PIX pendente</div>
                    <div className="public-pix-reopen-text">
                      {pendingPixLabel}
                    </div>
                    <div className="subtitle" style={{ margin: 0 }}>
                      Se você fechou a janela antes de pagar, pode reabri-la aqui.
                    </div>
                  </div>

                  <button type="button" className="btn btn-primary public-pix-reopen-button" onClick={reopenPixConfirmation}>
                    Reabrir PIX
                  </button>
                </div>
              ) : null}
            </div>

            <div className="public-hero-tabs">
              <div className="public-category-strip public-page-tabs">
                {[
                  { key: "cardapio", label: "Cardápio" },
                  { key: "pedidos", label: "Pedidos" },
                ].map((tab) => {
                  const active = activeTab === tab.key;

                  return (
                    <button
                      key={tab.key}
                      type="button"
                      className="btn btn-ghost admin-category-chip public-category-chip"
                      onClick={() => setActiveTab(tab.key as "cardapio" | "pedidos")}
                      style={{
                        background: active ? "var(--brand)" : "transparent",
                        color: active ? "#fff" : "var(--text)",
                        padding: "7px 16px",
                        borderRadius: 8,
                        border: "none",
                        boxShadow: active ? "inset 0 0 0 1px rgba(255,255,255,0.08)" : "none",
                      }}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {activeTab === "cardapio" ? (
          <div className="public-page-grid">
            <div className="public-main-column">
              <section className="card card-pad public-menu-panel">
                <div className="public-category-strip">
                  {categories.map((category) => {
                    const active = activeCategory === category;

                    return (
                      <button
                        key={category}
                        type="button"
                        className="btn btn-ghost admin-category-chip public-category-chip"
                        onClick={() => setActiveCategory(category)}
                        style={{
                          background: active ? "var(--brand)" : "transparent",
                          color: active ? "#fff" : "var(--text)",
                          padding: "7px 16px",
                          borderRadius: 8,
                          border: "none",
                          boxShadow: active ? "inset 0 0 0 1px rgba(255,255,255,0.08)" : "none",
                        }}
                      >
                        {category !== "Todas" ? (
                          <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: 17 }}>
                            {getCategoryIcon(category)}
                          </span>
                        ) : null}
                        {category}
                      </button>
                    );
                  })}
                </div>

                <div className="public-menu-grid">
                  {visibleItems.map((item) => (
                    <article key={item.id} className="card public-menu-card">
                      <div className="public-menu-card-media">
                        {item.image_path ? (
                          <CldImage
                            src={item.image_path}
                            alt={item.name}
                            fill
                            crop="fill"
                            gravity="auto"
                            style={{
                              objectFit: "cover",
                              objectPosition: "center",
                            }}
                          />
                        ) : (
                          <div className="public-menu-empty">Sem imagem</div>
                        )}
                      </div>

                      <div className="public-menu-card-body">
                        <div className="public-menu-card-category">
                          {item.category_name ?? "Sem categoria"}
                        </div>
                        <div className="public-menu-card-title">{item.name}</div>
                        <div className="public-menu-card-description">Item disponível para venda.</div>
                        <div className="public-menu-card-footer">
                          <div className="public-price">
                            <span className="public-price-currency">R$</span>
                            <span className="public-price-value">{formatPriceParts(item.price_cents).whole}</span>
                            <span className="public-price-decimal">.{formatPriceParts(item.price_cents).decimal}</span>
                          </div>
                          <button
                            className="btn btn-primary public-menu-add"
                            type="button"
                            onClick={() => addItem(item)}
                          >
                            Adicionar
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </div>

            <aside className="card card-pad public-order-panel">
              <div style={{ display: "grid", gap: 4 }}>
                <h2 className="section-title" style={{ marginBottom: 0 }}>
                  Seu pedido
                </h2>
                <p className="subtitle" style={{ margin: 0 }}>
                  Confira os itens que serão enviados por aqui
                </p>
              </div>

              <div className="public-cart-list">
                {cart.length === 0 ? (
                  <div className="public-cart-empty-state" aria-label="Carrinho vazio">
                    <span className="material-symbols-outlined" aria-hidden="true">
                      list_alt
                    </span>
                  </div>
                ) : (
                  cart.map((item) => {
                    const cartItemPreview =
                      items.find((product) => product.id === item.id)?.image_path ?? item.image_path ?? null;

                    return (
                      <div key={item.id} className="public-cart-item">
                        <div className="public-cart-image">
                          {cartItemPreview ? (
                            <CldImage
                              src={cartItemPreview}
                              alt={item.name}
                              fill
                              crop="fill"
                              gravity="auto"
                              style={{
                                objectFit: "cover",
                                objectPosition: "center",
                              }}
                            />
                          ) : (
                            <div className="public-cart-image-empty">Sem imagem</div>
                          )}
                        </div>

                        <div className="public-cart-item-copy">
                          <strong>{item.name}</strong>
                          <div className="public-price public-cart-price">
                            <span className="public-price-currency">R$</span>
                            <span className="public-price-value">{formatPriceParts(item.price_cents).whole}</span>
                            <span className="public-price-decimal">.{formatPriceParts(item.price_cents).decimal}</span>
                          </div>
                        </div>
                        <div className="public-cart-controls">
                          <button className="btn btn-ghost" type="button" onClick={() => removeItem(item.id)}>
                            -
                          </button>
                          <span className="public-cart-qty">{item.quantity}</span>
                          <button className="btn btn-ghost" type="button" onClick={() => addItem(item as Product)}>
                            +
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="public-form-grid">
                <label className="public-form-field">
                  <span className="public-form-label">Como posso te chamar?</span>
                  <input
                    className="input"
                    value={clientName}
                    required={deliveryMethod === "delivery"}
                    onChange={(event) => setClientName(event.target.value)}
                  />
                </label>

                <label className="public-form-field">
                  <span className="public-form-label">Qual é o melhor telefone para falar com você?</span>
                  <input
                    className="input"
                    type="tel"
                    value={clientPhone}
                    onChange={(event) => setClientPhone(event.target.value)}
                  />
                </label>

                <div className="public-form-field">
                  <span className="public-form-label">Retirada ou entrega</span>
                  <div className="modal-choice-strip">
                    <button
                      type="button"
                      className={`modal-choice-chip ${deliveryMethod === "pickup" ? "is-active" : ""}`}
                      onClick={() => setDeliveryMethod("pickup")}
                    >
                      <span className="material-symbols-outlined" aria-hidden="true">
                        store
                      </span>
                      Retirar no local
                    </button>
                    <button
                      type="button"
                      className={`modal-choice-chip ${deliveryMethod === "delivery" ? "is-active" : ""}`}
                      onClick={() => setDeliveryMethod("delivery")}
                    >
                      <span className="material-symbols-outlined" aria-hidden="true">
                        local_shipping
                      </span>
                      Entregar no endereço
                    </button>
                  </div>
                </div>

                {deliveryMethod === "delivery" ? (
                  <div className="public-form-grid public-delivery-grid">
                    <label className="public-form-field">
                      <span className="public-form-label">Apartamento</span>
                      <input
                        className="input"
                        placeholder="Ex: 101"
                        value={deliveryApartment}
                        required={deliveryMethod === "delivery"}
                        onChange={(event) => setDeliveryApartment(event.target.value)}
                      />
                    </label>
                    <label className="public-form-field">
                      <span className="public-form-label">Bloco</span>
                      <input
                        className="input"
                        placeholder="Ex: C"
                        value={deliveryBlock}
                        required={deliveryMethod === "delivery"}
                        onChange={(event) => setDeliveryBlock(event.target.value)}
                      />
                    </label>
                  </div>
                ) : null}

                <div className="public-form-field">
                  <span className="public-form-label">Forma de pagamento</span>
                  <div className="modal-choice-strip">
                    <button
                      type="button"
                      className={`modal-choice-chip ${paymentMethod === "cash" ? "is-active" : ""}`}
                      onClick={() => setPaymentMethod("cash")}
                    >
                      <span className="material-symbols-outlined" aria-hidden="true">
                        payments
                      </span>
                      Dinheiro
                    </button>
                    <button
                      type="button"
                      className={`modal-choice-chip ${paymentMethod === "card" ? "is-active" : ""}`}
                      onClick={() => setPaymentMethod("card")}
                    >
                      <span className="material-symbols-outlined" aria-hidden="true">
                        credit_card
                      </span>
                      Cartão
                    </button>
                    <button
                      type="button"
                      className={`modal-choice-chip ${paymentMethod === "pix" ? "is-active" : ""}`}
                      onClick={() => setPaymentMethod("pix")}
                    >
                      <span className="material-symbols-outlined" aria-hidden="true">
                        qr_code_2
                      </span>
                      Pix
                    </button>
                  </div>
                </div>

                <label className="public-form-field">
                  <span className="public-form-label">Quer deixar alguma observação?</span>
                  <textarea
                    className="textarea"
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                  />
                </label>
              </div>

              <div className="public-total-row">
                <strong>Total</strong>
                <strong>
                  <span style={{ fontSize: 11, marginRight: 4 }}>R$</span>
                  <span className="public-price-value">{formatPriceParts(totalCents).whole}</span>
                  <span className="public-price-decimal">.{formatPriceParts(totalCents).decimal}</span>
                </strong>
              </div>

              <button
                className="btn btn-primary"
                type="button"
                disabled={loading || cart.length === 0}
                onClick={submitOrder}
              >
                {loading ? "Enviando..." : "Enviar pedido"}
              </button>
            </aside>
          </div>
        ) : (
          <section className="card card-pad public-orders-panel">
            <div className="public-section-header">
              <div className="public-section-header-copy">
                <h2 className="section-title" style={{ marginBottom: 0 }}>
                  Pedidos da sessão
                </h2>
                <p className="subtitle" style={{ margin: 0 }}>
                  Acompanhe seus pedidos por número e status.
                </p>
              </div>

              <div className="pill public-section-badge" style={{ background: "var(--surface-2)" }}>
                <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: 14 }}>
                  circle
                </span>
                {activeBadgeLabel}
              </div>
            </div>

            {trackedOrders.length === 0 ? (
              <div className="public-orders-empty">
                <span className="material-symbols-outlined" aria-hidden="true">
                  receipt_long
                </span>
                <strong>Nenhum pedido na sessão ainda.</strong>
                <span className="subtitle">Assim que você enviar um pedido, ele aparece aqui.</span>
              </div>
            ) : (
              <div className="public-orders-grid">
                {trackedOrders.map((entry) => (
                  <SessionOrderCard
                    key={entry.order.id}
                    order={entry.order}
                    items={entry.items}
                    canReopenPix={Boolean(
                      pendingPixConfirmation &&
                        pendingPixConfirmation.orderId === entry.order.id &&
                        entry.order.payment_method === "pix" &&
                        entry.order.status === "pendente",
                    )}
                    onReopenPix={reopenPixConfirmation}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {confirmation ? (
          <OrderConfirmationModal
            confirmation={confirmation}
            settings={systemSettings}
            copiedPixKey={copiedPixKey}
            onCopyPixKey={copyPixKeyToClipboard}
            onClose={closeConfirmationModal}
            onGoToOrders={goToOrdersFromConfirmation}
          />
        ) : null}
      </div>
    </div>
  );
}
