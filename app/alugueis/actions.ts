"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  Prisma,
  RentalChargeMethod,
  RentalChargeStatus,
  RentalFinancialLineStatus,
  RentalFinancialLineType,
  RentalStatus
} from "@prisma/client";
import { prisma } from "../../lib/prisma";

const rentalStatuses = new Set(Object.values(RentalStatus));
const chargeMethods = new Set(Object.values(RentalChargeMethod));

function requiredText(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function parseDate(value: FormDataEntryValue | null) {
  const text = requiredText(value);
  return text ? new Date(`${text}T12:00:00`) : null;
}

function parseMoneyToCents(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();

  if (!raw) {
    return 0;
  }

  const normalized = raw
    .replace(/\s/g, "")
    .replace(/[R$]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const amount = Number(normalized);

  if (!Number.isFinite(amount) || amount < 0) {
    return 0;
  }

  return Math.round(amount * 100);
}

function parseStatus(value: FormDataEntryValue | null) {
  const status = requiredText(value);
  return rentalStatuses.has(status as RentalStatus)
    ? (status as RentalStatus)
    : RentalStatus.pending_payment;
}

function parseChargeMethod(value: FormDataEntryValue | null) {
  const method = requiredText(value);
  return chargeMethods.has(method as RentalChargeMethod)
    ? (method as RentalChargeMethod)
    : null;
}

function parseInstallments(
  value: FormDataEntryValue | null,
  method: RentalChargeMethod
) {
  if (method !== RentalChargeMethod.credit_card) {
    return 1;
  }

  const installments = Number.parseInt(requiredText(value), 10);

  if (!Number.isInteger(installments) || installments < 1) {
    return 1;
  }

  return Math.min(installments, 12);
}

function redirectWithMessage(message: string): never {
  redirect(`/alugueis?message=${encodeURIComponent(message)}`);
}

async function getCurrentPrices(itemIds: string[]) {
  const prices = await Promise.all(
    itemIds.map(async (itemId) => {
      const price = await prisma.itemPrice.findFirst({
        where: { itemId },
        orderBy: { createdAt: "desc" },
        select: {
          itemId: true,
          rentalPriceCents: true,
          depositAmountCents: true,
          discountCents: true
        }
      });

      return price;
    })
  );

  if (prices.some((price) => price === null)) {
    redirectWithMessage("Todas as joias selecionadas precisam ter preco.");
  }

  return prices as {
    itemId: string;
    rentalPriceCents: number;
    depositAmountCents: number;
    discountCents: number;
  }[];
}

export async function createRental(formData: FormData) {
  const customerId = requiredText(formData.get("customerId"));
  const startDate = parseDate(formData.get("startDate"));
  const expectedEndDate = parseDate(formData.get("expectedEndDate"));
  const generalDiscountCents = parseMoneyToCents(formData.get("generalDiscount"));
  const chargeMethod = parseChargeMethod(formData.get("chargeMethod"));
  const itemIds = formData
    .getAll("itemIds")
    .map((value) => requiredText(value))
    .filter(Boolean);

  if (!customerId || !startDate || !expectedEndDate) {
    redirectWithMessage("Informe cliente e datas do aluguel.");
  }

  if (expectedEndDate < startDate) {
    redirectWithMessage("A data final nao pode ser anterior a inicial.");
  }

  if (itemIds.length === 0) {
    redirectWithMessage("Selecione pelo menos uma joia.");
  }

  if (!chargeMethod) {
    redirectWithMessage("Selecione o metodo de pagamento.");
  }

  const installments = parseInstallments(
    formData.get("installments"),
    chargeMethod
  );
  const uniqueItemIds = Array.from(new Set(itemIds));
  const prices = await getCurrentPrices(uniqueItemIds);
  const subtotalCents = prices.reduce(
    (total, price) => total + price.rentalPriceCents,
    0
  );
  const depositAmountCents = prices.reduce(
    (total, price) => total + price.depositAmountCents,
    0
  );
  const itemDiscountCents = prices.reduce(
    (total, price) => total + price.discountCents,
    0
  );
  const dueAt = new Date(Date.now() + 12 * 60 * 60 * 1000);
  const financialLines = [
    {
      type: RentalFinancialLineType.rental_fee,
      amountCents: subtotalCents,
      dueAt,
      lifecycleStatus: RentalFinancialLineStatus.active
    },
    ...(itemDiscountCents > 0
      ? [
          {
            type: RentalFinancialLineType.item_discount,
            amountCents: -itemDiscountCents,
            dueAt,
            lifecycleStatus: RentalFinancialLineStatus.active
          }
        ]
      : []),
    {
      type: RentalFinancialLineType.deposit,
      amountCents: depositAmountCents,
      dueAt,
      lifecycleStatus: RentalFinancialLineStatus.active
    },
    ...(generalDiscountCents > 0
      ? [
          {
            type: RentalFinancialLineType.general_discount,
            amountCents: -generalDiscountCents,
            dueAt,
            lifecycleStatus: RentalFinancialLineStatus.active
          }
        ]
      : [])
  ];
  const chargeAmountCents = financialLines.reduce(
    (total, line) => total + line.amountCents,
    0
  );

  if (chargeAmountCents <= 0) {
    redirectWithMessage("O valor total da cobranca precisa ser maior que zero.");
  }

  await prisma.rental.create({
    data: {
      customerId,
      startDate,
      expectedEndDate,
      status: RentalStatus.pending_payment,
      rentalItems: {
        create: prices.map((price) => ({
          itemId: price.itemId,
          rentalPriceCents: price.rentalPriceCents,
          depositAmountCents: price.depositAmountCents,
          discountCents: price.discountCents
        }))
      },
      financialLines: {
        create: financialLines
      },
      charges: {
        create: {
          amountCents: chargeAmountCents,
          method: chargeMethod,
          installments,
          status: RentalChargeStatus.pending,
          expiresAt: dueAt
        }
      }
    }
  });

  revalidatePath("/alugueis");
  revalidatePath("/");
  redirectWithMessage("Aluguel criado.");
}

export async function updateRentalStatus(formData: FormData) {
  const id = requiredText(formData.get("id"));

  if (!id) {
    redirectWithMessage("Aluguel nao encontrado.");
  }

  await prisma.rental.update({
    where: { id },
    data: {
      status: parseStatus(formData.get("status"))
    }
  });

  revalidatePath("/alugueis");
  revalidatePath("/");
  redirectWithMessage("Status do aluguel atualizado.");
}

export async function deleteRental(formData: FormData) {
  const id = requiredText(formData.get("id"));

  if (!id) {
    redirectWithMessage("Aluguel nao encontrado.");
  }

  try {
    await prisma.rental.delete({
      where: { id }
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      redirectWithMessage("Este aluguel ja possui vinculos operacionais.");
    }

    throw error;
  }

  revalidatePath("/alugueis");
  revalidatePath("/");
  redirectWithMessage("Aluguel removido.");
}
