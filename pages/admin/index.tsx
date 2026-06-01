import type { GetServerSideProps } from "next";
import { useEffect, useMemo, useState } from "react";
import { AdminLayout } from "../../components/AdminLayout";
import { requireAdminPageSession } from "../../lib/admin-access";

type DashboardData = {
  orders: Array<{
    id: number;
    order_code: string | null;
    client_name: string | null;
    client_phone: string | null;
    delivery_method: string;
    delivery_address: string | null;
    payment_method: string;
    payment_confirmed_at: string | null;
    status: string;
    total_cents: number;
    notes: string | null;
    created_at: string;
    viewed_at: string | null;
  }>;
  items: Array<{
    order_id: number;
    product_name: string;
    quantity: number;
    unit_price_cents: number;
    subtotal_cents: number;
  }>;
};

type SelectedOrder = DashboardData["orders"][number] | null;

type NormalizedStatus = "pendente" | "em_preparo" | "a_caminho" | "concluido" | "cancelado";

export const getServerSideProps: GetServerSideProps = async (context) => {
  const adminRedirect = await requireAdminPageSession(context);
  if (adminRedirect) {
    return adminRedirect;
  }

  return { props: {} };
};

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalizeStatus(status: string): NormalizedStatus {
  if (status === "pending") {
    return "pendente";
  }

  if (status === "completed") {
    return "concluido";
  }

  if (status === "cancelled") {
    return "cancelado";
  }

  if (status === "pendente" || status === "em_preparo" || status === "a_caminho" || status === "concluido" || status === "cancelado") {
    return status;
  }

  return "pendente";
}

function getStatusLabel(status: string) {
  const normalized = normalizeStatus(status);

  if (normalized === "em_preparo") {
    return "Em preparo";
  }
  if (normalized === "a_caminho") {
    return "A caminho";
  }
  if (normalized === "concluido") {
    return "Concluído";
  }
  if (normalized === "cancelado") {
    return "Cancelado";
  }
  return "Pendente";
}

function getStatusCardClass(status: string) {
  const normalized = normalizeStatus(status);

  if (normalized === "em_preparo") {
    return "order-card order-card-status--em_preparo";
  }
  if (normalized === "a_caminho") {
    return "order-card order-card-status--a_caminho";
  }
  if (normalized === "concluido") {
    return "order-card order-card-status--concluido";
  }
  if (normalized === "cancelado") {
    return "order-card order-card-status--cancelado";
  }
  return "order-card order-card-status--pendente";
}

function getNextStatus(status: string): NormalizedStatus | null {
  const normalized = normalizeStatus(status);

  if (normalized === "pendente") {
    return "em_preparo";
  }

  if (normalized === "em_preparo") {
    return "a_caminho";
  }

  if (normalized === "a_caminho") {
    return "concluido";
  }

  return null;
}

function normalizePhoneForWhatsApp(phone: string) {
  return phone.replace(/[^\d]/g, "");
}

function getDeliveryLabel(method: string) {
  return method === "delivery" ? "Entrega" : "Retirada no local";
}

function getPaymentLabel(method: string) {
  if (method === "card") {
    return "Cartão";
  }

  if (method === "pix") {
    return "Pix";
  }

  return "Dinheiro";
}

