import Link from "next/link";

type MenuCount = {
  customers?: number;
  items?: number;
  rentals?: number;
  payments?: number;
  inspections?: number;
};

type PanelShellProps = {
  active: "overview" | "customers" | "items";
  counts?: MenuCount;
  children: React.ReactNode;
};

const menuItems = [
  {
    key: "customers",
    title: "Clientes",
    href: "/clientes",
    fallback: "0 registros"
  },
  {
    key: "items",
    title: "Joias",
    href: "/itens",
    fallback: "0 pecas"
  },
  {
    key: "rentals",
    title: "Alugueis",
    href: "#",
    fallback: "0 reservas"
  },
  {
    key: "payments",
    title: "Pagamentos",
    href: "#",
    fallback: "0 lancamentos"
  },
  {
    key: "inspections",
    title: "Vistorias",
    href: "#",
    fallback: "0 vistorias"
  }
] as const;

function formatCount(key: keyof MenuCount, value: number | undefined) {
  if (value === undefined) {
    return menuItems.find((item) => item.key === key)?.fallback ?? "0";
  }

  const labels: Record<keyof MenuCount, [string, string]> = {
    customers: ["registro", "registros"],
    items: ["peca", "pecas"],
    rentals: ["reserva", "reservas"],
    payments: ["lancamento", "lancamentos"],
    inspections: ["vistoria", "vistorias"]
  };
  const [singular, plural] = labels[key];

  return `${value} ${value === 1 ? singular : plural}`;
}

export function PanelShell({ active, counts, children }: PanelShellProps) {
  return (
    <main className="appShell">
      <aside className="sidebar" aria-label="Menu lateral">
        <Link className="brand" href="/" aria-label="Ir para a visao geral">
          <span className="brandMark">AJ</span>
          <div>
            <strong>Aurora Joias</strong>
            <small>Painel interno</small>
          </div>
        </Link>

        <nav className="sideNav">
          {menuItems.map((item) => {
            const isActive =
              (active === "customers" && item.key === "customers") ||
              (active === "items" && item.key === "items");

            return (
              <Link
                aria-current={isActive ? "page" : undefined}
                className={isActive ? "active" : ""}
                href={item.href}
                key={item.key}
              >
                <span>{item.title}</span>
                <small>{formatCount(item.key, counts?.[item.key])}</small>
              </Link>
            );
          })}
        </nav>

        <div className="sidebarFooter">
          <span>Banco local</span>
          <strong>SQLite + Prisma</strong>
        </div>
      </aside>

      <section className="workspace">{children}</section>
    </main>
  );
}
