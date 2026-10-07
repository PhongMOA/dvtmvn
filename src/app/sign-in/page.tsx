import { signIn } from "@/auth";
import { SignInButton } from "@/components/sign-in-button";
import { PasswordAuthForm } from "@/components/password-auth-form";

export default async function SignInPage({
  searchParams,
}: PageProps<"/sign-in">) {
  const params = await searchParams;
  const callbackUrlRaw = params?.callbackUrl;
  const callbackUrl =
    typeof callbackUrlRaw === "string" ? callbackUrlRaw : "/";
  const defaultMode = params?.mode === "register" ? "register" : "sign-in";

  // Auth.js redirect về đây kèm ?error=<code> khi luồng OAuth lỗi. Nếu không
  // hiện gì, user chỉ thấy "bấm đăng nhập xong quay lại trang này" mà không
  // biết vì sao.
  const errorCode =
    typeof params?.error === "string" ? params.error : undefined;
  const errorMessage = errorCode
    ? errorCode === "OAuthAccountNotLinked"
      ? "Email này đã có tài khoản nhưng chưa liên kết với Google. Thử đăng nhập lại — nếu vẫn lỗi, liên hệ admin."
      : "Đăng nhập không thành công. Vui lòng thử lại."
    : undefined;

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-24">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-8 text-center shadow-lg">
        <h1 className="font-heading text-3xl tracking-wide text-primary">
          ĐĂNG NHẬP
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Đăng nhập bằng Google hoặc tạo tài khoản bằng email để đặt vé và
          lưu lại vé của bạn.
        </p>
        {errorMessage && (
          <p className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {errorMessage}
          </p>
        )}
        <div className="mt-6">
          <SignInButton
            callbackUrl={callbackUrl}
            webSignInAction={async () => {
              "use server";
              await signIn("google", { redirectTo: callbackUrl });
            }}
          />
        </div>
        <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          hoặc dùng email
          <span className="h-px flex-1 bg-border" />
        </div>
        <PasswordAuthForm callbackUrl={callbackUrl} defaultMode={defaultMode} />
      </div>
    </div>
  );
}
