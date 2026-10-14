import { AdminOrdersView } from "@/components/admin-orders-view";
import { parseOrderFilters, parsePage } from "@/lib/admin-orders-data";

export default async function AdminAllOrdersPage({
  searchParams,
}: PageProps<"/admin/orders">) {
  const sp = await searchParams;

  return (
    <AdminOrdersView
      title="TẤT CẢ ĐƠN HÀNG"
      filters={parseOrderFilters(sp)}
      pageRaw={parsePage(sp)}
      pathname="/admin/orders"
    />
  );
}
