import { cn } from "@/lib/utils";

/**
 * Logo "G" 4 màu chính thức của Google, dùng cho nút "Đăng nhập với Google"
 * (xem src/app/sign-in/page.tsx) — màu cố định theo brand Google, không ăn
 * theo theme token của app.
 */
export function GoogleLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" role="img" aria-hidden className={cn("size-4", className)}>
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47a5.53 5.53 0 0 1-2.4 3.63v2.98h3.87c2.27-2.09 3.58-5.17 3.58-8.8Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.95-2.9l-3.87-2.98c-1.08.72-2.45 1.15-4.08 1.15-3.13 0-5.79-2.11-6.74-4.96H1.26v3.07A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.26 14.31A7.2 7.2 0 0 1 4.88 12c0-.8.14-1.58.38-2.31V6.62H1.26A12 12 0 0 0 0 12c0 1.94.47 3.77 1.26 5.38l4-3.07Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.26 6.62l4 3.07c.95-2.85 3.61-4.94 6.74-4.94Z"
      />
    </svg>
  );
}
