PRAGMA foreign_keys=OFF;

CREATE TABLE "new_item_prices" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemId" TEXT NOT NULL,
    "rentalPriceCents" INTEGER NOT NULL,
    "depositAmountCents" INTEGER NOT NULL,
    "discountCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "item_prices_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_item_prices" (
    "id",
    "itemId",
    "rentalPriceCents",
    "depositAmountCents",
    "discountCents",
    "createdAt",
    "updatedAt"
)
SELECT
    "id",
    "itemId",
    "rentalPriceCents",
    "depositAmountCents",
    "discountCents",
    "createdAt",
    "updatedAt"
FROM "item_prices";

DROP TABLE "item_prices";

ALTER TABLE "new_item_prices" RENAME TO "item_prices";

CREATE INDEX "item_prices_itemId_idx" ON "item_prices"("itemId");

CREATE TABLE "new_rental_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rentalId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "rentalPriceCents" INTEGER NOT NULL,
    "depositAmountCents" INTEGER NOT NULL,
    "discountCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "rental_items_rentalId_fkey" FOREIGN KEY ("rentalId") REFERENCES "rentals" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "rental_items_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "new_rental_items" (
    "id",
    "rentalId",
    "itemId",
    "rentalPriceCents",
    "depositAmountCents",
    "discountCents",
    "createdAt",
    "updatedAt"
)
SELECT
    "id",
    "rentalId",
    "itemId",
    "rentalPriceCents",
    "depositAmountCents",
    "discountCents",
    "createdAt",
    "updatedAt"
FROM "rental_items";

DROP TABLE "rental_items";

ALTER TABLE "new_rental_items" RENAME TO "rental_items";

CREATE INDEX "rental_items_itemId_idx" ON "rental_items"("itemId");
CREATE UNIQUE INDEX "rental_items_rentalId_itemId_key" ON "rental_items"("rentalId", "itemId");

PRAGMA foreign_keys=ON;
