PRAGMA foreign_keys=OFF;

DROP TABLE "payments";

CREATE TABLE "payments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rentalChargeId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "installments" INTEGER NOT NULL DEFAULT 1,
    "amountCents" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "paidAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "payments_rentalChargeId_fkey" FOREIGN KEY ("rentalChargeId") REFERENCES "rental_charges" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "payments_rentalChargeId_idx" ON "payments"("rentalChargeId");

PRAGMA foreign_keys=ON;
