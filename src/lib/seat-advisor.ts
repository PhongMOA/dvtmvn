/**
 * Tư vấn ghế sau khi user chọn đủ ghế — CHỈ chạy ở server (gọi OpenRouter bằng
 * OPENROUTER_API_KEY).
 *
 * Code tự tính mọi số liệu (ghế lẻ, dãy trống bị cắt, độ đẹp vị trí, các khối
 * thay thế hợp lệ); AI chỉ diễn giải + chọn 1 khối trong danh sách server đưa
 * ra, nên không thể gợi ý ghế đã có người/để ghế lẻ. Không có key, AI lỗi hoặc
 * hết lượt -> trả lời soạn sẵn từ chính các số liệu đó.
 *
 * Env: OPENROUTER_API_KEY (bắt buộc để dùng AI), OPENROUTER_MODEL (tuỳ chọn,
 * nhiều model ngăn bởi dấu phẩy, thử theo thứ tự).
 */
import { SEAT_LAYOUT, type SeatLayout } from "@/lib/seats/layout";
import {
  CENTER_ROW,
  formatSeats,
  listPlacements,
  recommendSeats,
  GAP_WEIGHT,
  placementScore,
  seatIndex,
  seatOffsets,
  selectionImpact,
  validateSelection,
  type SeatZone,
} from "@/lib/seats/rules";

export type SeatAdvice = {
  verdict: "good" | "ok" | "bad";
  message: string;
  suggestion: string[] | null; // khối ghế nên đổi sang (đã kiểm hợp lệ)
  source: "ai" | "rule";
};

// Model free hay bị nhà cung cấp gốc giới hạn (429) -> có sẵn model dự phòng.
const DEFAULT_MODELS =
  "google/gemma-4-31b-it:free,nvidia/nemotron-3-super-120b-a12b:free,google/gemma-4-26b-a4b-it:free";
const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const TIMEOUT_MS = 20_000;
// Chênh điểm tổng so với khối tốt nhất còn lại vượt mức này -> "chưa tối ưu".
const SCORE_SLACK = 4;
const MAX_CANDIDATES = 4;
// Còn khối ngồi sát ghế đã có người trong phạm vi này (≈ số ghế lệch; 1 hàng =
// 1.5) mà user lại xé đôi dãy trống -> khuyên đổi sang khối sát đó.
const HUG_RADIUS = 8;

const ZONE_LABEL: Record<SeatZone, string> = {
  middle: "khối giữa",
  side: "khối bên",
  sweetbox: "Sweetbox",
};

type Candidate = { id: number; seats: string[]; label: string };

