"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  PaymentMethod,
  PaymentStatus,
  RentalChargeStatus,
  RentalStatus
} from "@prisma/client";
import { prisma } from "../../../lib/prisma";

const paymentMethods = new Set(Object.values(PaymentMethod));

function requiredText(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function parsePaymentMethod(value: FormDataEntryValue | null) {
  const method = requiredText(value);
  return paymentMethods.has(method as PaymentMethod)
    ? (method as PaymentMethod)
    : null;
}

function parseInstallments(value: FormDataEntryValue | null, method: PaymentMethod) {
  if (method !== PaymentMethod.credit_card) {
    return 1;
  }

  const installments = Number.parseInt(requiredText(value), 10);

  if (!Number.isInteger(installments) || installments < 1) {
    return 1;
  }

  return Math.min(installments, 12);
}

function redirectToCheckout(chargeId: string, message: string): never {
  redirect(`/checkout/${chargeId}?message=${encodeURIComponent(message)}`);
}

export async function payCharge(formData: FormData) {
  const chargeId = requiredText(formData.get("chargeId"));
  const method = parsePaymentMethod(formData.get("method"));

  if (!chargeId) {
    redirect("/cobrancas");
  }

  if (!method) {
    redirectToCheckout(chargeId, "Selecione o metodo de pagamento.");
  }

  const installments = parseInstallments(formData.get("installments"), method);
  const now = new Date();

  const charge = await prisma.rentalCharge.findUnique({
    where: { id: chargeId },
    include: {
      payments: true,
      rental: true
    }
  });

  if (!charge) {
    redirect("/cobrancas");
  }

  const paidPayment = charge.payments.find(
    (payment) => payment.status === PaymentStatus.paid
  );

  if (paidPayment || charge.status === RentalChargeStatus.paid) {
    redirectToCheckout(chargeId, "Esta cobranca ja foi paga.");
  }

  if (charge.status !== RentalChargeStatus.pending) {
    redirectToCheckout(chargeId, "Esta cobranca nao esta pendente.");
  }

  if (charge.rental.status !== RentalStatus.pending_payment) {
    redirectToCheckout(chargeId, "Este aluguel nao esta aguardando pagamento.");
  }

  if (charge.expiresAt <= now) {
    await prisma.$transaction([
      prisma.rentalCharge.update({
        where: { id: charge.id },
        data: { status: RentalChargeStatus.expired }
      }),
      prisma.rental.update({
        where: { id: charge.rentalId },
        data: { status: RentalStatus.expired }
      })
    ]);

    revalidatePath("/cobrancas");
    revalidatePath("/alugueis");
    redirectToCheckout(chargeId, "Esta cobranca expirou.");
  }

  if (charge.amountCents <= 0) {
    redirectToCheckout(chargeId, "O valor da cobranca precisa ser maior que zero.");
  }

  await prisma.$transaction([
    prisma.payment.create({
      data: {
        rentalChargeId: charge.id,
        amountCents: charge.amountCents,
        method,
        installments,
        status: PaymentStatus.paid,
        paidAt: now
      }
    }),
    prisma.rentalCharge.update({
      where: { id: charge.id },
      data: { status: RentalChargeStatus.paid }
    }),
    prisma.rental.update({
      where: { id: charge.rentalId },
      data: { status: RentalStatus.confirmed }
    })
  ]);

  revalidatePath(`/checkout/${chargeId}`);
  revalidatePath("/cobrancas");
  revalidatePath("/alugueis");
  revalidatePath("/");
  redirectToCheckout(chargeId, "Pagamento registrado.");
}
