import { PanelShell } from "../components/panel-shell";
import { prisma } from "../lib/prisma";

const modules = [
  {
    title: "Clientes",
    description: "Cadastro simples com CPF, contato e historico.",
    count: "Abrir modulo"
  },
  {
    title: "Joias",
    description: "Pecas fisicas com status, fotos, tipo e preco.",
    count: "0 pecas"
  },
  {
    title: "Alugueis",
    description: "Reservas com datas, valores, retirada e devolucao.",
    count: "0 reservas"
  },
  {
    title: "Pagamentos",
    description: "Aluguel, caucao, reembolso, multas e taxas.",
    count: "0 lancamentos"
  },
  {
    title: "Vistorias",
    description: "Retirada e devolucao com fotos e observacoes.",
    count: "0 vistorias"
  }
];

const tables = [
  "customers",
  "items",
  "item_photos",
  "item_prices",
  "rentals",
  "rental_items",
  "payments",
  "inspections"
];

export default async function Home() {
  const [customers, items, rentals, payments, inspections] = await Promise.all([
    prisma.customer.count(),
    prisma.item.count(),
    prisma.rental.count(),
    prisma.payment.count(),
    prisma.inspection.count()
  ]);

  return (
    <PanelShell
      active="overview"
      counts={{ customers, items, rentals, payments, inspections }}
    >
        <header className="topHeader">
          <div>
            <p className="eyebrow">POC operacional</p>
            <h1>Painel interno minimo para aluguel de joias</h1>
          </div>
          <button type="button">Nova reserva</button>
        </header>

        <section className="summary" aria-label="Resumo do painel">
          <div>
            <span>Reservas hoje</span>
            <strong>0</strong>
          </div>
          <div>
            <span>Pecas disponiveis</span>
            <strong>0</strong>
          </div>
          <div>
            <span>Devolucoes pendentes</span>
            <strong>0</strong>
          </div>
        </section>

        <section className="contentSplit">
          <div className="mainPanel">
            <div className="sectionTitle">
              <h2>Modulo selecionado</h2>
              <span>Clientes</span>
            </div>

            <div className="moduleRows">
              {modules.map((item) => (
                <div className="moduleRow" key={item.title}>
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.description}</p>
                  </div>
                  <span>{item.count}</span>
                </div>
              ))}
            </div>
          </div>

          <aside className="dataPanel" aria-label="Modelo inicial">
            <p className="eyebrow">Modelo inicial</p>
            <h2>Tabelas</h2>
            <div className="tableList">
              {tables.map((table) => (
                <span key={table}>{table}</span>
              ))}
            </div>
          </aside>
        </section>
    </PanelShell>
  );
}
