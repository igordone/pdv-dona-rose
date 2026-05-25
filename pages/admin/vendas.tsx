import type { GetServerSideProps } from "next";
import { getServerSession } from "next-auth/next";
import { useEffect, useMemo, useState } from "react";
import { authOptions } from "../api/auth/[...nextauth]";
import { AdminLayout } from "../../components/AdminLayout";

type ResponseData = {
  orders: Array<{
    id: number;
    client_name: string | null;
    client_phone: string | null;
    status: string;
    total_cents: number;
    notes: string | null;
    created_at: string;
    order_date: string;
  }>;
  items: Array<{
    order_id: number;
    product_name: string;
    quantity: number;
    unit_price_cents: number;
    subtotal_cents: number;
  }>;
};

type LossItem = {
  id: number;
  batch_id: string | null;
  operator_name: string | null;
  loss_date: string;
  product_name: string;
  quantity: number;
  observation: string;
  total_cents: number;
  created_at: string;
};

type LossResponse = {
  items: LossItem[];
};

type SelectedOrder = ResponseData["orders"][number] | null;

type LossGroup = {
  key: string;
  operatorName: string;
  lossDate: string;
  observation: string;
  createdAt: string;
  totalCents: number;
  quantity: number;
  items: LossItem[];
};

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

function formatDateGroup(date: Date) {
  const label = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);

  return label.charAt(0).toUpperCase() + label.slice(1);
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toDateKey(value: string) {
  return value.slice(0, 10);
}

