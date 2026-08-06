import {
  ReceivableLifecycleStatus,
  ReceivableType,
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
  open: "Aberto",
  closed: "Encerrado",
  cancelled: "Cancelado"
};

const receivableTypeLabels: Record<ReceivableType, string> = {
  rental_fee: "Aluguel",
  deposit: "Caucao",
  late_fee: "Atraso",
  damage_fee: "Dano"
};

const receivableLifecycleLabels: Record<ReceivableLifecycleStatus, string> = {
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
  items: { rentalPriceCents: number; depositAmountCents: number }[]
) {
  const subtotalCents = items.reduce(
    (total, item) => total + item.rentalPriceCents,
    0
  );
  const depositAmountCents = items.reduce(
    (total, item) => total + item.depositAmountCents,
    0
  );

  return { subtotalCents, depositAmountCents };
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
        receivables: {
          orderBy: { createdAt: "asc" }
        }
      }
    }),
    Promise.all([
      prisma.customer.count(),
      prisma.item.count(),
      prisma.rental.count(),
      prisma.payment.count(),
      prisma.inspection.count()
    ])
  ]);

  const [customerCount, itemCount, rentalCount, paymentCount, inspectionCount] =
    counts;
  const rentableItems = items.filter((item) => item.prices.length > 0);

  return (
    <PanelShell
      active="rentals"
      counts={{
        customers: customerCount,
        items: itemCount,
        rentals: rentalCount,
        payments: paymentCount,
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
            Desconto
            <input name="discount" placeholder="Ex: 50,00" />
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
                const { subtotalCents, depositAmountCents } = sumRentalItems(
                  rental.rentalItems
                );
                const totalCents = Math.max(
                  subtotalCents - rental.discountCents,
                  0
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
                          <dd>{formatMoney(rental.discountCents)}</dd>
                        </div>
                        <div>
                          <dt>Total</dt>
                          <dd>{formatMoney(totalCents)}</dd>
                        </div>
                        <div>
                          <dt>Caucao</dt>
                          <dd>{formatMoney(depositAmountCents)}</dd>
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
                            <h2>Contas a receber</h2>
                            <span>{rental.receivables.length} geradas</span>
                          </div>
                        </div>

                        <div className="receivableList">
                          {rental.receivables.map((receivable) => (
                            <article className="receivableCard" key={receivable.id}>
                              <div>
                                <strong>{receivableTypeLabels[receivable.type]}</strong>
                                <small>
                                  Vence em {formatDateTime(receivable.dueAt)}
                                </small>
                              </div>
                              <div>
                                <strong>{formatMoney(receivable.amountCents)}</strong>
                                <small>
                                  {
                                    receivableLifecycleLabels[
                                      receivable.lifecycleStatus
                                    ]
                                  }
                                </small>
                              </div>
                            </article>
                          ))}
                        </div>
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
