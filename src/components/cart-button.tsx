"use client";

import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { useCart } from "@/lib/cart";

/** Icon giỏ hàng trên header, badge = tổng số combo trong giỏ. */
export function CartButton() {
  const count = useCart().reduce((sum, line) => sum + line.quantity, 0);

  return (
    <Link
      href="/cart"
      aria-label={count > 0 ? `Giỏ hàng (${count})` : "Giỏ hàng"}
      className="relative flex size-9 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
    >
      <ShoppingCart className="size-5" />
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold leading-none text-accent-foreground tabular-nums">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
