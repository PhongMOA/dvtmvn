-- AlterTable
ALTER TABLE "ComboType" ADD COLUMN "includesShirt" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN "shirtSizes" JSONB;
