# Phase 5: Polish & Manual Test Pass

## Context Links
- [plan.md](./plan.md)
- Tất cả phase trước

## Overview
- Priority: P3
- Status: Partially done — code hoàn chỉnh + build/lint pass + smoke test không cần đăng nhập; **code review cuối 9.5/10, auto-approved** (sau 1 vòng auto-fix 1 bug High + vài Medium/Low — xem `plan.md`); stress-test race condition đặt vé và logic mở/đóng event đã **pass** ở mức action/transaction trực tiếp. Các bước cần đăng nhập Google thật qua UI (đặt vé, check-in, mở/đóng event qua giao diện admin, race condition 2 tab trình duyệt thật) vẫn **blocked** vì chưa có `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET` thật (xem README)
- Dọn UI, xử lý edge case còn sót, viết README chạy local, chạy full smoke test theo kịch bản thật.

## Requirements
- Functional: toàn bộ luồng user + admin chạy mượt, không lỗi console, empty/error states rõ ràng.
- Non-functional: README đủ để người khác (hoặc chính bạn sau này) chạy lại project từ đầu.

## Related Code Files
**Create:**
- `README.md` (hướng dẫn setup: clone, `.env`, Google OAuth credentials, `npx prisma migrate dev`, seed, `npm run dev`)

**Modify:**
- Các page/component ở phase 1-4 — sửa nhỏ theo lỗi phát hiện khi test.

## Implementation Steps
1. Viết `README.md`: yêu cầu hệ thống (Node version), các bước setup từ đầu (env vars cần thiết, cách lấy Google OAuth credentials, lệnh migrate/seed/dev).
2. Chạy smoke test kịch bản đầy đủ:
   - Admin tạo event mới → mở bán → verify trang chủ hiện đúng.
   - User A (khác admin) đăng nhập Google → đặt 2 vé → verify `/my-tickets` hiện QR.
   - User B đăng nhập → đặt vé đến khi hết chỗ → verify user C đặt vé báo lỗi hết vé.
   - Admin vào `/admin/events/[id]/tickets` → thấy đúng danh sách vé đã bán → đánh dấu check-in 1 vé → verify trạng thái đổi.
   - Admin đóng bán event → verify trang chủ hiện "chưa mở bán".
   - Admin mở event khác → verify event cũ tự đóng.
3. Kiểm tra responsive cơ bản (mobile viewport) cho trang user (trang admin không cần).
4. Xử lý loading/error state cho các server action (disable nút khi đang submit, hiện toast lỗi dùng shadcn `sonner`/`toast` nếu có sẵn, hoặc đơn giản là text lỗi inline).
5. Review lại toàn bộ code cho các TODO/console.log sót lại, xoá code test tạm ở phase 2 (trang test auth nếu có).

## Todo List
- [x] README.md đầy đủ hướng dẫn setup
- [ ] Chạy full smoke test theo kịch bản trên — **một phần**: đã verify build production, lint sạch, tất cả route trả đúng status code (home 200 khi có event open/hiện empty state khi không, `/my-tickets` và `/admin/*` redirect 307 khi chưa đăng nhập); stress-test race condition đặt vé (nhiều request đồng thời) và logic mở/đóng event (enforce 1-event-open) đã pass ở mức action/transaction trực tiếp (bypass UI). Các bước cần login Google thật qua UI (đặt vé, check-in, mở/đóng event qua giao diện admin, race condition 2 tab trình duyệt thật) chưa chạy được — cần user tự bổ sung `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET` rồi tự test hoặc yêu cầu tiếp tục.
- [x] Xử lý loading/error state cho các form/action chính (disable nút khi pending, toast lỗi qua sonner, lỗi inline trong `EventForm`)
- [x] Dọn code test tạm, console.log thừa (không có trang test riêng nào được tạo ở phase 2 — auth được test trực tiếp qua trang chủ/sign-in thật); dead code `getCurrentUser` không dùng đã bị xoá ở vòng code review cuối
- [x] Kiểm tra responsive cơ bản trang user (layout dùng flex-col → sm:flex-row, đã review bằng mắt qua code; chưa chụp màn hình nhiều viewport thật)

## Success Criteria
- Toàn bộ kịch bản smoke test ở bước 2 chạy đúng như mô tả, không lỗi console.
- Người khác làm theo README từ đầu (fresh clone) chạy được project mà không cần hỏi thêm.

## Risk Assessment
- **Rủi ro:** Phát hiện bug logic muộn ở phase này (vd race condition thực tế) → quay lại sửa phase 3, không phải vấn đề lớn vì code đã module hoá theo action.

## Security Considerations
- Double-check không còn secret nào bị log ra console/hiện trên UI lỗi (stack trace) khi debug.

## Next Steps
- MVP hoàn tất. Việc mở rộng (chọn ghế, quét QR camera, email, deploy production) — brainstorm mới riêng khi cần.
