import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/** Admin "bootstrap" từ env — email này LUÔN là admin, không set/gỡ được qua UI. */
export function isAdminEmail(email?: string | null): boolean {
  if (!email || !process.env.ADMIN_EMAIL) return false;
  return email.toLowerCase() === process.env.ADMIN_EMAIL.toLowerCase();
}

/**
 * Kiểm tra 1 user có quyền admin không: email khớp ADMIN_EMAIL (bootstrap) HOẶC
 * cột User.role == "admin" (set qua /admin/users). Đọc role trực tiếp từ DB —
 * KHÔNG dựa vào session/JWT, để việc set/gỡ admin có hiệu lực ngay mà không cần
 * user đăng nhập lại.
 */
export async function isAdmin(
  user?: { id?: string | null; email?: string | null } | null,
): Promise<boolean> {
  if (!user) return false;
  if (isAdminEmail(user.email)) return true;
  if (!user.id) return false;
  const record = await prisma.user.findUnique({
    where: { id: user.id },
    select: { role: true },
  });
  return record?.role === "admin";
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
  if (!(await isAdmin(user))) {
    throw new Error("FORBIDDEN");
  }
  return user;
}