function hasConfirmedPayment(order: DashboardData["orders"][number]) {
  return Boolean(order.payment_confirmed_at);
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<SelectedOrder>(null);

  async function refreshOrders() {
    try {
      const response = await fetch("/api/admin/orders");
      const payload = (await response.json().catch(() => null)) as DashboardData | null;

      if (!response.ok || !payload) {
        return;
      }

      setData(payload);
    } catch {
      setData(null);
    }
  }

  useEffect(() => {
    let mounted = true;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const handleOrdersUpdated = () => {
      void refreshOrders();
    };

    async function bootstrap() {
      if (!mounted) {
        return;
      }

      await refreshOrders();
    }

    void bootstrap();
    intervalId = setInterval(() => {
      void refreshOrders();
    }, 10000);

    window.addEventListener("admin-orders-updated", handleOrdersUpdated);

    return () => {
      mounted = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
      window.removeEventListener("admin-orders-updated", handleOrdersUpdated);
    };
  }, []);

  const orders = data?.orders ?? [];
  const items = data?.items ?? [];
  const activeOrders = orders.filter((order) => {
    const normalizedStatus = normalizeStatus(order.status);
    return normalizedStatus !== "concluido" && normalizedStatus !== "cancelado";
  });

  async function markOrderAsViewed(orderId: number) {
    try {
      const response = await fetch("/api/admin/orders", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: orderId }),
      });

      const payload = (await response.json().catch(() => null)) as { id?: number; viewed_at?: string | null } | null;

      if (!response.ok || !payload?.id) {
        return;
      }

      setData((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          orders: current.orders.map((order) =>
            order.id === payload.id
              ? {
                  ...order,
                  viewed_at: payload.viewed_at ?? order.viewed_at ?? new Date().toISOString(),
                }
              : order,
          ),
        };
      });

      window.dispatchEvent(new Event("admin-orders-updated"));
    } catch {
      // Ignore refresh failures and keep the dashboard usable.
    }
  }

  async function updateOrderStatus(orderId: number, status: NormalizedStatus) {
    try {
      const response = await fetch(`/api/orders/${orderId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });

      const payload = (await response.json().catch(() => null)) as { id?: number; status?: string } | null;

      if (!response.ok || !payload?.id || !payload.status) {
        return;
      }

      setData((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          orders: current.orders.map((order) =>
            order.id === payload.id
              ? {
                  ...order,
                  status: payload.status ?? order.status,
                }
              : order,
          ),
        };
      });

      window.dispatchEvent(new Event("admin-orders-updated"));
      window.dispatchEvent(new Event("admin-sales-updated"));
    } catch {
      // Keep the dashboard usable even if the update fails.
    }
  }

  async function confirmPayment(orderId: number) {
    try {
      const response = await fetch(`/api/orders/${orderId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "confirm_payment" }),
      });

      const payload = (await response.json().catch(() => null)) as {
        id?: number;
        payment_confirmed_at?: string | null;
      } | null;

      if (!response.ok || !payload?.id) {
        return;
      }

      setData((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          orders: current.orders.map((order) =>
            order.id === payload.id
              ? {
                  ...order,
                  payment_confirmed_at: payload.payment_confirmed_at ?? order.payment_confirmed_at ?? new Date().toISOString(),
                }
              : order,
          ),
        };
      });
    } catch {
      // Keep the dashboard usable even if the update fails.
    }
  }

  function openOrder(order: SelectedOrder) {
    if (!order) {
      return;
    }

    setSelectedOrder(order);

    if (order.viewed_at) {
      return;
    }

    void markOrderAsViewed(order.id);
  }

  const groupedItems = useMemo(() => {
    const map = new Map<number, DashboardData["items"]>();
    for (const item of items) {
      map.set(item.order_id, [...(map.get(item.order_id) ?? []), item]);
    }
    return map;
  }, [items]);

  const totalOrders = orders.length;
  const pendingOrders = orders.filter((order) => normalizeStatus(order.status) === "pendente").length;
  const preparingOrders = orders.filter((order) => normalizeStatus(order.status) === "em_preparo").length;
  const onWayOrders = orders.filter((order) => normalizeStatus(order.status) === "a_caminho").length;
  const completedOrders = orders.filter((order) => normalizeStatus(order.status) === "concluido").length;
  const cancelledOrders = orders.filter((order) => normalizeStatus(order.status) === "cancelado").length;

  return (
    <AdminLayout title="Dashboard" subtitle="Visão geral dos pedidos realizados hoje.">
      <div className="grid" style={{ gap: 18 }}>
        <section className="dashboard-stats">
          <article className="dashboard-stat dashboard-stat--total">
            <div className="dashboard-stat-label">Total de pedidos</div>
            <div className="dashboard-stat-value">{totalOrders}</div>
          </article>

          <article className="dashboard-stat dashboard-stat--pending">
            <div className="dashboard-stat-label">Pendentes</div>
            <div className="dashboard-stat-value" style={{ color: "var(--brand)" }}>
              {pendingOrders}
            </div>
          </article>

          <article className="dashboard-stat dashboard-stat--preparing">
            <div className="dashboard-stat-label">Em preparo</div>
            <div className="dashboard-stat-value" style={{ color: "var(--warning)" }}>
              {preparingOrders}
            </div>
          </article>

          <article className="dashboard-stat dashboard-stat--onway">
            <div className="dashboard-stat-label">A caminho</div>
            <div className="dashboard-stat-value" style={{ color: "var(--brand)" }}>
              {onWayOrders}
            </div>
          </article>

          <article className="dashboard-stat dashboard-stat--completed">
            <div className="dashboard-stat-label">Concluídos</div>
            <div className="dashboard-stat-value" style={{ color: "var(--success)" }}>
              {completedOrders}
            </div>
          </article>

          <article className="dashboard-stat dashboard-stat--cancelled">
            <div className="dashboard-stat-label">Cancelados</div>
            <div className="dashboard-stat-value" style={{ color: "var(--danger)" }}>
              {cancelledOrders}
            </div>
          </article>
        </section>

        <section className="orders-section">
          <div>
            <h2 className="section-title" style={{ marginBottom: 4 }}>
              Pedidos do dia
            </h2>
            <p className="subtitle" style={{ margin: 0 }}>
              Clique em um pedido para ver os detalhes no modal.
            </p>
          </div>

          <div className="orders-grid">
            {activeOrders.length > 0 ? (
              activeOrders.map((order) => {
              const normalizedStatus = normalizeStatus(order.status);
              const nextStatus = getNextStatus(normalizedStatus);
              const statusClass = getStatusCardClass(normalizedStatus);
              const statusLabel = getStatusLabel(normalizedStatus);
              const waitingPix = order.payment_method === "pix" && normalizedStatus === "pendente" && !hasConfirmedPayment(order);
              const confirmedPix = order.payment_method === "pix" && normalizedStatus === "pendente" && hasConfirmedPayment(order);

              return (
                <div
                  key={order.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openOrder(order)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openOrder(order);
                    }
                  }}
                  className={statusClass}
                  style={{
                    textAlign: "left",
                    width: "100%",
                    padding: 0,
                    overflow: "hidden",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ padding: 18 }}>
                    <div className="order-card-top">
                      <div>
                        <strong>Pedido #{order.id}</strong>
                        {order.order_code ? (
                          <div className="muted" style={{ marginTop: 4, fontSize: 12, fontWeight: 700 }}>
                            Código: {order.order_code}
                          </div>
                        ) : null}
                        <div className="muted" style={{ marginTop: 6 }}>
                          Cliente: {order.client_name || "Sem nome"}
                        </div>
                      </div>
                      <div style={{ display: "grid", justifyItems: "end", gap: 8 }}>
                        <span className={`pill${normalizedStatus === "concluido" ? " order-status-pill--success" : ""}`}>
                          {statusLabel}
                        </span>
                        {waitingPix ? (
                          <span className="admin-order-pix-badge">
                            <span className="material-symbols-outlined" aria-hidden="true">
                              qr_code_2
                            </span>
                            Aguardando PIX
                          </span>
                        ) : confirmedPix ? (
                          <span className="admin-order-pix-badge admin-order-pix-badge--confirmed">
                            <span className="material-symbols-outlined" aria-hidden="true">
                              check_circle
                            </span>
                            Pagamento confirmado
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="order-card-meta">
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                        <span>
                          <span className="muted">Hora: </span>
                          {formatTime(order.created_at)}
                        </span>
                        <span>
                          <span className="muted">Preço: </span>
                          R$ {(order.total_cents / 100).toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <div className="order-card-divider" />

                    <div className="order-card-footer">
                      <span className="muted">Ver detalhes</span>
                      <span style={{ fontSize: 22, lineHeight: 1 }}>›</span>
                    </div>

                    {normalizedStatus !== "concluido" && normalizedStatus !== "cancelado" ? (
                      <div className="order-card-actions">
                        {waitingPix ? (
                          <button
                            className="btn btn-primary"
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              void confirmPayment(order.id);
                            }}
                          >
                            Confirmar pagamento
                          </button>
                        ) : null}
                        {nextStatus ? (
                          <button
                            className="btn btn-primary"
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              void updateOrderStatus(order.id, nextStatus);
                            }}
                          >
                            {normalizedStatus === "pendente"
                              ? "Iniciar preparo"
                              : normalizedStatus === "em_preparo"
                                ? "A caminho"
                                : "Concluído"}
                          </button>
                        ) : null}
                        <button
                          className="btn btn-ghost"
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            void updateOrderStatus(order.id, "cancelado");
                          }}
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
              })
            ) : (
              <div className="public-orders-empty" style={{ gridColumn: "1 / -1" }}>
                <strong>Nenhum pedido ativo no momento.</strong>
                <span className="subtitle" style={{ margin: 0 }}>
                  Pedidos concluídos saem do dashboard automaticamente.
                </span>
              </div>
            )}
          </div>
        </section>
      </div>

      {selectedOrder ? (
        <div
          role="presentation"
          onClick={() => setSelectedOrder(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(20, 12, 8, 0.48)",
            display: "grid",
            placeItems: "center",
            padding: 20,
            zIndex: 50,
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
            className="card"
            style={{
              width: "min(720px, 100%)",
              maxHeight: "85vh",
              overflow: "auto",
              padding: 24,
              display: "grid",
              gap: 18,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
              <div>
                <span className="pill">Detalhes do pedido</span>
                <h3 style={{ margin: "10px 0 4px" }}>Pedido #{selectedOrder.id}</h3>
                <div className="muted" style={{ display: "grid", gap: 4 }}>
                  {selectedOrder.order_code ? <span>Código: {selectedOrder.order_code}</span> : null}
                  <span>{selectedOrder.client_name || "Sem nome"}</span>
                  {selectedOrder.client_phone ? (
                    <a
                      href={`https://wa.me/${normalizePhoneForWhatsApp(selectedOrder.client_phone)}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        color: "var(--brand)",
                        fontWeight: 700,
                        width: "fit-content",
                      }}
                    >
                      <span className="material-symbols-outlined" aria-hidden="true">
                        call
                      </span>
                      {selectedOrder.client_phone}
                    </a>
                  ) : null}
                </div>
              </div>
              <button className="btn btn-ghost" type="button" onClick={() => setSelectedOrder(null)}>
                Fechar
              </button>
            </div>

            <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
              <div className="card card-pad">
                <div className="muted">Status</div>
                <strong>{getStatusLabel(selectedOrder.status)}</strong>
              </div>
              <div className="card card-pad">
                <div className="muted">Total</div>
                <strong>R$ {(selectedOrder.total_cents / 100).toFixed(2)}</strong>
              </div>
              <div className="card card-pad">
                <div className="muted">Horário</div>
                <strong>{formatTime(selectedOrder.created_at)}</strong>
              </div>
              <div className="card card-pad">
                <div className="muted">Entrega</div>
                <strong>{getDeliveryLabel(selectedOrder.delivery_method)}</strong>
                {selectedOrder.delivery_method === "delivery" && selectedOrder.delivery_address ? (
                  <div className="subtitle" style={{ marginTop: 4 }}>
                    {selectedOrder.delivery_address}
                  </div>
                ) : null}
              </div>
              <div className="card card-pad">
                <div className="muted">Pagamento</div>
                <strong>{getPaymentLabel(selectedOrder.payment_method)}</strong>
              </div>
            </div>

            {selectedOrder.payment_method === "pix" && normalizeStatus(selectedOrder.status) === "pendente" && !selectedOrder.payment_confirmed_at ? (
              <section className="card card-pad" style={{ display: "grid", gap: 12 }}>
                <div>
                  <h4 className="section-title" style={{ marginBottom: 4 }}>
                    Confirmação de pagamento
                  </h4>
                  <p className="subtitle" style={{ margin: 0 }}>
                    Use este botão quando o cliente confirmar que já pagou o PIX.
                  </p>
                </div>
                <button
                  className="btn btn-primary"
                  type="button"
                  onClick={() => {
                    void confirmPayment(selectedOrder.id);
                  }}
                >
                  Confirmar pagamento
                </button>
              </section>
            ) : selectedOrder.payment_method === "pix" && normalizeStatus(selectedOrder.status) === "pendente" && selectedOrder.payment_confirmed_at ? (
              <section className="card card-pad" style={{ display: "grid", gap: 12 }}>
                <div>
                  <h4 className="section-title" style={{ marginBottom: 4 }}>
                    Pagamento confirmado
                  </h4>
                  <p className="subtitle" style={{ margin: 0 }}>
                    O pedido continua pendente no dashboard até o preparo ser iniciado.
                  </p>
                </div>
              </section>
            ) : null}

            <section className="card card-pad">
              <h4 className="section-title">Itens do pedido</h4>
              <table className="table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Qtd</th>
                    <th>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {(groupedItems.get(selectedOrder.id) ?? []).map((item) => (
                    <tr key={`${selectedOrder.id}-${item.product_name}`}>
                      <td>{item.product_name}</td>
                      <td>{item.quantity}</td>
                      <td>R$ {(item.subtotal_cents / 100).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="card card-pad">
              <h4 className="section-title">Observação</h4>
              <p className="subtitle" style={{ margin: 0 }}>
                {selectedOrder.notes || "Sem observação."}
              </p>
            </section>
          </div>
        </div>
      ) : null}
    </AdminLayout>
  );
}