function analyze(layout: SeatLayout, taken: Set<string>, picked: string[]) {
  const index = seatIndex(layout);
  const offsets = seatOffsets(layout);
  const impact = selectionImpact(layout, taken, picked);
  const check = validateSelection(layout, {
    taken,
    picked,
    ticketsNeeded: picked.length,
  });
  const pickedScore = placementScore(layout, taken, picked);
  const best = recommendSeats(layout, taken, picked.length);
  const bestScore = best ? placementScore(layout, taken, best) : pickedScore;

  // Toạ độ (hàng, ngang) của tâm 1 nhóm ghế để đo độ gần với chỗ user chọn.
  const center = (seats: string[]) => ({
    row:
      seats.reduce((s, c) => s + (index.get(c)?.rowIndex ?? 0), 0) /
      seats.length,
    x: seats.reduce((s, c) => s + (offsets.get(c) ?? 0), 0) / seats.length,
  });
  const here = center(picked);
  const distance = (seats: string[]) => {
    const c = center(seats);
    return 1.5 * Math.abs(c.row - here.row) + Math.abs(c.x - here.x);
  };
  const samePicked = (seats: string[]) =>
    seats.every((c) => picked.includes(c));

  // Khe 2–3 ghế chỉ là vấn đề khi lựa chọn làm sơ đồ khó lấp hơn (gapCost > 0);
  // thu hẹp khe 3 ghế thành 2 ghế, lấp khe… là tốt.
  const makesAwkward = (i: { awkwardGaps: string[][]; gapCost: number }) =>
    i.awkwardGaps.length > 0 && i.gapCost > 0;

  const isSweetbox = (seats: string[]) =>
    index.get(seats[0])?.zone === "sweetbox";

  // Các khối thay thế hợp lệ, kèm ảnh hưởng của chúng. Giống recommendSeats:
  // Sweetbox chỉ tính khi ghế thường/VIP hết khối liền.
  const all = listPlacements(layout, taken, picked.length)
    .filter((seats) => !samePicked(seats))
    .map((seats) => ({
      seats,
      impact: selectionImpact(layout, taken, seats),
      d: distance(seats),
    }));
  const regular = all.filter((o) => !isSweetbox(o.seats));
  const base = regular.length > 0 ? regular : all;
  // Khối không làm sơ đồ khó lấp hơn. Không còn khối nào như vậy (vd nhóm 14
  // người, dãy nào cũng 17 ghế -> luôn thừa 3) thì khe đó là bất khả kháng,
  // không bắt lỗi khách.
  const clean = base.filter((o) => !makesAwkward(o.impact));
  const awkwardAvoidable = clean.length > 0;
  const options = awkwardAvoidable ? clean : base;
  // Gần chỗ user nhất, ưu tiên khối gọn (sát ghế có người/lấp khe).
  const nearby = [...options]
    .sort(
      (a, b) =>
        a.d +
        GAP_WEIGHT * a.impact.gapCost -
        (b.d + GAP_WEIGHT * b.impact.gapCost)
    )
    .map((o) => o.seats);
  // Khối ngồi sát ghế đã có người, không xé dãy trống, gần chỗ user nhất (ưu
  // tiên khối lấp khe).
  const hug =
    options
      .filter(
        (o) =>
          o.impact.touchesTaken && o.impact.splitRuns === 0 && o.d <= HUG_RADIUS
      )
      .sort(
        (a, b) =>
          a.d +
          GAP_WEIGHT * a.impact.gapCost -
          (b.d + GAP_WEIGHT * b.impact.gapCost)
      )[0]?.seats ?? null;

  const issues = {
    orphans: impact.newOrphans.length > 0,
    awkward: makesAwkward(impact) && awkwardAvoidable,
    apart: !impact.contiguous,
    split: impact.splitRuns > 0 && !impact.touchesTaken && !!hug,
    // Nhóm (> 1 cặp) ngồi Sweetbox cuối rạp trong khi ghế thường còn khối liền:
    // điểm Sweetbox không bị phạt khe trống nên so điểm không bắt được. Cặp đôi
    // chọn Sweetbox là sở thích, không khuyên đổi.
    far:
      (picked.length > 2 && isSweetbox(picked) && !!best && !isSweetbox(best)) ||
      pickedScore - bestScore > SCORE_SLACK,
  };
  const verdict: SeatAdvice["verdict"] = !check.ok
    ? "bad"
    : Object.values(issues).some(Boolean)
    ? "ok"
    : "good";

  // Gợi ý soạn sẵn: lỗi ghế lẻ/khe nhỏ/ngồi rời -> khối gọn gần nhất; xé dãy
  // trống -> khối sát ghế có người; chỉ chưa tối ưu -> khối tốt nhất.
  const nearest = nearby[0] ?? null;
  const ruleSuggestion =
    verdict === "good"
      ? null
      : !check.ok
      ? check.suggestion ?? nearest
      : issues.orphans || issues.awkward || issues.apart
      ? nearest
      : issues.split
      ? hug
      : best;

  const pool = [ruleSuggestion, best, hug, ...nearby].filter(
    (s): s is string[] => !!s && !samePicked(s)
  );
  const seen = new Set<string>();
  const candidates: Candidate[] = [];
  for (const seats of pool) {
    const key = [...seats].sort().join(",");
    if (seen.has(key)) continue;
    seen.add(key);
    const position = index.get(seats[0])!;
    const effect = selectionImpact(layout, taken, seats);
    const notes = [
      `hàng ${layout[position.rowIndex].label}`,
      ZONE_LABEL[position.zone],
      effect.touchesTaken ? "sát ghế đã có người" : null,
      effect.gapCost < 0 ? "lấp kín khe trống nhỏ" : null,
      effect.splitRuns > 0 ? "xé đôi dãy trống" : null,
      seats === best ? "vị trí tốt nhất còn lại" : null,
    ].filter(Boolean);
    candidates.push({
      id: candidates.length + 1,
      seats,
      label: `${formatSeats(seats)} (${notes.join(", ")})`,
    });
    if (candidates.length >= MAX_CANDIDATES) break;
  }
  const suggestedId = ruleSuggestion
    ? candidates.find((c) => c.seats === ruleSuggestion)?.id ?? null
    : null;

  return {
    impact,
    check,
    best,
    hug,
    issues,
    candidates,
    suggestedId,
    verdict,
    ruleSuggestion,
  };
}

