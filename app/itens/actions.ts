"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ItemStatus, Prisma } from "@prisma/client";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
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

function safeFileName(fileName: string) {
  return fileName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();
}

function localUploadPath(photoUrl: string) {
  if (!photoUrl.startsWith("/uploads/items/")) {
    return null;
  }

  return path.join(process.cwd(), "public", photoUrl);
}

async function removeLocalFile(photoUrl: string | null) {
  if (!photoUrl) {
    return;
  }

  const filePath = localUploadPath(photoUrl);

  if (!filePath) {
    return;
  }

  try {
    await unlink(filePath);
  } catch {
    // File removal is best-effort for this local POC.
  }
}

export async function createItem(formData: FormData) {
  const name = requiredText(formData.get("name"));
  const type = requiredText(formData.get("type"));
  const rentalPriceCents = parseMoneyToCents(formData.get("rentalPrice"));
  const depositAmountCents = parseMoneyToCents(formData.get("depositAmount"));

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
      }
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
    const photos = await prisma.itemPhoto.findMany({
      where: { itemId: id },
      select: { photoUrl: true }
    });

    await prisma.item.delete({
      where: { id }
    });

    await Promise.all(photos.map((photo) => removeLocalFile(photo.photoUrl)));
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

export async function uploadItemPhoto(formData: FormData) {
  const itemId = requiredText(formData.get("itemId"));
  const file = formData.get("photo");

  if (!itemId || !(file instanceof File) || file.size === 0) {
    redirectWithMessage("Selecione uma foto para anexar.");
  }

  if (!file.type.startsWith("image/")) {
    redirectWithMessage("O arquivo selecionado precisa ser uma imagem.");
  }

  const item = await prisma.item.findUnique({
    where: { id: itemId },
    select: { id: true }
  });

  if (!item) {
    redirectWithMessage("Joia nao encontrada.");
  }

  const uploadDir = path.join(process.cwd(), "public", "uploads", "items");
  await mkdir(uploadDir, { recursive: true });

  const extension = path.extname(file.name) || ".jpg";
  const baseName = path.basename(file.name, extension);
  const fileName = `${itemId}-${Date.now()}-${safeFileName(baseName)}${extension.toLowerCase()}`;
  const filePath = path.join(uploadDir, fileName);
  const buffer = Buffer.from(await file.arrayBuffer());

  await writeFile(filePath, buffer);

  const existingPhotos = await prisma.itemPhoto.count({
    where: { itemId }
  });

  await prisma.itemPhoto.create({
    data: {
      itemId,
      photoUrl: `/uploads/items/${fileName}`,
      isPrimary: existingPhotos === 0,
      sortOrder: existingPhotos
    }
  });

  revalidatePath("/itens");
  revalidatePath("/");
  redirectWithMessage("Foto anexada.");
}

export async function setPrimaryItemPhoto(formData: FormData) {
  const photoId = requiredText(formData.get("photoId"));

  if (!photoId) {
    redirectWithMessage("Foto nao encontrada.");
  }

  const photo = await prisma.itemPhoto.findUnique({
    where: { id: photoId },
    select: { itemId: true }
  });

  if (!photo) {
    redirectWithMessage("Foto nao encontrada.");
  }

  await prisma.$transaction([
    prisma.itemPhoto.updateMany({
      where: { itemId: photo.itemId },
      data: { isPrimary: false }
    }),
    prisma.itemPhoto.update({
      where: { id: photoId },
      data: { isPrimary: true }
    })
  ]);

  revalidatePath("/itens");
  revalidatePath("/");
  redirectWithMessage("Foto principal atualizada.");
}

export async function deleteItemPhoto(formData: FormData) {
  const photoId = requiredText(formData.get("photoId"));

  if (!photoId) {
    redirectWithMessage("Foto nao encontrada.");
  }

  const photo = await prisma.itemPhoto.findUnique({
    where: { id: photoId }
  });

  if (!photo) {
    redirectWithMessage("Foto nao encontrada.");
  }

  await prisma.itemPhoto.delete({
    where: { id: photoId }
  });
  await removeLocalFile(photo.photoUrl);

  if (photo.isPrimary) {
    const nextPhoto = await prisma.itemPhoto.findFirst({
      where: { itemId: photo.itemId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
    });

    if (nextPhoto) {
      await prisma.itemPhoto.update({
        where: { id: nextPhoto.id },
        data: { isPrimary: true }
      });
    }
  }

  revalidatePath("/itens");
  revalidatePath("/");
  redirectWithMessage("Foto removida.");
}
