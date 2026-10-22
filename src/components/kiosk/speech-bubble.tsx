"use client";

import { useId, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { BubbleShape, DoomLine } from "./doom-lines";

/**
 * Ô thoại comic phía trên linh vật. Hình (bóng nói có đuôi / mây nghĩ / nổ
 * gai) được vẽ SVG theo kích thước THẬT của khối chữ (đo bằng ResizeObserver)
 * nên viền không bị kéo méo, chấm halftone vẫn tròn. 3 lớp: bóng chấm lệch
 * xuống phải -> viền mực (stroke dày, nửa trong bị lớp trắng che) -> nền trắng.
 * Đổi câu -> `key` mới -> bật lại hiệu ứng "pop".
 * Khung ngoài cao cố định (đủ ~4 dòng), bóng bám đáy và nở lên trên -> câu dài
 * ngắn khác nhau không làm linh vật bên dưới co giãn.
 */
export function SpeechBubble({ line }: { line: DoomLine }) {
  return (
    <div aria-live="polite" className="flex h-52 w-full max-w-sm shrink-0 flex-col justify-end px-3 pb-9 pt-3">
      <Bubble key={line.text} line={line} />
    </div>
  );
}

const PADDING: Record<BubbleShape, string> = {
  speech: "px-[14%] py-6",
  think: "px-[13%] py-6",
  shout: "px-[15%] py-7",
};

function Bubble({ line }: { line: DoomLine }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const dotsId = useId();

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setSize({ w: el.offsetWidth, h: el.offsetHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const shapes = size && size.w > 0 ? bubbleShapes(line.shape, size.w, size.h) : null;
  const drawn = shapes && (
    <>
      {shapes.paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
      {shapes.circles.map(([cx, cy, r], i) => (
        <circle key={`c${i}`} cx={cx} cy={cy} r={r} />
      ))}
    </>
  );

  return (
    <div ref={ref} className="kiosk-bubble" data-tone={line.tone} data-shape={line.shape}>
      {shapes && (
        <svg
          aria-hidden
          width={size!.w}
          height={size!.h}
          className="pointer-events-none absolute left-0 top-0 overflow-visible"
        >
          <defs>
            <pattern id={dotsId} width="5.5" height="5.5" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
              <circle cx="2.75" cy="2.75" r="1.5" style={{ fill: "var(--bubble-shadow)" }} />
            </pattern>
          </defs>
          <g transform="translate(10 10)" fill={`url(#${dotsId})`}>
            {drawn}
          </g>
          <g fill="var(--bubble-ink)" stroke="var(--bubble-ink)" strokeWidth="6" strokeLinejoin="round">
            {drawn}
          </g>
          <g fill="#fff">{drawn}</g>
        </svg>
      )}
      <p className={cn("relative", PADDING[line.shape])}>{line.text}</p>
    </div>
  );
}

// --- Hình học (đơn vị px, gốc ở góc trên-trái khối chữ) ----------------------

type Pt = [number, number];

/** Siêu elip bậc 3 (giữa elip và chữ nhật bo góc) ôm khối w×h, co vào `inset` px. */
function squircle(w: number, h: number, inset = 0, steps = 240): Pt[] {
  const a = w / 2 - inset;
  const b = h / 2 - inset;
  const pts: Pt[] = [];
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const c = Math.cos(t);
    const s = Math.sin(t);
    pts.push([w / 2 + a * Math.sign(c) * Math.abs(c) ** (2 / 3), h / 2 + b * Math.sign(s) * Math.abs(s) ** (2 / 3)]);
  }
  return pts;
}

/** Lấy lại điểm cách đều nhau ~`spacing` px theo chiều dài đường khép kín. */
function resample(pts: Pt[], spacing: number): Pt[] {
  const seg: number[] = [];
  let total = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    const d = Math.hypot(x2 - x1, y2 - y1);
    seg.push(d);
    total += d;
  }
  const n = Math.max(8, Math.round(total / spacing));
  const out: Pt[] = [];
  let i = 0;
  let acc = 0;
  for (let k = 0; k < n; k++) {
    const target = (k / n) * total;
    while (acc + seg[i] < target) acc += seg[i++];
    const f = (target - acc) / seg[i];
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    out.push([x1 + (x2 - x1) * f, y1 + (y2 - y1) * f]);
  }
  return out;
}

const toPath = (pts: Pt[]) => `M${pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join("L")}Z`;

/** Nhiễu cố định theo chỉ số (0..1) để gai/mây trông vẽ tay nhưng không nhảy mỗi lần render. */
const jitter = (i: number) => ((i * 7919) % 13) / 13;

function bubbleShapes(shape: BubbleShape, w: number, h: number): { paths: string[]; circles: [number, number, number][] } {
  const cx = w / 2;

  if (shape === "think") {
    // Mây: thân squircle + vòng bướu tròn dọc mép + 2 bong bóng nhỏ trôi xuống Doom.
    const r = Math.min(20, Math.max(12, h * 0.2));
    const bumps = resample(squircle(w, h, r * 0.35), r * 1.25).map(
      ([x, y], i) => [x, y, r * (0.85 + 0.3 * jitter(i))] as [number, number, number],
    );
    return {
      paths: [toPath(squircle(w, h))],
      circles: [...bumps, [cx - 12, h + 18, 8], [cx - 24, h + 33, 4.5]],
    };
  }

  if (shape === "shout") {
    // Nổ gai: đỉnh nhô ra / lõm vào xen kẽ dọc mép, dài ngắn không đều.
    const a = w / 2;
    const b = h / 2;
    const pts = resample(squircle(w, h, -2), 26).map(([x, y], i): Pt => {
      // Pháp tuyến hướng ra ngoài của elip tại điểm đó.
      const gx = (x - cx) / (a * a);
      const gy = (y - b) / (b * b);
      const len = Math.hypot(gx, gy) || 1;
      const out = i % 2 === 0 ? 12 + 12 * jitter(i) : -3;
      return [x + (gx / len) * out, y + (gy / len) * out];
    });
    return { paths: [toPath(pts)], circles: [] };
  }

  // Bóng nói: thân squircle + đuôi cong chĩa xuống đầu Doom.
  const tail = `M${cx - 30},${h - 10} Q${cx - 16},${h + 12} ${cx + 4},${h + 28} Q${cx - 4},${h + 8} ${cx - 6},${h - 10}Z`;
  return { paths: [toPath(squircle(w, h)), tail], circles: [] };
}
