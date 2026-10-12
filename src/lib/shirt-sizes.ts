/**
 * Size áo cho combo có áo (ComboType.includesShirt). Chọn size lưu dạng map
 * {size: số lượng} — ở giỏ hàng (localStorage), payload đặt hàng và
 * OrderItem.shirtSizes. Tổng số áo phải bằng số combo của dòng đó.
 * Đổi danh sách size chỉ cần sửa SHIRT_SIZES.
 */
export const SHIRT_SIZES = ["S", "M", "L", "XL", "XXL", "3XL"] as const;

export type ShirtSize = (typeof SHIRT_SIZES)[number];
export type ShirtSizes = Partial<Record<ShirtSize, number>>;

/** Chuẩn hoá dữ liệu không tin cậy -> map chỉ gồm size hợp lệ, số nguyên > 0. */
export function parseShirtSizes(value: unknown): ShirtSizes {
  const result: ShirtSizes = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return result;
  for (const size of SHIRT_SIZES) {
    const qty = (value as Record<string, unknown>)[size];
    if (Number.isInteger(qty) && (qty as number) > 0) result[size] = qty as number;
  }
  return result;
}

/** true nếu value có key lạ hoặc số lượng âm/không nguyên (dùng ở server). */
export function hasInvalidShirtSizes(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value !== "object" || Array.isArray(value)) return true;
  return Object.entries(value).some(
    ([size, qty]) =>
      !(SHIRT_SIZES as readonly string[]).includes(size) ||
      !Number.isInteger(qty) ||
      (qty as number) < 0,
  );
}

export function shirtSizesTotal(sizes: ShirtSizes): number {
  return SHIRT_SIZES.reduce((sum, size) => sum + (sizes[size] ?? 0), 0);
}

export function mergeShirtSizes(a: ShirtSizes, b: ShirtSizes): ShirtSizes {
  const result: ShirtSizes = {};
  for (const size of SHIRT_SIZES) {
    const qty = (a[size] ?? 0) + (b[size] ?? 0);
    if (qty > 0) result[size] = qty;
  }
  return result;
}

/** "M×2, L×1" — rỗng nếu chưa chọn size nào. */
export function formatShirtSizes(value: unknown): string {
  const sizes = parseShirtSizes(value);
  return SHIRT_SIZES.filter((size) => sizes[size])
    .map((size) => `${size}×${sizes[size]}`)
    .join(", ");
}
