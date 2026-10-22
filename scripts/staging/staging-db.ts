import { config } from "dotenv";
import { PrismaClient } from "../../src/generated/prisma/client";

/**
 * Kết nối DB STAGING (Supabase cũ, dùng cho https://dvtmarvelvn.8ternal.com).
 *
 * Chỉ đọc STAGING_DATABASE_URL trong `.env.staging` — KHÔNG BAO GIỜ đọc `.env`
 * (`.env` trỏ DB production / bản sao của nó). Chốt chặn cứng theo host: sai
 * project Supabase là dừng, để script xoá/seed không thể chạm nhầm production
 * (14/10/2026 từng reset nhầm DB vì tin vào `.env`).
 */
const STAGING_REF = "xexmiimkzzgrzqvtqmqs";

// Chấp nhận 2 dạng URL của đúng project Supabase staging:
// - direct: db.<ref>.supabase.co (chỉ IPv6 — máy dev không có IPv6 thì không tới được)
// - Session pooler (IPv4): *.pooler.supabase.com, user "postgres.<ref>"
function isStagingUrl(url: URL): boolean {
  if (url.hostname === `db.${STAGING_REF}.supabase.co`) return true;
  return (
    url.hostname.endsWith(".pooler.supabase.com") &&
    decodeURIComponent(url.username) === `postgres.${STAGING_REF}`
  );
}

export function stagingUrl(): string {
  config({ path: ".env.staging", override: true, quiet: true });
  const raw = process.env.STAGING_DATABASE_URL;
  if (!raw) throw new Error("Thiếu STAGING_DATABASE_URL trong .env.staging");
  const url = new URL(raw);
  if (!isStagingUrl(url)) {
    throw new Error(`"${url.hostname}" không phải DB staging (project ${STAGING_REF}) — dừng.`);
  }
  return raw;
}

export function stagingPrisma(): PrismaClient {
  return new PrismaClient({ datasourceUrl: stagingUrl() });
}
