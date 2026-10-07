"use client";

import { useActionState, useState } from "react";
import {
  registerWithPassword,
  signInWithPassword,
  type PasswordAuthState,
} from "@/app/actions/password-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Mode = "sign-in" | "register";

/** Đăng nhập / đăng ký bằng email + mật khẩu (song song nút Google). */
export function PasswordAuthForm({
  callbackUrl,
  defaultMode = "sign-in",
}: {
  callbackUrl: string;
  defaultMode?: Mode;
}) {
  const [mode, setMode] = useState<Mode>(defaultMode);

  return (
    <div className="text-left">
      <div className="grid grid-cols-2 rounded-md border border-border p-1 text-sm">
        {(
          [
            ["sign-in", "Đăng nhập"],
            ["register", "Đăng ký"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setMode(value)}
            aria-pressed={mode === value}
            className={cn(
              "rounded-sm py-1.5 font-medium transition-colors",
              mode === value
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {/* key: đổi tab thì mount lại form, xoá lỗi/giá trị của tab kia */}
      {mode === "sign-in" ? (
        <SignInForm key="sign-in" callbackUrl={callbackUrl} />
      ) : (
        <RegisterForm key="register" callbackUrl={callbackUrl} />
      )}
    </div>
  );
}

function ErrorText({ state }: { state: PasswordAuthState }) {
  if (!state.error) return null;
  return (
    <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {state.error}
    </p>
  );
}

function SignInForm({ callbackUrl }: { callbackUrl: string }) {
  const [state, formAction, isPending] = useActionState<PasswordAuthState, FormData>(
    signInWithPassword,
    {},
  );

  return (
    <form action={formAction} className="mt-4 flex flex-col gap-3">
      <input type="hidden" name="callbackUrl" value={callbackUrl} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="signin-email">Email</Label>
        <Input
          id="signin-email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={state.email}
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="signin-password">Mật khẩu</Label>
        <Input
          id="signin-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      <ErrorText state={state} />
      <Button type="submit" size="lg" disabled={isPending}>
        {isPending ? "Đang đăng nhập..." : "Đăng nhập"}
      </Button>
    </form>
  );
}

function RegisterForm({ callbackUrl }: { callbackUrl: string }) {
  const [state, formAction, isPending] = useActionState<PasswordAuthState, FormData>(
    registerWithPassword,
    {},
  );

  return (
    <form action={formAction} className="mt-4 flex flex-col gap-3">
      <input type="hidden" name="callbackUrl" value={callbackUrl} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="register-name">Họ tên</Label>
        <Input
          id="register-name"
          name="name"
          autoComplete="name"
          maxLength={100}
          defaultValue={state.name}
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="register-email">Email</Label>
        <Input
          id="register-email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={state.email}
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="register-password">Mật khẩu</Label>
        <Input
          id="register-password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          maxLength={128}
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="register-confirm">Nhập lại mật khẩu</Label>
        <Input
          id="register-confirm"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          minLength={8}
          maxLength={128}
          required
        />
      </div>
      <ErrorText state={state} />
      <Button type="submit" size="lg" disabled={isPending}>
        {isPending ? "Đang tạo tài khoản..." : "Tạo tài khoản"}
      </Button>
    </form>
  );
}
