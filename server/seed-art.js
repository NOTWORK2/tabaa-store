// رسومات نموذجية (SVG) لقطع الملابس والتصاميم الأولية. يستبدلها المدير بصور حقيقية من لوحة الإدارة.

function mix(hex, target, t) {
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const a = p(hex), b = p(target);
  return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0')).join('');
}
function tones(base) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(base.slice(i, i + 2), 16) / 255);
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum < 0.2
    ? { base, dark: mix(base, '#000000', 0.35), line: mix(base, '#ffffff', 0.32) }
    : { base, dark: mix(base, '#000000', 0.16), line: mix(base, '#000000', 0.42) };
}

const wrap = (inner) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="1200" height="1200">
<defs>
<linearGradient id="sh" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".17"/><stop offset=".24" stop-color="#000" stop-opacity="0"/><stop offset=".76" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".2"/></linearGradient>
<linearGradient id="hl" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".12"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".12"/></linearGradient>
<filter id="drop" x="-10%" y="-10%" width="120%" height="125%"><feDropShadow dx="0" dy="16" stdDeviation="18" flood-color="#2a2118" flood-opacity=".2"/></filter>
</defs>
<g filter="url(#drop)">${inner}</g></svg>`;

const body = (d, c, fill = c.base) =>
  `<path d="${d}" fill="${fill}"/><path d="${d}" fill="url(#sh)"/><path d="${d}" fill="url(#hl)"/><path d="${d}" fill="none" stroke="${c.line}" stroke-width="5" stroke-linejoin="round"/>`;
const flat = (d, fill, c) => `<path d="${d}" fill="${fill}" stroke="${c.line}" stroke-width="4" stroke-linejoin="round"/>`;
const seam = (d, c, w = 4, dash = '') =>
  `<path d="${d}" fill="none" stroke="${c.line}" stroke-width="${w}" stroke-linecap="round" opacity=".75"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;

const TORSO = 'M392 200 L270 240 C215 262 190 320 178 395 L110 770 L222 800 L292 480 L292 850 Q500 872 708 850 L708 480 L778 800 L890 770 L822 395 C810 320 785 262 730 240 L608 200 Q500 292 392 200 Z';

