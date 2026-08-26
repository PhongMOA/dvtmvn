import Link from "next/link";
import { auth, signOut } from "@/auth";
import { isAdminEmail } from "@/lib/auth-helpers";
import { buttonVariants } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuLinkItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export async function UserNav() {
  const session = await auth();
  const user = session?.user;

  if (!user) {
    return (
      <Link href="/sign-in" className={cn(buttonVariants({ size: "sm" }))}>
        Đăng nhập
      </Link>
    );
  }

  const isAdmin = isAdminEmail(user.email);
  const displayName = user.name ?? user.email ?? "Người dùng";
  const initial = displayName.trim().charAt(0).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex items-center gap-2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Avatar size="sm">
          {user.image && (
            <AvatarImage
              src={user.image}
              alt={displayName}
              referrerPolicy="no-referrer"
            />
          )}
          <AvatarFallback>{initial}</AvatarFallback>
        </Avatar>
        <span className="hidden text-sm text-muted-foreground sm:inline">
          {displayName}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col gap-0.5">
              <span className="truncate text-sm font-medium text-foreground">
                {displayName}
              </span>
              {user.email && (
                <span className="truncate text-xs text-muted-foreground">
                  {user.email}
                </span>
              )}
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLinkItem href="/my-tickets">Vé của tôi</DropdownMenuLinkItem>
        <DropdownMenuLinkItem href="/profile">Thông tin tài khoản</DropdownMenuLinkItem>
        {isAdmin && (
          <DropdownMenuLinkItem href="/admin/events">Quản trị</DropdownMenuLinkItem>
        )}
        <DropdownMenuSeparator />
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/" });
          }}
        >
          <DropdownMenuItem
            variant="destructive"
            nativeButton
            render={<button type="submit" className="w-full text-left" />}
          >
            Đăng xuất
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
