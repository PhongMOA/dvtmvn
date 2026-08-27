import { randomUUID } from "crypto";

// Số phút giữ chỗ combo trước khi đơn tự hết hạn (đã chốt với user: 15 phút).
export const PAYMENT_WINDOW_MINUTES = 15;

// Prefix để nhận diện mã đơn trong nội dung chuyển khoản ngay cả khi ngân hàng
// người dùng chèn thêm khoảng trắng/ký tự khác quanh nó — chỉ dùng chữ hoa + số
// (theo đúng yêu cầu "alphanumeric, no diacritics" của SePay cho param "des").
const ORDER_CODE_PREFIX = "SV";
const ORDER_CODE_PATTERN = new RegExp(`${ORDER_CODE_PREFIX}[0-9A-F]{8}`, "i");

/** Tạo mã đơn ngắn, duy nhất theo xác suất — nhúng vào nội dung chuyển khoản QR. */
export function generateOrderCode(): string {
  return `${ORDER_CODE_PREFIX}${randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

/**
 * Tìm mã đơn trong nội dung chuyển khoản mà SePay trả về qua webhook. Ngân hàng
 * có thể thêm tiền tố riêng (vd "CT DEN:..." ) quanh nội dung QR gốc nên chỉ tìm
 * theo pattern, không so khớp toàn bộ chuỗi.
 */
export function extractOrderCodeFromContent(content: string): string | null {
  const match = content.match(ORDER_CODE_PATTERN);
  return match ? match[0].toUpperCase() : null;
}

/**
 * URL ảnh VietQR động (dịch vụ công khai, không cần API key — xem
 * https://docs.sepay.vn/tao-qr-code-vietqr-dong.html). SEPAY_BANK_ACCOUNT_NUMBER/
 * SEPAY_BANK_NAME lấy từ tài khoản ngân hàng đã liên kết trên dashboard SePay.
 */
export function buildVietQrUrl({
  amount,
  orderCode,
}: {
  amount: number;
  orderCode: string;
}): string {
  const { account, bank } = getBankTransferInfo();
  const params = new URLSearchParams({
    acc: account,
    bank,
    amount: String(amount),
    des: orderCode,
    template: "compact",
  });
  return `https://vietqr.app/img?${params.toString()}`;
}

/**
 * Thông tin tài khoản ngân hàng để hiển thị dạng chữ (bên cạnh mã QR) — cần
 * cho trường hợp user mở trang thanh toán ngay trên điện thoại dùng để
 * chuyển khoản, không tự quét camera vào màn hình chính nó được, nên phải
 * chuyển khoản thủ công bằng cách gõ số tài khoản trong app ngân hàng.
 */
export function getBankTransferInfo(): { account: string; bank: string } {
  return {
    account: process.env.SEPAY_BANK_ACCOUNT_NUMBER ?? "",
    bank: process.env.SEPAY_BANK_NAME ?? "",
  };
}
