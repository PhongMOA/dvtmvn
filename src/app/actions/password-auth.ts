"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAdminEmail } from "@/lib/auth-helpers";
import {
  EMAIL_RE,
  hashPassword,
  normalizeEmail,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "@/lib/password";

export type PasswordAuthState = { error?: string; email?: string; name?: string };

// Chỉ cho redirect nội bộ (path bắt đầu bằng "/", không phải "//host").
function safeCallbackUrl(raw: FormDataEntryValue | null): string {
  const value = typeof raw === "string" ? raw : "";
  return value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

/**
 * Đăng nhập bằng email + mật khẩu. signIn() thành công sẽ throw NEXT_REDIRECT —
 * phải để lỗi đó đi tiếp, chỉ bắt AuthError (sai mật khẩu...).
 */
export async function signInWithPassword(
  _prev: PasswordAuthState,
  formData: FormData,
): Promise<PasswordAuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Nhập email và mật khẩu.", email };

  try {
    await signIn("password", {
      email,
      password,
      redirectTo: safeCallbackUrl(formData.get("callbackUrl")),
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: "Email hoặc mật khẩu không đúng.", email };
    }
    throw err;
  }
  return {};
}

/** Tạo tài khoản mới rồi đăng nhập luôn. */
export async function registerWithPassword(
  _prev: PasswordAuthState,
  formData: FormData,
): Promise<PasswordAuthState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");
  const keep = { email, name };

  if (!name) return { error: "Nhập họ tên.", ...keep };
  if (name.length > 100) return { error: "Họ tên quá dài.", ...keep };
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return { error: "Email không hợp lệ.", ...keep };
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    return { error: `Mật khẩu tối thiểu ${PASSWORD_MIN_LENGTH} ký tự.`, ...keep };
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return { error: "Mật khẩu quá dài.", ...keep };
  }
  if (password !== confirm) return { error: "Mật khẩu nhập lại không khớp.", ...keep };

  // Email admin bootstrap (ADMIN_EMAIL) luôn có quyền admin theo email — không
  // cho đăng ký bằng mật khẩu vì đăng ký không xác minh quyền sở hữu email.
  if (isAdminEmail(email)) {
    return { error: "Email này phải đăng nhập bằng Google.", ...keep };
  }

  const existing = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { passwordHash: true },
  });
  if (existing) {
    return {
      error: existing.passwordHash
        ? "Email đã được đăng ký — chuyển sang tab Đăng nhập."
        : "Email đã có tài khoản Google — hãy đăng nhập bằng Google.",
      ...keep,
    };
  }

  try {
    await prisma.user.create({
      data: { email, name, passwordHash: await hashPassword(password) },
    });
  } catch {
    // Unique email bị trùng do 2 request đăng ký cùng lúc.
    return { error: "Không tạo được tài khoản, vui lòng thử lại.", ...keep };
  }

  try {
    await signIn("password", {
      email,
      password,
      redirectTo: safeCallbackUrl(formData.get("callbackUrl")),
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: "Đã tạo tài khoản, vui lòng đăng nhập lại.", email };
    }
    throw err;
  }
  return {};
}
