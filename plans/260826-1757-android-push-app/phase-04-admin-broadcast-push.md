# Phase 4: Push Broadcast — Admin Soạn & Gửi Tới Tất Cả User

Context: [plan.md](./plan.md). Phụ thuộc hạ tầng `DeviceToken` +
`src/lib/push.ts` dựng ở
[phase-03-system-push-payment.md](./phase-03-system-push-payment.md) — không
phụ thuộc logic nghiệp vụ thanh toán của phase đó.

## Mục tiêu

Admin vào 1 trang mới, soạn tiêu đề + nội dung tự do, bấm gửi → TẤT CẢ
`DeviceToken` đã đăng ký trong DB nhận push OS thật, kể cả app đang đóng.
Đây là yêu cầu quan trọng nhất user nhấn mạnh: **không phải in-app
banner/toast**, phải là push thật đẩy ra ngoài.

## Các bước implementation

1. Server action mới — `src/app/actions/broadcast.ts`:
   ```ts
   "use server";
   import { requireAdmin } from "@/lib/auth-helpers";
   import { prisma } from "@/lib/prisma";
   import { sendPushToTokens } from "@/lib/push";

   export async function sendBroadcastNotification(title: string, body: string) {
     await requireAdmin();
     if (!title.trim() || !body.trim()) {
       return { ok: false as const, error: "EMPTY" as const };
     }

     const tokens = await prisma.deviceToken.findMany({ select: { token: true } });
     const { sent, removed } = await sendPushToTokens(
       tokens.map((t) => t.token),
       { title: title.trim(), body: body.trim() },
     );

     return { ok: true as const, sent, removed, total: tokens.length };
   }
   ```
   Tái dùng nguyên `sendPushToTokens` từ Phase 3 (`src/lib/push.ts`) — không
   viết lại logic batch/chunk 500 token lần 2 (DRY).
2. Trang mới `src/app/admin/notifications/page.tsx` — form đơn giản (không
   cần validate phức tạp, `requireAdmin()` đã chặn ở server action, UI chỉ
   cần disable nút khi đang gửi + hiển thị kết quả `sent`/`total`):
   ```tsx
   "use client";
   import { useState } from "react";
   import { sendBroadcastNotification } from "@/app/actions/broadcast";
   import { Button } from "@/components/ui/button";
   import { Input } from "@/components/ui/input";
   import { Textarea } from "@/components/ui/textarea";
   import { toast } from "sonner";

   export default function BroadcastPage() {
     const [title, setTitle] = useState("");
     const [body, setBody] = useState("");
     const [sending, setSending] = useState(false);

     async function handleSend() {
       setSending(true);
       const res = await sendBroadcastNotification(title, body);
       setSending(false);
       if (!res.ok) {
         toast.error("Điền đủ tiêu đề và nội dung.");
         return;
       }
       toast.success(`Đã gửi tới ${res.sent}/${res.total} thiết bị.`);
       setTitle("");
       setBody("");
     }

     return (
       <div className="flex flex-col gap-4 max-w-md">
         <h1 className="font-heading text-3xl tracking-wide text-primary">
           GỬI THÔNG BÁO
         </h1>
         <Input placeholder="Tiêu đề" value={title} onChange={(e) => setTitle(e.target.value)} />
         <Textarea placeholder="Nội dung" value={body} onChange={(e) => setBody(e.target.value)} />
         <Button disabled={sending} onClick={handleSend}>
           {sending ? "Đang gửi..." : "Gửi tới tất cả user"}
         </Button>
       </div>
     );
   }
   ```
3. Thêm link "Gửi thông báo" vào nav admin (`src/app/admin/layout.tsx`) —
   trang này hữu ích cả khi test qua browser thường (admin không cần đứng
   trong app native để bấm gửi — chỉ người NHẬN mới cần app cài trên máy).
4. (Tuỳ chọn, có thể bỏ nếu muốn tối giản hơn nữa — KISS): thêm 1 bảng nhỏ
   `BroadcastLog` (title, body, sentCount, createdAt) để admin xem lại lịch
   sử đã gửi gì. Không bắt buộc cho success criteria — chỉ làm nếu còn dư
   thời gian, không phải phần lõi của phase.

## Việc user phải tự làm

- Không có bước riêng ngoài những gì đã làm ở Phase 3 (Firebase project,
  service account) — phase này thuần code, dùng lại hạ tầng có sẵn.
- Cần ít nhất 1 thiết bị đã cài app + đăng nhập (đã có `DeviceToken`) để
  test nhận push thật.

## Rủi ro

- Gửi tới rất nhiều token cùng lúc qua HTTP/2 đôi khi timeout/lỗi ở batch
  gần 500 (ghi nhận trong GitHub issue firebase-admin-node #2687, #2943) —
  nếu về sau user base lớn, cân nhắc giảm `MAX_TOKENS_PER_CALL` xuống
  300–400 hoặc thêm retry. Với quy mô hiện tại (vài chục-vài trăm user) chưa
  cần lo, không over-engineer trước (YAGNI).
- Admin có thể gửi nhầm/spam broadcast — không có giới hạn rate-limit ở MVP
  này; nếu cần, thêm sau khi thấy vấn đề thực tế xảy ra, không đoán trước.
- Không có cách "thu hồi" 1 push đã gửi (bản chất OS notification) — admin
  cần cẩn thận trước khi bấm gửi, UI không có bước xác nhận 2 lần ở MVP này
  (có thể thêm dialog confirm nếu muốn, nhỏ, không bắt buộc).

## (Tham khảo, không thuộc phạm vi kỹ thuật) Checklist Google Play Store

Chỉ ghi lại để user tiện tra cứu khi tới lúc publish chính thức — không
hydrate thành task, không phải trọng tâm của plan này:
- Tài khoản Google Play Console Developer — $25 một lần.
- Icon 512×512, feature graphic 1024×500, ≥2 screenshot thiết bị thật.
- Privacy Policy URL (bắt buộc vì app có đăng nhập Google + thu thập data).
- Data Safety form + Content Rating questionnaire (IARC).
- Target API level: app mới nộp từ 31/8/2026 cần target API 36 (Android 16).

## Todo Checklist

- [x] `src/app/actions/broadcast.ts` (`sendBroadcastNotification`)
- [x] `src/app/admin/notifications/page.tsx`
- [x] Thêm link "Gửi thông báo" vào `src/app/admin/layout.tsx` (luôn hiện,
      không gate native — admin gửi qua browser thường được)
- [x] `npx tsc --noEmit`, `eslint`, `npm run build` đều pass
- [ ] (User) Test gửi thật tới ≥1 thiết bị đã cài app + đăng nhập

## Success Criteria

- [ ] Admin (qua browser thường, không cần app) soạn 1 thông báo, bấm gửi.
- [ ] Thiết bị đã cài app + đăng nhập trước đó nhận được push OS thật, kể cả
      app đang đóng hoàn toàn.
- [ ] UI báo đúng số lượng đã gửi thành công / tổng số thiết bị.

> Code đã implement đầy đủ (xem Todo Checklist ở trên, tsc/eslint/build đều
> pass), chờ user test gửi broadcast thật tới ≥1 thiết bị Android đã cài app
> để xác nhận các mục Success Criteria trên.
