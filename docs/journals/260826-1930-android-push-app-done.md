---
date: 2026-08-26 19:30
session: android-push-app-implement
type: journal
tags: [implementation, android, capacitor, push-notification, fcm, auth, code-review]
status: implemented
---

# Journal: 2026-08-26 — Implement xong Android push app (4 phase)

## Context

Tiếp nối `260826-1757-plan-android-push-app.md` — plan 4 phase đã chốt xong
(`plans/260826-1757-android-push-app/plan.md`). Session này là session
implement thực tế, đi từ web MVP thuần tới app Android đóng gói qua
Capacitor có native Google Sign-In, camera quét QR check-in, và push
notification.

## What Happened

- Implement lần lượt Phase 1 → Phase 4 theo đúng thứ tự trong plan:
  - **Phase 1** — scaffold Capacitor, native Google Sign-In qua
    `@capacitor-community/generic-oauth2`/social-login plugin, thêm
    Credentials Provider mới `mobile-google` vào `auth.ts` để verify ID
    token server-side (né lỗi `disallowed_useragent` khi Google chặn OAuth
    trong embedded WebView). Tự phát hiện và tự sửa 1 lỗi phổ biến nhất khi
    tích hợp Google Credential Manager trước khi implement xong: audience
    JWT verify phải là **Web Client ID** (`AUTH_GOOGLE_ID` có sẵn), không
    phải Android Client ID riêng — nếu verify sai audience thì mọi ID token
    hợp lệ từ app đều bị reject.
  - **Phase 2** — camera quét QR check-in cho admin bằng
    `@capacitor-mlkit/barcode-scanning`, action mới `checkInByQrToken` mirror
    logic `checkInOrder` thủ công có sẵn.
  - **Phase 3** — push khi thanh toán thành công: bảng Prisma `DeviceToken`
    mới, migrate vào DB production qua quy trình pooler-safe (diff 2 file
    schema local, áp bằng `prisma db execute --url $DIRECT_URL` thay vì
    `prisma migrate deploy` qua pooler); `src/lib/firebase-admin.ts` — lazy
    singleton init, tự quyết định để tránh sập build khi chưa có
    `FIREBASE_SERVICE_ACCOUNT_JSON`; `src/lib/push.ts` dùng
    `sendEachForMulticast` batch 500 (không dùng `sendMulticast` đã bị xoá ở
    Admin SDK v13+); hook gửi push vào webhook SePay và `simulatePayment`.
  - **Phase 4** — admin broadcast push: trang `/admin/notifications`, tái
    dùng thẳng `sendPushToTokens` từ phase 3, không viết lại logic batch.
- Chạy 1 vòng code review (agent, không phải người): 8.5/10 NEEDS FIX, 3 vấn
  đề bắt buộc:
  1. `auth.ts` thiếu check `payload.email_verified` trong Credentials
     Provider `mobile-google` — rủi ro account-takeover vì provider tự
     resolve user theo email mà không xác nhận email đã verify.
  2. Action broadcast + UI admin không có try/catch/finally — nút "Đang
     gửi..." kẹt vĩnh viễn nếu action throw giữa chừng.
  3. `.env.example` thiếu doc cho biến mới `FIREBASE_SERVICE_ACCOUNT_JSON`.
  - Đã fix cả 3 + 2 cải thiện nhỏ: debounce chống quét QR trùng lặp liên
    tiếp, chuyển `SocialLogin.initialize()` vào `useEffect` (chạy 1 lần) thay
    vì gọi lại mỗi lần bấm nút đăng nhập.
  - Review lại: 9.6/10 AUTO-APPROVE.
- `tsc`/`eslint`/`build` pass toàn bộ cho cả 4 phase.

## Reflection

Việc tự bắt lỗi audience JWT (Web Client ID vs Android Client ID) trước khi
code chạy thử là nhờ đọc kỹ tài liệu Google Credential Manager ngay lúc
implement, không đợi đến review — nếu để review agent bắt thì đã là 1 bug
High riêng, thay vào đó review lần 1 chỉ còn bắt được 3 vấn đề thực sự cần
review (2 trong 3 là loại lỗi easy-to-miss khi code nhanh: thiếu 1 field
verify, thiếu try/finally ở 1 action mới). Việc đặt status plan là
"implemented" thay vì "completed" là quyết định đúng — success criteria cuối
cùng (quét QR thật, nhận push thật trên thiết bị Android thật) nằm ngoài khả
năng của agent (không có SDK/thiết bị), không nên tự nhận đã "completed" khi
chưa ai verify trên thiết bị thật.

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Audience verify JWT = Web Client ID (`AUTH_GOOGLE_ID`), không tạo audience riêng cho Android | Google Credential Manager ký ID token với audience là Web Client ID đã khai báo khi tạo Android OAuth Client, không phải Android Client ID | Tránh lỗi phổ biến nhất khi tích hợp — mọi ID token từ app sẽ bị reject nếu verify sai audience này |
| `firebase-admin` lazy singleton init trong `src/lib/firebase-admin.ts` | Tránh build/dev bị sập khi chưa có `FIREBASE_SERVICE_ACCOUNT_JSON` (biến do user tự cấu hình sau) | Build/deploy không phụ thuộc Firebase project đã tồn tại; push chỉ fail lúc gọi runtime, không fail lúc build |
| Migrate `DeviceToken` bằng `prisma db execute --url $DIRECT_URL` (diff schema thủ công) thay vì `migrate deploy` qua pooler | Pooler (PgBouncer) không hỗ trợ advisory lock mà Prisma Migrate cần | Migration áp vào DB production an toàn, không lỗi lock trên connection pooler |
| Đặt `plan.md` status = "implemented" (không phải "completed") | Success criteria cuối (quét QR thật, push thật) cần thiết bị Android thật để verify — agent không có SDK/device | Rõ ràng còn 1 bước verify thủ công của user trước khi coi plan thực sự xong |

## Next Steps

- User tự chuẩn bị và verify trên thiết bị thật (agent không làm được):
  tạo Firebase project, tải `google-services.json`, tạo service-account
  JSON → set `FIREBASE_SERVICE_ACCOUNT_JSON` trên Vercel, tạo Android OAuth
  Client ID (SHA-1 debug + release), build APK, cài lên máy thật.
- Test thật: đăng nhập Google trong app, quét QR check-in bằng camera, nhận
  push khi thanh toán thành công và khi admin broadcast.
- Sau khi test thật pass, cập nhật status `plan.md` từ "implemented" sang
  "completed".
- Repo hiện chưa phải git repository — user đã chọn "để sau" khi được hỏi có
  muốn `git init` + commit không; cân nhắc làm việc này trước khi build APK
  release để có lịch sử thay đổi.
