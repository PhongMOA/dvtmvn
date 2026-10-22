import { redirect } from "next/navigation";

// Trang quét đã chuyển ra /scan để tài khoản staff (không vào được /admin) dùng
// được. Giữ đường dẫn cũ cho bookmark / bản app cũ.
export default function AdminScanPage() {
  redirect("/scan");
}
