# Phase 4: Admin Panel (Events + Check-in)

## Context Links
- [plan.md](./plan.md)
- [phase-01-setup-data-model.md](./phase-01-setup-data-model.md)
- [phase-02-authentication.md](./phase-02-authentication.md)
- [phase-03-booking-qr.md](./phase-03-booking-qr.md)

## Overview
- Priority: P2
- Status: Done
- Trang admin: CRUD event, nút mở/đóng bán (enforce chỉ 1 event open), danh sách vé đã bán + đánh dấu check-in thủ công.

## Requirements
- Functional:
  - `/admin/events` — list tất cả event (mọi trạng thái), nút "Tạo event mới", mỗi event có nút Sửa / Mở bán (nếu draft/closed) / Đóng bán (nếu open).
  - Form tạo/sửa event: title, description, posterUrl, venue, startAt, totalSeats, price. `remainingSeats` = `totalSeats` khi tạo mới (không cho sửa trực tiếp remainingSeats để tránh lệch data — nếu cần sửa totalSeats sau khi đã bán vé, tính lại remainingSeats theo chênh lệch, hoặc đơn giản chặn sửa totalSeats khi event đã có vé bán ra).
  - "Mở bán": set `status = "open"`, đồng thời set mọi event khác đang `open` → `closed` (transaction).
  - "Đóng bán": set `status = "closed"`.
  - `/admin/events/[id]/tickets` — list ticket của event đó (user, quantity, status, createdAt), nút "Đánh dấu đã check-in" cho ticket `status = "booked"`.
  - Mọi route `/admin/*` chặn non-admin (dùng `isAdminEmail` từ phase 2).
- Non-functional: UI đơn giản, dùng shadcn table/form component có sẵn, không cần responsive phức tạp (admin dùng desktop).

## Architecture
```
src/app/admin/layout.tsx                     # check isAdminEmail, redirect nếu không phải admin
src/app/admin/events/page.tsx                # list events + actions
src/app/admin/events/new/page.tsx            # form tạo event
src/app/admin/events/[id]/edit/page.tsx      # form sửa event
src/app/admin/events/[id]/tickets/page.tsx   # list ticket + check-in
src/app/actions/admin-events.ts              # server actions: createEvent, updateEvent, openEvent, closeEvent
src/app/actions/admin-tickets.ts             # server action: checkInTicket
```

## Related Code Files
**Create:**
- `src/app/admin/layout.tsx`
- `src/app/admin/events/page.tsx`
- `src/app/admin/events/new/page.tsx`
- `src/app/admin/events/[id]/edit/page.tsx`
- `src/app/admin/events/[id]/tickets/page.tsx`
- `src/app/actions/admin-events.ts`
- `src/app/actions/admin-tickets.ts`
- `src/components/event-form.tsx`

## Implementation Steps
1. `admin/layout.tsx`: Server Component, `const session = await auth(); if (!isAdminEmail(session?.user?.email)) redirect("/")`. Áp dụng cho toàn bộ `/admin/*` con.
2. `admin-events.ts` actions:
   ```ts
   export async function createEvent(data: EventInput) {
     await requireAdmin();
     await prisma.event.create({ data: { ...data, remainingSeats: data.totalSeats, status: "draft" } });
     revalidatePath("/admin/events");
   }

   export async function openEvent(id: string) {
     await requireAdmin();
     await prisma.$transaction([
       prisma.event.updateMany({ where: { status: "open" }, data: { status: "closed" } }),
       prisma.event.update({ where: { id }, data: { status: "open" } }),
     ]);
     revalidatePath("/admin/events");
     revalidatePath("/");
   }

   export async function closeEvent(id: string) {
     await requireAdmin();
     await prisma.event.update({ where: { id }, data: { status: "closed" } });
     revalidatePath("/admin/events");
     revalidatePath("/");
   }
   ```
   Thêm `requireAdmin()` helper vào `auth-helpers.ts` (tương tự `requireUser` nhưng throw nếu không phải admin).
3. Form tạo/sửa event dùng shadcn `Form` + `Input`/`Textarea`/`DatePicker` (hoặc input `datetime-local` đơn giản cho MVP thay vì DatePicker component riêng — giảm phức tạp).
4. `/admin/events/[id]/tickets`: query `prisma.ticket.findMany({ where: { eventId }, include: { user: true } })`, render table (email user, quantity, status, createdAt), nút check-in gọi `checkInTicket(ticketId)`.
5. `admin-tickets.ts`:
   ```ts
   export async function checkInTicket(ticketId: string) {
     await requireAdmin();
     await prisma.ticket.update({ where: { id: ticketId }, data: { status: "checked_in" } });
     revalidatePath(`/admin/events/${eventId}/tickets`); // lấy eventId từ ticket trước hoặc pass kèm
   }
   ```
6. Validate: chặn sửa `totalSeats` xuống thấp hơn số vé đã bán (`totalSeats - remainingSeats`) — hiện lỗi nếu vi phạm.

## Todo List
- [x] `admin/layout.tsx` chặn non-admin
- [x] List events + trạng thái + nút mở/đóng bán
- [x] Form tạo event (dùng `useActionState` + Server Action trả lỗi validate inline, thay vì throw trực tiếp)
- [x] Form sửa event (chặn giảm totalSeats dưới số đã bán; `updateEvent` chạy trong `$transaction` + `increment` **delta** trên `remainingSeats` thay vì ghi đè giá trị tuyệt đối — fix ở vòng code review cuối để không mất phần đã bị trừ bởi 1 booking đồng thời)
- [x] Enforce chỉ 1 event open (transaction trong `openEvent`)
- [x] List ticket theo event + đánh dấu check-in
- [x] Test: mở event B trong khi event A đang open → A tự đóng — **đã pass qua test logic trực tiếp** (gọi `openEvent`/transaction, verify DB chỉ còn 1 event `open`), cũng khớp với invariant `seed.ts` giữ (đóng mọi event open khác trước khi upsert). Test qua UI admin thật (đăng nhập Google) **vẫn chưa chạy được** — thiếu OAuth credentials thật, xem Phase 5

## Success Criteria
- Chỉ luôn có tối đa 1 event `status = "open"` trong DB tại mọi thời điểm (verify qua Prisma Studio sau vài lần bấm mở/đóng).
- Trang chủ (`/`) phản ánh đúng event admin vừa mở bán.
- Đánh dấu check-in xong, ticket đổi `status` và không thể thao tác lại (nút ẩn/disable khi đã `checked_in`).
- User thường (không phải admin) truy cập `/admin/events` bị redirect.

## Risk Assessment
- **Rủi ro:** Sửa `totalSeats` sau khi đã bán vé dễ làm lệch `remainingSeats`. Mitigation: chặn giảm totalSeats dưới số đã bán; nếu tăng totalSeats, cộng thêm phần chênh lệch vào remainingSeats (không set lại bằng totalSeats mới).

## Security Considerations
- Mọi server action trong file `admin-*.ts` đều gọi `requireAdmin()` đầu tiên — không dựa vào việc ẩn UI (nút) để bảo vệ, vì action có thể bị gọi trực tiếp.

## Next Steps
- Phase 5: polish UI, test toàn bộ luồng end-to-end.