const GARMENTS = {
  tshirt(c) {
    const B = 'M385 150 L250 200 L105 335 L205 440 L290 372 L290 850 Q500 880 710 850 L710 372 L795 440 L895 335 L750 200 L615 150 Q500 245 385 150 Z';
    return flat('M385 150 Q500 196 615 150 Q500 245 385 150 Z', c.dark, c) + body(B, c)
      + `<path d="M385 150 Q500 245 615 150" fill="none" stroke="${c.dark}" stroke-width="18" stroke-linecap="round"/>`
      + seam('M378 156 Q500 262 622 156', c) + seam('M250 200 Q276 290 290 372', c) + seam('M750 200 Q724 290 710 372', c)
      + seam('M122 318 L221 424', c, 3, '10 9') + seam('M878 318 L779 424', c, 3, '10 9') + seam('M294 826 Q500 856 706 826', c, 3, '10 9');
  },
  hoodie(c) {
    const HOOD = 'M392 208 C346 120 418 58 500 58 C582 58 654 120 608 208 C570 252 430 252 392 208 Z';
    return body(HOOD, c) + flat('M424 198 C402 132 452 98 500 98 C548 98 598 132 576 198 Q500 262 424 198 Z', c.dark, c)
      + body(TORSO, c) + seam('M392 200 Q500 292 608 200', c, 6)
      + seam('M385 640 L615 640 L655 790 L345 790 Z', c) + seam('M121 716 L233 746', c) + seam('M879 716 L767 746', c)
      + seam('M292 806 Q500 828 708 806', c) + seam('M270 240 Q290 360 292 480', c) + seam('M730 240 Q710 360 708 480', c)
      + `<path d="M470 262 L463 398 M530 262 L537 398" stroke="${c.line}" stroke-width="7" stroke-linecap="round" fill="none"/>`;
  },
  sweatshirt(c) {
    return flat('M392 200 Q500 238 608 200 Q500 292 392 200 Z', c.dark, c) + body(TORSO, c)
      + `<path d="M392 200 Q500 292 608 200" fill="none" stroke="${c.dark}" stroke-width="20" stroke-linecap="round"/>`
      + seam('M384 206 Q500 312 616 206', c) + seam('M470 300 L500 348 L530 300', c, 3)
      + seam('M121 716 L233 746', c) + seam('M879 716 L767 746', c) + seam('M292 806 Q500 828 708 806', c)
      + seam('M270 240 Q290 360 292 480', c) + seam('M730 240 Q710 360 708 480', c);
  },
  jacket(c) {
    return flat('M392 200 Q500 238 608 200 Q500 292 392 200 Z', c.dark, c) + body(TORSO, c)
      + flat('M292 800 Q500 822 708 800 L708 850 Q500 872 292 850 Z', c.dark, c)
      + flat('M118 725 L230 755 L222 800 L110 770 Z', c.dark, c) + flat('M882 725 L770 755 L778 800 L890 770 Z', c.dark, c)
      + `<path d="M392 200 Q500 292 608 200" fill="none" stroke="${c.dark}" stroke-width="30" stroke-linecap="round"/>`
      + seam('M380 208 Q500 318 620 208', c)
      + `<path d="M500 252 L500 862" stroke="${c.line}" stroke-width="11" fill="none"/><path d="M500 252 L500 862" stroke="${c.base}" stroke-width="3" stroke-dasharray="7 7" fill="none"/>`
      + seam('M362 610 L338 722', c, 6) + seam('M638 610 L662 722', c, 6)
      + seam('M270 240 Q290 360 292 480', c) + seam('M730 240 Q710 360 708 480', c);
  },
  cap(c) {
    const CROWN = 'M245 540 C240 330 370 235 500 235 C630 235 760 330 755 540 Q500 480 245 540 Z';
    const BRIM = 'M245 540 Q500 480 755 540 C810 585 840 640 828 672 C700 622 300 622 172 672 C160 640 190 585 245 540 Z';
    return body(CROWN, c) + body(BRIM, c, c.dark)
      + seam('M500 235 L500 492', c, 3) + seam('M500 235 C420 280 372 400 368 512', c, 3) + seam('M500 235 C580 280 628 400 632 512', c, 3)
      + seam('M214 642 C330 600 670 600 786 642', c, 3, '10 9')
      + `<circle cx="500" cy="236" r="15" fill="${c.dark}" stroke="${c.line}" stroke-width="4"/><circle cx="415" cy="330" r="6" fill="${c.line}"/><circle cx="585" cy="330" r="6" fill="${c.line}"/>`;
  },
  pants(c) {
    const B = 'M335 120 L665 120 L672 190 L712 880 L545 880 L500 400 L455 880 L288 880 L328 190 Z';
    return body(B, c) + seam('M329 186 L671 186', c) + seam('M500 186 L500 400', c)
      + seam('M500 198 C536 250 536 322 503 362', c, 3) + seam('M400 190 Q386 262 331 292', c) + seam('M600 190 Q614 262 669 292', c)
      + seam('M291 856 L456 856', c, 3, '10 9') + seam('M544 856 L709 856', c, 3, '10 9')
      + `<path d="M388 122 L388 186 M612 122 L612 186 M500 122 L500 186" stroke="${c.line}" stroke-width="9" opacity=".6"/>`;
  },
  shorts(c) {
    const B = 'M310 270 L690 270 L698 335 L760 700 L540 700 L500 500 L460 700 L240 700 L302 335 Z';
    let ribs = '';
    for (let x = 330; x <= 670; x += 20) ribs += `M${x} 280 L${x} 324 `;
    return body(B, c) + seam('M303 332 L697 332', c) + `<path d="${ribs}" stroke="${c.line}" stroke-width="3" opacity=".45"/>`
      + seam('M500 332 L500 500', c) + seam('M385 335 Q372 402 316 430', c) + seam('M615 335 Q628 402 684 430', c)
      + seam('M246 678 L462 678', c, 3, '10 9') + seam('M538 678 L754 678', c, 3, '10 9')
      + `<path d="M482 334 C472 384 462 412 466 446 M518 334 C528 384 538 412 534 446" stroke="${c.line}" stroke-width="6" stroke-linecap="round" fill="none"/>`;
  },
};

export const garmentSvg = (kind, hex) => wrap(GARMENTS[kind](tones(hex)));

const dz = (inner) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="1600" height="1600">${inner}</svg>`;

function pixelHeart() {
  const rows = ['.XX...XX.', 'XXXX.XXXX', 'XXXXXXXXX', 'XXXXXXXXX', '.XXXXXXX.', '..XXXXX..', '...XXX...', '....X....'];
  const s = 70, ox = 85, oy = 120;
  let out = '';
  rows.forEach((r, y) => [...r].forEach((ch, x) => {
    if (ch === 'X') out += `<rect x="${ox + x * s}" y="${oy + y * s}" width="${s}" height="${s}" fill="${y < 2 && x < 4 ? '#ff7a6b' : '#e5322d'}" stroke="#1a1714" stroke-width="8"/>`;
  }));
  return out + `<rect x="${ox + s}" y="${oy + s}" width="${s * 0.5}" height="${s * 0.5}" fill="#fff"/>`;
}

function star8() {
  const sq = (rot, fill) => `<rect x="170" y="170" width="460" height="460" fill="${fill}" stroke="#12403d" stroke-width="14" transform="rotate(${rot} 400 400)"/>`;
  return sq(0, '#1f8a82') + sq(45, '#f2b63c')
    + `<circle cx="400" cy="400" r="150" fill="#fdf6e3" stroke="#12403d" stroke-width="14"/>`
    + `<rect x="318" y="318" width="164" height="164" fill="#1f8a82" stroke="#12403d" stroke-width="12" transform="rotate(45 400 400)"/>`
    + `<circle cx="400" cy="400" r="34" fill="#f2b63c" stroke="#12403d" stroke-width="10"/>`;
}

export const DESIGN_ART = {
  dunes: dz(`<defs><clipPath id="c"><circle cx="400" cy="400" r="330"/></clipPath></defs>
