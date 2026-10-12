import Link from "next/link";

type OrderRef = { id: string; orderCode: string };

/**
 * Ghi chú nâng cấp ở bảng đơn admin: "Nâng cấp từ #CODE" (đơn nâng cấp) và
 * "Đã nâng cấp → #CODE" (đơn cũ có combo đã được đổi), kèm link chi tiết đơn.
 */
export function UpgradeLinks({
  order,
}: {
  order: { upgradeFromOrder: OrderRef | null; upgrades: OrderRef[] };
}) {
  if (!order.upgradeFromOrder && order.upgrades.length === 0) return null;
  return (
    <div className="mt-1 flex flex-col gap-0.5 font-sans text-xs font-normal">
      {order.upgradeFromOrder && (
        <span className="text-accent">
          Nâng cấp từ{" "}
          <Link
            href={`/orders/${order.upgradeFromOrder.id}`}
            className="font-mono font-semibold hover:underline"
          >
            #{order.upgradeFromOrder.orderCode}
          </Link>
        </span>
      )}
      {order.upgrades.map((u) => (
        <span key={u.id} className="text-muted-foreground">
          Đã nâng cấp →{" "}
          <Link href={`/orders/${u.id}`} className="font-mono font-semibold hover:underline">
            #{u.orderCode}
          </Link>
        </span>
      ))}
    </div>
  );
}
