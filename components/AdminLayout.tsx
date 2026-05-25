import Link from "next/link";
import { useRouter } from "next/router";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useState, type ReactNode } from "react";

const links = [
  { href: "/admin", label: "Dashboard" },
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

  if (label === "Gestão") {
    return "tune";
  }

  if (label === "Histórico de vendas") {
    return "history";
  }

  return "inventory_2";
}

function getInitials(name?: string | null) {
  if (!name) {
    return "A";
  }

  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const first = parts[0]?.[0] ?? "A";
  const second = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";

  return `${first}${second}`.toUpperCase();
}

function getRoleLabel(role?: string | null) {
  if (role === "admin") {
    return "Admin";
  }

  if (role === "employee") {
    return "Colaborador";
  }

  return role ?? "Admin";
}

async function loadUnreadOrdersCount() {
  const response = await fetch("/api/admin/orders?summary=1");
  const data = (await response.json().catch(() => null)) as { unread_count?: number } | null;

  if (!response.ok || !data) {
    return 0;
  }

  return data.unread_count ?? 0;
}

export function AdminLayout({ title, subtitle, children }: AdminLayoutProps) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [unreadOrdersCount, setUnreadOrdersCount] = useState(0);

  useEffect(() => {
    let mounted = true;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    async function refreshUnreadOrdersCount() {
      try {
        const count = await loadUnreadOrdersCount();
        if (mounted) {
          setUnreadOrdersCount(count);
        }
      } catch {
        if (mounted) {
          setUnreadOrdersCount(0);
        }
      }
    }

    void refreshUnreadOrdersCount();
    intervalId = setInterval(() => {
      void refreshUnreadOrdersCount();
    }, 15000);

    const handleOrdersUpdated = () => {
      void refreshUnreadOrdersCount();
    };

    window.addEventListener("admin-orders-updated", handleOrdersUpdated);

    return () => {
      mounted = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
      window.removeEventListener("admin-orders-updated", handleOrdersUpdated);
    };
  }, []);

  const userName = session?.user?.name?.trim() || "Usuário";
  const userRole = getRoleLabel((session?.user as { role?: string } | undefined)?.role);
  const userInitials = getInitials(session?.user?.name);

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
                const active = link.href === "/admin" ? router.pathname === "/admin" : router.pathname.startsWith(link.href);
                const showBadge = link.href === "/admin" && unreadOrdersCount > 0;

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
                    <span className="admin-nav-label-text">{link.label}</span>
                    {showBadge ? <span className="admin-nav-badge">{unreadOrdersCount}</span> : null}
                  </Link>
                );
              })}
            </nav>

            <div className="admin-sidebar-footer">
              <div className="admin-user-card">
                <div className="admin-user-avatar" aria-hidden="true">
                  {status === "loading" ? "..." : userInitials}
                </div>
                <div className="admin-user-copy">
                  <div className="admin-user-name">{userName}</div>
                  <div className="admin-user-role">{userRole}</div>
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
