/* Engine khuôn mặt Uni, tách nguyên từ mô phỏng 3D (cùng code với canvas khuôn mặt).
   Dùng: var f = new UniFace.Face(); f.setExpr('happy'); mỗi khung gọi f.step(dt) rồi vẽ f.cv lên màn hình.
   f.small = true để mặt thu về góc dưới trái; f.view = [x, y] (-1..1) là hướng nhìn; f.head = {pan, tilt} là lệnh đầu gợi ý cho servo. */
(function () {
'use strict';
var $ = function (s) { return document.querySelector(s); };
var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
var D2R = Math.PI / 180, R2D = 180 / Math.PI;
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function rnd(a, b) { return a + Math.random() * (b - a); }
function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
function damp(k, dt) { return 1 - Math.exp(-k * dt); }
// lò xo giảm chấn tới hạn (kiểu SmoothDamp): bắt đầu êm, tới đích êm, không vượt quá đích. st là thời gian bám (giây), v là vận tốc lưu giữa các khung
function sdamp(x, g, v, k, st, dt) {
  var w = 2 / st, e = w * dt, ex = 1 / (1 + e + 0.48 * e * e + 0.235 * e * e * e), c = x - g, tp = (v[k] + w * c) * dt;
  v[k] = (v[k] - w * tp) * ex; return g + (c + tp) * ex;
}
function ease(p) { p = clamp(p, 0, 1); return p * p * (3 - 2 * p); }
var MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';

/* =========================================================
   KHUÔN MẶT UNI (vẽ lên canvas, dùng làm texture màn hình)
   ========================================================= */
var DEF = { w: 1, h: 1, top: 0, slant: 0, tcurve: 0, bA: 0, bB: 1, minT: 0.14, pill: 0, line: 0, lineY: 0, lineC: 0, lw: 1, cap: 0, arc: 0, arcR: 0.774, arcY: 0.405, arcS: 1.1, arcT: 0.31, arcD: 1, dx: 0, dy: 0, s: 1, rot: 0, gl: 0 };
var PKEYS = Object.keys(DEF);
function addp(o, k, v) { o[k] = (o[k] || 0) + v; }
function both(o, k, v) { addp(o.e[0], k, v); addp(o.e[1], k, v); }
// các dáng chuyển động dùng đường cong êm hai đầu thay cho đường thẳng gãy khúc, để không bị giật khi đổi hướng
function prof(p) { return p < 0.4 ? ease(p / 0.4) : ease(1 - (p - 0.4) / 0.6); }
function trap(p) { return p < 0.2 ? ease(p / 0.2) : (p > 0.8 ? ease((1 - p) / 0.2) : 1); }
function backOut(p) { var c = 1.7; p = p - 1; return 1 + (c + 1) * p * p * p + c * p * p; }
function trigger(s, te, a, dur) {
  if (s.next === undefined) s.next = te + (a.first !== undefined ? a.first : rnd(0.4, a.max || 3));
  if (s.st === undefined && te >= s.next) s.st = te;
  if (s.st === undefined) return -1;
  var p = (te - s.st) / dur;
  if (p >= 1) { s.st = undefined; s.n = (s.n || 0) + 1; s.next = a.times && s.n >= a.times ? Infinity : te + (Math.random() < (a.dbl || 0) ? 0.1 : rnd(a.min || 2, a.max || 5)); return -1; }
  return p;
}
var ACT = {
  blink: function (s, te, dt, o, a) { var p = trigger(s, te, a, a.dur || 0.17); if (p >= 0) o.blink = Math.max(o.blink, prof(p)); },
  blinkAt: function (s, te, dt, o, a) { a.at.forEach(function (t) { var p = (te - t) / 0.17; if (p >= 0 && p <= 1) o.blink = Math.max(o.blink, prof(p)); }); },
  saccade: function (s, te, dt, o, a) {
    if (s.next === undefined || te >= s.next) { s.x = rnd(-a.amp, a.amp); s.y = rnd(-a.amp * 0.6, a.amp * 0.6); s.next = te + rnd(a.min, a.max); }
    o.gx += s.x; o.gy += s.y;
  },
  bob: function (s, te, dt, o, a) { o.fdy += a.amp * (a.decay ? Math.exp(-te / a.decay) : 1) * Math.sin(2 * Math.PI * te / a.per); },
  bounce: function (s, te, dt, o, a) { o.fdy -= a.amp * (a.decay ? Math.exp(-te / a.decay) : 1) * Math.abs(Math.sin(Math.PI * te / a.per)); },
  alt: function (s, te, dt, o, a) {
    if (s.side === undefined) { s.side = Math.random() < 0.5 ? 0 : 1; s.phase = 'rest'; s.until = te + (a.delay !== undefined ? a.delay : rnd(0.3, 0.7)); s.env = 0; s.n = 0; }
    if (te >= s.until && !s.done) {
      if (s.phase === 'rest') {
        if (s.n >= a.times) s.done = true;
        else { s.phase = 'on'; s.n += 1; if (s.n > 1 && Math.random() < 0.8) s.side = 1 - s.side; s.until = te + rnd(a.hold[0], a.hold[1]); }
      } else if (a.holdLast && s.n >= a.times) s.done = true;
      else { s.phase = 'rest'; s.until = te + rnd(a.rest[0], a.rest[1]); }
    }
    s.env += ((s.phase === 'on' && !(s.done && !a.holdLast) ? 1 : 0) - s.env) * damp(8, dt);
    var A = o.e[s.side], B = o.e[1 - s.side], v = s.env;
    if (a.mode === 'zoom') { addp(A, 's', (a.scale - 1) * v); addp(A, 'dy', -0.05 * v); addp(B, 's', -0.03 * v); }
    else { addp(A, 'top', 0.4 * v); addp(B, 's', 0.08 * v); addp(B, 'h', 0.05 * v); }
    o.ftilt += (s.side ? 1 : -1) * (a.tilt || 0) * v;
  },
  glance: function (s, te, dt, o, a) { var p = trigger(s, te, a, a.dur); if (p >= 0) o.look = Math.max(o.look, trap(p)); },
  around: function (s, te, dt, o, a) {
    if (s.next === undefined || te >= s.next) {
      var i; do { i = Math.floor(Math.random() * a.pts.length); } while (i === s.i && a.pts.length > 1);
      s.i = i; s.next = te + rnd(a.hold[0], a.hold[1]);
    }
    o.gset = a.pts[s.i];
    s.tl = (s.tl || 0) + (a.pts[s.i][0] * (a.tilt || 0) - (s.tl || 0)) * damp(3, dt);
    o.ftilt += s.tl;
  },
  heart: function (s, te, dt, o, a) {
    var ph = (te % a.per) / a.per;
    var p = ph < 0.12 ? Math.sin(ph / 0.12 * Math.PI) : (ph < 0.3 ? 0.55 * Math.sin((ph - 0.12) / 0.18 * Math.PI) : 0);
    p *= a.decay ? Math.exp(-te / a.decay) : 1;
    o.gs[0] *= 1 + a.amp * p; o.gs[1] *= 1 + a.amp * p;
  },
  pop: function (s, te, dt, o, a) { both(o, 's', a.amp * Math.exp(-te * 5) * Math.cos(te * 13)); },
  settle: function (s, te, dt, o, a) { both(o, 's', a.amp * Math.exp(-te * a.k)); },
  squeeze: function (s, te, dt, o, a) { var p = trigger(s, te, a, 0.3); if (p >= 0) { var v = Math.sin(p * Math.PI); both(o, 'w', 0.07 * v); both(o, 'h', -0.12 * v); } },
  // nháy đúng một lần: mắt phải khép thành vạch rồi mở lại, đầu nghiêng nhẹ theo
  wink: function (s, te, dt, o, a) {
    var p = (te - (a.at !== undefined ? a.at : 0.35)) / (a.dur || 0.55);
    if (p >= 0 && p <= 1) { var v = trap(p); addp(o.e[1], 'arc', v); o.ftilt -= 4 * v; if (p > 0.15 && !s.f) { s.f = true; o.ev.push('wink'); } }
  },
  nodOff: function (s, te, dt, o, a) {
    var ph = (te % a.per) / a.per;
    var v = ph < 0.82 ? 0.42 * Math.pow(ph / 0.82, 1.6) : 0.42 * (1 - (ph - 0.82) / 0.18);
    o.fdy += 8 * v; o.nod = v * 18;
  },
  breathe: function (s, te, dt, o, a) { var v = Math.sin(2 * Math.PI * te / a.per); o.fdy += a.amp * v; both(o, 's', 0.025 * v); },
  spin: function (s, te, dt, o, a) { var A = a.amp * (a.decay ? Math.exp(-te / a.decay) : 1); o.grot[0] += A * Math.sin(2 * Math.PI * te / a.per); o.grot[1] += A * Math.sin(2 * Math.PI * te / a.per + (a.opp ? Math.PI : 0)); },
  twinkle: function (s, te, dt, o, a) { var A = a.amp * (a.decay ? Math.exp(-te / a.decay) : 1); o.gs[0] *= 1 + A * Math.max(0, Math.sin(2 * Math.PI * te / a.per)); o.gs[1] *= 1 + A * Math.max(0, Math.sin(2 * Math.PI * te / a.per + Math.PI)); },
  gpulse: function (s, te, dt, o, a) { var k = 1 + a.amp * (a.decay ? Math.exp(-te / a.decay) : 1) * Math.abs(Math.sin(Math.PI * te / a.per)); o.gs[0] *= k; o.gs[1] *= k; },
  dip: function (s, te, dt, o, a) { var p = trigger(s, te, a, a.dur || 0.6); if (p >= 0) { var v = Math.sin(p * Math.PI); o.fdy += a.amp * v; o.nod = v * (a.nod || 5); } },
  // liếc nhanh sang một điểm rồi quay lại (chỉ mắt), đôi khi kèm chớp mắt như người thật
  peek: function (s, te, dt, o, a) {
    if (s.next === undefined) s.next = te + (a.first !== undefined ? a.first : rnd(1.5, a.max));
    if (s.st === undefined && te >= s.next) { s.st = te; s.x = pick([-1, 1]) * rnd(0.35, a.amp); s.y = rnd(-0.3, 0.25); s.d = rnd(0.6, 1.3); s.b = Math.random() < 0.4; }
    if (s.st === undefined) return;
    var p = (te - s.st) / s.d;
    if (p >= 1) { s.st = undefined; s.next = te + rnd(a.min, a.max); return; }
    if (p < 0.88) { o.gx += s.x; o.gy += s.y; }
    if (s.b && p < 0.14) o.blink = Math.max(o.blink, prof(p / 0.14) * 0.9);
  },
  // mắt run rưng rưng (lo lắng, xin lỗi)
  // thở dài: mí trên sụp xuống thêm, mặt chùng xuống rồi từ từ trở lại
  sigh: function (s, te, dt, o, a) { var p = trigger(s, te, a, a.dur || 1.2); if (p >= 0) { var v = Math.sin(p * Math.PI); both(o, 'top', (a.lid || 0.12) * v); o.fdy += (a.amp || 6) * v; } },
  tremble: function (s, te, dt, o, a) {
    addp(o.e[0], 'dx', a.amp * Math.sin(te * 26)); addp(o.e[1], 'dx', a.amp * Math.sin(te * 23 + 1.7));
    addp(o.e[0], 'dy', a.amp * 0.6 * Math.sin(te * 21 + 0.4)); addp(o.e[1], 'dy', a.amp * 0.6 * Math.sin(te * 19 + 2.1));
  },
  // giật nảy người khi ngạc nhiên rồi lắng lại
  jump: function (s, te, dt, o, a) { o.fdy -= a.amp * Math.exp(-te * 5) * Math.abs(Math.sin(te * 9)); },
  // buồn ngủ: mắt nhắm ︶, thỉnh thoảng cố mở hé ra rồi lại sụp xuống, có lúc chỉ hé một bên
  drowsy: function (s, te, dt, o, a) {
    var p = trigger(s, te, a, a.dur || 1.1);
    if (p < 0) { s.one = undefined; return; }
    if (s.one === undefined) s.one = Math.random() < 0.4;
    var v = p < 0.18 ? p / 0.18 : (p > 0.45 ? Math.max(0, 1 - (p - 0.45) / 0.55) : 1);
    if (!s.one) { addp(o.e[0], 'arc', -v); addp(o.e[0], 's', -0.32 * v); }
    addp(o.e[1], 'arc', -v); addp(o.e[1], 's', -0.32 * v);
  },
  // lờ đờ: thỉnh thoảng hé to một bên mắt một lúc rồi sụp lại, các lần cách xa nhau, không chớp đóng mở
  lidPeek: function (s, te, dt, o, a) {
    var p = trigger(s, te, a, a.dur || 1.5);
    if (p < 0) { s.side = undefined; return; }
    if (s.side === undefined) s.side = Math.random() < 0.5 ? 0 : 1;
    var v = trap(p); addp(o.e[s.side], 'top', -(a.amt || 0.32) * v); addp(o.e[s.side], 's', 0.05 * v);
  },
  // xê dịch rất nhẹ cả khuôn mặt như đang ngó nghiêng, tìm kiếm (trôi chậm, không lặp đều). amp tính bằng px trên màn
  wander: function (s, te, dt, o, a) {
    if (s.ph === undefined) { s.ph = [rnd(0, 6), rnd(0, 6), rnd(0, 6), rnd(0, 6)]; s.f = rnd(0.85, 1.15); }
    var w = 2 * Math.PI * te * s.f / (a.per || 8), env = ease(te / 0.8);
    o.wx += a.amp * env * (0.65 * Math.sin(w + s.ph[0]) + 0.35 * Math.sin(w * 1.73 + s.ph[1]));
    o.wy += a.amp * 0.6 * env * (0.65 * Math.sin(w * 0.83 + s.ph[2]) + 0.35 * Math.sin(w * 1.41 + s.ph[3]));
  },
  // ăn mừng: lấy đà (dẹt xuống), bật lên rồi nảy vài nhịp nhỏ dần; bay lên thì dài ra, chạm đất thì dẹt lại.
  // amp: độ cao nhịp đầu (px trên màn), n: số nhịp. Đầu robot gật hai cái và lắc qua lại nhẹ cùng lúc
  celebrate: function (s, te, dt, o, a) {
    var t = te - (a.delay || 0); if (t < 0) return;
    var A = a.amp || 26, D = a.dur || 0.34, n = a.n || 3, T0 = 0.1, jy = 0, sy = 1;
    if (t < T0) sy = 1 - 0.1 * Math.sin(Math.PI * t / T0);
    else for (var i = 0; i < n; i++) {
      var d = D * Math.pow(0.72, i), h = A * Math.pow(0.5, i), r = h / A;
      if (t < T0 + d) { var p = (t - T0) / d; jy = -h * 4 * p * (1 - p); sy = 1 + 0.09 * r * Math.abs(1 - 2 * p); break; }
      T0 += d;
      if (t < T0 + 0.09) { sy = 1 - 0.12 * r * Math.sin(Math.PI * (t - T0) / 0.09); break; }
      T0 += 0.09;
    }
    o.jy += jy; o.sqy *= sy; o.sqx *= 1 / Math.sqrt(sy);
    // đầu robot: gật nhanh hai cái, lắc qua lại khoảng ±6°, tắt dần trong khoảng 1 giây
    if (t < 1.1) {
      var nd = t < 0.55 ? Math.sin(Math.PI * t / 0.275) : 0;
      o.ht -= 6 * Math.max(0, nd); o.hp += 6 * Math.sin(2 * Math.PI * t / 0.5) * (1 - t / 1.1);
    }
  },
  // mắt hình (sao, tim) bật to vụt lên lúc đầu rồi nảy về cỡ thường cho nổi bật
  gpop: function (s, te, dt, o, a) {
    var k, p = te / 0.16;
    if (p < 1) k = 0.25 + 1.3 * (1 - Math.pow(1 - p, 3));
    else { var u = te - 0.16; k = 1 + 0.5 * Math.exp(-u * 9) * Math.cos(u * 14); }
    o.gs[0] *= k; o.gs[1] *= k;
  },
  // cười khúc khích kiểu "hừ hừ hừ": thỉnh thoảng nảy ba nhịp nhỏ dồn dập, mắt nheo thêm theo từng nhịp
  chuckle: function (s, te, dt, o, a) {
    var p = trigger(s, te, a, a.dur || 0.62); if (p < 0) return;
    var v = Math.abs(Math.sin(p * Math.PI * 3)) * (1 - p * 0.6);
    o.fdy -= (a.amp || 4) * v; both(o, 'top', 0.05 * v); o.ht -= 1.5 * v;
  },
  // soi xét: mắt đảo nhanh từng nhịp như đang đọc mã, mắt to nhích lên, mắt nheo khép thêm
  scrut: function (s, te, dt, o, a) {
    if (s.next === undefined || te >= s.next) { s.x = rnd(-a.amp, a.amp); s.y = rnd(-a.amp * 0.5, a.amp * 0.5); s.next = te + rnd(0.22, 0.55); }
    o.gx += s.x; o.gy += s.y;
    var p = trigger(s.pl || (s.pl = {}), te, { min: 1.1, max: 2.2, first: 0.7 }, 0.4);
    if (p >= 0) { var v = Math.sin(p * Math.PI); addp(o.e[1], 's', 0.08 * v); addp(o.e[0], 'line', 0.1 * v); }
  }
};
var PILL_L = { w: 0.46, h: 1, pill: 1, rot: -6, dy: 0.08 };
var PILL_R = { w: 0.46, h: 1, pill: 1, rot: -6, dy: -0.08 };
var EXD = {
  // tilt: nghiêng mặt trên màn (độ); hd: đầu robot nhích thêm [quay, ngửa] độ, chỉ nhẹ và chỉ khi có nghĩa; wander: mặt xê dịch nhẹ
  neutral: { name: 'Bình thường', acts: [['wander', { amp: 3, per: 9 }], ['blink', { min: 2, max: 4.5, dbl: 0.25 }], ['saccade', { amp: 0.2, min: 0.6, max: 1.8 }], ['peek', { amp: 0.6, min: 2.5, max: 5, first: 1.5 }]] },
  listening: { name: 'Lắng nghe', L: PILL_L, R: Object.assign({}, PILL_R, { h: 1.07 }), tilt: -4, acts: [['wander', { amp: 3, per: 8 }], ['blink', { min: 3, max: 6 }], ['dip', { min: 2.2, max: 3.6, amp: 6, nod: 5 }]] },
  curious: { name: 'Tò mò', both: { w: 0.94, h: 1.06 }, tilt: -5, hd: [0, 4], deco: 'qOnce', acts: [['wander', { amp: 5, per: 6 }], ['alt', { mode: 'zoom', scale: 1.26, delay: 1.7, hold: [0.8, 1.1], rest: [0.9, 1.3], tilt: 4, times: 2 }], ['blink', { min: 2.5, max: 5 }]] },
  happy: { name: 'Vui', both: { arc: 1, arcR: 0.774, arcY: 0.405, arcS: 1.1, arcT: 0.31, arcD: 1 }, tilt: 3, hd: [0, 3], deco: 'notes', acts: [['squeeze', { first: 0.15, times: 1 }], ['bob', { amp: 6, per: 1.6, decay: 2.2 }]] },
  excited: { name: 'Phấn khích', both: { glyph: 'chev' }, deco: 'sparkles', then: 'calm', after: 2.4, acts: [['gpulse', { amp: 0.12, per: 0.55, decay: 1.6 }], ['bounce', { amp: 5, per: 0.55, decay: 1.6 }]] },
  star: { name: 'Ngưỡng mộ', both: { glyph: 'star' }, deco: 'twinkles', then: 'calm', after: 3.4, acts: [['twinkle', { amp: 0.14, per: 0.9, decay: 2.8 }]] },
  surprised: { name: 'Ngạc nhiên', both: { w: 1.2, h: 1.42 }, hd: [0, 5], deco: 'bang', then: 'neutral', after: 1.8, acts: [['pop', { amp: 0.26 }], ['jump', { amp: 7 }], ['settle', { amp: 0.06, k: 0.7 }], ['blinkAt', { at: [1.2, 1.48] }]] },
  wink: { name: 'Nháy mắt', L: { s: 1.06 }, R: { arcR: 0.6, arcY: -0.07, arcS: 1.1, arcT: 0.2, arcD: -1 }, deco: 'winkspark', then: 'neutral', after: 1.3, acts: [['wink', { at: 0.4, dur: 0.55 }]] },
  // buồn: mí trên xệ xuống phía đuôi mắt (hình dạng mắt tự nói lên cảm xúc, không cần nước mắt hay đốm sáng)
  sad: { name: 'Xin lỗi', both: { top: 0.24, slant: 0.38, tcurve: -0.08, h: 0.95, dy: 0.14, s: 1.05 }, gaze: [0, 0.35], tilt: 3, hd: [0, -5], acts: [['sigh', { first: 0.5, min: 2.2, max: 3.4, dur: 1.3, lid: 0.12, amp: 7 }], ['blink', { min: 3, max: 5.5, dur: 0.34 }], ['glance', { min: 2.5, max: 4, dur: 1.1, times: 2 }]] },
  worried: { name: 'Lo lắng', both: { s: 0.74 }, R: { s: 0.66 }, deco: 'sweat', acts: [['around', { pts: [[-0.5, 0.05], [0.5, 0.05], [0, 0]], hold: [0.35, 0.6] }], ['tremble', { amp: 0.06 }], ['blink', { min: 1.5, max: 3 }]] },
  // bối rối: một mắt mở to, mắt kia nheo xiên (nhíu một bên), đầu nghiêng
  confused: { name: 'Bối rối', L: { s: 1.1, h: 1.05 }, R: { s: 0.95, top: 0.38, slant: -0.35, h: 0.85 }, tilt: 6, deco: 'question', acts: [['wander', { amp: 4, per: 7 }], ['blink', { min: 3, max: 6 }], ['saccade', { amp: 0.12, min: 0.5, max: 1.1 }]] },
  thinking: { name: 'Suy nghĩ', both: { s: 0.9 }, R: { line: 0.32, lineY: 0.02 }, hd: [0, 4], deco: 'dots', acts: [['wander', { amp: 6, per: 5 }], ['around', { pts: [[0.55, -0.6], [-0.5, -0.55], [0.2, -0.7]], hold: [1.2, 2], tilt: 6 }], ['blink', { min: 3, max: 6 }]] },
  focused: { name: 'Soi xét', L: { line: 0.55, lineY: 0.05, w: 0.92 }, R: { s: 1.24, h: 1.06 }, tilt: 3, acts: [['scrut', { amp: 0.13 }], ['blink', { min: 4, max: 8 }]] },
  bored: { name: 'Chán', both: { line: 1, lineY: 0.34, w: 0.7, s: 1.15, cap: 1, lw: 1.1 }, deco: 'zzzBored', acts: [['around', { pts: [[-0.5, 0.25], [0.45, 0.3], [0, 0.4]], hold: [2.2, 3.2], tilt: 4 }]] },
  // buồn ngủ: mắt lờ đờ, mí trên sụp quá nửa (không nhắm hẳn), không chớp; thỉnh thoảng hé một bên mắt
  sleepy: { name: 'Buồn ngủ', both: { top: 0.5, tcurve: 0.04, h: 0.9, dy: 0.12 }, gaze: [0, 0.3], tilt: 5, hd: [0, -5], deco: 'zzzSleepy', acts: [['wander', { amp: 4, per: 11 }], ['lidPeek', { first: 5, min: 8, max: 14, dur: 1.6, amt: 0.34 }], ['breathe', { amp: 3, per: 4.2 }]] },
  sleep: { name: 'Ngủ', both: { arc: 1, arcR: 0.6, arcY: -0.07, arcS: 1.1, arcT: 0.19, arcD: -1 }, gaze: [0, 0.4], deco: 'zzz', acts: [['breathe', { amp: 4, per: 3.6 }]] },
  // check-in xong: chỉ một biểu cảm, giữ suốt màn. Vé thường mắt cười ^ ^, vé đặc biệt mắt ngôi sao; cùng nảy ăn mừng, không thêm trang trí
  cheer: { name: 'Ăn mừng', hidden: true, both: { arc: 1, arcR: 0.774, arcY: 0.405, arcS: 1.1, arcT: 0.31, arcD: 1 }, hd: [0, 4], acts: [['celebrate', { amp: 26, n: 3 }]] },
  cheerStar: { name: 'Ăn mừng (sao)', hidden: true, both: { glyph: 'star' }, hd: [0, 4], acts: [['gpop', {}], ['celebrate', { amp: 30, n: 3 }]] },
  cheerHeart: { name: 'Ăn mừng (tim)', hidden: true, both: { glyph: 'heart' }, hd: [0, 4], acts: [['gpop', {}], ['celebrate', { amp: 30, n: 3 }]] },
  // mưu đồ (kiểu anime): mắt chỉ là hình bán nguyệt xếch (mí trên cắt phẳng gần nửa mắt, nghiêng xuống phía trong), cúi nhẹ đầu,
  // thỉnh thoảng liếc ngang rồi khúc khích ba nhịp như đang ấp ủ âm mưu
  evil: { name: 'Mưu đồ', both: { top: 0.44, slant: -0.4, w: 1.06, minT: 0 }, gaze: [0, -0.2], tilt: -4, hd: [0, -4], acts: [['wander', { amp: 3, per: 9 }], ['around', { pts: [[0.55, -0.15], [-0.5, -0.2], [0.1, -0.25]], hold: [1.4, 2.4], tilt: 3 }], ['chuckle', { first: 1.2, min: 2.6, max: 4.2, amp: 4 }], ['blink', { min: 4, max: 7 }]] },
  // nét mặt dịu lại sau một cảm xúc mạnh (không hiện trong danh sách)
  calm: { name: 'Mỉm cười', hidden: true, both: { arc: 1, arcR: 0.774, arcY: 0.405, arcS: 1.1, arcT: 0.31, arcD: 1, arcT: 0.27 }, then: 'neutral', after: 2, acts: [['saccade', { amp: 0.06, min: 0.8, max: 2.2 }]] },
};
function makeQR() {
  var n = 25, seed = 7, d = '';
  function r() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
  function finder(x, y) {
    for (var i = 0; i < 7; i++) for (var j = 0; j < 7; j++) {
      var edge = i === 0 || i === 6 || j === 0 || j === 6, core = i >= 2 && i <= 4 && j >= 2 && j <= 4;
      if (edge || core) d += 'M' + (x + i) + ' ' + (y + j) + 'h1v1h-1z';
    }
  }
  finder(0, 0); finder(n - 7, 0); finder(0, n - 7);
  for (var i = 0; i < n; i++) for (var j = 0; j < n; j++) {
    var inF = (i < 8 && j < 8) || (i >= n - 8 && j < 8) || (i < 8 && j >= n - 8);
    if (!inF && r() < 0.48) d += 'M' + i + ' ' + j + 'h1v1h-1z';
  }
  return d;
}
var QRD = makeQR();
function starPath() {
  var d = '';
  for (var i = 0; i < 10; i++) {
    var a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? 0.46 : 1;
    d += (i ? 'L' : 'M') + (Math.cos(a) * rr).toFixed(3) + ' ' + (Math.sin(a) * rr).toFixed(3);
  }
  return d + 'Z';
}
var HEART = 'M0 0.82C-0.95 0.15 -1.05 -0.5 -0.55 -0.78C-0.25 -0.95 0 -0.72 0 -0.45C0 -0.72 0.25 -0.95 0.55 -0.78C1.05 -0.5 0.95 0.15 0 0.82Z';
var STAR = starPath();
var GLYPHS = {
  x: { d: 'M-0.62 -0.62L0.62 0.62M0.62 -0.62L-0.62 0.62', fill: false },
  chev0: { d: 'M-0.45 -0.62L0.5 0L-0.45 0.62', fill: false },
  chev1: { d: 'M0.45 -0.62L-0.5 0L0.45 0.62', fill: false },
  heart: { d: HEART, fill: true },
  star: { d: STAR, fill: true },
  visor0: { d: 'M-0.87 -0.48H2.25V0.48H-0.87A0.48 0.48 0 0 1 -0.87 -0.48Z', fill: true },
  visor1: { d: 'M0.87 -0.48H-2.25V0.48H0.87A0.48 0.48 0 0 0 0.87 -0.48Z', fill: true }
};
var SHAPES = {
  z: { d: 'M-0.55 -0.55H0.55L-0.55 0.55H0.55', sw: 0.24 },
  q: { d: 'M-0.42 -0.38C-0.42 -0.85 0.45 -0.88 0.45 -0.38C0.45 -0.02 0 0.02 0 0.32M0 0.74V0.75', sw: 0.24 },
  bang: { d: 'M0 -0.78V0.3M0 0.74V0.75', sw: 0.28 },
  oval: { d: 'M-1 0A1 0.5 0 1 0 1 0A1 0.5 0 1 0 -1 0Z', fill: true },
  note: { d: 'M0.12 0.45C0.12 0.72 -0.5 0.82 -0.5 0.52C-0.5 0.26 0.0 0.2 0.12 0.34V-0.8L0.62 -0.6V-0.35L0.24 -0.5V0.45Z', fill: true },
  heart: { d: HEART, fill: true },
  spark: { d: 'M0 -1C0.12 -0.12 0.12 -0.12 1 0C0.12 0.12 0.12 0.12 0 1C-0.12 0.12 -0.12 0.12 -1 0C-0.12 -0.12 -0.12 -0.12 0 -1Z', fill: true },
  star: { d: STAR, fill: true },
  drop: { d: 'M0 -1C0.35 -0.45 0.6 -0.1 0.6 0.25A0.6 0.6 0 0 1 -0.6 0.25C-0.6 -0.1 -0.35 -0.45 0 -1Z', fill: true },
  rect: { d: 'M-0.5 -0.22H0.5V0.22H-0.5Z', fill: true },
  ring: { d: 'M-1 0A1 0.28 0 1 0 1 0A1 0.28 0 1 0 -1 0Z', sw: 0.12 },
  dot: { d: 'M-0.5 0A0.5 0.5 0 1 0 0.5 0A0.5 0.5 0 1 0 -0.5 0Z', fill: true }
};
var WHITE = '#ffffff';
function zSpawn(c, s0, s1, life) {
  // bay lên vừa đủ, tan trước khi chạm dòng ngày tháng ở góc trên phải màn nghỉ
  var a = c.map(rnd(842, 872), rnd(226, 246));
  return { shape: 'z', color: WHITE, x: a[0], y: a[1], vx: 18, vy: -26, life: life * 1.35, s0: s0 * c.k, s1: s1 * c.k, sway: 6, swayF: 1.7, rot: -14, vr: 5 };
}
function markPos(c) { return c.eye(c.rx + c.R * rnd(1.95, 2.15), 262 - c.R * rnd(1.65, 1.85)); }
function ringPos(c) { var ang = rnd(0, Math.PI * 2), rx = c.R * rnd(4.2, 4.8), ry = c.R * rnd(2.0, 2.3); return c.eye(492 + Math.cos(ang) * rx, 262 + Math.sin(ang) * ry); }
var DECO = {
  zzz: { rate: 1.9, spawn: function (c) { var p = zSpawn(c, 20, 50, 2.6); p.al = 0.3; return p; } },   // lúc ngủ (mặt full màn hình): mờ hẳn để dòng Chạm để check-in nổi bật
  zzzSleepy: { rate: 2.2, spawn: function (c) { return zSpawn(c, 16, 40, 2.4); } },
  zzzBored: { rate: 2.4, max: 2, spawn: function (c) { return zSpawn(c, 14, 30, 2.2); } },
  notes: { rate: 1.5, max: 3, spawn: function (c) { var a = c.eye(c.rx + c.R * rnd(1.9, 2.3), 262 - c.R * 0.6); return { shape: 'note', color: WHITE, x: a[0], y: a[1], vx: rnd(12, 26), vy: -48, life: 2.2, s0: 24 * c.k, s1: 30 * c.k, sway: 8, swayF: 2.4, rot: rnd(-12, 12), pop: true }; } },
  hearts: { rate: 0.7, max: 4, spawn: function (c) { var lane = pick([492, c.lx - c.R * 1.9, c.rx + c.R * 1.9]); var a = c.eye(lane + rnd(-18, 18), 262 + c.R * 0.9); return { shape: 'heart', color: WHITE, x: a[0], y: a[1], vx: rnd(-5, 5), vy: rnd(-70, -50), life: 2.2, s0: 14 * c.k, s1: rnd(24, 30) * c.k, sway: 7, swayF: rnd(2, 3.5), rot: rnd(-10, 10) }; } },
  sparkles: { rate: 0.4, max: 5, spawn: function (c) { var a = ringPos(c); return { shape: 'spark', color: WHITE, x: a[0], y: a[1], life: 0.8, s0: rnd(18, 28) * c.k, s1: 0, vr: 90, pop: true }; } },
  twinkles: { rate: 0.55, max: 6, spawn: function (c) { var a = ringPos(c); return { shape: pick(['spark', 'star']), color: WHITE, x: a[0], y: a[1], vy: -8, life: 0.9, s0: rnd(16, 26) * c.k, s1: 0, vr: 70, pop: true }; } },
  sweat: { rate: 2.4, max: 2, spawn: function (c) { var a = c.eye(c.lx - c.R * 1.7, 262 - c.R * 0.7); return { shape: 'drop', color: WHITE, x: a[0], y: a[1], vy: 14, ay: 70, life: 1.5, s0: 22 * c.k, s1: 22 * c.k, pop: true }; } },
  question: { rate: 1.9, max: 2, spawn: function (c) { var a = markPos(c); return { shape: 'q', color: WHITE, x: a[0], y: a[1], vy: -10, life: 1.7, s0: 44 * c.k, s1: 44 * c.k, rot: rnd(-12, 12), pop: true }; } },
  qOnce: { once: function (c, sp) { var a = markPos(c); sp({ shape: 'q', color: WHITE, x: a[0], y: a[1], vy: -8, life: 1.7, s0: 42 * c.k, s1: 42 * c.k, rot: 10, pop: true }); } },
  bang: { once: function (c, sp) { var a = markPos(c); sp({ shape: 'bang', color: WHITE, x: a[0], y: a[1], vy: -6, life: 1.9, s0: 48 * c.k, s1: 48 * c.k, rot: 8, pop: true }); } },
  winkspark: { on: { wink: function (c, sp) { var a = c.eye(c.rx + c.R * 1.6, 262 - c.R * 1.3); sp({ shape: 'spark', color: WHITE, x: a[0], y: a[1], life: 0.7, s0: 30 * c.k, s1: 0, vr: 120, pop: true }); } } },
  dots: { persist: ['dot', 'dot', 'dot'], update: function (p, i, t, c) {
    var a = c.eye(c.rx + c.R * 1.6, 262 - c.R * 1.8), v = Math.max(0, Math.sin(t * 4 - i * 0.9));
    p.x = a[0] + i * 28 * c.k; p.y = a[1] - v * 6; p.size = 14 * c.k * (0.8 + 0.4 * v); p.op = Math.min(1, t * 3) * (0.5 + 0.5 * v); p.rot = 0;
  } },
  orbit: { persist: ['star', 'star', 'star'], update: function (p, i, t, c) {
    var a = c.eye(492, 262 - c.R * 2), ang = t * 2.6 + i * 2 * Math.PI / 3;
    p.x = a[0] + Math.cos(ang) * 170 * c.k; p.y = a[1] + Math.sin(ang) * 26 * c.k; p.size = 22 * c.k * (0.75 + 0.35 * Math.sin(ang)); p.op = Math.min(1, t * 3); p.rot = t * 160;
  } },
  tear: { rate: 1.6, max: 1, spawn: function (c) { var a = c.eye(c.lx - c.R * 0.2, 262 + c.R * 1.35); return { shape: 'drop', color: WHITE, x: a[0], y: a[1], vy: 20, ay: 120, life: 1.5, s0: 18 * c.k, s1: 22 * c.k, pop: true }; } },
  glint: { once: function (c, sp) { var a = c.eye(c.lx - c.R * 0.6, 262 - c.R * 0.35); sp({ shape: 'spark', color: WHITE, x: a[0], y: a[1], life: 0.9, s0: 34 * c.k, s1: 0, vr: 140, pop: true }); } },
  // biết ơn: má hồng và vòng hào quang lơ lửng trên đầu
  halo: { persist: ['oval', 'oval', 'ring'], update: function (p, i, t, c) {
    if (i < 2) { var a = c.eye(i ? c.rx + c.R * 0.2 : c.lx - c.R * 0.2, 262 + c.R * 1.4); p.x = a[0]; p.y = a[1]; p.rot = 0; p.size = 56 * c.k; p.op = (0.5 + 0.06 * Math.sin(t * 2.2 + i)) * Math.min(1, t / 0.5); }
    else { var b = c.eye(492, 262 - c.R * 2.1); p.x = b[0]; p.y = b[1] + Math.sin(t * 2.4) * 5 * c.k; p.rot = 0; p.size = 118 * c.k; p.op = Math.min(1, t / 0.4); }
  } },
  blush: { persist: ['oval', 'oval'], update: function (p, i, t, c) {
    var a = c.eye(i ? c.rx + c.R * 0.2 : c.lx - c.R * 0.2, 262 + c.R * 1.4);
    p.x = a[0]; p.y = a[1]; p.rot = 0; p.size = 56 * c.k; p.op = (0.5 + 0.06 * Math.sin(t * 2.2 + i)) * Math.min(1, t / 0.5);
  } }
};

/* Dáng mặt: bán kính vòm mặt theo góc a (radian, tính từ đỉnh theo chiều kim đồng hồ), nhân với bán kính gốc.
   Mọi dáng đều cong mềm, đỉnh vòm giữ gần như cũ để phụ kiện và chữ không phải xếp lại. t là thời gian (dáng thạch rung rinh chậm). */
var SHAPE_FN = {
  round: null,
  squircle: function (a) { var n = 3.4; return Math.pow(Math.pow(Math.abs(Math.sin(a)), n) + Math.pow(Math.abs(Math.cos(a)), n), -1 / n); },
  wide: function (a) { var sx = Math.sin(a) / 1.1, cy = Math.cos(a) / 0.92; return 1 / Math.sqrt(sx * sx + cy * cy); },
  cloud: function (a) { return 0.985 + 0.03 * Math.pow(Math.abs(Math.cos(a * 7)), 0.7); },
  jelly: function (a, t) { return 1 + 0.02 * Math.sin(3 * a + t * 0.9) + 0.012 * Math.sin(5 * a - t * 0.7 + 1.3); },
  // người máy trùm mũ (dáng ngoại lệ, theo bản phác của Hải): vòm mặt là chiếc mũ, đường bao vẽ theo mắt (BOT_HOOD) rồi quy ra bán kính theo góc mỗi khung (botBuild)
  bot: function (a) { return botRim(a); }
};
var BOT = { steel: '#7b8389' };   // người máy trùm mũ: vòm mặt là mũ trùm màu mặt Uni, trong lỗ mũ là mặt thép xám của người máy
/* Người máy theo bản phác của Hải. Tọa độ tính theo cỡ mắt R, gốc ở giữa hai mắt, y hướng xuống.
   Mũ: bên trái dựng thẳng, góc trên trái bo nhỏ, đỉnh mũ cao dần từ trái sang rồi vòng xuống bên phải như vạt mũ ngả về sau sang trái.
   Lỗ mũ: hai bên gần thẳng đứng, mở xuống tận dưới màn, đỉnh nhọn như hình thoi đứng hơi chếch sang phải (sườn trái thoải, sườn phải dốc hơn). */
var BOT_HOOD = [[-5.75, 30], ['L', -5.75, -3.55], ['C', -5.75, -3.95, -5.6, -4.08, -5.2, -4.12], ['C', -3.6, -4.3, -1.6, -4.62, -0.4, -4.62], ['C', 1.6, -4.62, 3.4, -3.9, 4.5, -2.5], ['C', 5.4, -1.3, 5.75, 0.4, 5.75, 2.5], ['L', 5.75, 30]];
var BOT_HOLE = [[-4.15, 30], ['L', -4.12, 1.4], ['C', -4.08, -0.3, -3.3, -1.55, -2.2, -2.0], ['L', 0.15, -2.96], ['Q', 0.5, -3.12, 0.82, -2.94], ['L', 2.3, -2.12], ['C', 3.3, -1.55, 4.06, -0.4, 4.1, 1.4], ['L', 4.15, 30]];
function botEnd(s) { return s[0] === 'L' ? [s[1], s[2]] : s[0] === 'Q' ? [s[3], s[4]] : [s[5], s[6]]; }
function botPts(def, n) {
  var out = [def[0].slice()], p = def[0];
  for (var i = 1; i < def.length; i++) {
    var s = def[i];
    for (var k = 1; k <= n; k++) {
      var t = k / n, u = 1 - t;
      if (s[0] === 'L') out.push([p[0] + (s[1] - p[0]) * t, p[1] + (s[2] - p[1]) * t]);
      else if (s[0] === 'Q') out.push([u * u * p[0] + 2 * u * t * s[1] + t * t * s[3], u * u * p[1] + 2 * u * t * s[2] + t * t * s[4]]);
      else out.push([u * u * u * p[0] + 3 * u * u * t * s[1] + 3 * u * t * t * s[3] + t * t * t * s[5], u * u * u * p[1] + 3 * u * u * t * s[2] + 3 * u * t * t * s[4] + t * t * t * s[6]]);
    }
    p = botEnd(s);
  }
  return out;
}
function botPath(def, X, Y) {
  var q = new Path2D(); q.moveTo(X(def[0][0]), Y(def[0][1]));
  for (var i = 1; i < def.length; i++) {
    var s = def[i];
    if (s[0] === 'L') q.lineTo(X(s[1]), Y(s[2]));
    else if (s[0] === 'Q') q.quadraticCurveTo(X(s[1]), Y(s[2]), X(s[3]), Y(s[4]));
    else q.bezierCurveTo(X(s[1]), Y(s[2]), X(s[3]), Y(s[4]), X(s[5]), Y(s[6]));
  }
  q.closePath(); return q;
}
// miệng người máy: khối lưới (theo cỡ mắt R): rộng w, cao h, mép trên cách tâm mắt y; n khe dọc rộng sw, lề ngang px, lề dọc py
var BOT_MOUTH = { w: 2.4, y: 1.57, k: 0.3, n: 5, rw: 0.16 };   // miệng hình thang: rộng đỉnh w, cạnh xòe k mỗi R xuống, n ngăn đen chia bởi gân sáng rộng rw
// mặt pixel: ô cỡ 0,2R nên khe, vành phải to hơn một ô mới không bị gộp mất: ít khe hơn, khe rộng hơn, vành dày một ô
var BOT_MOUTH_PIX = { w: 2.6, y: 1.57, k: 0.3, n: 5, rw: 0.3 };
var BOT_HOOD_PTS = botPts(BOT_HOOD, 16), BOT_TAB = null, BOT_HM = 0.15;   // BOT_HM: mũ chỉ theo 15% chuyển động của mặt
// bán kính vòm mũ theo góc (đã quy theo tâm và bán kính vòm mặt của khung hiện tại), nội suy trong bảng botBuild dựng
function botRim(a) {
  var T = BOT_TAB; if (!T) return 1;
  a = Math.atan2(Math.sin(a), Math.cos(a));
  var A = T.a, Rr = T.r, n = A.length;
  if (a <= A[0] || a >= A[n - 1]) { var span = A[0] + Math.PI * 2 - A[n - 1], u = clamp((((a - A[n - 1]) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) / span, 0, 1); return Rr[n - 1] + (Rr[0] - Rr[n - 1]) * u; }
  var lo = 0, hi = n - 1;
  while (hi - lo > 1) { var m = (lo + hi) >> 1; if (A[m] <= a) lo = m; else hi = m; }
  return Rr[lo] + (Rr[hi] - Rr[lo]) * (a - A[lo]) / ((A[hi] - A[lo]) || 1);
}
/* Kiểu mắt: sw, sh là hệ số rộng, cao so với mắt mặc định; sq là độ vuông của mắt (0 là bầu dục).
   Pixel là lựa chọn riêng (setEyeStyle(k, pix)), ghép được với mọi kiểu mắt: pixel tròn, pixel vuông bo, pixel anime, pixel quỷ */
var EYE_STYLE = {
  soft: { sw: 1, sh: 1, sq: 0 },
  rect: { sw: 1.14, sh: 1.24, sq: 3.2 },
  anime: { sw: 1.14, sh: 1.24, sq: 3.2, anime: true },   // khuôn mắt như vuông bo, thêm hai đốm sáng khoét lỗ
  // mắt quỷ: bán nguyệt (mí trên cắt phẳng gần nửa mắt), mép cắt xếch xuống phía trong như đang nheo tinh quái
  devil: { sw: 1.12, sh: 1.08, sq: 0, top: 0.42, slant: -0.38 },
  // mắt người máy (cố định, như hình gốc): hốc mắt đen, chữ nhật dẹt góc gần vuông, mép trên xếch xuống phía trong
  bot: { sw: 1.05, sh: 0.55, sq: 7, top: 0.18, slant: -0.3 }
};
function Face() {
  this.ss = 2; this.cv = document.createElement('canvas'); this.cv.width = 1078 * this.ss; this.cv.height = 480 * this.ss;
  this.g = this.cv.getContext('2d');
  this.R = 92; this.gap = 384;
  this.expr = 'neutral'; this.key = null; this.kT = 0; this.acts = [];
  this.eyes = [Object.assign({}, DEF), Object.assign({}, DEF)];
  this.gly = [null, null]; this.gk = [0, 0]; this.gT = [0, 0];
  this.gz = [0, 0]; this.L = 1; this.tl = 0; this.view = [0, 0];
  this.text = null; this.typed = 0; this.typeAcc = 0; this.lines = null;
  this.scan = null; this.scanT = 0;
  this.sc = { x: 563, y: 60, s: 392, qx: 759, qy: 256, qs: 150, qo: 0, op: 0, bo: 0, locked: null, lw: 6, barY: 0, shake: 0, q: null, cap: '' };
  this.parts = []; this.dkey = undefined; this.dT = 0; this.dAcc = 0; this.decoOverride = undefined;
  this.nod = 0; this.cache = {}; this.qr = new Path2D(QRD);
  this.gv = [0, 0]; this.hs = [0, 0]; this.clk = 0; this.dim = 0; this.antT = 0; this.wasSmall = false;
  this.pz = { sx: [1, 1], sy: [1, 1], gapK: 1 };
  this.bp = [Object.assign({}, DEF), Object.assign({}, DEF)]; this.bv = [{}, {}]; this.ao = [{}, {}];
  PKEYS.forEach(function (k) { this.bv[0][k] = this.bv[1][k] = 0; this.ao[0][k] = this.ao[1][k] = 0; }, this);
  this.lv = { L: 0, tl: 0, wx: 0, wy: 0, hp: 0, ht: 0, hk: 0 }; this.wd = [0, 0]; this.hd = [0, 0];
  this.shape = 'round'; this.es = EYE_STYLE.soft; this.ebb = [null, null];
  this.hc = document.createElement('canvas').getContext('2d');   // chỉ dùng để thử điểm nằm trong hình (mắt pixel)
}
/* Đổi dáng mặt: vòm mặt biến dần từ dáng cũ sang dáng mới trong CSPAN giây, cùng nhịp và cùng đường cong êm với vệt loang màu
   (chọn bộ có sẵn đổi cả màu lẫn dáng thì hai thứ chạy khớp nhau). Lần đặt đầu tiên lúc khởi động thì đặt luôn. */
Face.prototype.setShape = function (k) {
  k = SHAPE_FN.hasOwnProperty(k) ? k : 'round';
  if (k === this.shape && this.shapeSet) return;
  if (this.shapeSet) { this.shPrevK = this.shPrev && this.shT < 1 ? this.rimMix() : null; this.shPrev = this.shape; this.shT = 0; }
  this.shape = k; this.shapeSet = true;
  if (this.esKey) this.setEyeStyle(this.esKey);   // người máy khóa kiểu mắt
};
// độ "người máy" hiện tại, 0 đến 1, đi cùng nhịp biến dáng (đầu thép, áo khoác mũ trùm, đường nối hàm, ba lỗ loa hiện hoặc tan dần)
/* Dựng bảng bán kính vòm mũ theo góc cho khung này: mũ vẽ theo mắt nên đổi sang tọa độ cực quanh tâm vòm mặt.
   Mặt to (chào, ngủ) thì mũ và lỗ mũ thấp lại (vy) và hẹp lại một chút (hs) để thấy trọn đỉnh mũ, mắt và miệng trong màn. */
Face.prototype.botBuild = function (T) {
  var b = (T.hk || 0) * (1 - T.sm), hs = 1 - 0.14 * b, vy = 1 - 0.42 * b, R = this.R, P = [];
  this.bG = { hs: hs, vy: vy };
  BOT_HOOD_PTS.forEach(function (p) { var x = 492 + p[0] * R * hs - T.ccx, y = T.ccy - (262 + p[1] * R * vy); P.push([Math.atan2(x, y), Math.hypot(x, y) / T.cr]); });
  P.sort(function (u, v) { return u[0] - v[0]; });
  BOT_TAB = { a: P.map(function (q) { return q[0]; }), r: P.map(function (q) { return q[1]; }) };
};
Face.prototype.botK = function () {
  var on = this.shape === 'bot' ? 1 : 0;
  if (!this.shPrev || this.shT >= 1) return on;
  var was = this.shPrev === 'bot' ? 1 : 0, e = ease(this.shT); return was + (on - was) * e;
};
function shapeK(key, a, t) { var f = SHAPE_FN[key]; return f ? f(a, t) : 1; }
// đang biến dáng giữa chừng mà đổi tiếp: chụp lại dáng đang hiện làm điểm xuất phát, không giật về dáng cũ
Face.prototype.rimMix = function () {
  var N = 72, out = new Float32Array(N + 1);
  for (var i = 0; i <= N; i++) out[i] = this.rimK(i / N * Math.PI * 2);
  return out;
};
Face.prototype.setEyeStyle = function (k, pix) {
  if (k === 'pixel') { k = 'soft'; pix = true; }   // cài đặt cũ: "pixel" từng là một kiểu mắt riêng
  if (pix !== undefined) this.pix = !!pix;
  this.esKey = EYE_STYLE[k] ? k : 'soft';
  var kn = this.shape === 'bot', b = kn ? EYE_STYLE.bot : EYE_STYLE[this.esKey];   // người máy khóa kiểu mắt
  // khi thành pixel: mắt tròn to hơn một chút để đủ ô cho viền mềm; mắt vuông bo hẹp lại thành khối đứng kiểu màn hình máy game
  var PIX_ADJ = { soft: { sw: 1.18, sh: 1.2 }, rect: { sw: 0.9 } };
  this.es = this.pix && !this.fpix ? Object.assign({}, b, { pix: true }, (kn ? {} : PIX_ADJ[this.esKey]) || {}) : this.pix ? Object.assign({}, b, (kn ? {} : PIX_ADJ[this.esKey]) || {}) : b;   // mặt pixel: mắt vẽ mượt rồi pixel hóa cùng mặt   // mặt pixel: mắt vẽ mượt rồi pixel hóa cùng mặt
};
Face.prototype.setPixel = function (on) { this.setEyeStyle(this.esKey || 'soft', !!on); };
/* Mặt pixel: tai, sừng, vòm mặt, mắt, phụ kiện được vẽ mượt vào một tấm ảnh rất nhỏ (mỗi điểm ảnh là một ô, lưới neo theo tâm vòm mặt),
   rồi phóng to không làm mịn và cắt khe giữa các ô. Mọi thứ thành pixel trên cùng một lưới: mắt rõ (không bị khe của mặt cắt vụn),
   gốc tai nằm sau mặt nên không lộ qua khe. Mắt khóa ở pixel nhưng vẽ mượt vì đã được pixel hóa cùng mặt. */
Face.prototype.setFacePixel = function (on) { this.fpix = !!on; if (this.esKey) this.setEyeStyle(this.esKey); };
// hệ số bán kính vòm mặt theo góc (radian, tính từ đỉnh)
Face.prototype.rimK = function (a) {
  var t = this.clk || 0, k = shapeK(this.shape, a, t);
  if (!this.shPrev || this.shT >= 1) return k;
  var k0, P = this.shPrevK;
  if (P) { var N = P.length - 1, u = ((a / (Math.PI * 2)) % 1 + 1) % 1 * N, i = Math.floor(u); k0 = P[i] + (P[Math.min(N, i + 1)] - P[i]) * (u - i); }
  else k0 = shapeK(this.shPrev, a, t);
  var e = ease(this.shT); return k0 + (k - k0) * e;
};
// đường viền vòm mặt theo dáng đang chọn
Face.prototype.facePath = function (T) {
  var g = this.g, f = SHAPE_FN[this.shape], morph = this.shPrev && this.shT < 1;
  g.beginPath();
  if (!f && !morph) { g.arc(T.ccx, T.ccy, T.cr, 0, Math.PI * 2); return; }
  var N = 160;
  for (var i = 0; i <= N; i++) { var a = i / N * Math.PI * 2, r = T.cr * this.rimK(a), x = T.ccx + r * Math.sin(a), y = T.ccy - r * Math.cos(a); if (i) g.lineTo(x, y); else g.moveTo(x, y); }
  g.closePath();
};
var FACE_RED = '#ef5350', EYE_SLEEP = '#7a2826';
function mixHex(a, b, t) {
  var x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16), out = '#';
  for (var sh = 16; sh >= 0; sh -= 8) { var v = Math.round(((x >> sh) & 255) * (1 - t) + ((y >> sh) & 255) * t); out += (v < 16 ? '0' : '') + v.toString(16); }
  return out;
}
// Khi khóa được mã: đọc được thì mở to mắt, không đọc được thì nheo cả hai như nghi ngờ
Face.prototype.scanOv = function () {
  if (!this.scan || !this.sc.locked) return null;
  var lt = this.scanT - 3.0;
  if (this.scan === 'ok') return { k: 'ok', lt: lt, both: { w: 1.12, h: 1.24, top: 0, bA: 0, bB: 1, slant: 0, s: 1, line: 0 }, L: {}, R: {} };
  return { k: 'bad', lt: lt, L: { line: 0.42, lineY: 0.05, w: 0.94, h: 1, s: 1 }, R: { line: 0.5, lineY: 0.05, w: 0.94, h: 1, s: 0.96 } };
};
Face.prototype.P = function (d) { return this.cache[d] || (this.cache[d] = new Path2D(d)); };
Face.prototype.setExpr = function (k) { if (EXD[k]) this.expr = k; };
Face.prototype.speak = function (t) { this.text = t || null; this.typed = 0; this.typeAcc = 0; this.lines = null; };
Face.prototype.setScan = function (m) { this.scan = m || null; this.scanT = 0; this.sc.locked = null; };
Face.prototype.spawn = function (cfg, persist, back) {
  if (!cfg) return null;
  var p = Object.assign({ age: 0, vx: 0, vy: 0, ay: 0, rot: 0, vr: 0, sway: 0, swayF: 3, pop: false, ph: rnd(0, 6), idx: 0 }, cfg);
  p.persist = persist || null; p.back = !!back; p.life = cfg.life || 1; p.s0 = cfg.s0 || 10; p.s1 = cfg.s1 === undefined ? p.s0 : cfg.s1; p.size = p.s0; p.op = 0;
  // mặt đang thu nhỏ để hiện chữ: hiệu ứng bay về phía trái, tránh vùng chữ bên phải
  if (!back && this.wasSmall && p.vx > 0) p.vx = -p.vx * 0.6;
  this.parts.push(p); return p;
};
Face.prototype.confetti = function (gold, color) {
  var cols = color ? [color, color, color, '#ffffff'] : gold ? ['#ffffff', '#ffffff', '#d6d6d6'] : ['#ffffff', '#ffffff', '#ffffff', '#8f8f8f'];
  for (var i = 0; i < 64; i++) this.spawn({ shape: pick(['rect', 'rect', 'dot', 'spark']), color: pick(cols), x: rnd(0, 1078), y: rnd(-80, -10), vx: rnd(-40, 40), vy: rnd(90, 230), ay: 40, life: rnd(2.4, 3.6), s0: rnd(9, 16), rot: rnd(0, 360), vr: rnd(-380, 380), sway: rnd(10, 26), swayF: rnd(3, 6) }, null, true);
};
// Mắt dạng nét cong (arc = 1): đúng một cung tròn dày đều, hai đầu bo tròn, như nét bút vẽ.
// arcD = 1 là vòm úp (mắt cười), arcD = -1 là vòm ngửa (mắt nhắm khi ngủ). Các số đo tính theo nửa chiều cao mắt.
function arcOutline(p, hA, N) {
  var r = p.arcR * hA, cy = p.arcY * hA, tt = Math.max(0.5, p.arcT * hA) / 2, span = p.arcS, dir = p.arcD >= 0 ? 1 : -1;
  var thc = Math.PI + Math.PI / 2 * clamp(p.arcD, -1, 1);
  function P(s) { var th = thc + (2 * s - 1) * span * dir; return { x: r * Math.cos(th), y: cy + r * Math.sin(th), nx: Math.cos(th), ny: Math.sin(th), th: th }; }
  var capA = [0, 0.4, 0.85, 1.3], nArc = N - 2 * capA.length, top = [], bot = [];
  [1, -1].forEach(function (side) {
    var out = side > 0 ? top : bot, sg = side * dir;
    var a = P(0), b = P(1), da = P(0.001), db = P(0.999);
    var tl = [a.x - da.x, a.y - da.y], tr = [b.x - db.x, b.y - db.y], ll = Math.hypot(tl[0], tl[1]) || 1, lr = Math.hypot(tr[0], tr[1]) || 1;
    tl = [tl[0] / ll, tl[1] / ll]; tr = [tr[0] / lr, tr[1] / lr];
    capA.forEach(function (al) { out.push([a.x + tt * (Math.cos(al) * tl[0] + Math.sin(al) * a.nx * sg), a.y + tt * (Math.cos(al) * tl[1] + Math.sin(al) * a.ny * sg)]); });
    for (var i = 0; i < nArc; i++) { var q = P(i / (nArc - 1)); out.push([q.x + tt * q.nx * sg, q.y + tt * q.ny * sg]); }
    capA.slice().reverse().forEach(function (al) { out.push([b.x + tt * (Math.cos(al) * tr[0] + Math.sin(al) * b.nx * sg), b.y + tt * (Math.cos(al) * tr[1] + Math.sin(al) * b.ny * sg)]); });
  });
  return { top: top, bot: bot };
}
Face.prototype.eyePath = function (p, blink, side, k) {
  k = k * (this.ak || 1);   // f.attn = 1 khi có người: mắt to hơn một chút để gợi chú ý
  var R = this.R, sgn = side ? 1 : -1, ES = this.es || EYE_STYLE.soft;
  var w = Math.max(0.01, p.w * R * p.s * k * ES.sw), h = Math.max(0.01, p.h * R * p.s * k * ES.sh * (1 - 0.92 * blink));
  var N = 22, top = [], bot = [];
  for (var i = 0; i < N; i++) {
    var u = -Math.cos(Math.PI * i / (N - 1)), x = u * w, root = Math.sqrt(Math.max(0, 1 - u * u));
    // mắt vuông bo góc lớn: đường bao siêu elip thay cho elip
    var eEl = h * (ES.sq ? Math.pow(Math.max(0, 1 - Math.pow(Math.abs(u), ES.sq)), 1 / ES.sq) : root), ePill = h > w && !ES.sq ? (h - w) + w * root : eEl;
    var e = eEl + (ePill - eEl) * clamp(p.pill, 0, 1);
    // kiểu mắt có sẵn mí (mắt quỷ) cộng thêm vào nét mặt của biểu cảm, phần cộng nhỏ dần khi biểu cảm đã sụp mí sẵn
    // lấy mí sụp hơn trong hai cái (không cộng dồn để mắt không mỏng quá), độ xếch của kiểu mắt nhường cho biểu cảm đã xếch sẵn
    var pTop = Math.max(p.top, ES.top || 0), pSl = p.slant + (ES.slant || 0) * (1 - Math.min(1, Math.abs(p.slant) / 0.4));
    var tl = -h + pTop * 2 * h + pSl * sgn * u * h + p.tcurve * u * u * h;
    var bl = p.bA * (-e) + p.bB * h;
    var t = Math.max(-e, tl), b = Math.min(e, bl);
    var mt = (ES.top ? 0 : p.minT) * h * (0.45 + 0.55 * root);   // mắt bán nguyệt: hai đầu vuốt nhọn gọn, không để lại móc nhỏ
    if (b - t < mt) { var c = (t + b) / 2; t = c - mt / 2; b = c + mt / 2; }
    if (p.line > 0.001) {
      // cap = 1: nét cong dày đều, hai đầu bo tròn (mắt cười, mắt ngủ); cap = 0: kiểu vát nhọn cũ
      var lw = Math.min(1, p.line), cp = clamp(p.cap, 0, 1);
      var ltF = 0.2 * p.lw * R * p.s * k, cf = Math.min(0.45, ltF / 2 / w), ue = Math.abs(u) - (1 - cf), capF = ue > 0 ? Math.sqrt(Math.max(0, 1 - (ue / cf) * (ue / cf))) : 1;
      var taper = (0.42 + 0.58 * Math.pow(root, 0.35)) * (1 - cp) + capF * cp;
      var lt = 0.2 * p.lw * R * p.s * k * taper, ly = (p.lineY + p.lineC * (1 - u * u)) * R * p.s * k;
      var slope = -2 * p.lineC * u * R * p.s * k / Math.max(1, w), lt2 = lt * (1 + (Math.sqrt(1 + slope * slope) - 1) * cp);
      t += (ly - lt2 / 2 - t) * lw; b += (ly + lt2 / 2 - b) * lw;
    }
    top.push([x, t]); bot.push([x, b]);
  }
  if (p.arc > 0.001) {
    var AO = arcOutline(p, Math.max(0.01, p.h * R * p.s * k * ES.sh), N), ak = clamp(p.arc, 0, 1);
    for (var ai2 = 0; ai2 < N; ai2++) { top[ai2] = [top[ai2][0] + (AO.top[ai2][0] - top[ai2][0]) * ak, top[ai2][1] + (AO.top[ai2][1] - top[ai2][1]) * ak]; bot[ai2] = [bot[ai2][0] + (AO.bot[ai2][0] - bot[ai2][0]) * ak, bot[ai2][1] + (AO.bot[ai2][1] - bot[ai2][1]) * ak]; }
  }
  var pts = top.concat(bot.reverse()), n = pts.length;
  var bb = [1e9, 1e9, -1e9, -1e9]; pts.forEach(function (q) { bb[0] = Math.min(bb[0], q[0]); bb[1] = Math.min(bb[1], q[1]); bb[2] = Math.max(bb[2], q[0]); bb[3] = Math.max(bb[3], q[1]); });
  this.ebb[side] = bb;   // khung bao của mắt, để vẽ mắt pixel chỉ trong vùng này
  function mid(a, b2) { return ((a[0] + b2[0]) / 2).toFixed(1) + ' ' + ((a[1] + b2[1]) / 2).toFixed(1); }
  var d = 'M' + mid(pts[0], pts[1]);
  for (var j = 1; j <= n; j++) { var a = pts[j % n], b3 = pts[(j + 1) % n]; d += 'Q' + a[0].toFixed(1) + ' ' + a[1].toFixed(1) + ' ' + mid(a, b3); }
  return d + 'Z';
};
Face.prototype.stepScan = function (dt) {
  var S = this.sc, focus = null;
  if (this.scan) {
    this.scanT += dt;
    if (this.scan === 'hold') this.scanT = Math.min(this.scanT, 2.9);
    var ts = this.scanT, det = 1.5, lock = 3.0;
    var phase = ts < det ? 'search' : (ts < lock ? 'track' : 'lock');
    var P = this.qrProj, kq = damp(12, dt);
    var tqx = P ? P.x : 759 + 60 * Math.sin(ts * 1.1), tqy = P ? P.y : 256 + 40 * Math.sin(ts * 1.6 + 1), tqs = P ? P.s : 150 + 10 * Math.sin(ts * 2.1);
    S.qx += (tqx - S.qx) * kq; S.qy += (tqy - S.qy) * kq; S.qs += (tqs - S.qs) * kq;
    if (phase !== 'lock') S.locked = null;
    else if (!S.locked) S.locked = { x: S.qx, y: S.qy, s: S.qs };
    // khung luôn bám theo mã trong hình, kể cả sau khi đã đọc được
    var q = { x: S.qx, y: S.qy, s: S.qs };
    var tx = 563, ty = 60, tsz = 392;
    if (phase !== 'search') { var pad = phase === 'track' ? 22 : 7; tsz = q.s + 2 * pad; tx = q.x - tsz / 2; ty = q.y - tsz / 2; }
    var kb = damp(phase === 'track' ? 7 : 9, dt);
    S.x += (tx - S.x) * kb; S.y += (ty - S.y) * kb; S.s += (tsz - S.s) * kb;
    S.op += (1 - S.op) * damp(10, dt);
    S.qo += ((phase === 'search' ? 0 : (phase === 'lock' && this.scan === 'bad' ? 0.35 : 1)) - S.qo) * damp(8, dt);
    S.bo += ((phase === 'search' ? 0.95 : 0) - S.bo) * damp(10, dt);
    S.shake = phase === 'lock' && this.scan === 'bad' ? 10 * Math.sin(ts * 42) * Math.exp(-(ts - lock) * 3) : 0;
    S.lw = 6 + (phase === 'lock' ? 4 * Math.exp(-(ts - lock) * 5) : 0);
    S.barY = S.y + 16 + (S.s - 32) * (0.5 - 0.5 * Math.cos(ts * 2.4));
    S.q = q;
    var att = this.scanTry || 0;
    // quét lại sau lần lỗi: hiện số lần thử để khách biết Uni đang mở quét lại
    S.cap = phase === 'lock' ? (this.scan === 'bad' ? (att >= 3 ? 'Vẫn chưa đọc được mã' : 'Chưa đọc được mã') : 'Đã đọc được mã') : (phase === 'track' ? 'Thấy mã rồi, giữ yên nhé' : (att > 1 ? 'Lần ' + att + '/3, đưa mã vào khung nhé' : 'Đưa mã QR vào khung nhé'));
    focus = phase === 'search' ? [S.x + S.s / 2, S.y + S.s / 2] : [q.x, q.y];
  } else S.op += (0 - S.op) * damp(10, dt);
  return focus;
};
Face.prototype.step = function (dt) {
  var self = this; this.lastDt = dt;
  if (this.expr !== this.baseKey) { this.baseKey = this.expr; this.eT = 0; }
  this.eT += dt;
  // cảm xúc mạnh chỉ bùng lên một lúc rồi dịu lại thành nét mặt bình thường hơn
  var eff = this.expr, tt = this.eT;
  while (EXD[eff].then && tt >= EXD[eff].after) { tt -= EXD[eff].after; eff = EXD[eff].then; }
  var ex = EXD[eff];
  var changed = eff !== this.key;
  if (changed) { this.key = eff; this.kT = 0; this.acts = ex.acts.map(function () { return {}; }); this.hopT = 0; }
  this.kT += dt; var te = this.kT;
  var o = { e: [{}, {}], fdx: 0, fdy: 0, ftilt: 0, gx: 0, gy: 0, look: 0, gset: null, blink: 0, grot: [0, 0], gs: [1, 1], nod: 0, ev: [], wx: 0, wy: 0, jy: 0, sqx: 1, sqy: 1, spin: 0, hp: 0, ht: 0 };
  for (var ai = 0; ai < ex.acts.length; ai++) ACT[ex.acts[ai][0]](this.acts[ai], te, dt, o, ex.acts[ai][1] || {});
  this.clk += dt;
  if (this.hopT !== undefined && this.hopT < 1 && eff !== 'sleep') { addp(o.e[0], 'h', -0.07 * Math.exp(-this.hopT * 6) * Math.cos(this.hopT * 18)); addp(o.e[1], 'h', -0.07 * Math.exp(-this.hopT * 6) * Math.cos(this.hopT * 18)); }
  var ov = this.scanOv();
  if (ov && ov.k === 'ok') both(o, 's', 0.16 * Math.exp(-ov.lt * 5) * Math.cos(ov.lt * 12));
  for (var side = 0; side < 2; side++) {
    var base = Object.assign({}, DEF, ex.both || {}, side ? (ex.R || {}) : (ex.L || {}), ov && ov.both ? ov.both : {}, ov ? (side ? ov.R : ov.L) : {});
    // nét mặt gốc chuyển bằng lò xo êm (đổi biểu cảm nhanh mà không giật), phần cử động nhỏ của từng hành động bám nhanh như cũ
    var cur = this.eyes[side], kk = damp(24, dt), bp = this.bp[side], bv = this.bv[side], ao = this.ao[side];
    for (var q = 0; q < PKEYS.length; q++) {
      var pk = PKEYS[q];
      bp[pk] = sdamp(bp[pk], base[pk], bv, pk, 0.05, dt);
      ao[pk] += ((o.e[side][pk] || 0) - ao[pk]) * kk;
      cur[pk] = bp[pk] + ao[pk];
    }
    var want = base.glyph || null;
    if (want !== this.gly[side]) { this.gT[side] = 0; if (this.gk[side] < 0.04) this.gly[side] = want; }
    else this.gT[side] = want ? 1 : 0;
    this.gk[side] += (this.gT[side] - this.gk[side]) * damp(20, dt);
  }
  if (this.text && this.typed < this.text.length) { this.typeAcc += dt; while (this.typeAcc > 0.026 && this.typed < this.text.length) { this.typeAcc -= 0.026; this.typed++; } }
  var small = !!(this.text || this.scan || this.small);
  // liếc trước khoảng 0,2 giây về phía chữ sắp hiện rồi mặt mới lùi về góc
  if (small && !this.wasSmall) {
    this.antT = 0.22;
    // hiệu ứng đang bay ở trạng thái full sẽ mờ nhanh để không đè lên chữ
    this.parts.forEach(function (q) { if (!q.back && !q.persist) q.life = Math.min(q.life, q.age + 0.25); });
  }
  this.wasSmall = small;
  var ant = this.antT > 0; if (ant) this.antT -= dt;
  // có tai, sừng hay đồ trên đầu thì mặt thu nhỏ hơn và thấp xuống (đỉnh mặt không quá nửa chiều cao màn) để phụ kiện có chỗ phía trên
  var headDec = this.decor && (this.decor.ears || this.decor.hair) || this.shape === 'bot';   // người máy: chừa chỗ để thấy chóp mũ trùm cả khi mặt to
  this.Lt = small && !ant ? (this.shape === 'bot' ? 0.42 : headDec ? 0.32 : 0.36) : 1;   // người máy: mặt thu nhỏ to hơn để thấy trọn mũ trùm
  this.L = sdamp(this.L, this.Lt, this.lv, 'L', 0.09, dt);
  this.ak = (this.ak || 1) + ((1 + 0.07 * (this.attn || 0)) - (this.ak || 1)) * damp(3, dt);
  // ngủ thì tắt đèn: nền đỏ tối dần thành đen, có người tới thì đỏ bừng lên lại
  var dimT = this.expr === 'sleep' ? 1 : (this.expr === 'sleepy' ? 0.35 : 0);
  this.dim += (dimT - this.dim) * damp(dimT > this.dim ? 0.9 : 9, dt);
  // sm = 0: mặt phủ kín màn hình, hai mắt ở chính giữa; sm = 1: mặt thu về góc dưới trái để nhường chỗ cho chữ
  var sm = clamp((1 - this.L) / 0.58, 0, 1); this.sm = sm;
  // hk: có phụ kiện trên đầu. Mặt to thì chỉ hiện vòm mặt chiếm khoảng 2/3 dưới màn, chừa 1/3 trên cho phụ kiện (mắt hạ xuống, vòm rộng hơn)
  this.hk = sdamp(this.hk || 0, headDec ? 1 : 0, this.lv, 'hk', 0.15, dt);
  var hk = this.hk * (1 - sm);
  var bkP = this.shape === 'bot' ? this.botK() : 0, PX = 539 + (212 + 12 * bkP - 539) * sm, PY = 240 + (400 - 4 * bkP - 240) * sm + 60 * hk;
  var focus = this.stepScan(dt);
  this.tl = sdamp(this.tl, ex.tilt || 0, this.lv, 'tl', 0.22, dt);
  // xê dịch nhẹ (px trên màn), giới hạn trong vùng an toàn: không lấn sang phần chữ bên phải và lịch trình phía trên
  this.wd[0] = sdamp(this.wd[0], clamp(o.wx, -10, 5), this.lv, 'wx', 0.35, dt);
  this.wd[1] = sdamp(this.wd[1], clamp(o.wy, -5, 8), this.lv, 'wy', 0.35, dt);
  this.hd[0] = sdamp(this.hd[0], ex.hd ? ex.hd[0] : 0, this.lv, 'hp', 0.4, dt);
  this.hd[1] = sdamp(this.hd[1], ex.hd ? ex.hd[1] : 0, this.lv, 'ht', 0.4, dt);
  this.nod = o.nod || 0;
  // free = 0: mặt full màn hình, cả điện thoại là cái đầu. free = 1: mặt thu nhỏ, mắt tự do.
  var free = clamp((1 - this.L) / 0.5, 0, 1);
  this.free = free;
  // Phối hợp mắt và đầu như người: view là hướng mục tiêu so với mặt hiện tại.
  // Bù phần đầu đang quay theo biểu cảm (hs) để biết mục tiêu nằm đâu so với hướng nhắm gốc.
  var hsN = [this.hs[0] * 28 / 38, this.hs[1] * 20 / 30];
  var vT = [this.view[0] + hsN[0], this.view[1] + hsN[1]];
  var ge = o.gset || ex.gaze || null;
  var G = ge ? ge.slice() : vT.slice();
  if (o.look) G = [G[0] + (vT[0] - G[0]) * o.look, G[1] + (vT[1] - G[1]) * o.look];
  if (focus) G = [clamp((focus[0] - PX) / 520, -1, 1), clamp((focus[1] - PY) / 300, -1, 1)];
  // đầu gánh 70% hướng nhìn của biểu cảm, mắt lo phần còn lại cùng các cú liếc, đảo mắt
  var H = ge && !focus ? [G[0] * 0.7 * (1 - free), G[1] * 0.7 * (1 - free)] : [0, 0];
  var kh = damp(16, dt);
  this.hs[0] += (H[0] - this.hs[0]) * kh; this.hs[1] += (H[1] - this.hs[1]) * kh;
  // mặt full màn hình thì phần xê dịch do đầu robot gánh (rất nhẹ); mặt thu nhỏ thì mặt tự xê dịch trên màn
  this.head = {
    pan: H[0] * 28 + (o.fdx * 0.5 + (this.tl + o.ftilt) * 0.3 + this.wd[0] * 0.4) * (1 - free) + this.hd[0] + o.hp,
    tilt: -H[1] * 20 - (o.fdy * 0.55 + this.wd[1] * 0.4) * (1 - free) + this.hd[1] + o.ht
  };
  // mắt nhìn phần chênh giữa hướng muốn nhìn và hướng đầu đang thực sự quay tới: đầu chậm hơn nên mắt đi trước, đầu theo kịp thì mắt về giữa
  // lúc chữ đang chạy thì mắt nhìn theo chữ, chạy xong thì nhìn lại khách
  var rd = ant ? [0.75, -0.1] : (this.text && this.typed < this.text.length ? [0.55, -0.2] : [0, 0]);
  var E = [clamp(G[0] - hsN[0] + o.gx + rd[0], -1.2, 1.2), clamp(G[1] - hsN[1] + o.gy + rd[1], -1.2, 1.2)];
  // lò xo hơi thiếu cản: mắt bật nhanh tới đích, vượt nhẹ rồi dừng, giống cú đảo mắt (saccade)
  var nS = Math.max(1, Math.ceil(dt / 0.008)), hS = dt / nS;
  for (var it = 0; it < nS; it++) for (var ax = 0; ax < 2; ax++) {
    this.gv[ax] += (1100 * (E[ax] - this.gz[ax]) - 40 * this.gv[ax]) * hS; this.gz[ax] += this.gv[ax] * hS;
  }
  // chống lưu ảnh OLED: cả cặp mắt trôi rất chậm vài pixel khi full màn hình
  var dr = 1 - free, ampX = 64 - 8 * free;
  var wk = free / (0.85 * Math.max(this.L, 0.3));   // đổi px trên màn sang đơn vị vẽ của mặt
  var T = { L: this.L, tilt: clamp(this.tl + o.ftilt, -10, 10) + o.spin, fx: this.gz[0] * 8 * free + this.wd[0] * wk, fy: this.gz[1] * 12 * free + (this.wd[1] + o.jy) * wk, sqx: o.sqx, sqy: o.sqy };
  T.exx = this.gz[0] * ampX + o.fdx * free + 6 * dr * Math.sin(this.clk * 0.019); T.eyy = this.gz[1] * (40 + 24 * free) + o.fdy * free + 4 * dr * Math.sin(this.clk * 0.023 + 1.3);
  // có hồn hơn: đổi nét mặt thì mắt nảy lên một cái rồi nhún nhẹ, lúc rảnh mắt bồng bềnh như đang thở (chỉ vẽ trên màn, không bắt servo chạy)
  this.hopT = (this.hopT === undefined ? 9 : this.hopT) + dt;
  var hp = this.hopT, awake = eff !== 'sleep';
  T.eyy += (awake ? -16 * Math.exp(-hp * 4.5) * Math.abs(Math.sin(hp * 9)) + 3.5 * Math.sin(this.clk * 1.8) : 0);
  // người máy: mũ (vòm mặt) chỉ nhích rất nhẹ; phần xê dịch, nảy của mặt dồn sang mắt và miệng bên trong lỗ mũ
  var bkM = this.shape === 'bot' || this.shPrev === 'bot' ? this.botK() : 0;
  if (bkM > 0) {
    var hmK = 1 - (1 - BOT_HM) * bkM;
    T.exx += T.fx * (1 - hmK); T.eyy += T.fy * (1 - hmK); T.fx *= hmK; T.fy *= hmK;
    T.sqx = 1 + (T.sqx - 1) * hmK; T.sqy = 1 + (T.sqy - 1) * hmK;
  }
  // phối cảnh: mắt phía đang liếc tới to hơn, mắt kia nhỏ lại, nhìn lên hoặc xuống thì dẹt nhẹ; cộng nhịp thở
  // đeo kính ngầu thì tắt phối cảnh để hai nửa kính luôn khớp nhau
  var vk = this.gly[0] === 'visor' ? 1 - this.gk[0] : 1;
  var gxp = clamp(this.gz[0], -0.9, 0.9) * vk, gyp = Math.abs(clamp(this.gz[1], -0.9, 0.9)) * vk, br = 1 + 0.012 * Math.sin(this.clk * 1.5);
  for (var sd2 = 0; sd2 < 2; sd2++) {
    var sg = sd2 ? 1 : -1;
    this.pz.sy[sd2] = (1 + 0.15 * gxp * sg) * (1 - 0.08 * gyp) * br;
    this.pz.sx[sd2] = (1 - 0.05 * Math.abs(gxp)) * (1 + 0.04 * gxp * sg) * br;
  }
  this.pz.gapK = 1 - 0.06 * Math.abs(gxp);
  var L = this.L, R = this.R, gap = this.gap;
  var ctx = { R: R, lx: 492 - gap / 2, rx: 492 + gap / 2, k: Math.max(L, 0.45), sm: sm,
    map: function (x, y) { return [PX + L * (x - 492 + T.fx), PY + L * (y - 262 + T.fy)]; },
    eye: function (x, y) { return [PX + L * (x - 492 + T.exx + T.fx), PY + L * (y - 262 + T.eyy + T.fy)]; } };
  // full: mặt đỏ phủ kín màn hình; thu nhỏ: cùng khuôn mặt đó lùi về góc dưới trái
  T.sm = sm; T.px = PX; T.py = PY; T.ccx = 492 - 161 * sm; T.ccy = 262 + 186 * sm + 760 * hk; T.cr = 700 - 30 * sm + 200 * hk; T.hk = this.hk; T.dim = this.dim;
  if (this.shape === 'bot' || this.shPrev === 'bot') this.botBuild(T);
  var dKey = this.decoOverride !== undefined ? this.decoOverride : (ex.deco || null);
  var deco = dKey ? DECO[dKey] : null;
  var sp = function (c) { self.spawn(c); };
  if (dKey !== this.dkey || (changed && deco && deco.once)) {
    this.dkey = dKey; this.dT = 0; this.dAcc = 0; this.dN = 0;
    this.parts = this.parts.filter(function (p) { return !p.persist; });
    if (deco) {
      if (deco.once) this.oncePend = deco;
      if (deco.persist) deco.persist.forEach(function (shape, n) { var p = self.spawn({ shape: shape, color: WHITE, life: 1e9 }, dKey); if (p) p.idx = n; });
      if (deco.rate) this.dAcc = deco.rate * 0.7;
    }
  }
  this.dT += dt;
  // dấu !, ?, tia lấp lánh chỉ hiện khi mặt đã đứng yên ở vị trí mới, tránh bay lạc chỗ lúc đang phóng to thu nhỏ
  if (this.oncePend && Math.abs(this.L - this.Lt) < 0.06) { if (this.oncePend === deco) deco.once(ctx, sp); this.oncePend = null; }
  if (deco && deco.rate) { this.dAcc += dt; while (this.dAcc >= deco.rate) { this.dAcc -= deco.rate; if ((!small || this.L < 0.5) && (!deco.max || this.dN < deco.max)) { this.spawn(deco.spawn(ctx)); this.dN++; } } }
  if (deco && deco.on) o.ev.forEach(function (e) { if (deco.on[e]) deco.on[e](ctx, sp); });
  var dT = this.dT;
  this.parts = this.parts.filter(function (p) {
    if (p.persist) { if (deco && deco.update && p.persist === dKey) { deco.update(p, p.idx, dT, ctx); return true; } return false; }
    p.age += dt; if (p.age >= p.life) return false;
    p.vy += p.ay * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
    var lk = p.age / p.life; p.size = p.s0 + (p.s1 - p.s0) * lk;
    if (p.pop) p.size *= clamp(backOut(Math.min(1, p.age / 0.28)), 0, 1.4);
    p.op = Math.min(1, p.age / 0.15) * (lk > 0.7 ? (1 - lk) / 0.3 : 1) * (p.al || 1);   // al: độ đậm riêng của từng loại trang trí
    return true;
  });
  this.draw(o, T);
};
function luma(hex) { var n = parseInt(hex.slice(1), 16); return (0.299 * (n >> 16 & 255) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255)) / 255; }
Face.prototype.drawPart = function (p, color) {
  var g = this.g, sh = SHAPES[p.shape], sx = p.x + (p.sway ? Math.sin(p.age * p.swayF + p.ph) * p.sway : 0), s = Math.max(0.001, p.size);
  g.save(); g.globalAlpha = clamp(p.op, 0, 1); g.translate(sx, p.y); g.rotate(p.rot * D2R); g.scale(s, s);
  if (sh.fill) { g.fillStyle = color; g.fill(this.P(sh.d)); }
  else { g.strokeStyle = color; g.lineWidth = sh.sw; g.lineCap = 'round'; g.lineJoin = 'round'; g.stroke(this.P(sh.d)); }
  g.restore();
};
/* occl: các ô chữ trên màn (tọa độ sân khấu 915 × 412). Hiệu ứng bay (confetti, lấp lánh) không hiện trong các ô đó,
   như thể chữ nằm trên một lớp kính đục: hiệu ứng luôn là lớp dưới cùng, không lẫn vào chữ.
   Lớp sau (vẽ ngay trên nền đen, dưới mặt): vẽ xong thì phủ nền đen lên các ô. Lớp trước (trên mặt): bỏ hạt nằm trong ô */
Face.prototype.occlRects = function () {
  var oc = this.occl; if (!oc || !oc.length) return null;
  var kx = 1078 / 915, ky = 480 / 412;
  return oc.map(function (r) { return [r[0] * kx, r[1] * ky, r[2] * kx, r[3] * ky]; });
};
function inRects(rs, x, y) { for (var i = 0; i < rs.length; i++) { var r = rs[i]; if (x > r[0] && x < r[0] + r[2] && y > r[1] && y < r[1] + r[3]) return true; } return false; }
Face.prototype.drawParts = function (back) {
  var g = this.g, light = !back && this.fLight, rs = this.occlRects();
  for (var i = 0; i < this.parts.length; i++) {
    var p = this.parts[i];
    if (p.back !== back || p.op <= 0.01) continue;
    if (rs && !back && inRects(rs, p.x, p.y)) continue;
    this.drawPart(p, p.color);
    // mặt màu sáng (trắng, vàng): phần hiệu ứng nằm trên mặt vẽ lại bằng màu tối, phần ngoài mặt giữ màu trắng
    if (light) { g.save(); g.beginPath(); g.arc(this.fcx, this.fcy, this.fcr, 0, Math.PI * 2); g.clip(); this.drawPart(p, '#141414'); g.restore(); }
  }
};
function rrPath(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
function wrapText(g, text, maxW) {
  var words = text.split(' '), lines = [], line = '';
  for (var i = 0; i < words.length; i++) {
    var test = line ? line + ' ' + words[i] : words[i];
    if (line && g.measureText(test).width > maxW) { lines.push(line + ' '); line = words[i]; } else line = test;
  }
  lines.push(line);
  return lines;
}
Face.prototype.drawEyes = function (o, T, paths, col) {
  var g = this.g, pz = this.pz;
  g.save();
  var M0 = g.getTransform();   // khung trước khi theo mắt: mũ người máy chỉ nhích rất nhẹ theo khung này
  g.translate(T.exx, T.eyy); g.translate(492, 262); g.rotate(T.tilt * D2R); g.translate(-492, -262);
  var bk2 = this.bk || 0;
  if (bk2 > 0.01) {   // người máy trùm mũ: cả vòm mặt là mũ trùm (màu mặt Uni); trong lỗ mũ hình vòm cung là mặt thép của người máy như hình gốc
    // lỗ mũ theo bản phác (BOT_HOLE): hai bên gần thẳng, đỉnh nhọn chếch sang phải; mặt to thì thấp và hẹp lại cùng mũ (bG)
    // mũ (cả lỗ mũ) chỉ nhích rất nhẹ (BOT_HM phần chuyển động của mặt), còn mắt và miệng bên trong đi đủ theo biểu cảm
    var gb = g.globalAlpha, rb = this.R, G = this.bG || { hs: 1, vy: 1 }, Me = g.getTransform(), hm = BOT_HM;
    var X = function (u) { return 492 + u * rb * G.hs; };
    var hole = function (dy) { return botPath(BOT_HOLE, X, function (v) { return 262 + v * rb * G.vy + dy; }); };
    g.setTransform(M0); g.translate(T.exx * hm, T.eyy * hm); g.translate(492, 262); g.rotate(T.tilt * hm * D2R); g.translate(-492, -262);
    var Mh = g.getTransform(), H = hole(0);
    g.globalAlpha = gb * bk2;
    g.lineWidth = rb * 0.5; g.lineJoin = 'round'; g.strokeStyle = this.bCol.rim; g.stroke(H);   // vành trong của mũ quanh lỗ, đậm hơn màu mũ (nửa trong bị mặt che, còn nửa ngoài)
    g.save(); g.clip(H);
    g.fillStyle = this.bCol.steel; g.fillRect(-3000, -3000, 7000, 7000);
    // miệng: khối lưới bo góc như hình minh họa (vành tối, mặt lưới sáng hơn một chút), trong là các khe dọc đen; đi theo mặt (chi tiết tĩnh, biểu cảm vẫn chỉ ở mắt)
    g.setTransform(Me);
    // miệng theo bản phác: khối hình thang đen, đỉnh hẹp bo nhẹ hai góc, hai cạnh xòe ra chạy xuống dưới màn, chia bởi các gân sáng xòe theo cạnh
    var BM = this.fpix ? BOT_MOUTH_PIX : BOT_MOUTH, wt = rb * BM.w * G.hs, my = 262 + rb * BM.y * G.vy, MH = rb * 7, wb = wt + 2 * MH * BM.k * G.hs / G.vy, cr = rb * 0.18;
    var L0 = 492 - wt / 2, R0 = 492 + wt / 2, L1 = 492 - wb / 2, R1 = 492 + wb / 2, dx = (L0 - L1) / MH;
    g.fillStyle = this.bCol.mouth; g.beginPath();
    g.moveTo(L1, my + MH); g.lineTo(L0 + dx * cr, my + cr); g.quadraticCurveTo(L0, my, L0 + cr, my); g.lineTo(R0 - cr, my); g.quadraticCurveTo(R0, my, R0 - dx * cr, my + cr); g.lineTo(R1, my + MH); g.closePath(); g.fill();
    g.fillStyle = this.bCol.panel; var rw = rb * BM.rw * G.hs;
    for (var di = 1; di < BM.n; di++) { var f = di / BM.n, xt = L0 + (R0 - L0) * f, xb = L1 + (R1 - L1) * f; g.beginPath(); g.moveTo(xt - rw / 2, my + rb * 0.12); g.lineTo(xt + rw / 2, my + rb * 0.12); g.lineTo(xb + rw / 2, my + MH); g.lineTo(xb - rw / 2, my + MH); g.closePath(); g.fill(); }
    // bóng đổ của vạt mũ in xuống mặt: đặc, sâu, lệch xuống nhiều, không mờ loang, để mặt như chìm sâu trong mũ
    g.setTransform(Mh);
    var sp = new Path2D(); sp.addPath(H); sp.addPath(hole(rb * 0.75));
    g.fillStyle = this.bCol.shadow; g.fill(sp, 'evenodd');
    g.restore(); g.globalAlpha = gb;
    if (bk2 > 0.5) g.clip(H);   // mắt nằm trong lỗ mũ: phần mắt chạm vạt mũ bị che (khung drawEyes khôi phục ở cuối hàm)
    g.setTransform(Me);
  }
  for (var sd = 0; sd < 2; sd++) {
    var p = this.eyes[sd], cx = 492 + (sd ? 1 : -1) * this.gap / 2 * pz.gapK;
    g.save(); g.translate(cx + p.dx * this.R, 262 + p.dy * this.R); g.rotate(p.rot * D2R); g.scale(pz.sx[sd], pz.sy[sd]);
    var ES = this.es || EYE_STYLE.soft;
    if (ES.anime) this.animeEye(o, p, sd, paths[sd], col, ES.pix);
    else if (ES.pix) this.pixFill(paths[sd], this.ebb[sd], col);
    else { g.fillStyle = col; g.fill(paths[sd]); }
    // ánh long lanh trong mắt (mắt cún con khi xin lỗi), ẩn khi chớp mắt hoặc khi mắt thành hình khác
    var glv = p.gl * (1 - o.blink) * (1 - this.gk[sd]) * (1 - Math.min(1, p.line));
    if (glv > 0.02) {
      var ew = p.w * this.R * p.s, eh = p.h * this.R * p.s;
      g.save(); g.clip(paths[sd]); g.fillStyle = 'rgba(255,255,255,' + (0.95 * glv).toFixed(3) + ')';
      g.beginPath(); g.arc(-0.32 * ew, -0.34 * eh, 0.26 * this.R * p.s * glv, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(0.24 * ew, 0.3 * eh, 0.11 * this.R * p.s * glv, 0, Math.PI * 2); g.fill();
      g.restore();
    }
    if (this.gk[sd] > 0.01 && this.gly[sd]) {
      var G = GLYPHS[this.gly[sd] + sd] || GLYPHS[this.gly[sd]];
      g.rotate(o.grot[sd] * D2R);
      var sc = Math.max(0.001, this.gk[sd] * this.R * 0.95 * p.s * o.gs[sd] * (ES.pix ? 1.15 : 1));
      if (ES.pix && G.fill) {   // mắt pixel: sao, tim cũng vẽ bằng ô vuông
        var gp = new Path2D(); gp.addPath(this.P(G.d), new DOMMatrix().scale(sc, sc)); this.pixFill(gp, [-sc * 1.1, -sc * 1.1, sc * 1.1, sc * 1.1], col);
        g.restore(); continue;
      }
      g.scale(sc, sc);
      g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = col;
      if (G.fill) { g.fillStyle = col; g.fill(this.P(G.d)); g.lineWidth = 0.1; g.stroke(this.P(G.d)); }
      else { g.lineWidth = 0.3; g.stroke(this.P(G.d)); }
    }
    g.restore();
  }
  g.restore();
};
/* Mặt pixel: mỗi ô một màu đặc, không có mép mờ hay chuyển màu. Ô đậm quá nửa thì đặc hẳn, nhạt hơn thì bỏ trống;
   màu đưa về màu gần nhất trong bảng màu thật đang dùng: màu mặt (cũ và mới khi đang loang), màu mắt, các sắc của tai, sừng nhuộm theo mặt,
   các màu gốc của phụ kiện (nơ, hoa, mũ...). Vệt loang màu vì thế đi qua từng ô, không còn dải chuyển màu. */
Face.prototype.pixSnap = function (px, fc, fcOld, dim) {
  var pal = px.pal.slice(), D = window.UniDecor && window.UniDecor.DECOR, dec = this.decor || {};
  ['ears', 'hair', 'eyes'].forEach(function (slot) {
    var it = dec[slot] && D && D[dec[slot]]; if (!it) return;
    if (it.m && it.m.tint) it.m.tint.forEach(function (k) {
      [fc, fcOld].forEach(function (c) { var h = shade(c, k); pal.push(dim > 0.02 ? mixHex(h, '#000000', dim) : h); });   // tai tối dần theo mặt khi ngủ
    });
    else it.parts.join('').replace(/#[0-9a-fA-F]{6}\b/g, function (h) { pal.push(h.toLowerCase()); return h; });
  });
  var P = [], seen = {};
  pal.forEach(function (h) { if (!h || seen[h]) return; seen[h] = 1; var n = parseInt(h.slice(1), 16); P.push(n >> 16 & 255, n >> 8 & 255, n & 255); });
  var x = this.lox, id = x.getImageData(0, 0, px.nx, px.ny), d = id.data, cache = {};
  for (var i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 128) { d[i + 3] = 0; continue; }
    d[i + 3] = 255;
    var key = d[i] << 16 | d[i + 1] << 8 | d[i + 2], b = cache[key];
    if (b === undefined) {
      var best = 1e9; b = 0;
      for (var j = 0; j < P.length; j += 3) { var dr = d[i] - P[j], dg = d[i + 1] - P[j + 1], db = d[i + 2] - P[j + 2], e = dr * dr * 3 + dg * dg * 4 + db * db * 2; if (e < best) { best = e; b = j; } }
      cache[key] = b;
    }
    d[i] = P[b]; d[i + 1] = P[b + 1]; d[i + 2] = P[b + 2];
  }
  x.putImageData(id, 0, 0);
};
// mắt pixel: tô các ô vuông bo nhẹ trên lưới cố định theo tâm mắt, ô nào có tâm nằm trong hình mắt thì sáng.
// col là một màu, hoặc hàm (x, y) trả về màu của ô đó, null là bỏ trống ô (pixel anime: ô trong đốm sáng để trống)
Face.prototype.pixFill = function (path, bb, col) {
  var g = this.g, hc = this.hc, c = this.R * 0.2, gap = c * 0.16, rr = c * 0.22;   // ô nhỏ hơn: nhiều ô hơn, viền mắt mềm hơn
  if (!bb) return;
  var i0 = Math.floor(bb[0] / c), i1 = Math.ceil(bb[2] / c), j0 = Math.floor(bb[1] / c), j1 = Math.ceil(bb[3] / c);
  var fn = typeof col === 'function', groups = {};
  if (!fn) g.beginPath();
  for (var i = i0; i <= i1; i++) for (var j = j0; j <= j1; j++) {
    var x = (i + 0.5) * c - c / 2, y = (j + 0.5) * c - c / 2;
    // thử thêm hai điểm lệch trên dưới để nét mảnh (mắt nhắm, mắt cười) không bị rơi mất giữa hai hàng ô
    if (!hc.isPointInPath(path, x, y) && !hc.isPointInPath(path, x, y - c * 0.3) && !hc.isPointInPath(path, x, y + c * 0.3)) continue;
    var x0 = x - c / 2 + gap / 2, y0 = y - c / 2 + gap / 2, s = c - gap;
    if (fn) { var k = col(x, y); if (k) (groups[k] = groups[k] || []).push(x0, y0); continue; }
    if (g.roundRect) g.roundRect(x0, y0, s, s, rr); else g.rect(x0, y0, s, s);
  }
  if (!fn) { g.fillStyle = col; g.fill(); return; }
  s = c - gap;
  for (var key in groups) {
    var a = groups[key]; g.beginPath();
    for (var n = 0; n < a.length; n += 2) { if (g.roundRect) g.roundRect(a[n], a[n + 1], s, s, rr); else g.rect(a[n], a[n + 1], s, s); }
    g.fillStyle = key; g.fill();
  }
};
// mắt anime: một khối màu mắt cùng khuôn với mắt vuông bo (không tròng trắng, không con ngươi màu); hai đốm sáng là lỗ khoét
// lộ màu mặt phía sau, trượt theo hướng nhìn. Mắt cười, mắt nhắm (nét cong) thì đốm sáng thu nhỏ dần rồi mất. pix: tô bằng ô vuông, ô trong đốm sáng để trống
Face.prototype.animeEye = function (o, p, sd, path, col, pix) {
  var g = this.g, open = (1 - this.gk[sd]) * (1 - Math.min(1, p.line)) * (1 - clamp(p.arc, 0, 1)) * (1 - 0.7 * o.blink);
  var bb = this.ebb[sd] || [-60, -80, 60, 80], k = clamp(open * 1.6, 0, 1);
  if (k < 0.05) { if (pix) this.pixFill(path, bb, col); else { g.fillStyle = col; g.fill(path); } return; }
  var ew = (bb[2] - bb[0]) / 2, eh = (bb[3] - bb[1]) / 2, ir = Math.min(ew * 0.82, this.R * 0.95 * p.s);
  var cx = (bb[0] + bb[2]) / 2, cy = (bb[1] + bb[3]) / 2;
  var ix = cx + clamp(this.gz[0], -1, 1) * ew * 0.22, iy = cy - eh * 0.05 + clamp(this.gz[1], -1, 1) * eh * 0.12;
  var H = [[ix - ir * 0.34, iy - ir * 0.4, ir * 0.3 * k, ir * 0.36 * k, -0.4], [ix + ir * 0.3, iy + ir * 0.36, ir * 0.13 * k, ir * 0.13 * k, 0]];
  if (pix) {
    var inE = function (x, y, h) { var c = Math.cos(h[4]), s2 = Math.sin(h[4]), dx = x - h[0], dy = y - h[1], u = (dx * c + dy * s2) / h[2], v = (-dx * s2 + dy * c) / h[3]; return u * u + v * v <= 1; };
    this.pixFill(path, bb, function (x, y) { return inE(x, y, H[0]) || inE(x, y, H[1]) ? null : col; });
    return;
  }
  // tô khối mắt trừ hai lỗ đốm sáng (quy tắc evenodd trong vùng cắt theo hình mắt)
  g.save(); g.clip(path);
  var q = new Path2D(); q.rect(bb[0] - 4, bb[1] - 4, bb[2] - bb[0] + 8, bb[3] - bb[1] + 8);
  H.forEach(function (h) { q.moveTo(h[0] + Math.cos(h[4]) * h[2], h[1] + Math.sin(h[4]) * h[2]); q.ellipse(h[0], h[1], Math.max(0.1, h[2]), Math.max(0.1, h[3]), h[4], 0, Math.PI * 2); });
  g.fillStyle = col; g.fill(q, 'evenodd');
  g.restore();
};
// đổi màu: màu mới loang ra từ góc dưới trái màn hình (chỗ mặt thu về), phủ dần khắp mặt trong khoảng 0,8 giây (CSPAN), mép loang là dải chuyển màu mềm, không đổi đột ngột;
// tai, sừng nhuộm theo màu mặt chuyển dần sang màu mới (hòa hai bộ ảnh) đúng lúc vệt loang chạm tới, không đổi phắt
var CSPAN = 0.35;   // đổi màu và dáng: đã rút từ 0,8 xuống 0,53 rồi 0,35 giây theo yêu cầu
/* ---------- trang trí: phụ kiện (tai, sừng, nơ, hoa, vương miện, kính) và nền họa tiết mờ ----------
   Ảnh lấy từ public/decor.js (Fluent Emoji Flat, Hero Patterns). decor = { ears, hair, eyes } là mã phụ kiện cho từng chỗ. */
function svgImg(svg, w) {
  var vb = /viewBox="([^"]+)"/.exec(svg)[1].split(' ').map(Number), h = w * vb[3] / vb[2];
  var img = new Image(); img.src = 'data:image/svg+xml,' + encodeURIComponent(svg.replace('<svg ', '<svg width="' + w + '" height="' + Math.round(h) + '" '));
  img.ar = vb[2] / vb[3]; return img;
}
Face.prototype.setDecor = function (d) {
  var D = window.UniDecor && window.UniDecor.DECOR; d = d || {}; this.decor = {}; this.decImg = this.decImg || {};
  if (!D) return;
  ['ears', 'hair', 'eyes'].forEach(function (slot) {
    var k = d[slot], it = k && D[k]; if (!it || it.slot !== slot) return;
    this.decor[slot] = k;
    if (it.m && it.m.tint) { if (this.decTintK) this.decTintK[slot] = null; return; }   // tai, sừng nhuộm theo màu mặt: tạo ảnh lúc vẽ (tintDecor)
    if (!this.decImg[k]) this.decImg[k] = it.parts.map(function (p) { return svgImg(p, 256); });
  }, this);
};
// tai, sừng nhuộm theo màu mặt: mỗi mảng là màu mặt tối hoặc sáng hơn một chút (m.tint), đổi màu mặt thì tạo lại ảnh, giữ ảnh cũ tới khi ảnh mới sẵn sàng
function shade(hex, k) { return k < 0 ? mixHex(hex, '#000000', -k) : mixHex(hex, '#ffffff', k); }
Face.prototype.tintDecor = function (slot) {
  var k = this.decor && this.decor[slot], D = window.UniDecor && window.UniDecor.DECOR, it = k && D && D[k];
  if (!it || !it.m || !it.m.tint) return false;
  var col = this.color || FACE_RED, key = k + col; this.decTintK = this.decTintK || {}; if (this.decTintK[slot] === key) return true;
  this.decTintK[slot] = key; var self = this, imgs = it.parts.map(function (p) {
    it.m.tint.forEach(function (t, i) { p = p.split('TINT' + i).join(shade(col, t)); });
    return svgImg(p, 256);
  }), n = 0;
  imgs.forEach(function (im) { im.onload = function () {
    if (++n !== imgs.length || self.decTintK[slot] !== key) return;
    self.decPrev = self.decPrev || {}; self.decPrev[k] = self.cT !== undefined && self.cT < 1 ? self.decImg[k] : null;   // đang loang màu: giữ bộ cũ để hòa dần
    self.decImg[k] = imgs;
  }; });
  return true;
};
// món nhuộm theo màu mặt lúc đang loang màu: vẽ bộ màu cũ rồi phủ dần bộ màu mới lên khi vệt loang đi qua (từ khoảng giữa tới gần hết)
Face.prototype.drawTinted = function (slot, T) {
  var k = this.decor[slot], prev = this.decPrev && this.decPrev[k];
  if (!prev || (this.spread || 1) >= 1) { if (prev) this.decPrev[k] = null; this.drawDecor(slot, T); return; }
  var g = this.g, cur = this.decImg[k], a = ease((this.spread - 0.45) / 0.45), ga = g.globalAlpha;
  this.decImg[k] = prev; this.drawDecor(slot, T); this.decImg[k] = cur;
  if (a > 0) { g.globalAlpha = ga * a; this.drawDecor(slot, T); g.globalAlpha = ga; }
};
// vị trí phụ kiện, tính trong hệ tọa độ của mặt (tâm hai mắt ở 492, 262). sm = 0: mặt phủ kín màn hình; sm = 1: mặt thu về góc dưới trái.
// mặt to: tai, nơ, hoa nằm ở vùng trán phía trên mắt; mặt nhỏ: bám theo mép vòm mặt (góc phi tính từ đỉnh).
Face.prototype.drawDecor = function (slot, T) {
  var g = this.g, k = this.decor[slot], imgs = this.decImg[k], self = this; if (!imgs) return;
  var D = window.UniDecor && window.UniDecor.DECOR, m = (D && D[k] && D[k].m) || {};
  var sm = T.sm, lerp = function (a, b) { return a + (b - a) * sm; }, pick2 = function (v, a, b) { return v ? lerp(v[0], v[1]) : lerp(a, b); };
  var rimPt = function (a, inset) { var r = T.cr * self.rimK(a) - inset; return [T.ccx + r * Math.sin(a), T.ccy - r * Math.cos(a)]; };
  // điểm trên mép vòm và góc tiếp tuyến thật của mép ở đó (dáng không tròn thì tiếp tuyến lệch khỏi góc bán kính), để gốc tai, sừng luôn áp sát mép
  var onRim = function (phi, inset) {
    var a = phi * D2R, p = rimPt(a, inset), p0 = rimPt(a - 0.01, 0), p1 = rimPt(a + 0.01, 0);
    p.push(Math.atan2(p1[1] - p0[1], p1[0] - p0[0]) * R2D); return p;
  };
  var put = function (img, x, y, rot, h, ax, ay, flip) {
    if (!img.complete || !img.naturalWidth) return;
    var w = h * img.ar * (m.wx || 1);   // wx: nới bề ngang cho món quá mảnh (sừng Unikorn) trông mập mạp, mềm hơn
    g.save(); g.translate(x, y); g.rotate(rot * D2R); if (flip) g.scale(-1, 1);
    g.drawImage(img, -w * ax, -h * ay, w, h); g.restore();
  };
  if (slot === 'ears') {
    // tai mọc từ mép vòm mặt, cả khi mặt to (vòm chiếm 2/3 dưới màn) lẫn khi thu nhỏ
    // ax: neo đúng gốc tai, gốc sừng; rot: sừng nghiêng thêm ra ngoài
    for (var i = 0; i < 2; i++) {
      var sg = i ? 1 : -1, ang = pick2(m.ang, 18, 23) * sg, rim = onRim(ang, lerp(18, 24));
      put(imgs[i], rim[0], rim[1], rim[2] - (m.rot || 0) * sg, pick2(m.h, 170, 200), m.ax ? m.ax[i] : 0.5, m.ay || 1);
    }
  } else if (slot === 'hair') {
    // mọc từ trán (sừng Unikorn), giữa đỉnh đầu (vương miện, mũ) hoặc cài lệch sang phải như kẹp tóc (nơ, hoa; bên trái mặt nhỏ sát mép màn nên không đặt)
    if (m.pos === 'forehead') {   // sừng mọc ra từ trán, phía trước mặt, ngay giữa hai mắt (mặt thu nhỏ thì tâm vòm lệch trái nên không lấy đỉnh vòm)
      var pf = Math.asin(clamp((492 - T.ccx) / (T.cr * this.rimK(0)), -0.9, 0.9)) * R2D, rt = onRim(pf, pick2(m.inset, 70, 95));
      put(imgs[0], rt[0], rt[1], rt[2] * 0.35 + (m.lean || 0), pick2(m.h, 240, 180), 0.5, m.ay || 1);   // ngả nhẹ theo mặt trán, lean: chóp nghiêng thêm về phía trên bên phải (độ)
    }
    else if (m.pos === 'center') { var rc = onRim(0, lerp(20, 30)); put(imgs[0], rc[0], rc[1], rc[2], m.fit ? m.fit * T.cr / 700 : pick2(m.h, 120, 140), 0.5, m.ay || 0.85); }   // fit: cao theo đơn vị vòm (bán kính 700), co giãn cùng vòm mặt
    else { var a2 = lerp(26, 38), rh = onRim(a2, 6); put(imgs[0], rh[0], rh[1], rh[2], pick2(m.h, 140, 150), 0.5, m.ay || 0.5); }
  } else if (slot === 'eyes') {
    // kính theo đầu (nghiêng, nảy) chứ không theo hướng nhìn, hai tròng ôm hai mắt
    g.save(); g.translate(492, 262); g.rotate(T.tilt * D2R);
    var gw = 384 * this.pz.gapK / 0.432; put(imgs[0], 0, 6, 0, gw / imgs[0].ar, 0.5, 0.5); g.restore();
  }
};
// nền họa tiết: base là màu nền, p là mã họa tiết, c là màu họa tiết, a là độ đậm (rất mờ)
Face.prototype.setBg = function (b) {
  // họa tiết luôn đậm 13% (mức rõ nhất vẫn để chữ trắng dễ đọc); màu họa tiết chọn sẵn hoặc 'face' là theo màu mặt Uni (đổi màu mặt thì đổi theo)
  b = b || {}; this.bgSpec = b; this.bgBase = /^#[0-9a-f]{6}$/i.test(b.base || '') ? b.base : '#000';
  var P = window.UniDecor && window.UniDecor.PATTERNS, it = P && P[b.p], self = this;
  this.bgAlpha = it ? 0.13 : 0; this.bgPat = null;
  // ảnh nền (img: đường dẫn cùng trang): phủ kín màn kiểu cover, tối bớt theo dim để chữ và mặt nổi lên, họa tiết vẽ đè trên ảnh
  var src = typeof b.img === 'string' && /^\/[\w\/.-]+$/.test(b.img) ? b.img : null;
  if (!src) this.bgImg = null;
  else if (!this.bgImg || this.bgImgSrc !== src) { this.bgImg = null; this.bgImgSrc = src; var bi = new Image(); bi.onload = function () { if (self.bgImgSrc === src) { self.bgImg = bi; self.bakeBg(); } }; bi.src = src; }
  this.bgDim = clamp(+b.dim || 0, 0, 0.95); this.bakeBg();
  if (!it) return;
  var img = new Image(), c = b.c === 'face' ? (this.color || FACE_RED) : /^#[0-9a-f]{6}$/i.test(b.c || '') ? b.c : '#ffffff';
  img.onload = function () { self.bgPat = self.g.createPattern(img, 'repeat'); if (self.bgPat.setTransform) self.bgPat.setTransform(new DOMMatrix().scale(1.6)); self.bakeBg(); };
  img.src = 'data:image/svg+xml,' + encodeURIComponent(it.svg.split('#C0FFEE').join(c));
};
// nền và họa tiết vẽ sẵn một lần vào ảnh riêng, mỗi khung chỉ chép lại (đỡ tô lặp họa tiết khắp màn mỗi khung)
Face.prototype.bakeBg = function () {
  if (!this.bc) { this.bc = document.createElement('canvas'); this.bc.width = this.cv.width; this.bc.height = this.cv.height; this.bcg = this.bc.getContext('2d'); }
  var main = this.g; this.g = this.bcg;
  this.g.setTransform(this.ss, 0, 0, this.ss, 0, 0); this.g.fillStyle = this.bgBase || '#000'; this.g.fillRect(0, 0, 1078, 480);
  var im = this.bgImg;
  if (im && im.naturalWidth) {
    var k = Math.max(1078 / im.naturalWidth, 480 / im.naturalHeight), iw = im.naturalWidth * k, ih = im.naturalHeight * k;
    this.g.drawImage(im, (1078 - iw) / 2, (480 - ih) / 2, iw, ih);
    if (this.bgDim) { this.g.fillStyle = 'rgba(0,0,0,' + this.bgDim + ')'; this.g.fillRect(0, 0, 1078, 480); }
  }
  this.drawPattern(this.bgAlpha || 0); this.g = main;
};
Face.prototype.drawPattern = function (a) {
  if (!a || !this.bgPat) return;
  var g = this.g; g.save(); g.globalAlpha = a; g.fillStyle = this.bgPat; g.fillRect(0, 0, 1078, 480); g.restore();
};
Face.prototype.setColor = function (hex, instant) {
  if (!hex || hex === (this.color || FACE_RED)) return;
  var self = this; if (this.bgSpec && this.bgSpec.c === 'face') setTimeout(function () { self.setBg(self.bgSpec); }, 0);   // họa tiết theo màu mặt: vẽ lại với màu mới
  if (instant) { this.color = hex; this.cT = undefined; return; }   // lúc khởi động: đặt luôn, không loang
  this.oldColor = this.cT !== undefined && this.cT < 0.5 ? this.oldColor : (this.color || FACE_RED);
  this.color = hex; this.cT = 0;
};
Face.prototype.draw = function (o, T) {
  var g = this.g;
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1;
  if (this.bc && (this.bgAlpha || this.bgImg)) g.drawImage(this.bc, 0, 0); else { g.fillStyle = this.bgBase || '#000'; g.fillRect(0, 0, this.cv.width, this.cv.height); }
  g.setTransform(this.ss, 0, 0, this.ss, 0, 0);
  // mặt thu nhỏ: vẽ confetti, mặt và phụ kiện lên một lớp riêng rồi khoét các ô chữ, để Uni luôn nằm dưới thông tin, không đè lên chữ;
  // nền họa tiết vẽ trên lớp chính nên luôn ở sâu nhất
  // chỉ dùng lớp riêng khi có ô chữ chạm vào vùng mặt và phụ kiện (lấy theo khung trước), hoặc đang có confetti
  var orc = T.sm > 0.5 || (T.hk || 0) > 0.5 ? this.occlRects() : null, main = g;
  if (orc) {
    var hasParts = this.parts.some(function (p) { return p.back; });
    if (!hasParts) {
      var bx0 = (this.fcx || 0) - (this.fcr || 0) - 60, bx1 = (this.fcx || 0) + (this.fcr || 0) + 60, by0 = (this.fcy || 0) - (this.fcr || 0) - 110;
      orc = orc.filter(function (r) { return r[0] < bx1 && r[0] + r[2] > bx0 && r[1] + r[3] > by0; });
      if (!orc.length) orc = null;
    }
  }
  if (orc) {
    if (!this.lc) { this.lc = document.createElement('canvas'); this.lc.width = this.cv.width; this.lc.height = this.cv.height; this.lg = this.lc.getContext('2d'); }
    g = this.g = this.lg; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, this.lc.width, this.lc.height); g.setTransform(this.ss, 0, 0, this.ss, 0, 0);
  }
  this.drawParts(true);
  g.save();
  g.translate(T.px, T.py); g.scale(T.L, T.L); g.translate(-492 + T.fx, -262 + T.fy);
  if (T.sqx !== 1 || T.sqy !== 1) { g.translate(T.ccx, T.ccy); g.scale(T.sqx, T.sqy); g.translate(-T.ccx, -T.ccy); }   // co giãn khi nảy
  var px = null;
  this.baseM = null;
  if (this.fpix) {   // mặt pixel: vẽ vào tấm ảnh nhỏ, mỗi điểm ảnh một ô (xem setFacePixel)
    var M = g.getTransform(), cw = this.R * 0.2 * Math.hypot(M.a, M.b), ch = this.R * 0.2 * Math.hypot(M.c, M.d);
    var org = M.transformPoint(new DOMPoint(T.ccx, T.ccy)), ox0 = org.x - Math.ceil(org.x / cw) * cw, oy0 = org.y - Math.ceil(org.y / ch) * ch;
    var W = this.cv.width, H = this.cv.height, nx = Math.ceil((W - ox0) / cw) + 1, ny = Math.ceil((H - oy0) / ch) + 1;
    if (!this.lo) { this.lo = document.createElement('canvas'); this.lox = this.lo.getContext('2d', { willReadFrequently: true }); this.pc = document.createElement('canvas'); this.pcx = this.pc.getContext('2d'); }
    if (this.lo.width !== nx || this.lo.height !== ny) { this.lo.width = nx; this.lo.height = ny; } else { this.lox.setTransform(1, 0, 0, 1, 0, 0); this.lox.clearRect(0, 0, nx, ny); }
    var base = new DOMMatrix().scale(1 / cw, 1 / ch).translate(-ox0, -oy0);   // điểm ảnh thật -> ô
    this.baseM = base.multiply(new DOMMatrix([this.ss, 0, 0, this.ss, 0, 0]));
    this.lox.setTransform(base.multiply(M));
    px = { g: g, ox0: ox0, oy0: oy0, cw: cw, ch: ch, nx: nx, ny: ny, W: W, H: H };
    g = this.g = this.lox;
  }
  var paths = [0, 1].map(function (sd) {
    var ep = this.eyes[sd], open = (1 - clamp((ep.bA - 0.2) / 0.5, 0, 1)) * (1 - Math.min(1, ep.line));
    return new Path2D(this.eyePath(ep, this.gk[sd] > 0.5 ? 0 : o.blink * open, sd, 1 - this.gk[sd]));
  }, this);
  var fc = mixHex(this.color || FACE_RED, '#000000', T.dim);
  var spread = this.cT !== undefined && this.cT < 1 ? ease(this.cT) : 1;
  // bước thời gian bị chặn trên (khung đầu sau lệnh đổi màu thường dài vì vừa dựng lại ảnh) để vệt loang không nhảy cóc
  if (this.cT !== undefined && this.cT < 1) this.cT = Math.min(1, this.cT + Math.min(this.lastDt || 0.016, 1 / 30) / CSPAN);
  if (this.shPrev && this.shT < 1) { this.shT = Math.min(1, this.shT + Math.min(this.lastDt || 0.016, 1 / 30) / CSPAN); if (this.shT >= 1) this.shPrev = this.shPrevK = null; }   // biến dáng cùng nhịp với loang màu
  this.spread = spread;
  var fcOld = spread < 1 ? mixHex(this.oldColor || FACE_RED, '#000000', T.dim) : fc;
  var bk2 = this.bk = this.botK();
  if (bk2 > 0) {
    /* người máy trùm mũ: mặt xám kim loại, mắt và miệng đen; vành trong của mũ quanh lỗ đậm hơn màu mũ, vạt mũ đổ bóng sâu xuống mặt */
    var face = mixHex(BOT.steel, '#000000', T.dim), ink = mixHex(face, '#000000', 0.86);
    this.bCol = { steel: face, eye: ink, mouth: ink, grille: mixHex(face, '#000000', 0.62), panel: mixHex(face, '#000000', 0.42), shadow: mixHex(face, '#000000', 0.42), rim: mixHex(fc, '#000000', 0.38) };
  }
  // nhớ vị trí và độ sáng của mặt để vẽ hiệu ứng tương phản khi mặt màu sáng
  this.fcx = T.px + (T.ccx - 492 + T.fx) * T.L; this.fcy = T.py + (T.ccy - 262 + T.fy) * T.L; this.fcr = T.cr * T.L;
  // điểm neo cho bong bóng lời nhắn: mặt to thì phía trên bên phải mắt phải, mặt nhỏ thì mép vòm phía phải (58°); đi theo mặt khi nảy, xê dịch
  var ba = 58 * D2R, bk = this.rimK(ba), bx = 492 + 330 + (T.ccx + T.cr * bk * Math.sin(ba) - 492 - 330) * T.sm, by = 262 - 140 + (T.ccy - T.cr * bk * Math.cos(ba) - 262 + 140) * T.sm;   // lệch hẳn sang phải mặt
  this.bubA = [T.px + (bx - 492 + T.fx) * T.L, T.py + (by - 262 + T.fy) * T.L]; this.fLight = luma(fc) > 0.6;
  var dec = this.decor || {}, DD = window.UniDecor && window.UniDecor.DECOR, hm = (dec.hair && DD && DD[dec.hair] && DD[dec.hair].m) || {}, hairBack = hm.back, hairOver = hm.over;
  // mũ trùm (m.over): mặt nhỏ thì trùm lên vòm mặt, nằm dưới mặt nạ; mặt to (có phụ kiện đầu nên mắt sát đỉnh vòm) thì lui ra sau vòm để khỏi che mắt, hòa dần khi đổi cỡ
  var ow = hairOver ? clamp(1 - (this.hk || 0) * (1 - T.sm), 0, 1) : 0, ga0 = g.globalAlpha;
  var hTint = (hairBack || hairOver) && this.tintDecor('hair'), self = this, hair = function () { if (hTint) self.drawTinted('hair', T); else self.drawDecor('hair', T); };   // mũ trùm nhuộm theo màu chọn
  if (dec.ears) {   // tai mọc sau vòm mặt, cùng tông màu mặt nên tối dần theo mặt khi ngủ
    this.tintDecor('ears');
    if (T.dim > 0.02) g.filter = 'brightness(' + (1 - T.dim).toFixed(3) + ')';
    this.drawTinted('ears', T); g.filter = 'none';
  }
  var dimF = T.dim > 0.02 ? 'brightness(' + (1 - T.dim).toFixed(3) + ')' : 'none';   // mọi phụ kiện tối dần cùng mặt khi ngủ
  if (hairBack) { g.filter = dimF; hair(); g.filter = 'none'; }   // sừng, mũ cắm sau vòm mặt
  if (hairOver && ow < 0.99) { g.filter = dimF; g.globalAlpha = ga0 * (1 - ow); hair(); g.globalAlpha = ga0; g.filter = 'none'; }
  g.fillStyle = fcOld; this.facePath(T); g.fill();
  g.save(); this.facePath(T); g.clip();
  if (spread < 1) {   // vòng màu mới lan từ góc dưới trái ra, mép hơi mềm
    g.save(); if (this.baseM) g.setTransform(this.baseM); else g.setTransform(this.ss, 0, 0, this.ss, 0, 0);
    // mép loang là một dải chuyển màu rộng (khoảng 40% bán kính) từ màu mới sang trong suốt
    // bán kính tính theo điểm xa nhất của mặt (cả lúc mặt thu nhỏ ở góc), để vệt loang đi hết thời gian trên chính khuôn mặt, không chạy vụt qua phần trống
    var far = Math.hypot(this.fcx + this.fcr * 1.3, 480 - this.fcy + this.fcr * 1.3), R = far / 0.6 * spread, n = parseInt(fc.slice(1), 16), rgb = (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255);
    var gr = g.createRadialGradient(0, 480, 0, 0, 480, Math.max(1, R));
    gr.addColorStop(0, 'rgba(' + rgb + ',1)'); gr.addColorStop(0.6, 'rgba(' + rgb + ',1)'); gr.addColorStop(1, 'rgba(' + rgb + ',0)');
    g.fillStyle = gr; g.fillRect(0, 0, 1078, 480);
    g.restore();
  } else { g.fillStyle = fc; }
  var eyeOf = function (c) { return mixHex('#000000', c ? mixHex(c, '#000000', 0.5) : EYE_SLEEP, T.dim); };
  var eyeCol = spread < 1 ? mixHex(eyeOf(this.oldColor), eyeOf(this.color), spread) : eyeOf(this.color);
  if (bk2 > 0) eyeCol = mixHex(eyeCol, this.bCol.eye, bk2);   // người máy: mắt đen
  if (px) px.pal = [fc, fcOld, eyeCol].concat(bk2 > 0 ? [this.bCol.steel, this.bCol.eye, this.bCol.grille, this.bCol.panel, this.bCol.shadow, this.bCol.rim] : []);
  this.drawEyes(o, T, paths, eyeCol);
  g.restore();
  if (hairOver && ow > 0.01) { g.filter = dimF; g.globalAlpha = ga0 * ow; hair(); g.globalAlpha = ga0; g.filter = 'none'; }
  if (dec.eyes) { g.filter = dimF; this.drawDecor('eyes', T); g.filter = 'none'; }   // kính vẽ sau khi bỏ khung cắt của mặt nên được lòi ra ngoài vòm mặt
  if (dec.hair && !hairBack && !hairOver) {   // món nhuộm theo màu mặt (sừng Unikorn) cũng tối dần theo mặt khi ngủ
    var ht = this.tintDecor('hair');
    g.filter = dimF;
    if (ht) this.drawTinted('hair', T); else this.drawDecor('hair', T); g.filter = 'none';
  }
  if (px) this.pixSnap(px, fc, fcOld, T.dim);
  if (px) {   // phóng tấm ảnh nhỏ lên đúng lưới, không làm mịn, cắt khe giữa các ô rồi dán vào lớp mặt
    var P = this.pc, pg = this.pcx, gp = Math.max(1, px.cw * 0.12);
    if (P.width !== px.W || P.height !== px.H) { P.width = px.W; P.height = px.H; } else { pg.setTransform(1, 0, 0, 1, 0, 0); pg.clearRect(0, 0, px.W, px.H); }
    pg.globalCompositeOperation = 'source-over'; pg.imageSmoothingEnabled = false;
    pg.drawImage(this.lo, px.ox0, px.oy0, px.nx * px.cw, px.ny * px.ch);
    pg.globalCompositeOperation = 'destination-out'; pg.beginPath();
    for (var gi = 0; gi <= px.nx; gi++) pg.rect(px.ox0 + gi * px.cw - gp / 2, 0, gp, px.H);
    for (var gj = 0; gj <= px.ny; gj++) pg.rect(0, px.oy0 + gj * px.ch - gp / 2, px.W, gp);
    pg.fill(); pg.globalCompositeOperation = 'source-over';
    g = this.g = px.g;
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(P, 0, 0); g.restore();
  }
  g.restore();
  if (orc) {
    // chữ nằm trên Uni: không khoét thành mảng màu nền đặc mà là một bóng đổ mờ, mép loang ngắn. Vẽ hình chữ nhật ra ngoài màn
    // và chỉ lấy bóng của nó dời về đúng chỗ, xóa bớt lớp mặt theo độ đậm của bóng (destination-out), nên dưới chữ mặt chỉ tối đi chứ không mất hẳn
    var ss = this.ss, far = 4000;
    g.save(); g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000';
    g.shadowColor = 'rgba(0,0,0,0.72)'; g.shadowBlur = 14 * ss; g.shadowOffsetX = far * ss;
    orc.forEach(function (r) { g.fillRect(r[0] + 5 - far, r[1] + 5, Math.max(1, r[2] - 10), Math.max(1, r[3] - 10)); });
    g.restore();
    g = this.g = main; g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(this.lc, 0, 0); g.setTransform(this.ss, 0, 0, this.ss, 0, 0);
  }
  this.drawParts(false);
  var S = this.sc;
  if (S.op > 0.01 && S.q) {
    g.save(); g.globalAlpha = S.op;
    // khung hình từ camera trước: khách nhìn thấy mã của mình đã nằm gọn trong khung chưa
    g.save(); rrPath(g, 551, 48, 416, 416, 30); g.clip();
    g.fillStyle = '#2a2623'; g.fillRect(551, 48, 416, 416);
    if (this.feed) {
      // mã không đọc được: hình mờ và tối, đúng lý do khiến Uni không đọc được
      if (this.scan === 'bad') g.filter = 'blur(3px) brightness(0.6)';
      g.drawImage(this.feed, 551, 48, 416, 416); g.filter = 'none';
      // phủ tối phần ngoài khung nhận diện để khách tập trung vào ô cần đưa mã vào
      g.beginPath(); g.rect(551, 48, 416, 416); g.rect(S.x + S.shake + S.s, S.y, -S.s, S.s);
      g.fillStyle = 'rgba(0,0,0,0.42)'; g.fill('evenodd');
    } else if (S.qo > 0.01) { g.save(); g.globalAlpha = S.op * S.qo; g.translate(S.q.x - S.q.s / 2, S.q.y - S.q.s / 2); g.scale(S.q.s / 25, S.q.s / 25); g.fillStyle = '#f3f1ec'; g.fill(this.qr); g.restore(); }
    g.restore();
    var bx = S.x + S.shake, by = S.y, bw = S.s, cl = clamp(bw * 0.2, 18, 72);
    g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath();
    g.moveTo(bx, by + cl); g.lineTo(bx, by); g.lineTo(bx + cl, by);
    g.moveTo(bx + bw - cl, by); g.lineTo(bx + bw, by); g.lineTo(bx + bw, by + cl);
    g.moveTo(bx + bw, by + bw - cl); g.lineTo(bx + bw, by + bw); g.lineTo(bx + bw - cl, by + bw);
    g.moveTo(bx + cl, by + bw); g.lineTo(bx, by + bw); g.lineTo(bx, by + bw - cl);
    // viền tối bên dưới để góc khung vẫn rõ khi nằm trên màn hình trắng của điện thoại khách
    g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = S.lw + 5; g.stroke();
    g.strokeStyle = '#ffffff'; g.lineWidth = S.lw; g.stroke();
    if (S.bo > 0.01) { g.globalAlpha = S.op * S.bo; g.lineWidth = 3; g.beginPath(); g.moveTo(bx + 18, S.barY); g.lineTo(bx + bw - 18, S.barY); g.stroke(); }
    g.globalAlpha = S.op; g.textBaseline = 'alphabetic';
    g.font = '700 20px ' + MONO; g.fillStyle = '#a8a199'; g.fillText('UNI', 563, 40);
    g.font = '600 22px ' + MONO; g.fillStyle = '#ffffff'; g.fillText(S.cap, 625, 40);
    g.restore();
  }
  if (this.text) {
    g.save(); g.globalAlpha = clamp((1 - this.L) / 0.45, 0, 1); g.textBaseline = 'top';
    g.font = '600 38px ' + MONO;
    if (!this.lines) this.lines = wrapText(g, this.text, 598);
    var lh = 49, total = 40 + this.lines.length * lh, y = (480 - total) / 2;
    g.font = '700 20px ' + MONO; g.fillStyle = '#a8a199'; g.fillText('UNI', 440, y);
    g.font = '600 38px ' + MONO; g.fillStyle = '#ffffff';
    var left = this.typed, yy = y + 40, lastX = 440, lastY = yy;
    for (var li = 0; li < this.lines.length && left > 0; li++) {
      var str = this.lines[li].slice(0, left); g.fillText(str, 440, yy);
      lastX = 440 + g.measureText(str).width; lastY = yy; left -= this.lines[li].length; yy += lh;
    }
    if (this.typed < this.text.length) { g.fillRect(lastX + 4, lastY + 4, 20, 36); }
    g.restore();
  }
};


window.UniFace = { Face: Face, EXD: EXD, BOT_HOOD: BOT_HOOD, BOT_HOLE: BOT_HOLE };   // đường mũ, lỗ mũ người máy: trang điều khiển vẽ ô xem trước theo cùng hình
})();
