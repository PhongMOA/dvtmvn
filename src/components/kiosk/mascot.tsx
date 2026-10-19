"use client";

import { useId, type CSSProperties } from "react";
import { cn } from "@/lib/utils";

export type MascotMood = "idle" | "scanning" | "success" | "error" | "sleep";

// Ảnh gốc đã tách nền + khoét trong suốt 2 hốc mắt (260x417).
export const DOOM_SRC = "/kiosk/doom.png";
const W = 260;
const H = 417;

// Tâm 2 hốc mắt trong ảnh + khung bao để phủ mí.
const EYES = [85, 174] as const;
const EYE_Y = 150;
const HOLE = { top: 127, bottom: 173, rx: 30 };

/**
 * Linh vật kiosk: Doctor Doom chibi — dùng NGUYÊN ảnh mẫu
 * (plans/261019-kiosk-checkin/assets/mascot-reference-doom-chibi.png, tách nền
 * -> public/kiosk/doom.png). Hai hốc mắt được khoét trong suốt; mắt phát sáng
 * vẽ bằng SVG PHÍA SAU ảnh nên chỉ lộ ra qua 2 lỗ.
 *
 * Chỉ MẮT đổi biểu cảm + chuyển động cả người, điều khiển bằng class
 * `doom--<mood>` (keyframes trong globals.css, mục "Kiosk mascot"). `glow` đổi
 * màu mắt; `look` (-1..1) cho mắt liếc theo điểm chạm.
 */
export function DoomMascot({
  mood = "idle",
  glow = "#ff8a1f",
  look,
  className,
  src = DOOM_SRC,
}: {
  mood?: MascotMood;
  glow?: string;
  look?: { x: number; y: number } | null;
  className?: string;
  src?: string;
}) {
  // id filter phải duy nhất nếu trang có nhiều linh vật.
  const uid = useId().replace(/:/g, "");
  const blurId = `blur-${uid}`;

  const eyeColor = mood === "error" ? "#ff3b30" : glow;
  const lookX = mood === "scanning" ? 6 : (look?.x ?? 0) * 6;
  const lookY = mood === "scanning" ? 0 : (look?.y ?? 0) * 3;
  const style = {
    "--doom-eye": eyeColor,
    "--doom-look-x": `${lookX}px`,
    "--doom-look-y": `${lookY}px`,
  } as CSSProperties;

  const happy = mood === "success";

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="Doctor Doom"
      className={cn("doom", `doom--${mood}`, className)}
      style={style}
    >
      <defs>
        <filter id={blurId} x="-1" y="-1" width="3" height="3">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>

      <g className="doom-head">
        {/* Lòng hốc mắt tối (nằm sau ảnh, chỉ lộ qua lỗ) */}
        {EYES.map((cx) => (
          <ellipse key={cx} cx={cx} cy={EYE_Y} rx={HOLE.rx} ry="26" fill="#0b0c0e" />
        ))}

        <g className="doom-eyes">
          {EYES.map((cx) => (
            <ellipse
              key={cx}
              className="doom-eye-glow"
              cx={cx}
              cy={EYE_Y}
              rx="15"
              ry="10"
              style={{ fill: "var(--doom-eye)" }}
              filter={`url(#${blurId})`}
            />
          ))}
          {happy ? (
            <g fill="none" style={{ stroke: "var(--doom-eye)" }} strokeWidth="4.5" strokeLinecap="round">
              {EYES.map((cx) => (
                <path key={cx} d={`M${cx - 12} ${EYE_Y + 6}q12-14 24 0`} />
              ))}
            </g>
          ) : (
            <g className="doom-pupils">
              {EYES.map((cx) => (
                <g key={cx}>
                  <circle cx={cx} cy={EYE_Y} r="6" style={{ fill: "var(--doom-eye)" }} />
                  <circle cx={cx - 2} cy={EYE_Y - 2} r="2" fill="#fff6dc" />
                </g>
              ))}
            </g>
          )}
          {/* Mí — sập xuống khi chớp mắt */}
          {EYES.map((cx) => (
            <rect
              key={cx}
              className="doom-lid"
              x={cx - HOLE.rx}
              y={HOLE.top}
              width={HOLE.rx * 2}
              height={HOLE.bottom - HOLE.top}
              fill="#aeb5bd"
            />
          ))}
        </g>

        <image href={src} width={W} height={H} />

        {/* Tia quét khi đang đọc QR */}
        <path
          className="doom-beam"
          d={`M${EYES[1] + 8} ${EYE_Y - 4} ${W} ${EYE_Y - 34}v68L${EYES[1] + 8} ${EYE_Y + 6}Z`}
          style={{ fill: "var(--doom-eye)" }}
          opacity="0.35"
        />
      </g>

      {/* "z z z" khi ngủ */}
      <g className="doom-zzz" fill="#cfe9ff" stroke="#15171a" strokeWidth="1" fontWeight="800" fontFamily="sans-serif">
        <text x="200" y="70" fontSize="26">z</text>
        <text x="220" y="44" fontSize="19">z</text>
        <text x="236" y="24" fontSize="14">z</text>
      </g>
    </svg>
  );
}
