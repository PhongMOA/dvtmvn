-- AlterTable
ALTER TABLE "Order" ADD COLUMN "upgradeFromOrderId" TEXT,
ADD COLUMN "upgradeFromItemId" TEXT;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN "upgradedQuantity" INTEGER NOT NULL DEFAULT 0;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_upgradeFromOrderId_fkey" FOREIGN KEY ("upgradeFromOrderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
