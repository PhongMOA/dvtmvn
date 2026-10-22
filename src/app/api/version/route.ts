/**
 * Mã bản build của server đang chạy — client (update-watcher) gọi định kỳ,
 * thấy khác mã của mình thì biết đã có deploy mới. Giá trị inline lúc build
 * (next.config.ts).
 */
export function GET() {
  return Response.json(
    {
      buildId: process.env.NEXT_PUBLIC_BUILD_ID,
      builtAt: process.env.NEXT_PUBLIC_BUILT_AT,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
