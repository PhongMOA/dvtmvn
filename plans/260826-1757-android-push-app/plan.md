---
status: implemented
created: 2026-08-26
slug: android-push-app
blockedBy: []
blocks: []
mode: hard
scopeDecision: hold-scope
---

# Plan: App Android (Capacitor) + Push Notification cho MarvelVN

## Bối cảnh

MarvelVN hiện là 1 web MVP (Next.js 16 App Router, server-rendered, Prisma 6 +
Postgres, Auth.js v5 Google OAuth, SePay webhook) chạy tại
`https://dvtmvn.vercel.app`. User muốn thêm 1 bản Android **có tính năng
native thật** (không phải PWA/TWA thuần):

1. Đóng gói bằng Capacitor, WebView trỏ thẳng vào domain production.
2. Camera quét QR check-in cho admin (thay dần cách bấm tay hiện tại).
3. Push notification 2 chiều: (a) hệ thống tự bắn khi thanh toán thành công,
   (b) admin tự soạn nội dung và broadcast tới toàn bộ user đã cài app.

Kế thừa toàn bộ pattern hiện có: `requireAdmin()`/`requireUser()`
(`src/lib/auth-helpers.ts`), atomic `updateMany` chống race
(`src/lib/order-expiry.ts`, webhook SePay), không dùng cron (lazy pattern).

## Quyết định Scope (Scope Challenge — đã hỏi user)

Plan >8 file, >2 abstraction mới (Capacitor config, bảng `DeviceToken`, tích
hợp Firebase Admin SDK, native scan UI, admin broadcast UI), 4 phase tuần tự
→ đã trigger Scope Challenge. User chọn **HOLD SCOPE**:

- Giữ đúng 4 phase như yêu cầu gốc.
- **Bỏ ra khỏi plan này**: push "nhắc trước 15 phút hết hạn thanh toán" — cần
  dựng cơ chế lịch/cron hoàn toàn mới (app hiện không có cron), không phải
  chỉ thêm 1 tính năng nhỏ. Ghi nhận đây là **future plan riêng**, không phải
  một phần của phase 3.
- Phase 3 (push hệ thống) **chỉ** làm push "thanh toán thành công" — trigger
  tự nhiên từ webhook SePay có sẵn, không cần cron.

## Quyết định kiến trúc quan trọng (đã hỏi user)

