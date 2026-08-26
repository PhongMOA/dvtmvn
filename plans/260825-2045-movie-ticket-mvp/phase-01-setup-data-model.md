# Phase 1: Project Setup & Data Model

## Context Links
- [plan.md](./plan.md)
- [brainstorm-summary.md](./brainstorm-summary.md)

## Overview
- Priority: P1 (nền tảng cho mọi phase sau)
- Status: Pending
- Scaffold Next.js 16 project, cấu hình Prisma 7 + SQLite, Tailwind + shadcn/ui, định nghĩa schema, viết seed script.

## Key Insights (từ research)
- Prisma 7 **bắt buộc** `output` path trong generator block — không còn magic-generate vào `node_modules/@prisma/client`. Phải import PrismaClient từ path custom.
- SQLite phù hợp local/demo (đã chốt trong brainstorm), không cần Postgres cho MVP này.

## Requirements
- Functional: schema đủ field cho User/Event/Ticket như brainstorm-summary mô tả; seed 1 admin user (theo `ADMIN_EMAIL`) + 1 event mẫu ở trạng thái `draft`.
- Non-functional: `npx prisma studio` mở được để admin dev tự xem data khi cần debug.

## Architecture
```
myapp/
├── prisma/
│   └── schema.prisma
├── src/
│   ├── generated/prisma/        # Prisma Client output (gitignore)
│   ├── lib/
│   │   └── prisma.ts            # PrismaClient singleton (tránh multi-instance dev hot-reload)
│   └── app/                     # Next.js App Router pages (phase sau)
├── .env                          # DATABASE_URL, ADMIN_EMAIL, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET
└── .env.example
```

### schema.prisma (nội dung tham khảo)
```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(uuid())
  email     String   @unique
  name      String?
  image     String?
  createdAt DateTime @default(now())
  tickets   Ticket[]
  // NextAuth Prisma adapter cần thêm Account/Session models — xem phase-02
}

model Event {
  id              String   @id @default(uuid())
  title           String
  description     String?
  posterUrl       String?
  venue           String
  startAt         DateTime
  totalSeats      Int
  remainingSeats  Int
  price           Int       // VND, hiển thị thông tin — không xử lý thanh toán online
  status          String    @default("draft") // draft | open | closed
  createdAt       DateTime  @default(now())
  tickets         Ticket[]
}

model Ticket {
  id         String   @id @default(uuid())
  eventId    String
  userId     String
  quantity   Int
  qrToken    String   @unique @default(uuid())
  status     String   @default("booked") // booked | checked_in
  createdAt  DateTime @default(now())
  event      Event    @relation(fields: [eventId], references: [id])
  user       User     @relation(fields: [userId], references: [id])
}
```
Lưu ý: Account/Session/VerificationToken models cho Auth.js Prisma adapter sẽ thêm ở Phase 2 (tránh làm phase này phình to, nhưng ghi chú trước để không quên).

## Related Code Files
**Create:**
- `package.json`, `next.config.ts`, `tsconfig.json` (từ `create-next-app`)
- `prisma/schema.prisma`
- `src/lib/prisma.ts`
- `prisma/seed.ts`
- `.env.example`
- `.gitignore` (thêm `src/generated/`, `.env`, `dev.db`)

## Implementation Steps
1. `npx create-next-app@latest . --typescript --tailwind --app --no-src-dir=false` (đặt tên project, chọn App Router, Tailwind, src/ dir).
2. `npm install prisma --save-dev` + `npm install @prisma/client` (hoặc theo package name của `prisma-client` generator hiện tại — kiểm tra `npx prisma init` output).
3. `npx prisma init --datasource-provider sqlite`.
4. Sửa `prisma/schema.prisma` theo nội dung tham khảo trên (generator dùng `prisma-client` + `output`).
5. Tạo `.env`: `DATABASE_URL="file:./dev.db"`, `ADMIN_EMAIL="<email admin>"` (placeholder, điền thật ở phase 2).
6. `npx prisma migrate dev --name init` để tạo migration + generate client vào `src/generated/prisma`.
7. Viết `src/lib/prisma.ts` — PrismaClient singleton pattern chuẩn Next.js (tránh exhaust connections khi hot-reload dev):
   ```ts
   import { PrismaClient } from "@/generated/prisma";
   const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
   export const prisma = globalForPrisma.prisma ?? new PrismaClient();
   if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
   ```
8. Viết `prisma/seed.ts`: tạo 1 User admin (email = `process.env.ADMIN_EMAIL`), 1 Event mẫu status `draft`. Thêm `"prisma": {"seed": "tsx prisma/seed.ts"}` vào `package.json`, cài `tsx` nếu cần.
9. `npx prisma db seed` — verify data qua `npx prisma studio`.
10. Cài Tailwind (đã có từ create-next-app) + init shadcn/ui: `npx shadcn@latest init`.
11. Cài `qrcode` + `@types/qrcode`: `npm install qrcode` `npm install -D @types/qrcode` (dùng ở phase 3, cài trước cho gọn).
12. Update `.gitignore`: thêm `src/generated/`, `*.db`, `.env`.

## Todo List
- [x] Scaffold Next.js 16 project (TypeScript, App Router, Tailwind, src/ dir)
- [x] Cài & init Prisma với SQLite, generator `prisma-client` + custom output (**đã đổi sang Prisma 6.19.3** — xem Risk Assessment: Node local là v22.11.0, Prisma 7 yêu cầu ^22.12+, không cài được. v6.19.3 đã dùng sẵn generator `prisma-client` + custom output + `prisma.config.ts`, hành vi giống hệt phần đã research cho v7)
- [x] Viết schema User/Event/Ticket
- [x] Migrate + generate client
- [x] PrismaClient singleton tại `src/lib/prisma.ts`
- [x] Seed script (admin user + event mẫu draft — đổi thành "Avengers: Doomsday" theo yêu cầu bổ sung của user)
- [x] Init shadcn/ui + thêm components (input, textarea, label, card, badge, table, sonner, separator) + theme màu Avengers (đen/đỏ/vàng) trong `globals.css` + font `Bebas Neue` cho heading
- [x] Cài `qrcode`
- [x] `.env.example` + `.gitignore` đầy đủ (đã fix `.env*` ignore để không nuốt luôn `.env.example`)

**Build check:** `npm run build` thành công (Next.js 16.3.3, Turbopack).

## Success Criteria
- `npx prisma studio` mở, thấy đúng 3 bảng User/Event/Ticket + data seed.
- `npm run dev` chạy được, trang mặc định Next.js hiện ra không lỗi.
- Import `PrismaClient` từ `src/generated/prisma` không lỗi type.

## Risk Assessment
- **Rủi ro:** Prisma 7 generator/package name có thể khác nhẹ so với research (docs đổi nhanh) → khi chạy `npx prisma init`, đọc kỹ output CLI để lấy đúng tên generator/package thay vì copy y nguyên đoạn tham khảo trên.
- **Mitigation:** Nếu `prisma-client` generator lỗi, fallback dùng generator `prisma-client-js` cũ (vẫn hoạt động ở v7 dù deprecated) để không block tiến độ, note lại để nâng cấp sau.

## Security Considerations
- `.env` không commit — verify `.gitignore` trước khi commit đầu tiên.
- `DATABASE_URL` trỏ file local, không expose ra client bundle (chỉ dùng trong server code / `src/lib/prisma.ts`).

## Next Steps
- Phase 2: thêm Account/Session models cho Auth.js, config Google OAuth.
