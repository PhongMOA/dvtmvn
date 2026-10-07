// Tiện ích tính toán/hiển thị cho đơn gồm nhiều dòng combo (OrderItem).

type ItemLike = { quantity: number; unitPrice: number };
type NamedItemLike = { quantity: number; comboType: { name: string } };

/** Tiền combo của đơn (chưa gồm phí ship) — dùng giá đã chụp lúc đặt. */
export function orderItemsTotal(items: ItemLike[]): number {
  return items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
}

/** Tổng số combo trong đơn (cộng mọi dòng). */
export function orderItemsQuantity(items: { quantity: number }[]): number {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}

/** Mô tả ngắn 1 dòng, vd "Combo A × 2, Combo B × 1". */
export function describeOrderItems(items: NamedItemLike[]): string {
  return items.map((item) => `${item.comboType.name} × ${item.quantity}`).join(", ");
}
