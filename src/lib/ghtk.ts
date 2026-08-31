/**
 * Client GHTK (Giao Hàng Tiết Kiệm) — Open API.
 *
 * Base URL:
 *   - production: https://services.giaohangtietkiem.vn
 *   - staging:    https://services-staging.ghtklab.com (cần credential staging riêng
 *                 do GHTK cấp — token production KHÔNG dùng được ở staging)
 * Auth: header `Token: <token>` + `X-Client-Source: <mã shop>`.
 *
 * Dùng 3 endpoint:
 *   - `GET  /services/shipment/fee`      — tính phí ship + kiểm tra địa chỉ (chỉ
 *      thực sự validate được cấp TỈNH/THÀNH; quận/phường sai vẫn ra phí).
 *   - `POST /services/shipment/order`    — tạo đơn vận chuyển sau khi khách thanh
 *      toán (xem src/lib/order-fulfillment.ts). BẮT BUỘC có `ward` (phường/xã) cho
 *      cả điểm lấy lẫn điểm giao.
 *   - `GET  /services/shipment/v2/{label}` — tra trạng thái đơn.
 *
 * Tên tỉnh phải gần đúng chuẩn GHTK ("Hà Nội", "Hồ Chí Minh"/"TP. Hồ Chí Minh"...).
 */

const BASE_URL = (
  process.env.GHTK_BASE_URL || "https://services.giaohangtietkiem.vn"
).replace(/\/+$/, "");
const TOKEN = process.env.GHTK_TOKEN;
const CLIENT_SOURCE = process.env.GHTK_CLIENT_SOURCE;

/** Khối lượng quy ước mỗi combo (gram) — GHTK cần weight để tính cước, ComboType
 *  chưa có trường cân nặng nên hardcode, nhân với số lượng. */
export const COMBO_WEIGHT_GRAM = 500;

export function isGhtkConfigured(): boolean {
  return Boolean(TOKEN && CLIENT_SOURCE);
}

function ghtkHeaders(): Record<string, string> {
  return {
    Token: TOKEN as string,
    "X-Client-Source": CLIENT_SOURCE as string,
  };
}

export type LocationCheck =
  /** GHTK tính được phí -> tỉnh (ít nhất) hợp lệ, giao được. */
  | { status: "ok"; fee: number }
  /** GHTK phản hồi bình thường nhưng từ chối -> tỉnh/thành không hợp lệ. */
  | { status: "rejected" }
  /** Không kiểm tra được (chưa cấu hình, lỗi mạng, GHTK 5xx...) — caller nên cho
   *  lưu kèm cảnh báo thay vì chặn. */
  | { status: "unavailable"; detail: string };

/** @deprecated dùng {@link LocationCheck} */
export type PickLocationCheck = LocationCheck;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Gọi `GET /services/shipment/fee`. Thử lại 1 lần khi GHTK trả success:false rỗng
 * (endpoint fee thỉnh thoảng hiccup) hoặc lỗi mạng/5xx.
 */
