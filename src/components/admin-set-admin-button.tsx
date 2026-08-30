"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { setUserAdmin } from "@/app/actions/admin-users";
import { Button } from "@/components/ui/button";

const ERROR_LABEL: Record<string, string> = {
  NOT_FOUND: "Không tìm thấy user.",
  SELF: "Không thể tự đổi quyền của chính bạn.",
  ENV_ADMIN: "Tài khoản admin cấu hình qua ADMIN_EMAIL — không đổi được.",
};

export function AdminSetAdminButton({
  userId,
  label,
  isAdmin,
}: {
  userId: string;
  label: string;
  isAdmin: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    const makeAdmin = !isAdmin;
    const confirmMsg = makeAdmin
      ? `Cấp quyền admin cho "${label}"?`
      : `Gỡ quyền admin của "${label}"?`;
    if (!window.confirm(confirmMsg)) return;

    startTransition(async () => {
      const res = await setUserAdmin(userId, makeAdmin);
      if (!res.ok) {
        toast.error(ERROR_LABEL[res.error] ?? "Đổi quyền thất bại, thử lại sau.");
        return;
      }
      toast.success(makeAdmin ? "Đã cấp quyền admin." : "Đã gỡ quyền admin.");
      router.refresh();
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={isPending}
      onClick={handleClick}
    >
      {isPending
        ? "Đang lưu..."
        : isAdmin
          ? "Gỡ admin"
          : "Cấp admin"}
    </Button>
  );
}
