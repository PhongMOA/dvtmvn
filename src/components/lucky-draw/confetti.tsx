"use client";

import { useEffect, useRef } from "react";

const COLORS = ["#fbbf24", "#f87171", "#60a5fa", "#34d399", "#f472b6", "#ffffff"];
const DURATION_MS = 3500;

/** Pháo giấy phủ kín phần tử cha (cha cần `relative`). Tự tắt sau ~3.5s. */
export function Confetti() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const g = canvas?.getContext("2d");
    if (!canvas || !g) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = width;
    canvas.height = height;
    const pieces = Array.from({ length: 160 }, () => ({
      x: width / 2 + (Math.random() - 0.5) * width * 0.3,
      y: height * 0.45,
      vx: (Math.random() - 0.5) * 16,
      vy: -Math.random() * 16 - 4,
      size: 6 + Math.random() * 6,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    }));

    const startedAt = performance.now();
    let frame = 0;
    function draw(now: number) {
      const elapsed = now - startedAt;
      g!.clearRect(0, 0, width, height);
      g!.globalAlpha = Math.max(0, 1 - elapsed / DURATION_MS);
      for (const p of pieces) {
        p.vy += 0.35;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        g!.save();
        g!.translate(p.x, p.y);
        g!.rotate(p.rot);
        g!.fillStyle = p.color;
        g!.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        g!.restore();
      }
      if (elapsed < DURATION_MS) frame = requestAnimationFrame(draw);
    }
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, []);

  return <canvas ref={ref} className="pointer-events-none absolute inset-0 size-full" />;
}