async function fetchFee(params: Record<string, string>): Promise<LocationCheck> {
  if (!isGhtkConfigured()) {
    return { status: "unavailable", detail: "NOT_CONFIGURED" };
  }

  const url = `${BASE_URL}/services/shipment/fee?${new URLSearchParams(params).toString()}`;

  let lastDetail = "unknown";
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await sleep(800);
    try {
      const res = await fetch(url, {
        headers: ghtkHeaders(),
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

/**
 * Kiểm tra một địa điểm có nằm trong vùng phục vụ của GHTK không, bằng cách hỏi
 * phí ship với điểm lấy = điểm giao = địa điểm đó.
 *
 * MVP: thực chất chỉ xác thực được cấp tỉnh/thành (xem chú thích đầu file).
 * Dùng khi lưu địa chỉ profile / cấu hình kho — chưa biết phía còn lại.
 */
export async function checkLocationServiceable(input: {
  province: string;
  district: string;
  address: string;
}): Promise<LocationCheck> {
  return fetchFee({
    pick_province: input.province,
    pick_district: input.district,
    province: input.province,
    district: input.district,
    address: input.address || input.district,
    weight: "500",
  });
}

/** @deprecated đổi tên thành {@link checkLocationServiceable}. */
export const checkPickLocation = checkLocationServiceable;

/**
 * Tính phí ship thật từ kho lấy hàng của shop tới địa chỉ khách. Dùng ở bước tóm
 * tắt đơn (src/app/actions/booking.ts → prepareCheckout). `status:"ok"` mới cho
 * khách đi tiếp sang thanh toán.
 */
export async function estimateShippingFee(input: {
  pickProvince: string;
  pickDistrict: string;
  toProvince: string;
  toDistrict: string;
  toAddress: string;
  weightGram: number;
}): Promise<LocationCheck> {
  return fetchFee({
    pick_province: input.pickProvince,
    pick_district: input.pickDistrict,
    province: input.toProvince,
    district: input.toDistrict,
    address: input.toAddress || input.toDistrict,
    weight: String(Math.max(1, Math.round(input.weightGram))),
  });
}

// --- Tạo đơn vận chuyển ---------------------------------------------------------

export type CreateGhtkOrderInput = {
  /** mã đối tác = orderCode của mình, GHTK dùng làm khoá chống trùng */
  orderCode: string;
  pick: {
    name: string;
    tel: string;
    province: string;
    district: string;
    ward: string;
    address: string;
  };
  to: {
    name: string;
    tel: string;
    province: string;
    district: string;
    ward: string;
    address: string;
  };
  /** tên combo hiển thị trên đơn GHTK */
  productName: string;
  quantity: number;
  /** giá trị khai giá (VND) — cơ sở tính bảo hiểm */
  value: number;
  note?: string;
};

export type CreateGhtkOrderResult =
  | {
      ok: true;
      label: string;
      trackingId: string;
      fee: number | null;
      statusId: string | null;
    }
  | { ok: false; error: string };

/**
 * `POST /services/shipment/order?ver=1.5`. KHÔNG retry vòng lặp (tránh tạo đơn
 * trùng). Mã đơn đã tồn tại (`ORDER_ID_EXIST`) coi như thành công, lấy label GHTK
 * trả kèm.
 */
export async function createGhtkOrder(
  input: CreateGhtkOrderInput,
): Promise<CreateGhtkOrderResult> {
  if (!isGhtkConfigured()) {
    return { ok: false, error: "NOT_CONFIGURED" };
  }

  const totalWeightGram = COMBO_WEIGHT_GRAM * Math.max(1, input.quantity);
  const body = {
    products: [
      {
        name: input.productName,
        weight: COMBO_WEIGHT_GRAM / 1000, // KG
        quantity: Math.max(1, input.quantity),
        price: input.value,
      },
    ],
    order: {
      id: input.orderCode,
      pick_name: input.pick.name,
      pick_tel: input.pick.tel,
      pick_province: input.pick.province,
      pick_district: input.pick.district,
      pick_ward: input.pick.ward,
      pick_address: input.pick.address,
      pick_money: 0, // khách đã trả trước cho shop, GHTK không thu hộ
      name: input.to.name,
      tel: input.to.tel,
      province: input.to.province,
      district: input.to.district,
      ward: input.to.ward,
      address: input.to.address,
      hamlet: "Khác",
      is_freeship: 1, // shop chịu cước với GHTK
      value: input.value,
      transport: "road",
      weight_option: "gram",
      total_weight: totalWeightGram,
      note: (input.note ?? "").slice(0, 120),
    },
  };

  let json: {
    success?: boolean;
    message?: string;
    order?: {
      label?: string;
      tracking_id?: number | string;
      fee?: number | string;
      status_id?: number | string;
    };
    error?: { code?: string; ghtk_label?: string; status?: number | string };
  };
  try {
    const res = await fetch(`${BASE_URL}/services/shipment/order?ver=1.5`, {
      method: "POST",
      headers: { ...ghtkHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    json = await res.json();
    if (!res.ok && !json?.error && !json?.order) {
      return { ok: false, error: `HTTP ${res.status}` };
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }

  if (json.success && json.order?.label) {
    return {
      ok: true,
      label: String(json.order.label),
      trackingId: String(json.order.tracking_id ?? ""),
      fee: json.order.fee != null ? Number(json.order.fee) : null,
      statusId: json.order.status_id != null ? String(json.order.status_id) : null,
    };
  }

  // Mã đơn đã tồn tại trên GHTK -> coi như đã tạo, dùng lại label GHTK trả về.
  if (json.error?.code === "ORDER_ID_EXIST" && json.error.ghtk_label) {
    return {
      ok: true,
      label: String(json.error.ghtk_label),
      trackingId: "",
      fee: null,
      statusId: json.error.status != null ? String(json.error.status) : null,
    };
  }

  return { ok: false, error: json.message || json.error?.code || "UNKNOWN" };
}

// --- Huỷ đơn -----------------------------------------------------------------

export type CancelGhtkOrderResult = { ok: true } | { ok: false; error: string };

/**
 * `POST /services/shipment/cancel/{label}`. GHTK chỉ cho huỷ khi đơn còn ở
 * trạng thái chưa tiếp nhận (1) / đã tiếp nhận (2) / đang lấy hàng (12) — lấy
 * hàng xong là không huỷ được, GHTK trả `success:false` kèm message.
 */
export async function cancelGhtkOrder(
  label: string,
): Promise<CancelGhtkOrderResult> {
  if (!isGhtkConfigured()) return { ok: false, error: "NOT_CONFIGURED" };

  try {
    const res = await fetch(
      `${BASE_URL}/services/shipment/cancel/${encodeURIComponent(label)}`,
      {
        method: "POST",
        headers: { ...ghtkHeaders(), "Content-Type": "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      },
    );
    const json = (await res.json()) as { success?: boolean; message?: string };
    if (json.success) return { ok: true };
    return { ok: false, error: json.message || `HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// --- Trạng thái đơn -----------------------------------------------------------

/** status_id GHTK -> nhãn tiếng Việt (fallback về status_text GHTK trả về). */
export const GHTK_STATUS_TEXT: Record<string, string> = {
  "-1": "Đã huỷ",
  "1": "Chưa tiếp nhận",
  "2": "Đã tiếp nhận",
  "3": "Đã lấy hàng / nhập kho",
  "4": "Đang giao hàng",
  "5": "Đã giao hàng",
  "6": "Đã đối soát",
  "7": "Không lấy được hàng",
  "8": "Hoãn lấy hàng",
  "9": "Không giao được hàng",
  "10": "Delay giao hàng",
  "11": "Đã đối soát công nợ trả hàng",
  "12": "Đang lấy hàng",
  "13": "Đơn hàng bồi hoàn",
  "20": "Đang trả hàng",
  "21": "Đã trả hàng",
  "123": "Shipper báo delay lấy hàng",
  "127": "Shipper báo delay giao hàng",
  "128": "Shipper báo đã lấy hàng",
};

export type ShipmentStatusResult =
  | { ok: true; status: string; statusText: string }
  | { ok: false; error: string };

export async function getGhtkShipmentStatus(
  label: string,
): Promise<ShipmentStatusResult> {
  if (!isGhtkConfigured()) return { ok: false, error: "NOT_CONFIGURED" };

  try {
    const res = await fetch(
      `${BASE_URL}/services/shipment/v2/${encodeURIComponent(label)}`,
      {
        headers: ghtkHeaders(),
        cache: "no-store",
        signal: AbortSignal.timeout(12_000),
      },
    );
    const json = (await res.json()) as {
      success?: boolean;
      message?: string;
      order?: { status?: number | string; status_text?: string };
    };
    if (!json.success || json.order?.status == null) {
      return { ok: false, error: json.message || `HTTP ${res.status}` };
    }
    const status = String(json.order.status);
    return {
      ok: true,
      status,
      statusText: GHTK_STATUS_TEXT[status] || json.order.status_text || `Trạng thái ${status}`,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
