import { useEffect, useMemo, useState } from "react";
import { CldImage } from "next-cloudinary";
import type { Product } from "../types/domain";
import { useFeedback } from "../components/Feedback";

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

  useEffect(() => {
    void fetch("/api/menu")
      .then((response) => response.json() as Promise<MenuResponse>)
      .then((data) => setItems(data.items ?? []))
      .catch(() => setItems([]));
  }, []);

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
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          clientName,
          clientPhone,
          notes,
          items: cart.map((item) => ({
            productId: item.id,
            quantity: item.quantity,
          })),
        }),
      });

      const data = (await readJsonResponse<{ error?: string; message?: string; orderId?: number }>(
        response,
      )) as {
        error?: string;
        message?: string;
        orderId?: number;
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

      setMessage(`${data.message ?? "Pedido enviado."} Número: ${data.orderId ?? "-"}`);
      toast({
        title: "Pedido criado com sucesso",
        description: `Número ${data.orderId ?? "-"}`,
        variant: "success",
        durationMs: 3600,
      });
      setCart([]);
      setClientName("");
      setClientPhone("");
      setNotes("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page public-page">
      <div className="container public-shell public-page-grid">
        <div className="public-main-column">
        <section className="card card-pad public-hero">
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
              Adicione os itens ao pedido e envie direto para nós.
            </p>
          </div>

          {message ? (
            <div className="pill public-message-pill" style={{ width: "fit-content" }}>
              {message}
            </div>
          ) : null}
        </section>

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
    </div>
  );
}
