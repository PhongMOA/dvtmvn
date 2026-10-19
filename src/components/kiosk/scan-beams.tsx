"use client";

import { useEffect, useId, useRef, type RefObject } from "react";
import { DOOM_GEOMETRY } from "./mascot";

/**
 * Tia quét từ 2 mắt Doom tới ô camera (`.kiosk-camera-hole`): mỗi tia là tam
 * giác từ tâm mắt tới mép trái ô, đáy tia cao đúng bằng chiều cao ô. Lớp phủ
 * toàn màn kiosk, không bắt chạm.
 *
 * Vị trí đo bằng getBoundingClientRect mỗi khung hình rồi ghi thẳng vào
 * attribute `points` (không qua state) — ô camera nạp động nên có thể xuất
 * hiện sau, và đổi kích thước theo màn hình.
 */
export function ScanBeams({
  rootRef,
  mascotRef,
  color,
}: {
  rootRef: RefObject<HTMLElement | null>;
  mascotRef: RefObject<SVGSVGElement | null>;
  color: string;
}) {
  const gradId = `beam-${useId().replace(/:/g, "")}`;
  const svgRef = useRef<SVGSVGElement | null>(null);
  const beamRefs = useRef<(SVGPolygonElement | null)[]>([]);

  useEffect(() => {
    let raf = 0;
    let last = "";

    function frame() {
      raf = requestAnimationFrame(frame);
      const root = rootRef.current;
      const mascot = mascotRef.current;
      const hole = root?.querySelector(".kiosk-camera-hole");
      const svg = svgRef.current;
      if (!root || !mascot || !hole || !svg) {
        if (svg) svg.style.visibility = "hidden";
        return;
      }
      const rr = root.getBoundingClientRect();
      const mr = mascot.getBoundingClientRect();
      const hr = hole.getBoundingClientRect();

      // viewBox -> màn hình (preserveAspectRatio mặc định: xMidYMid meet).
      const { width: W, height: H, eyes, eyeY } = DOOM_GEOMETRY;
      const scale = Math.min(mr.width / W, mr.height / H);
      const ox = mr.left + (mr.width - W * scale) / 2 - rr.left;
      const oy = mr.top + (mr.height - H * scale) / 2 - rr.top;
      const hx = hr.left - rr.left;
      const top = hr.top - rr.top;
      const bottom = hr.bottom - rr.top;

      const all = eyes.map((x) => {
        const ex = ox + x * scale;
        const ey = oy + eyeY * scale;
        return `${ex.toFixed(1)},${ey.toFixed(1)} ${hx.toFixed(1)},${top.toFixed(1)} ${hx.toFixed(1)},${bottom.toFixed(1)}`;
      });
      const key = all.join("|");
      if (key === last) return;
      last = key;
      all.forEach((points, i) => beamRefs.current[i]?.setAttribute("points", points));
      // Ô camera nằm bên trái mắt (bố cục dọc) -> không vẽ tia.
      svg.style.visibility = hx > ox + eyes[1] * scale ? "visible" : "hidden";
    }

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [rootRef, mascotRef]);

  return (
    <svg
      ref={svgRef}
      aria-hidden
      className="kiosk-beams pointer-events-none absolute inset-0 z-[5] size-full"
      style={{ visibility: "hidden" }}
    >
      <defs>
        <linearGradient id={gradId} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor={color} stopOpacity="0.85" />
          <stop offset="1" stopColor={color} stopOpacity="0.2" />
        </linearGradient>
      </defs>
      <g className="kiosk-beams-pulse" fill={`url(#${gradId})`}>
        {DOOM_GEOMETRY.eyes.map((x, i) => (
          <polygon
            key={x}
            ref={(el) => {
              beamRefs.current[i] = el;
            }}
          />
        ))}
      </g>
    </svg>
  );
}
