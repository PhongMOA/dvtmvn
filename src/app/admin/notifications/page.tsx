"use client";

import { useState } from "react";
import { sendBroadcastNotification } from "@/app/actions/broadcast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

/**
 * Trang admin soạn + gửi push broadcast tới TẤT CẢ user đã cài app — dùng
 * được ngay qua browser thường (chỉ NGƯỜI NHẬN mới cần app cài trên máy, admin
 * gửi thì không). Xem plans/260826-1757-android-push-app/phase-04-admin-broadcast-push.md.
 */
export default function BroadcastPage() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  async function handleSend() {
    setSending(true);
    try {
      const res = await sendBroadcastNotification(title, body);
      if (!res.ok) {
        toast.error(
          res.error === "EMPTY"
            ? "Điền đủ tiêu đề và nội dung."
            : "Gửi thất bại, vui lòng thử lại.",
        );
        return;
      }
      toast.success(`Đã gửi tới ${res.sent}/${res.total} thiết bị.`);
      setTitle("");
      setBody("");
    } catch {
      // action throw (vd lỗi mạng/server ngoài dự kiến) — vẫn phải báo lỗi
      // và mở khoá nút thay vì để "Đang gửi..." kẹt vĩnh viễn.
      toast.error("Gửi thất bại, vui lòng thử lại.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex max-w-md flex-col gap-4">
      <h1 className="font-heading text-3xl tracking-wide text-primary">
        GỬI THÔNG BÁO
      </h1>
      <p className="text-sm text-muted-foreground">
        Gửi push notification thật tới tất cả thiết bị đã cài app MarvelVN và
        đăng nhập — kể cả khi app đang đóng.
      </p>
      <Input
        placeholder="Tiêu đề"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <Textarea
        placeholder="Nội dung"
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <Button disabled={sending} onClick={handleSend}>
        {sending ? "Đang gửi..." : "Gửi tới tất cả user"}
      </Button>
    </div>
  );
}
