// Âm thanh màn quay số bằng Web Audio (không cần file âm thanh). AudioContext
// chỉ tạo sau lần bấm Quay đầu tiên — trình duyệt chặn phát tiếng trước khi
// người dùng tương tác.

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    try {
      ctx = new AudioContext();
    } catch {
      return null;
    }
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function beep(freq: number, durationMs: number, volume: number, delayMs = 0, type: OscillatorType = "square") {
  const ac = audio();
  if (!ac) return;
  const start = ac.currentTime + delayMs / 1000;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + durationMs / 1000);
  osc.connect(gain).connect(ac.destination);
  osc.start(start);
  osc.stop(start + durationMs / 1000 + 0.02);
}

/** Tiếng "tick" mỗi bước; `heavy` = chặng thật chậm, trầm và to hơn. */
export function playTick(heavy: boolean) {
  if (heavy) beep(420, 140, 0.18, 0, "triangle");
  else beep(1100, 25, 0.04);
}

/** Tiếng "ta-da" khi dừng ở ghế trúng. */
export function playWin() {
  [523, 659, 784, 1047].forEach((f, i) => beep(f, i === 3 ? 700 : 160, 0.16, i * 120, "triangle"));
}

/** Gọi trong handler bấm nút để mở khoá âm thanh. */
export function unlockAudio() {
  audio();
}
