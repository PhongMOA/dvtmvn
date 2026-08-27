import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getMessaging, type Messaging } from "firebase-admin/messaging";

// Lazy singleton — KHÔNG init ở top-level module. Nếu FIREBASE_SERVICE_ACCOUNT_JSON
// chưa được cấu hình (vd môi trường dev trước khi tạo Firebase project), import
// module này (transitively qua push.ts -> webhook route) không được phép làm sập
// cả app/build. Lỗi thiếu env chỉ nên xảy ra đúng lúc thực sự gửi push, nơi đã có
// try/catch bọc sẵn (xem webhook SePay, simulatePayment).
let messaging: Messaging | undefined;

export function getFirebaseMessaging(): Messaging {
  if (messaging) return messaging;

  const encoded = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!encoded) {
    throw new Error("Thiếu biến môi trường FIREBASE_SERVICE_ACCOUNT_JSON");
  }

  const serviceAccount = JSON.parse(
    Buffer.from(encoded, "base64").toString("utf-8"),
  );

  // getApps()[0]: serverless function instance có thể được tái sử dụng giữa các
  // lần invoke (Vercel) — initializeApp() gọi lần 2 trên cùng instance sẽ ném lỗi
  // "app already exists" nếu không check trước.
  const app = getApps()[0] ?? initializeApp({ credential: cert(serviceAccount) });
  messaging = getMessaging(app);
  return messaging;
}