export default function VendasPage() {
  const [data, setData] = useState<ResponseData | null>(null);
  const [losses, setLosses] = useState<LossItem[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<SelectedOrder>(null);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    void Promise.all([fetch("/api/admin/sales"), fetch("/api/admin/losses")])
      .then(async ([salesResponse, lossesResponse]) => {
        const [salesPayload, lossesPayload] = (await Promise.all([
          salesResponse.json() as Promise<ResponseData>,
          lossesResponse.json() as Promise<LossResponse>,
        ])) as [ResponseData, LossResponse];

        setData(salesPayload);
        setLosses(lossesPayload.items ?? []);
      })
      .catch(() => {
        setData(null);
        setLosses([]);
      });
  }, []);

  const groupedItems = useMemo(() => {
    const map = new Map<number, ResponseData["items"]>();
    for (const item of data?.items ?? []) {
      map.set(item.order_id, [...(map.get(item.order_id) ?? []), item]);
    }
    return map;
  }, [data?.items]);

  const summary = useMemo(() => {
    const orders = data?.orders ?? [];
    const items = data?.items ?? [];
    const totalCents = orders.reduce((sum, order) => sum + order.total_cents, 0);
    const totalOrders = orders.length;
    const itemCounts = new Map<string, number>();
    for (const item of items) {
      itemCounts.set(item.product_name, (itemCounts.get(item.product_name) ?? 0) + item.quantity);
    }
    const topItem = Array.from(itemCounts.entries()).sort((a, b) => b[1] - a[1])[0];
    const average = totalOrders ? totalCents / totalOrders : 0;

    return {
      totalCents,
      totalOrders,
      average,
      topItem: topItem?.[0] ?? "Sem dados",
      topCount: topItem?.[1] ?? 0,
    };
  }, [data?.items, data?.orders]);

  const groupedOrders = useMemo(() => {
    const map = new Map<string, ResponseData["orders"]>();

    for (const order of data?.orders ?? []) {
      const dateKey = order.order_date || toDateKey(order.created_at);
      map.set(dateKey, [...(map.get(dateKey) ?? []), order]);
    }

    return Array.from(map.entries()).map(([dateKey, orders]) => ({
      dateKey,
      label: formatDateGroup(new Date(`${dateKey}T12:00:00`)),
      orders,
      total: orders.reduce((sum, order) => sum + order.total_cents, 0),
    }));
  }, [data?.orders]);

  const lossesByDate = useMemo(() => {
    const map = new Map<string, number>();

    for (const loss of losses) {
      const dateKey = loss.loss_date.slice(0, 10);
      map.set(dateKey, (map.get(dateKey) ?? 0) + loss.total_cents);
    }

    return map;
  }, [losses]);

  function toggleGroup(dateKey: string) {
    setOpenGroups((current) => ({
      ...current,
      [dateKey]: !current[dateKey],
    }));
  }

  return (
    <AdminLayout title="Histórico de Vendas Diárias" subtitle="Pedidos agrupados por data da venda.">
      <div className="grid" style={{ gap: 20, overflowAnchor: "none" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: 12,
            marginBottom: 2,
          }}
        >
          {[
            { label: "Total na semana", value: `R$ ${(summary.totalCents / 100).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`, sub: "+8% vs semana anterior" },
            { label: "Pedidos", value: String(summary.totalOrders), sub: "média 7,7 / dia" },
            { label: "Ticket médio", value: `R$ ${(summary.average / 100).toFixed(2)}`, sub: "+R$ 2,10 vs anterior" },
            { label: "Item mais vendido", value: summary.topItem, sub: `${summary.topCount} unidades` },
          ].map((stat) => (
            <article
              key={stat.label}
              className="card"
              style={{
                padding: "12px 14px",
                display: "grid",
                gap: 4,
              }}
            >
              <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1 }}>
                {stat.label}
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text)", letterSpacing: -0.3 }}>
                {stat.value}
              </div>
              <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{stat.sub}</div>
            </article>
          ))}
        </div>

        {groupedOrders.map((group, index) => {
          const expanded = openGroups[group.dateKey] ?? index === 0;
          const lossesTotalForDay = lossesByDate.get(group.dateKey) ?? 0;
          const netTotal = group.total - lossesTotalForDay;

          return (
            <section key={group.dateKey} className="card" style={{ overflow: "hidden" }}>
              <div
                className="card-pad"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 16,
                  alignItems: "flex-start",
                  background: "white",
                  paddingTop: 22,
                  paddingBottom: 22,
                }}
              >
                <div style={{ minWidth: 0, flex: 1, display: "grid", gap: 14 }}>
                  <div style={{ display: "grid", gap: 4 }}>
                    <h2
                      className="section-title"
                      style={{
                        marginBottom: 0,
                        fontSize: "1.35rem",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {group.label}
                    </h2>
                    <p
                      className="subtitle"
                      style={{
                        margin: 0,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {group.orders.length} pedido{group.orders.length === 1 ? "" : "s"} no dia
                    </p>
                  </div>

                  <div
                    className="grid"
                    style={{
                      gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                      gap: 12,
                    }}
                  >
                    <article
                      className="card"
                      style={{
                        padding: "12px 14px",
                        display: "grid",
                        gap: 4,
                        borderLeft: "3px solid var(--brand)",
                        boxShadow: "none",
                      }}
                    >
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1 }}>
                        Total vendido
                      </div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text)", letterSpacing: -0.3 }}>
                        R$ {(netTotal / 100).toFixed(2)}
                      </div>
                    </article>

                    <article
                      className="card"
                      style={{
                        padding: "12px 14px",
                        display: "grid",
                        gap: 4,
                        borderLeft: "3px solid var(--danger)",
                        boxShadow: "none",
                      }}
                    >
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1 }}>
                        Perdas
                      </div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: "var(--danger)", letterSpacing: -0.3 }}>
                        -R$ {(lossesTotalForDay / 100).toFixed(2)}
                      </div>
                    </article>

                    <article
                      className="card"
                      style={{
                        padding: "12px 14px",
                        display: "grid",
                        gap: 4,
                        borderLeft: "3px solid var(--success)",
                        boxShadow: "none",
                      }}
                    >
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1 }}>
                        Volume
                      </div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text)", letterSpacing: -0.3 }}>
                        {group.orders.length} pedido{group.orders.length === 1 ? "" : "s"} no dia
                      </div>
                    </article>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => toggleGroup(group.dateKey)}
                  className="btn btn-ghost"
                  style={{
                    background: "rgba(255,244,224,0.95)",
                    border: "1px solid rgba(180,83,9,0.32)",
                    color: "var(--brand-2)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "10px 14px",
                    flexShrink: 0,
                    whiteSpace: "nowrap",
                  }}
                >
                  Ver detalhes
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                    {expanded ? "expand_less" : "expand_more"}
                  </span>
                </button>
              </div>

              {expanded ? (
                <div style={{ padding: "0 18px 18px" }}>
                  <div className="card" style={{ overflow: "hidden" }}>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1.2fr 0.6fr 1.8fr 0.8fr 0.6fr",
                        gap: 12,
                        padding: "14px 16px",
                        borderBottom: "1px solid var(--line)",
                        fontWeight: 800,
                        background: "rgba(255, 251, 244, 0.92)",
                      }}
                    >
                      <div>Pedido #</div>
                      <div>Hora</div>
                      <div>Itens</div>
                      <div>Valor</div>
                      <div />
                    </div>

                    {group.orders.map((order, orderIndex) => {
                      const itemsList = (groupedItems.get(order.id) ?? [])
                        .map((item) => `${item.quantity}x ${item.product_name}`)
                        .join(", ");

                      return (
                        <div
                          key={order.id}
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1.2fr 0.6fr 1.8fr 0.8fr 0.6fr",
                            gap: 12,
                            padding: "14px 16px",
                            borderBottom: orderIndex === group.orders.length - 1 ? 0 : "1px solid var(--line)",
                            alignItems: "center",
                            background: orderIndex % 2 === 0 ? "white" : "rgba(255, 251, 244, 0.72)",
                          }}
                        >
                          <div style={{ fontWeight: 700 }}>#{order.id}</div>
                          <div>{formatTime(order.created_at)}</div>
                          <div className="muted" style={{ lineHeight: 1.35 }}>
                            {itemsList || "Sem itens"}
                          </div>
                          <div style={{ fontWeight: 700 }}>R$ {(order.total_cents / 100).toFixed(2)}</div>
                          <div style={{ display: "flex", justifyContent: "flex-end" }}>
                            <button
                              className="btn btn-ghost"
                              type="button"
                              onClick={() => setSelectedOrder(order)}
                              style={{
                                background: "rgba(255,255,255,0.88)",
                                border: "1px solid rgba(180,83,9,0.24)",
                              }}
                            >
                              Ver detalhes
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </section>
          );
        })}
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
                <div className="muted">
                  {selectedOrder.client_name || "Sem nome"}
                  {selectedOrder.client_phone ? ` · ${selectedOrder.client_phone}` : ""}
                </div>
              </div>
              <button className="btn btn-ghost" type="button" onClick={() => setSelectedOrder(null)}>
                Fechar
              </button>
            </div>

            <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
              <div className="card card-pad">
                <div className="muted">Status</div>
                <strong>{selectedOrder.status}</strong>
              </div>
              <div className="card card-pad">
                <div className="muted">Total</div>
                <strong>R$ {(selectedOrder.total_cents / 100).toFixed(2)}</strong>
              </div>
              <div className="card card-pad">
                <div className="muted">Horário</div>
                <strong>{new Date(selectedOrder.created_at).toLocaleTimeString("pt-BR")}</strong>
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
