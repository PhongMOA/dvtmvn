/**
 * `capacitor-assets generate --android` chỉ tạo adaptive icon
 * (mipmap-anydpi-v26/ic_launcher.xml + *_foreground.png + *_background.png)
 * khi assets/icon-foreground.png + icon-background.png tồn tại — không đụng
 * tới ic_launcher.png/ic_launcher_round.png raster (fallback pre-Android 8.0,
 * API < 26). Script này resize thẳng assets/icon.png xuống các mipmap-*
 * để bộ legacy khớp icon mới, tránh lẫn icon Capacitor mặc định cũ.
 *
 * Chạy sau mỗi lần `npx tsx scripts/gen-brand-icons.tsx` +
 * `npx capacitor-assets generate --android`.
 */
import sharp from "sharp";
import { join } from "node:path";

const ROOT = process.cwd();
const SRC = join(ROOT, "assets/icon.png");
const RES = join(ROOT, "android/app/src/main/res");

const sizes = {
  "mipmap-mdpi": 48,
  "mipmap-hdpi": 72,
  "mipmap-xhdpi": 96,
  "mipmap-xxhdpi": 144,
  "mipmap-xxxhdpi": 192,
};

for (const [dir, size] of Object.entries(sizes)) {
  const buf = await sharp(SRC).resize(size, size).png().toBuffer();
  await sharp(buf).toFile(join(RES, dir, "ic_launcher.png"));
  await sharp(buf).toFile(join(RES, dir, "ic_launcher_round.png"));
  console.log(`${dir}: ${size}x${size} OK`);
}
