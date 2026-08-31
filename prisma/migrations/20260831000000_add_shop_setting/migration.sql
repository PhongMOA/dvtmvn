-- CreateTable
CREATE TABLE "ShopSetting" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "pickName" TEXT NOT NULL DEFAULT '',
    "pickTel" TEXT NOT NULL DEFAULT '',
    "pickAddress" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopSetting_pkey" PRIMARY KEY ("id")
);
