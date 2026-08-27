# Phase 1: Capacitor Scaffold + Đăng nhập Native Google

Context: [plan.md](./plan.md)

## Mục tiêu

Có 1 app Android (Capacitor) mở lên là load thẳng
`https://dvtmvn.vercel.app`, và đăng nhập Google **thành công** ngay trong
WebView của app (không văng lỗi `disallowed_useragent`, session cookie giữ
đúng qua các lần mở lại app).

## Vì sao không dùng nguyên Auth.js Google Provider hiện tại

Google chặn OAuth authorization endpoint khi user-agent là embedded WebView
(lỗi `disallowed_useragent`, chính sách từ 2/2023). Dùng Chrome Custom Tabs
để né lỗi này thì lại làm cookie session nằm ở storage của Chrome, không
nằm ở storage của Capacitor WebView — app vẫn coi như chưa đăng nhập.

→ Giải pháp: đăng nhập Google **native** (không qua WebView của Google) lấy
ID token, gửi ID token đó cho 1 Credentials Provider mới của Auth.js verify
và set cookie **trong chính WebView của app** (cùng-origin, cookie set đúng).

## Kiến trúc

```
[App Android WebView] --(1) load--> dvtmvn.vercel.app
        |
        | (2) user bấm "Đăng nhập Google" (route riêng cho platform native)
        v
[Capacitor plugin native Google Sign-In] --(3) trả về idToken--
        |
        v
[Client code trong WebView] --(4) signIn("mobile-google", { idToken })-->
        |
        v
[Auth.js Credentials Provider "mobile-google" — server]
        --(5) verify idToken với Google (google-auth-library)
        --(6) find/create User trong Postgres (khớp email, giống PrismaAdapter)
        --(7) trả session JWT -> Set-Cookie (cùng origin WebView -> lưu đúng)
```

## Việc user phải tự làm (không tự động hoá được)

1. Cài Node.js 22 LTS + Android Studio Otter 2025.2.1+ (bundle sẵn JDK) —
   theo yêu cầu Capacitor 8.
2. Tạo **1 Android OAuth Client ID mới** tại Google Cloud Console (cùng
   project đang có `AUTH_GOOGLE_ID`) → Credentials → Create Credentials →
   OAuth client ID → loại **Android** → điền package name (`vn.marvelvn.app`,
   xem `appId` trong `capacitor.config.ts`) + SHA-1 fingerprint.
   - **Cần đăng ký CẢ 2 SHA-1**: debug keystore (`~/.android/debug.keystore`,
     lấy bằng `keytool -list -v -keystore ~/.android/debug.keystore -alias
     androiddebugkey -storepass android -keypass android`) và release
     keystore (tự tạo khi build release). Thiếu 1 trong 2 → login lỗi chỉ ở
     đúng loại build đó, rất khó debug nếu không biết trước.
   - **QUAN TRỌNG (phát hiện khi implement, khác thiết kế ban đầu):** client
     ID Android vừa tạo **không** dùng trong code — nó chỉ để Google Cloud
     Console xác thực chữ ký APK (package + SHA-1). ID token mà app native
     nhận được luôn có `audience` = Client ID loại **Web application**
     (chính là `AUTH_GOOGLE_ID` đã có sẵn), bất kể app là Android. Dùng
     Android Client ID làm audience là lỗi tích hợp phổ biến nhất (xem
     README `@capgo/capacitor-social-login`, mục "Android troubleshooting").
3. Set biến môi trường mới trên Vercel: `NEXT_PUBLIC_AUTH_GOOGLE_ID` — copy
   **y hệt giá trị** của `AUTH_GOOGLE_ID` hiện có (không phải client ID
   Android vừa tạo ở bước 2). Cần bản `NEXT_PUBLIC_` vì client Android cần
   giá trị này ở phía client (Next.js chỉ bundle biến có tiền tố này ra
   client bundle).
4. Mở `android/` bằng Android Studio, build + cài debug APK lên điện thoại
   thật qua USB, test đăng nhập.

## Các bước implementation (agent làm được)

