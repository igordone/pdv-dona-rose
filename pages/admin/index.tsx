import type { GetServerSideProps } from "next";
import { getServerSession } from "next-auth/next";
import { useEffect, useMemo, useState } from "react";
import { authOptions } from "../api/auth/[...nextauth]";
import { AdminLayout } from "../../components/AdminLayout";

type DashboardData = {
  orders: Array<{
    id: number;
    client_name: string | null;
    client_phone: string | null;
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

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);

  if (!session?.user) {
    return {
      redirect: {
        destination: "/admin/login",
        permanent: false,
      },
    };
  }

  return { props: {} };
};

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getStatusLabel(status: string) {
  if (status === "completed") {
    return "Completo";
  }
  if (status === "cancelled") {
    return "Cancelado";
  }
  return "Pendente";
}

function normalizePhoneForWhatsApp(phone: string) {
  return phone.replace(/[^\d]/g, "");
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
  const pendingOrders = orders.filter((order) => order.status === "pending").length;
  const completedOrders = orders.filter((order) => order.status === "completed").length;
  const cancelledOrders = orders.filter((order) => order.status === "cancelled").length;

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

          <article className="dashboard-stat dashboard-stat--completed">
            <div className="dashboard-stat-label">Completos</div>
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
            {orders.map((order) => {
              const statusClass =
                order.status === "completed"
                  ? "order-card order-card--completed"
                  : order.status === "cancelled"
                    ? "order-card order-card--cancelled"
                    : "order-card order-card--pending";

              return (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => openOrder(order)}
                  className={statusClass}
                  style={{
                    textAlign: "left",
                    width: "100%",
                    padding: 0,
                    overflow: "hidden",
                  }}
                >
                  <div style={{ padding: 18 }}>
                    <div className="order-card-top">
                      <div>
                        <strong>Pedido #{order.id}</strong>
                        <div className="muted" style={{ marginTop: 6 }}>
                          Cliente: {order.client_name || "Sem nome"}
                        </div>
                      </div>
                      <span className="pill">{getStatusLabel(order.status)}</span>
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
                  </div>
                </button>
              );
            })}
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
            </div>

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
