import {
  RentalChargeStatus,
  RentalFinancialLineStatus,
  RentalFinancialLineType,
  RentalStatus
} from "@prisma/client";
import { PanelShell } from "../../components/panel-shell";
import { prisma } from "../../lib/prisma";

type ChargesPageProps = {
  searchParams: Promise<{
    status?: string;
  }>;
};

const chargeStatusLabels: Record<RentalChargeStatus, string> = {
  pending: "Pendente",
  paid: "Pago",
  expired: "Expirado",
  cancelled: "Cancelado",
  failed: "Falhou"
};

const rentalStatusLabels: Record<RentalStatus, string> = {
  pending_payment: "Aguardando pagamento",
  expired: "Expirado",
  confirmed: "Confirmado",
  in_completion: "Em finalizacao",
  closed: "Encerrado",
  cancelled: "Cancelado"
};

const financialLineTypeLabels: Record<RentalFinancialLineType, string> = {
  rental_fee: "Aluguel",
  item_discount: "Desconto das pecas",
  deposit: "Caucao",
  general_discount: "Desconto geral",
  late_fee: "Atraso",
  damage_fee: "Dano",
  cleaning_fee: "Limpeza",
  maintenance_fee: "Manutencao"
};

const chargeStatuses = new Set(Object.values(RentalChargeStatus));

function formatMoney(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function formatDate(date: Date) {
  return date.toLocaleDateString("pt-BR");
}

function formatDateTime(date: Date) {
  return date.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  });
}

function parseStatus(value: string | undefined) {
  return value && chargeStatuses.has(value as RentalChargeStatus)
    ? (value as RentalChargeStatus)
    : undefined;
}

function sumActiveFinancialLines(
  lines: { amountCents: number; lifecycleStatus: RentalFinancialLineStatus }[]
) {
  return lines.reduce(
    (total, line) =>
      line.lifecycleStatus === RentalFinancialLineStatus.active
        ? total + line.amountCents
        : total,
    0
  );
}

export default async function ChargesPage({ searchParams }: ChargesPageProps) {
  const params = await searchParams;
  const statusFilter = parseStatus(params.status);

  const [charges, counts] = await Promise.all([
    prisma.rentalCharge.findMany({
      where: statusFilter ? { status: statusFilter } : undefined,
      orderBy: { createdAt: "desc" },
      include: {
        rental: {
          include: {
            customer: true,
            financialLines: {
              orderBy: { createdAt: "asc" }
            }
          }
        }
      }
    }),
    Promise.all([
      prisma.customer.count(),
      prisma.item.count(),
      prisma.rental.count(),
      prisma.rentalCharge.count(),
      prisma.inspection.count()
    ])
  ]);

  const [customerCount, itemCount, rentalCount, chargeCount, inspectionCount] =
    counts;

  return (
    <PanelShell
      active="charges"
      counts={{
        customers: customerCount,
        items: itemCount,
        rentals: rentalCount,
        charges: chargeCount,
        inspections: inspectionCount
      }}
    >
      <header className="topHeader">
        <div>
          <p className="eyebrow">Financeiro</p>
          <h1>Cobrancas</h1>
        </div>
      </header>

      <section className="listPanel standalonePanel" aria-label="Lista de cobrancas">
        <div className="listHeader">
          <div>
            <h2>Cobrancas geradas</h2>
            <span>{charges.length} na lista atual</span>
          </div>

          <form className="searchForm">
            <select
              aria-label="Filtrar por status"
              defaultValue={statusFilter ?? ""}
              name="status"
            >
              <option value="">Todos os status</option>
              {Object.values(RentalChargeStatus).map((status) => (
                <option key={status} value={status}>
                  {chargeStatusLabels[status]}
                </option>
              ))}
            </select>
            <button type="submit">Filtrar</button>
          </form>
        </div>

        {charges.length === 0 ? (
          <div className="emptyState">
            Nenhuma cobranca encontrada para o filtro selecionado.
          </div>
        ) : (
          <div className="rentalRows">
            {charges.map((charge) => {
              const totalFinancialCents = sumActiveFinancialLines(
                charge.rental.financialLines
              );

              return (
                <details className="rentalRow" key={charge.id}>
                  <summary>
                    <span>
                      <strong>{charge.rental.customer.name}</strong>
                      <small>
                        {formatDate(charge.rental.startDate)} ate{" "}
                        {formatDate(charge.rental.expectedEndDate)}
                      </small>
                    </span>
                    <span>{chargeStatusLabels[charge.status]}</span>
                    <span>{formatMoney(charge.amountCents)}</span>
                  </summary>

                  <div className="rentalDetails">
                    <dl>
                      <div>
                        <dt>Expira em</dt>
                        <dd>{formatDateTime(charge.expiresAt)}</dd>
                      </div>
                      <div>
                        <dt>Status do aluguel</dt>
                        <dd>{rentalStatusLabels[charge.rental.status]}</dd>
                      </div>
                      <div>
                        <dt>Total financeiro</dt>
                        <dd>{formatMoney(totalFinancialCents)}</dd>
                      </div>
                      <div>
                        <dt>Valor cobrado</dt>
                        <dd>{formatMoney(charge.amountCents)}</dd>
                      </div>
                    </dl>

                    <section className="receivablePanel">
                      <div className="sectionTitle compactTitle">
                        <div>
                          <h2>Linhas financeiras</h2>
                          <span>{charge.rental.financialLines.length} linhas</span>
                        </div>
                      </div>

                      <div className="receivableList">
                        {charge.rental.financialLines.map((line) => (
                          <article className="receivableCard" key={line.id}>
                            <div>
                              <strong>{financialLineTypeLabels[line.type]}</strong>
                              <small>Vence em {formatDateTime(line.dueAt)}</small>
                            </div>
                            <div>
                              <strong>{formatMoney(line.amountCents)}</strong>
                              <small>
                                {line.lifecycleStatus ===
                                RentalFinancialLineStatus.active
                                  ? "Ativo"
                                  : "Cancelado"}
                              </small>
                            </div>
                          </article>
                        ))}
                      </div>
                    </section>
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </section>
    </PanelShell>
  );
}