type Analysis = ReturnType<typeof analyze>;

const describeGap = (gap: string[]) =>
  `${formatSeats(gap)} (${gap.length} ghế${
    gap.length === 3 ? ", nhóm 2 người khó ngồi cạnh nhau" : ""
  })`;

function ruleMessage(picked: string[], a: Analysis): string {
  const parts: string[] = [];
  if (!a.check.ok) parts.push(a.check.reason);
  else if (a.issues.orphans) {
    parts.push(
      `Cách chọn này bỏ lại ghế lẻ ${a.impact.newOrphans.join(
        ", "
      )}, nhưng khu này không còn chỗ ngồi liền nào tốt hơn nên bạn vẫn xác nhận được nhé.`
    );
  }
  if (a.issues.awkward) {
    parts.push(
      `Cách chọn này bỏ lại chỗ trống ${a.impact.awkwardGaps
        .map(describeGap)
        .join(", ")}, các bạn đặt vé sau sẽ khó tìm được chỗ ngồi cạnh nhau ở đó.`
    );
  }
  if (a.issues.apart) parts.push("Các ghế bạn chọn đang không ngồi liền nhau.");
  if (a.issues.split && a.hug) {
    parts.push(
      `Bạn đang chọn giữa một dãy ghế trống, trong khi ngay gần đó còn chỗ sát ghế đã có người (${formatSeats(
        a.hug
      )}). Ngồi sát sẽ giữ phần ghế trống còn lại liền nhau cho các bạn đặt sau.`
    );
  }
  if (a.verdict === "good") {
    parts.push(
      `Vị trí ${formatSeats(picked)} rất ổn: ${
        a.impact.gapCost < 0
          ? "bạn đã lấp kín chỗ trống giữa các ghế có người, giúp các bạn đặt sau dễ chọn chỗ hơn."
          : "gần giữa rạp và không bỏ lại ghế lẻ cho các bạn đặt sau."
      }`
    );
  } else if (a.issues.far && parts.length === 0) {
    parts.push(
      `Vị trí ${formatSeats(
        picked
      )} không bỏ lại ghế lẻ nào, nhưng hiện vẫn còn chỗ gần giữa rạp hơn (quanh hàng ${CENTER_ROW}).`
    );
  }
  if (a.verdict !== "good" && a.ruleSuggestion && a.check.ok) {
    parts.push(
      `Bạn có thể cân nhắc đổi sang ${formatSeats(
        a.ruleSuggestion
      )} (viền xanh) để có chỗ ngồi đẹp hơn.`
    );
  }
  return parts.join(" ");
}

