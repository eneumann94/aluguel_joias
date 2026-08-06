import { ItemStatus } from "@prisma/client";
import { PanelShell } from "../../components/panel-shell";
import { prisma } from "../../lib/prisma";
import {
  createItem,
  createItemPrice,
  deleteItemPhoto,
  deleteItem,
  setPrimaryItemPhoto,
  uploadItemPhoto,
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
          orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }]
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
            Desconto da peca
            <input name="discount" placeholder="Ex: 30,00" />
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
                const primaryPhoto =
                  item.photos.find((photo) => photo.isPrimary) ?? item.photos[0];

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
                          <dt>Desconto da peca</dt>
                          <dd>{formatMoney(currentPrice?.discountCents)}</dd>
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

                      <section className="photosPanel" aria-label={`Fotos de ${item.name}`}>
                        <div className="sectionTitle compactTitle">
                          <div>
                            <h2>Fotos</h2>
                            <span>{item.photos.length} anexadas</span>
                          </div>
                        </div>

                        <form
                          action={uploadItemPhoto}
                          className="photoUploadForm"
                        >
                          <input name="itemId" type="hidden" value={item.id} />
                          <label>
                            Anexar foto
                            <input accept="image/*" name="photo" required type="file" />
                          </label>
                          <button type="submit">Enviar foto</button>
                        </form>

                        {item.photos.length === 0 ? (
                          <div className="emptyState compactEmpty">
                            Nenhuma foto anexada para esta joia.
                          </div>
                        ) : (
                          <div className="photoGrid">
                            {item.photos.map((photo) => (
                              <article className="photoTile" key={photo.id}>
                                <img alt={item.name} src={photo.photoUrl} />
                                <div>
                                  <strong>
                                    {photo.isPrimary ? "Principal" : "Foto"}
                                  </strong>
                                  <div className="photoActions">
                                    {!photo.isPrimary ? (
                                      <form action={setPrimaryItemPhoto}>
                                        <input
                                          name="photoId"
                                          type="hidden"
                                          value={photo.id}
                                        />
                                        <button type="submit">Marcar principal</button>
                                      </form>
                                    ) : null}
                                    <form action={deleteItemPhoto}>
                                      <input
                                        name="photoId"
                                        type="hidden"
                                        value={photo.id}
                                      />
                                      <button type="submit">Remover</button>
                                    </form>
                                  </div>
                                </div>
                              </article>
                            ))}
                          </div>
                        )}
                      </section>

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
                        <label>
                          Novo desconto da peca
                          <input
                            defaultValue={moneyInputValue(
                              currentPrice?.discountCents
                            )}
                            name="discount"
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
