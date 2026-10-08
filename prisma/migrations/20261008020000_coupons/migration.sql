-- AlterTable
ALTER TABLE "User" ADD COLUMN "coupons" JSONB;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "coupon" JSONB,
ADD COLUMN "discountAmount" INTEGER NOT NULL DEFAULT 0;
