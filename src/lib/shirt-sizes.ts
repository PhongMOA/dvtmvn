/**
 * Size áo cho combo có áo (ComboType.includesShirt). Chọn size lưu dạng map
 * {size: số lượng} — ở giỏ hàng (localStorage), payload đặt hàng và
 * OrderItem.shirtSizes. Tổng số áo phải bằng số combo của dòng đó.
 * Đổi danh sách size chỉ cần sửa SHIRT_SIZES.
 */
export const SHIRT_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "3XL"] as const;

export type ShirtSize = (typeof SHIRT_SIZES)[number];
export type ShirtSizes = Partial<Record<ShirtSize, number>>;

/** Bảng thông số áo (cm / kg) — hiện trong modal chọn size. */
export const SHIRT_SIZE_CHART: {
  label: string;
  values: Record<ShirtSize, string>;
}[] = [
  {
    label: "Dài thân áo (cm)",
    values: { XS: "66", S: "68", M: "70", L: "72", XL: "74", XXL: "76", "3XL": "78" },
  },
  {
    label: "Ngang ngực (cm)",
    values: { XS: "43", S: "46", M: "49", L: "52", XL: "55", XXL: "58", "3XL": "61" },
  },
  {
    label: "Dài tay (cm)",
    values: { XS: "22", S: "23", M: "23", L: "24", XL: "24", XXL: "25", "3XL": "25" },
  },
  {
    label: "Chiều cao (cm)",
    values: {
      XS: "145-150",
      S: "151-160",
      M: "161-170",
      L: "171-178",
      XL: "179-185",
      XXL: ">185",
      "3XL": ">185",
    },
  },
  {
    label: "Cân nặng (kg)",
    values: { XS: "40-45", S: "45-50", M: "51-60", L: "61-70", XL: "71-80", XXL: "81-90", "3XL": ">90" },
  },
];

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
