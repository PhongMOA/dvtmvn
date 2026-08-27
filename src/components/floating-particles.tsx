"use client";

import { useEffect, useRef } from "react";

// Lớp đốm sáng nhỏ trôi chéo 45° từ trên xuống (như bụi phát sáng bay qua khung
// hình). Mỗi đốm sống một quãng ngắn: hiện lên, nhấp nháy nhẹ rồi mờ dần và biến
// mất trong lúc vẫn đang trôi. Vẽ bằng canvas, phủ kín phần tử cha (cha phải
// position: relative). Tôn trọng prefers-reduced-motion.
type Particle = {
  x: number;
  y: number;
  r: number; // bán kính lõi px
  speed: number; // px/giây dọc theo hướng 45°
  phase: number; // pha nhấp nháy
  twinkle: number; // tốc độ nhấp nháy
  alpha: number; // độ mờ đỉnh (giữa vòng đời)
  life: number; // giây đã sống
  maxLife: number; // tổng vòng đời (giây)
  warm: boolean; // ánh vàng ấm hay trắng xanh
};

// Hướng trôi: chéo xuống-phải, 45 độ.
const DIR_X = Math.SQRT1_2;
const DIR_Y = Math.SQRT1_2;

export function FloatingParticles({
  density = 0.00004,
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

    // Tái sinh 1 đốm ở nửa trên khung (để nó còn quãng đường trôi chéo xuống).
    function spawn(p: Particle, spread: boolean) {
      p.x = rand(-0.15 * width, width);
      p.y = spread ? rand(-0.15 * height, height) : rand(-0.15 * height, 0.15 * height);
      p.r = rand(0.5, 1.6);
      p.speed = rand(10, 26);
      p.phase = rand(0, Math.PI * 2);
      p.twinkle = rand(1.4, 3.2);
      p.alpha = rand(0.06, 0.2);
      p.life = spread ? rand(0, 2) : 0;
      p.maxLife = rand(2.6, 5.5);
      p.warm = Math.random() < 0.35;
    }

    function makeParticle(spread: boolean): Particle {
      const p = {} as Particle;
      spawn(p, spread);
      return p;
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
      particles = Array.from({ length: Math.max(6, target) }, () =>
        makeParticle(true),
      );
    }

    function draw(now: number) {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      ctx!.clearRect(0, 0, width, height);

      for (const p of particles) {
        p.life += dt;
        p.phase += p.twinkle * dt;
        p.x += DIR_X * p.speed * dt;
        p.y += DIR_Y * p.speed * dt;

        // Hết vòng đời hoặc trôi ra ngoài -> tái sinh từ trên.
        if (p.life >= p.maxLife || p.y > height + 20 || p.x > width + 20) {
          spawn(p, false);
          continue;
        }

        // Bao hình vòng đời: 0 -> 1 -> 0, đầy đặn ở giữa.
        const t = p.life / p.maxLife;
        const envelope = Math.pow(Math.sin(Math.PI * t), 0.7);
        // Nhấp nháy nhẹ (biên độ nhỏ).
        const flicker = 0.82 + 0.18 * Math.sin(p.phase);
        const a = p.alpha * envelope * flicker;
        if (a <= 0.002) continue;

        const glow = p.r * 4.5;
        const core = p.warm ? "255, 224, 168" : "210, 255, 222";

        const grad = ctx!.createRadialGradient(p.x, p.y, 0, p.x, p.y, glow);
        grad.addColorStop(0, `rgba(${core}, ${a})`);
        grad.addColorStop(0.45, `rgba(${core}, ${a * 0.28})`);
        grad.addColorStop(1, `rgba(${core}, 0)`);

        ctx!.fillStyle = grad;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, glow, 0, Math.PI * 2);
        ctx!.fill();

        ctx!.fillStyle = `rgba(255, 255, 255, ${a * 0.9})`;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.r * 0.55, 0, Math.PI * 2);
        ctx!.fill();
      }

      raf = requestAnimationFrame(draw);
    }

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    if (reduceMotion) {
      // Vẽ 1 khung tĩnh, không animate.
      ctx.clearRect(0, 0, width, height);
      for (const p of particles) {
        ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha * 0.7})`;
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
