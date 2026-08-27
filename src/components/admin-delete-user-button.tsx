"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteUser } from "@/app/actions/admin-users";
import { Button } from "@/components/ui/button";

const ERROR_LABEL: Record<string, string> = {
  NOT_FOUND: "Không tìm thấy user.",
  SELF: "Không thể tự xoá tài khoản của bạn.",
  IS_ADMIN: "Không thể xoá tài khoản admin.",
  HAS_ORDERS: "User đã có đơn hàng — không thể xoá.",
};

export function AdminDeleteUserButton({
  userId,
  label,
}: {
  userId: string;
  label: string;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    if (!window.confirm(`Xoá tài khoản "${label}"? Hành động không thể hoàn tác.`)) {
      return;
    }
    startTransition(async () => {
      const res = await deleteUser(userId);
      if (!res.ok) {
        toast.error(ERROR_LABEL[res.error] ?? "Xoá thất bại, thử lại sau.");
        return;
      }
      toast.success("Đã xoá tài khoản.");
      router.refresh();
    });
  }

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      disabled={isPending}
      onClick={handleClick}
    >
      {isPending ? "Đang xoá..." : "Xoá"}
    </Button>
  );
}
