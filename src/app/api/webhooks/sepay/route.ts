import { createHmac, timingSafeEqual } from "node:crypto";
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

// SePay ký mỗi request bằng HMAC-SHA256 trên chuỗi "{timestamp}.{raw body}"
// (xem https://developer.sepay.vn/vi/sepay-webhooks/xac-thuc), gửi kèm 2 header:
//   X-SePay-Signature: sha256=<hex digest>
//   X-SePay-Timestamp: <unix giây lúc ký>
// Phải verify trên RAW body (chuỗi gốc, chưa qua JSON.parse) — parse rồi
// stringify lại có thể đổi whitespace/thứ tự key -> chữ ký không khớp nữa.
// Chặn luôn timestamp lệch quá 5 phút để chống replay (phát lại request cũ đã
// bị lộ, dù chữ ký gốc vẫn còn hợp lệ về mặt toán học).
const SIGNATURE_TOLERANCE_SECONDS = 300;

function isValidSignature(rawBody: string, req: NextRequest): boolean {
  const secret = process.env.SEPAY_WEBHOOK_SECRET;
  if (!secret) return false; // chưa cấu hình -> chặn hết, tránh nhận webhook giả

  const signatureHeader = req.headers.get("x-sepay-signature");
  const timestampHeader = req.headers.get("x-sepay-timestamp");
  if (!signatureHeader || !timestampHeader) return false;

  const timestamp = Number(timestampHeader);
  if (!Number.isFinite(timestamp)) return false;
  if (Math.abs(Date.now() / 1000 - timestamp) > SIGNATURE_TOLERANCE_SECONDS) {
    return false;
  }

  const expected =
    "sha256=" +
    createHmac("sha256", secret)
      .update(`${timestamp}.${rawBody}`)
      .digest("hex");

  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(signatureHeader);
  // timingSafeEqual ném lỗi nếu 2 buffer khác độ dài -> check độ dài trước,
  // độ dài khác nhau nghĩa là chữ ký sai, trả false luôn thay vì để throw.
  if (expectedBuf.length !== actualBuf.length) return false;
  return timingSafeEqual(expectedBuf, actualBuf);
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  if (!isValidSignature(rawBody, req)) {
    return NextResponse.json({ success: false }, { status: 401 });
  }

  let payload: SepayWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
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
