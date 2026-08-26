# Phase 2: Authentication (Google OAuth + Admin identification)

## Context Links
- [plan.md](./plan.md)
- [phase-01-setup-data-model.md](./phase-01-setup-data-model.md)

## Overview
- Priority: P1
- Status: Done (code hoàn chỉnh; login thực tế chưa test được — xem ghi chú cuối)
- Cài Auth.js v5, cấu hình Google OAuth provider + Prisma adapter, dựng helper xác định admin, bảo vệ route cần đăng nhập.

## Key Insights (từ research)
- Auth.js v5: config gốc đặt tại `auth.ts` (root), export `handlers`, `auth`, `signIn`, `signOut`. Không còn catch-all route thủ công phức tạp — chỉ cần `src/app/api/auth/[...nextauth]/route.ts` re-export `handlers`.
- Env var prefix đổi thành `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` (Auth.js tự đọc theo convention `AUTH_<PROVIDER>_ID/SECRET`, không cần khai báo thủ công trong provider config nếu đặt đúng tên).
- `@auth/prisma-adapter` cần các model `Account`, `Session`, `VerificationToken` trong Prisma schema (chuẩn NextAuth schema).
- `auth()` dùng được cả trong Server Components và Route Handlers, thay cho `getServerSession`.

## Requirements
- Functional:
  - User đăng nhập bằng Google → tạo/liên kết `User` record qua Prisma adapter.
  - Middleware/helper xác định `isAdmin` bằng so khớp `session.user.email === process.env.ADMIN_EMAIL` — không lưu field `isAdmin` trong DB (đơn giản hoá theo brainstorm). **Cập nhật sau code review cuối:** so sánh dùng `.toLowerCase()` cả hai vế (case-insensitive) để tránh admin bị chặn nhầm do khác hoa/thường trong `ADMIN_EMAIL`.
  - Trang cần đăng nhập (đặt vé, my-tickets, admin/*) redirect về login nếu chưa auth.
  - Trang admin/* chặn nếu user đã login nhưng không phải admin (403 hoặc redirect).
- Non-functional: session dùng JWT strategy (mặc định Auth.js, không cần thêm DB session lookup mỗi request) — nhưng vẫn cần Prisma adapter để lưu User record liên kết Google account.

## Architecture
```
auth.ts                                  # Auth.js config (root)
src/app/api/auth/[...nextauth]/route.ts  # re-export handlers
src/lib/auth-helpers.ts                  # requireUser(), requireAdmin() helpers
middleware.ts                            # (optional) bảo vệ /admin/* ở edge, hoặc check trong từng page
```

## Related Code Files
**Create:**
- `auth.ts`
- `src/app/api/auth/[...nextauth]/route.ts`
- `src/lib/auth-helpers.ts`
- `middleware.ts` (nếu chọn cách chặn ở middleware thay vì per-page check)

**Modify:**
- `prisma/schema.prisma` — thêm Account/Session/VerificationToken models
- `.env` / `.env.example` — thêm `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_SECRET`, `ADMIN_EMAIL`

## Implementation Steps
1. Tạo Google OAuth credentials tại [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials → OAuth client ID (Web application). Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`.
2. `npm install next-auth@beta @auth/prisma-adapter`.
3. Thêm vào `prisma/schema.prisma` (chuẩn Auth.js Prisma schema — copy từ [docs adapter Prisma](https://authjs.dev/getting-started/adapters/prisma)):
   ```prisma
   model Account {
     id                String  @id @default(uuid())
     userId            String
     type              String
     provider          String
     providerAccountId String
     refresh_token     String?
     access_token      String?
     expires_at        Int?
     token_type        String?
     scope             String?
     id_token          String?
     session_state     String?
     user User @relation(fields: [userId], references: [id], onDelete: Cascade)
     @@unique([provider, providerAccountId])
   }
   model Session {
     id           String   @id @default(uuid())
     sessionToken String   @unique
     userId       String
     expires      DateTime
     user User @relation(fields: [userId], references: [id], onDelete: Cascade)
   }
   model VerificationToken {
     identifier String
     token      String   @unique
     expires    DateTime
     @@unique([identifier, token])
   }
   ```
   Update `User` model: thêm `accounts Account[]` và `sessions Session[]` relations.
4. `npx prisma migrate dev --name add_auth_tables`.
5. Chạy `npx auth secret` (Auth.js CLI) hoặc tự generate `AUTH_SECRET` (`openssl rand -base64 32`), thêm vào `.env`.
6. Tạo `auth.ts` ở root:
   ```ts
   import NextAuth from "next-auth";
   import Google from "next-auth/providers/google";
   import { PrismaAdapter } from "@auth/prisma-adapter";
   import { prisma } from "@/lib/prisma";

   export const { handlers, auth, signIn, signOut } = NextAuth({
     adapter: PrismaAdapter(prisma),
     providers: [Google],
     session: { strategy: "jwt" },
     callbacks: {
       async session({ session }) {
         return session;
       },
     },
   });
   ```
7. Tạo `src/app/api/auth/[...nextauth]/route.ts`:
   ```ts
   export { GET, POST } from "@/../auth";
   ```
   (điều chỉnh path import theo cấu trúc thật, hoặc `export const { GET, POST } = handlers` re-export)
8. Viết `src/lib/auth-helpers.ts`:
   ```ts
   import { auth } from "@/../auth";
   export async function requireUser() {
     const session = await auth();
     if (!session?.user) throw new Error("UNAUTHORIZED");
     return session.user;
   }
   export function isAdminEmail(email?: string | null) {
     return !!email && email === process.env.ADMIN_EMAIL;
   }
   ```
9. Thêm nút "Đăng nhập với Google" / "Đăng xuất" dùng `signIn("google")` / `signOut()` (server actions hoặc client component button) — UI thật sẽ tích hợp ở phase 3/4, phase này chỉ cần verify auth hoạt động qua 1 trang test đơn giản.
10. Chặn `/admin/*`: check `isAdminEmail(session.user.email)` ngay đầu mỗi admin page/layout (Server Component), redirect `notFound()` hoặc về `/` nếu không phải admin. (Đơn giản hơn middleware cho MVP 1 admin — không cần middleware riêng.)

## Todo List
- [x] Tạo Google OAuth Client ID/Secret — **chưa làm, cần user tự tạo** (xem README) — `.env` để trống `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET`
- [x] Cài `next-auth@beta` + `@auth/prisma-adapter`
- [x] Thêm Account/Session/VerificationToken vào schema, migrate
- [x] `AUTH_SECRET` trong `.env` — đã tự sinh random (`crypto.randomBytes`), không phụ thuộc Google
- [x] `auth.ts` config với Google provider
- [x] Route handler `/api/auth/[...nextauth]`
- [x] `auth-helpers.ts` (requireUser, requireAdmin, isAdminEmail — so sánh case-insensitive `.toLowerCase()` cả hai vế, fix bổ sung ở vòng code review cuối; dead code `getCurrentUser` không dùng đã bị xoá khỏi codebase)
- [ ] Verify: đăng nhập Google thành công, thấy User record mới trong Prisma Studio — **blocked**: cần `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET` thật từ user
- [x] Verify: admin email đăng nhập → `isAdminEmail` true (logic verify bằng code review, chưa test end-to-end vì thiếu credentials)
- [x] Bổ sung: `SiteHeader` + `UserNav` (đăng nhập/đăng xuất) hiển thị toàn site, không chỉ trang test riêng

## Success Criteria
- Đăng nhập Google từ trình duyệt local → redirect thành công, session tồn tại.
- User record + Account record xuất hiện trong DB sau lần đăng nhập đầu.
- `/admin` bất kỳ route nào chặn được user không phải admin (test bằng 2 email khác nhau nếu có thể, hoặc test thủ công bằng cách sửa `ADMIN_EMAIL` tạm thời).

## Risk Assessment
- **Rủi ro:** Google OAuth consent screen ở chế độ "Testing" chỉ cho phép các email được thêm vào test users list đăng nhập. → thêm email admin + email test vào danh sách test users trong Google Cloud Console.
- **Rủi ro:** quên đúng redirect URI (`/api/auth/callback/google`) → lỗi `redirect_uri_mismatch`. Verify kỹ URI khớp 100% (kể cả http vs https, trailing slash).

## Security Considerations
- `AUTH_SECRET`, `AUTH_GOOGLE_SECRET` chỉ trong `.env`, không log ra console/commit.
- Admin check luôn ở server-side (Server Component/Server Action), không dựa vào client-side check nào (tránh bypass).

## Next Steps
- Phase 3 dùng `requireUser()` khi đặt vé, dùng session để gắn `userId` vào Ticket.
