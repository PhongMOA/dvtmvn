# Phase 3: Push Hệ Thống — Thanh Toán Thành Công

Context: [plan.md](./plan.md). Độc lập với Phase 2, nhưng cần app đã đăng
nhập được từ [phase-01-capacitor-scaffold-auth.md](./phase-01-capacitor-scaffold-auth.md).
Phase 4 sẽ tái dùng hạ tầng (`DeviceToken`, `firebase-admin`) dựng ở đây.

## Mục tiêu

Khi 1 order chuyển `paymentStatus: "paid"` (qua webhook SePay có sẵn, hoặc
qua nút "Giả lập thanh toán" admin có sẵn), user sở hữu order đó nhận được 1
push OS thật trên điện thoại — kể cả khi app đang đóng.

## Vì sao KHÔNG làm "nhắc trước 15 phút hết hạn" ở phase này

Đã chốt ở Scope Challenge (xem [plan.md](./plan.md)): push này cần 1 job
chạy proactive theo thời gian, nhưng app hiện **không có cron nào**, chỉ có
lazy-expiry (chạy khi có request tới). Dựng cơ chế lịch mới là 1 quyết định
kiến trúc riêng (Vercel Cron? QStash? Trigger.dev?) xứng đáng 1 plan/phase
riêng, không nhét vào đây theo kiểu tiện tay.

## Việc user phải tự làm (bắt buộc trước khi code chạy được)

1. Tạo **1 Firebase project mới** tại console.firebase.google.com (tài khoản
   Google của user — agent không tự động hoá được bước này).
2. Trong Firebase project, thêm 1 Android app (package name
   `vn.marvelvn.app`) → tải `google-services.json` → đặt vào `android/app/`.
3. Project Settings → Service Accounts → Generate new private key → tải file
   JSON service-account → **không commit vào git**. Set nội dung file này
   (hoặc các field `project_id`/`client_email`/`private_key`) vào biến môi
   trường Vercel mới, ví dụ `FIREBASE_SERVICE_ACCOUNT_JSON` (base64-encode
   cả file để tránh vấn đề xuống dòng trong `private_key` khi dán vào env
   var trên Vercel dashboard).
4. Thêm Google Services Gradle plugin: classpath ở `android/build.gradle`,
   apply ở `android/app/build.gradle` (theo hướng dẫn hiện ngay trong
   Firebase Console khi add Android app — chỉ vài dòng, làm theo UI).

## Data model mới

```prisma
model DeviceToken {
  id         String   @id @default(uuid())
  token      String   @unique
  userId     String
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  platform   String   @default("android") // "android" | "web" (mở rộng web-push sau nếu cần)
  createdAt  DateTime @default(now())
  lastSeenAt DateTime @updatedAt

  @@index([userId])
}
```

Unique trên `token` (không phải `userId`) vì 1 user có nhiều thiết bị. Thêm
`orders DeviceToken[]` — không, thêm quan hệ ngược `deviceTokens
DeviceToken[]` vào `model User` hiện có.

Áp schema production theo đúng ghi chú có sẵn trong `schema.prisma` (Supabase
pooler treo lệnh `migrate deploy`):
```bash
npx prisma migrate diff --from-schema-datamodel prisma/schema.prisma \
  --to-schema-datamodel prisma/schema.prisma --script > migration.sql
# (hoặc --from-empty nếu diff riêng bảng mới)
npx prisma db execute --file migration.sql --url $DIRECT_URL
```

## Các bước implementation

1. `npm install firebase-admin`.
2. `src/lib/firebase-admin.ts` — singleton init (bắt buộc, vì serverless
   function instance có thể tái sử dụng giữa các invocation):
   ```ts
   import { getApps, initializeApp, cert } from "firebase-admin/app";
   import { getMessaging } from "firebase-admin/messaging";

   const serviceAccount = JSON.parse(
     Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_JSON!, "base64").toString("utf-8"),
   );

   const app = getApps()[0] ?? initializeApp({ credential: cert(serviceAccount) });
   export const messaging = getMessaging(app);
   ```
   **Khác với thiết kế ban đầu**: init không nằm ở top-level module (`const app = ...`)
   mà bọc trong hàm `getFirebaseMessaging()` — top-level throw sẽ làm sập cả
   `npm run build`/mọi route import module này (kể cả gián tiếp qua `push.ts`)
   ngay khi `FIREBASE_SERVICE_ACCOUNT_JSON` chưa được set (đúng tình trạng môi
   trường hiện tại, chưa tạo Firebase project). Lỗi thiếu env chỉ nên nổ ra lúc
   thực sự gửi push — nơi đã có try/catch bọc sẵn ở webhook/`simulatePayment`.
