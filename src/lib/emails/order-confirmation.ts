import QRCode from "qrcode";
import type { EmailMessage } from "@/lib/email";
import { escapeHtml, siteUrl } from "@/lib/email";
import { formatEventStart, VN_TIME_ZONE } from "@/lib/datetime";
import { orderAmountDue, orderItemsTotal } from "@/lib/order-items";
import { parseCoupon } from "@/lib/coupons";
import { parseShirtSizes, SHIRT_SIZES } from "@/lib/shirt-sizes";

// Email "Xác nhận thanh toán" gửi khi đơn chuyển sang paid (xem fulfillPaidOrder).
// HTML email: chỉ dùng <table> + inline style (Gmail/Outlook bỏ <style>, flex,
// grid, CSS variables). Màu lấy theo bảng màu Avengers: Doomsday ở globals.css,
// quy đổi oklch -> hex (email client không hiểu oklch).
const C = {
  bg: "#020302", // --background
  card: "#0b110d", // --card (sáng hơn chút cho tách nền trong email)
  cardAlt: "#141a15", // --secondary
  border: "#223026",
  fg: "#eaf0eb", // --foreground
  muted: "#8a968c", // --muted-foreground
  primary: "#0fbd59", // --primary
  primaryFg: "#010201", // --primary-foreground
  accent: "#92e689", // --accent
};

const FONT = "'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
// Impact không có glyph tiếng Việt (Ũ, Ụ...) -> client lấy ký tự từ font khác,
// chữ lệch nhau. Dòng có dấu dùng Arial/Helvetica (máy nào cũng có, đủ dấu);
// Impact chỉ dùng cho "MARVEL VN" (không dấu).
const LOGO_FONT_VI = "Arial,Helvetica,sans-serif";
const LOGO_FONT = "Impact,'Arial Black','Helvetica Neue',Arial,sans-serif";

// Ảnh QR gửi dạng inline attachment (cid:) — Gmail chặn ảnh data: URI trong email.
const QR_CID = "ticket-qr";

export type OrderEmailData = {
  id: string;
  orderCode: string;
  qrToken: string;
  paidAt: Date | null;
  upgradeFromOrderId: string | null;
  shipName: string | null;
  shipPhone: string | null;
  shipProvince: string | null;
  shipDistrict: string | null;
  shipWard: string | null;
  shipAddress: string | null;
  shipFee: number;
  discountAmount: number;
  coupon: unknown;
  user: { name: string | null; email: string };
  items: {
    quantity: number;
    unitPrice: number;
    shirtSizes: unknown;
    comboType: {
      name: string;
      includesTicket: boolean;
      event: {
        title: string;
        venue: string;
        startAt: Date;
        startAtTentative: boolean;
        posterUrl: string | null;
      };
    };
  }[];
};

const vnd = (n: number) => `${new Intl.NumberFormat("vi-VN").format(n)}đ`;

function formatPaidAt(date: Date): string {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: VN_TIME_ZONE,
  }).format(date);
}

function shirtSizesText(value: unknown): string {
  const sizes = parseShirtSizes(value);
  return SHIRT_SIZES.filter((s) => sizes[s])
    .map((s) => `${s} × ${sizes[s]}`)
    .join(", ");
}

function absoluteUrl(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `${siteUrl()}${url.startsWith("/") ? "" : "/"}${url}`;
}

function shippingAddress(order: OrderEmailData): string | null {
  if (!order.shipAddress) return null;
  return [order.shipAddress, order.shipWard, order.shipDistrict, order.shipProvince]
    .filter(Boolean)
    .join(", ");
}

/** Logo "ĐA VŨ TRỤ / MARVEL VN" dựng bằng table (giống components/logo.tsx). */
function logoHtml(): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="border-collapse:collapse;border:2px solid #ffffff;">
  <tr><td align="center" bgcolor="${C.card}" style="background:${C.card};padding:5px 18px;border-bottom:2px solid #ffffff;font-family:${LOGO_FONT_VI};font-size:15px;font-weight:700;letter-spacing:3px;color:${C.fg};">ĐA VŨ TRỤ</td></tr>
  <tr><td align="center" bgcolor="${C.primary}" style="background:${C.primary};padding:4px 18px 6px;font-family:${LOGO_FONT};font-size:30px;line-height:34px;letter-spacing:1px;color:${C.primaryFg};">MARVEL VN</td></tr>
