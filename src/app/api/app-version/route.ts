/**
 * Bản APK mới nhất cho môi trường hiện tại — app native (native-update-check)
 * so với versionCode của nó để nhắc cập nhật.
 *
 * APK do GitHub Actions (.github/workflows/android.yml) build và đăng lên
 * GitHub Releases của repo (public) với tag `apk-<env>-<versionCode>`, asset
 * là file .apk, body = commit message. Commit có "[force-update]" → bắt buộc
 * cập nhật (dùng khi web mới cần plugin native mới).
 *
 * Kết quả GitHub cache 5 phút: API không token chỉ cho 60 request/giờ/IP.
 */
const REPO = "PhongMOA/dvtmvn";
const ENV = process.env.NEXT_PUBLIC_APP_ENV === "staging" ? "staging" : "production";

type GhRelease = {
  tag_name: string;
  body: string | null;
  draft: boolean;
  assets: { name: string; browser_download_url: string }[];
};

export type AppVersion = {
  versionCode: number;
  url: string;
  notes: string;
  mandatory: boolean;
} | null;

export async function GET() {
  const latest = await findLatest().catch(() => null);
  return Response.json(latest, { headers: { "Cache-Control": "no-store" } });
}

async function findLatest(): Promise<AppVersion> {
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=30`, {
    headers: {
      Accept: "application/vnd.github+json",
      ...(process.env.GITHUB_TOKEN && { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }),
    },
    next: { revalidate: 300 },
  });
  if (!res.ok) return null;

  const prefix = `apk-${ENV}-`;
  let best: AppVersion = null;
  for (const r of (await res.json()) as GhRelease[]) {
    if (r.draft || !r.tag_name.startsWith(prefix)) continue;
    const versionCode = Number(r.tag_name.slice(prefix.length));
    const apk = r.assets.find((a) => a.name.endsWith(".apk"));
    if (!Number.isInteger(versionCode) || !apk) continue;
    if (best && best.versionCode >= versionCode) continue;
    const body = r.body ?? "";
    best = {
      versionCode,
      url: apk.browser_download_url,
      notes: body.replace("[force-update]", "").trim(),
      mandatory: body.includes("[force-update]"),
    };
  }
  return best;
}
