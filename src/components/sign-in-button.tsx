"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn as nextAuthSignIn } from "next-auth/react";
import { SocialLogin } from "@capgo/capacitor-social-login";
import { toast } from "sonner";
import { useIsNativeApp } from "@/lib/is-native-app";
import { Button } from "@/components/ui/button";
import { GoogleLogo } from "@/components/google-logo";

/**
 * Nút "Đăng nhập với Google", rẽ nhánh theo môi trường chạy:
 * - App Android (Capacitor): đăng nhập native bằng @capgo/capacitor-social-login
 *   (không qua WebView vì Google chặn OAuth trong embedded WebView — lỗi
 *   "disallowed_useragent"), lấy idToken rồi gửi cho Credentials Provider
 *   "mobile-google" (xem auth.ts) để tạo session cookie ngay trong WebView.
 * - Web browser bình thường: giữ nguyên luồng cũ, dùng server action truyền
 *   vào qua prop `webSignInAction`.
 */
export function SignInButton({
  webSignInAction,
  callbackUrl,
}: {
  webSignInAction: () => Promise<void>;
  callbackUrl: string;
}) {
  const router = useRouter();
  const isNative = useIsNativeApp();
  const [loading, setLoading] = useState(false);

  // initialize() 1 lần lúc mount thay vì gọi lại mỗi lần bấm nút — plugin
  // native chỉ cần cấu hình 1 lần, gọi lại nhiều lần không cần thiết và có
  // thể chồng lấn nếu user bấm nhiều lần liên tiếp trước khi login xong.
  useEffect(() => {
    if (!isNative) return;
    SocialLogin.initialize({
      google: {
        // Web Client ID (không phải Android Client ID) — xem giải thích
        // trong .env.example / auth.ts.
        webClientId: process.env.NEXT_PUBLIC_AUTH_GOOGLE_ID,
      },
    }).catch(() => {});
  }, [isNative]);

  async function handleNativeSignIn() {
    setLoading(true);
    try {
      const { result } = await SocialLogin.login({
        provider: "google",
        options: {},
      });
      const idToken = "idToken" in result ? result.idToken : null;
      if (!idToken) {
        toast.error("Không lấy được thông tin đăng nhập từ Google.");
        return;
      }

      const res = await nextAuthSignIn("mobile-google", {
        idToken,
        redirect: false,
      });
      if (res?.error) {
        toast.error("Đăng nhập thất bại. Vui lòng thử lại.");
        return;
      }
      router.push(callbackUrl);
      router.refresh();
    } catch (error) {
      const code =
        error && typeof error === "object" && "code" in error
          ? (error as { code?: string }).code
          : undefined;
      if (code !== "USER_CANCELLED") {
        toast.error("Đăng nhập thất bại. Vui lòng thử lại.");
      }
    } finally {
      setLoading(false);
    }
  }

  if (isNative) {
    return (
      <Button
        type="button"
        className="w-full gap-3"
        size="lg"
        disabled={loading}
        onClick={handleNativeSignIn}
      >
        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-white">
          <GoogleLogo className="size-3" />
        </span>
        {loading ? "Đang đăng nhập..." : "Đăng nhập với Google"}
      </Button>
    );
  }

  return (
    <form action={webSignInAction}>
      <Button type="submit" className="w-full gap-3" size="lg">
        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-white">
          <GoogleLogo className="size-3" />
        </span>
        Đăng nhập với Google
      </Button>
    </form>
  );
}
