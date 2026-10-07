import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { OAuth2Client } from "google-auth-library";
import { prisma } from "@/lib/prisma";
import { normalizeEmail, verifyPassword } from "@/lib/password";

// Tài khoản đăng ký bằng email + mật khẩu KHÔNG xác minh email (chưa có dịch vụ
// gửi mail). Kẻ xấu có thể đăng ký trước bằng email của người khác, đặt mật khẩu,
// chờ chủ thật đăng nhập Google (tự liên kết theo email, xem
// allowDangerousEmailAccountLinking) rồi dùng mật khẩu đó vào chung tài khoản.
// Chặn: lần đầu Google xác nhận chủ email đăng nhập, mật khẩu đặt khi email CHƯA
// được xác minh bị vô hiệu + đánh dấu emailVerified. Chủ thật vẫn vào bằng
// Google; nếu chính họ đặt mật khẩu đó thì phải dùng Google từ đó.
async function claimEmailVerifiedByGoogle(email: string) {
  await prisma.user.updateMany({
    where: {
      email: { equals: normalizeEmail(email), mode: "insensitive" },
      emailVerified: null,
    },
    data: { passwordHash: null, emailVerified: new Date() },
  });
}

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
    Google({
      // 1 người dùng có thể đăng nhập lần đầu từ app Android (Credentials
      // provider "mobile-google" ở dưới — provider đó upsert thẳng User theo
      // email, KHÔNG tạo Account row), rồi sau đó mới đăng nhập Google trên
      // web. Khi đó PrismaAdapter thấy đã có User cùng email nhưng chưa liên
      // kết Account -> ném "OAuthAccountNotLinked", web login thất bại im lặng
      // (redirect về /sign-in?error=..., không có thông báo). Cho phép tự liên
      // kết theo email: an toàn ở đây vì Google luôn xác minh quyền sở hữu
      // email (và nhánh mobile cũng đã bắt buộc payload.email_verified === true
      // trước khi resolve User).
      allowDangerousEmailAccountLinking: true,
    }),
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
        await claimEmailVerifiedByGoogle(payload.email);

        // Tìm/tạo User giống cách PrismaAdapter làm cho Google Provider —
        // cùng 1 bảng User, khớp theo email để 1 người dùng chung tài khoản
        // dù đăng nhập từ web hay từ app.
        const user = await prisma.user.upsert({
          where: { email: payload.email },
          // Không ghi đè name: user có thể tự sửa họ tên ở /profile — chỉ lấy tên
          // Google lúc tạo tài khoản lần đầu.
          update: { image: payload.picture ?? undefined },
          create: { email: payload.email, name: payload.name, image: payload.picture },
        });
        return { id: user.id, email: user.email, name: user.name, image: user.image };
      },
    }),
    Credentials({
      // Đăng ký/đăng nhập thủ công không qua Google — tài khoản tạo ở
      // src/app/actions/password-auth.ts, mật khẩu hash scrypt (lib/password.ts).
      id: "password",
      name: "Email + mật khẩu",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mật khẩu", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email;
        const password = credentials?.password;
        if (typeof email !== "string" || typeof password !== "string") return null;
        if (!email || !password) return null;

        const user = await prisma.user.findFirst({
          where: { email: { equals: normalizeEmail(email), mode: "insensitive" } },
        });
        // Tài khoản chỉ có Google (passwordHash null) -> không đăng nhập bằng
        // mật khẩu được. Cùng 1 thông báo lỗi cho mọi trường hợp để không lộ
        // email nào đã đăng ký.
        if (!user?.passwordHash) return null;
        if (!(await verifyPassword(password, user.passwordHash))) return null;
        return { id: user.id, email: user.email, name: user.name, image: user.image };
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/sign-in",
  },
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider === "google" && profile?.email && profile.email_verified) {
        await claimEmailVerifiedByGoogle(profile.email);
      }
      return true;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
});
