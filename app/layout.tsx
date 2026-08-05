import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Painel Aurora Joias",
  description: "Prova de conceito para aluguel de joias."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
