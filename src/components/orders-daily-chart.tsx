import { cn } from "@/lib/utils";

function formatVnd(amount: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(amount);
}

function formatVndShort(amount: number) {
  if (amount >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(amount % 1_000_000 === 0 ? 0 : 1)}tr`;
  }
  if (amount >= 1_000) return `${Math.round(amount / 1_000)}k`;
  return String(amount);
}

export type OrdersDailyPoint = {
  day: string;
  label: string;
  shortLabel: string;
  orders: number;
  revenue: number;
};

/**
 * Biểu đồ cột doanh thu theo ngày (14 ngày gần nhất, giờ VN) cho trang
 * /admin/orders. Chiều cao cột = số tiền nhận vào trong ngày (đơn chuyển sang
 * "đã thanh toán" ngày đó); số nhỏ phía trên mỗi cột = số đơn được tạo trong
 * ngày. Thuần CSS, không cần thư viện chart.
 */
export function OrdersDailyChart({ data }: { data: OrdersDailyPoint[] }) {
  const maxRevenue = Math.max(1, ...data.map((d) => d.revenue));
  const totalRevenue = data.reduce((sum, d) => sum + d.revenue, 0);
  const totalOrders = data.reduce((sum, d) => sum + d.orders, 0);

  return (
    <div className="mt-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="font-heading text-sm tracking-wide text-foreground">
          Doanh thu &amp; đơn hàng theo ngày
        </h2>
        <p className="text-xs text-muted-foreground">
          {data.length} ngày gần nhất · {totalOrders} đơn ·{" "}
          <span className="text-foreground">{formatVnd(totalRevenue)}</span>
        </p>
      </div>

      <div className="mt-8 flex items-stretch gap-1 sm:gap-2">
        {/* trục dọc: mốc cao nhất */}
        <div className="flex w-10 shrink-0 flex-col justify-between py-1 text-right text-[10px] text-muted-foreground tabular-nums">
          <span>{formatVndShort(maxRevenue)}</span>
          <span>{formatVndShort(maxRevenue / 2)}</span>
          <span>0</span>
        </div>

        <div className="flex flex-1 items-end gap-1 sm:gap-2">
          {data.map((d) => {
            const pct = (d.revenue / maxRevenue) * 100;
            return (
              <div
                key={d.day}
                className="group relative flex flex-1 flex-col items-center gap-1"
              >
                <div className="relative flex h-40 w-full flex-col justify-end">
                  {/* Tooltip hover: số tiền nhận vào của cột */}
                  <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 rounded-md border border-border bg-background px-2 py-1 text-center whitespace-nowrap opacity-0 shadow-md transition-opacity group-hover:opacity-100">
                    <span className="block text-[11px] font-semibold text-foreground tabular-nums">
                      {formatVnd(d.revenue)}
                    </span>
                    <span className="block text-[10px] text-muted-foreground">
                      {d.label} · {d.orders} đơn
                    </span>
                  </div>
                  <span className="mb-0.5 text-center text-[10px] leading-none text-muted-foreground tabular-nums">
                    {d.orders || ""}
                  </span>
                  <div
                    className={cn(
                      "mx-auto w-full max-w-[26px] rounded-t bg-chart-1 transition-colors group-hover:bg-primary",
                      d.revenue === 0 && "bg-border group-hover:bg-border",
                    )}
                    style={{
                      height: `${pct}%`,
                      minHeight: d.revenue > 0 ? 3 : 2,
                    }}
                  />
                </div>
                <span className="text-[10px] whitespace-nowrap text-muted-foreground tabular-nums">
                  {d.shortLabel}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <p className="mt-3 text-[11px] text-muted-foreground">
        <span className="mr-1 inline-block h-2 w-2 rounded-sm bg-chart-1 align-middle" />
        Cột = tiền nhận vào trong ngày · số phía trên cột = số đơn tạo trong ngày
      </p>
    </div>
  );
}
