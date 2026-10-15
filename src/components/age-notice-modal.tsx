"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import {
  Dialog,
  DialogPopup,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// Thông báo độ tuổi (Điều khoản mục 2 + 7) hiện 1 lần khi khách vào web lần đầu.
// Đã xác nhận -> lưu localStorage, không hiện lại trên trình duyệt đó. Chỉ là
// thông báo — chốt chặn thật là checkbox đồng ý điều khoản ở bước checkout.
const STORAGE_KEY = "age-notice-ack-v1";

function hasAcknowledged(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false; // chặn storage (chế độ riêng tư...) -> vẫn hiện, chỉ là không nhớ được
  }
}

// localStorage không phát sự kiện trong cùng tab -> không cần subscribe thật.
const subscribe = () => () => {};

export function AgeNoticeModal() {
  // Server snapshot = true (coi như đã xác nhận) để SSR không render modal, tránh
  // lệch hydration; client đọc localStorage thật.
  const acknowledged = useSyncExternalStore(subscribe, hasAcknowledged, () => true);
  const [closed, setClosed] = useState(false);

  function acknowledge() {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* không lưu được thì thôi — phiên này vẫn đóng */
    }
    setClosed(true);
  }

  if (acknowledged || closed) return null;

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) acknowledge();
      }}
      disablePointerDismissal
    >
      <DialogPopup showClose={false} className="w-[calc(100%-2rem)] text-center">
        <DialogHeader className="items-center">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full border-2 border-primary bg-primary/10 font-heading text-2xl text-primary">
            16+
          </div>
          <DialogTitle className="mt-3 text-center">LƯU Ý VỀ ĐỘ TUỔI</DialogTitle>
          <DialogDescription className="text-center">
            Bạn phải <strong className="text-foreground">từ đủ 16 tuổi trở lên</strong> để
            có thể mua vé và tham gia sự kiện offline. Người dưới 16 tuổi không được tham
            dự, kể cả khi có người lớn đi cùng.
          </DialogDescription>
        </DialogHeader>
        <p className="mt-3 text-sm text-muted-foreground">
          Người từ đủ 16 đến dưới 18 tuổi cần có sự đồng ý của cha mẹ hoặc người giám hộ.
          Ban tổ chức có thể yêu cầu xuất trình CCCD tại cổng vào.
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <Button onClick={acknowledge} className="w-full">
            Tôi đã hiểu
          </Button>
          <Link
            href="/dieu-khoan#tham-du"
            onClick={acknowledge}
            className="text-sm text-muted-foreground underline-offset-2 hover:text-primary hover:underline"
          >
            Xem Điều khoản và điều kiện sử dụng
          </Link>
        </div>
      </DialogPopup>
    </Dialog>
  );
}
