"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ItemStatus, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";

const itemStatuses = new Set(Object.values(ItemStatus));

function optionalText(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}

function requiredText(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function parseMoneyToCents(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();

  if (!raw) {
    return null;
  }

  const normalized = raw
    .replace(/\s/g, "")
    .replace(/[R$]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const amount = Number(normalized);

  if (!Number.isFinite(amount) || amount < 0) {
    return null;
  }

  return Math.round(amount * 100);
}

function parseStatus(value: FormDataEntryValue | null) {
  const status = requiredText(value);
  return itemStatuses.has(status as ItemStatus)
    ? (status as ItemStatus)
    : ItemStatus.available;
}

function redirectWithMessage(message: string): never {
  redirect(`/itens?message=${encodeURIComponent(message)}`);
}

async function replacePrimaryPhoto(itemId: string, photoUrl: string | null) {
  if (!photoUrl) {
    await prisma.itemPhoto.deleteMany({
      where: { itemId, isPrimary: true }
    });
    return;
  }

  const primaryPhoto = await prisma.itemPhoto.findFirst({
    where: { itemId, isPrimary: true },
    orderBy: { createdAt: "desc" }
  });

  if (primaryPhoto) {
    await prisma.itemPhoto.update({
      where: { id: primaryPhoto.id },
      data: { photoUrl }
    });
    return;
  }

  await prisma.itemPhoto.create({
    data: {
      itemId,
      photoUrl,
      isPrimary: true,
      sortOrder: 0
    }
  });
}

export async function createItem(formData: FormData) {
  const name = requiredText(formData.get("name"));
  const type = requiredText(formData.get("type"));
  const rentalPriceCents = parseMoneyToCents(formData.get("rentalPrice"));
  const depositAmountCents = parseMoneyToCents(formData.get("depositAmount"));
  const photoUrl = optionalText(formData.get("photoUrl"));

  if (!name || !type || rentalPriceCents === null) {
    redirectWithMessage("Informe nome, tipo e preco de aluguel.");
  }

  await prisma.item.create({
    data: {
      name,
      type,
      description: optionalText(formData.get("description")),
      status: parseStatus(formData.get("status")),
      prices: {
        create: {
          rentalPriceCents,
          depositAmountCents: depositAmountCents ?? 0
        }
      },
      photos: photoUrl
        ? {
            create: {
              photoUrl,
              isPrimary: true,
              sortOrder: 0
            }
          }
        : undefined
    }
  });

  revalidatePath("/itens");
  revalidatePath("/");
  redirectWithMessage("Joia cadastrada.");
}

export async function updateItem(formData: FormData) {
  const id = requiredText(formData.get("id"));
  const name = requiredText(formData.get("name"));
  const type = requiredText(formData.get("type"));

  if (!id || !name || !type) {
    redirectWithMessage("Informe nome e tipo da joia.");
  }

  await prisma.item.update({
    where: { id },
    data: {
      name,
      type,
      description: optionalText(formData.get("description")),
      status: parseStatus(formData.get("status"))
    }
  });

  await replacePrimaryPhoto(id, optionalText(formData.get("photoUrl")));

  revalidatePath("/itens");
  revalidatePath("/");
  redirectWithMessage("Joia atualizada.");
}

export async function createItemPrice(formData: FormData) {
  const itemId = requiredText(formData.get("itemId"));
  const rentalPriceCents = parseMoneyToCents(formData.get("rentalPrice"));
  const depositAmountCents = parseMoneyToCents(formData.get("depositAmount"));

  if (!itemId || rentalPriceCents === null) {
    redirectWithMessage("Informe o novo preco de aluguel.");
  }

  const latestPrice = await prisma.itemPrice.findFirst({
    where: { itemId },
    orderBy: { createdAt: "desc" }
  });

  if (
    latestPrice &&
    latestPrice.rentalPriceCents === rentalPriceCents &&
    latestPrice.depositAmountCents === (depositAmountCents ?? 0)
  ) {
    redirectWithMessage("O preco informado ja e o preco atual.");
  }

  await prisma.itemPrice.create({
    data: {
      itemId,
      rentalPriceCents,
      depositAmountCents: depositAmountCents ?? 0
    }
  });

  revalidatePath("/itens");
  redirectWithMessage("Novo preco registrado.");
}

export async function deleteItem(formData: FormData) {
  const id = requiredText(formData.get("id"));

  if (!id) {
    redirectWithMessage("Joia nao encontrada.");
  }

  try {
    await prisma.item.delete({
      where: { id }
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      redirectWithMessage("Esta joia ja possui vinculos operacionais.");
    }

    throw error;
  }

  revalidatePath("/itens");
  revalidatePath("/");
  redirectWithMessage("Joia removida.");
}
