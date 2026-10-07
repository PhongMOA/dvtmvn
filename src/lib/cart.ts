"use client";

import { useSyncExternalStore } from "react";

/**
 * Giỏ hàng combo — lưu ở localStorage của trình duyệt (không lưu DB): chỉ là danh
 * sách {comboTypeId, quantity}, giá + tồn kho luôn lấy lại từ server lúc hiển thị
 * (/cart) và lúc đặt (bookCombos kiểm tra lại toàn bộ). Đồng bộ giữa các tab qua
 * sự kiện "storage".
 */
export type CartLine = { comboTypeId: string; quantity: number };

const STORAGE_KEY = "marvelvn-cart-v1";
const EMPTY: CartLine[] = [];

let cachedRaw: string | null = null;
let cached: CartLine[] = EMPTY;
// localStorage bị chặn (private mode / WebView cấu hình chặt) -> giữ giỏ trong RAM.
let storageBroken = false;
const listeners = new Set<() => void>();

function parse(raw: string | null): CartLine[] {
  if (!raw) return EMPTY;
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return EMPTY;
    return data.filter(
      (line): line is CartLine =>
        typeof line?.comboTypeId === "string" &&
        Number.isInteger(line?.quantity) &&
        line.quantity > 0,
    );
  } catch {
    return EMPTY;
  }
}

function read(): CartLine[] {
  if (storageBroken) return cached;
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    storageBroken = true;
    return cached;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cached = parse(raw);
  }
  return cached;
}

function write(lines: CartLine[]) {
  const raw = JSON.stringify(lines);
  if (!storageBroken) {
    try {
      window.localStorage.setItem(STORAGE_KEY, raw);
    } catch {
      storageBroken = true;
    }
  }
  cachedRaw = raw;
  cached = lines;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useCart(): CartLine[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

/**
 * Cộng thêm `quantity` vào dòng của combo (tạo mới nếu chưa có), không vượt
 * `max` (tồn kho hiện tại). Trả về số lượng thực tế của dòng sau khi thêm.
 */
export function addToCart(comboTypeId: string, quantity: number, max: number): number {
  const lines = read();
  const current = lines.find((line) => line.comboTypeId === comboTypeId)?.quantity ?? 0;
  const next = Math.min(current + quantity, max);
  if (next < 1) return current;
  write(
    current
      ? lines.map((line) =>
          line.comboTypeId === comboTypeId ? { ...line, quantity: next } : line,
        )
      : [...lines, { comboTypeId, quantity: next }],
  );
  return next;
}

export function setCartQuantity(comboTypeId: string, quantity: number) {
  if (quantity < 1) return removeFromCart(comboTypeId);
  write(
    read().map((line) =>
      line.comboTypeId === comboTypeId ? { ...line, quantity } : line,
    ),
  );
}

export function removeFromCart(comboTypeId: string) {
  write(read().filter((line) => line.comboTypeId !== comboTypeId));
}

export function clearCart() {
  write(EMPTY);
}
