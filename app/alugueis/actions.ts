"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  Prisma,
  ReceivableLifecycleStatus,
  ReceivableType,
  RentalStatus
} from "@prisma/client";
import { prisma } from "../../lib/prisma";

const rentalStatuses = new Set(Object.values(RentalStatus));

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
    : RentalStatus.open;
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
          depositAmountCents: true
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
  }[];
}

export async function createRental(formData: FormData) {
  const customerId = requiredText(formData.get("customerId"));
  const startDate = parseDate(formData.get("startDate"));
  const expectedEndDate = parseDate(formData.get("expectedEndDate"));
  const discountCents = parseMoneyToCents(formData.get("discount"));
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
  const rentalFeeCents = Math.max(subtotalCents - discountCents, 0);
  const dueAt = new Date(Date.now() + 12 * 60 * 60 * 1000);

  await prisma.rental.create({
    data: {
      customerId,
      startDate,
      expectedEndDate,
      discountCents,
      status: RentalStatus.open,
      rentalItems: {
        create: prices.map((price) => ({
          itemId: price.itemId,
          rentalPriceCents: price.rentalPriceCents,
          depositAmountCents: price.depositAmountCents
        }))
      },
      receivables: {
        create: [
          {
            type: ReceivableType.rental_fee,
            amountCents: rentalFeeCents,
            dueAt,
            lifecycleStatus: ReceivableLifecycleStatus.active
          },
          {
            type: ReceivableType.deposit,
            amountCents: depositAmountCents,
            dueAt,
            lifecycleStatus: ReceivableLifecycleStatus.active
          }
        ]
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
