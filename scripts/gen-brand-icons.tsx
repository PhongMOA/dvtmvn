/**
 * Render icon vuông (favicon ĐVT/MVN) + splash ngang (ĐA VŨ TRỤ/MARVEL VN)
 * thành PNG cho Android — dùng chung layout/màu với src/app/icon.tsx và
 * src/components/logo.tsx nhưng hard-code màu thật (không có globals.css khi
 * chạy độc lập, xem comment trong icon.tsx để biết cách quy đổi oklch).
 *
 * Chạy: npx tsx scripts/gen-brand-icons.tsx
 * Sau đó: npx capacitor-assets generate --android
 *         node scripts/gen-legacy-launcher-icons.mjs (icon pre-Android 8.0)
 *
 * Đổi màu theo phim (như globals.css) thì sửa COLORS bên dưới rồi chạy lại.
 */
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

const ROOT = process.cwd();

const COLORS = {
  cardBg: "#080c09",
  cardFg: "#eaf0eb",
  primaryBg: "#0fbd59",
  primaryFg: "#010201",
};

type FontOption = { name: string; data: Buffer; style: "normal"; weight: 400 };

async function render(node: React.ReactElement, width: number, height: number, fonts: FontOption[]) {
  const res = new ImageResponse(node, { width, height, fonts });
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  const antonSquare = await readFile(join(ROOT, "src/fonts/anton-icon-subset.ttf"));
  const antonWordmark = await readFile(join(ROOT, "src/fonts/anton-davutru-subset.ttf"));
  const marvelFont = await readFile(join(ROOT, "src/fonts/MarvelRegular-Dj83.ttf"));

  // ---- 1) Icon vuông (ĐVT/MVN), full-bleed 1024x1024 — Android launcher/adaptive icon ----
  const S = 1024;
  const squareIcon = (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
      <div
        style={{
          width: "100%",
          flex: "0 0 36%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: COLORS.cardBg,
          border: "32px solid #ffffff",
          color: COLORS.cardFg,
          fontFamily: "Anton",
          fontSize: 240,
          letterSpacing: 16,
        }}
      >
        ĐVT
      </div>
      <div
        style={{
          width: "100%",
          flex: "1 1 auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: COLORS.primaryBg,
          borderLeft: "32px solid #ffffff",
          borderRight: "32px solid #ffffff",
          borderBottom: "32px solid #ffffff",
          color: COLORS.primaryFg,
          fontFamily: "Anton",
          fontSize: 384,
          letterSpacing: 16,
        }}
      >
        MVN
      </div>
    </div>
  );
  const iconFonts = [{ name: "Anton", data: antonSquare, style: "normal" as const, weight: 400 as const }];
  await writeFile(join(ROOT, "assets/icon.png"), await render(squareIcon, S, S, iconFonts));

  // ---- 2) Adaptive icon background: nền phẳng tối trơn ----
  const bgNode = <div style={{ width: "100%", height: "100%", background: COLORS.cardBg, display: "flex" }} />;
  await writeFile(join(ROOT, "assets/icon-background.png"), await render(bgNode, S, S, []));

  // ---- 3) Adaptive icon foreground: icon thu nhỏ vào safe-zone (68%), nền trong suốt ----
  const fgNode = (
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: "68%", height: "68%", display: "flex", flexDirection: "column" }}>
        <div
          style={{
            width: "100%",
            flex: "0 0 36%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: COLORS.cardBg,
            border: "24px solid #ffffff",
            color: COLORS.cardFg,
            fontFamily: "Anton",
            fontSize: 160,
            letterSpacing: 10,
          }}
        >
          ĐVT
        </div>
        <div
          style={{
            width: "100%",
            flex: "1 1 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: COLORS.primaryBg,
            borderLeft: "24px solid #ffffff",
            borderRight: "24px solid #ffffff",
            borderBottom: "24px solid #ffffff",
            color: COLORS.primaryFg,
            fontFamily: "Anton",
            fontSize: 256,
            letterSpacing: 10,
          }}
        >
          MVN
        </div>
      </div>
    </div>
  );
  await writeFile(join(ROOT, "assets/icon-foreground.png"), await render(fgNode, S, S, iconFonts));

  // ---- 4) Splash screen: logo chữ nhật ngang "ĐA VŨ TRỤ / MARVEL VN" giữa nền tối ----
  const SPLASH = 2732;
  const logoW = 1900;
  const logoH = Math.round((logoW * 150) / 300); // giữ tỉ lệ 300:150 của Logo gốc (src/components/logo.tsx)
  const topH = Math.round(logoH * (52 / 150));
  const splashNode = (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: COLORS.cardBg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div style={{ width: logoW, height: logoH, display: "flex", flexDirection: "column" }}>
        <div
          style={{
            width: "100%",
            height: topH,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            background: COLORS.cardBg,
            border: "3px solid #ffffff",
            color: COLORS.cardFg,
            fontFamily: "Anton",
            fontSize: 110,
            lineHeight: 1,
            whiteSpace: "nowrap",
            letterSpacing: 2,
          }}
        >
          ĐA VŨ TRỤ
        </div>
        <div
          style={{
            width: "100%",
            height: logoH - topH,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            background: COLORS.primaryBg,
            borderLeft: "3px solid #ffffff",
            borderRight: "3px solid #ffffff",
            borderBottom: "3px solid #ffffff",
            color: COLORS.primaryFg,
            fontFamily: "Marvel",
            fontSize: 210,
            lineHeight: 1,
            whiteSpace: "nowrap",
          }}
        >
          MARVEL VN
        </div>
      </div>
    </div>
  );
  const splashFonts = [
    { name: "Anton", data: antonWordmark, style: "normal" as const, weight: 400 as const },
    { name: "Marvel", data: marvelFont, style: "normal" as const, weight: 400 as const },
  ];
  const splashBuf = await render(splashNode, SPLASH, SPLASH, splashFonts);
  await writeFile(join(ROOT, "assets/splash.png"), splashBuf);
  await writeFile(join(ROOT, "assets/splash-dark.png"), splashBuf);

  console.log("Done: assets/icon.png, icon-foreground.png, icon-background.png, splash.png, splash-dark.png");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
