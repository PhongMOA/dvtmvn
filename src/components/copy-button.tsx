"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/**
 * Nút sao chép nhanh 1 giá trị (số tài khoản, nội dung chuyển khoản...) —
 * dùng cho trang thanh toán khi user mở ngay trên điện thoại dùng để chuyển
 * khoản, không tự quét camera vào màn hình chính nó được nên cần gõ tay
 * trong app ngân hàng.
 */
export function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(`Đã sao chép ${label}`);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Không sao chép được, vui lòng bấm giữ để copy thủ công.");
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={`Sao chép ${label}`}
      onClick={handleCopy}
    >
      {copied ? <Check className="text-primary" /> : <Copy />}
    </Button>
  );
}