</table>`;
}

function row(label: string, value: string, opts: { strong?: boolean; color?: string } = {}): string {
  const color = opts.color ?? (opts.strong ? C.fg : C.muted);
  const weight = opts.strong ? "700" : "400";
  const size = opts.strong ? "17px" : "14px";
  return `<tr>
  <td style="padding:4px 0;font-family:${FONT};font-size:${size};color:${color};font-weight:${weight};">${label}</td>
  <td align="right" style="padding:4px 0;font-family:${FONT};font-size:${size};color:${opts.color ?? C.fg};font-weight:${weight};white-space:nowrap;">${value}</td>
</tr>`;
}

export async function buildOrderConfirmationEmail(order: OrderEmailData): Promise<EmailMessage> {
  const event = order.items[0]?.comboType.event;
  const customerName = order.shipName || order.user.name || "bạn";
  const subtotal = orderItemsTotal(order.items);
  const total = orderAmountDue(order);
  const coupon = parseCoupon(order.coupon);
  const address = shippingAddress(order);
  const hasTicket = order.items.some((i) => i.comboType.includesTicket);
  const ticketsUrl = `${siteUrl()}/my-tickets`;
  const isUpgrade = Boolean(order.upgradeFromOrderId);
  const eventStart = event ? formatEventStart(event, "full") : "";

  // Cùng nội dung (qrToken) với TicketQr ở /my-tickets — admin quét được như nhau.
  const qrPng = await QRCode.toBuffer(order.qrToken, {
    type: "png",
    margin: 1,
    width: 400,
    color: { dark: "#0a0a0f", light: "#ffffff" },
  });

  const subject = isUpgrade
    ? `Nâng cấp combo thành công – Đơn ${order.orderCode}`
    : `Xác nhận thanh toán – Đơn ${order.orderCode}`;

  // ---------- HTML ----------
  const itemsHtml = order.items
    .map((item) => {
      const sizes = shirtSizesText(item.shirtSizes);
      const badge = item.comboType.includesTicket
        ? `<span style="display:inline-block;margin-left:6px;padding:1px 7px;border-radius:10px;background:${C.primary};color:${C.primaryFg};font-size:11px;font-weight:700;">CÓ VÉ</span>`
        : `<span style="display:inline-block;margin-left:6px;padding:1px 7px;border-radius:10px;border:1px solid #e3b341;color:#e3b341;font-size:11px;font-weight:700;">KHÔNG GỒM VÉ</span>`;
      return `<tr>
  <td style="padding:12px 0;border-bottom:1px solid ${C.border};font-family:${FONT};">
    <div style="font-size:15px;font-weight:600;color:${C.fg};">${escapeHtml(item.comboType.name)}${badge}</div>
    <div style="font-size:13px;color:${C.muted};padding-top:3px;">${vnd(item.unitPrice)} × ${item.quantity}${sizes ? ` · Size áo: ${escapeHtml(sizes)}` : ""}</div>
  </td>
  <td align="right" valign="top" style="padding:12px 0;border-bottom:1px solid ${C.border};font-family:${FONT};font-size:15px;color:${C.fg};white-space:nowrap;">${vnd(item.unitPrice * item.quantity)}</td>
</tr>`;
    })
    .join("");

  const posterHtml = event?.posterUrl
    ? `<td width="88" valign="top" style="padding-right:16px;"><img src="${escapeHtml(absoluteUrl(event.posterUrl))}" width="88" alt="" style="display:block;width:88px;height:auto;border-radius:6px;border:1px solid ${C.border};"></td>`
    : "";

  const eventHtml = event
    ? `<tr><td style="padding:0 28px 8px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.cardAlt}" style="background:${C.cardAlt};border-radius:8px;">
    <tr><td style="padding:16px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      ${posterHtml}
      <td valign="top" style="font-family:${FONT};">
        <div style="font-size:11px;letter-spacing:2px;color:${C.accent};font-weight:700;">SỰ KIỆN</div>
        <div style="font-size:18px;font-weight:700;color:${C.fg};padding:4px 0 8px;">${escapeHtml(event.title)}</div>
        <div style="font-size:14px;color:${C.muted};line-height:22px;">🎬 ${event.startAtTentative ? "Suất chiếu dự kiến: " : ""}${escapeHtml(eventStart)}<br>📍 ${escapeHtml(event.venue)}</div>
      </td>
    </tr></table></td></tr>
  </table>
