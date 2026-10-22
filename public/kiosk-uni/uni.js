/* Kiosk linh vật Uni (MarvelVN). Cần nạp trước: decor.js, hero-decor.js, face.js.
   window.UniApp.mount(root, host) dựng màn kiosk 915 × 412 (và bảng điều khiển nếu host.mode === 'control') bên trong root,
   trả về { destroy, command }. Mọi việc chạm tới máy chủ, camera, thoát kiosk do host (React) lo. */
(function () {
'use strict';

/* Biểu tượng: Lucide (lucide.dev, giấy phép ISC), nét 2px, không dùng emoji */
var IC = {
  tap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 14a8 8 0 0 1-8 8"/><path d="M18 11v-1a2 2 0 0 0-2-2a2 2 0 0 0-2 2"/><path d="M14 10V9a2 2 0 0 0-2-2a2 2 0 0 0-2 2v1"/><path d="M10 9.5V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v10"/><path d="M18 11a2 2 0 1 1 4 0v3a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></svg>',   // Lucide pointer: ngón tay chạm
  qr: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="5" height="5" x="3" y="3" rx="1"/><rect width="5" height="5" x="16" y="3" rx="1"/><rect width="5" height="5" x="3" y="16" rx="1"/><path d="M21 16h-3a2 2 0 0 0-2 2v3"/><path d="M21 21v.01"/><path d="M12 7v3a2 2 0 0 1-2 2H7"/><path d="M3 12h.01"/><path d="M12 3h.01"/><path d="M12 16v.01"/><path d="M16 12h1"/><path d="M21 12v.01"/><path d="M12 21v-1"/></svg>',
  cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 2v3"/><path d="M16 2v3"/><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/></svg>',
  map: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z"/><path d="M15 5.764v15"/><path d="M9 3.236v15"/></svg>',
  help: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>',
  chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z"/></svg>',
  flip: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 19H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5"/><path d="M13 5h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-5"/><circle cx="12" cy="12" r="3"/><path d="m18 22-3-3 3-3"/><path d="m6 2 3 3-3 3"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>',
  right: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>',
  left: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>',
  del: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 5a2 2 0 0 0-1.344.519l-6.328 5.74a1 1 0 0 0 0 1.481l6.328 5.741A2 2 0 0 0 10 19h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z"/><path d="m12 9 6 6"/><path d="m18 9-6 6"/></svg>'
};
function svg(inner) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + inner + '</svg>'; }
var LI = {
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  armchair: '<path d="M19 9V6a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v3"/><path d="M3 16a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5a2 2 0 0 0-4 0v1.5a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5V11a2 2 0 0 0-4 0z"/><path d="M5 18v2"/><path d="M19 18v2"/>',
  ticket: '<path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2"/><path d="M13 17v2"/><path d="M13 11v2"/>',
  popcorn: '<path d="M18 8a2 2 0 0 0 0-4 2 2 0 0 0-4 0 2 2 0 0 0-4 0 2 2 0 0 0-4 0 2 2 0 0 0 0 4"/><path d="M10 22 9 8"/><path d="m14 22 1-14"/><path d="M20 8c.5 0 .9.4.8 1l-2.6 12c-.1.5-.7 1-1.2 1H7c-.6 0-1.1-.4-1.2-1L3.2 9c-.1-.6.3-1 .8-1Z"/>',
  shirt: '<path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"/>',
  'file-search': '<path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M4.268 21a2 2 0 0 0 1.727 1H18a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v3"/><path d="m9 18-1.5-1.5"/><circle cx="5" cy="14" r="3"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  frown: '<circle cx="12" cy="12" r="10"/><path d="M16 16s-1.5-2-4-2-4 2-4 2"/><path d="M9 9h.01"/><path d="M15 9h.01"/>',
  camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
  'calendar-x': '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="m14 14-4 4"/><path d="m10 14 4 4"/>',
  wallet: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.74"/>',
  'wifi-off': '<path d="M12 20h.01"/><path d="M8.5 16.429a5 5 0 0 1 7 0"/><path d="M5 12.859a10 10 0 0 1 5.17-2.69"/><path d="M19 12.859a10 10 0 0 0-2.007-1.523"/><path d="M2 8.82a15 15 0 0 1 4.177-2.643"/><path d="M22 8.82a15 15 0 0 0-11.288-3.764"/><path d="m2 2 20 20"/>'
};
/* Logo "ĐA VŨ TRỤ / MARVEL VN" giống src/components/logo.tsx: màu và font lấy từ theme của app */
var LOGO = '<svg class="mlogo" viewBox="0 0 300 150" role="img" aria-label="Đa Vũ Trụ Marvel VN">' +
  '<rect width="300" height="52" style="fill:var(--card,#141a16);stroke:#fff;stroke-width:2"/>' +
  '<rect y="52" width="300" height="98" style="fill:var(--primary,#3fbf6a)"/>' +
  '<path d="M0 52V150H300V52" fill="none" style="stroke:#fff;stroke-width:2"/>' +
  '<text x="150" y="36" text-anchor="middle" textLength="272" lengthAdjust="spacingAndGlyphs" font-size="32" letter-spacing="1" style="fill:var(--card-foreground,#fff);font-family:var(--font-logo),sans-serif">ĐA VŨ TRỤ</text>' +
  '<text x="150" y="135" text-anchor="middle" textLength="265" lengthAdjust="spacingAndGlyphs" font-size="102" style="fill:var(--primary-foreground,#000);font-family:var(--font-marvel),sans-serif">MARVEL VN</text></svg>';

function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function now() { return performance.now() / 1000; }
function hhmm(v) { return new Date(v).toTimeString().slice(0, 5); }
function mins(t) { var p = String(t).split(':'); return +p[0] * 60 + +p[1]; }
function normPhone(p) { p = String(p || '').replace(/\D/g, ''); return p.indexOf('84') === 0 && p.length > 10 ? '0' + p.slice(2) : p; }
function fmtPhone(d) { return d.replace(/^(\d{4})(\d{0,3})(\d{0,4}).*/, function (m, a, b, c) { return [a, b, c].filter(Boolean).join(' '); }); }
function phoneFull(d) { return /^0\d{9}$/.test(normPhone(d)); }
var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* ---------- dữ liệu bảng điều khiển ---------- */
var EXL = { neutral: 'Bình thường', listening: 'Lắng nghe', curious: 'Tò mò', happy: 'Vui', excited: 'Phấn khích', star: 'Mắt sao', surprised: 'Ngạc nhiên', wink: 'Nháy mắt', sad: 'Buồn', worried: 'Lo lắng', confused: 'Bối rối', thinking: 'Suy nghĩ', focused: 'Tập trung', bored: 'Chán', sleepy: 'Buồn ngủ', sleep: 'Ngủ', cheer: 'Cổ vũ', cheerStar: 'Cổ vũ (sao)', cheerHeart: 'Cổ vũ (tim)', evil: 'Tinh quái', calm: 'Bình thản' };
var COLORS = [['#ef5350', 'Đỏ'], ['#ff8a3d', 'Cam'], ['#ffc53d', 'Vàng'], ['#4cc77f', 'Xanh lá'], ['#2ec4c4', 'Xanh ngọc'], ['#4c8dff', 'Xanh dương'], ['#9b6bff', 'Tím'], ['#ff6fa8', 'Hồng'], ['#fffdf7', 'Trắng']];
var BASES = [['#000000', 'Đen'], ['#0b1222', 'Xanh đêm'], ['#160f24', 'Tím đêm'], ['#0d1a14', 'Rêu đêm'], ['#1c1010', 'Nâu đêm']];
var PCOLS = [['#ffffff', 'Trắng'], ['#ffd666', 'Vàng'], ['#ff8fc8', 'Hồng'], ['#7cc7ff', 'Xanh'], ['#b79cff', 'Tím'], ['#86e0a8', 'Xanh lá']];
var SHAPES = [['round', 'Tròn'], ['squircle', 'Bo vuông'], ['wide', 'Bầu dục'], ['cloud', 'Mây'], ['jelly', 'Thạch'], ['bot', 'Doombot']];
var EYES = [['soft', 'Tròn'], ['rect', 'Vuông bo'], ['anime', 'Anime'], ['devil', 'Quỷ']];
var SLOTS = [['ears', 'Tai, sừng'], ['hair', 'Trên đầu'], ['eyes', 'Mắt']];
var LOOKS = [
  ['Spider-Man', { color: '#e23636', shape: 'round', eyeStyle: 'anime', pixel: false, decor: { eyes: 'spidermask' }, bg: { base: '#0b1222', p: 'spiderweb', c: '#ffffff' } }],
  ['Captain America', { color: '#2f5fd0', shape: 'round', eyeStyle: 'soft', pixel: false, decor: { ears: 'capwing', hair: 'capstar' }, bg: { base: '#0b1222', p: 'stars5', c: '#ff6b6b' } }],
  ['Iron Man', { color: '#f2b630', shape: 'squircle', eyeStyle: 'rect', pixel: false, decor: { eyes: 'ironplate' }, bg: { base: '#1c1010', p: 'floatingCogs', c: '#ff6b6b' } }],
  ['Thor', { color: '#7d97b8', shape: 'round', eyeStyle: 'soft', pixel: false, decor: { ears: 'thorwing' }, bg: { base: '#0b1222', p: 'bolts', c: '#7cc7ff' } }],
  ['Hulk', { color: '#4cc77f', shape: 'wide', eyeStyle: 'rect', pixel: false, decor: { hair: 'hulkhair' }, bg: { base: '#160f24', p: 'jigsaw', c: '#b79cff' } }],
  ['Black Panther', { color: '#6c4ee0', shape: 'squircle', eyeStyle: 'anime', pixel: false, decor: { ears: 'cat' }, bg: { base: '#160f24', p: 'hexagons', c: '#b79cff' } }],
  ['Doctor Strange', { color: '#ff8a3d', shape: 'round', eyeStyle: 'soft', pixel: false, decor: { hair: 'agamotto' }, bg: { base: '#1c1010', p: 'overlappingCircles', c: '#ffd666' } }],
  ['Deadpool', { color: '#a61c1c', shape: 'round', eyeStyle: 'soft', pixel: false, decor: { eyes: 'dpmask' }, bg: { base: '#1c1010', p: 'polkaDots', c: '#ff6b6b' } }],
  ['Doombot', { color: '#12b552', theme: '#12b552', shape: 'bot', eyeStyle: 'soft', pixel: false, decor: {}, bg: { base: '#160f24', p: 'topography', c: '#7cc7ff', img: '/kiosk-uni/bg/doom-green.jpg', dim: 0.25 } }],
  ['Doctor Doom', { color: '#9aa4ae', shape: 'squircle', eyeStyle: 'devil', pixel: false, decor: { eyes: 'doomplate', hair: 'doomhood' }, bg: { base: '#0d1a14', p: 'hexagons', c: '#86e0a8' } }]
];
var SCREENS = [['sleep', 'Ngủ (chờ khách)'], ['hello', 'Thấy khách'], ['home', 'Màn chính'], ['scan', 'Quét vé'], ['lookup', 'Nhập số điện thoại'], ['agenda', 'Lịch trình'], ['info', 'Sơ đồ'], ['chat', 'Hỏi đáp']];
var GO_OK = SCREENS.map(function (s) { return s[0]; });
var SCENES = [['ok', 'Check-in xong'], ['confirm', 'Xác nhận số điện thoại'], ['used', 'Vé đã dùng'], ['notfound', 'Vé không tồn tại'], ['wrong', 'Mã không hợp lệ'], ['event', 'Sai suất chiếu'], ['unpaid', 'Chưa thanh toán'], ['slow', 'Chưa đọc được mã'], ['offline', 'Mất kết nối']];
/* Mỗi lỗi một icon Lucide lớn và một màu nhấn */
var PROB = {
  used: ['clock', '#ffd666', 'Vé đã được sử dụng'],
  notfound: ['file-search', '#ff8f8f', 'Vé không tồn tại', 'Thử nhập số điện thoại đã đăng ký.'],
  wrong: ['frown', '#ff8f8f', 'Mã không hợp lệ', 'Đây không phải mã vé MarvelVN.'],
  slow: ['camera', '#93bcff', 'Chưa đọc được mã', 'Thử nhập số điện thoại đã đăng ký.'],
  event: ['calendar-x', '#ffd666', 'Vé của suất chiếu khác', 'Vé này không dùng cho suất chiếu hôm nay.'],
  unpaid: ['wallet', '#ffd666', 'Đơn chưa thanh toán', 'Bạn hoàn tất thanh toán rồi check-in lại nhé.'],
  noticket: ['ticket', '#ff8f8f', 'Đơn không có vé xem phim', 'Đơn của bạn chỉ có combo hoặc áo.'],
  ambiguous: ['users', '#93bcff', 'Cần nhân viên hỗ trợ', 'Số điện thoại này gắn với nhiều tài khoản.'],
  offline: ['wifi-off', '#93bcff', 'Chưa kết nối được', 'Kiosk đang mất kết nối, bạn thử lại sau ít phút.'],
  forbidden: ['users', '#93bcff', 'Đang ở chế độ xem thử', 'Check-in chỉ chạy trên máy kiosk của nhân viên tại rạp.']
};
var ERR = { NOT_FOUND: 'notfound', NOT_PAID: 'unpaid', WRONG_EVENT: 'event', NO_TICKET: 'noticket', AMBIGUOUS: 'ambiguous', FORBIDDEN: 'forbidden' };
var DEMO_GUEST = { userName: 'Khách thử', tickets: 2, seats: ['F7', 'F8'], seatsPending: false, combos: ['Combo bắp nước × 1'], shirts: '', alreadyCheckedIn: false, checkedInAt: null, justCheckedIn: true };
var TICKET_COL = { fg: '#1a1200', bg: '#ffc53d' };
var IDLE_MOODS = ['happy', 'confused', 'curious'];
var DEFAULT_LOOK = LOOKS.filter(function (x) { return x[0] === 'Doombot'; })[0][1];

function uri(s) { return 'data:image/svg+xml,' + encodeURIComponent(s); }
function mix(a, b, k) { var x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16); return '#' + [16, 8, 0].map(function (s) { return ('0' + Math.round((x >> s & 255) * (1 - k) + (y >> s & 255) * k).toString(16)).slice(-2); }).join(''); }
function tint(it, s, col) { return (it.m && it.m.tint || []).reduce(function (a, k, i) { return a.split('TINT' + i).join(k < 0 ? mix(col, '#000000', -k) : mix(col, '#ffffff', k)); }, s); }
function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
function clone(o) { return JSON.parse(JSON.stringify(o)); }

