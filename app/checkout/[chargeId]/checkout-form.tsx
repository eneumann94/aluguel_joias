"use client";

import { useState } from "react";
import { payCharge } from "./actions";

type CheckoutFormProps = {
  amountCents: number;
  chargeId: string;
  disabled: boolean;
};

const paymentMethods = [
  { value: "pix", label: "Pix" },
  { value: "debit_card", label: "Cartao de debito" },
  { value: "credit_card", label: "Cartao de credito" }
];

function formatMoney(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

export function CheckoutForm({
  amountCents,
  chargeId,
  disabled
}: CheckoutFormProps) {
  const [method, setMethod] = useState("pix");
  const isCreditCard = method === "credit_card";
  const installments = isCreditCard
    ? Array.from({ length: 12 }, (_, index) => index + 1)
    : [1];

  return (
    <form action={payCharge} className="checkoutForm">
      <input name="chargeId" type="hidden" value={chargeId} />

      <label>
        Metodo
        <select
          disabled={disabled}
          name="method"
          onChange={(event) => setMethod(event.target.value)}
          value={method}
        >
          {paymentMethods.map((paymentMethod) => (
            <option key={paymentMethod.value} value={paymentMethod.value}>
              {paymentMethod.label}
            </option>
          ))}
        </select>
      </label>

      <label>
        Parcelas
        <select disabled={disabled || !isCreditCard} name="installments">
          {installments.map((installment) => (
            <option key={installment} value={installment}>
              {installment}x de{" "}
              {formatMoney(Math.round(amountCents / installment))}
            </option>
          ))}
        </select>
      </label>

      <button disabled={disabled} type="submit">
        Pagar
      </button>
    </form>
  );
}
