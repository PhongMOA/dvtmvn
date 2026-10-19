"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { setUserStaff, setUserTester } from "@/app/actions/admin-users";
import { Button } from "@/components/ui/button";

// Cấp/gỡ 1 role phụ (không phải admin) — tester hoặc staff.
const ROLES = {
  tester: {
    action: setUserTester,
    grantHint: "Tester được đặt thử combo trước giờ mở bán.",
    isAdminError: "Tài khoản admin đã có sẵn quyền test — gỡ admin trước nếu muốn.",
  },
  staff: {
    action: setUserStaff,
    grantHint: "Staff được check-in khách ở /kiosk và quét QR, không vào được /admin.",
    isAdminError: "Tài khoản admin đã có sẵn quyền check-in — gỡ admin trước nếu muốn.",
  },
} as const;

export function AdminSetRoleButton({
  userId,
  label,
  role,
  hasRole,
}: {
  userId: string;
  label: string;
  role: keyof typeof ROLES;
  hasRole: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const config = ROLES[role];

  function handleClick() {
    const grant = !hasRole;
    const confirmMsg = grant
      ? `Cấp quyền ${role} cho "${label}"? ${config.grantHint}`
      : `Gỡ quyền ${role} của "${label}"?`;
    if (!window.confirm(confirmMsg)) return;

    startTransition(async () => {
      const res = await config.action(userId, grant);
      if (!res.ok) {
        toast.error(
          res.error === "IS_ADMIN"
            ? config.isAdminError
            : res.error === "NOT_FOUND"
              ? "Không tìm thấy user."
              : "Đổi quyền thất bại, thử lại sau.",
        );
        return;
      }
      toast.success(grant ? `Đã cấp quyền ${role}.` : `Đã gỡ quyền ${role}.`);
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
      {isPending ? "Đang lưu..." : `${hasRole ? "Gỡ" : "Cấp"} ${role}`}
    </Button>
  );
}