3. `src/lib/push.ts` — hàm dùng chung cho cả Phase 3 và Phase 4:
   ```ts
   import { messaging } from "@/lib/firebase-admin";
   import { prisma } from "@/lib/prisma";

   const MAX_TOKENS_PER_CALL = 500; // giới hạn cứng của sendEachForMulticast

   export async function sendPushToTokens(
     tokens: string[],
     notification: { title: string; body: string },
   ): Promise<{ sent: number; removed: number }> {
     let sent = 0;
     const deadTokens: string[] = [];

     for (let i = 0; i < tokens.length; i += MAX_TOKENS_PER_CALL) {
       const chunk = tokens.slice(i, i + MAX_TOKENS_PER_CALL);
       const res = await messaging.sendEachForMulticast({ tokens: chunk, notification });
       res.responses.forEach((r, idx) => {
         if (r.success) {
           sent++;
         } else if (r.error?.code === "messaging/registration-token-not-registered") {
           deadTokens.push(chunk[idx]);
         }
       });
     }

     if (deadTokens.length > 0) {
       await prisma.deviceToken.deleteMany({ where: { token: { in: deadTokens } } });
     }
     return { sent, removed: deadTokens.length };
   }
   ```
   Dùng `sendEachForMulticast()` — **không dùng `sendMulticast()`** (đã bị
   xoá khỏi Admin SDK v13+, xem
   [firebase.google.com/docs/cloud-messaging/send/admin-sdk](https://firebase.google.com/docs/cloud-messaging/send/admin-sdk)).
4. Server action đăng ký token — `src/app/actions/device-tokens.ts`:
   ```ts
   "use server";
   export async function registerDeviceToken(token: string) {
     const user = await requireUser();
     await prisma.deviceToken.upsert({
       where: { token },
       update: { userId: user.id, lastSeenAt: new Date() },
       create: { token, userId: user.id, platform: "android" },
     });
   }
   ```
5. Client (chỉ chạy khi native) — component `PushRegistrar`
   (`src/components/push-registrar.tsx`), mount ở `src/app/layout.tsx` (root
   layout, chạy trên mọi trang). **Khác thiết kế ban đầu**: không gắn vào lúc
   bấm nút đăng nhập (`sign-in-button.tsx`) mà chạy mỗi lần app mở — để cả
   trường hợp user đã đăng nhập từ phiên trước (cookie session Auth.js còn
   hiệu lực khi mở lại app) cũng được đăng ký token, không chỉ ngay sau lúc
   login. `registerDeviceToken()` tự throw `UNAUTHORIZED` nếu chưa đăng nhập —
   nuốt lỗi lặng lẽ (`.catch(() => {})`) vì không có UI nào cần biết chuyện
   này thất bại. Dùng `useIsNativeApp()` (hook có sẵn từ Phase 1/2) để no-op
   trên web.
   `npm install @capacitor/push-notifications` trước, `npx cap sync android`.
   Android 13+ tự xin quyền `POST_NOTIFICATIONS` qua API này, không cần sửa
   AndroidManifest tay.
6. Hook vào webhook SePay có sẵn (`src/app/api/webhooks/sepay/route.ts`) —
   thêm ngay sau đoạn `updateMany(...paymentStatus: "paid"...)` thành công
   (`count === 1`):
   ```ts
   if (count === 1) {
     await prisma.sepayTransaction.update({ where: { id: transactionId }, data: { orderId: order.id } });

     // Best-effort: không để lỗi push làm hỏng response webhook (SePay sẽ
     // retry nếu response không phải 200 — không liên quan gì tới push).
     try {
       const tokens = await prisma.deviceToken.findMany({
         where: { userId: order.userId },
         select: { token: true },
       });
       if (tokens.length > 0) {
         await sendPushToTokens(tokens.map((t) => t.token), {
           title: "Thanh toán thành công",
           body: `${order.comboType.name} × ${order.quantity} đã sẵn sàng — xem vé trong "Vé của tôi".`,
         });
       }
     } catch (err) {
       console.error("Push thanh toán thất bại (không ảnh hưởng webhook):", err);
     }
   }
   ```
   Cũng thêm y hệt vào `simulatePayment` (`src/app/actions/order-status.ts`)
   ở đúng nhánh `count === 1` — để nút giả lập admin dùng để test push mà
   không cần chờ giao dịch ngân hàng thật. (`simulatePayment` vốn không
   include `comboType` trong query `findUnique` ban đầu — đã thêm
   `include: { comboType: true }` để có tên combo cho nội dung push.)

## Rủi ro

- Serverless (Vercel) có cold start — singleton `firebase-admin` qua
  `getApps()` bắt buộc, thiếu bước này sẽ lỗi "app already exists" khi
  function instance được tái sử dụng.
- `FIREBASE_SERVICE_ACCOUNT_JSON` là secret nhạy cảm (private key) — chỉ đặt
  trên Vercel env var, không log ra console, không commit.
- Nếu user gỡ cài đặt app hoặc token hết hạn tự nhiên (không qua lỗi rõ
  ràng), token có thể "chết âm thầm" — record vẫn còn trong DB tới khi lần
  gửi kế tiếp trả lỗi `registration-token-not-registered` mới bị xoá (chấp
  nhận được, không cần dọn định kỳ thêm cho MVP — YAGNI).

## Todo Checklist

- [ ] (User) Tạo Firebase project + tải `google-services.json` + service
      account JSON
- [x] Thêm model `DeviceToken` vào `schema.prisma`, áp bằng `db execute`
      (diff giữa 2 file schema local, áp qua `DIRECT_URL` — không qua schema
      engine nên không bị treo pooler; `npx prisma generate` xong)
- [x] `npm install firebase-admin @capacitor/push-notifications`
- [x] `src/lib/firebase-admin.ts` (lazy init qua `getFirebaseMessaging()`,
      xem ghi chú "Khác với thiết kế ban đầu" ở trên), `src/lib/push.ts`
- [x] `src/app/actions/device-tokens.ts` (`registerDeviceToken`)
- [x] Client: `src/components/push-registrar.tsx`, mount ở
      `src/app/layout.tsx` — xin quyền + register push mỗi lần mở app
      native (không chỉ ngay sau login, xem ghi chú ở trên)
- [x] Hook push vào webhook SePay (`src/app/api/webhooks/sepay/route.ts`) +
      `simulatePayment` (`src/app/actions/order-status.ts`)
- [x] `npx cap sync android` (3 plugin: barcode-scanning, push-notifications,
      social-login), `npx tsc --noEmit`/`eslint`/`npm run build` đều pass
      (build pass ngay cả khi chưa set `FIREBASE_SERVICE_ACCOUNT_JSON`, đúng
      mục đích thiết kế lazy-init)
- [ ] (User) Set `FIREBASE_SERVICE_ACCOUNT_JSON` trên Vercel

## Success Criteria

- [ ] Cài app, đăng nhập → thấy 1 record `DeviceToken` mới trong DB đúng
      `userId`.
- [ ] Đóng app hẳn (không chạy nền), dùng nút "Giả lập thanh toán" (admin)
      cho 1 order của user đó → điện thoại nhận được push OS thật trong vài
      giây.

> Code đã implement đầy đủ (xem Todo Checklist ở trên, tsc/eslint/build đều
> pass kể cả khi chưa set `FIREBASE_SERVICE_ACCOUNT_JSON`), chờ user tạo
> Firebase project, set env trên Vercel, và test nhận push thật trên thiết
> bị Android để xác nhận các mục Success Criteria trên.
