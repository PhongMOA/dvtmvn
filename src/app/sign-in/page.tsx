import { signIn } from "@/auth";
import { Button } from "@/components/ui/button";

export default async function SignInPage({
  searchParams,
}: PageProps<"/sign-in">) {
  const params = await searchParams;
  const callbackUrlRaw = params?.callbackUrl;
  const callbackUrl =
    typeof callbackUrlRaw === "string" ? callbackUrlRaw : "/";

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-24">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-8 text-center shadow-lg">
        <h1 className="font-heading text-3xl tracking-wide text-primary">
          ĐĂNG NHẬP
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Đăng nhập để đặt vé và lưu lại vé của bạn.
        </p>
        <form
          className="mt-6"
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: callbackUrl });
          }}
        >
          <Button type="submit" className="w-full" size="lg">
            Đăng nhập với Google
          </Button>
        </form>
      </div>
    </div>
  );
}