1. `npm install @capacitor/core @capacitor/cli @capacitor/android` (Capacitor
   8 — Node 22+, xem [capacitorjs.com/docs/updating/8-0](https://capacitorjs.com/docs/updating/8-0)).
2. `npx cap init "MarvelVN" "vn.marvelvn.app" --web-dir=public` rồi
   `npx cap add android` — sinh thư mục `android/` (project Android Studio
   đầy đủ). Bước này **không cần Android SDK** để chạy, chỉ cần Node — agent
   có thể tự chạy được.
3. Tạo `capacitor.config.ts`:
   ```ts
   import type { CapacitorConfig } from "@capacitor/cli";

   const config: CapacitorConfig = {
     appId: "vn.marvelvn.app",
     appName: "MarvelVN",
     webDir: "public",
     server: {
       url: "https://dvtmvn.vercel.app",
       androidScheme: "https",
       cleartext: false,
     },
   };
   export default config;
   ```
4. `npm install @capgo/capacitor-social-login` (fork duy trì tốt của
   `@codetrix-studio/capacitor-google-auth`, dùng Google Credential Manager
   native, xem
   [Cap-go/capacitor-social-login](https://github.com/Cap-go/capacitor-social-login)).
   Google qua Credential Manager **không cần** khai báo gì trong
   `capacitor.config.ts` (khác Apple/Twitter/Custom Tabs) — chỉ cần gọi
   `SocialLogin.initialize({ google: { webClientId } })` phía JS lúc runtime
   (xem bước 7), không cần sửa `AndroidManifest.xml` hay `assetlinks.json`.
5. `npm install google-auth-library` (verify ID token phía server).
6. Sửa `auth.ts` — thêm Credentials Provider mới, **giữ nguyên Google
   Provider cũ cho web browser bình thường**:
   ```ts
   import Credentials from "next-auth/providers/credentials";
   import { OAuth2Client } from "google-auth-library";

   const mobileGoogleClient = new OAuth2Client();

   // ...trong providers: [Google, Credentials({
   //   id: "mobile-google",
   //   name: "Google (app di động)",
   //   credentials: { idToken: { label: "ID Token", type: "text" } },
   //   async authorize({ idToken }) {
   //     if (typeof idToken !== "string") return null;
   //     const ticket = await mobileGoogleClient.verifyIdToken({
   //       idToken,
   //       audience: process.env.AUTH_GOOGLE_ID, // Web Client ID, không phải Android
   //     });
   //     const payload = ticket.getPayload();
   //     if (!payload?.email) return null;
   //     // Tìm/tạo User giống PrismaAdapter — cùng bảng User hiện có.
   //     const user = await prisma.user.upsert({
   //       where: { email: payload.email },
   //       update: { name: payload.name, image: payload.picture },
   //       create: { email: payload.email, name: payload.name, image: payload.picture },
   //     });
   //     return { id: user.id, email: user.email, name: user.name, image: user.image };
   //   },
   // })]
   ```
   Lưu ý: `session: { strategy: "jwt" }` đã có sẵn — Credentials Provider chỉ
   hoạt động với JWT strategy (không hoạt động với database session), đúng
   với cấu hình hiện tại nên không cần đổi gì thêm.
7. Client: tạo `src/lib/is-native-app.ts` check
   `Capacitor.isNativePlatform()`. Sửa trang `/sign-in` (hoặc component nút
   đăng nhập hiện có): nếu đang chạy native → gọi
   `SocialLogin.login({ provider: "google", options: {} })` lấy `idToken`,
   rồi gọi `signIn("mobile-google", { idToken, redirect: false })` (next-auth
   client). Nếu web bình thường → giữ nguyên `signIn("google")` như cũ.
8. `npx cap sync android` sau mỗi lần đổi plugin/config.
   **Phát hiện khi implement:** plugin mặc định bật cả 4 provider
   (Google/Facebook/Apple/Twitter), kéo SDK thừa vào APK. Đã thêm
   `plugins.SocialLogin.providers` trong `capacitor.config.ts` để chỉ bật
   `google: true`, tắt 3 cái còn lại — xác nhận qua log sync
   (`✖ Facebook: disabled`, ...).

## Rủi ro

- **SHA-1 debug vs release khác nhau** — login chạy được ở debug build
  nhưng lỗi ở release build (hoặc ngược lại) nếu quên đăng ký đủ 2 SHA-1.
  Đã ghi rõ ở mục "Việc user phải tự làm".
- `server.url` trỏ production là dùng ngoài mục đích thiết kế gốc của
  Capacitor (chính thức ghi cho dev live-reload) — hoạt động được nhưng cần
  test kỹ hành vi back-button + cache khi user tự build.
- Google Play review có thể coi app "chỉ là WebView wrapper" nếu thiếu giá
  trị native rõ ràng — Phase 2 (camera scan) giúp giảm rủi ro này, nhưng đây
  là rủi ro ở bước nộp Play Store (out of scope kỹ thuật của plan này).

## Todo Checklist

- [x] `npm install @capacitor/core @capacitor/cli @capacitor/android`
- [x] `npx cap init` + `npx cap add android`
- [x] Viết `capacitor.config.ts` (server.url production, tắt bớt provider
      Facebook/Apple/Twitter không dùng)
- [x] `npm install @capgo/capacitor-social-login google-auth-library`
- [x] Thêm Credentials Provider `mobile-google` vào `auth.ts` (audience =
      `AUTH_GOOGLE_ID`, đã sửa lại từ thiết kế ban đầu — xem mục "Việc user
      phải tự làm")
- [x] Thêm biến env `NEXT_PUBLIC_AUTH_GOOGLE_ID` vào `.env.example`
- [x] Sửa UI đăng nhập: rẽ nhánh native vs web
      (`src/components/sign-in-button.tsx`, dùng `useSyncExternalStore` để
      tránh lệch hydration đúng chuẩn React thay vì `useState`+`useEffect`)
- [x] `npx tsc --noEmit`, `eslint`, `npm run build` đều pass (kiểm tra được
      trong môi trường agent, không cần thiết bị Android)
- [ ] (User) Tạo Android OAuth Client ID + đăng ký 2 SHA-1
- [ ] (User) Set `NEXT_PUBLIC_AUTH_GOOGLE_ID` trên Vercel (copy y hệt giá trị
      `AUTH_GOOGLE_ID` hiện có)
- [ ] (User) Build debug APK, test đăng nhập trên thiết bị thật

## Success Criteria

- [ ] Mở app Android, thấy đúng giao diện web MarvelVN.
- [ ] Bấm đăng nhập Google trong app → không văng lỗi `disallowed_useragent`
      → về lại app đã đăng nhập.
- [ ] Đóng app, mở lại → vẫn còn đăng nhập (cookie/session giữ nguyên).

> Code đã implement đầy đủ (xem Todo Checklist ở trên, tsc/eslint/build đều
> pass), chờ user build APK và test đăng nhập trên thiết bị Android thật để
> xác nhận các mục Success Criteria trên.
