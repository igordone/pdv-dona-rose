import type { GetServerSideProps } from "next";
import { useSession } from "next-auth/react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { AdminLayout } from "../../components/AdminLayout";
import { requireAdminPageSession } from "../../lib/admin-access";

type ProductItem = {
  id: number;
  name: string;
  price_cents: number;
  cost_cents: number;
  brand: string | null;
  quantity: number;
  active: boolean;
  image_path: string | null;
  category_id: number | null;
  category_name: string | null;
};

type PurchaseCatalogItem = {
  id: number;
  name: string;
  brand: string | null;
  cost_cents: number;
  image_path: string | null;
  purchase_category_id: number | null;
  purchase_category_name: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
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

type PurchaseItem = {
  id: number;
  batch_id: string | null;
  operator_name: string | null;
  purchase_date: string;
  source_type: "menu" | "purchase";
  source_id: number | null;
  product_id: number | null;
  product_name: string;
  brand: string | null;
  quantity: number;
  unit_cost_cents: number;
  subtotal_cents: number;
  observation: string | null;
  total_cents: number;
  created_at: string;
};

type PurchaseSort = "date-desc" | "date-asc" | "price-desc" | "price-asc";

type SelectedLossItem = {
  id: number;
  name: string;
  quantity: number;
};

type SelectedPurchaseItem = {
  key: string;
  sourceType: "menu" | "purchase";
  sourceId: number;
  name: string;
  brand: string | null;
  cost_cents: number;
  image_path: string | null;
  quantity: number;
};

type PurchaseSelectableItem = {
  key: string;
  sourceType: "menu" | "purchase";
  sourceId: number;
  name: string;
  brand: string | null;
  cost_cents: number;
  image_path: string | null;
  category_name: string | null;
  quantity: number;
  active: boolean;
};

type CreatedLossResponse = LossItem;

type CreatedPurchaseResponse = PurchaseItem;

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

type PurchaseGroup = {
  key: string;
  batchId: string | null;
  operatorName: string;
  purchaseDate: string;
  observation: string | null;
  createdAt: string;
  quantity: number;
  totalCents: number;
  items: PurchaseItem[];
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

function groupPurchases(purchases: PurchaseItem[]) {
  const groups = new Map<string, PurchaseGroup>();

  for (const purchase of purchases) {
    const key = purchase.batch_id ?? `purchase-${purchase.id}`;
    const existing = groups.get(key);
    const operatorName = purchase.operator_name?.trim() || "Admin";

    if (!existing) {
      groups.set(key, {
        key,
        batchId: purchase.batch_id,
        operatorName,
        purchaseDate: purchase.purchase_date,
        observation: purchase.observation,
        createdAt: purchase.created_at,
        quantity: purchase.quantity,
        totalCents: purchase.subtotal_cents,
        items: [purchase],
      });
      continue;
    }

    existing.items.push(purchase);
    existing.quantity += purchase.quantity;
    existing.totalCents += purchase.subtotal_cents;

    if (!existing.purchaseDate || purchase.purchase_date > existing.purchaseDate) {
      existing.purchaseDate = purchase.purchase_date;
    }

    if (new Date(purchase.created_at).getTime() > new Date(existing.createdAt).getTime()) {
      existing.createdAt = purchase.created_at;
    }

    if (!existing.observation && purchase.observation) {
      existing.observation = purchase.observation;
    }
  }

  return Array.from(groups.values()).sort((left, right) => {
    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  });
}

export default function PerdasPage() {
  const { data: session } = useSession();
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [purchaseCatalogItems, setPurchaseCatalogItems] = useState<PurchaseCatalogItem[]>([]);
  const [losses, setLosses] = useState<LossItem[]>([]);
  const [purchases, setPurchases] = useState<PurchaseItem[]>([]);
  const [salesOrders, setSalesOrders] = useState<SalesSummaryResponse["orders"]>([]);
  const [selectedLossItems, setSelectedLossItems] = useState<SelectedLossItem[]>([]);
  const [selectedPurchaseItems, setSelectedPurchaseItems] = useState<SelectedPurchaseItem[]>([]);
  const [observation, setObservation] = useState("");
  const [purchaseObservation, setPurchaseObservation] = useState("");
  const [lossDate, setLossDate] = useState(toIsoDate(new Date()));
  const [purchaseDate, setPurchaseDate] = useState(toIsoDate(new Date()));
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState<LossSort>("date-desc");
  const [purchaseSortMode, setPurchaseSortMode] = useState<PurchaseSort>("date-desc");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [selectedLossGroupKey, setSelectedLossGroupKey] = useState<string | null>(null);
  const [selectedPurchaseGroupKey, setSelectedPurchaseGroupKey] = useState<string | null>(null);
  const [activePurchaseCategory, setActivePurchaseCategory] = useState("Todas");
  const [activeSection, setActiveSection] = useState<"perdas" | "compras">("perdas");

  async function loadData() {
    const [productsResponse, catalogResponse, lossesResponse, salesResponse, purchasesResponse] = await Promise.all([
      fetch("/api/admin/products"),
      fetch("/api/admin/purchase-items"),
      fetch("/api/admin/losses"),
      fetch("/api/admin/sales"),
      fetch("/api/admin/purchases"),
    ]);

    const productsData = (await productsResponse.json()) as { items: ProductItem[] };
    const catalogData = (await catalogResponse.json()) as { items: PurchaseCatalogItem[] };
    const lossesData = (await lossesResponse.json()) as { items: LossItem[] };
    const salesData = (await salesResponse.json()) as SalesSummaryResponse;
    const purchasesData = (await purchasesResponse.json()) as { items: PurchaseItem[] };

    setProducts(productsData.items ?? []);
    setPurchaseCatalogItems(catalogData.items ?? []);
    setLosses(lossesData.items ?? []);
    setSalesOrders(salesData.orders ?? []);
    setPurchases(purchasesData.items ?? []);
  }

  useEffect(() => {
    void loadData().catch(() => {
      setProducts([]);
      setPurchaseCatalogItems([]);
      setLosses([]);
      setSalesOrders([]);
      setPurchases([]);
    });
  }, []);

  const groupedLosses = useMemo(() => groupLosses(losses), [losses]);
  const groupedPurchases = useMemo(() => groupPurchases(purchases), [purchases]);

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

  useEffect(() => {
    if (selectedPurchaseGroupKey && !groupedPurchases.some((group) => group.key === selectedPurchaseGroupKey)) {
      setSelectedPurchaseGroupKey(null);
    }
  }, [groupedPurchases, selectedPurchaseGroupKey]);

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

  const purchaseSummary = useMemo(
    () => ({
      totalRecords: groupedPurchases.length,
      totalQuantity: groupedPurchases.reduce((sum, purchase) => sum + purchase.quantity, 0),
      totalValue: groupedPurchases.reduce((sum, purchase) => sum + purchase.totalCents, 0),
      latest: groupedPurchases[0] ? formatDateOnly(groupedPurchases[0].purchaseDate) : "Sem registros",
    }),
    [groupedPurchases],
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

  const filteredPurchaseGroups = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const from = parseDateBoundary(dateFrom, false);
    const to = parseDateBoundary(dateTo, true);

    let result = [...groupedPurchases];

    if (normalizedSearch) {
      result = result.filter((group) => {
        const haystack = [
          group.operatorName,
          group.purchaseDate,
          formatDateOnly(group.purchaseDate),
          ...group.items.map((item) => item.product_name),
          ...group.items.map((item) => item.brand ?? ""),
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
      if (purchaseSortMode === "price-asc") {
        return left.totalCents - right.totalCents;
      }

      if (purchaseSortMode === "price-desc") {
        return right.totalCents - left.totalCents;
      }

      const leftTime = new Date(left.createdAt).getTime();
      const rightTime = new Date(right.createdAt).getTime();
      return purchaseSortMode === "date-asc" ? leftTime - rightTime : rightTime - leftTime;
    });

    return result;
  }, [dateFrom, dateTo, groupedPurchases, purchaseSortMode, search]);

  const selectedLossGroup = useMemo(
    () => groupedLosses.find((group) => group.key === selectedLossGroupKey) ?? null,
    [groupedLosses, selectedLossGroupKey],
  );

  const selectedPurchaseGroup = useMemo(
    () => groupedPurchases.find((group) => group.key === selectedPurchaseGroupKey) ?? null,
    [groupedPurchases, selectedPurchaseGroupKey],
  );

  const combinedPurchaseItems = useMemo<PurchaseSelectableItem[]>(() => {
    const merged: PurchaseSelectableItem[] = [
      ...products.map((product) => ({
        key: `menu:${product.id}`,
        sourceType: "menu" as const,
        sourceId: product.id,
        name: product.name,
        brand: product.brand,
        cost_cents: product.cost_cents,
        image_path: product.image_path,
        category_name: product.category_name,
        quantity: product.quantity,
        active: product.active,
      })),
      ...purchaseCatalogItems.map((item) => ({
        key: `purchase:${item.id}`,
        sourceType: "purchase" as const,
        sourceId: item.id,
        name: item.name,
        brand: item.brand,
        cost_cents: item.cost_cents,
        image_path: item.image_path,
        category_name: item.purchase_category_name,
        quantity: 0,
        active: item.active,
      })),
    ];

    return merged;
  }, [products, purchaseCatalogItems]);

  const combinedPurchaseCategoryFilters = useMemo(() => {
    const categories = new Set<string>();

    for (const item of combinedPurchaseItems) {
      if (item.category_name && item.category_name.trim()) {
        categories.add(item.category_name.trim());
      }
    }

    return ["Todas", ...Array.from(categories).sort((left, right) => left.localeCompare(right, "pt-BR"))];
  }, [combinedPurchaseItems]);

  const visiblePurchaseItems = useMemo(() => {
    if (activePurchaseCategory === "Todas") {
      return combinedPurchaseItems;
    }

    return combinedPurchaseItems.filter((item) => item.category_name === activePurchaseCategory);
  }, [activePurchaseCategory, combinedPurchaseItems]);

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

  function addPurchaseItem(item: PurchaseSelectableItem) {
    const key = item.key;

    setSelectedPurchaseItems((current) => {
      const existing = current.find((entry) => entry.key === key);

      if (existing) {
        return current.map((item) =>
          item.key === key
            ? {
                ...item,
                quantity: item.quantity + 1,
                image_path: item.image_path ?? existing.image_path ?? null,
              }
            : item,
        );
      }

      return [
        ...current,
        {
          key,
          sourceType: item.sourceType,
          sourceId: item.sourceId,
          name: item.name,
          brand: item.brand,
          cost_cents: item.cost_cents,
          image_path: item.image_path,
          quantity: 1,
        },
      ];
    });
  }

  function updatePurchaseQuantity(itemKey: string, nextQuantity: number) {
    setSelectedPurchaseItems((current) =>
      current
        .map((item) => (item.key === itemKey ? { ...item, quantity: nextQuantity } : item))
        .filter((item) => item.quantity > 0),
    );
  }

  function removePurchaseItem(itemKey: string) {
    setSelectedPurchaseItems((current) => current.filter((item) => item.key !== itemKey));
  }

  function resetModal() {
    setIsRegisterModalOpen(false);
    setSelectedLossItems([]);
    setObservation("");
    setMessage("");
  }

  function resetPurchaseModal() {
    setIsPurchaseModalOpen(false);
    setSelectedPurchaseItems([]);
    setPurchaseObservation("");
    setPurchaseDate(toIsoDate(new Date()));
    setActivePurchaseCategory("Todas");
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

  async function handlePurchaseSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (selectedPurchaseItems.length === 0) {
      setMessage("Adicione ao menos um item comprado.");
      return;
    }

    try {
      const response = await fetch("/api/admin/purchases", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items: selectedPurchaseItems.map((item) => ({
            sourceType: item.sourceType,
            sourceId: item.sourceId,
            quantity: item.quantity,
          })),
          observation: purchaseObservation,
          purchaseDate,
        }),
      });

      const data = (await response.json()) as { error?: string; items?: CreatedPurchaseResponse[] };

      if (!response.ok) {
        setMessage(data.error ?? "Falha ao registrar compra.");
        return;
      }

      if (data.items?.length) {
        setPurchases((current) => [...data.items!, ...current]);
      }

      setMessage("Compra registrada com sucesso.");
      setSelectedPurchaseItems([]);
      setPurchaseObservation("");
      setPurchaseDate(toIsoDate(new Date()));
      setIsPurchaseModalOpen(false);
      await loadData();
    } catch {
      setMessage("Falha ao registrar compra.");
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
    <AdminLayout title="Gastos" subtitle="Gerencie perdas e compras do restaurante.">
      <div className="grid" style={{ gap: 20 }}>
        <div className="modal-choice-strip" style={{ width: "fit-content" }}>
          {[
            { key: "perdas", label: "Perdas", icon: "delete" },
            { key: "compras", label: "Compras", icon: "shopping_bag" },
          ].map((tab) => {
            const active = activeSection === tab.key;

            return (
              <button
                key={tab.key}
                type="button"
                className={`modal-choice-chip${active ? " is-active" : ""}`}
                onClick={() => setActiveSection(tab.key as "perdas" | "compras")}
              >
                <span className="material-symbols-outlined" aria-hidden="true">
                  {tab.icon}
                </span>
                {tab.label}
              </button>
            );
          })}
        </div>

        {activeSection === "perdas" ? (
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
      ) : null}

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

        {activeSection === "compras" ? (
          <div className="grid" style={{ gap: 20 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                gap: 12,
              }}
            >
              {[
                { label: "Total de compras", value: String(purchaseSummary.totalRecords), sub: "registros no histórico" },
                { label: "Quantidade total", value: String(purchaseSummary.totalQuantity), sub: "itens comprados" },
                { label: "Valor total gasto", value: formatCurrency(purchaseSummary.totalValue), sub: "soma das compras" },
                { label: "Último registro", value: purchaseSummary.latest, sub: "data mais recente" },
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
                    Histórico de Compras
                  </h2>
                  <p className="subtitle" style={{ margin: 0 }}>
                    {groupedPurchases.length} registros · controle diário de gastos
                  </p>
                </div>

                <div className="losses-toolbar-actions">
                  <button
                    className="btn btn-primary"
                    type="button"
                    onClick={() => {
                      setIsPurchaseModalOpen(true);
                    }}
                  >
                    Registrar Nova Compra
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
                      ] as Array<{ value: PurchaseSort; label: string }>
                    ).map((option) => {
                      const active = purchaseSortMode === option.value;

                      return (
                        <button
                          key={option.value}
                          type="button"
                          className={`modal-choice-chip${active ? " is-active" : ""}`}
                          onClick={() => setPurchaseSortMode(option.value)}
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
                        placeholder="Pesquisar por data, item ou marca..."
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
                  {filteredPurchaseGroups.map((group, index) => (
                    <div
                      key={group.key}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1.1fr 0.55fr 1.35fr 0.8fr 0.7fr 0.8fr",
                        gap: 12,
                        padding: "16px 18px",
                        borderBottom: index === filteredPurchaseGroups.length - 1 ? 0 : "1px solid var(--line)",
                        alignItems: "center",
                        background: index % 2 === 0 ? "white" : "rgba(255, 251, 244, 0.72)",
                      }}
                    >
                      <div style={{ fontWeight: 700 }}>{getDisplayOperatorName(group.operatorName)}</div>
                      <div>{group.quantity}</div>
                      <div className="muted" style={{ lineHeight: 1.4 }}>
                        {group.observation || "Sem observação"}
                      </div>
                      <div>{formatDateOnly(group.purchaseDate)}</div>
                      <div className="grid" style={{ gap: 4 }}>
                        <div className="losses-total-value">{formatCurrency(group.totalCents)}</div>
                      </div>
                      <div style={{ display: "flex", justifyContent: "flex-end" }}>
                        <button
                          className="btn btn-ghost"
                          type="button"
                          onClick={() => setSelectedPurchaseGroupKey(group.key)}
                        >
                          Ver detalhes
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
        ) : null}

        {isPurchaseModalOpen ? (
          <div
            role="presentation"
            onClick={resetPurchaseModal}
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
                <span className="pill">Registrar compra</span>
                <button className="btn btn-ghost" type="button" onClick={resetPurchaseModal}>
                  Fechar
                </button>
              </div>

              <form onSubmit={handlePurchaseSubmit} className="grid" style={{ gap: 16 }}>
                <div className="losses-modal-grid">
                  <section className="losses-modal-column">
                    <div className="losses-column-header">
                      <div>
                        <h4 className="section-title" style={{ marginBottom: 4, fontSize: 15 }}>
                          Itens para comprar
                        </h4>
                        <p className="subtitle" style={{ margin: 0 }}>
                        Filtre por categoria para listar todos os itens disponíveis.
                        </p>
                      </div>
                      <span className="pill">
                        {visiblePurchaseItems.length} itens
                      </span>
                    </div>

                    <div className="modal-choice-strip" style={{ width: "fit-content", flexWrap: "wrap" }}>
                      {combinedPurchaseCategoryFilters.map((category) => {
                        const active = activePurchaseCategory === category;

                        return (
                          <button
                            key={category}
                            type="button"
                            className={`modal-choice-chip${active ? " is-active" : ""}`}
                            onClick={() => setActivePurchaseCategory(category)}
                          >
                            {category}
                          </button>
                        );
                      })}
                    </div>

                    <div className="losses-product-list">
                      {visiblePurchaseItems.length === 0 ? (
                        <div className="losses-select-empty">Nenhum item encontrado para essa categoria.</div>
                      ) : (
                        visiblePurchaseItems.map((item) => (
                          <button
                            key={item.key}
                            type="button"
                            className="losses-product-row"
                            onClick={() => addPurchaseItem(item)}
                            style={{ display: "flex", gap: 12, alignItems: "center" }}
                          >
                            <div
                              style={{
                                width: 56,
                                height: 56,
                                borderRadius: 12,
                                overflow: "hidden",
                                background: "var(--surface-2)",
                                border: "1px solid var(--line)",
                                flexShrink: 0,
                              }}
                            >
                              {item.image_path ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={item.image_path}
                                  alt={item.name}
                                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                />
                              ) : (
                                <div
                                  style={{
                                    width: "100%",
                                    height: "100%",
                                    display: "grid",
                                    placeItems: "center",
                                    color: "var(--muted)",
                                    fontSize: 11,
                                  }}
                                >
                                  Sem imagem
                                </div>
                              )}
                            </div>

                            <div style={{ display: "grid", gap: 4, textAlign: "left", flex: 1, minWidth: 0 }}>
                              <strong style={{ color: "var(--text)" }}>{item.name}</strong>
                              <div className="muted" style={{ fontSize: 12 }}>
                                {item.brand || "Sem marca"}
                              </div>
                              <div className="muted" style={{ fontSize: 12 }}>
                                {formatCurrency(item.cost_cents)}
                                {item.category_name ? ` · ${item.category_name}` : ""}
                                {item.sourceType === "menu" ? ` · Estoque ${item.quantity}` : ""}
                              </div>
                            </div>

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
                          Lista de compra
                        </h4>
                        <p className="subtitle" style={{ margin: 0 }}>
                          {selectedPurchaseItems.length} item(ns) adicionados.
                        </p>
                      </div>
                      <button className="btn btn-ghost" type="button" onClick={() => setSelectedPurchaseItems([])}>
                        Limpar
                      </button>
                    </div>

                    <label className="grid" style={{ gap: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>Data</span>
                      <input
                        className="input"
                        type="date"
                        value={toDateInputValue(purchaseDate)}
                        onChange={(event) => setPurchaseDate(event.target.value)}
                      />
                    </label>

                    <div className="losses-cart-card">
                      <div className="losses-cart-list">
                        {selectedPurchaseItems.length === 0 ? (
                          <div className="losses-cart-empty">Nenhum item adicionado ainda.</div>
                        ) : (
                          selectedPurchaseItems.map((item) => (
                            <div key={item.key} className="losses-cart-item">
                              <div className="losses-cart-item-copy">
                                <strong>{item.name}</strong>
                              <div className="muted" style={{ fontSize: 12 }}>
                                  {item.brand || "Sem marca"} · {formatCurrency(item.cost_cents)}
                                </div>
                              </div>

                              <div className="public-cart-controls">
                                <button
                                  className="btn btn-ghost"
                                  type="button"
                                  onClick={() => updatePurchaseQuantity(item.key, item.quantity - 1)}
                                >
                                  -
                                </button>
                                <span className="public-cart-qty">{item.quantity}</span>
                                <button
                                  className="btn btn-ghost"
                                  type="button"
                                  onClick={() => updatePurchaseQuantity(item.key, item.quantity + 1)}
                                >
                                  +
                                </button>
                                <button className="btn btn-danger" type="button" onClick={() => removePurchaseItem(item.key)}>
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
                          value={purchaseObservation}
                          onChange={(event) => setPurchaseObservation(event.target.value)}
                          placeholder="Descreva a compra"
                          style={{ minHeight: 126 }}
                        />
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                        <div>
                          <div style={{ fontSize: 12, color: "var(--muted)" }}>Total da compra</div>
                          <strong className="losses-total-value" style={{ fontSize: 18 }}>
                            {formatCurrency(
                              selectedPurchaseItems.reduce((sum, item) => sum + item.cost_cents * item.quantity, 0),
                            )}
                          </strong>
                        </div>

                        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                          <button className="btn btn-ghost" type="button" onClick={resetPurchaseModal}>
                            Cancelar
                          </button>
                          <button className="btn btn-primary" type="submit" style={{ minWidth: 180 }}>
                            Salvar
                          </button>
                        </div>
                      </div>
                    </div>
                  </section>
                </div>

                {message ? <p style={{ margin: 0 }}>{message}</p> : null}
              </form>
            </div>
          </div>
        ) : null}

        {selectedPurchaseGroup ? (
          <div
            role="presentation"
            onClick={() => setSelectedPurchaseGroupKey(null)}
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
                  <h3 style={{ margin: "10px 0 4px" }}>{getDisplayOperatorName(selectedPurchaseGroup.operatorName)}</h3>
                  <p className="subtitle" style={{ margin: 0 }}>
                    {formatDateOnly(selectedPurchaseGroup.purchaseDate)} · {selectedPurchaseGroup.items.length} item(ns)
                  </p>
                </div>
                <button className="btn btn-ghost" type="button" onClick={() => setSelectedPurchaseGroupKey(null)}>
                  Fechar
                </button>
              </div>

              <div className="losses-cart-card">
                <div className="losses-column-header">
                  <div>
                    <h4 className="section-title" style={{ marginBottom: 4, fontSize: 15 }}>
                      Resumo da compra
                    </h4>
                    <p className="subtitle" style={{ margin: 0 }}>
                      Observação: {selectedPurchaseGroup.observation || "Sem observação"}
                    </p>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>Valor total</div>
                    <strong className="losses-total-value" style={{ fontSize: 18 }}>
                      {formatCurrency(selectedPurchaseGroup.totalCents)}
                    </strong>
                  </div>
                </div>

                <div className="losses-cart-list" style={{ maxHeight: 340 }}>
                  {selectedPurchaseGroup.items.map((item) => {
                    const subtotal = item.subtotal_cents;

                    return (
                      <div key={item.id} className="losses-cart-item">
                        <div className="losses-cart-item-copy">
                          <strong>{item.product_name}</strong>
                          <div className="muted" style={{ fontSize: 12 }}>
                            {item.brand || "Sem marca"} · Quantidade: {item.quantity}
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
      </div>
    </AdminLayout>
  );
}
