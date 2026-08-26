import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ProfileForm } from "@/components/profile-form";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) {
    redirect(`/sign-in?callbackUrl=${encodeURIComponent("/profile")}`);
  }

  // findUnique (không phải findUniqueOrThrow): session là JWT nên vẫn "hợp lệ"
  // ngay cả khi record User đã bị xoá khỏi DB (vd DB dev bị reset) — phải tự xử
  // lý case này bằng redirect thay vì để lỗi Prisma crash cả trang.
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) {
    redirect(`/sign-in?callbackUrl=${encodeURIComponent("/profile")}`);
  }

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-12">
      <h1 className="font-heading text-4xl tracking-wide text-primary">
        THÔNG TIN TÀI KHOẢN
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Số điện thoại và địa chỉ dùng để liên hệ khi giao vé/combo.
      </p>
      <ProfileForm
        name={user.name ?? ""}
        email={user.email}
        defaultPhone={user.phone ?? ""}
        defaultAddress={user.address ?? ""}
      />
    </div>
  );
}
