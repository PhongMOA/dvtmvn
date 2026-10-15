import "dotenv/config";
import { Resend } from "resend";

/**
 * Gửi 1 email test qua Resend để kiểm tra API key / domain đã xác minh.
 *
 * Cần trong .env:
 *   RESEND_API_KEY="re_..."
 *   RESEND_FROM=""   # tuỳ chọn, mặc định onboarding@resend.dev (chỉ gửi được
 *                    # tới email chủ tài khoản Resend). Sau khi verify domain
 *                    # thì đặt vd: "MarvelVN <support@tenmien.vn>"
 *
 * Chạy:
 *   npx tsx scripts/test-resend-email.ts                  # gửi tới email mặc định
 *   npx tsx scripts/test-resend-email.ts --to ban@gmail.com
 */

const DEFAULT_TO = "hphitech.solutions@gmail.com";

function argValue(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("Thiếu RESEND_API_KEY trong .env");
    process.exit(1);
  }

  const from = process.env.RESEND_FROM || "onboarding@resend.dev";
  const to = argValue("--to") ?? DEFAULT_TO;

  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from,
    to,
    replyTo: process.env.RESEND_REPLY_TO || undefined,
    subject: "MarvelVN – Kiểm tra hệ thống email",
    text: [
      "Xin chào,",
      "",
      "Đây là email kiểm tra từ hệ thống MarvelVN (dvtmarvelvn.com).",
      "Nếu bạn nhận được thư này, hệ thống gửi email đã hoạt động bình thường.",
      "",
      "Trân trọng,",
      "MarvelVN",
    ].join("\n"),
    html: `<div style="font-family:Arial,sans-serif;font-size:15px;color:#222">
<p>Xin chào,</p>
<p>Đây là email kiểm tra từ hệ thống <strong>MarvelVN</strong> (dvtmarvelvn.com).</p>
<p>Nếu bạn nhận được thư này, hệ thống gửi email đã hoạt động bình thường.</p>
<p>Trân trọng,<br>MarvelVN</p>
</div>`,
  });

  if (error) {
    console.error("Gửi thất bại:", error);
    process.exit(1);
  }
  console.log(`Đã gửi từ ${from} tới ${to} — id: ${data?.id}`);
}

main();
