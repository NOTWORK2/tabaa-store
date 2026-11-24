// النسخة الثابتة (GitHub Pages): لا يوجد خادم.
// بيانات المتجر لقطة محفوظة في catalog.json وقت النشر، والطلب يُحفظ في متصفح الزبون ويُرسل إلى المتجر عبر واتساب.
// هذا الملف يحاكي مسارات الخادم التي تستعملها واجهة الزبون فقط. لوحة الإدارة غير متاحة في هذه النسخة.

const BASE = import.meta.env.BASE_URL;
const ORDERS_KEY = 'tb:orders';

function fail(message, status = 400, data = {}) {
  const e = new Error(message);
  e.status = status;
  e.data = data;
  throw e;
}

let snapshotPromise = null;
function snapshot() {
  snapshotPromise ??= fetch(`${BASE}catalog.json`, { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error('catalog'))))
    .catch(() => {
      snapshotPromise = null;
      fail('تعذّر تحميل بيانات المتجر. تحقق من الإنترنت ثم حاول مجددًا', 0);
    });
  return snapshotPromise;
}

const sizeLabel = (s) => (String(s).startsWith('مقاس') ? String(s) : `مقاس ${s}`);
function money(fils) {
  const v = Math.abs(fils) / 100;
  return `${fils < 0 ? '‎−' : ''}${Number.isInteger(v) ? v : v.toFixed(2)} د.إ`;
}
const latin = (s) => String(s ?? '')
  .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
  .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));

function normPhone(raw) {
  let s = latin(raw).replace(/[^\d+]/g, '');
  if (s.startsWith('00')) s = `+${s.slice(2)}`;
  if (/^05\d{8}$/.test(s)) s = `+971${s.slice(1)}`;
  else if (/^5\d{8}$/.test(s)) s = `+971${s}`;
  else if (/^971\d{9}$/.test(s)) s = `+${s}`;
  const digits = s.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) return null;
  return s.startsWith('+') ? `+${digits}` : digits;
}

function text(v, label, { max = 200, required = true } = {}) {
  const s = String(v ?? '').trim();
  if (!s && required) fail(`يرجى إدخال ${label}`);
  if (s.length > max) fail(`${label}: النص أطول من المسموح (${max} حرفًا)`);
  return s;
}

/* ───── السلة: نفس قواعد الخادم، محسوبة من اللقطة ───── */

function resolveLine(snap, it) {
  const qty = Math.floor(Number(it?.qty));
  const base = {
    key: `${it?.productId}|${it?.colorId}|${it?.size}|${it?.designId}`,
    productId: Number(it?.productId), colorId: Number(it?.colorId), size: String(it?.size ?? ''),
    designId: Number(it?.designId), qty: Number.isFinite(qty) ? qty : 0,
  };
  const entry = Object.values(snap.categories).find((c) => c.products.some((p) => p.id === base.productId));
  const p = entry?.products.find((x) => x.id === base.productId);
  const color = p?.colors.find((c) => c.id === base.colorId);
  if (!p || !color || !p.sizes.includes(base.size)) {
    return { ...base, error: 'unavailable', message: 'هذه القطعة لم تعد متوفرة في المتجر' };
  }
  const line = {
    ...base,
    productName: p.name, categoryName: entry.category.name, categoryId: entry.category.id,
    colorName: color.name, colorHex: color.hex, image: color.image, printArea: p.printArea,
    unitPrice: p.price, available: Math.max(0, Number(color.stock?.[base.size]) || 0),
  };
  const d = entry.designs.find((x) => x.id === base.designId);
  if (!d) return { ...line, error: 'unavailable', message: 'التصميم المختار لم يعد متوفرًا لهذه القطعة' };
  Object.assign(line, {
    designName: d.name, designImage: d.image, designThumb: d.thumb, designWidth: d.width, designHeight: d.height,
    printPrice: d.printPrice, itemPrice: p.price + d.printPrice, lineTotal: (p.price + d.printPrice) * Math.max(base.qty, 0),
  });
  if (!(base.qty >= 1 && base.qty <= 99)) return { ...line, error: 'qty', message: 'الكمية غير صالحة' };
  if (line.available <= 0) return { ...line, error: 'out_of_stock', message: `نفد مخزون ${color.name} ${sizeLabel(base.size)}` };
  if (base.qty > line.available) {
    return { ...line, error: 'insufficient', message: `المتوفر من ${color.name} ${sizeLabel(base.size)} هو ${line.available} فقط` };
  }
  return line;
}

