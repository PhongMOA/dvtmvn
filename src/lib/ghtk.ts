/**
 * Client GHTK (Giao Hàng Tiết Kiệm) — Open API.
 *
 * Base URL:
 *   - production: https://services.giaohangtietkiem.vn
 *   - staging:    https://services-staging.ghtklab.com (cần credential staging riêng
 *                 do GHTK cấp — token production KHÔNG dùng được ở staging)
 * Auth: header `Token: <token>` + `X-Client-Source: <mã shop>`.
 *
 * Hiện chỉ dùng endpoint tính phí `GET /services/shipment/fee` để KIỂM TRA địa chỉ
 * lấy hàng có hợp lệ với mạng lưới GHTK không (endpoint parse-address đang lỗi trên
 * token production). Fee yêu cầu tên tỉnh/quận đúng chuẩn GHTK ("Hà Nội",
 * "TP. Hồ Chí Minh", "Quận Ba Đình"...) — sai tên -> success:false.
 */

const BASE_URL = (
  process.env.GHTK_BASE_URL || "https://services.giaohangtietkiem.vn"
).replace(/\/+$/, "");
const TOKEN = process.env.GHTK_TOKEN;
const CLIENT_SOURCE = process.env.GHTK_CLIENT_SOURCE;

export function isGhtkConfigured(): boolean {
  return Boolean(TOKEN && CLIENT_SOURCE);
}

export type PickLocationCheck =
  /** GHTK tính được phí -> tỉnh/quận hợp lệ, giao được. */
  | { status: "ok"; fee: number }
  /** GHTK phản hồi bình thường nhưng từ chối -> địa chỉ/tỉnh/quận không hợp lệ. */
  | { status: "rejected" }
  /** Không kiểm tra được (chưa cấu hình, lỗi mạng, GHTK 5xx...) — caller nên cho
   *  lưu kèm cảnh báo thay vì chặn. */
  | { status: "unavailable"; detail: string };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Kiểm tra một địa điểm có nằm trong vùng phục vụ của GHTK không, bằng cách hỏi
 * phí ship với điểm lấy = điểm giao = địa điểm đó. Thử lại 1 lần khi GHTK trả
 * success:false rỗng (endpoint fee thỉnh thoảng hiccup) hoặc lỗi mạng.
 */
export async function checkPickLocation(input: {
  province: string;
  district: string;
  address: string;
}): Promise<PickLocationCheck> {
  if (!isGhtkConfigured()) {
    return { status: "unavailable", detail: "NOT_CONFIGURED" };
  }

  const qs = new URLSearchParams({
    pick_province: input.province,
    pick_district: input.district,
    province: input.province,
    district: input.district,
    address: input.address || input.district,
    weight: "500",
  });
  const url = `${BASE_URL}/services/shipment/fee?${qs.toString()}`;

  let lastDetail = "unknown";
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await sleep(800);
    try {
      const res = await fetch(url, {
        headers: {
          Token: TOKEN as string,
          "X-Client-Source": CLIENT_SOURCE as string,
        },
        cache: "no-store",
        signal: AbortSignal.timeout(12_000),
      });

      if (!res.ok) {
        lastDetail = `HTTP ${res.status}`;
        if (res.status >= 500 || res.status === 429) continue;
        return { status: "unavailable", detail: lastDetail };
      }

      const json = (await res.json()) as {
        success?: boolean;
        fee?: { fee?: number } | null;
      };

      if (json.success && json.fee?.fee != null) {
        return { status: "ok", fee: Number(json.fee.fee) };
      }

      // success:false + message rỗng: có thể sai địa chỉ, cũng có thể GHTK hiccup.
      // Thử lại 1 lần rồi mới kết luận là "rejected".
      lastDetail = "success:false";
      if (attempt === 0) continue;
      return { status: "rejected" };
    } catch (err) {
      lastDetail = err instanceof Error ? err.message : String(err);
    }
  }

  return { status: "unavailable", detail: lastDetail };
}
