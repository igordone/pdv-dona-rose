import type { GetServerSideProps } from "next";
import { getServerSession } from "next-auth/next";
import { useEffect, useMemo, useState } from "react";
import { CldImage } from "next-cloudinary";
import { authOptions } from "../api/auth/[...nextauth]";
import { AdminLayout } from "../../components/AdminLayout";

type ProductItem = {
  id: number;
  name: string;
  price_cents: number;
  quantity: number;
  active: boolean;
  image_path: string | null;
  category_id: number | null;
  category_name: string | null;
};

function formatPriceParts(cents: number) {
  const value = (cents / 100).toFixed(2);
  const [whole, decimal] = value.split(".");

  return { whole, decimal };
}

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

export default function CardapioPage() {
  const [items, setItems] = useState<ProductItem[]>([]);
  const [activeCategory, setActiveCategory] = useState("Todas");

  useEffect(() => {
    void fetch("/api/admin/products")
      .then(async (response) => {
        const contentType = response.headers.get("content-type") ?? "";
        if (!contentType.includes("application/json")) {
          return { items: [] as ProductItem[] };
        }

        const data = (await response.json()) as { items?: ProductItem[]; error?: string };

        if (!response.ok) {
          return { items: [] as ProductItem[] };
        }

        return data;
      })
      .then((data) => setItems(data.items ?? []))
      .catch((error) => {
        console.error("admin_products_load_error", error);
        setItems([]);
      });
  }, []);

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

  return (
    <AdminLayout title="Cardápio de itens do Restaurante" subtitle="Visualização dos itens cadastrados no cardápio.">
      <section style={{ display: "grid", gap: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "nowrap", alignItems: "center" }}>
          <div
            style={{
              display: "inline-flex",
              gap: 4,
              padding: 3,
              border: "1px solid var(--line)",
              borderRadius: 10,
              background: "var(--surface)",
              flexWrap: "nowrap",
              overflowX: "auto",
              maxWidth: "100%",
            }}
          >
            {categories.map((category) => {
              const active = activeCategory === category;
                return (
                  <button
                    key={category}
                    type="button"
                    className="btn btn-ghost admin-category-chip"
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
                      <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: 16 }}>
                        {getCategoryIcon(category)}
                      </span>
                    ) : null}
                    {category}
                  </button>
                );
              })}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "nowrap" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "#fff",
                border: "1px solid var(--line)",
                borderRadius: 8,
                padding: "7px 12px",
                minWidth: 220,
                color: "var(--muted)",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                search
              </span>
              <input
                readOnly
                placeholder="Buscar produto..."
                aria-label="Buscar produto"
                style={{
                  border: "none",
                  outline: "none",
                  background: "transparent",
                  fontFamily: "inherit",
                  fontSize: 13,
                  color: "var(--text)",
                  flex: 1,
                }}
              />
            </div>

            <div
              style={{
                display: "flex",
                background: "#F5F5F4",
                borderRadius: 8,
                padding: 3,
                border: "1px solid var(--line)",
              }}
            >
              <button
                type="button"
                style={{
                  background: "#fff",
                  color: "var(--text)",
                  border: "none",
                  padding: "4px 8px",
                  borderRadius: 6,
                  cursor: "pointer",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                  grid_view
                </span>
              </button>
              <button
                type="button"
                style={{
                  background: "transparent",
                  color: "var(--muted)",
                  border: "none",
                  padding: "4px 8px",
                  borderRadius: 6,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                  view_list
                </span>
              </button>
            </div>

            <div className="muted" style={{ fontWeight: 700, whiteSpace: "nowrap" }}>
              {visibleItems.length} itens
            </div>
          </div>
        </div>

        <div className="cardapio-grid">
          {visibleItems.map((item) => (
            <article
              key={item.id}
              style={{
                background: "#fff",
                border: "1px solid var(--line)",
                borderRadius: 12,
                overflow: "hidden",
                display: "grid",
                gap: 0,
              }}
            >
              <div style={{ padding: 6, paddingBottom: 0 }}>
                <div
                  style={{
                    position: "relative",
                    aspectRatio: "1.18 / 1",
                    borderRadius: 8,
                    overflow: "hidden",
                    background: "var(--surface-2)",
                    border: "1px solid var(--line)",
                  }}
                >
                  {item.image_path ? (
                    <CldImage
                      src={item.image_path}
                      alt={item.name}
                      fill
                      crop="fill"
                      gravity="auto"
                      style={{ objectFit: "cover" }}
                    />
                  ) : (
                    <div
                      style={{
                        width: "100%",
                        height: "100%",
                        display: "grid",
                        placeItems: "center",
                        color: "var(--muted)",
                        fontWeight: 700,
                        background:
                          "repeating-linear-gradient(135deg, rgba(249,115,22,0.1) 0 10px, rgba(231,229,228,0.75) 10px 20px)",
                      }}
                    >
                      Sem imagem
                    </div>
                  )}
                </div>
              </div>

              <div style={{ padding: "10px 12px 12px", display: "grid", gap: 4 }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.6 }}>
                  {item.category_name ?? "Sem categoria"}
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", letterSpacing: -0.1 }}>
                  {item.name}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--muted)",
                    lineHeight: 1.4,
                    display: "-webkit-box",
                    WebkitBoxOrient: "vertical",
                    WebkitLineClamp: 2,
                    overflow: "hidden",
                    minHeight: 33,
                  }}
                >
                  {item.active ? "Item disponível para venda." : "Item indisponível no cardápio."}
                </div>
                <div
                  style={{
                    marginTop: 8,
                    paddingTop: 10,
                    borderTop: "1px solid var(--line)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <div className="admin-price">
                    <span className="admin-price-currency">R$</span>
                    <span className="admin-price-value">{formatPriceParts(item.price_cents).whole}</span>
                    <span className="admin-price-decimal">.{formatPriceParts(item.price_cents).decimal}</span>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </AdminLayout>
  );
}
