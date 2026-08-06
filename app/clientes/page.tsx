import { PanelShell } from "../../components/panel-shell";
import { prisma } from "../../lib/prisma";
import { createCustomer, deleteCustomer, updateCustomer } from "./actions";

type CustomersPageProps = {
  searchParams: Promise<{
    q?: string;
    message?: string;
  }>;
};

function dateInputValue(date: Date | null) {
  return date ? date.toISOString().slice(0, 10) : "";
}

function displayDate(date: Date | null) {
  return date ? date.toLocaleDateString("pt-BR") : "-";
}

export default async function CustomersPage({ searchParams }: CustomersPageProps) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";

  const [customers, counts] = await Promise.all([
    prisma.customer.findMany({
      where: query
        ? {
            OR: [
              { name: { contains: query } },
              { cpf: { contains: query } },
              { email: { contains: query } },
              { whatsapp: { contains: query } }
            ]
          }
        : undefined,
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { rentals: true }
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
      active="customers"
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
          <p className="eyebrow">Cadastro</p>
          <h1>Clientes</h1>
        </div>
      </header>

      {params.message ? <div className="notice">{params.message}</div> : null}

      <section className="customerLayout">
        <form action={createCustomer} className="formPanel">
          <div>
            <p className="eyebrow">Novo cliente</p>
            <h2>Cadastro rapido</h2>
          </div>

          <label>
            Nome
            <input name="name" required placeholder="Ex: Mariana Costa" />
          </label>

          <label>
            CPF
            <input name="cpf" placeholder="Somente numeros ou formatado" />
          </label>

          <label>
            Data de nascimento
            <input name="birthDate" type="date" />
          </label>

          <label>
            Email
            <input name="email" type="email" placeholder="cliente@email.com" />
          </label>

          <label>
            WhatsApp
            <input name="whatsapp" placeholder="(00) 00000-0000" />
          </label>

          <button type="submit">Salvar cliente</button>
        </form>

        <section className="listPanel" aria-label="Lista de clientes">
          <div className="listHeader">
            <div>
              <h2>Clientes cadastrados</h2>
              <span>{customers.length} na lista atual</span>
            </div>

            <form className="searchForm">
              <input
                aria-label="Buscar cliente"
                defaultValue={query}
                name="q"
                placeholder="Buscar por nome, CPF, email ou WhatsApp"
              />
              <button type="submit">Buscar</button>
            </form>
          </div>

          {customers.length === 0 ? (
            <div className="emptyState">
              Nenhum cliente encontrado. Cadastre o primeiro cliente para
              comecar a testar o fluxo.
            </div>
          ) : (
            <div className="customerRows">
              {customers.map((customer) => (
                <details className="customerRow" key={customer.id}>
                  <summary>
                    <span>
                      <strong>{customer.name}</strong>
                      <small>
                        {customer.whatsapp || customer.email || "Contato nao informado"}
                      </small>
                    </span>
                    <span>{customer._count.rentals} alugueis</span>
                  </summary>

                  <div className="customerDetails">
                    <dl>
                      <div>
                        <dt>CPF</dt>
                        <dd>{customer.cpf || "-"}</dd>
                      </div>
                      <div>
                        <dt>Nascimento</dt>
                        <dd>{displayDate(customer.birthDate)}</dd>
                      </div>
                      <div>
                        <dt>Email</dt>
                        <dd>{customer.email || "-"}</dd>
                      </div>
                      <div>
                        <dt>WhatsApp</dt>
                        <dd>{customer.whatsapp || "-"}</dd>
                      </div>
                    </dl>

                    <form action={updateCustomer} className="editForm">
                      <input name="id" type="hidden" value={customer.id} />
                      <label>
                        Nome
                        <input
                          defaultValue={customer.name}
                          name="name"
                          required
                        />
                      </label>
                      <label>
                        CPF
                        <input defaultValue={customer.cpf ?? ""} name="cpf" />
                      </label>
                      <label>
                        Data de nascimento
                        <input
                          defaultValue={dateInputValue(customer.birthDate)}
                          name="birthDate"
                          type="date"
                        />
                      </label>
                      <label>
                        Email
                        <input
                          defaultValue={customer.email ?? ""}
                          name="email"
                          type="email"
                        />
                      </label>
                      <label>
                        WhatsApp
                        <input
                          defaultValue={customer.whatsapp ?? ""}
                          name="whatsapp"
                        />
                      </label>
                      <div className="rowActions">
                        <button type="submit">Atualizar</button>
                      </div>
                    </form>

                    <form action={deleteCustomer} className="deleteForm">
                      <input name="id" type="hidden" value={customer.id} />
                      <button type="submit">Remover cliente</button>
                    </form>
                  </div>
                </details>
              ))}
            </div>
          )}
        </section>
      </section>
    </PanelShell>
  );
}