function resolveCart(snap, items) {
  const lines = (Array.isArray(items) ? items : []).slice(0, 40).map((it) => resolveLine(snap, it));
  const used = new Map();
  for (const l of lines) {
    if (l.error) continue;
    const k = `${l.productId}|${l.colorId}|${l.size}`;
    const total = (used.get(k) || 0) + l.qty;
    used.set(k, total);
    if (total > l.available) {
      l.error = 'insufficient';
      l.message = `مجموع الكمية المطلوبة من ${l.colorName} ${sizeLabel(l.size)} يتجاوز المتوفر (${l.available})`;
    }
  }
  return lines;
}

/* ───── الطلبات: تُحفظ في متصفح الزبون فقط ───── */

function readOrders() {
  try { return JSON.parse(localStorage.getItem(ORDERS_KEY)) || []; } catch { return []; }
}
function writeOrders(list) {
  try { localStorage.setItem(ORDERS_KEY, JSON.stringify(list.slice(-30))); } catch { /* تخزين المتصفح ممتلئ أو معطّل */ }
}

function whatsappText(o) {
  const L = [`السلام عليكم، هذا طلبي رقم ${o.number}`, `الاسم: ${o.customerName}`, `الهاتف: ${o.customerPhone}`, ''];
  o.items.forEach((it, i) => {
    L.push(`${i + 1}. ${it.productName} — ${it.colorName} — ${sizeLabel(it.size)}`);
    L.push(`التصميم: ${it.designName} | الكمية: ${it.qty} | المجموع: ${money(it.lineTotal)}`);
    L.push('');
  });
  L.push(`عنوان التوصيل: ${o.zoneName}، ${o.address}`);
  L.push(`رسوم التوصيل: ${money(o.deliveryFee)}`);
  L.push(`الإجمالي: ${money(o.total)}`);
  L.push(`طريقة الدفع: ${o.paymentLabel}`);
  if (o.notes) L.push(`ملاحظات: ${o.notes}`);
  return L.join('\n');
}

function publicOrder(snap, o) {
  const message = whatsappText(o);
  const number = String(snap.store.store.whatsapp || '').replace(/\D/g, '');
  return {
    ...o, whatsappText: message,
    whatsappUrl: number ? `https://wa.me/${number}?text=${encodeURIComponent(message)}` : null,
  };
}

