import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

// Hash mật khẩu cho tài khoản đăng ký thủ công (email + mật khẩu). Dùng scrypt
// có sẵn trong Node — không thêm dependency native như bcrypt/argon2 (dễ vỡ khi
// build trên Vercel). Định dạng lưu: "scrypt$N$r$p$<salt b64>$<hash b64>" — giữ
// tham số trong chuỗi để sau này tăng N mà hash cũ vẫn verify được.
const N = 16384;
const R = 8;
const P = 1;
const KEY_LEN = 64;

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

function scryptAsync(
  password: string,
  salt: Buffer,
  keyLen: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keyLen, options, (err, key) =>
      err ? reject(err) : resolve(key),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, KEY_LEN, { N, r: R, p: P });
  return ["scrypt", N, R, P, salt.toString("base64"), hash.toString("base64")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, n, r, p, saltB64, hashB64] = stored.split("$");
  if (algo !== "scrypt" || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64");
  try {
    const actual = await scryptAsync(password, Buffer.from(saltB64, "base64"), expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
    });
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

/** Email chuẩn hoá để lưu/so khớp — Google luôn trả email chữ thường. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// Đủ chặt để bắt gõ nhầm, không cố validate hết RFC 5322.
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