function buildPrompt(picked: string[], a: Analysis) {
  // Tên trường là ngôn ngữ đời thường: model hay chép nguyên tên trường/giá trị
  // kỹ thuật (vd "đánh giá hệ thống là good") vào câu trả lời cho khách.
  const facts = {
    ghe_ban_chon: formatSeats(picked),
    hang: a.impact.rows,
    khu: a.impact.zones.map((z) => ZONE_LABEL[z]),
    ngoi_lien_nhau: a.impact.contiguous,
    ngoi_sat_ghe_da_co_nguoi: a.impact.touchesTaken,
    lap_kin_cho_trong_nho: a.impact.gapCost < 0,
    ghe_le_bi_bo_lai: a.impact.newOrphans,
    cho_trong_nho_kho_ngoi_bi_bo_lai: a.issues.awkward
      ? a.impact.awkwardGaps.map(describeGap)
      : [],
    // Tách 2 trường: gộp chung khiến AI tưởng ghế gợi ý là dãy bị xé.
    ngoi_lot_giua_day_ghe_trong: a.issues.split,
    cho_sat_ghe_co_nguoi_gan_do:
      a.issues.split && a.hug ? formatSeats(a.hug) : null,
    con_cho_gan_trung_tam_hon: a.issues.far,
    loi_khong_chon_duoc: a.check.ok ? null : a.check.reason,
    nen_doi_cho: a.verdict !== "good",
    cho_khac_co_the_chon: a.candidates.map((c) => ({ id: c.id, ghe: c.label })),
    cho_nen_goi_y: a.suggestedId,
  };
  const system = [
    "Bạn là Doom Bot, trợ lý chọn ghế của rạp phim. Trả lời bằng tiếng Việt có dấu, lịch sự, thân thiện, dễ hiểu như nhân viên rạp nói chuyện với khách.",
    "Khách KHÔNG cần biết cách tính toán: TUYỆT ĐỐI không nhắc tới hệ thống, thuật toán, điểm số, đánh giá, tiêu chí, dữ liệu, id, tên trường JSON hay các từ tiếng Anh (good, ok, bad...).",
    `Chỗ đẹp là chỗ gần giữa rạp (quanh hàng ${CENTER_ROW}). Chỗ chọn tốt cũng là chỗ không bỏ lại ghế lẻ hay khoảng trống 2–3 ghế khó ngồi, vì các bạn đặt vé sau (thường đi theo cặp) sẽ khó tìm được chỗ ngồi cạnh nhau.`,
    "Chỉ dùng thông tin được đưa, không tự suy ra ghế nào khác.",
    "Nếu nen_doi_cho là true: gợi ý đúng 1 chỗ trong cho_khac_co_the_chon (ưu tiên cho_nen_goi_y). Nếu false: pick là null.",
    "Viết 2–3 câu ngắn, xưng 'bạn':",
    "- Nếu nen_doi_cho là false: khen chỗ khách chọn và nói ngắn gọn lý do (gần giữa rạp, không bỏ lại ghế lẻ/lấp kín chỗ trống...).",
    "- Nếu nen_doi_cho là true: nói nhẹ nhàng vì sao chỗ hiện tại chưa ổn (nêu đúng tên ghế lẻ/chỗ trống bị bỏ lại nếu có, hoặc vì còn chỗ gần giữa rạp hơn), rồi mời khách cân nhắc đổi sang chỗ gợi ý, gọi bằng tên ghế, kèm lợi ích ngắn.",
    'Chỉ trả về JSON, không thêm chữ nào khác: {"message": "<2–3 câu>", "pick": <id hoặc null>}',
  ].join("\n");
  return { system, user: JSON.stringify(facts) };
}

// Câu trả lời lộ từ kỹ thuật/tiếng Anh dù prompt đã cấm -> dùng câu soạn sẵn.
const TECHNICAL_WORDS =
  /\b(good|ok|bad|id|json|score|verdict|wybor)\b|hệ thống|thuật toán|điểm số|đánh giá|tiêu chí|dữ liệu|phương án số|nen_doi|cho_khac|ghe_ban/i;