function mount(root, host) {
  var MODE = host.mode === 'control' ? 'control' : 'kiosk';
  var EV = host.ev, HELP = EV.help || 'Nếu cần hỗ trợ, bạn liên hệ quầy hỗ trợ nhé.', BACK = EV.backSec || 8;
  var D = UniDecor.DECOR, PAT = UniDecor.PATTERNS;
  var dead = false, timers = [], offs = [];
  function later(fn, ms) { var id = setTimeout(function () { timers.splice(timers.indexOf(id), 1); if (!dead) fn(); }, ms); timers.push(id); return id; }
  function on(el, n, fn, o) { el.addEventListener(n, fn, o); offs.push(function () { el.removeEventListener(n, fn, o); }); }

  root.classList.add('uni-root'); root.dataset.mode = MODE;
  root.innerHTML = '<div class="wrap"><div class="device"><div class="screen" id="screen"><div id="stage">' +
    '<div class="cam" id="cam"><div class="frame"><i></i><i></i><i></i><i></i></div><div class="nocam" id="nocam"></div></div>' +
    '<div class="aside" id="aside" hidden></div><div id="view"></div>' +
    '<div class="bub" id="bub" hidden><span id="bubt"></span><svg class="tail" viewBox="0 0 26 24" aria-hidden="true"><path d="M0 0H15L26 24Z"/></svg><svg class="dots" viewBox="0 0 24 24" shape-rendering="crispEdges" aria-hidden="true"><path d="M6 0H24V6H6ZM6 6H18V12H6ZM0 12H12V18H0ZM0 18H6V24H0Z"/></svg></div>' +
    (MODE === 'kiosk' ? '<div class="hold" id="hold" aria-label="Nhấn giữ 2 giây để thoát kiosk"></div>' : '') +
    '</div></div></div>' + (MODE === 'control' ? ctlHtml() : '') + '</div>';
  var $ = function (s) { return root.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(root.querySelectorAll(s)); };
  var stage = $('#stage'), screen = $('#screen'), view = $('#view'), cam = $('#cam');

  var face = new UniFace.Face();
  face.cv.className = 'face';
  stage.insertBefore(face.cv, stage.firstChild);
  face.setExpr('sleep');
  var S = { screen: '', expr: 'sleep', seq: 0, waitT: 0, auto: true, nextMood: 0, moodEnd: 0, lastPoint: 0, ptr: null, lastTouch: now(), phone: '', busy: false, lastCode: '', lastCodeT: 0, faq: -1, facing: 'user', camOn: false, pin: null };

  /* co giãn sân khấu 915 × 412 theo khung */
  function fit() {
    var w = screen.clientWidth, h = screen.clientHeight, k = MODE === 'kiosk' ? Math.min(w / 915, h / 412) : w / 915;
    stage.style.transform = 'translate(' + ((w - 915 * k) / 2).toFixed(1) + 'px, ' + (MODE === 'kiosk' ? ((h - 412 * k) / 2).toFixed(1) : 0) + 'px) scale(' + k + ')';
    if (host.onLayout) host.onLayout();
  }
  var ro = new ResizeObserver(fit); ro.observe(screen); fit();

  /* ---------- lịch trình ---------- */
  function agendaState() {
    var n = new Date(), m = n.getHours() * 60 + n.getMinutes() + n.getSeconds() / 60, A = EV.agenda;
    for (var i = 0; i < A.length; i++) {
      if (m >= mins(A[i].start) && m < mins(A[i].end)) return { kind: 'now', item: A[i], i: i };
      if (m < mins(A[i].start)) return { kind: 'soon', item: A[i], i: i };
    }
    return { kind: 'done' };
  }
  function nowLine() {
    var a = agendaState(), A = EV.agenda, item = function (x, cur) { return '<div class="it' + (cur ? ' cur' : '') + '"><span class="t">' + x.start + '</span><span class="x">' + esc(x.title) + '</span></div>'; };
    if (a.kind === 'done') return '<div class="it"><span class="x">Chương trình hôm nay đã kết thúc</span></div>';
    var next = A[a.i + 1];
    return item(a.item, a.kind === 'now') + (next ? item(next) : '');
  }
  /* cột trái: tên sự kiện, chủ đề, phiên hiện tại và kế tiếp; check-in xong thì badge "Đã check-in" trượt vào thay */
  function renderAside() {
    var a = $('#aside');
    if (!a.dataset.k) {
      a.dataset.k = '1';
      a.innerHTML = '<div class="ckw"><div class="ckb">' + IC.check + '<span><b>Đã check-in</b><small id="ckt"></small></span></div><div class="ckb tkb" id="tkb"></div></div>' +
        '<div class="evi"><div class="evn">' + esc(EV.name) + '</div><div class="ev">' + esc(EV.theme) + '</div></div><div class="now" id="nowLine"></div>';
    }
    var done = S.screen === 'ok';
    if (a.classList.contains('done') !== done) { a.classList.toggle('done', done); var nl = $('#nowLine'); nl.style.animation = 'none'; void nl.offsetWidth; nl.style.animation = ''; }
    var l = nowLine(); if (a.dataset.line !== l) { a.dataset.line = l; $('#nowLine').innerHTML = l; }
  }

  /* ---------- thành phần dùng chung ---------- */
  function tile(to, cls, ic, t, s) { return '<button class="tile ' + cls + '" data-go="' + to + '"><span class="ic">' + ic + '</span><span><div class="t">' + t + '</div><div class="s">' + s + '</div></span></button>'; }
  function infoNote(t) { return '<div class="inote">' + svg(LI.info) + '<span>' + esc(t) + '</span></div>'; }
  function fieldList(f) {
    f = f.filter(function (x) { return x[1]; });
    return f.length ? '<div class="fields" style="grid-template-rows:repeat(' + Math.min(f.length, 3) + ',auto)">' + f.map(function (x) { return '<div class="f">' + svg(LI[x[0]] || '') + '<span>' + esc(x[1]) + '</span></div>'; }).join('') + '</div>' : '';
  }
  function seatText(seats, pending) { return seats && seats.length ? 'Ghế ' + seats.join(', ') : pending ? 'Chưa chọn đủ ghế' : ''; }
  /* màn nào tự chuyển khi không ai chạm: [số giây, màn tới]; btns() gắn vòng đếm ngược vào nút dẫn tới đúng màn đó */
  function autoNext(s) {
    if (s === 'ok') return [BACK, 'scan'];
    if (s === 'problem') return [Math.max(3, Math.ceil(BACK / 2)), 'scan'];
    if (s === 'lookup' || s === 'confirm') return [60, 'home'];
    if (s === 'agenda' || s === 'info' || s === 'chat') return [25, 'home'];
    return null;
  }
  function ring(sec) { return '<span class="tring"><svg viewBox="0 0 30 30" aria-hidden="true"><circle class="tk" cx="15" cy="15" r="12.5"/><circle class="tp" id="tp" cx="15" cy="15" r="12.5" pathLength="100"/></svg><b id="tn">' + sec + '</b></span>'; }
  function timerTick(t) {
    var tp = $('#tp'), an = autoNext(S.screen); if (!tp || !an) return;
    var left = Math.max(0, an[0] - (t - S.lastTouch)), n = String(Math.ceil(left)), tn = $('#tn');
    tp.style.strokeDashoffset = (-100 * (1 - left / an[0])).toFixed(2);
    if (tn.textContent !== n) tn.textContent = n;
  }
  /* hàng nút: Quay lại đứng đầu, rồi nút chính, rồi nút phụ. b = [[nhãn, thuộc tính, chính?]] */
  function btns(b) {
    var rank = function (x) { return x[0] === 'Quay lại' ? 0 : x[2] ? 1 : 2; };
    var an = autoNext(S.screen), timed = false;
    return '<div class="btns">' + b.slice().sort(function (p, q) { return rank(p) - rank(q); }).map(function (x) {
      var back = x[0] === 'Quay lại', tm = !timed && an && x[1].indexOf('data-go="' + an[1] + '"') >= 0;
      if (tm) timed = true;
      return '<button class="btn' + (x[2] ? ' primary' : '') + (back ? ' back' : '') + (tm ? ' timer' : '') + '" ' + x[1] + '>' + (back ? IC.back : '') + esc(x[0]) + (tm ? ring(an[0]) : '') + '</button>';
    }).join('') + '</div>';
  }
  function bigIcon(name, col) { return '<svg class="iso" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="color:' + col + '">' + (LI[name] || '') + '</svg>'; }
  function notice(o) { return '<div class="content notice" data-anim>' + bigIcon(o.icon, o.col) + '<h2 class="h">' + esc(o.title) + '</h2>' + (o.text ? '<p class="p">' + esc(o.text) + '</p>' : '') + (o.note ? infoNote(o.note) : '') + '</div>' + (o.buttons || ''); }
  function mapSvg() {
    var L = (EV.directions.help.side || 'left') === 'left';
    return '<svg viewBox="0 0 260 190" width="100%" height="210" role="img" aria-label="Sơ đồ khu vực" font-family="Be Vietnam Pro, sans-serif">' +
      '<rect x="' + (L ? 150 : 10) + '" y="16" width="100" height="120" rx="10" fill="#1f1f1f" stroke="#fff" stroke-width="1.5"/><text x="' + (L ? 200 : 60) + '" y="80" fill="#fff" font-size="13" text-anchor="middle">' + esc(EV.directions.hall.name || 'Phòng chiếu') + '</text>' +
      '<rect x="' + (L ? 10 : 180) + '" y="40" width="70" height="56" rx="10" fill="#1f1f1f" stroke="#8f8f8f" stroke-dasharray="4 3"/><text x="' + (L ? 45 : 215) + '" y="72" fill="#fff" font-size="12" text-anchor="middle">' + esc(EV.directions.help.name || 'Quầy hỗ trợ') + '</text>' +
      '<rect x="96" y="150" width="68" height="30" rx="8" fill="#141414" stroke="#2e2e2e"/><text x="130" y="170" fill="#8f8f8f" font-size="11" text-anchor="middle">Lối vào</text><circle cx="130" cy="122" r="7" fill="#fff"/><text x="118" y="126" fill="#fff" font-size="11" text-anchor="end">Bạn ở đây</text></svg>';
  }
  /* Sơ đồ ghế phòng chiếu (EV.seats = SEAT_LAYOUT của app): hàng nhiều khối thì
     khối trái canh phải, các khối sau canh trái cho cột ghế thẳng hàng; hàng 1
     khối (Sweetbox) căn giữa, ghép cặp sát nhau. */
  var SEAT_COL = { normal: '#3fbf6a', vip: '#ef4444', sweetbox: '#f472b6', blocked: '#3a3a3a' };
  function seatSvg() {
    var rows = EV.seats, C = 11, AIS = 12, LBL = 16, widths = [];
    rows.forEach(function (r) { if (r.segments.length > 1) r.segments.forEach(function (g, i) { widths[i] = Math.max(widths[i] || 0, g.length); }); });
    var inner = widths.reduce(function (a, n) { return a + n * C; }, 0) + (widths.length - 1) * AIS;
    var W = inner + LBL * 2, top = 34, y = top, out = '';
    var seat = function (x, yy, st) {
      var t = st.type, num = String(st.code).replace(/^[A-Z]+/, '');
      return '<rect x="' + (x + 1) + '" y="' + (yy + 1) + '" width="' + (C - 2) + '" height="' + (C - 2) + '" rx="2" fill="' + (SEAT_COL[t] || SEAT_COL.normal) + '"' + (t === 'blocked' ? '' : ' fill-opacity=".85"') + '/>' +
        (t === 'blocked' ? '' : '<text x="' + (x + C / 2) + '" y="' + (yy + C / 2 + 2) + '" fill="#000" fill-opacity=".75" font-size="5.6" font-weight="700" text-anchor="middle">' + num + '</text>');
    };
    rows.forEach(function (r) {
      if (r.segments.length === 1) {
        y += 6;
        var g = r.segments[0], pair = g.some(function (x) { return x.type === 'sweetbox'; }), gap = pair ? 3 : 0;
        var w = g.length * C + (pair ? Math.ceil(g.length / 2) - 1 : 0) * gap, x0 = LBL + (inner - w) / 2;
        g.forEach(function (st, i) { out += seat(x0 + i * C + (pair ? Math.floor(i / 2) * gap : 0), y, st); });
      } else {
        var x = LBL;
        r.segments.forEach(function (g, i) {
          var bw = widths[i] * C, off = i === 0 ? bw - g.length * C : 0;
          g.forEach(function (st, k) { out += seat(x + off + k * C, y, st); });
          x += bw + AIS;
        });
      }
      var ly = y + C / 2 + 3.5;
      out += '<text x="' + LBL / 2 + '" y="' + ly + '" fill="#8f8f8f" font-size="9" text-anchor="middle">' + esc(r.label) + '</text><text x="' + (W - LBL / 2) + '" y="' + ly + '" fill="#8f8f8f" font-size="9" text-anchor="middle">' + esc(r.label) + '</text>';
      y += C + 1;
    });
    return '<svg class="seatmap" viewBox="0 0 ' + W + ' ' + (y + 4) + '" role="img" aria-label="Sơ đồ ghế phòng chiếu" font-family="Be Vietnam Pro, sans-serif">' +
      '<path d="M' + (LBL + 10) + ' 14Q' + W / 2 + ' 4 ' + (W - LBL - 10) + ' 14" fill="none" stroke="#8f8f8f" stroke-width="3" stroke-linecap="round"/>' +
      '<text x="' + W / 2 + '" y="26" fill="#8f8f8f" font-size="8" letter-spacing="3" text-anchor="middle">MÀN HÌNH</text>' + out + '</svg>';
  }
  function seatLegend() {
    var has = {}; EV.seats.forEach(function (r) { r.segments.forEach(function (g) { g.forEach(function (x) { has[x.type] = 1; }); }); });
    return '<div class="slegend">' + [['normal', 'Ghế thường'], ['vip', 'Ghế VIP'], ['sweetbox', 'Sweetbox (ghế đôi)']].filter(function (x) { return has[x[0]]; }).map(function (x) {
      return '<span><i style="background:' + SEAT_COL[x[0]] + '"></i>' + x[1] + '</span>';
    }).join('') + '</div>';
  }
  function dirIcon(d) { return '<span class="ar">' + (d.side === 'left' ? IC.left : IC.right) + '</span>'; }

  /* ---------- âm thanh báo kết quả: Web Audio, không cần file ---------- */
  var SND = { ctx: null };
  function sndCtx() {
    if (!SND.ctx) { var A = window.AudioContext || window.webkitAudioContext; if (!A) return null; try { SND.ctx = new A(); } catch (e) { return null; } }
    if (SND.ctx.state === 'suspended') SND.ctx.resume().catch(function () {});
    return SND.ctx;
  }
  function note(ctx, t, f, dur, vol, type) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  function chime(kind) {
    var ctx = sndCtx(); if (!ctx || ctx.state !== 'running') return;
    var t = ctx.currentTime + 0.02;
    if (kind === 'ok') { note(ctx, t, 784, 0.32, 0.22); note(ctx, t, 1568, 0.18, 0.04); note(ctx, t + 0.11, 1175, 0.5, 0.24); note(ctx, t + 0.11, 2350, 0.25, 0.04); }
    else { note(ctx, t, 392, 0.22, 0.2, 'triangle'); note(ctx, t + 0.16, 311, 0.34, 0.2, 'triangle'); }
  }
  function buzz() { if (!navigator.vibrate) return; try { navigator.vibrate(25); } catch (e) {} }

  /* ---------- vùng chữ để confetti chui bên dưới ---------- */
  function occlRects() {
    var roots = [view, $('#aside')].filter(function (e) { return e && !e.hidden; });
    var sr = stage.getBoundingClientRect(), k = sr.width / 915, out = [], pad = 10;
    function add(r) { if (r.width < 1 || r.height < 1) return; out.push([(r.left - sr.left) / k - pad, (r.top - sr.top) / k - pad, r.width / k + pad * 2, r.height / k + pad * 2]); }
    var rg = document.createRange();
    roots.forEach(function (rt) {
      var w = document.createTreeWalker(rt, NodeFilter.SHOW_TEXT), n;
      while ((n = w.nextNode())) { if (!n.nodeValue.trim()) continue; rg.selectNodeContents(n); Array.prototype.forEach.call(rg.getClientRects(), add); }
      Array.prototype.forEach.call(rt.querySelectorAll('img, svg, .btn, .inote, .avatar, .tile, .ckw'), function (el) { if (!el.closest('.btn') || el.classList.contains('btn')) add(el.getBoundingClientRect()); });
    });
    return out;
  }
  function faceMoving() { return Math.abs(face.L - face.Lt) > 0.015 || stage.classList.contains('wait'); }
  function occlTrack(seq) {
    var tries = 0;
    later(function wait() {
      if (S.seq !== seq) return;
      if (faceMoving() && tries++ < 14) { later(wait, 80); return; }
      face.occl = stage.classList.contains('wait') ? null : occlRects();
      [220, 900].forEach(function (ms) { later(function () { if (S.seq === seq) face.occl = occlRects(); }, ms); });
    }, 0);
  }

  /* ---------- camera: chỉ bật ở màn quét, host lo phần quét thật (web hoặc native) ---------- */
  function camLabel() { return IC.flip + 'Dùng camera ' + (S.facing === 'user' ? 'sau' : 'trước'); }
  function camState(st, msg) {
    var nc = $('#nocam'); if (!nc) return;
    nc.hidden = st === 'ready'; nc.textContent = msg || (st === 'error' ? 'Không mở được camera. Bạn nhập số điện thoại nhé.' : 'Đang mở camera...');
  }
  function camStart() {
    if (S.camOn) return; S.camOn = true;
    cam.classList.toggle('rear', S.facing === 'environment');
    if (!host.startScan) { camState('error', 'Xem trước: camera chỉ bật trên máy kiosk'); return; }
    camState('loading');
    host.startScan(cam, handleCode, camState, S.facing);
  }
  function camStop() { if (!S.camOn) return; S.camOn = false; if (host.stopScan) host.stopScan(); }

  /* ---------- màn hình ---------- */
  function expr(e) { S.expr = e; face.setExpr(e); markExpr(); }
  function go(name, opt) {
    opt = opt || {};
    var seq = S.seq = S.seq + 1; S.screen = name; S.lastTouch = now();
    function still() { return S.seq === seq; }
    face.occl = null; if (name !== 'sleep' && name !== 'hello') occlTrack(seq);   // màn ngủ: chữ trắng tự nổi, không khoét bóng tối dưới chữ
    if (name === 'ok') chime('ok'); else if (name === 'problem') chime('bad');
    var wasBig = !face.small;
    face.small = !(name === 'sleep' || name === 'hello');
    if (wasBig && face.small) { stage.classList.add('wait'); S.waitT = now(); }
    $('#aside').hidden = !face.small; if (face.small) renderAside();
    cam.classList.toggle('on', name === 'scan');
    if (name === 'scan') camStart(); else { camStop(); S.facing = 'user'; }
    S.busy = false;
    var h = '';
    if (name === 'sleep') {
      expr('sleep'); hideBub();
      h = '<div class="stop"><div class="slogo">' + LOGO + '</div><div class="sname"><div>' + esc(EV.name) + '</div><div>' + esc(EV.theme) + '</div></div><div class="stap">' + IC.tap + 'Chạm để check-in</div></div>';
    } else if (name === 'hello') {
      expr('surprised'); hideBub();
      later(function () { if (still()) go('home', { greet: true }); }, 650);
    } else if (name === 'home') {
      expr('neutral'); S.nextMood = 0; S.moodEnd = 0;
      if (opt.greet) {
        later(function () { if (still()) expr('happy'); }, 420);
        later(function () { if (still() && S.expr === 'happy') expr('neutral'); }, 1420);
      }
      h = '<div class="content full"><div class="grid4">' + tile('scan', 'main', IC.qr, 'Check-in', 'Quét mã QR trên vé') + tile('agenda', '', IC.cal, 'Lịch trình', 'Các phiên hôm nay') +
        tile('info', '', IC.map, 'Sơ đồ', EV.seats && EV.seats.length ? 'Ghế phòng chiếu' : 'Vị trí các khu') + tile('chat', '', IC.help, 'Hỏi đáp', 'Câu hỏi thường gặp') + '</div></div>';
    } else if (name === 'scan') {
      expr('focused');
      h = '<div class="side" data-anim><h2 class="h">Đưa mã QR vào camera</h2><p class="p">Mở vé trong mục Vé của tôi, tăng độ sáng màn hình và giữ yên mã trong khung.</p><div class="hint" id="hint"></div><button class="btn camflip" data-cam>' + camLabel() + '</button></div>' +
        btns([['Quay lại', 'data-go="home"'], ['Nhập số điện thoại', 'data-go="lookup"']]);
    } else if (name === 'ok') {
      var g = opt.view;
      expr(g.tickets > 1 ? (Math.random() < 0.5 ? 'cheerStar' : 'cheerHeart') : 'cheer');
      face.confetti(g.tickets > 1, TICKET_COL.bg);
      var at = new Date(g.checkedInAt || Date.now()), tk = $('#tkb');
      tk.style.cssText = 'color:' + TICKET_COL.fg + ';background:' + TICKET_COL.bg;
      tk.innerHTML = svg(LI.ticket) + '<span><b>' + g.tickets + ' vé</b><small>' + esc(g.seats && g.seats.length ? g.seats.join(', ') : 'Chưa chọn ghế') + '</small></span>';
      $('#ckt').textContent = hhmm(at) + ', ' + ('0' + at.getDate()).slice(-2) + '/' + ('0' + (at.getMonth() + 1)).slice(-2) + '/' + at.getFullYear();
      var notes = [];
      if (g.seatsPending) notes.push('Bạn còn vé chưa chọn ghế, ghé quầy hỗ trợ nhé.');
      if (g.combos && g.combos.length || g.shirts) notes.push('Nhận combo' + (g.shirts ? ' và áo' : '') + ' tại quầy hỗ trợ.');
      h = '<div class="content" data-anim><p class="hi">Xin chào,</p><h2 class="h big">' + esc(g.userName) + '</h2>' +
        fieldList([['armchair', seatText(g.seats, g.seatsPending)], ['ticket', g.tickets + ' vé xem phim'], ['popcorn', (g.combos || []).join(', ')], ['shirt', g.shirts ? 'Áo: ' + g.shirts : '']]) +
        (notes.length ? infoNote(notes.join(' ')) : '') + '</div>' +
        btns([['Quay lại', 'data-go="home"'], ['Check-in vé khác', 'data-go="scan"', true]]);
    } else if (name === 'problem') {
      var P = PROB[opt.kind] || PROB.notfound;
      expr('confused');
      h = notice({ icon: P[0], col: P[1], title: P[2], text: opt.kind === 'used' ? 'Đã check-in lúc ' + (opt.at || '--:--') + '.' : P[3], note: HELP,
        buttons: btns([['Quét lại', 'data-go="scan"', true], ['Nhập số điện thoại', 'data-go="lookup"']]) });
    } else if (name === 'lookup') {
      expr('listening'); S.phone = '';
      var keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clr', '0', 'del'];
      h = '<div class="content look" data-anim><div class="lcol"><h2 class="h">Số điện thoại</h2><div class="pdisp" id="pdisp"></div><div class="results" id="res"></div></div>' +
        '<div class="numpad">' + keys.map(function (k) {
          return '<button data-n="' + k + '" aria-label="' + ({ clr: 'Xóa hết', del: 'Xóa một số' }[k] || k) + '">' + (k === 'del' ? IC.del : k === 'clr' ? IC.x : k) + '</button>';
        }).join('') + '</div></div>' + btns([['Quay lại', 'data-go="scan"']]);
    } else if (name === 'confirm') {
      var c = opt.preview; S.confirmPhone = opt.phone; expr('curious');
      var av = /^(https?:\/\/|\/)/.test(c.image || '') ? '<img class="avatar" alt="" src="' + esc(c.image) + '">' : '';
      h = av + '<div class="content' + (av ? ' hasav' : '') + '" data-anim><p class="p" style="margin:0 0 6px">Có phải bạn không?</p><h2 class="h" style="font-size:38px">' + esc(c.maskedName) + '</h2>' +
        fieldList([['ticket', c.tickets + ' vé xem phim'], ['armchair', seatText(c.seats, false)]]) +
        (c.alreadyCheckedIn ? '<div class="tags" style="margin-top:16px"><span class="tag">' + IC.check + 'Đã check-in trước đó</span></div>' : '') + '</div>' +
        btns([['Không phải', 'data-go="lookup"'], ['Đúng, check-in', 'data-ok', true]]);
    } else if (name === 'agenda') {
      expr('neutral'); var st = agendaState(), A = EV.agenda;
      var from = st.kind === 'done' ? Math.max(0, A.length - 6) : Math.max(0, Math.min((st.i || 0) - 1, A.length - 6));
      h = '<div class="content" data-anim><div class="agenda">' + A.map(function (a, i) {
        if (i < from || i >= from + 6) return '';
        var cur = st.kind === 'now' && st.i === i, done = st.kind === 'done' || (st.i !== undefined && i < st.i);
        return '<div class="ag' + (cur ? ' now' : done ? ' done' : '') + '"><span class="tm">' + a.start + '</span><span class="ti">' + esc(a.title) + '</span><span class="st">' + (cur ? 'Đang diễn ra' : done ? 'Đã xong' : '') + '</span></div>';
      }).join('') + '</div></div>' + btns([['Quay lại', 'data-go="home"']]);
    } else if (name === 'info') {
      expr('neutral');
      var dirRow = function (d) { return '<div class="row"><div class="v">' + dirIcon(d) + esc(d.label) + '</div><div class="n">' + esc(d.note || '') + '</div></div>'; };
      h = EV.seats && EV.seats.length
        ? '<div class="content" data-anim><div class="panel seatp">' + seatSvg() + '<div class="sfoot">' + seatLegend() + '</div></div></div>'
        : '<div class="content" data-anim><div class="two map"><div class="panel">' + mapSvg() + '</div>' +
          '<div class="panel guide">' + dirRow(EV.directions.hall) + dirRow(EV.directions.help) + '<div class="row"><div class="n">' + esc(HELP) + '</div></div></div></div></div>';
      h += btns([['Quay lại', 'data-go="home"']]);
    } else if (name === 'chat') {
      expr('curious'); S.faq = -1;
      h = '<div class="content" data-anim><div class="faq" id="faq"></div></div>' + btns([['Quay lại', 'data-go="home"']]);
    }
    view.innerHTML = h;
    var avi = $('.avatar');
    if (avi) { var shw = function () { avi.classList.add('in'); }; if (avi.complete && avi.naturalWidth) shw(); else { avi.onload = shw; avi.onerror = function () { avi.remove(); }; } }
    if (name === 'chat') renderFaq();
    if (name === 'lookup') renderResults();
    markScreen();
  }

  /* ---------- check-in ---------- */
  function showResult(r) {
    if (dead) return;
    if (r && r.ok) {
      var v = r.value;
      if (v.justCheckedIn) return go('ok', { view: v });
      return go('problem', { kind: 'used', at: v.checkedInAt ? hhmm(v.checkedInAt) : '' });
    }
    go('problem', { kind: (r && ERR[r.error]) || 'offline' });
  }
  function handleCode(raw) {
    if (dead || S.screen !== 'scan' || S.busy) return;
    var code = String(raw || '').trim(), t = now();
    if (code === S.lastCode && t - S.lastCodeT < 4) return;
    S.lastCode = code; S.lastCodeT = t; S.lastTouch = t;
    if (!UUID.test(code)) return go('problem', { kind: 'wrong' });
    S.busy = true;
    var sd = $('.side'), he = $('#hint'); if (sd) sd.classList.add('reading'); if (he) he.textContent = 'Đang kiểm tra vé...';
    expr('thinking');
    host.checkinQr(code).then(showResult, function () { showResult(null); });
  }
  function typeKey(k) {
    if (k === 'del') S.phone = S.phone.slice(0, -1);
    else if (k === 'clr') S.phone = '';
    else if (S.phone.length < (S.phone.indexOf('84') === 0 ? 11 : 10)) S.phone += k;
    renderResults();
  }
  /* số hiện ngay khi bấm; đủ số mới tìm (sau một nhịp ngắn để khách kịp sửa) */
  function renderResults() {
    var d = S.phone || '', box = $('#res'), disp = $('#pdisp'); if (!box) return;
    disp.innerHTML = d ? '<span class="num">' + esc(fmtPhone(d)).replace(/(\d)$/, '<span class="dg">$1</span>') + '</span>' : '<span class="ph">0xx xxx xxxx</span>';
    clearTimeout(S.lookT);
    if (!phoneFull(d)) { if (S.expr !== 'listening') expr('listening'); box.innerHTML = d ? '' : '<p class="hintp">Nhập số điện thoại đã đặt vé để tìm vé của bạn.</p>'; return; }
    box.innerHTML = ''; expr('thinking');
    S.lookT = later(function () {
      if (S.screen !== 'lookup' || S.phone !== d) return;
      var p = normPhone(d);
      if (!host.lookupPhone) { expr('curious'); box.innerHTML = infoNote('Xem trước: không tra cứu thật. Dùng kịch bản thử bên dưới.'); return; }
      host.lookupPhone(p).then(function (r) {
        if (dead || S.screen !== 'lookup' || S.phone !== d) return;
        if (r && r.ok) return go('confirm', { preview: r.value, phone: p });
        expr('confused');
        box.innerHTML = infoNote(r && r.error === 'NOT_FOUND' ? 'Không tìm thấy vé. ' + HELP : r && r.error === 'AMBIGUOUS' ? 'Số này gắn với nhiều tài khoản, bạn ghé quầy hỗ trợ nhé.' : r && ERR[r.error] ? PROB[ERR[r.error]][2] + '. ' + HELP : 'Chưa kết nối được, bạn thử lại sau ít phút.');
      }, function () { if (!dead) box.innerHTML = infoNote('Chưa kết nối được, bạn thử lại sau ít phút.'); });
    }, 400);
  }
  function confirmCheckin() {
    if (S.busy) return;
    if (!host.confirmPhone || !S.confirmPhone) { go('ok', { view: DEMO_GUEST }); return; }
    S.busy = true; expr('thinking');
    host.confirmPhone(S.confirmPhone).then(showResult, function () { showResult(null); });
  }

  /* ---------- hỏi đáp ---------- */
  function faqAnswer(f) {
    if (f.a !== '__NEXT__') return f.a;
    var a = agendaState(), n = a.kind === 'now' ? EV.agenda[a.i + 1] : a.kind === 'soon' ? a.item : null;
    return n ? 'Tiếp theo là ' + n.title + ' lúc ' + n.start + '.' : 'Chương trình hôm nay đã kết thúc.';
  }
  function renderFaq() {
    var box = $('#faq'); if (!box) return;
    box.innerHTML = EV.faq.map(function (f, i) {
      var open = S.faq === i;
      return '<button class="fq' + (open ? ' open' : '') + '" data-faq="' + i + '"><span class="q">' + esc(f.q) + '</span>' + (open ? '<span class="a">' + esc(faqAnswer(f)) + '</span>' : '') + '</button>';
    }).join('');
    var o = box.querySelector('.open'); if (o) o.scrollIntoView({ block: 'nearest' });
  }

  /* ---------- thoát kiosk: giữ góc trên trái 2 giây rồi nhập mã PIN ---------- */
  var PIN = { fails: 0, lockUntil: 0 };
  function openPin() {
    if (S.pin) return;
    var pin = '', err = '', el = document.createElement('div'), idleT = 0; el.className = 'pin'; S.pin = el;
    function close() { clearTimeout(idleT); el.remove(); S.pin = null; S.lastTouch = now(); }
    function bump() { clearTimeout(idleT); idleT = later(close, 20000); }
    function draw() {
      var locked = Date.now() < PIN.lockUntil;
      if (locked) err = 'Nhập sai nhiều lần, thử lại sau ' + Math.ceil((PIN.lockUntil - Date.now()) / 1000) + ' giây.';
      el.innerHTML = '<div style="text-align:center"><p class="lbl">Mã thoát kiosk</p><div class="dots">' + Array.apply(null, Array(Math.max(4, pin.length))).map(function (_, i) { return '<i' + (i < pin.length ? ' class="on"' : '') + '></i>'; }).join('') + '</div><p class="err">' + esc(err) + '</p><div class="keys">' +
        '123456789'.split('').concat(['x', '0', 'ok']).map(function (k) { return '<button data-k="' + k + '" aria-label="' + ({ x: 'Đóng', ok: 'Xác nhận' }[k] || k) + '"' + (locked && k !== 'x' ? ' disabled' : '') + '>' + ({ x: IC.x, ok: IC.check }[k] || k) + '</button>'; }).join('') + '</div></div>';
    }
    el.addEventListener('click', function (e) {
      var kb = e.target.closest('[data-k]'), k = kb && kb.dataset.k; if (!k || kb.disabled) return;
      bump();
      if (k === 'x') { close(); return; }
      if (k === 'ok') {
        if (!pin) return;
        var p = pin; pin = ''; err = 'Đang kiểm tra...'; draw();
        host.exitPin(p).then(function (r) {
          if (dead) return;
          if (r && r.ok) { PIN.fails = 0; close(); return; }
          if (r && r.error === 'WRONG_PIN') { PIN.fails++; err = 'Sai mã.'; if (PIN.fails >= 5) { PIN.fails = 0; PIN.lockUntil = Date.now() + 30000; later(function () { if (S.pin === el) { err = ''; draw(); } }, 30000); } }
          else err = r && r.error === 'NO_PIN' ? 'Máy chủ chưa đặt mã thoát.' : 'Không kiểm tra được mã.';
          draw();
        }, function () { err = 'Không kiểm tra được mã.'; draw(); });
        return;
      }
      if (pin.length < 12) pin += k; err = ''; draw();
    });
    draw(); bump(); stage.appendChild(el);
  }

  /* ---------- bong bóng lời nhắn ---------- */
  var BUB = { until: 0, w: 0, h: 0, big: undefined };
  var BUSY = ['scan', 'ok', 'problem', 'lookup', 'confirm'];
  function hideBub() { $('#bub').hidden = true; BUB.until = 0; }
  function say(text, kind) {
    text = String(text || '').trim().slice(0, 80);
    if (!text || S.screen === 'hello' || S.screen === 'sleep') return;
    var el = $('#bub');
    BUB.until = now() + Math.min(8, Math.max(3, 2.2 + text.length * 0.07));
    $('#bubt').textContent = text;
    el.className = 'bub ' + (kind === 'think' ? 'think' : 'say'); el.hidden = false; BUB.w = 0; BUB.big = undefined; placeBubble();
    el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
  }
  function placeBubble() {
    var el = $('#bub'); if (el.hidden) return;
    var big = face.sm < 0.5;
    if (BUB.big !== big || !BUB.w) { el.classList.toggle('big', big); BUB.big = big; BUB.w = el.offsetWidth; BUB.h = el.offsetHeight; }
    var w = BUB.w, h = BUB.h, a = face.bubA || [600, 200], ax = a[0] * 915 / 1078, ay = a[1] * 412 / 480;
    var tail = big ? 36 : 29, tipR = (big ? 20 : 15) + tail;
    var x = ax - (w - tipR) - 10, y = ay - h - tail - 3;
    if (!big) { x = Math.min(x, 385 - w); var as = $('#aside'); if (!as.hidden && as.offsetHeight) y = Math.max(y, as.offsetTop + as.offsetHeight + 8); }
    else y = Math.max(64, y);
    el.style.left = Math.round(Math.max(12, x)) + 'px'; el.style.top = Math.round(Math.max(12, y)) + 'px';
  }

  /* ---------- chạm, mắt nhìn theo ---------- */
  function point(e) {
    var r = stage.getBoundingClientRect();
    var nx = (e.clientX - r.left) / r.width, ny = (e.clientY - r.top) / r.height;
    S.ptr = [clamp((nx * 2 - 1) * 1.3, -1, 1), clamp((ny * 2 - 1) * 1.3 - (face.small ? 0.2 : 0), -1, 1)];
    S.lastPoint = now();
  }
  on(screen, 'pointermove', point);
  on(screen, 'pointerleave', function () { S.ptr = null; });
  on(screen, 'pointerdown', function (e) {
    point(e); S.lastTouch = now();
    if (SND.ctx && SND.ctx.state === 'suspended') SND.ctx.resume().catch(function () {});
    else if (!SND.ctx) sndCtx();
    var b = e.target.closest('button'); if (b && !b.disabled) buzz();
    if (S.screen === 'sleep' && !e.target.closest('#hold')) go('hello');
  });
  on(view, 'click', function (e) {
    var t = e.target.closest('button'); if (!t) return;
    if (t.dataset.go) { go(t.dataset.go); return; }
    if (t.hasAttribute('data-ok')) { confirmCheckin(); return; }
    if (t.dataset.n) { typeKey(t.dataset.n); return; }
    if (t.dataset.faq) { var i = +t.dataset.faq; S.faq = S.faq === i ? -1 : i; renderFaq(); return; }
    if (t.hasAttribute('data-cam')) {
      S.facing = S.facing === 'user' ? 'environment' : 'user';
      camStop(); cam.classList.add('flipout');
      later(function () { cam.classList.remove('flipout'); cam.classList.add('flipin'); camStart(); t.innerHTML = camLabel(); later(function () { cam.classList.remove('flipin'); }, 160); }, 120);
    }
  });
  var hold = $('#hold'), holdT = 0;
  if (hold) {
    on(hold, 'pointerdown', function (e) { e.stopPropagation(); clearTimeout(holdT); holdT = later(openPin, 2000); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (n) { on(hold, n, function () { clearTimeout(holdT); }); });
  }

  /* ---------- vòng lặp ---------- */
  var last = now(), raf = 0, lastAside = 0;
  function frame() {
    if (dead) return;
    var t = now(), dt = Math.min(0.05, t - last); last = t;
    var fv = S.ptr && t - S.lastPoint < 6 ? S.ptr : [0, 0];
    face.view = [face.view[0] + (fv[0] - face.view[0]) * Math.min(1, dt * 7), face.view[1] + (fv[1] - face.view[1]) * Math.min(1, dt * 7)];
    face.attn = S.ptr ? 1 : 0;
    face.step(dt);
    if (S.waitT && (face.sm >= 0.85 || t - S.waitT > 0.8)) { S.waitT = 0; stage.classList.remove('wait'); }
    var el = $('#bub'); if (!el.hidden) { if (t > BUB.until) hideBub(); else placeBubble(); }
    if (!$('#aside').hidden && t - lastAside > 1 && !faceMoving()) { lastAside = t; renderAside(); }
    if (!S.pin) {
      timerTick(t);
      var an = autoNext(S.screen);
      if (an && t - S.lastTouch > an[0]) go(an[1]);
      else if (MODE === 'kiosk' && S.screen === 'scan' && !S.busy && t - S.lastTouch > 45) go('home');
      else if (MODE === 'kiosk' && S.screen === 'home' && t - S.lastTouch > 50) go('sleep');
      moodTick(t);
    }
    raf = requestAnimationFrame(frame);
  }
  /* màn chính: chủ yếu mặt bình thường, thỉnh thoảng cười, bối rối, tò mò; không ai chạm quá 30 giây thì buồn ngủ */
  function moodTick(t) {
    if (S.screen !== 'home') return;
    var away = t - S.lastTouch, isMood = IDLE_MOODS.indexOf(S.expr) >= 0;
    if (MODE === 'kiosk' && away > 30) { if (S.expr === 'neutral' || isMood) { expr('sleepy'); S.moodEnd = 0; } return; }
    if (S.expr === 'sleepy') { expr('neutral'); S.nextMood = t + 4 + Math.random() * 4; return; }
    if (!S.auto) return;
    if (S.moodEnd && t > S.moodEnd) { S.moodEnd = 0; if (isMood) expr('neutral'); S.nextMood = t + 6 + Math.random() * 6; }
    else if (!S.moodEnd && S.expr === 'neutral' && t > (S.nextMood || 0)) {
      if (!S.nextMood) S.nextMood = t + 4 + Math.random() * 4;
      else { expr(IDLE_MOODS[Math.floor(Math.random() * IDLE_MOODS.length)]); S.moodEnd = t + 1.6 + Math.random() * 0.9; }
    }
  }

  /* ---------- bộ mặt ---------- */
  var L = { color: '#ef5350', shape: 'round', eyeStyle: 'soft', pixel: false, facePix: false, decor: {}, bg: { base: '#000000', p: null, c: '#ffffff' } };
  function patCol() { return L.bg.c === 'face' ? L.color : (L.bg.c || '#ffffff'); }
  function apply(fromUser) {
    face.setColor(L.color); face.setShape(L.shape); face.setFacePixel(!!L.facePix);
    face.setEyeStyle(L.eyeStyle, !!L.pixel || !!L.facePix);
    face.setDecor(L.decor); face.setBg(L.bg);
    stage.style.background = L.bg.base; screen.style.background = L.bg.base; root.style.setProperty('--bg', L.bg.base);
    // màu chủ đạo (theme): ô Check-in, nút chính, vòng đếm ngược; không có thì giữ trắng
    if (/^#[0-9a-f]{6}$/i.test(L.theme || '')) root.style.setProperty('--acc', L.theme); else root.style.removeProperty('--acc');
    if (MODE === 'control') { render(); if (fromUser && host.send) host.send({ t: 'look', v: clone(L) }); }
  }
  function set(patch, fromUser) { Object.keys(patch).forEach(function (k) { L[k] = patch[k]; }); apply(fromUser); }
  function pick(patch) { set(patch, true); }

  /* ---------- bảng điều khiển ---------- */
  function ctlHtml() {
    return '<div class="ctl">' +
      '<div class="grp"><p class="lbl">Màn hình <em>đưa kiosk tới màn</em></p><div class="chips" id="screens">' + SCREENS.map(function (s) { return '<button class="chip" data-scr="' + s[0] + '" aria-pressed="false">' + s[1] + '</button>'; }).join('') + '</div>' +
      '<div class="row"><button class="chip" id="autoMood" aria-pressed="true">Tự đổi biểu cảm khi rảnh</button></div></div>' +
      '<div class="grp"><p class="lbl">Kịch bản thử <em>chỉ dựng lại màn, không ghi check-in</em></p><div class="chips" id="scenes">' + SCENES.map(function (s) { return '<button class="chip" data-scn="' + s[0] + '">' + s[1] + '</button>'; }).join('') + '</div></div>' +
      '<div class="grp"><p class="lbl">Biểu cảm <em id="exprNow"></em></p><div class="chips" id="exprs"></div></div>' +
      '<div class="grp wide"><p class="lbl">Hero Marvel <em>đổi cả mặt, phụ kiện và nền</em></p><div class="tiles looks" id="looks"></div></div>' +
      '<div class="grp"><p class="lbl">Khuôn mặt</p><div class="sub">Màu</div><div class="sws" id="colors"></div>' +
      '<div class="lrow"><span class="sub">Dáng mặt</span><div class="seg" id="segFace"><button data-v="0">Mượt</button><button data-v="1">Pixel</button></div></div><div class="tiles" id="shapes"></div>' +
      '<div class="lrow"><span class="sub">Kiểu mắt</span><div class="seg" id="segEye"><button data-v="0">Mượt</button><button data-v="1">Pixel</button></div></div><div class="tiles" id="eyes"></div></div>' +
      '<div class="grp"><p class="lbl">Phụ kiện</p><div id="decor"></div><p class="note">Hình phụ kiện từ bộ Fluent Emoji của Microsoft (giấy phép MIT).</p></div>' +
      '<div class="grp"><p class="lbl">Nền</p><div class="sub">Màu nền</div><div class="sws" id="bases"></div><div class="sub">Họa tiết</div><div class="tiles pats" id="pats"></div><div class="sub">Màu họa tiết</div><div class="sws" id="patCols"></div><p class="note">Họa tiết từ Hero Patterns của Steve Schoger (giấy phép MIT).</p></div>' +
      '<div class="grp"><p class="lbl">Lời nhắn <em>nhân viên gửi cho Uni</em></p><form class="say" id="sayForm"><input id="sayText" maxlength="80" value="Chào bạn! Check-in ở đây nhé." aria-label="Nội dung lời nhắn"></form>' +
      '<div class="row"><button class="act pri" id="sayBtn" type="button">Nói</button><button class="act" id="thinkBtn" type="button">Nghĩ</button><button class="act" id="confBtn" type="button">Bắn pháo giấy</button></div>' +
      '<p class="note live">Mọi thao tác ở đây gửi tới máy kiosk đang mở, chậm khoảng 1 đến 2 giây.</p></div>' +
      '</div>';
  }
  function markExpr() {
    if (MODE !== 'control') return;
    $$('#exprs .chip').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.ex === S.expr ? 'true' : 'false'); });
    var en = $('#exprNow'); if (en) en.textContent = 'đang hiện: ' + (EXL[S.expr] || S.expr);
  }
  function markScreen() {
    if (MODE !== 'control') return;
    $$('#screens .chip').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.scr === S.screen ? 'true' : 'false'); });
  }
  function send(m) { if (MODE === 'control' && host.send) host.send(m); }

  var RIM = { round: null, bot: function (a) { return RIM.squircle(a); }, squircle: function (a) { return Math.pow(Math.pow(Math.abs(Math.sin(a)), 3.4) + Math.pow(Math.abs(Math.cos(a)), 3.4), -1 / 3.4); }, wide: function (a) { return 1 / Math.hypot(Math.sin(a) / 1.1, Math.cos(a) / .92); }, cloud: function (a) { return .985 + .03 * Math.pow(Math.abs(Math.cos(7 * a)), .7); }, jelly: function (a) { return 1 + .02 * Math.sin(3 * a) + .012 * Math.sin(5 * a + 1.3); } };
  var pid = 0;
  /* hình mặt nhỏ trong ô chọn: vòm mặt theo dáng, hai mắt theo kiểu mắt, phụ kiện, trên nền đã chọn */
  function mini(lk, bg) {
    var f = RIM[lk.shape || 'round'], d = '', c = lk.color, e = mix(c, '#000000', .5), es = lk.eyeStyle || 'soft', id = 'mp' + (pid++);
    var bot = lk.shape === 'bot', fcol = bot ? '#9aa4ae' : c;   // người máy: mặt nạ xám, mắt khe đen, mũ trùm theo màu chọn
    if (bot) { e = '#14171a'; es = 'rect'; }
    for (var i = 0; i <= 120; i++) { var a = (-120 + 2 * i) * Math.PI / 180, r = 74 * (f ? f(a) : 1); d += (i ? 'L' : 'M') + (60 + r * Math.sin(a)).toFixed(1) + ' ' + (118 - r * Math.cos(a)).toFixed(1); }
    var eye = function (x, y) {
      if (es === 'devil') { var s = x < 60 ? 1 : -1; return '<path d="M' + (x - 10) + ' ' + (y - 2.5 - 2.5 * s) + 'L' + (x + 10) + ' ' + (y - 2.5 + 2.5 * s) + 'A10 9.5 0 0 1 ' + (x - 10) + ' ' + (y - 2.5 - 2.5 * s) + 'Z" fill="' + e + '"/>'; }
      if (es === 'rect') return '<rect x="' + (x - 8.5) + '" y="' + (y - 10) + '" width="17" height="20" rx="6.5" fill="' + e + '"/>';
      if (es === 'anime') return '<rect x="' + (x - 8.5) + '" y="' + (y - 10) + '" width="17" height="20" rx="6.5" fill="' + e + '"/><circle cx="' + (x - 2.6) + '" cy="' + (y - 3.3) + '" r="2.5" fill="' + c + '"/>';
      return '<circle cx="' + x + '" cy="' + y + '" r="9.5" fill="' + e + '"/>';
    };
    var b = bg || { base: '#000000' }, p = b.p && PAT[b.p];
    var pat = p ? '<defs><pattern id="' + id + '" width="40" height="40" patternUnits="userSpaceOnUse"><image href="' + uri(p.svg.split('#C0FFEE').join(b.c === 'face' ? c : (b.c || '#ffffff'))) + '" width="40" height="40"/></pattern></defs><rect width="120" height="80" fill="url(#' + id + ')" opacity=".21"/>' : '';
    var dec = lk.decor || {}, back = '', front = '';
    if (bot && !dec.ears && !dec.hair) {   // vẽ như trên kiosk: mũ trùm, lỗ mũ có bóng xám, mặt nạ bám theo hai mắt (tỉ lệ 36/384)
      var se = function (e, fill, extra) { var q = ''; for (var j = 0; j <= 120; j++) { var aj = j / 120 * Math.PI * 2, cj = Math.cos(aj), sj = Math.sin(aj), kj = 2 / e[3]; q += (j ? 'L' : 'M') + (60 + e[1] * .09375 * Math.sign(sj) * Math.pow(Math.abs(sj), kj)).toFixed(1) + ' ' + (66 + (e[0] - 262 - e[2] * Math.sign(cj) * Math.pow(Math.abs(cj), kj)) * .09375).toFixed(1); } return '<path d="' + q + 'Z" fill="' + fill + '"' + (extra || '') + '/>'; };
      back += se([604, 590, 778, 2.6], c) + se([604, 392, 646, 3], '#5d636b', ' stroke="' + mix(c, '#000000', .4) + '" stroke-width="1.7"');
      d = ''; var mask = se([604, 373, 560, 3], fcol); f = null;
    }
    var rim = function (deg, inset) { var a = deg * Math.PI / 180, r = 74 * (f ? f(a) : 1) - inset; return [60 + r * Math.sin(a), 118 - r * Math.cos(a)]; };
    var img = function (s, x, y, h, ax, ay, rot, wx) { var vb = /viewBox="([^"]+)"/.exec(s)[1].split(' ').map(Number), w = h * vb[2] / vb[3] * (wx || 1); return '<image href="' + uri(s) + '" x="' + (-w * ax).toFixed(1) + '" y="' + (-h * ay).toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + h + '" transform="translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ') rotate(' + rot.toFixed(1) + ')"/>'; };
    var it = dec.ears && D[dec.ears];
    if (it) [0, 1].forEach(function (i) { var sg = i ? 1 : -1, a = 19 * sg, p = rim(a, 4); back += img(tint(it, it.parts[i], c), p[0], p[1], it.m.mh || 24, it.m.ax ? it.m.ax[i] : .5, it.m.ay || 1, a - (it.m.rot || 0) * sg); });
    it = dec.hair && D[dec.hair];
    if (it) { var fh = it.m.pos === 'forehead', ct = it.m.pos === 'center' || fh, ha = ct ? 0 : 36, hp = rim(ha, fh ? 9 : ct ? 4 : 1); var hs = img(tint(it, it.parts[0], c), hp[0], hp[1], it.m.mh || (fh ? 30 : ct ? 24 : 22), .5, it.m.ay || (ct ? .85 : .5), ha, it.m.wx); if (it.m.back) back += hs; else front += hs; }
    it = dec.eyes && D[dec.eyes];
    if (it) front += img(it.parts[0], 60, 66, it.m.mh || 22, .5, .5, 0);
    return '<svg class="mini" viewBox="0 0 120 80" aria-hidden="true"><rect width="120" height="80" fill="' + (b.base || '#000000') + '"/>' + pat + back + (mask || '<path d="' + d + 'Z" fill="' + fcol + '"/>') + eye(42, 66) + eye(78, 66) + front + '</svg>';
  }
  function tileBtn(isOn, inner, name, fn) { var b = document.createElement('button'); b.type = 'button'; b.className = 'tile2' + (isOn ? ' on' : ''); b.innerHTML = inner + '<span class="tn">' + esc(name) + '</span>'; b.title = name; b.onclick = fn; return b; }
  function swBtn(col, name, isOn, fn, cls) { var b = document.createElement('button'); b.type = 'button'; b.className = 'sw' + (cls ? ' ' + cls : ''); b.style.background = col; b.title = name; b.setAttribute('aria-label', name); b.setAttribute('aria-pressed', isOn ? 'true' : 'false'); b.onclick = fn; return b; }
  function fillEl(sel, nodes) { var el = $(sel); el.innerHTML = ''; nodes.forEach(function (n) { el.appendChild(n); }); }
  function render() {
    fillEl('#looks', LOOKS.map(function (x) {
      var lk = x[1], isOn = lk.color === L.color && lk.shape === L.shape && lk.eyeStyle === L.eyeStyle && lk.pixel === !!L.pixel && !L.facePix && same(lk.decor, L.decor) && (lk.bg.p || null) === (L.bg.p || null) && lk.bg.base === L.bg.base;
      return tileBtn(isOn, mini(lk, lk.bg), x[0], function () { pick({ color: lk.color, theme: lk.theme || null, shape: lk.shape, eyeStyle: lk.eyeStyle, pixel: lk.pixel, facePix: false, decor: Object.assign({}, lk.decor), bg: Object.assign({ c: '#ffffff' }, lk.bg) }); });
    }));
    var cs = COLORS.map(function (c) { return swBtn(c[0], 'Màu ' + c[1], L.color === c[0], function () { pick({ color: c[0] }); }); });
    var cu = document.createElement('label'); cu.className = 'sw custom'; cu.title = 'Chọn màu khác';
    cu.innerHTML = '<input type="color" value="' + L.color + '" aria-label="Chọn màu khác">';
    cu.querySelector('input').addEventListener('change', function (e) { pick({ color: e.target.value.toLowerCase() }); });
    fillEl('#colors', cs.concat([cu]));
    fillEl('#shapes', SHAPES.map(function (s) { return tileBtn(L.shape === s[0], mini({ color: L.color, shape: s[0], eyeStyle: 'soft' }), s[1], function () { pick({ shape: s[0] }); }); }));
    fillEl('#eyes', EYES.map(function (s) { return tileBtn(L.eyeStyle === s[0], mini({ color: L.color, shape: 'round', eyeStyle: s[0] }), s[1], function () { pick({ eyeStyle: s[0] }); }); }));
    $$('#segFace button').forEach(function (b) { b.className = (b.dataset.v === '1') === !!L.facePix ? 'on' : ''; });
    $$('#segEye button').forEach(function (b) { b.className = (b.dataset.v === '1') === (!!L.pixel || !!L.facePix) ? 'on' : ''; b.disabled = !!L.facePix; b.title = L.facePix ? 'Mặt pixel thì mắt luôn pixel' : ''; });
    var dw = $('#decor'); dw.innerHTML = '';
    SLOTS.forEach(function (sl) {
      var g = document.createElement('div'); g.className = 'dslot'; g.innerHTML = '<div class="sub">' + sl[1] + '</div><div class="tiles"></div>';
      var t = g.querySelector('.tiles');
      t.appendChild(tileBtn(!L.decor[sl[0]], '<span class="none">Không</span>', 'Không đeo', function () { var d = Object.assign({}, L.decor); delete d[sl[0]]; pick({ decor: d }); }));
      Object.keys(D).filter(function (k) { return D[k].slot === sl[0]; }).forEach(function (k) {
        var it = D[k], pv = '<span class="pv">' + it.parts.map(function (p) { return '<img alt="" src="' + uri(tint(it, p, L.color)) + '">'; }).join('') + '</span>';
        t.appendChild(tileBtn(L.decor[sl[0]] === k, pv, it.name, function () { var d = Object.assign({}, L.decor); d[sl[0]] = k; pick({ decor: d }); }));
      });
      dw.appendChild(g);
    });
    fillEl('#bases', BASES.map(function (c) { return swBtn(c[0], 'Nền ' + c[1], L.bg.base === c[0], function () { pick({ bg: Object.assign({}, L.bg, { base: c[0] }) }); }); }));
    var pc = patCol();
    fillEl('#pats', [tileBtn(!L.bg.p, '<span class="none">Không</span>', 'Không', function () { pick({ bg: Object.assign({}, L.bg, { p: null }) }); })].concat(Object.keys(PAT).map(function (k) {
      return tileBtn(L.bg.p === k, '<span class="pt" style="background-color:' + L.bg.base + ';background-image:url(&quot;' + uri(PAT[k].svg.split('#C0FFEE').join(pc)) + '&quot;);background-size:32px"></span>', PAT[k].name, function () { pick({ bg: Object.assign({}, L.bg, { p: k }) }); });
    })));
    var fb = swBtn(L.color, 'Theo màu mặt', L.bg.c === 'face', function () { pick({ bg: Object.assign({}, L.bg, { c: 'face' }) }); }, 'face'); fb.textContent = 'Theo mặt';
    fillEl('#patCols', [fb].concat(PCOLS.map(function (c) { return swBtn(c[0], 'Họa tiết ' + c[1], L.bg.c === c[0], function () { pick({ bg: Object.assign({}, L.bg, { c: c[0] }) }); }); })));
  }

  /* ---------- lệnh (từ bảng điều khiển hoặc từ máy chủ) ---------- */
  function pickExpr(k) {
    if (k === 'sleep') { go('sleep'); return; }
    if (S.screen === 'sleep' || S.screen === 'hello') go('home');
    S.moodEnd = 0; S.nextMood = now() + 10; expr(k);
  }
  function setAuto(v) { S.auto = v; var b = $('#autoMood'); if (b) b.setAttribute('aria-pressed', v ? 'true' : 'false'); if (!v && S.moodEnd) { S.moodEnd = 0; expr('neutral'); } }
  function sayNow(text, kind) {
    if (MODE === 'kiosk' && BUSY.indexOf(S.screen) >= 0) return;   // khách đang check-in: không chen lời nhắn
    if (S.screen !== 'home' && BUSY.indexOf(S.screen) < 0) go('home');
    else if (BUSY.indexOf(S.screen) >= 0) go('home');
    later(function () { say(text, kind); }, S.waitT ? 700 : 0);
  }
  function conf() { if (S.screen !== 'home') go('home'); face.confetti(false, L.color); expr('cheer'); S.moodEnd = now() + 2.5; }
  function runScenario(n) {
    if (n === 'ok') go('ok', { view: Object.assign({}, DEMO_GUEST, { checkedInAt: new Date() }) });
    else if (n === 'confirm') go('confirm', { preview: { maskedName: 'Ng•••n V•• A', image: null, tickets: 2, seats: ['F7', 'F8'], alreadyCheckedIn: false }, phone: '' });
    else if (PROB[n]) go('problem', { kind: n, at: hhmm(Date.now() - 25 * 60000) });
  }
  function command(m) {
    if (!m || dead) return;
    if (MODE === 'kiosk' && S.pin) return;   // nhân viên đang nhập mã thoát: không đổi màn
    if (m.t !== 'look') S.lastTouch = now();
    if (m.t === 'look' && m.v && m.v.color) set(m.v);
    else if (m.t === 'go' && GO_OK.indexOf(m.v) >= 0) go(m.v);
    else if (m.t === 'expr' && typeof m.v === 'string') pickExpr(m.v);
    else if (m.t === 'say') sayNow(m.v, m.kind);
    else if (m.t === 'conf') conf();
    else if (m.t === 'auto') setAuto(!!m.v);
    else if (m.t === 'scn' && typeof m.v === 'string') runScenario(m.v);
  }

  if (MODE === 'control') {
    var ex = $('#exprs');
    Object.keys(UniFace.EXD).forEach(function (k) {
      var b = document.createElement('button'); b.className = 'chip'; b.dataset.ex = k; b.textContent = EXL[k] || k; b.setAttribute('aria-pressed', 'false');
      b.onclick = function () { pickExpr(k); send({ t: 'expr', v: k }); };
      ex.appendChild(b);
    });
    $$('#screens .chip').forEach(function (b) { b.onclick = function () { go(b.dataset.scr); send({ t: 'go', v: b.dataset.scr }); }; });
    $$('#scenes .chip').forEach(function (b) { b.onclick = function () { runScenario(b.dataset.scn); send({ t: 'scn', v: b.dataset.scn }); }; });
    $('#autoMood').onclick = function () { setAuto(!S.auto); send({ t: 'auto', v: S.auto }); };
    var sayBtn = function (kind) { var v = $('#sayText').value; sayNow(v, kind); send({ t: 'say', v: v, kind: kind }); };
    $('#sayBtn').onclick = function () { sayBtn('say'); };
    $('#thinkBtn').onclick = function () { sayBtn('think'); };
    $('#sayForm').addEventListener('submit', function (e) { e.preventDefault(); sayBtn('say'); });
    $('#confBtn').onclick = function () { conf(); send({ t: 'conf' }); };
    $('#segFace').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) pick({ facePix: b.dataset.v === '1' }); });
    $('#segEye').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b && !b.disabled) pick({ pixel: b.dataset.v === '1' }); });
  }
  face.setColor(L.color, true);
  set(clone(host.look && host.look.color ? host.look : DEFAULT_LOOK));
  go(MODE === 'control' ? 'home' : 'sleep');
  raf = requestAnimationFrame(frame);

  return {
    command: command,
    destroy: function () {
      dead = true; cancelAnimationFrame(raf); ro.disconnect(); camStop();
      timers.forEach(clearTimeout); timers = []; clearTimeout(S.lookT);
      offs.forEach(function (f) { f(); }); offs = [];
      if (SND.ctx) try { SND.ctx.close(); } catch (e) {}
      root.innerHTML = ''; root.classList.remove('uni-root');
    }
  };
}

window.UniApp = { mount: mount };
})();
