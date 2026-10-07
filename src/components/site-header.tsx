import Link from "next/link";
import { Logo } from "@/components/logo";
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
          {session?.user && <CartButton />}
          <UserNav />
        </div>
      </div>
    </header>
  );
}
