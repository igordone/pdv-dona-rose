import Link from "next/link";
import { useRouter } from "next/router";
import { signOut } from "next-auth/react";
import type { ReactNode } from "react";

const links = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/cardapio", label: "Cardápio" },
  { href: "/admin/gestao", label: "Gestão" },
  { href: "/admin/vendas", label: "Histórico de vendas" },
  { href: "/admin/perdas", label: "Perdas" },
];

type AdminLayoutProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
};

function getLinkIcon(label: string) {
  if (label === "Dashboard") {
    return "space_dashboard";
  }
  if (label === "Cardápio") {
    return "menu_book";
  }
  if (label === "Gestão") {
    return "tune";
  }
  if (label === "Histórico de vendas") {
    return "history";
  }
  return "inventory_2";
}

export function AdminLayout({ title, subtitle, children }: AdminLayoutProps) {
  const router = useRouter();

  return (
    <div className="page admin-page">
      <div className="container admin-shell">
        <div className="admin-shell-grid">
          <aside className="admin-sidebar">
            <div className="admin-sidebar-brand">
              <div className="admin-brand-mark" aria-hidden="true">
                <span className="admin-brand-mark-hole" />
              </div>
              <div className="admin-brand-wordmark">
                <span className="admin-brand-wordmark-main">
                  D<span className="admin-brand-dot">.</span>CC
                </span>
              </div>
            </div>

            <nav className="admin-nav">
              <div className="admin-nav-label">Menu</div>
              {links.map((link) => {
                const active =
                  link.href === "/admin"
                    ? router.pathname === "/admin"
                    : router.pathname.startsWith(link.href);

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`admin-nav-item${active ? " is-active" : ""}`}
                  >
                    <span className="admin-nav-icon" aria-hidden="true">
                      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                        {getLinkIcon(link.label)}
                      </span>
                    </span>
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="admin-sidebar-footer">
              <div className="admin-user-card">
                <div className="admin-user-avatar">JS</div>
                <div className="admin-user-copy">
                  <div className="admin-user-name">João Silva</div>
                  <div className="admin-user-role">Admin</div>
                </div>
                <button
                  className="admin-user-more"
                  type="button"
                  aria-label="Abrir opções do usuário"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                    more_vert
                  </span>
                </button>
              </div>
              <button className="btn btn-ghost admin-signout" type="button" onClick={() => signOut({ callbackUrl: "/" })}>
                Sair
              </button>
            </div>
          </aside>

          <main className="admin-main">
            <header className="admin-header">
              <div>
                <h1 className="admin-title">{title}</h1>
                {subtitle ? <p className="admin-subtitle">{subtitle}</p> : null}
              </div>

            </header>

            <div className="admin-content">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
