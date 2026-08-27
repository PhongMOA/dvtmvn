import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { OAuth2Client } from "google-auth-library";
import { prisma } from "@/lib/prisma";

// Google chặn OAuth authorization endpoint khi user-agent là embedded WebView
// (lỗi "disallowed_useragent", chính sách từ 2/2023) — nên Google Provider
// phía trên KHÔNG dùng được nguyên xi trong app Android (Capacitor WebView).
// App native đăng nhập Google bằng plugin native (@capgo/capacitor-social-login,
// không đi qua WebView) lấy idToken, rồi gửi idToken đó cho Credentials
// Provider này verify + set session cookie ngay trong chính WebView (cùng
// origin -> cookie lưu đúng). Web browser bình thường vẫn dùng Google Provider
// ở trên, không đổi gì. Xem
// plans/260826-1757-android-push-app/phase-01-capacitor-scaffold-auth.md.
const mobileGoogleClient = new OAuth2Client();

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Google,
    Credentials({
      id: "mobile-google",
      name: "Google (app di động)",
      credentials: { idToken: { label: "ID Token", type: "text" } },
      async authorize(credentials) {
        const idToken = credentials?.idToken;
        if (typeof idToken !== "string" || !idToken) return null;

        let payload;
        try {
          // audience PHẢI là Web Client ID (AUTH_GOOGLE_ID có sẵn ở trên),
          // KHÔNG phải Android Client ID — Google Credential Manager luôn
          // phát hành idToken với audience = webClientId truyền vào
          // SocialLogin.initialize(), dù app đang chạy là Android. Client ID
          // loại "Android" (kèm SHA-1) chỉ đăng ký trong Cloud Console để
          // xác thực chữ ký APK, không dùng làm audience ở đây — nhầm lẫn
          // này là lỗi phổ biến nhất khi tích hợp (xem README plugin
          // @capgo/capacitor-social-login, mục "Android troubleshooting").
          const ticket = await mobileGoogleClient.verifyIdToken({
            idToken,
            audience: process.env.AUTH_GOOGLE_ID,
          });
          payload = ticket.getPayload();
        } catch {
          return null; // idToken giả/hết hạn/sai audience
        }
        if (!payload?.email) return null;
        // Credentials Provider tự resolve user theo email thủ công ở dưới —
        // KHÔNG đi qua cơ chế account-linking an toàn của Auth.js (cơ chế đó
        // chỉ áp dụng cho OAuth Provider chuẩn). Nếu tin email trong idToken
        // mà không kiểm tra đã verify, 1 idToken hợp lệ về chữ ký nhưng gắn
        // với email chưa xác minh (vd tài khoản Workspace/email phụ) có thể
        // chiếm quyền vào đúng User đã tồn tại của email đó.
        if (payload.email_verified !== true) return null;

        // Tìm/tạo User giống cách PrismaAdapter làm cho Google Provider —
        // cùng 1 bảng User, khớp theo email để 1 người dùng chung tài khoản
        // dù đăng nhập từ web hay từ app.
        const user = await prisma.user.upsert({
          where: { email: payload.email },
          update: { name: payload.name ?? undefined, image: payload.picture ?? undefined },
          create: { email: payload.email, name: payload.name, image: payload.picture },
        });
        return { id: user.id, email: user.email, name: user.name, image: user.image };
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/sign-in",
  },
  callbacks: {
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
});
