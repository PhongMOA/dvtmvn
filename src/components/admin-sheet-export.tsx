"use client";

import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Nút xuất đơn sang Google Sheets cho trang quản lý đơn. Mở ra công thức
 * =IMPORTDATA("<link CSV có token>") để dán vào 1 ô của Sheet — Sheet tự kéo
 * lại dữ liệu định kỳ (Google tự refresh ~1 giờ/lần). Kèm link tải CSV trực
 * tiếp (dùng phiên đăng nhập admin, không cần token).
 * `sheetUrl` null = server chưa cấu hình ORDERS_EXPORT_TOKEN.
 */
export function AdminSheetExport({
  sheetUrl,
  downloadUrl,
}: {
  sheetUrl: string | null;
  downloadUrl: string;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const formula = sheetUrl ? `=IMPORTDATA("${sheetUrl}")` : "";

  async function copy() {
    try {
      await navigator.clipboard.writeText(formula);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Trình duyệt chặn clipboard -> admin tự bôi đen ô input để copy.
    }
  }

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Đóng" : "Xuất Google Sheet"}
        </Button>
        <a
          href={downloadUrl}
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
        >
          Tải CSV
        </a>
      </div>

      {open && (
        <div className="mt-2 rounded-xl border border-border bg-card p-4 text-sm">
          {sheetUrl ? (
            <>
              <p className="text-muted-foreground">
                Dán công thức dưới đây vào ô <b className="text-foreground">A1</b>{" "}
                của một Google Sheet. Sheet sẽ tự cập nhật đơn mới (Google làm
                mới khoảng mỗi giờ). Công thức giữ đúng bộ lọc đang chọn.
              </p>
              <div className="mt-3 flex gap-2">
                <Input
                  readOnly
                  value={formula}
                  onFocus={(e) => e.currentTarget.select()}
                  className="font-mono text-xs"
                />
                <Button type="button" size="sm" onClick={copy}>
                  {copied ? "Đã copy" : "Copy"}
                </Button>
              </div>
              <p className="mt-2 text-xs text-destructive">
                Link chứa token bí mật: ai có link đều xem được tên, email, SĐT
                khách. Chỉ chia sẻ Sheet cho người cần; lộ link thì đổi
                ORDERS_EXPORT_TOKEN trong .env.
              </p>
            </>
          ) : (
            <p className="text-muted-foreground">
              Chưa cấu hình <code className="font-mono">ORDERS_EXPORT_TOKEN</code>{" "}
              trong .env nên chưa tạo được link đồng bộ Google Sheet. Vẫn có thể
              bấm &quot;Tải CSV&quot; rồi vào Google Sheets → Tệp → Nhập.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
