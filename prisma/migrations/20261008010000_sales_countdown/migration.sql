-- AlterTable
ALTER TABLE "ShopSetting" ADD COLUMN "salesStartAt" TIMESTAMP(3) NOT NULL DEFAULT '2026-11-03 17:00:00'::timestamp,
ADD COLUMN "countdownTitle" TEXT NOT NULL DEFAULT 'Doomsday is coming';