</td></tr>`
    : "";

  const totalsHtml = [
    row("Tạm tính", vnd(subtotal)),
    order.discountAmount > 0
      ? row(`Giảm giá${coupon ? ` (${escapeHtml(coupon.code)})` : ""}`, `−${vnd(order.discountAmount)}`, { color: C.accent })
      : "",
    order.shipFee > 0 ? row("Phí vận chuyển", vnd(order.shipFee)) : "",
    `<tr><td colspan="2" style="padding-top:6px;border-top:1px solid ${C.border};font-size:0;line-height:0;">&nbsp;</td></tr>`,
    row("Đã thanh toán", `<span style="color:${C.primary};">${vnd(total)}</span>`, { strong: true }),
  ].join("");

  const shippingHtml = address
    ? `<tr><td style="padding:16px 28px 0;font-family:${FONT};">
  <div style="font-size:11px;letter-spacing:2px;color:${C.accent};font-weight:700;padding-bottom:6px;">GIAO HÀNG TỚI</div>
  <div style="font-size:14px;color:${C.fg};line-height:22px;">${escapeHtml(order.shipName ?? "")}${order.shipPhone ? ` · ${escapeHtml(order.shipPhone)}` : ""}<br><span style="color:${C.muted};">${escapeHtml(address)}</span></div>
