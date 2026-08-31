import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/auth-helpers";
import { AdminScanLink } from "@/components/admin-scan-link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const session = await auth();
  if (!(await isAdmin(session?.user))) {
    redirect("/");
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-12">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-heading text-sm tracking-widest whitespace-nowrap text-accent">
          KHU VỰC QUẢN TRỊ
        </p>
        <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 sm:mx-0 sm:overflow-visible sm:px-0">
          <Link
            href="/admin/users"
            className={cn(
              buttonVariants({ size: "sm", variant: "outline" }),
              "shrink-0 whitespace-nowrap",
            )}
          >
            Người dùng
          </Link>
          <Link
            href="/admin/notifications"
            className={cn(
              buttonVariants({ size: "sm", variant: "outline" }),
              "shrink-0 whitespace-nowrap",
            )}
          >
            Gửi thông báo
          </Link>
          <Link
            href="/admin/settings"
            className={cn(
              buttonVariants({ size: "sm", variant: "outline" }),
              "shrink-0 whitespace-nowrap",
            )}
          >
            Cấu hình
          </Link>
          <AdminScanLink />
        </div>
      </div>
      {children}
    </div>
  );
}
