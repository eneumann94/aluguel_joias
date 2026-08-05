"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";

function optionalText(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}

function requiredText(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function optionalDate(value: FormDataEntryValue | null) {
  const text = optionalText(value);
  return text ? new Date(`${text}T12:00:00`) : null;
}

function redirectWithMessage(message: string) {
  redirect(`/clientes?message=${encodeURIComponent(message)}`);
}

export async function createCustomer(formData: FormData) {
  const name = requiredText(formData.get("name"));

  if (!name) {
    redirectWithMessage("Informe o nome do cliente.");
  }

  try {
    await prisma.customer.create({
      data: {
        name,
        cpf: optionalText(formData.get("cpf")),
        birthDate: optionalDate(formData.get("birthDate")),
        email: optionalText(formData.get("email")),
        whatsapp: optionalText(formData.get("whatsapp"))
      }
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      redirectWithMessage("Ja existe um cliente com este CPF.");
    }

    throw error;
  }

  revalidatePath("/clientes");
  redirectWithMessage("Cliente cadastrado.");
}

export async function updateCustomer(formData: FormData) {
  const id = requiredText(formData.get("id"));
  const name = requiredText(formData.get("name"));

  if (!id || !name) {
    redirectWithMessage("Informe o nome do cliente.");
  }

  try {
    await prisma.customer.update({
      where: { id },
      data: {
        name,
        cpf: optionalText(formData.get("cpf")),
        birthDate: optionalDate(formData.get("birthDate")),
        email: optionalText(formData.get("email")),
        whatsapp: optionalText(formData.get("whatsapp"))
      }
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      redirectWithMessage("Ja existe um cliente com este CPF.");
    }

    throw error;
  }

  revalidatePath("/clientes");
  redirectWithMessage("Cliente atualizado.");
}

export async function deleteCustomer(formData: FormData) {
  const id = requiredText(formData.get("id"));

  if (!id) {
    redirectWithMessage("Cliente nao encontrado.");
  }

  try {
    await prisma.customer.delete({
      where: { id }
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      redirectWithMessage("Este cliente ja possui aluguel vinculado.");
    }

    throw error;
  }

  revalidatePath("/clientes");
  redirectWithMessage("Cliente removido.");
}
