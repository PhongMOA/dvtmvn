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
      <div className="mb-6 flex items-center justify-between">
        <p className="font-heading text-sm tracking-widest text-accent">
          KHU VỰC QUẢN TRỊ
        </p>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/users"
            className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
          >
            Người dùng
          </Link>
          <Link
            href="/admin/notifications"
            className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
          >
            Gửi thông báo
          </Link>
          <AdminScanLink />
        </div>
      </div>
      {children}
    </div>
  );
}