<g clip-path="url(#c)"><rect width="800" height="800" fill="#ffcf5c"/><rect y="250" width="800" height="90" fill="#ffab4a"/><rect y="340" width="800" height="90" fill="#f9744a"/>
<circle cx="400" cy="390" r="150" fill="#fff3d6"/><path d="M0 520 C150 430 290 430 430 520 S700 600 800 500 L800 800 L0 800 Z" fill="#c8502f"/>
<path d="M0 610 C180 520 330 560 470 620 S720 650 800 590 L800 800 L0 800 Z" fill="#8f2f24"/><path d="M0 700 C200 640 380 660 520 700 S740 720 800 690 L800 800 L0 800 Z" fill="#5a1d1c"/></g>
<circle cx="400" cy="400" r="330" fill="none" stroke="#2a1512" stroke-width="18"/>`),
  star: dz(star8()),
  wave: dz(`<defs><clipPath id="c"><circle cx="400" cy="400" r="320"/></clipPath></defs>
<g clip-path="url(#c)"><rect width="800" height="800" fill="#d9f0ff"/><circle cx="560" cy="250" r="80" fill="#ffd166"/>
<path d="M60 520 C140 300 380 240 470 380 C520 460 440 520 380 480 C440 600 640 560 760 440 L800 800 L0 800 Z" fill="#1565c0"/>
<path d="M0 600 C160 520 300 640 460 600 S700 520 800 600 L800 800 L0 800 Z" fill="#0d47a1"/><path d="M0 680 C180 620 320 720 480 680 S720 640 800 690 L800 800 L0 800 Z" fill="#082f6b"/>
<path d="M120 500 C190 350 360 300 440 390" fill="none" stroke="#fff" stroke-width="14" stroke-linecap="round"/></g>
<circle cx="400" cy="400" r="320" fill="none" stroke="#082f6b" stroke-width="18"/>`),
  palm: dz(`<circle cx="400" cy="380" r="250" fill="#ffb347"/><circle cx="400" cy="380" r="250" fill="none" stroke="#14382a" stroke-width="16"/>
<path d="M385 720 C380 560 395 450 425 330 L455 338 C432 455 425 565 435 720 Z" fill="#14382a"/>
<g fill="#1f7a4d" stroke="#14382a" stroke-width="12" stroke-linejoin="round">
<path d="M435 330 C360 250 250 250 180 320 C280 300 360 320 435 330 Z"/><path d="M435 330 C420 220 340 150 240 150 C330 200 390 260 435 330 Z"/>
<path d="M435 330 C470 220 560 170 650 190 C560 220 490 270 435 330 Z"/><path d="M435 330 C520 270 630 290 690 370 C600 330 510 320 435 330 Z"/>
<path d="M435 330 C500 360 540 440 530 520 C500 440 470 380 435 330 Z"/><path d="M435 330 C360 350 310 420 310 500 C350 430 390 380 435 330 Z"/></g>
<path d="M150 720 L650 720" stroke="#14382a" stroke-width="18" stroke-linecap="round"/>`),
  bolt: dz(`<path d="M470 60 L190 440 L370 440 L310 740 L620 330 L430 330 Z" fill="#ffd60a" stroke="#1a1714" stroke-width="30" stroke-linejoin="round"/>
