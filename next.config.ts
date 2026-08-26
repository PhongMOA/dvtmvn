import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next.js trace file đôi khi bỏ sót query engine binary của Prisma (output
  // path tuỳ chỉnh) khi đóng gói serverless function -> lỗi "could not locate
  // the Query Engine" lúc chạy trên Vercel dù đã prisma generate lúc build.
  outputFileTracingIncludes: {
    "/*": ["./src/generated/prisma/**/*"],
  },
};

export default nextConfig;