async function askAI(picked: string[], a: Analysis) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return null;
  const { system, user } = buildPrompt(picked, a);
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "X-Title": "MarvelVN",
      },
      body: JSON.stringify({
        // OpenRouter thử lần lượt: model đầu lỗi/quá tải thì chuyển model sau.
        models: (process.env.OPENROUTER_MODEL || DEFAULT_MODELS)
          .split(",")
          .map((m) => m.trim())
          .filter(Boolean),
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.3,
        // Model "reasoning" (openrouter/free hay chọn) tốn token suy nghĩ trước
        // khi trả lời — chừa đủ chỗ, bảo suy nghĩ ít và không trả phần đó về.
        max_tokens: 4000,
        reasoning: { effort: "low", exclude: true },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error(
        "seat-advisor: OpenRouter",
        res.status,
        (await res.text()).slice(0, 300)
      );
      return null;
    }
    const data = await res.json();
    const content: string = data?.choices?.[0]?.message?.content ?? "";
    const start = content.indexOf("{");
    if (start < 0) {
      console.error(
        "seat-advisor: AI không trả JSON",
        data?.model,
        data?.choices?.[0]?.finish_reason
      );
      return null;
    }
    const parsed = JSON.parse(
      content.slice(start, content.lastIndexOf("}") + 1)
    ) as {
      message?: unknown;
      pick?: unknown;
    };
    if (typeof parsed.message !== "string" || !parsed.message.trim())
      return null;
    // Model hay chen "(phương án 1)"/"id 2" dù prompt đã cấm.
    const message = parsed.message
      .replace(/\s*\((?:phương án|id)\s*(?:số\s*)?\d+\)/gi, "")
      .trim();
    if (TECHNICAL_WORDS.test(message)) {
      console.error("seat-advisor: AI dùng từ kỹ thuật", message.slice(0, 200));
      return null;
    }
    return {
      message: message.slice(0, 600),
      pick: typeof parsed.pick === "number" ? parsed.pick : null,
    };
  } catch (err) {
    console.error("seat-advisor: lỗi gọi AI", err);
    return null;
  }
}

// Giới hạn lượt hỏi AI theo user (bộ nhớ process — đủ để chặn spam, giữ quota
// gói free). Hết lượt vẫn trả lời soạn sẵn.
const RATE_WINDOW_MS = 10 * 60_000;
const RATE_MAX = 15;
const calls = new Map<string, number[]>();
function allowAI(userId: string): boolean {
  const now = Date.now();
  const recent = (calls.get(userId) ?? []).filter(
    (t) => now - t < RATE_WINDOW_MS
  );
  if (recent.length >= RATE_MAX) {
    calls.set(userId, recent);
    return false;
  }
  recent.push(now);
  calls.set(userId, recent);
  return true;
}

// Cùng sơ đồ + cùng lựa chọn -> dùng lại câu trả lời, khỏi gọi AI lần nữa.
const CACHE_MAX = 300;
const cache = new Map<string, SeatAdvice>();

export async function adviseSelection(
  userId: string,
  eventId: string,
  taken: Set<string>,
  picked: string[]
): Promise<SeatAdvice> {
  const cacheKey = `${eventId}|${[...taken].sort().join(",")}|${[...picked]
    .sort()
    .join(",")}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const a = analyze(SEAT_LAYOUT, taken, picked);
  const fallbackSuggestion = a.ruleSuggestion;

  const ai = allowAI(userId) ? await askAI(picked, a) : null;
  const advice: SeatAdvice = ai
    ? {
        verdict: a.verdict,
        message: ai.message,
        suggestion:
          a.verdict === "good"
            ? null
            : a.candidates.find((c) => c.id === ai.pick)?.seats ??
              fallbackSuggestion,
        source: "ai",
      }
    : {
        verdict: a.verdict,
        message: ruleMessage(picked, a),
        suggestion: fallbackSuggestion,
        source: "rule",
      };

  if (ai) {
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
    cache.set(cacheKey, advice);
  }
  return advice;
}
