"use client";

import { useEffect, useRef } from "react";

// Lớp đốm sáng nhỏ bay lơ lửng trong không khí (như bụi/tro phát sáng trôi
// trước ống kính). Vẽ bằng canvas, phủ kín phần tử cha (cha phải position:
// relative). Tự dừng khi user bật "giảm chuyển động".
type Particle = {
  x: number;
  y: number;
  r: number; // bán kính px
  vx: number; // px/giây
  vy: number;
  drift: number; // biên độ lắc ngang
  phase: number; // pha lắc + nhấp nháy
  twinkle: number; // tốc độ nhấp nháy
  alpha: number; // độ mờ nền
  warm: boolean; // ánh vàng ấm hay trắng xanh
};

export function FloatingParticles({
  density = 0.00012,
  className,
}: {
  density?: number; // số đốm trên mỗi px² (điều tiết theo diện tích)
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let particles: Particle[] = [];
    let raf = 0;
    let last = performance.now();

    const rand = (min: number, max: number) => min + Math.random() * (max - min);

    function makeParticle(atRandomY: boolean): Particle {
      return {
        x: rand(0, width),
        y: atRandomY ? rand(0, height) : height + rand(0, 40),
        r: rand(0.6, 2.2),
        vx: rand(-6, 6),
        vy: rand(-14, -4),
        drift: rand(6, 20),
        phase: rand(0, Math.PI * 2),
        twinkle: rand(0.6, 1.8),
        alpha: rand(0.25, 0.75),
        warm: Math.random() < 0.35,
      };
    }

    function resize() {
      const rect = canvas!.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas!.width = Math.round(width * dpr);
      canvas!.height = Math.round(height * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

      const target = Math.round(width * height * density);
      particles = Array.from({ length: Math.max(12, target) }, () =>
        makeParticle(true),
      );
    }

    function draw(now: number) {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      ctx!.clearRect(0, 0, width, height);

      for (const p of particles) {
        p.phase += p.twinkle * dt;
        p.x += (p.vx + Math.sin(p.phase) * p.drift) * dt;
        p.y += p.vy * dt;

        // trôi hết cạnh trên -> tái sinh từ dưới
        if (p.y < -10 || p.x < -20 || p.x > width + 20) {
          Object.assign(p, makeParticle(false));
          continue;
        }

        const flicker = 0.55 + 0.45 * Math.sin(p.phase * 1.7);
        const a = p.alpha * flicker;
        const glow = p.r * 4;

        const grad = ctx!.createRadialGradient(p.x, p.y, 0, p.x, p.y, glow);
        const core = p.warm
          ? "255, 226, 170"
          : "213, 255, 224";
        grad.addColorStop(0, `rgba(${core}, ${a})`);
        grad.addColorStop(0.4, `rgba(${core}, ${a * 0.35})`);
        grad.addColorStop(1, `rgba(${core}, 0)`);

        ctx!.fillStyle = grad;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, glow, 0, Math.PI * 2);
        ctx!.fill();

        ctx!.fillStyle = `rgba(255, 255, 255, ${a})`;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.r * 0.6, 0, Math.PI * 2);
        ctx!.fill();
      }

      raf = requestAnimationFrame(draw);
    }

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    if (reduceMotion) {
      // vẽ 1 khung tĩnh, không animate
      last = performance.now();
      ctx.clearRect(0, 0, width, height);
      for (const p of particles) {
        ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha * 0.6})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 0.7, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      last = performance.now();
      raf = requestAnimationFrame(draw);
    }

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [density]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={className}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    />
  );
}
