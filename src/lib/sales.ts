// Thời điểm mở bán các gói combo của sự kiện hiện tại (giờ Việt Nam, UTC+7).
// Trước mốc này: trang chủ hiện đồng hồ đếm ngược ở hero và khoá phần đặt combo.
// Muốn đổi ngày mở bán -> sửa hằng số này rồi deploy lại (đã chốt với user:
// lưu bằng hằng số trong code, không thêm field vào schema).
export const SALES_START_AT = new Date("2026-11-04T00:00:00+07:00");

export function isSalesOpen(now: Date = new Date()): boolean {
  return now.getTime() >= SALES_START_AT.getTime();
}

export function formatSalesStartDate(): string {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "full",
    timeStyle: "short",
  }).format(SALES_START_AT);
}
