PRAGMA foreign_keys=OFF;

CREATE TABLE "new_rental_financial_lines" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rentalId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "dueAt" DATETIME NOT NULL,
    "lifecycleStatus" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "rental_financial_lines_rentalId_fkey" FOREIGN KEY ("rentalId") REFERENCES "rentals" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_rental_financial_lines" (
    "id",
    "rentalId",
    "type",
    "amountCents",
    "dueAt",
    "lifecycleStatus",
    "createdAt",
    "updatedAt"
)
SELECT
    "id",
    "rentalId",
    "type",
    "amountCents",
    "dueAt",
    "lifecycleStatus",
    "createdAt",
    "updatedAt"
FROM "receivables";

DROP TABLE "receivables";

ALTER TABLE "new_rental_financial_lines" RENAME TO "rental_financial_lines";

CREATE INDEX "rental_financial_lines_rentalId_idx" ON "rental_financial_lines"("rentalId");
CREATE INDEX "rental_financial_lines_dueAt_idx" ON "rental_financial_lines"("dueAt");

PRAGMA foreign_keys=ON;