<path d="M452 150 L282 394 L404 394" fill="none" stroke="#fff" stroke-width="16" stroke-linecap="round" stroke-linejoin="round" opacity=".85"/>`),
  heart: dz(pixelHeart()),
};

export const CATEGORY_SEED = [
  { slug: 'tshirt', name: 'تيشيرت (تريكو)', art: 'tshirt', area: { x: 0.345, y: 0.29, w: 0.31, h: 0.36 }, hero: '#f4f1ea' },
  { slug: 'hoodie', name: 'هودي', art: 'hoodie', area: { x: 0.36, y: 0.335, w: 0.28, h: 0.27 }, hero: '#2f4a3c' },
  { slug: 'sweatshirt', name: 'سويت شيرت', art: 'sweatshirt', area: { x: 0.345, y: 0.33, w: 0.31, h: 0.36 }, hero: '#c9c3b8' },
  { slug: 'cap', name: 'قبعة', art: 'cap', area: { x: 0.385, y: 0.3, w: 0.23, h: 0.16 }, hero: '#1c2b4a' },
  { slug: 'pants', name: 'سروال', art: 'pants', area: { x: 0.54, y: 0.25, w: 0.13, h: 0.17 }, hero: '#3a3f47' },
  { slug: 'shorts', name: 'شورت', art: 'shorts', area: { x: 0.555, y: 0.44, w: 0.15, h: 0.17 }, hero: '#d9cbb0' },
  { slug: 'jacket', name: 'جاكيت', art: 'jacket', area: { x: 0.56, y: 0.3, w: 0.12, h: 0.13 }, hero: '#7a2e2a' },
];

const WHITE = ['أبيض', '#f4f1ea'], BLACK = ['أسود', '#1d1d1f'], NAVY = ['كحلي', '#1c2b4a'], SAND = ['رملي', '#d9cbb0'];
const GREY = ['رمادي', '#b9b6b0'], OLIVE = ['زيتي', '#2f4a3c'], MAROON = ['عنابي', '#7a2e2a'], CHAR = ['فحمي', '#3a3f47'];
const APPAREL = ['S', 'M', 'L', 'XL', 'XXL'];

// الأسعار والتكاليف بالدرهم (تُحوَّل إلى فلس عند الحفظ)
export const PRODUCT_SEED = [
  { cat: 'tshirt', name: 'تيشيرت قطن كلاسيكي', price: 59, cost: 22, sizes: APPAREL, colors: [WHITE, BLACK, NAVY, SAND],
    description: 'قطن 100% بوزن 180 غرامًا، قصّة عادية تناسب الاستعمال اليومي.' },
  { cat: 'tshirt', name: 'تيشيرت أوفرسايز ثقيل', price: 79, cost: 31, sizes: ['M', 'L', 'XL'], colors: [BLACK, GREY, OLIVE],
    description: 'قطن ثقيل 240 غرامًا بقصّة واسعة وأكتاف منسدلة.' },
  { cat: 'hoodie', name: 'هودي قطن مبطّن', price: 139, cost: 58, sizes: APPAREL, colors: [OLIVE, BLACK, GREY],
    description: 'هودي دافئ ببطانة ناعمة وجيب أمامي وقبعة برباط.' },
  { cat: 'sweatshirt', name: 'سويت شيرت بياقة دائرية', price: 119, cost: 48, sizes: APPAREL, colors: [GREY, NAVY, MAROON],
    description: 'سويت شيرت قطني متوسط السماكة بأطراف مطاطية.' },
  { cat: 'cap', name: 'قبعة بيسبول', price: 45, cost: 14, sizes: ['مقاس موحّد'], colors: [NAVY, BLACK, SAND],
    description: 'قبعة قطنية بمقاس قابل للتعديل من الخلف. الطباعة على الواجهة.' },
  { cat: 'pants', name: 'سروال رياضي', price: 109, cost: 45, sizes: APPAREL, colors: [CHAR, BLACK],
    description: 'سروال قطني مريح بخصر مطاطي. الطباعة على أعلى الساق.' },
  { cat: 'shorts', name: 'شورت قطني', price: 69, cost: 26, sizes: APPAREL, colors: [SAND, BLACK, NAVY],
    description: 'شورت خفيف برباط عند الخصر. الطباعة على طرف الساق.' },
  { cat: 'jacket', name: 'جاكيت بومبر', price: 189, cost: 85, sizes: ['M', 'L', 'XL'], colors: [MAROON, BLACK],
    description: 'جاكيت بسحّاب أمامي وأطراف مضلّعة. الطباعة على الصدر.' },
];

const ALL = ['tshirt', 'hoodie', 'sweatshirt', 'cap', 'pants', 'shorts', 'jacket'];
const TOPS = ['tshirt', 'hoodie', 'sweatshirt'];
export const DESIGN_SEED = [
  { art: 'dunes', name: 'غروب الكثبان', price: 30, cost: 9, cats: TOPS },
  { art: 'wave', name: 'موجة الخليج', price: 30, cost: 9, cats: TOPS },
  { art: 'palm', name: 'نخلة', price: 25, cost: 8, cats: [...TOPS, 'jacket', 'cap'] },
  { art: 'star', name: 'نجمة أندلسية', price: 25, cost: 7, cats: ALL },
  { art: 'bolt', name: 'برق', price: 20, cost: 6, cats: ALL },
  { art: 'heart', name: 'قلب بكسل', price: 20, cost: 6, cats: ALL },
];

export const ZONE_SEED = [
  ['دبي', 15], ['أبوظبي', 15], ['الشارقة', 15], ['عجمان', 18], ['العين', 20], ['أم القيوين', 20], ['رأس الخيمة', 20], ['الفجيرة', 22],
];
