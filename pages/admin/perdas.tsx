import type { GetServerSideProps } from "next";
import { useSession } from "next-auth/react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { AdminLayout } from "../../components/AdminLayout";
import { requireAdminPageSession } from "../../lib/admin-access";

type ProductItem = {
  id: number;
  name: string;
};

type LossItem = {
  id: number;
  batch_id: string | null;
  operator_name: string | null;
  loss_date: string;
  product_id: number | null;
  product_name: string;
  quantity: number;
  observation: string;
  unit_price_cents: number;
  total_cents: number;
  created_at: string;
};

type LossSort = "date-desc" | "date-asc" | "price-desc" | "price-asc";

type SelectedLossItem = {
  id: number;
  name: string;
  quantity: number;
};

type CreatedLossResponse = LossItem;

type LossGroup = {
  key: string;
  batchId: string | null;
  operatorName: string;
  lossDate: string;
  observation: string;
  createdAt: string;
  quantity: number;
  totalCents: number;
  items: LossItem[];
};

type SalesSummaryResponse = {
  orders: Array<{
    id: number;
    total_cents: number;
    created_at: string;
    order_date: string;
  }>;
};

export const getServerSideProps: GetServerSideProps = async (context) => {
  const adminRedirect = await requireAdminPageSession(context);
  if (adminRedirect) {
    return adminRedirect;
  }

  return { props: {} };
};

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(cents / 100);
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDateOnly(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-");

  if (!year || !month || !day) {
    return value;
  }

  return `${day}/${month}/${year}`;
}

function toDateInputValue(value: string | null) {
  return value ?? "";
}

function toIsoDate(value: string | Date) {
  if (typeof value === "string") {
    const trimmed = value.trim();

    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      return trimmed.slice(0, 10);
    }

    const parsed = new Date(trimmed);

    if (Number.isNaN(parsed.getTime())) {
      return new Date().toISOString().slice(0, 10);
    }

    return parsed.toLocaleDateString("en-CA");
  }

  const date = value;

  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }

  return date.toLocaleDateString("en-CA");
}

