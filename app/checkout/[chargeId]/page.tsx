import {
  RentalChargeStatus,
  RentalFinancialLineStatus,
  RentalFinancialLineType
} from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "../../../lib/prisma";
import { CheckoutForm } from "./checkout-form";

type CheckoutPageProps = {
  params: Promise<{
    chargeId: string;
  }>;
  searchParams: Promise<{
    simulated?: string;
  }>;
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

export default async function CheckoutPage({
  params,
  searchParams
}: CheckoutPageProps) {
  const { chargeId } = await params;
  const query = await searchParams;
  const simulated = query.simulated === "1";

  const charge = await prisma.rentalCharge.findUnique({
    where: { id: chargeId },
    include: {
      rental: {
        include: {
          customer: true,
          financialLines: {
            orderBy: { createdAt: "asc" }
          },
          rentalItems: {
            include: {
              item: true
            }
          }
        }
      }
    }
  });

  if (!charge) {
    notFound();
  }

  const totalFinancialCents = sumActiveFinancialLines(
    charge.rental.financialLines
  );
  const isPending = charge.status === RentalChargeStatus.pending;

  return (
    <main className="checkoutPage">
      <section className="checkoutShell">
        <header className="checkoutHeader">
          <Link className="brand checkoutBrand" href="/cobrancas">
            <span className="brandMark">AJ</span>
            <div>
              <strong>Aurora Joias</strong>
              <small>Checkout simulado</small>
            </div>
          </Link>
          <span>{formatDateTime(charge.expiresAt)}</span>
        </header>

        {simulated ? (
          <div className="notice">
            Pagamento simulado. Nenhum dado foi salvo no banco nesta etapa.
          </div>
        ) : null}

        <section className="checkoutGrid">
          <div className="checkoutMain">
            <div className="checkoutTitle">
              <p className="eyebrow">Resumo do aluguel</p>
              <h1>{formatMoney(charge.amountCents)}</h1>
              <span>
                {charge.rental.customer.name} -{" "}
                {formatDate(charge.rental.startDate)} ate{" "}
                {formatDate(charge.rental.expectedEndDate)}
              </span>
            </div>

            <dl>
              <div>
                <dt>Status</dt>
                <dd>{isPending ? "Pendente" : charge.status}</dd>
              </div>
              <div>
                <dt>Expira em</dt>
                <dd>{formatDateTime(charge.expiresAt)}</dd>
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
                  <h2>Composicao</h2>
                  <span>{charge.rental.financialLines.length} linhas</span>
                </div>
              </div>

              <div className="receivableList">
                {charge.rental.financialLines.map((line) => (
                  <article className="receivableCard" key={line.id}>
                    <div>
                      <strong>{financialLineTypeLabels[line.type]}</strong>
                      <small>
                        {line.lifecycleStatus === RentalFinancialLineStatus.active
                          ? "Ativo"
                          : "Cancelado"}
                      </small>
                    </div>
                    <div>
                      <strong>{formatMoney(line.amountCents)}</strong>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>

          <aside className="checkoutPayment">
            <div>
              <p className="eyebrow">Pagamento</p>
              <h2>Escolha como pagar</h2>
            </div>

            <CheckoutForm
              amountCents={charge.amountCents}
              chargeId={charge.id}
              disabled={!isPending}
            />

            <div className="checkoutHint">
              <strong>Pix e debito</strong>
              <span>Sempre a vista. Credito permite simular parcelamento.</span>
            </div>
          </aside>
        </section>
      </section>
    </main>
  );
}
