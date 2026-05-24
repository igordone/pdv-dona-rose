import type { GetServerSideProps } from "next";
import { getServerSession } from "next-auth/next";
import { FormEvent, useEffect, useState } from "react";
import { authOptions } from "../api/auth/[...nextauth]";
import { AdminLayout } from "../../components/AdminLayout";

type ProductItem = {
  id: number;
  name: string;
};

type LossItem = {
  id: number;
  product_id: number | null;
  product_name: string;
  quantity: number;
  observation: string;
  created_at: string;
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

export default function PerdasPage() {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [losses, setLosses] = useState<LossItem[]>([]);
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [observation, setObservation] = useState("");
  const [message, setMessage] = useState("");

  async function loadData() {
    const [productsResponse, lossesResponse] = await Promise.all([
      fetch("/api/admin/products"),
      fetch("/api/admin/losses"),
    ]);

    const productsData = (await productsResponse.json()) as { items: Array<{ id: number; name: string }> };
    const lossesData = (await lossesResponse.json()) as { items: LossItem[] };

    setProducts(productsData.items ?? []);
    setLosses(lossesData.items ?? []);
  }

  useEffect(() => {
    void loadData().catch(() => {
      setProducts([]);
      setLosses([]);
    });
  }, []);

  const summary = {
    totalRecords: losses.length,
    totalQuantity: losses.reduce((sum, loss) => sum + loss.quantity, 0),
    distinctProducts: new Set(losses.map((loss) => loss.product_id ?? loss.product_name)).size,
    latest: losses[0] ? new Date(losses[0].created_at).toLocaleDateString("pt-BR") : "Sem registros",
  };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    const response = await fetch("/api/admin/losses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        productId: Number(productId),
        quantity: Number(quantity),
        observation,
      }),
    });

    const data = (await response.json()) as { error?: string };

    if (!response.ok) {
      setMessage(data.error ?? "Falha ao registrar perda.");
      return;
    }

    setMessage("Perda registrada com sucesso.");
    setProductId("");
    setQuantity("");
    setObservation("");
    await loadData();
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
            { label: "Produtos distintos", value: String(summary.distinctProducts), sub: "itens diferentes" },
            { label: "Último registro", value: summary.latest, sub: "data mais recente" },
          ].map((stat) => (
            <article key={stat.label} className="card" style={{ padding: "12px 14px", display: "grid", gap: 4 }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1 }}>
                {stat.label}
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text)", letterSpacing: -0.3 }}>{stat.value}</div>
              <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{stat.sub}</div>
            </article>
          ))}
        </div>

        <section
          className="card"
          style={{
            overflow: "hidden",
            borderTop: "6px solid var(--brand)",
            padding: 20,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
            <div>
              <h2 className="section-title" style={{ marginBottom: 4, fontSize: 15 }}>
                Registrar Nova Perda
              </h2>
              <div className="subtitle" style={{ margin: 0 }}>
                Os dados são adicionados ao histórico abaixo
              </div>
            </div>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                background: "var(--brand-tint)",
                color: "var(--brand-2)",
                padding: "4px 10px",
                borderRadius: 999,
                fontSize: 11.5,
                fontWeight: 600,
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--brand)" }} />
              Operador: João Silva
            </div>
          </div>

          <form onSubmit={handleSubmit} className="grid" style={{ gap: 16 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 2fr",
                gap: 16,
                alignItems: "start",
              }}
            >
              <div className="grid" style={{ gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>Produto</label>
                <select
                  className="input"
                  value={productId}
                  onChange={(event) => setProductId(event.target.value)}
                >
                  <option value="">Selecione o produto</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid" style={{ gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>Quantidade</label>
                <input
                  className="input"
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                  placeholder="Insira a quantidade (ex: 2)"
                />
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
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button className="btn btn-primary" type="submit" style={{ minWidth: 180 }}>
                Registrar Perda
              </button>
            </div>

            {message ? <p style={{ margin: 0 }}>{message}</p> : null}
          </form>
        </section>

        <section className="grid" style={{ gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <h2 className="section-title" style={{ marginBottom: 4 }}>
                Histórico de Perdas
              </h2>
              <p className="subtitle" style={{ margin: 0 }}>
                {losses.length} registros · últimos 7 dias
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  background: "#fff",
                  border: "1px solid var(--line)",
                  borderRadius: 8,
                  padding: "7px 12px",
                  minWidth: 200,
                  color: "var(--muted)",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 15 }}>
                  search
                </span>
                <input
                  readOnly
                  placeholder="Pesquisar..."
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
              <button className="btn btn-ghost" type="button">
                <span className="material-symbols-outlined" style={{ fontSize: 13 }}>
                  filter_alt
                </span>
                Filtros
              </button>
            </div>
          </div>

          <div className="card" style={{ overflow: "hidden" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1.2fr 0.7fr 1.6fr 0.8fr",
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
              <div>Produto</div>
              <div>Quantidade</div>
              <div>Observação</div>
              <div>Data</div>
            </div>

            <div className="grid" style={{ gap: 0 }}>
              {losses.map((loss, index) => (
                <div
                  key={loss.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1.2fr 0.7fr 1.6fr 0.8fr",
                    gap: 12,
                    padding: "16px 18px",
                    borderBottom: index === losses.length - 1 ? 0 : "1px solid var(--line)",
                    alignItems: "center",
                    background: index % 2 === 0 ? "white" : "rgba(255, 251, 244, 0.72)",
                  }}
                >
                  <div style={{ fontWeight: 700 }}>{loss.product_name}</div>
                  <div>{loss.quantity}</div>
                  <div className="muted" style={{ lineHeight: 1.4 }}>
                    {loss.observation}
                  </div>
                  <div>{new Date(loss.created_at).toLocaleString("pt-BR")}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </AdminLayout>
  );
}
