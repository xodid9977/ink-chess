// 앱 아이콘 PNG 만들기 (외부 라이브러리 없이): 종이색 바탕에 먹으로 칠한 폰
// 사용: node scripts/make-icons.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const PAPER = [241, 238, 231];
const INK = [20, 17, 15];

// 폰 반쪽 윤곽 [y(0=바닥,1=위), 반지름] — src/render/shapes.ts의 폰과 같은 비율
const prof = [[0, .26], [.035, .26], [.055, .235], [.07, .2], [.088, .2], [.105, .17], [.16, .135], [.25, .095], [.285, .085], [.3, .13], [.322, .13], [.338, .085], [.35, .076]];
for (let a = -45; a <= 90; a += 5) { const t = a * Math.PI / 180; prof.push([.44 + .105 * Math.sin(t), .105 * Math.cos(t)]); }
const radiusAt = (y) => {
  for (let i = 0; i < prof.length - 1; i++) {
    const [y0, r0] = prof[i]; const [y1, r1] = prof[i + 1];
    if ((y >= y0 && y <= y1) || (y <= y0 && y >= y1)) return y1 === y0 ? Math.max(r0, r1) : r0 + (r1 - r0) * (y - y0) / (y1 - y0);
  }
  return -1;
};

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function icon(size, pad) {
  const ss = 3; // 슈퍼샘플링
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const H = size * (1 - pad * 2); // 폰 높이 영역
  const base = size * (1 - pad) - size * 0.04;
  const unit = H / 0.56;
  for (let py = 0; py < size; py++) {
    raw[py * (size * 4 + 1)] = 0;
    for (let px = 0; px < size; px++) {
      let ink = 0;
      for (let sy = 0; sy < ss; sy++) for (let sx = 0; sx < ss; sx++) {
        const x = px + (sx + 0.5) / ss;
        const y = py + (sy + 0.5) / ss;
        const ny = (base - y) / unit;
        const r = ny >= 0 && ny <= 0.546 ? radiusAt(ny) : -1;
        const nx = Math.abs(x - size / 2) / unit;
        if (r > 0 && nx <= r) {
          // 왼쪽 빛, 오른쪽 그늘 (먹 농도)
          const shade = (x - size / 2) / (r * unit);
          const edge = r - nx < 0.012 ? 1 : 0;
          ink += edge ? 1 : 0.62 + 0.3 * Math.max(-1, Math.min(1, shade)) * 0.5 + 0.15;
        }
      }
      ink = Math.min(1, ink / (ss * ss));
      // 종이 결
      const grain = 1 + (Math.sin(px * 12.9898 + py * 78.233) * 43758.5453 % 1) * 0.03;
      const o = py * (size * 4 + 1) + 1 + px * 4;
      for (let c = 0; c < 3; c++) raw[o + c] = Math.max(0, Math.min(255, (PAPER[c] * (1 - ink) + INK[c] * ink) * grain));
      raw[o + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

mkdirSync('public/icons', { recursive: true });
writeFileSync('public/icons/icon-192.png', icon(192, 0.14));
writeFileSync('public/icons/icon-512.png', icon(512, 0.14));
writeFileSync('public/icons/maskable-512.png', icon(512, 0.24)); // 안드로이드 둥근 아이콘용 여백
writeFileSync('public/icons/apple-180.png', icon(180, 0.14));
console.log('icons written');