function parseDateBoundary(value: string, endOfDay: boolean) {
  if (!value) {
    return null;
  }

  const suffix = endOfDay ? "T23:59:59.999" : "T00:00:00.000";
  const parsed = new Date(`${value}${suffix}`);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function groupLosses(losses: LossItem[]) {
  const groups = new Map<string, LossGroup>();

  for (const loss of losses) {
    const key = loss.batch_id ?? `loss-${loss.id}`;
    const existing = groups.get(key);
    const operatorName = loss.operator_name?.trim() || "Admin";

    if (!existing) {
      groups.set(key, {
        key,
        batchId: loss.batch_id,
        operatorName,
        lossDate: loss.loss_date,
        observation: loss.observation,
        createdAt: loss.created_at,
        quantity: loss.quantity,
        totalCents: loss.total_cents,
        items: [loss],
      });
      continue;
    }

    existing.items.push(loss);
    existing.quantity += loss.quantity;
    existing.totalCents += loss.total_cents;
    if (!existing.lossDate || loss.loss_date > existing.lossDate) {
      existing.lossDate = loss.loss_date;
    }

    if (new Date(loss.created_at).getTime() > new Date(existing.createdAt).getTime()) {
      existing.createdAt = loss.created_at;
    }

    if (!existing.observation && loss.observation) {
      existing.observation = loss.observation;
    }
  }

  return Array.from(groups.values()).sort((left, right) => {
    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  });
}

export default function PerdasPage() {
  const { data: session } = useSession();
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [losses, setLosses] = useState<LossItem[]>([]);
  const [salesOrders, setSalesOrders] = useState<SalesSummaryResponse["orders"]>([]);
  const [selectedLossItems, setSelectedLossItems] = useState<SelectedLossItem[]>([]);
  const [observation, setObservation] = useState("");
  const [lossDate, setLossDate] = useState(toIsoDate(new Date()));
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState<LossSort>("date-desc");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [selectedLossGroupKey, setSelectedLossGroupKey] = useState<string | null>(null);

  async function loadData() {
    const [productsResponse, lossesResponse, salesResponse] = await Promise.all([
      fetch("/api/admin/products"),
      fetch("/api/admin/losses"),
      fetch("/api/admin/sales"),
    ]);

    const productsData = (await productsResponse.json()) as { items: Array<{ id: number; name: string }> };
    const lossesData = (await lossesResponse.json()) as { items: LossItem[] };
    const salesData = (await salesResponse.json()) as SalesSummaryResponse;

    setProducts(productsData.items ?? []);
    setLosses(lossesData.items ?? []);
    setSalesOrders(salesData.orders ?? []);
  }

  useEffect(() => {
    void loadData().catch(() => {
      setProducts([]);
      setLosses([]);
      setSalesOrders([]);
    });
  }, []);

  const groupedLosses = useMemo(() => groupLosses(losses), [losses]);

  const salesTotalsByDate = useMemo(() => {
    const map = new Map<string, number>();

    for (const order of salesOrders) {
      const dateKey = order.order_date || toIsoDate(order.created_at);
      map.set(dateKey, (map.get(dateKey) ?? 0) + order.total_cents);
    }

    return map;
  }, [salesOrders]);

  useEffect(() => {
    if (selectedLossGroupKey && !groupedLosses.some((group) => group.key === selectedLossGroupKey)) {
      setSelectedLossGroupKey(null);
    }
  }, [groupedLosses, selectedLossGroupKey]);

  const summary = useMemo(
    () => ({
      totalRecords: groupedLosses.length,
      totalQuantity: losses.reduce((sum, loss) => sum + loss.quantity, 0),
      totalLostValue: losses.reduce((sum, loss) => sum + loss.total_cents, 0),
      totalSalesValue: salesOrders.reduce((sum, order) => sum + order.total_cents, 0),
      latest: losses[0] ? formatDateOnly(losses[0].loss_date) : "Sem registros",
    }),
    [groupedLosses.length, losses, salesOrders],
  );

  const filteredLossGroups = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const from = parseDateBoundary(dateFrom, false);
    const to = parseDateBoundary(dateTo, true);

    let result = [...groupedLosses];

    if (normalizedSearch) {
      result = result.filter((group) => {
        const haystack = [
          group.operatorName,
          group.lossDate,
          formatDateOnly(group.lossDate),
          ...group.items.map((item) => item.product_name),
          String(group.quantity),
        ]
          .join(" ")
          .toLowerCase();

        return haystack.includes(normalizedSearch);
      });
    }

    if (from) {
      result = result.filter((group) => new Date(group.createdAt) >= from);
    }

    if (to) {
      result = result.filter((group) => new Date(group.createdAt) <= to);
    }

    result.sort((left, right) => {
      if (sortMode === "price-asc") {
        return left.totalCents - right.totalCents;
      }

      if (sortMode === "price-desc") {
        return right.totalCents - left.totalCents;
      }

      const leftTime = new Date(left.createdAt).getTime();
      const rightTime = new Date(right.createdAt).getTime();
      return sortMode === "date-asc" ? leftTime - rightTime : rightTime - leftTime;
    });

    return result;
  }, [dateFrom, dateTo, groupedLosses, search, sortMode]);

  const selectedLossGroup = useMemo(
    () => groupedLosses.find((group) => group.key === selectedLossGroupKey) ?? null,
    [groupedLosses, selectedLossGroupKey],
  );

  function addProduct(product: ProductItem) {
    setSelectedLossItems((current) => {
      const existing = current.find((item) => item.id === product.id);

      if (existing) {
        return current.map((item) => (item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item));
      }

      return [...current, { id: product.id, name: product.name, quantity: 1 }];
    });
  }

  function updateQuantity(productId: number, nextQuantity: number) {
    setSelectedLossItems((current) =>
      current
        .map((item) => (item.id === productId ? { ...item, quantity: nextQuantity } : item))
        .filter((item) => item.quantity > 0),
    );
  }

  function removeItem(productId: number) {
    setSelectedLossItems((current) => current.filter((item) => item.id !== productId));
  }

  function resetModal() {
    setIsRegisterModalOpen(false);
    setSelectedLossItems([]);
    setObservation("");
    setMessage("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (selectedLossItems.length === 0) {
      setMessage("Adicione ao menos um produto perdido.");
      return;
    }

    try {
      const response = await fetch("/api/admin/losses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items: selectedLossItems.map((item) => ({
            productId: item.id,
            quantity: item.quantity,
          })),
          observation,
          lossDate,
        }),
      });

      const data = (await response.json()) as { error?: string; items?: CreatedLossResponse[] };

      if (!response.ok) {
        setMessage(data.error ?? "Falha ao registrar perda.");
        return;
      }

      if (data.items?.length) {
        setLosses((current) => [...data.items!, ...current]);
      }

      setMessage("Perda registrada com sucesso.");
      setSelectedLossItems([]);
      setObservation("");
      setLossDate(toIsoDate(new Date()));
      setIsRegisterModalOpen(false);
      await loadData();
    } catch {
      setMessage("Falha ao registrar perda.");
    }
  }

  const totalLostCents = filteredLossGroups.reduce((sum, loss) => sum + loss.totalCents, 0);
  const loggedUserName = session?.user?.name?.trim() || "Admin";

  function getDisplayOperatorName(operatorName?: string | null) {
    if (operatorName && operatorName.trim() && operatorName !== "Colaborador") {
      return operatorName;
    }

    return loggedUserName;
  }

  return (
    <AdminLayout title="Gestão e Histórico de Perdas" subtitle="Gerencie e registre as perdas do restaurante.">
      <div className="grid" style={{ gap: 20 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: 12,
          }}
        >
          {[
            { label: "Total de perdas", value: String(summary.totalRecords), sub: "registros no histórico" },
            { label: "Quantidade total", value: String(summary.totalQuantity), sub: "itens perdidos" },
            { label: "Valor total perdido", value: `- ${formatCurrency(summary.totalLostValue)}`, sub: "soma das perdas" },
            { label: "Último registro", value: summary.latest, sub: "data mais recente" },
          ].map((stat) => (
            <article key={stat.label} className="card" style={{ padding: "12px 14px", display: "grid", gap: 4 }}>
              <div
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  color: "var(--muted)",
                  textTransform: "uppercase",
                  letterSpacing: 1,
                }}
              >
                {stat.label}
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text)", letterSpacing: -0.3 }}>
                {stat.value}
              </div>
              <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{stat.sub}</div>
            </article>
          ))}
        </div>

        <section className="grid" style={{ gap: 14 }}>
          <div className="losses-toolbar">
            <div>
              <h2 className="section-title" style={{ marginBottom: 4 }}>
                Histórico de Perdas
              </h2>
              <p className="subtitle" style={{ margin: 0 }}>
                {groupedLosses.length} registros · últimos 7 dias
              </p>
            </div>

            <div className="losses-toolbar-actions">
              <button className="btn btn-primary" type="button" onClick={() => setIsRegisterModalOpen(true)}>
                Registrar Nova Perda
              </button>
            </div>
          </div>

          <div className="losses-filter-panel">
            <div className="losses-filter-row">
              <div className="subtitle" style={{ margin: 0, fontWeight: 600, color: "var(--text)" }}>
                Ordenar histórico
              </div>
              <div className="modal-choice-strip" style={{ width: "fit-content", maxWidth: "100%" }}>
                {(
                  [
                    { value: "date-desc", label: "Mais recentes" },
                    { value: "date-asc", label: "Mais antigas" },
                    { value: "price-desc", label: "Maior valor" },
                    { value: "price-asc", label: "Menor valor" },
                  ] as Array<{ value: LossSort; label: string }>
                ).map((option) => {
                  const active = sortMode === option.value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={`modal-choice-chip${active ? " is-active" : ""}`}
                      onClick={() => setSortMode(option.value)}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="losses-filter-grid">
              <label className="grid" style={{ gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>Pesquisar</span>
                <div className="search-wrapper">
                  <span className="material-symbols-outlined search-wrapper-icon" aria-hidden="true">
                    search
                  </span>
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Pesquisar por data ou nome..."
                  />
                </div>
              </label>

              <label className="grid" style={{ gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>Data inicial</span>
                <input
                  className="input"
                  type="date"
                  value={toDateInputValue(dateFrom)}
                  onChange={(event) => setDateFrom(event.target.value)}
                />
              </label>

              <label className="grid" style={{ gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>Data final</span>
                <input
                  className="input"
                  type="date"
                  value={toDateInputValue(dateTo)}
                  onChange={(event) => setDateTo(event.target.value)}
                />
              </label>
            </div>
          </div>

          <div className="card" style={{ overflow: "hidden" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1.1fr 0.55fr 1.35fr 0.8fr 0.7fr 0.8fr",
                gap: 12,
                padding: "14px 18px",
                borderBottom: "1px solid var(--line)",
                fontSize: 10.5,
                fontWeight: 600,
                letterSpacing: 1,
                color: "var(--muted)",
                textTransform: "uppercase",
                background: "#fafaf9",
              }}
            >
              <div>Colaborador</div>
              <div>Quantidade</div>
              <div>Observação</div>
              <div>Data</div>
              <div>Total</div>
              <div />
            </div>

            <div className="grid" style={{ gap: 0 }}>
              {filteredLossGroups.map((group, index) => (
                <div
                  key={group.key}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1.1fr 0.55fr 1.35fr 0.8fr 0.7fr 0.8fr",
                    gap: 12,
                    padding: "16px 18px",
                    borderBottom: index === filteredLossGroups.length - 1 ? 0 : "1px solid var(--line)",
                    alignItems: "center",
                    background: index % 2 === 0 ? "white" : "rgba(255, 251, 244, 0.72)",
                  }}
                >
                  <div style={{ fontWeight: 700 }}>{getDisplayOperatorName(group.operatorName)}</div>
                  <div>{group.quantity}</div>
                  <div className="muted" style={{ lineHeight: 1.4 }}>
                    {group.observation}
                  </div>
                  <div>{formatDateOnly(group.lossDate)}</div>
                  <div className="grid" style={{ gap: 4 }}>
                    <div className="losses-total-value">{formatCurrency(group.totalCents)}</div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button className="btn btn-ghost" type="button" onClick={() => setSelectedLossGroupKey(group.key)}>
                      Ver detalhes
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {isRegisterModalOpen ? (
        <div
          role="presentation"
          onClick={resetModal}
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
              width: "min(1120px, 100%)",
              maxHeight: "85vh",
              overflow: "auto",
              padding: 24,
              display: "grid",
              gap: 18,
            }}
          >
            <div className="losses-toolbar">
              <span className="pill">Registrar perda</span>
              <button className="btn btn-ghost" type="button" onClick={resetModal}>
                Fechar
              </button>
            </div>

            <form onSubmit={handleSubmit} className="grid" style={{ gap: 16 }}>
              <div className="losses-modal-grid">
                <section className="losses-modal-column">
                  <div className="losses-column-header">
                    <div>
                      <h4 className="section-title" style={{ marginBottom: 4, fontSize: 15 }}>
                        Produtos do cardápio
                      </h4>
                      <p className="subtitle" style={{ margin: 0 }}>
                        Clique em adicionar para montar o registro.
                      </p>
                    </div>
                    <span className="pill">{products.length} itens</span>
                  </div>

                  <div className="losses-product-list">
                    {products.length === 0 ? (
                      <div className="losses-select-empty">Nenhum produto encontrado no cardápio.</div>
                    ) : (
                      products.map((product) => (
                        <button
                          key={product.id}
                          type="button"
                          className="losses-product-row"
                          onClick={() => addProduct(product)}
                        >
                          <span className="losses-product-name">{product.name}</span>
                          <span className="btn btn-ghost losses-product-add">Adicionar</span>
                        </button>
                      ))
                    )}
                  </div>
                </section>

                <section className="losses-modal-column">
                  <div className="losses-column-header">
                    <div>
                      <h4 className="section-title" style={{ marginBottom: 4, fontSize: 15 }}>
                        Itens perdidos
                      </h4>
                      <p className="subtitle" style={{ margin: 0 }}>
                        {selectedLossItems.length} item(ns) adicionados.
                      </p>
                    </div>
                    <button className="btn btn-ghost" type="button" onClick={() => setSelectedLossItems([])}>
                      Limpar
                    </button>
                  </div>

                  <label className="grid" style={{ gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>Data</span>
                    <input
                      className="input"
                      type="date"
                      value={toDateInputValue(lossDate)}
                      onChange={(event) => setLossDate(event.target.value)}
                    />
                  </label>

                  <div className="losses-cart-card">
                    <div className="losses-cart-list">
                      {selectedLossItems.length === 0 ? (
                        <div className="losses-cart-empty">Nenhum item adicionado ainda.</div>
                      ) : (
                        selectedLossItems.map((item) => (
                          <div key={item.id} className="losses-cart-item">
                            <div className="losses-cart-item-copy">
                              <strong>{item.name}</strong>
                              <div className="muted" style={{ fontSize: 12 }}>
                                Item do cardápio
                              </div>
                            </div>

                            <div className="public-cart-controls">
                              <button
                                className="btn btn-ghost"
                                type="button"
                                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                              >
                                -
                              </button>
                              <span className="public-cart-qty">{item.quantity}</span>
                              <button
                                className="btn btn-ghost"
                                type="button"
                                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                              >
                                +
                              </button>
                              <button
                                className="btn btn-danger"
                                type="button"
                                onClick={() => removeItem(item.id)}
                              >
                                Remover
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="grid" style={{ gap: 6 }}>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>Observação</label>
                      <textarea
                        className="textarea"
                        value={observation}
                        onChange={(event) => setObservation(event.target.value)}
                        placeholder="Descreva a perda"
                        style={{ minHeight: 126 }}
                      />
                    </div>

                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                      <button className="btn btn-ghost" type="button" onClick={resetModal}>
                        Cancelar
                      </button>
                      <button className="btn btn-primary" type="submit" style={{ minWidth: 180 }}>
                        Salvar
                      </button>
                    </div>
                  </div>
                </section>
              </div>

              {message ? <p style={{ margin: 0 }}>{message}</p> : null}
            </form>
          </div>
        </div>
      ) : null}

      {selectedLossGroup ? (
        <div
          role="presentation"
          onClick={() => setSelectedLossGroupKey(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(20, 12, 8, 0.48)",
            display: "grid",
            placeItems: "center",
            padding: 20,
            zIndex: 60,
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
            className="card"
            style={{
              width: "min(860px, 100%)",
              maxHeight: "85vh",
              overflow: "auto",
              padding: 24,
              display: "grid",
              gap: 18,
            }}
          >
            <div className="losses-toolbar">
              <div>
                <span className="pill">Ver detalhes</span>
                <h3 style={{ margin: "10px 0 4px" }}>{getDisplayOperatorName(selectedLossGroup.operatorName)}</h3>
                <p className="subtitle" style={{ margin: 0 }}>
                  {formatDateOnly(selectedLossGroup.lossDate)} · {selectedLossGroup.items.length} produto(s)
                </p>
              </div>
              <button className="btn btn-ghost" type="button" onClick={() => setSelectedLossGroupKey(null)}>
                Fechar
              </button>
            </div>

            <div className="losses-cart-card">
              <div className="losses-column-header">
                <div>
                  <h4 className="section-title" style={{ marginBottom: 4, fontSize: 15 }}>
                    Resumo do lote
                  </h4>
                  <p className="subtitle" style={{ margin: 0 }}>
                    Observação: {selectedLossGroup.observation || "Sem observação"}
                  </p>
                </div>

                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>Valor total</div>
                  <strong className="losses-total-value" style={{ fontSize: 18 }}>
                    {formatCurrency(selectedLossGroup.totalCents)}
                  </strong>
                  <div className="muted" style={{ fontSize: 11.5, marginTop: 4 }}>
                    Vendas do dia: {formatCurrency(salesTotalsByDate.get(selectedLossGroup.lossDate) ?? 0)}
                  </div>
                </div>
              </div>

              <div className="losses-cart-list" style={{ maxHeight: 340 }}>
                {selectedLossGroup.items.map((item) => {
                  const subtotal = item.total_cents;

                  return (
                    <div key={item.id} className="losses-cart-item">
                      <div className="losses-cart-item-copy">
                        <strong>{item.product_name}</strong>
                        <div className="muted" style={{ fontSize: 12 }}>
                          Quantidade: {item.quantity}
                        </div>
                      </div>

                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 12, color: "var(--muted)" }}>Subtotal</div>
                        <strong>{formatCurrency(subtotal)}</strong>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </AdminLayout>
  );
}
