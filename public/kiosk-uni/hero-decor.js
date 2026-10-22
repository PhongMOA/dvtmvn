/* Phụ kiện và họa tiết hero Marvel, thêm vào UniDecor cùng định dạng với decor.js.
   Món ở chỗ "eyes" vẽ trong khung 300 × 118, tâm hai mắt Uni ở (85, 57) và (215, 57). mh là cỡ hình trong ô xem trước. */
(function () {
var D = window.UniDecor.DECOR, P = window.UniDecor.PATTERNS;
var NS = 'xmlns="http://www.w3.org/2000/svg"';
var MIRROR = function (g) { return g + '<g transform="translate(300 0) scale(-1 1)">' + g + '</g>'; };

// mặt nạ nhện: viền mắt kính hình giọt nước, mũi nhọn quay về sống mũi, thêm vài sợi tơ giữa hai mắt
var lens = '<path d="M134 94C110 102 40 92 28 52C20 22 58 4 100 16C126 24 140 60 134 94Z" fill="#ffffff" fill-opacity=".1" stroke="#111" stroke-width="9" stroke-linejoin="round"/>';
D.spidermask = { name: 'Mặt nạ nhện', slot: 'eyes', m: { mh: 33 }, parts: ['<svg ' + NS + ' viewBox="0 0 300 118">' +
  '<g fill="none" stroke="#111" stroke-width="3" stroke-linecap="round"><path d="M150 0V118M138 28Q150 36 162 28M140 66Q150 74 160 66M144 104Q150 108 156 104"/></g>' + MIRROR(lens) + '</svg>'] };

// khung mặt nạ Người Sắt: viền đỏ góc cạnh ôm hai mắt
D.ironplate = { name: 'Mặt nạ Iron Man', slot: 'eyes', m: { mh: 33 }, parts: ['<svg ' + NS + ' viewBox="0 0 300 118"><path d="M22 14L122 22L150 40L178 22L278 14L266 100L178 98L150 114L122 98L34 100Z" fill="none" stroke="#b3121f" stroke-width="11" stroke-linejoin="round"/></svg>'] };

// mảng đen quanh mắt Deadpool, khoét lỗ cho mắt
var patch = '<path fill-rule="evenodd" fill="#111" d="M140 100C128 110 30 106 12 62C2 30 10 4 40 4C92 4 140 40 140 100ZM45 57a40 44 0 1 0 80 0a40 44 0 1 0-80 0Z"/>';
D.dpmask = { name: 'Mặt nạ Deadpool', slot: 'eyes', m: { mh: 33 }, parts: ['<svg ' + NS + ' viewBox="0 0 300 118">' + MIRROR(patch) + '</svg>'] };

// mặt nạ sắt Doctor Doom: mày sắt dày gãy góc, sống mũi, tấm má, khe miệng có song chắn và đinh tán
// khung cao hơn (y từ -40 đến 154) để có chỗ cho khe miệng, tâm khung vẫn ở ngang mắt (y 57)
var riv = [[24, 14], [276, 14], [112, 36], [188, 36], [40, 102], [260, 102], [120, 104], [180, 104]].map(function (q) { return '<circle cx="' + q[0] + '" cy="' + q[1] + '" r="3.4"/>'; }).join('');
var slats = ''; for (var sx = 112; sx <= 188; sx += 12) slats += 'M' + sx + ' 122V142';
var brow = 'M2 2L298 2L294 24L178 32L160 44H140L122 32L6 24Z', cheek = 'M16 92L134 96L134 108L104 114L28 110Z';
D.doomplate = { name: 'Mặt nạ Doom', slot: 'eyes', m: { mh: 54 }, parts: ['<svg ' + NS + ' viewBox="0 -40 300 194">' +
  '<g fill="#56616c" stroke="#2a3138" stroke-width="2.5" stroke-linejoin="round"><path d="' + brow + '"/><path d="M140 42H160L166 100H134Z"/><path d="' + cheek + '"/><path transform="translate(300 0) scale(-1 1)" d="' + cheek + '"/>' +
  '<rect x="102" y="118" width="96" height="28" rx="5" fill="#1d2329"/></g>' +
  '<path d="M6 6L294 6" stroke="#c3ccd5" stroke-width="3" stroke-linecap="round"/><path d="M150 44V98" stroke="#8e99a4" stroke-width="2"/>' +
  '<path d="' + slats + '" stroke="#6f7a85" stroke-width="4" stroke-linecap="round"/><g fill="#c3ccd5">' + riv + '</g></svg>'] };

// mũ trùm xanh lá của Doom: cắm sau vòm mặt nên chỉ lộ viền mũ ôm quanh đỉnh và hai bên đầu
// khung theo đơn vị của mặt (bán kính vòm 700): tâm mũ trùng tâm vòm ở (850, 850), mép mũ cách vòm 130, mép trong tối như bóng nếp vải
var hood = (function () {
  var se = function (r) { var d = ''; for (var i = 0; i <= 90; i++) { var a = (-110 + i * 220 / 90) * Math.PI / 180, k = Math.pow(Math.pow(Math.abs(Math.sin(a)), 3.4) + Math.pow(Math.abs(Math.cos(a)), 3.4), -1 / 3.4); d += (i ? 'L' : 'M') + (850 + r * k * Math.sin(a)).toFixed(0) + ' ' + (850 - r * k * Math.cos(a)).toFixed(0); } return d; };
  return '<svg ' + NS + ' viewBox="0 0 1700 1140"><path d="' + se(830) + 'L1700 1140H0Z" fill="#2f6b3a"/>' +
    '<path d="' + se(712) + '" fill="none" stroke="#1d4526" stroke-width="36"/><path d="' + se(805) + '" fill="none" stroke="#3f8a4c" stroke-width="8" stroke-opacity=".7"/>' +
    '<path d="M50 1140C110 1020 150 940 160 860M1650 1140C1590 1020 1550 940 1540 860" fill="none" stroke="#1d4526" stroke-width="22" stroke-linecap="round"/></svg>';
})();
D.doomhood = { name: 'Mũ trùm Doom', slot: 'hair', m: { pos: 'center', back: true, ay: 0.1535, h: [1140, 1092], mh: 120 }, parts: [hood] };

// cánh mũ: phần 0 bên trái (xòe sang trái), phần 1 lật gương
function wing(fill, line) {
  var w = '<path d="M54 78C40 74 18 58 6 30C4 20 4 10 8 2C16 14 26 20 36 22C30 30 32 38 42 40C36 48 40 56 50 58C46 64 50 72 56 70Z" fill="' + fill + '" stroke="' + line + '" stroke-width="1.6" stroke-linejoin="round"/>' +
    '<path d="M12 22C20 36 34 50 52 66M34 24C34 34 40 44 50 50" fill="none" stroke="' + line + '" stroke-width="1.4" stroke-linecap="round"/>';
  return ['<svg ' + NS + ' viewBox="0 0 60 80">' + w + '</svg>', '<svg ' + NS + ' viewBox="0 0 60 80"><g transform="translate(60 0) scale(-1 1)">' + w + '</g></svg>'];
}
D.capwing = { name: 'Cánh mũ Cap', slot: 'ears', m: { ang: [42, 46], ax: [0.9, 0.1], ay: 0.96, rot: 28, h: [150, 190] }, parts: wing('#ffffff', '#b8c4d6') };
D.thorwing = { name: 'Cánh mũ Thor', slot: 'ears', m: { ang: [34, 38], ax: [0.9, 0.1], ay: 0.96, rot: 18, h: [230, 270] }, parts: wing('#dfe6ee', '#7d8a99') };

// ngôi sao trên trán Captain America
D.capstar = { name: 'Ngôi sao Cap', slot: 'hair', m: { pos: 'forehead', ay: 0.5, inset: [80, 130], h: [105, 165], mh: 18 }, parts: ['<svg ' + NS + ' viewBox="0 0 100 100"><path d="M50 4L61 38H97L68 59L79 93L50 72L21 93L32 59L3 38H39Z" fill="#ffffff" stroke="#c9d3e0" stroke-width="2" stroke-linejoin="round"/></svg>'] };

// bùa Mắt Agamotto của Doctor Strange
D.agamotto = { name: 'Mắt Agamotto', slot: 'hair', m: { pos: 'forehead', ay: 0.5, inset: [80, 130], h: [105, 165], mh: 18 }, parts: ['<svg ' + NS + ' viewBox="0 0 100 100"><path d="M50 2L58 10H42ZM50 98L42 90H58ZM2 50L10 42V58ZM98 50L90 58V42Z" fill="#c9932e"/><circle cx="50" cy="50" r="42" fill="#c9932e"/><circle cx="50" cy="50" r="33" fill="#e8b84a"/><path d="M16 50Q50 20 84 50Q50 80 16 50Z" fill="#fff3c4"/><circle cx="50" cy="50" r="13" fill="#3ddc84"/><circle cx="50" cy="50" r="5" fill="#0b3d22"/></svg>'] };

// tóc Hulk: chỏm tóc đen dựng lởm chởm trên đỉnh đầu
D.hulkhair = { name: 'Tóc Hulk', slot: 'hair', m: { pos: 'center', ay: 0.9, h: [130, 190], mh: 22 }, parts: ['<svg ' + NS + ' viewBox="0 0 200 80"><path d="M8 80C12 52 28 42 40 46L46 20L62 40L74 6L90 36L104 2L116 34L134 8L142 38L162 18L162 46C176 44 190 56 194 80Z" fill="#1c1c1c"/></svg>'] };

// họa tiết nền: mạng nhện, sao năm cánh, tia sét
var web = (function () {
  var c = 30, rays = '', rings = '';
  for (var i = 0; i < 8; i++) { var a = i * Math.PI / 4; rays += 'M30 30L' + (c + 42 * Math.cos(a)).toFixed(1) + ' ' + (c + 42 * Math.sin(a)).toFixed(1); }
  [9, 18, 27].forEach(function (r) {
    for (var i = 0; i < 8; i++) {
      var a0 = i * Math.PI / 4, a1 = (i + 1) * Math.PI / 4, am = (a0 + a1) / 2;
      rings += (i ? '' : 'M' + (c + r * Math.cos(a0)).toFixed(1) + ' ' + (c + r * Math.sin(a0)).toFixed(1)) + 'Q' + (c + r * 0.8 * Math.cos(am)).toFixed(1) + ' ' + (c + r * 0.8 * Math.sin(am)).toFixed(1) + ' ' + (c + r * Math.cos(a1)).toFixed(1) + ' ' + (c + r * Math.sin(a1)).toFixed(1);
    }
  });
  return '<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60"><path d="' + rays + rings + '" fill="none" stroke="#C0FFEE" stroke-width="1.2"/></svg>';
})();
function star(x, y, s) { var p = [[50, 4], [61, 38], [97, 38], [68, 59], [79, 93], [50, 72], [21, 93], [32, 59], [3, 38], [39, 38]]; return 'M' + p.map(function (q) { return (x + q[0] * s / 100).toFixed(1) + ' ' + (y + q[1] * s / 100).toFixed(1); }).join('L') + 'Z'; }
P.spiderweb = { name: 'Mạng nhện', svg: web };
P.stars5 = { name: 'Sao năm cánh', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><path fill="#C0FFEE" d="' + star(3, 3, 13) + star(23, 23, 13) + '"/></svg>' };
P.bolts = { name: 'Tia sét', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><path fill="#C0FFEE" d="M13 1L5 15H11L7 25L19 10H13L17 1Z M33 21L26 32H31L28 39L38 27H33L36 21Z"/></svg>' };
})();
