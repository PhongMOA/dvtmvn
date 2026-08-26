import Link from "next/link";
import { Logo } from "@/components/logo";
import { UserNav } from "@/components/user-nav";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
        <Link href="/" className="flex items-center">
          <Logo className="h-9 sm:h-11" />
        </Link>
        <UserNav />
      </div>
    </header>
  );
}
