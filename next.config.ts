import { execSync } from "node:child_process";
import type { NextConfig } from "next";

// Mã bản build = commit SHA rút gọn. Vercel (staging) có sẵn biến
// VERCEL_GIT_COMMIT_SHA; VPS (production) deploy từ git checkout nên đọc được
// `git rev-parse`. Không có git thì dùng thời điểm build.
// Client so mã này với /api/version để biết đã có bản mới
// (src/components/update-watcher.tsx).
function buildId(): string {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA;
  if (sha) return sha.slice(0, 7);
  try {
    return execSync("git rev-parse --short=7 HEAD", { encoding: "utf8" }).trim();
  } catch {
    return `t${Date.now().toString(36)}`;
  }
}

const BUILD_ID = buildId();

const nextConfig: NextConfig = {
  // Next.js trace file đôi khi bỏ sót query engine binary của Prisma (output
  // path tuỳ chỉnh) khi đóng gói serverless function -> lỗi "could not locate
  // the Query Engine" lúc chạy trên Vercel dù đã prisma generate lúc build.
  outputFileTracingIncludes: {
    "/*": ["./src/generated/prisma/**/*"],
  },
  // Inline lúc build vào cả bundle server lẫn client: server trả mã của bản
  // đang chạy, client giữ mã của bản nó được tải về — lệch nhau = có bản mới.
  env: {
    NEXT_PUBLIC_BUILD_ID: BUILD_ID,
    NEXT_PUBLIC_BUILT_AT: new Date().toISOString(),
  },
  // Skew protection có sẵn của Next: client bản cũ chuyển trang sang server
  // bản mới thì Next tự reload toàn trang thay vì lỗi chunk/Server Action.
  // Trên Vercel để Vercel tự quản lý deployment ID của nó.
  ...(!process.env.VERCEL && { deploymentId: BUILD_ID }),
};

export default nextConfig;
