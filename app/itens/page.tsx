import { ItemStatus } from "@prisma/client";
import { PanelShell } from "../../components/panel-shell";
import { prisma } from "../../lib/prisma";
import {
  createItem,
  createItemPrice,
  deleteItem,
  updateItem
} from "./actions";

type ItemsPageProps = {
  searchParams: Promise<{
    q?: string;
    message?: string;
  }>;
};

const statusLabels: Record<ItemStatus, string> = {
  available: "Disponivel",
  reserved: "Reservada",
  rented: "Alugada",
  cleaning: "Limpeza",
  maintenance: "Manutencao",
  inactive: "Inativa"
};

function formatMoney(cents: number | undefined) {
  if (cents === undefined) {
    return "-";
  }

  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function moneyInputValue(cents: number | undefined) {
  return cents === undefined ? "" : (cents / 100).toFixed(2).replace(".", ",");
}

export default async function ItemsPage({ searchParams }: ItemsPageProps) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";

  const [items, counts] = await Promise.all([
    prisma.item.findMany({
      where: query
        ? {
            OR: [
              { name: { contains: query } },
              { type: { contains: query } },
              { description: { contains: query } }
            ]
          }
        : undefined,
      orderBy: { createdAt: "desc" },
      include: {
        photos: {
          where: { isPrimary: true },
          orderBy: { createdAt: "desc" },
          take: 1
        },
        prices: {
          orderBy: { createdAt: "desc" },
          take: 1
        },
        _count: {
          select: { prices: true }
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

  return (
    <PanelShell
      active="items"
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
          <p className="eyebrow">Catalogo interno</p>
          <h1>Joias</h1>
        </div>
      </header>

      {params.message ? <div className="notice">{params.message}</div> : null}

      <section className="itemLayout">
        <form action={createItem} className="formPanel">
          <div>
            <p className="eyebrow">Nova joia</p>
            <h2>Cadastro rapido</h2>
          </div>

          <label>
            Nome
            <input name="name" required placeholder="Ex: Brinco Luz" />
          </label>

          <label>
            Tipo
            <input name="type" required placeholder="Ex: Brinco, colar, anel" />
          </label>

          <label>
            Descricao
            <textarea
              name="description"
              placeholder="Detalhes simples para identificar a peca"
              rows={4}
            />
          </label>

          <label>
            Preco de aluguel
            <input name="rentalPrice" required placeholder="Ex: 180,00" />
          </label>

          <label>
            Caucao
            <input name="depositAmount" placeholder="Ex: 500,00" />
          </label>

          <label>
            Foto principal
            <input name="photoUrl" placeholder="https://..." />
          </label>

          <label>
            Status manual temporario
            <select name="status" defaultValue={ItemStatus.available}>
              {Object.values(ItemStatus).map((status) => (
                <option key={status} value={status}>
                  {statusLabels[status]}
                </option>
              ))}
            </select>
          </label>

          <button type="submit">Salvar joia</button>
        </form>

        <section className="listPanel" aria-label="Lista de joias">
          <div className="listHeader">
            <div>
              <h2>Joias cadastradas</h2>
              <span>{items.length} na lista atual</span>
            </div>

            <form className="searchForm">
              <input
                aria-label="Buscar joia"
                defaultValue={query}
                name="q"
                placeholder="Buscar por nome, tipo ou descricao"
              />
              <button type="submit">Buscar</button>
            </form>
          </div>

          {items.length === 0 ? (
            <div className="emptyState">
              Nenhuma joia encontrada. Cadastre a primeira peca para testar
              foto, preco e status.
            </div>
          ) : (
            <div className="itemRows">
              {items.map((item) => {
                const currentPrice = item.prices[0];
                const primaryPhoto = item.photos[0];

                return (
                  <details className="itemRow" key={item.id}>
                    <summary>
                      <span className="itemThumb">
                        {primaryPhoto ? (
                          <img alt={item.name} src={primaryPhoto.photoUrl} />
                        ) : (
                          <span>Sem foto</span>
                        )}
                      </span>
                      <span>
                        <strong>{item.name}</strong>
                        <small>
                          {item.type} · {statusLabels[item.status]}
                        </small>
                      </span>
                      <span className="priceSummary">
                        {formatMoney(currentPrice?.rentalPriceCents)}
                      </span>
                    </summary>

                    <div className="itemDetails">
                      <dl>
                        <div>
                          <dt>Preco atual</dt>
                          <dd>{formatMoney(currentPrice?.rentalPriceCents)}</dd>
                        </div>
                        <div>
                          <dt>Caucao</dt>
                          <dd>{formatMoney(currentPrice?.depositAmountCents)}</dd>
                        </div>
                        <div>
                          <dt>Historico de precos</dt>
                          <dd>{item._count.prices}</dd>
                        </div>
                        <div>
                          <dt>Status</dt>
                          <dd>{statusLabels[item.status]}</dd>
                        </div>
                      </dl>

                      <form action={updateItem} className="editForm itemEditForm">
                        <input name="id" type="hidden" value={item.id} />
                        <label>
                          Nome
                          <input defaultValue={item.name} name="name" required />
                        </label>
                        <label>
                          Tipo
                          <input defaultValue={item.type} name="type" required />
                        </label>
                        <label>
                          Status manual temporario
                          <select name="status" defaultValue={item.status}>
                            {Object.values(ItemStatus).map((status) => (
                              <option key={status} value={status}>
                                {statusLabels[status]}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Foto principal
                          <input
                            defaultValue={primaryPhoto?.photoUrl ?? ""}
                            name="photoUrl"
                            placeholder="https://..."
                          />
                        </label>
                        <label className="wideField">
                          Descricao
                          <textarea
                            defaultValue={item.description ?? ""}
                            name="description"
                            rows={3}
                          />
                        </label>
                        <div className="rowActions">
                          <button type="submit">Atualizar dados</button>
                        </div>
                      </form>

                      <form action={createItemPrice} className="priceForm">
                        <input name="itemId" type="hidden" value={item.id} />
                        <label>
                          Novo preco de aluguel
                          <input
                            defaultValue={moneyInputValue(
                              currentPrice?.rentalPriceCents
                            )}
                            name="rentalPrice"
                            required
                          />
                        </label>
                        <label>
                          Nova caucao
                          <input
                            defaultValue={moneyInputValue(
                              currentPrice?.depositAmountCents
                            )}
                            name="depositAmount"
                          />
                        </label>
                        <div className="rowActions">
                          <button type="submit">Registrar novo preco</button>
                        </div>
                      </form>

                      <form action={deleteItem} className="deleteForm">
                        <input name="id" type="hidden" value={item.id} />
                        <button type="submit">Remover joia</button>
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
