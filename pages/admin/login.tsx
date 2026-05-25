import { type FormEvent, useState } from "react";
import { signIn } from "next-auth/react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const result = await signIn("credentials", {
      redirect: false,
      email,
      password,
      callbackUrl: "/admin",
    });

    setLoading(false);

    if (result?.error) {
      setError("Credenciais inválidas.");
      return;
    }

    window.location.assign(result?.url ?? "/admin");
  }

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 520 }}>
        <section className="card card-pad" style={{ display: "grid", gap: 18 }}>
          <span className="pill">Acesso interno</span>
          <h1 className="title" style={{ fontSize: "2rem" }}>
            Entrar no painel
          </h1>
          <p className="subtitle">Use as credenciais do funcionário para acessar o sistema.</p>

          <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Email"
            />
            <input
              className="input"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Senha"
            />
            {error ? <p style={{ color: "var(--danger)", margin: 0 }}>{error}</p> : null}
            <button className="btn btn-primary" type="submit" disabled={loading}>
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
