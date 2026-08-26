/**
 * ComboType.items được lưu trong DB dạng JSON string[] (không tách bảng riêng
 * vì đây chỉ là danh sách mô tả hiển thị, không cần query/lọc theo item).
 * 2 hàm này là điểm chuyển đổi duy nhất giữa dạng lưu trữ (JSON string) và
 * dạng dùng trong form/UI (mảng string, mỗi dòng 1 item).
 */
export function parseComboItems(items: string): string[] {
  try {
    const parsed = JSON.parse(items);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export function stringifyComboItems(lines: string): string {
  const items = lines
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  return JSON.stringify(items);
}
