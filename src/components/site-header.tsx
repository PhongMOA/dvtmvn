import Link from "next/link";
import { Clapperboard } from "lucide-react";
import { Logo } from "@/components/logo";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { UserNav } from "@/components/user-nav";
import { CartButton } from "@/components/cart-button";
import { auth } from "@/auth";

export async function SiteHeader() {
  const session = await auth();

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
        <Link href="/" className="flex items-center">
          <Logo className="h-9 sm:h-11" />
        </Link>
        <div className="flex items-center gap-2">
          {/* Trang tĩnh trong public/ -> dùng <a> thường, không qua router. */}
          <a
            href="/dong-thoi-gian-mcu.html"
            title="Dòng thời gian MCU"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "text-muted-foreground hover:text-primary",
            )}
          >
            <Clapperboard className="size-4" />
            <span className="sr-only sm:not-sr-only">Dòng thời gian MCU</span>
          </a>
          {session?.user && <CartButton />}
          <UserNav />
        </div>
      </div>
    </header>
  );
}
