# Phase 2: Camera Quét QR Check-in Cho Admin

Context: [plan.md](./plan.md), phụ thuộc app đã chạy được từ
[phase-01-capacitor-scaffold-auth.md](./phase-01-capacitor-scaffold-auth.md).

## Mục tiêu

Admin quét QR bằng camera điện thoại (thay vì tìm order và bấm tay như hiện
tại ở `/admin/events/[id]/orders`), app tự verify `qrToken` và chuyển
`Order.status` → `checked_in`.

## Vì sao chọn plugin này

`@capacitor-mlkit/barcode-scanning` (Google ML Kit) là plugin quét mã được
duy trì tốt nhất hiện tại cho Capacitor (Capawesome/robingenz, theo kịp
Capacitor 6/7/8) — xem
[capawesome.io/plugins/mlkit/barcode-scanning](https://capawesome.io/plugins/mlkit/barcode-scanning/).
`@capacitor/camera` (chính chủ Ionic) chỉ chụp ảnh, không tự giải mã QR nên
không phù hợp.

## Backend đã có sẵn — không cần đổi schema

`Order.qrToken` (unique UUID) + `Order.status` (`booked`|`checked_in`) đã
tồn tại (xem `prisma/schema.prisma`). Chỉ cần 1 server action mới, verify
theo `qrToken` thay vì `id` — mirror chính xác pattern của `checkInOrder` có
sẵn ở `src/app/actions/admin-orders.ts`.

## Các bước implementation

1. `npm install @capacitor-mlkit/barcode-scanning` rồi `npx cap sync android`.
2. **Sửa tay** `android/app/src/main/AndroidManifest.xml` (khác thiết kế ban
   đầu — `npx cap sync` KHÔNG tự thêm permission vào manifest app, chỉ
   manifest-merge của Gradle lúc build mới gộp phần khai báo trong AAR của
   plugin; nhưng dòng `meta-data` dưới đây thì bắt buộc phải tự thêm, sync
   không thể tự suy ra):
   ```xml
   <!-- trong <application>, trước các thẻ khác -->
   <meta-data android:name="com.google.mlkit.vision.DEPENDENCIES" android:value="barcode_ui"/>
   ```
   ```xml
   <!-- cạnh <uses-permission android:name="android.permission.INTERNET" /> có sẵn -->
   <uses-permission android:name="android.permission.CAMERA" />
   ```
3. Thêm action mới vào `src/app/actions/admin-orders.ts` (cùng file với
   `checkInOrder` hiện có, giữ pattern nhất quán):
   ```ts
   export async function checkInByQrToken(qrToken: string) {
     await requireAdmin();
     const order = await prisma.order.findUnique({
       where: { qrToken },
       include: { comboType: true, user: true },
     });
     if (!order) return { ok: false as const, error: "NOT_FOUND" as const };
     if (order.paymentStatus !== "paid") {
       return { ok: false as const, error: "NOT_PAID" as const };
     }
     if (order.status === "checked_in") {
       return { ok: false as const, error: "ALREADY_CHECKED_IN" as const };
     }
     await prisma.order.update({ where: { id: order.id }, data: { status: "checked_in" } });
     revalidatePath(`/admin/events/${order.comboType.eventId}/orders`);
     return {
       ok: true as const,
       comboName: order.comboType.name,
       userName: order.user.name ?? order.user.email,
       quantity: order.quantity,
     };
   }
   ```
   Không dùng `updateMany` atomic guard ở đây vì check-in không có rủi ro
   race-condition nghiêm trọng như thanh toán (2 admin quét trùng 1 QR gần
   như không xảy ra thực tế) — check tuần tự đơn giản, đúng KISS.
4. Trang mới `src/app/admin/scan/page.tsx` (client component) — chỉ hiển thị
   khi chạy trong app native (`Capacitor.isNativePlatform()`), vì camera
   scan không có ý nghĩa trên browser thường:
   ```tsx
   "use client";
   import { BarcodeScanner, BarcodeFormat } from "@capacitor-mlkit/barcode-scanning";
   import { checkInByQrToken } from "@/app/actions/admin-orders";

   async function startScan() {
     const listener = await BarcodeScanner.addListener("barcodesScanned", async (result) => {
       await listener.remove();
       await BarcodeScanner.stopScan();
       const qrToken = result.barcodes[0]?.rawValue;
       if (!qrToken) return;
       const res = await checkInByQrToken(qrToken);
       // toast theo res.ok / res.error, hiển thị comboName + userName nếu ok
     });
     await BarcodeScanner.startScan({ formats: [BarcodeFormat.QrCode] });
   }
   ```
5. Thêm link "Quét QR check-in" vào `src/app/admin/layout.tsx` hoặc trang
   orders hiện có, chỉ hiện khi native (ẩn hẳn trên web, tránh admin bấm
   nhầm trên browser thấy nút không hoạt động).
6. QR hiển thị trong "vé của tôi" (`/my-tickets`) — **đã xác nhận** component
   `TicketQr` nhận đúng `order.qrToken` (`src/app/my-tickets/page.tsx:107`),
   không cần sửa gì ở phần tạo QR.

## Việc user phải tự làm

- Build lại APK sau khi thêm plugin mới (`npx cap sync` xong phải rebuild
  native, không chỉ reload web).
- Test quét trên thiết bị/emulator thật có camera — không test qua browser
  được.
- Cấp quyền Camera khi app hỏi lần đầu (runtime permission Android).

## Rủi ro

- ML Kit cần Google Play Services trên thiết bị — hầu hết máy Android thật
  đều có sẵn, nhưng emulator không kèm Play Services (loại "Google APIs")
  thì scan sẽ lỗi — user cần chọn đúng loại emulator có Play Services nếu
  không test trên máy thật.

## Todo Checklist

- [x] `npm install @capacitor-mlkit/barcode-scanning` + `npx cap sync android`
- [x] Sửa tay `AndroidManifest.xml` (meta-data ML Kit + permission CAMERA —
      xem ghi chú "phát hiện khi implement" ở trên)
- [x] Thêm `checkInByQrToken` vào `src/app/actions/admin-orders.ts`
- [x] Trang `src/app/admin/scan/page.tsx` (kèm CSS
      `body.barcode-scanner-active` trong `globals.css` để ẩn UI web lúc
      camera preview native hiển thị, theo đúng khuyến nghị của README
      plugin — chi tiết này không có trong thiết kế phase gốc)
- [x] Link "Quét QR check-in" trong `src/app/admin/layout.tsx`, chỉ hiện khi
      native (`src/components/admin-scan-link.tsx`)
- [x] `npx tsc --noEmit`, `eslint`, `npm run build` đều pass
- [ ] (User) Rebuild APK, test quét trên thiết bị thật

## Success Criteria

- [ ] Quét 1 QR của order đã "paid" → order chuyển `checked_in`, UI báo tên
      combo + người đặt.
- [ ] Quét lại QR đã check-in → báo "đã check-in trước đó", không lỗi crash.
- [ ] Quét QR của order chưa thanh toán → báo "chưa thanh toán", không cho
      check-in.

> Code đã implement đầy đủ (xem Todo Checklist ở trên, tsc/eslint/build đều
> pass), chờ user rebuild APK và test quét QR bằng camera trên thiết bị
> Android thật để xác nhận các mục Success Criteria trên.
