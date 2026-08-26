import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractOrderCodeFromContent } from "@/lib/sepay";

// Payload SePay POST tới webhook khi có giao dịch ngân hàng mới — xem
// https://docs.sepay.vn/tich-hop-webhooks.html. Chỉ khai các field mình dùng.
type SepayWebhookPayload = {
  id: number | string;
  gateway?: string;
  transactionDate?: string;
  accountNumber?: string;
  content?: string;
  transferType?: "in" | "out";
  transferAmount?: number;
  referenceCode?: string | null;
};

function isAuthorized(req: NextRequest): boolean {
  const apiKey = process.env.SEPAY_WEBHOOK_API_KEY;
  if (!apiKey) return false; // chưa cấu hình -> chặn hết, tránh nhận webhook giả
  return req.headers.get("authorization") === `Apikey ${apiKey}`;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ success: false }, { status: 401 });
  }

  let payload: SepayWebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ success: false }, { status: 400 });
  }

  const transactionId = String(payload.id);

  // Chống xử lý trùng: SePay tự động gửi lại (retry Fibonacci, tối đa 7 lần/5h)
  // nếu không nhận được response hợp lệ trong 30s. id giao dịch của SePay là
  // @id (unique) trong SepayTransaction — insert trùng sẽ ném lỗi unique
  // constraint, bắt lỗi đó nghĩa là đã xử lý ở lần gọi trước, trả success luôn.
  try {
    await prisma.sepayTransaction.create({
      data: {
        id: transactionId,
        gateway: payload.gateway ?? "",
        transactionDate: payload.transactionDate ?? "",
        accountNumber: payload.accountNumber ?? "",
        content: payload.content ?? "",
        transferAmount: payload.transferAmount ?? 0,
        referenceCode: payload.referenceCode ?? null,
      },
    });
  } catch {
    return NextResponse.json({ success: true });
  }

  // Chỉ xử lý tiền vào; bỏ qua "out" (tiền ra khỏi tài khoản, không liên quan đơn hàng).
  if (payload.transferType !== "in") {
    return NextResponse.json({ success: true });
  }

  const orderCode = extractOrderCodeFromContent(payload.content ?? "");
  if (!orderCode) {
    // Không tìm thấy mã đơn trong nội dung CK — để lại orderId=null trong log
    // để admin đối soát thủ công (vd người chuyển khoản xoá mất nội dung QR gợi ý).
    return NextResponse.json({ success: true });
  }

  const order = await prisma.order.findUnique({
    where: { orderCode },
    include: { comboType: true },
  });

  if (!order || order.paymentStatus !== "pending") {
    return NextResponse.json({ success: true });
  }

  const expectedAmount = order.comboType.price * order.quantity;
  if (payload.transferAmount !== expectedAmount) {
    // Sai số tiền — không tự xác nhận, để admin đối soát qua log SepayTransaction.
    return NextResponse.json({ success: true });
  }

  // updateMany + where paymentStatus:"pending": tránh xác nhận trùng nếu webhook
  // vô tình được xử lý song song (2 request cùng lúc cho cùng 1 giao dịch).
  const { count } = await prisma.order.updateMany({
    where: { id: order.id, paymentStatus: "pending" },
    data: { paymentStatus: "paid", paidAt: new Date() },
  });

  if (count === 1) {
    await prisma.sepayTransaction.update({
      where: { id: transactionId },
      data: { orderId: order.id },
    });
  }

  return NextResponse.json({ success: true });
}
