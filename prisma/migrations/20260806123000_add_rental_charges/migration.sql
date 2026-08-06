UPDATE "rentals"
SET "status" = 'pending_payment'
WHERE "status" = 'open';

CREATE TABLE "rental_charges" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rentalId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "method" TEXT NOT NULL,
    "installments" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "rental_charges_rentalId_fkey" FOREIGN KEY ("rentalId") REFERENCES "rentals" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "rental_charges_rentalId_idx" ON "rental_charges"("rentalId");
CREATE INDEX "rental_charges_expiresAt_idx" ON "rental_charges"("expiresAt");
