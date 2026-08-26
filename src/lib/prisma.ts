import fs from "node:fs";
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

// Cùng một căn bệnh bundling như trên, nhưng lần này với chính query engine
// binary (.so.node/.dll.node) chứ không phải file SQLite: client bị Next.js
// gộp vào 1 chunk trong `.next/server/chunks/...`, nên logic tự dò engine dựa
// trên dirname của Prisma trỏ nhầm vào trong bundle -> lỗi "could not locate
// the Query Engine for runtime rhel-openssl-3.0.x" trên Vercel dù file engine
// vẫn nằm đúng chỗ trên đĩa (outputFileTracingIncludes đã đảm bảo điều đó).
// Fix: trỏ thẳng Prisma vào đúng file bằng biến môi trường chính thức
// `PRISMA_QUERY_ENGINE_LIBRARY`, tự tính đường dẫn qua `process.cwd()` (ổn
// định, không phụ thuộc bundling) thay vì để Prisma tự dò.
function resolveQueryEngineLibraryPath(): string | undefined {
  if (process.env.PRISMA_QUERY_ENGINE_LIBRARY) {
    return process.env.PRISMA_QUERY_ENGINE_LIBRARY;
  }
  const filename =
    process.platform === "win32"
      ? "query_engine-windows.dll.node"
      : "libquery_engine-rhel-openssl-3.0.x.so.node";
  const enginePath = path.resolve(
    process.cwd(),
    "src/generated/prisma",
    filename,
  );
  return fs.existsSync(enginePath) ? enginePath : undefined;
}

const queryEngineLibraryPath = resolveQueryEngineLibraryPath();
if (queryEngineLibraryPath) {
  process.env.PRISMA_QUERY_ENGINE_LIBRARY = queryEngineLibraryPath;
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ datasourceUrl: resolveDatasourceUrl() });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
