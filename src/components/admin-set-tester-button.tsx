"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { setUserTester } from "@/app/actions/admin-users";
import { Button } from "@/components/ui/button";

const ERROR_LABEL: Record<string, string> = {
  NOT_FOUND: "Không tìm thấy user.",
  IS_ADMIN: "Tài khoản admin đã có sẵn quyền test — gỡ admin trước nếu muốn.",
};

export function AdminSetTesterButton({
  userId,
  label,
  isTester,
}: {
  userId: string;
  label: string;
  isTester: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    const makeTester = !isTester;
    const confirmMsg = makeTester
      ? `Cấp quyền tester cho "${label}"? Tester được đặt thử combo trước giờ mở bán.`
      : `Gỡ quyền tester của "${label}"?`;
    if (!window.confirm(confirmMsg)) return;

    startTransition(async () => {
      const res = await setUserTester(userId, makeTester);
      if (!res.ok) {
        toast.error(ERROR_LABEL[res.error] ?? "Đổi quyền thất bại, thử lại sau.");
        return;
      }
      toast.success(makeTester ? "Đã cấp quyền tester." : "Đã gỡ quyền tester.");
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
      {isPending ? "Đang lưu..." : isTester ? "Gỡ tester" : "Cấp tester"}
    </Button>
  );
}
