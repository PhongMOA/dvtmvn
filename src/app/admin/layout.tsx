import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/auth-helpers";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) {
    redirect("/");
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-12">
      <p className="mb-6 font-heading text-sm tracking-widest text-accent">
        KHU VỰC QUẢN TRỊ
      </p>
      {children}
    </div>
  );
}
