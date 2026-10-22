-- CreateTable
CREATE TABLE "KioskState" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "look" JSONB,
    "seq" INTEGER NOT NULL DEFAULT 0,
    "cmds" JSONB NOT NULL DEFAULT '[]',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KioskState_pkey" PRIMARY KEY ("id")
);
