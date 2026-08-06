ALTER TABLE "rentals" DROP COLUMN "returnedAt";
ALTER TABLE "rentals" DROP COLUMN "subtotalCents";
ALTER TABLE "rentals" DROP COLUMN "depositAmountCents";
ALTER TABLE "rentals" DROP COLUMN "totalAmountCents";

UPDATE "rentals"
SET "status" = CASE
  WHEN "status" = 'cancelled' THEN 'cancelled'
  WHEN "status" = 'returned' THEN 'closed'
  ELSE 'open'
END;
