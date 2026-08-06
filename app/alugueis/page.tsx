import {
  RentalChargeMethod,
  RentalChargeStatus,
  RentalFinancialLineStatus,
  RentalFinancialLineType,
  RentalStatus
} from "@prisma/client";
import { PanelShell } from "../../components/panel-shell";
import { prisma } from "../../lib/prisma";
import { createRental, deleteRental, updateRentalStatus } from "./actions";

type RentalsPageProps = {
  searchParams: Promise<{
    message?: string;
  }>;
};

const statusLabels: Record<RentalStatus, string> = {
  pending_payment: "Aguardando pagamento",
  expired: "Expirado",
  confirmed: "Confirmado",
  in_completion: "Em finalizacao",
  closed: "Encerrado",
  cancelled: "Cancelado"
};

const chargeMethodLabels: Record<RentalChargeMethod, string> = {
  pix: "Pix",
  debit_card: "Cartao de debito",
  credit_card: "Cartao de credito"
};

const chargeStatusLabels: Record<RentalChargeStatus, string> = {
  pending: "Pendente",
  paid: "Pago",
  expired: "Expirado",
  cancelled: "Cancelado",
  failed: "Falhou"
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

const financialLineLifecycleLabels: Record<RentalFinancialLineStatus, string> = {
  active: "Ativo",
  cancelled: "Cancelado"
};

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

function sumRentalItems(
  items: {
    rentalPriceCents: number;
    depositAmountCents: number;
    discountCents: number;
  }[]
) {
  const subtotalCents = items.reduce(
    (total, item) => total + item.rentalPriceCents,
    0
  );
  const depositAmountCents = items.reduce(
    (total, item) => total + item.depositAmountCents,
    0
  );
  const itemDiscountCents = items.reduce(
    (total, item) => total + item.discountCents,
    0
  );

  return { subtotalCents, depositAmountCents, itemDiscountCents };
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

function sumActiveFinancialLinesByType(
  lines: {
    type: RentalFinancialLineType;
    amountCents: number;
    lifecycleStatus: RentalFinancialLineStatus;
  }[],
  types: RentalFinancialLineType[]
) {
  const selectedTypes = new Set(types);

  return lines.reduce(
    (total, line) =>
      line.lifecycleStatus === RentalFinancialLineStatus.active &&
      selectedTypes.has(line.type)
        ? total + line.amountCents
        : total,
    0
  );
}

export default async function RentalsPage({ searchParams }: RentalsPageProps) {
  const params = await searchParams;

  const [customers, items, rentals, counts] = await Promise.all([
    prisma.customer.findMany({
      orderBy: { name: "asc" }
    }),
    prisma.item.findMany({
      orderBy: { name: "asc" },
      include: {
        photos: {
          orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
          take: 1
        },
        prices: {
          orderBy: { createdAt: "desc" },
          take: 1
        }
      }
    }),
    prisma.rental.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        customer: true,
        rentalItems: {
          include: {
            item: {
              include: {
                photos: {
                  orderBy: [
                    { isPrimary: "desc" },
                    { sortOrder: "asc" },
                    { createdAt: "asc" }
                  ],
                  take: 1
                }
              }
            }
          }
        },
        financialLines: {
          orderBy: { createdAt: "asc" }
        },
        charges: {
          orderBy: { createdAt: "asc" }
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
  const rentableItems = items.filter((item) => item.prices.length > 0);

  return (
    <PanelShell
      active="rentals"
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
          <p className="eyebrow">Ordens</p>
          <h1>Alugueis</h1>
        </div>
      </header>

      {params.message ? <div className="notice">{params.message}</div> : null}

      <section className="rentalLayout">
        <form action={createRental} className="formPanel">
          <div>
            <p className="eyebrow">Novo aluguel</p>
            <h2>Ordem de aluguel</h2>
          </div>

          <label>
            Cliente
            <select name="customerId" required defaultValue="">
              <option value="" disabled>
                Selecione
              </option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Data inicial
            <input name="startDate" required type="date" />
          </label>

          <label>
            Data prevista de termino
            <input name="expectedEndDate" required type="date" />
          </label>

          <label>
            Desconto geral
            <input name="generalDiscount" placeholder="Ex: 50,00" />
          </label>

          <label>
            Metodo de pagamento
            <select name="chargeMethod" required defaultValue={RentalChargeMethod.pix}>
              {Object.values(RentalChargeMethod).map((method) => (
                <option key={method} value={method}>
                  {chargeMethodLabels[method]}
                </option>
              ))}
            </select>
          </label>

          <label>
            Parcelas
            <select name="installments" defaultValue="1">
              {Array.from({ length: 12 }, (_, index) => index + 1).map(
                (installment) => (
                  <option key={installment} value={installment}>
                    {installment}x
                  </option>
                )
              )}
            </select>
          </label>

          <fieldset>
            <legend>Joias</legend>
            {rentableItems.length === 0 ? (
              <p>Nenhuma joia com preco cadastrada.</p>
            ) : (
              <div className="checkboxList">
                {rentableItems.map((item) => {
                  const price = item.prices[0];
                  const photo = item.photos[0];

                  return (
                    <label className="checkboxCard" key={item.id}>
                      <input name="itemIds" type="checkbox" value={item.id} />
                      <span className="miniThumb">
                        {photo ? (
                          <img alt={item.name} src={photo.photoUrl} />
                        ) : (
                          <span>Sem foto</span>
                        )}
                      </span>
                      <span>
                        <strong>{item.name}</strong>
                        <small>
                          {item.type} - {formatMoney(price.rentalPriceCents)}
                          {price.discountCents > 0
                            ? ` com desconto de ${formatMoney(price.discountCents)}`
                            : ""}
                        </small>
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </fieldset>

          <button type="submit">Criar aluguel</button>
        </form>

        <section className="listPanel" aria-label="Lista de alugueis">
          <div className="listHeader">
            <div>
              <h2>Alugueis cadastrados</h2>
              <span>{rentals.length} na lista atual</span>
            </div>
          </div>

          {rentals.length === 0 ? (
            <div className="emptyState">
              Nenhum aluguel cadastrado. Crie a primeira ordem para testar
              cliente, datas e joias.
            </div>
          ) : (
            <div className="rentalRows">
              {rentals.map((rental) => {
                const { subtotalCents } = sumRentalItems(rental.rentalItems);
                const totalCents = sumActiveFinancialLines(
                  rental.financialLines
                );
                const financialDiscountCents = Math.abs(
                  sumActiveFinancialLinesByType(rental.financialLines, [
                    RentalFinancialLineType.item_discount,
                    RentalFinancialLineType.general_discount
                  ])
                );
                const financialDepositCents = sumActiveFinancialLinesByType(
                  rental.financialLines,
                  [RentalFinancialLineType.deposit]
                );

                return (
                  <details className="rentalRow" key={rental.id}>
                    <summary>
                      <span>
                        <strong>{rental.customer.name}</strong>
                        <small>
                          {formatDate(rental.startDate)} ate{" "}
                          {formatDate(rental.expectedEndDate)}
                        </small>
                      </span>
                      <span>{statusLabels[rental.status]}</span>
                      <span>{formatMoney(totalCents)}</span>
                    </summary>

                    <div className="rentalDetails">
                      <dl>
                        <div>
                          <dt>Subtotal</dt>
                          <dd>{formatMoney(subtotalCents)}</dd>
                        </div>
                        <div>
                          <dt>Desconto</dt>
                          <dd>{formatMoney(financialDiscountCents)}</dd>
                        </div>
                        <div>
                          <dt>Total</dt>
                          <dd>{formatMoney(totalCents)}</dd>
                        </div>
                        <div>
                          <dt>Caucao</dt>
                          <dd>{formatMoney(financialDepositCents)}</dd>
                        </div>
                      </dl>

                      <div className="rentalItemList">
                        {rental.rentalItems.map((rentalItem) => {
                          const photo = rentalItem.item.photos[0];

                          return (
                            <article className="rentalItemCard" key={rentalItem.id}>
                              <span className="miniThumb">
                                {photo ? (
                                  <img alt={rentalItem.item.name} src={photo.photoUrl} />
                                ) : (
                                  <span>Sem foto</span>
                                )}
                              </span>
                              <div>
                                <strong>{rentalItem.item.name}</strong>
                                <small>
                                  Aluguel:{" "}
                                  {formatMoney(rentalItem.rentalPriceCents)} -
                                  Desconto:{" "}
                                  {formatMoney(rentalItem.discountCents)} -
                                  Caucao:{" "}
                                  {formatMoney(rentalItem.depositAmountCents)}
                                </small>
                              </div>
                            </article>
                          );
                        })}
                      </div>

                      <section className="receivablePanel">
                        <div className="sectionTitle compactTitle">
                          <div>
                            <h2>Financeiro do aluguel</h2>
                            <span>{rental.financialLines.length} linhas</span>
                          </div>
                        </div>

                        <div className="receivableList">
                          {rental.financialLines.map((line) => (
                            <article className="receivableCard" key={line.id}>
                              <div>
                                <strong>{financialLineTypeLabels[line.type]}</strong>
                                <small>
                                  Vence em {formatDateTime(line.dueAt)}
                                </small>
                              </div>
                              <div>
                                <strong>{formatMoney(line.amountCents)}</strong>
                                <small>
                                  {
                                    financialLineLifecycleLabels[
                                      line.lifecycleStatus
                                    ]
                                  }
                                </small>
                              </div>
                            </article>
                          ))}
                        </div>
                      </section>

                      <section className="receivablePanel">
                        <div className="sectionTitle compactTitle">
                          <div>
                            <h2>Cobrancas</h2>
                            <span>{rental.charges.length} geradas</span>
                          </div>
                        </div>

                        {rental.charges.length === 0 ? (
                          <div className="emptyState compactEmpty">
                            Nenhuma cobranca registrada para este aluguel.
                          </div>
                        ) : (
                          <div className="receivableList">
                            {rental.charges.map((charge) => (
                              <article className="receivableCard" key={charge.id}>
                                <div>
                                  <strong>
                                    {chargeMethodLabels[charge.method]} -{" "}
                                    {charge.installments}x
                                  </strong>
                                  <small>
                                    Expira em {formatDateTime(charge.expiresAt)}
                                  </small>
                                </div>
                                <div>
                                  <strong>{formatMoney(charge.amountCents)}</strong>
                                  <small>{chargeStatusLabels[charge.status]}</small>
                                </div>
                              </article>
                            ))}
                          </div>
                        )}
                      </section>

                      <form action={updateRentalStatus} className="statusForm">
                        <input name="id" type="hidden" value={rental.id} />
                        <label>
                          Status administrativo
                          <select name="status" defaultValue={rental.status}>
                            {Object.values(RentalStatus).map((status) => (
                              <option key={status} value={status}>
                                {statusLabels[status]}
                              </option>
                            ))}
                          </select>
                        </label>
                        <div className="rowActions">
                          <button type="submit">Atualizar status</button>
                        </div>
                      </form>

                      <form action={deleteRental} className="deleteForm">
                        <input name="id" type="hidden" value={rental.id} />
                        <button type="submit">Remover aluguel</button>
                      </form>
                    </div>
                  </details>
                );
              })}
            </div>
          )}
        </section>
      </section>
    </PanelShell>
  );
}