**Google Sign-In trong Capacitor WebView bị chặn.** Research xác nhận: Google
trả lỗi `disallowed_useragent` (403) cho OAuth authorization endpoint khi user
agent là embedded WebView (chính sách từ 2/2023, xem
[Google Developers Blog](https://developers.googleblog.com/upcoming-security-changes-to-googles-oauth-20-authorization-endpoint-in-embedded-webviews/)).
Auth.js Google Provider hiện tại **không thể dùng nguyên xi** bên trong app
Android.

User chọn: **Native Google Sign-In + Auth.js Credentials Provider mới**
(thay vì Custom Tabs + App Links — phương án kia phức tạp hơn ở tầng native
và vẫn cần tự bắc cầu cookie thủ công). Chi tiết ở Phase 1.

## Tổng quan 4 Phase

| # | Phase | File | Test được độc lập? | Trạng thái |
|---|-------|------|---------------------|------------|
| 1 | Capacitor scaffold + đăng nhập native Google | [phase-01-capacitor-scaffold-auth.md](./phase-01-capacitor-scaffold-auth.md) | Có — mở app, thấy web, login thành công | Code xong, chờ user test thiết bị thật |
| 2 | Camera quét QR check-in cho admin | [phase-02-camera-checkin.md](./phase-02-camera-checkin.md) | Có — quét 1 QR, thấy order chuyển checked_in | Code xong, chờ user test thiết bị thật |
| 3 | Push hệ thống — thanh toán thành công | [phase-03-system-push-payment.md](./phase-03-system-push-payment.md) | Có — giả lập thanh toán, thấy push tới máy | Code xong, chờ Firebase project + test thiết bị thật |
| 4 | Push broadcast — admin soạn & gửi tất cả | [phase-04-admin-broadcast-push.md](./phase-04-admin-broadcast-push.md) | Có — admin bấm gửi, thấy push tới máy | Code xong, chờ test thiết bị thật |

Mỗi phase độc lập chạy/test được (YAGNI) — không phase nào bị block bởi phase
sau nó. Phase 3 và 4 cùng phụ thuộc bảng `DeviceToken` + `firebase-admin`
dựng ở Phase 3, nhưng Phase 4 không phụ thuộc logic nghiệp vụ của Phase 3.

## Trạng thái Implementation

Cả 4 phase đã được implement đầy đủ theo thiết kế (có điều chỉnh nhỏ so với
bản gốc, ghi chú "Khác với thiết kế ban đầu"/"phát hiện khi implement" trong
từng file phase vẫn được giữ nguyên làm tài liệu tham khảo).

- **Build/kiểm tra tĩnh**: `npx tsc --noEmit`, `eslint`, `npm run build` đều
  pass ở cả 4 phase (kể cả khi `FIREBASE_SERVICE_ACCOUNT_JSON` chưa được set,
  đúng thiết kế lazy-init của Phase 3).
- **Code review**: đã chạy review độc lập, kết quả **AUTO-APPROVE — 9.6/10,
  0 critical issue**.
- **Database**: migration bảng `DeviceToken` (Phase 3) đã áp vào DB
  production qua `prisma db execute` (bypass pooler treo lệnh
  `migrate deploy`, theo đúng ghi chú có sẵn trong `schema.prisma`).
- **Todo Checklist** mỗi phase: mọi mục agent tự làm được đã đánh `[x]`; chỉ
  còn các mục đánh dấu `(User)` — những việc chỉ user tự làm được — vẫn để
  `[ ]`.
- **Success Criteria** mỗi phase: vẫn để nguyên `[ ]` vì chưa ai test thực tế
  trên thiết bị Android — mỗi file đã thêm 1 ghi chú ngay dưới mục này xác
  nhận code đã implement, chờ user test thiết bị thật.

### Việc còn lại — CHỈ user tự làm được

1. Tạo **Firebase project** mới tại console.firebase.google.com (Phase 3).
2. Trong Firebase project, thêm Android app (package `vn.marvelvn.app`), tải
   `google-services.json` → đặt vào `android/app/` (Phase 3).
3. Project Settings → Service Accounts → tạo service-account JSON → set
   (base64) vào biến môi trường `FIREBASE_SERVICE_ACCOUNT_JSON` trên Vercel
   (Phase 3).
4. Thêm Google Services Gradle plugin vào `android/build.gradle` +
   `android/app/build.gradle` (Phase 3).
5. Tạo **Android OAuth Client ID** mới tại Google Cloud Console (loại
   Android) + đăng ký **cả 2 SHA-1** (debug và release keystore) (Phase 1).
6. Set biến môi trường `NEXT_PUBLIC_AUTH_GOOGLE_ID` trên Vercel — copy y hệt
   giá trị `AUTH_GOOGLE_ID` hiện có (Phase 1).
7. Mở `android/` bằng Android Studio, build debug APK (và sau này release
   APK/AAB), cài lên thiết bị thật.
8. Test thực tế trên thiết bị Android cho cả 4 phase: đăng nhập Google
   (Phase 1), quét QR check-in bằng camera (Phase 2), nhận push khi thanh
   toán thành công (Phase 3), nhận push broadcast từ admin (Phase 4).

## Ngoài phạm vi plan này (explicit out-of-scope)

- Push "nhắc trước hết hạn thanh toán" (cần cơ chế cron mới — future plan).
- Đăng iOS app (chỉ Android).
- Nộp chính thức lên Google Play Store (tài khoản Developer $25, review,
  Data Safety form, Content Rating...) — có ghi checklist tham khảo cuối
  Phase 4 nhưng không phải trọng tâm kỹ thuật, không hydrate thành task.
- Đổi Auth.js Google Provider hiện tại trên web thường (browser) — vẫn giữ
  nguyên, chỉ thêm 1 Credentials Provider mới riêng cho app native.

## Ràng buộc môi trường (áp dụng toàn bộ 4 phase)

- Máy dev hiện tại (Windows, Claude Code) **không có Android Studio/Android
  SDK** → agent chỉ làm được phần code/scaffold (npm install, sinh file
  `android/` qua `npx cap add android`, sửa code). **Mọi bước mở Android
  Studio, build APK/AAB, cài lên thiết bị, cấp quyền camera/notification
  runtime, test thực tế → user tự làm trên máy có SDK.** Mỗi phase file có
  mục "Việc user phải tự làm" tách riêng.
- Cần **Firebase project riêng** (tài khoản Google của user) cho Phase 3+4 —
  agent không tự tạo được, user tự tạo tại console.firebase.google.com rồi
  cung cấp `google-services.json` + service-account JSON.
- Cần **1 Android OAuth Client ID mới** (loại "Android", kèm SHA-1
  fingerprint) trong cùng Google Cloud project đang dùng cho
  `AUTH_GOOGLE_ID` — khác với client "Web application" hiện tại. User tự tạo
  tại Google Cloud Console → Credentials.
- Cần thiết bị/emulator Android thật để test camera (Phase 2) và nhận push
  (Phase 3, 4) — không test qua browser được.

## Success Criteria tổng thể

- [ ] App Android build được (debug APK), mở lên load đúng
      `https://dvtmvn.vercel.app`, đăng nhập Google thành công, session giữ
      nguyên qua các lần mở lại app.
- [ ] Admin quét được QR thật của 1 order đã "paid", order chuyển
      `checked_in`, UI báo kết quả rõ ràng (tên combo, trạng thái).
- [ ] Giả lập 1 đơn chuyển "paid" (dùng nút giả lập admin có sẵn hoặc webhook
      test) → thiết bị đã đăng nhập nhận được push OS thật kể cả khi app
      đóng.
- [ ] Admin vào trang broadcast mới, soạn 1 thông báo, gửi → mọi thiết bị đã
      đăng ký token nhận được push.

## Dependencies giữa các file plan khác

Không có plan nào khác đang active bị ảnh hưởng.
`plans/260825-2045-movie-ticket-mvp/` là plan MVP gốc, đã triển khai xong
trong thực tế (dù frontmatter còn ghi `in-progress`) — không tạo quan hệ
block với plan này vì khác phạm vi hoàn toàn (Android/push vs web MVP gốc).
