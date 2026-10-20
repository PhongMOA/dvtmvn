"use client";

import { useState } from "react";

// SĐT VN 10 số; server so 9 số cuối (phoneKey) nên chấp nhận từ 9 số.
const MIN_DIGITS = 9;
const MAX_DIGITS = 11;

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "back"] as const;

/** Bàn phím số trên kiosk (không dùng bàn phím ảo của hệ điều hành). */
export function PhoneKeypad({ onSubmit, onCancel }: { onSubmit: (phone: string) => void; onCancel: () => void }) {
  const [digits, setDigits] = useState("");

  function press(key: (typeof KEYS)[number]) {
    if (key === "back") setDigits((d) => d.slice(0, -1));
    else if (key === "clear") setDigits("");
    else setDigits((d) => (d.length < MAX_DIGITS ? d + key : d));
  }

  return (
    <div className="flex w-full max-w-xs flex-col items-center gap-4">
      <p className="text-lg font-semibold">Nhập số điện thoại đặt vé</p>
      <p
        aria-live="polite"
        className="h-14 w-full rounded-xl border border-border bg-background/60 px-4 text-center font-mono text-3xl leading-[3.5rem] tracking-[0.15em]"
      >
        {formatPhone(digits) || <span className="text-muted-foreground/50">0•••••••••</span>}
      </p>
      <div className="grid w-full grid-cols-3 gap-2">
        {KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => press(key)}
            aria-label={key === "back" ? "Xoá 1 số" : key === "clear" ? "Xoá hết" : key}
            className={
              key === "back" || key === "clear"
                ? "h-12 rounded-xl text-sm text-muted-foreground transition active:scale-95 active:bg-secondary"
                : "h-12 rounded-xl border border-border bg-secondary/60 text-2xl font-semibold transition active:scale-95 active:bg-secondary"
            }
          >
            {key === "back" ? "⌫" : key === "clear" ? "Xoá" : key}
          </button>
        ))}
      </div>
      <div className="flex w-full gap-2">
        <button type="button" onClick={onCancel} className="kiosk-btn kiosk-btn-ghost flex-1">
          Quay lại
        </button>
        <button
          type="button"
          disabled={digits.length < MIN_DIGITS}
          onClick={() => onSubmit(digits)}
          className="kiosk-btn kiosk-btn-primary flex-[2]"
        >
          Tiếp tục
        </button>
      </div>
    </div>
  );
}

/** 0901234567 -> 0901 234 567 cho dễ đọc. */
function formatPhone(d: string): string {
  return [d.slice(0, 4), d.slice(4, 7), d.slice(7)].filter(Boolean).join(" ");
}
