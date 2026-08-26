# MarvelVN — Đặt combo sự kiện chiếu phim offline

Web đặt combo (vé + merchandise) cho 1 sự kiện chiếu phim offline: đăng nhập Google, chọn combo, quét VietQR chuyển khoản, hệ thống tự xác nhận qua webhook SePay, nhận QR check-in tại "Vé của tôi". Admin quản lý event/combo và check-in thủ công.

Đang chạy tại: https://dvtmvn.vercel.app

## Stack

Next.js 16 (App Router) · Prisma 6 + Postgres (Supabase) · Auth.js v5 (Google OAuth) · Tailwind v4 + shadcn · SePay (VietQR + webhook HMAC-SHA256)

## Setup

```bash
npm install
cp .env.example .env   # điền các biến, xem chú thích trong file
npx prisma db push     # hoặc prisma migrate diff + db execute, xem ghi chú trong schema.prisma
npx tsx prisma/seed.ts
npm run dev
```

Biến môi trường cần điền trong `.env`: `DATABASE_URL`/`DIRECT_URL` (Postgres), `ADMIN_EMAIL`, `AUTH_SECRET`, `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET`, `SEPAY_BANK_ACCOUNT_NUMBER`/`SEPAY_BANK_NAME`/`SEPAY_WEBHOOK_SECRET`.

## Cấu trúc chính

```
prisma/schema.prisma           # User, Event, ComboType, Order, SepayTransaction
src/lib/order-expiry.ts        # Hoàn kho khi đơn quá hạn thanh toán (lazy, không cron)
src/lib/sepay.ts               # Tạo mã đơn, dựng URL VietQR
src/app/page.tsx               # Trang chủ = event đang "open"
src/app/orders/[id]/pay/       # Màn QR chờ thanh toán
src/app/api/webhooks/sepay/    # Webhook nhận xác nhận chuyển khoản
src/app/my-tickets/            # Vé của tôi + QR check-in
src/app/admin/                 # CRUD event/combo, xem đơn, check-in
```

## Giới hạn MVP

Chọn ghế, quét QR check-in bằng camera, nhiều admin/phân quyền, giới hạn combo/user.
