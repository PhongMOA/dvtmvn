---
date: 2026-08-26 17:57
session: plan-android-push-app
type: journal
tags: [planning, android, capacitor, push-notification, fcm, auth]
status: plan-complete
---

# Journal: 2026-08-26 — Lập plan app Android (Capacitor) + push notification

## Context

Session tiếp nối work web MVP đã chạy production (`dvtmvn.vercel.app`, xem
`260825-2350-implement-mvp-booking-app.md`), sau các fix nhỏ (nút "Giả lập
thanh toán" admin-only, favicon mới, title trang chủ). User muốn mở rộng
thêm 1 bản Android **có native feature thật** (camera quét QR, push) chứ
không phải PWA/TWA thuần — chọn qua `AskUserQuestion`. Session này chạy
`/ck:plan --hard` để lập plan chi tiết trước khi code.

## What Happened

- **Scope Challenge**: plan chạm >8 file, >2 abstraction mới, 4 phase tuần
  tự → trigger đúng ngưỡng. User chọn **HOLD SCOPE** — giữ 4 phase gốc
  nhưng cắt bỏ hẳn "push nhắc trước 15 phút hết hạn thanh toán" ra khỏi plan
  (cần dựng cơ chế cron hoàn toàn mới, app hiện chỉ có lazy-expiry, không
  phải chỉ thêm 1 tính năng nhỏ) — ghi nhận như 1 plan tương lai riêng.
- **Research song song** (2 agent, do agent type `researcher` không tồn tại
  trong môi trường này nên dùng `general-purpose` thay thế):
  - Agent Capacitor/camera: phát hiện quan trọng nhất — **Google chặn OAuth
    trong embedded WebView** (lỗi `disallowed_useragent`, chính sách từ
    2/2023) → Auth.js Google Provider hiện tại không dùng nguyên xi được
    trong app. Cũng xác nhận Capacitor 8 (Node 22+) là bản khuyến nghị, và
    `@capacitor-mlkit/barcode-scanning` (ML Kit) là plugin quét QR được duy
    trì tốt nhất.
  - Agent FCM/push: xác nhận `sendMulticast()` **đã bị xoá** khỏi Admin SDK
    v13+ (dùng `sendEachForMulticast()`, giới hạn 500 token/lần gọi), FCM
    hoàn toàn miễn phí, và schema `DeviceToken` nên unique theo `token`
    (không phải `userId`) vì 1 user nhiều thiết bị.
- **Quyết định kiến trúc** (hỏi lại user qua `AskUserQuestion` sau khi có
  research): chọn **Native Google Sign-In plugin + Auth.js Credentials
  Provider mới** (verify ID token server-side, set cookie cùng-origin trong
  WebView) thay vì Custom Tabs + Android App Links — phương án sau phức tạp
  hơn ở tầng native và vẫn cần tự bắc cầu cookie thủ công.
- **Codebase analysis**: đọc `schema.prisma`, webhook SePay, `auth.ts`,
  `auth-helpers.ts`, pattern check-in thủ công hiện có
  (`src/app/actions/admin-orders.ts`) để plan mới nhất quán (atomic
  `updateMany`, `requireAdmin()`, không cron). Xác minh luôn 1 giả định
  quan trọng trước khi ghi vào plan như "đã có sẵn": QR trong `/my-tickets`
  **đã** encode đúng `order.qrToken` (`src/app/my-tickets/page.tsx:107`) —
  Phase 2 (camera scan) không cần sửa phần tạo QR.
- Viết `plan.md` + 4 phase file tại
  `plans/260826-1757-android-push-app/`: (1) Capacitor scaffold + native
  Google Sign-In, (2) camera QR check-in cho admin (verify `qrToken` có
  sẵn, action `checkInByQrToken` mirror `checkInOrder`), (3) push thanh
  toán thành công (bảng `DeviceToken` mới, `firebase-admin` singleton, hook
  vào webhook SePay + `simulatePayment`), (4) push broadcast admin (tái
  dùng hạ tầng phase 3, không viết lại logic batch).
- Task hydration (`TaskCreate`/`TodoWrite`) bị bỏ qua — cả 2 đều không có
  trong danh sách tool khả dụng của session VSCode-extension này; plan file
  là nguồn chính thức duy nhất, không có Claude Tasks đi kèm.
- **Không code nào được viết** — session dừng đúng ở plan, đúng rule của
  `/ck:plan`.

## Reflection

Phát hiện `disallowed_useragent` chỉ đến từ việc chủ động research trước
khi viết plan thay vì giả định "Capacitor wrap WebView thì Auth.js cứ chạy
bình thường" — nếu bỏ qua bước research này, phase 1 sẽ bị viết sai hoàn
toàn kiến trúc auth và phải viết lại giữa chừng lúc implement. Việc dừng lại
hỏi user 1 lần nữa (sau khi có research, không phải chỉ hỏi 1 lần lúc đầu)
là đúng — đây là quyết định kiến trúc ảnh hưởng cả phase 1, không phải chi
tiết nhỏ có thể tự chọn mặc định.

Điểm cần lưu ý cho session implement tiếp theo: môi trường không có agent
type `researcher`/`planner` như skill gốc kỳ vọng — đã tự thay bằng
`general-purpose` cho nghiên cứu và tự viết plan trực tiếp (không qua
subagent `planner`) sau khi gom đủ context. Tương tự, Task tools
(`TaskCreate` v.v.) không khả dụng trong VSCode extension — đã xác nhận lại
bằng `ToolSearch` thay vì giả định từ ghi chú cũ.

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| HOLD SCOPE — bỏ push nhắc hết hạn 15 phút ra khỏi plan | Cần cơ chế cron hoàn toàn mới, không có sẵn — nhét vào phase 3 sẽ phá vỡ tính "mỗi phase độc lập test được" | Phase 3 chỉ còn push thanh toán thành công (trigger tự nhiên từ webhook có sẵn), gọn và test được ngay |
| Native Google Sign-In + Credentials Provider mới thay vì Custom Tabs + App Links | Google chặn OAuth trong embedded WebView; Custom Tabs né được lỗi đó nhưng lại làm cookie session nằm sai storage (Chrome, không phải WebView) | Cần thêm 1 Android OAuth Client ID riêng (SHA-1 debug + release) và 1 Credentials Provider mới trong `auth.ts`, nhưng auth trong app hoạt động đúng, không vá lỗi cookie thủ công |
| Dùng `sendEachForMulticast()` (không phải `sendMulticast()`) | `sendMulticast()` đã bị xoá khỏi Firebase Admin SDK v13+ | Tránh code lỗi ngay từ đầu vì gọi API không còn tồn tại |
| `DeviceToken.token` unique (không phải `userId`) | 1 user có thể cài app trên nhiều thiết bị | Schema hỗ trợ đúng multi-device ngay từ đầu, không cần migrate lại sau |

## Next Steps

- Chạy `/ck:cook "plans/260826-1757-android-push-app/plan.md"` để bắt đầu
  implement Phase 1 (interactive, review từng phase).
- User tự chuẩn bị trước khi Phase 1 code chạy được: cài Android
  Studio/SDK, tạo Android OAuth Client ID (2 SHA-1: debug + release).
- User tự chuẩn bị trước Phase 3: tạo Firebase project riêng, tải
  `google-services.json` + service-account JSON.
- Cân nhắc lập 1 plan riêng sau này cho "push nhắc hết hạn thanh toán" —
  cần thiết kế cơ chế lịch/cron trước (Vercel Cron/QStash/khác), đã bị loại
  khỏi phạm vi plan này.
