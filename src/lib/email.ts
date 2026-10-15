import { Resend } from "resend";

// Gửi email qua Resend (domain gửi đã verify trên Resend + Cloudflare DNS).
// Cấu hình trong .env:
//   RESEND_API_KEY   — bắt buộc; thiếu thì sendEmail bỏ qua (không lỗi), để
//                      môi trường dev/staging chưa có key vẫn chạy bình thường.
//   RESEND_FROM      — vd "MarvelVN <support@dvtmarvelvn.com>" (tránh "no-reply",
//                      Resend cảnh báo giảm độ tin cậy -> dễ vào Spam).
//   RESEND_REPLY_TO  — địa chỉ nhận thư trả lời (forward qua Cloudflare Email Routing).

let client: Resend | null = null;

function getClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  client ??= new Resend(apiKey);
  return client;
}

/** URL gốc của web, dùng cho link trong email (không có "/" cuối). */
export function siteUrl(): string {
  return (process.env.SITE_URL || "https://dvtmarvelvn.com").replace(/\/+$/, "");
}

/** Escape chuỗi trước khi nhúng vào HTML email (tên combo, địa chỉ... do người nhập). */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export type SendEmailResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

/** Gửi 1 email. Không throw — lỗi trả về trong kết quả để caller tự log. */
export async function sendEmail(message: EmailMessage): Promise<SendEmailResult> {
  const resend = getClient();
  if (!resend) return { ok: false, error: "RESEND_API_KEY chưa cấu hình" };

  const from = process.env.RESEND_FROM;
  if (!from) return { ok: false, error: "RESEND_FROM chưa cấu hình" };

  try {
    const { data, error } = await resend.emails.send({
      from,
      to: message.to,
      replyTo: process.env.RESEND_REPLY_TO || undefined,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
    if (error) return { ok: false, error: `${error.name}: ${error.message}` };
    return { ok: true, id: data?.id ?? "" };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
