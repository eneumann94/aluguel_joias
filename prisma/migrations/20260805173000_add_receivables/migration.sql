CREATE TABLE "receivables" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rentalId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "dueAt" DATETIME NOT NULL,
    "lifecycleStatus" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "receivables_rentalId_fkey" FOREIGN KEY ("rentalId") REFERENCES "rentals" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "receivables_rentalId_idx" ON "receivables"("rentalId");
CREATE INDEX "receivables_dueAt_idx" ON "receivables"("dueAt");
