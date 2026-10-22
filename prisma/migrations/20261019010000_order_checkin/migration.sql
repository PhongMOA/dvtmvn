-- AlterTable
ALTER TABLE "Order" ADD COLUMN "checkedInAt" TIMESTAMP(3),
ADD COLUMN "checkedInBy" TEXT,
ADD COLUMN "checkedInVia" TEXT;
