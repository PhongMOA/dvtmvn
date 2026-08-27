import type { CapacitorConfig } from "@capacitor/cli";

// App Android wrap WebView trỏ thẳng vào domain production — app hoàn toàn
// phụ thuộc server (Next.js server-rendered, không static export), không có
// bundle web local nào để chạy offline. `webDir: "public"` chỉ là placeholder
// bắt buộc phải có theo CapacitorConfig, KHÔNG được dùng thực tế vì đã set
// `server.url` (server.url override hoàn toàn webDir).
//
// Xem plans/260826-1757-android-push-app/phase-01-capacitor-scaffold-auth.md
// để biết lý do và rủi ro đi kèm (server.url vốn dùng cho dev live-reload,
// không phải use-case chính thức, nhưng phù hợp với app hoàn toàn server-driven
// như MarvelVN).
const config: CapacitorConfig = {
  appId: "vn.marvelvn.app",
  appName: "MarvelVN",
  webDir: "public",
  server: {
    url: "https://dvtmvn.vercel.app",
    androidScheme: "https",
    cleartext: false,
  },
  // Gắn thêm chuỗi nhận diện vào User-Agent của WebView để server phân biệt
  // được request tới từ app Android thật (native) so với browser thường —
  // dùng ở src/app/page.tsx để mở khoá xem trước giao diện sau countdown chỉ
  // cho app, không ảnh hưởng user web thường (xem comment ANDROID_APP_UA_TAG
  // trong page.tsx). Đổi giá trị này thì phải sửa lại chuỗi so khớp bên đó.
  android: {
    appendUserAgent: "MarvelVNApp",
  },
  // Chỉ dùng đăng nhập Google — tắt Facebook/Apple/Twitter để plugin
  // @capgo/capacitor-social-login không kéo thêm SDK không cần vào APK
  // (mặc định plugin bật cả 4 provider).
  plugins: {
    SocialLogin: {
      providers: {
        google: true,
        facebook: false,
        apple: false,
        twitter: false,
      },
    },
  },
};

export default config;
