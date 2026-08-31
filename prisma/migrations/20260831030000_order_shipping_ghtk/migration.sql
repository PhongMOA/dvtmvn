-- AlterTable
ALTER TABLE "User" ADD COLUMN     "ward" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "ghtkError" TEXT,
ADD COLUMN     "ghtkLabel" TEXT,
ADD COLUMN     "ghtkStatus" TEXT,
ADD COLUMN     "ghtkStatusText" TEXT,
ADD COLUMN     "ghtkSyncedAt" TIMESTAMP(3),
ADD COLUMN     "ghtkTrackingId" TEXT,
ADD COLUMN     "shipAddress" TEXT,
ADD COLUMN     "shipDistrict" TEXT,
ADD COLUMN     "shipFee" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "shipName" TEXT,
ADD COLUMN     "shipPhone" TEXT,
ADD COLUMN     "shipProvince" TEXT,
ADD COLUMN     "shipWard" TEXT;

-- AlterTable
ALTER TABLE "ShopSetting" ADD COLUMN     "pickWard" TEXT NOT NULL DEFAULT '';