</td></tr>`
    : "";

  const noteLines = [
    "Mã QR cũng luôn có trong mục <strong>Vé của tôi</strong> trên web, phòng khi bạn không tìm thấy email này.",
    hasTicket
      ? "Khi ban tổ chức mở chọn ghế, bạn sẽ được chọn ghế theo lượt tại trang Vé của tôi."
      : "",
    isUpgrade ? "Combo cũ của bạn đã được nâng cấp sang combo mới trong đơn này." : "",
  ].filter(Boolean);

  const notesHtml = noteLines.length
    ? `<tr><td style="padding:20px 28px 0;font-family:${FONT};font-size:14px;line-height:22px;color:${C.muted};">${noteLines
        .map((l) => `<p style="margin:0 0 8px;">• ${l}</p>`)
        .join("")}</td></tr>`
    : "";

  const replyTo = process.env.RESEND_REPLY_TO;

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${C.bg};" bgcolor="${C.bg}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Đơn ${escapeHtml(order.orderCode)} đã thanh toán ${vnd(total)}${event ? ` · ${escapeHtml(event.title)}` : ""}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.bg}" style="background:${C.bg};">
<tr><td align="center" style="padding:28px 12px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">
    <tr><td align="center" style="padding-bottom:24px;">${logoHtml()}</td></tr>
    <tr><td bgcolor="${C.card}" style="background:${C.card};border:1px solid ${C.border};border-top:3px solid ${C.primary};border-radius:10px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td align="center" style="padding:32px 28px 8px;font-family:${FONT};">
          <div style="display:inline-block;width:52px;height:52px;line-height:52px;border-radius:26px;background:${C.primary};color:${C.primaryFg};font-size:28px;font-weight:700;">✓</div>
          <h1 style="margin:16px 0 6px;font-size:24px;color:${C.fg};font-weight:700;">${isUpgrade ? "Nâng cấp combo thành công" : "Thanh toán thành công"}</h1>
          <p style="margin:0;font-size:15px;color:${C.muted};line-height:22px;">Cảm ơn ${escapeHtml(customerName)}! Đơn hàng của bạn đã được xác nhận.</p>
        </td></tr>
        <tr><td align="center" style="padding:16px 28px 24px;font-family:${FONT};">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr>
            <td style="padding:8px 16px;border:1px dashed ${C.primary};border-radius:6px;font-family:${FONT};font-size:13px;color:${C.muted};">Mã đơn <strong style="font-family:Consolas,'Courier New',monospace;font-size:16px;letter-spacing:1px;color:${C.accent};">${escapeHtml(order.orderCode)}</strong>${order.paidAt ? ` · ${formatPaidAt(order.paidAt)}` : ""}</td>
          </tr></table>
        </td></tr>
        <tr><td align="center" style="padding:0 28px 24px;font-family:${FONT};">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr>
            <td align="center" bgcolor="#ffffff" style="background:#ffffff;padding:12px;border-radius:10px;border:3px solid ${C.primary};">
              <img src="cid:${QR_CID}" width="200" height="200" alt="Mã QR check-in ${escapeHtml(order.orderCode)}" style="display:block;width:200px;height:200px;">
            </td>
          </tr></table>
          <div style="font-size:11px;letter-spacing:2px;color:${C.accent};font-weight:700;padding-top:12px;">MÃ QR CHECK-IN</div>
          <div style="font-size:13px;color:${C.muted};line-height:20px;padding-top:4px;">Xuất trình mã này khi check-in / nhận combo tại sự kiện.<br>Vui lòng không chia sẻ mã cho người khác.</div>
        </td></tr>
        ${eventHtml}
        <tr><td style="padding:12px 28px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${itemsHtml}</table>
        </td></tr>
        <tr><td style="padding:12px 28px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${totalsHtml}</table>
        </td></tr>
        ${shippingHtml}
        ${notesHtml}
        <tr><td align="center" style="padding:24px 28px 32px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
            <td align="center" bgcolor="${C.primary}" style="border-radius:6px;background:${C.primary};">
              <a href="${ticketsUrl}" target="_blank" style="display:inline-block;padding:13px 32px;font-family:${FONT};font-size:15px;font-weight:700;color:${C.primaryFg};text-decoration:none;border-radius:6px;">Xem vé của tôi</a>
            </td>
          </tr></table>
        </td></tr>
      </table>
    </td></tr>
    <tr><td align="center" style="padding:24px 16px 0;font-family:${FONT};font-size:12px;line-height:19px;color:${C.muted};">
      ${replyTo ? `Cần hỗ trợ? Trả lời email này hoặc liên hệ <a href="mailto:${escapeHtml(replyTo)}" style="color:${C.accent};text-decoration:none;">${escapeHtml(replyTo)}</a><br>` : ""}
      Đa Vũ Trụ Marvel VN · <a href="${siteUrl()}" style="color:${C.muted};">${escapeHtml(siteUrl().replace(/^https?:\/\//, ""))}</a><br>
      Bạn nhận được email này vì đã đặt hàng bằng địa chỉ ${escapeHtml(order.user.email)}.
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;

  // ---------- Plain text (bản dự phòng, cũng giúp giảm điểm spam) ----------
  const text = [
    `${isUpgrade ? "NÂNG CẤP COMBO THÀNH CÔNG" : "THANH TOÁN THÀNH CÔNG"} – ĐA VŨ TRỤ MARVEL VN`,
    "",
    `Cảm ơn ${customerName}! Đơn hàng của bạn đã được xác nhận.`,
    `Mã đơn: ${order.orderCode}${order.paidAt ? ` (${formatPaidAt(order.paidAt)})` : ""}`,
    "Mã QR check-in: xem ảnh đính kèm hoặc mục Vé của tôi trên web.",
    "",
    ...(event
      ? [
          `Sự kiện: ${event.title}`,
          `Thời gian: ${event.startAtTentative ? "(dự kiến) " : ""}${eventStart}`,
          `Địa điểm: ${event.venue}`,
          "",
        ]
      : []),
    ...order.items.map((item) => {
      const sizes = shirtSizesText(item.shirtSizes);
      return `- ${item.comboType.name}${item.comboType.includesTicket ? "" : " (không gồm vé)"}: ${vnd(item.unitPrice)} × ${item.quantity} = ${vnd(item.unitPrice * item.quantity)}${sizes ? ` | Size áo: ${sizes}` : ""}`;
    }),
    "",
    `Tạm tính: ${vnd(subtotal)}`,
    ...(order.discountAmount > 0
      ? [`Giảm giá${coupon ? ` (${coupon.code})` : ""}: -${vnd(order.discountAmount)}`]
      : []),
    ...(order.shipFee > 0 ? [`Phí vận chuyển: ${vnd(order.shipFee)}`] : []),
    `Đã thanh toán: ${vnd(total)}`,
    ...(address
      ? ["", `Giao hàng tới: ${order.shipName ?? ""}${order.shipPhone ? ` - ${order.shipPhone}` : ""}`, address]
      : []),
    "",
    ...noteLines.map((l) => `* ${l.replace(/<[^>]+>/g, "")}`),
    "",
    `Xem vé của tôi: ${ticketsUrl}`,
    ...(replyTo ? [`Cần hỗ trợ? Trả lời email này hoặc liên hệ ${replyTo}`] : []),
  ].join("\n");

  return {
    to: order.user.email,
    subject,
    html,
    text,
    attachments: [
      {
        filename: `ve-${order.orderCode}.png`,
        content: qrPng,
        contentType: "image/png",
        contentId: QR_CID,
      },
    ],
  };
}
