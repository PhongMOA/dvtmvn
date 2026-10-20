import { spawn } from "node:child_process";
import { stagingUrl } from "./staging-db";

/**
 * Chạy `next dev` trên máy local nhưng trỏ DB STAGING thay vì `.env`.
 *
 * Next không ghi đè biến đã có sẵn trong process.env (kể cả chuỗi rỗng), nên
 * đặt trước ở đây là thắng giá trị trong `.env`. Các tích hợp gửi ra ngoài
 * (GHTK tạo đơn ship thật, push FCM, email Resend) bị tắt bằng chuỗi rỗng để
 * test local không đụng tới khách thật.
 *
 * Chạy: npx tsx scripts/staging/dev.ts
 */
const db = stagingUrl();

const child = spawn("npx", ["next", "dev"], {
  stdio: "inherit",
  shell: true,
  env: {
    ...process.env,
    DATABASE_URL: db,
    DIRECT_URL: db,
    GHTK_TOKEN: "",
    FIREBASE_SERVICE_ACCOUNT_JSON: "",
    RESEND_API_KEY: "",
    SEPAY_WEBHOOK_SECRET: "",
    ALLOW_SKIP_PAYMENT: "true",
  },
});
child.on("exit", (code) => process.exit(code ?? 0));
