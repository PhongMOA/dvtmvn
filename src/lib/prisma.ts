import path from "node:path";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// `DATABASE_URL="file:./dev.db"` is written relative to `prisma/schema.prisma`
// (where `prisma migrate`/`db seed` resolve it from — landing on `prisma/dev.db`).
// The generated `prisma-client` client normally mirrors that by baking its schema
// directory in at generation time, but that breaks once Next.js/Turbopack bundles
// the client code into `.next/**` (its `import.meta.url`-based dirname points into
// the bundle instead). Re-resolve the same relative path ourselves against
// `<project root>/prisma` — stable regardless of bundling — so runtime always
// opens the exact file the CLI writes to.
function resolveDatasourceUrl(): string | undefined {
  const raw = process.env.DATABASE_URL;
  if (!raw?.startsWith("file:")) return raw;

  const relativePath = raw.slice("file:".length);
  const absolutePath = path.resolve(process.cwd(), "prisma", relativePath);
  return `file:${absolutePath}`;
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ datasourceUrl: resolveDatasourceUrl() });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