function randomHex(bytes) {
  return [...crypto.getRandomValues(new Uint8Array(bytes))].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function createOrder(snap, b = {}) {
  const requestId = String(b.requestId || '');
  if (!/^[\w-]{8,80}$/.test(requestId)) fail('طلب غير صالح. حدّث الصفحة وحاول مجددًا');
  const orders = readOrders();
  const existing = orders.find((o) => o.requestId === requestId);
  if (existing) return { order: publicOrder(snap, existing), duplicate: true };

  const name = text(b.name, 'الاسم', { max: 80 });
  const phone = normPhone(b.phone);
  if (!phone) fail('رقم الهاتف غير صالح. مثال: 0501234567');
  const zone = snap.store.zones.find((z) => z.id === Number(b.zoneId));
  if (!zone) fail('يرجى اختيار منطقة التوصيل');
  const address = text(b.address, 'عنوان التوصيل', { max: 300 });
  const notes = text(b.notes, 'الملاحظات', { max: 500, required: false });
  const payment = snap.store.payments.find((p) => p.key === b.paymentMethod);
  if (!payment) fail('يرجى اختيار طريقة الدفع');

  const lines = resolveCart(snap, b.items);
  if (!lines.length) fail('السلة فارغة');
  if (lines.some((l) => l.error)) {
    fail('بعض القطع في السلة لم تعد متاحة بالكمية المطلوبة. راجع السلة ثم أعد التأكيد', 409, { lines });
  }
  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
  const total = subtotal + zone.fee;
  if (b.expectedTotal !== undefined && Number(b.expectedTotal) !== total) {
    fail('تغيّر السعر أو رسوم التوصيل منذ فتح الصفحة. راجع الإجمالي الجديد ثم أكّد الطلب', 409, { priceChanged: true });
  }

  const today = new Date(Date.now() + 4 * 3600000).toISOString().slice(2, 10).replaceAll('-', '');
  const order = {
    number: `TB-${today}-${randomHex(2).toUpperCase()}`, token: randomHex(12), requestId,
    createdAt: new Date().toISOString(), status: 'draft', statusLabel: 'بانتظار إرساله إلى المتجر عبر واتساب',
    customerName: name, customerPhone: phone, zoneName: zone.name, address, notes, paymentLabel: payment.label,
    subtotal, discount: 0, deliveryFee: zone.fee, total, returnRequests: [],
    items: lines.map((l, i) => ({
      id: i + 1, productName: l.productName, categoryName: l.categoryName, colorName: l.colorName, colorHex: l.colorHex,
      size: l.size, designName: l.designName, qty: l.qty, unitPrice: l.unitPrice, printPrice: l.printPrice, lineTotal: l.lineTotal,
      // لا يوجد خادم يركّب صورة المعاينة، فنحفظ مكوّناتها لتُعرض كما رآها الزبون
      previewImage: null, mock: { image: l.image, design: l.designImage, area: l.printArea },
    })),
  };
  writeOrders([...orders, order]);
  return { order: publicOrder(snap, order) };
}

export async function staticApi(path, { method = 'GET', body } = {}) {
  if (path.startsWith('/admin')) fail('لوحة الإدارة غير متاحة في هذه النسخة من الموقع', 404);
  const snap = await snapshot();
  const [route, query = ''] = path.split('?');
  const parts = route.split('/').filter(Boolean).map(decodeURIComponent);

  if (method === 'GET' && route === '/store') {
    const music = snap.store.music?.url
      ? { ...snap.store.music, url: `${BASE}${snap.store.music.url.replace(/^\//, '')}` }
      : snap.store.music;
    return { ...snap.store, music };
  }
  if (method === 'GET' && parts[0] === 'categories' && parts.length === 2) {
    return snap.categories[parts[1]] || fail('نوع اللباس غير موجود', 404);
  }
  if (method === 'POST' && route === '/cart/quote') {
    const lines = resolveCart(snap, body?.items);
    return {
      lines,
      subtotal: lines.reduce((s, l) => s + (l.error === 'unavailable' ? 0 : l.lineTotal || 0), 0),
      ok: lines.length > 0 && lines.every((l) => !l.error),
    };
  }
  if (method === 'POST' && route === '/orders') return createOrder(snap, body);
  if (method === 'GET' && parts[0] === 'orders' && parts.length === 2) {
    const token = new URLSearchParams(query).get('t');
    const order = readOrders().find((o) => o.number === parts[1] && o.token === token);
    return order ? { order: publicOrder(snap, order) } : fail('هذا الطلب محفوظ في المتصفح الذي أُنشئ منه فقط. افتح الرابط من نفس الجهاز', 404);
  }
  if (method === 'POST' && parts[0] === 'orders' && parts[2] === 'returns') {
    fail('طلبات الاستبدال والإرجاع تُرسل إلى المتجر عبر واتساب');
  }
  return fail('المسار غير موجود', 404);
}
