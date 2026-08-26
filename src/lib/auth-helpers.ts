import { auth } from "@/auth";

export function isAdminEmail(email?: string | null): boolean {
  if (!email || !process.env.ADMIN_EMAIL) return false;
  return email.toLowerCase() === process.env.ADMIN_EMAIL.toLowerCase();
}

/** Bắt buộc đã đăng nhập — dùng trong Server Actions ghi dữ liệu. Throw nếu chưa login. */
export async function requireUser() {
  const session = await auth();
  if (!session?.user) {
    throw new Error("UNAUTHORIZED");
  }
  return session.user;
}

/** Bắt buộc là admin — dùng trong các Server Actions/pages của /admin. Throw nếu không phải admin. */
export async function requireAdmin() {
  const user = await requireUser();
  if (!isAdminEmail(user.email)) {
    throw new Error("FORBIDDEN");
  }
  return user;
}
