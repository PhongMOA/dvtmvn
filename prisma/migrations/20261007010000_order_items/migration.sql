-- Giỏ hàng: 1 đơn gồm nhiều dòng combo.
-- KHÔNG drop Order.comboTypeId/quantity ngay — chỉ bỏ NOT NULL để bản deploy cũ
-- vẫn chạy trong lúc chuyển đổi. Drop ở migration sau khi bản mới đã ổn định.

-- CreateTable
CREATE TABLE IF NOT EXISTS "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "comboTypeId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" INTEGER NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "OrderItem_orderId_idx" ON "OrderItem"("orderId");
CREATE INDEX IF NOT EXISTS "OrderItem_comboTypeId_idx" ON "OrderItem"("comboTypeId");

ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_comboTypeId_fkey" FOREIGN KEY ("comboTypeId") REFERENCES "ComboType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Cột cũ thành nullable (đơn mới không ghi nữa)
ALTER TABLE "Order" ALTER COLUMN "comboTypeId" DROP NOT NULL;
ALTER TABLE "Order" ALTER COLUMN "quantity" DROP NOT NULL;

-- Backfill: mỗi đơn cũ -> 1 OrderItem, unitPrice = giá combo hiện tại
INSERT INTO "OrderItem" ("id", "orderId", "comboTypeId", "quantity", "unitPrice")
SELECT gen_random_uuid()::text, o."id", o."comboTypeId", o."quantity", c."price"
FROM "Order" o
JOIN "ComboType" c ON c."id" = o."comboTypeId"
WHERE o."comboTypeId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "OrderItem" i WHERE i."orderId" = o."id");
