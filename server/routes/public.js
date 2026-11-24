import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import { data, save, nextId, now, getSetting } from '../store.js';
import { fail, text, normPhone, todayLocal } from '../util.js';
import { storefrontCategories, publicProduct, publicDesign, designsFor, resolveCart, publicLine } from '../lib/catalog.js';
import { publicOrder, addEvent } from '../lib/orders.js';
import { featuredPrints } from '../print-collection.js';
import { socialPlatforms } from '../../shared/social.js';
import { composePreview, publicPath, privatePath, removeFiles } from '../media.js';

export const router = Router();

function publicMusic() {
  const m = getSetting('music');
  if (!m.enabled || !m.source) return null;
  if (m.source === 'file' && m.file) return { source: 'file', url: `/media/${m.file}`, volume: m.volume };
  if (m.source === 'youtube' && m.youtubeId) return { source: 'youtube', youtubeId: m.youtubeId, volume: m.volume };
  return null;
}

router.get('/store', (req, res) => {
  const s = getSetting('store');
  const categories = storefrontCategories();
  let hero = null;
  for (const category of categories) {
    const product = data.products.find((p) => p.active && p.categoryId === category.id && p.colors[0]?.image);
    const design = designsFor(category.id)[0];
    if (product && design) {
      hero = { image: product.colors[0].image, design: design.fileWeb, printArea: product.printArea };
      break;
    }
  }
  res.json({
    store: { name: s.name, tagline: s.tagline, logo: s.logo, primary: s.primary, secondary: s.secondary,
      phone: s.phone, email: s.email, address: s.address, whatsapp: s.whatsapp,
      ...Object.fromEntries(socialPlatforms.map(({ key }) => [key, s[key]])) },
    payments: getSetting('payments').filter((p) => p.enabled).map(({ key, label }) => ({ key, label })),
    zones: data.zones.filter((z) => z.active).sort((a, b) => a.sortOrder - b.sortOrder).map(({ id, name, fee }) => ({ id, name, fee })),
    music: publicMusic(),
    categories, hero, featured: featuredPrints(),
  });
});

router.get('/categories/:slug', (req, res) => {
  const cat = data.categories.find((c) => c.slug === req.params.slug && c.visible);
  if (!cat) fail('نوع اللباس غير موجود', 404);
  const products = data.products.filter((p) => p.active && p.categoryId === cat.id && p.colors.length);
  res.json({
    category: { id: cat.id, slug: cat.slug, name: cat.name },
    products: products.map(publicProduct),
    designs: designsFor(cat.id).map(publicDesign),
  });
});

router.post('/cart/quote', (req, res) => {
  const lines = resolveCart(req.body?.items);
  res.json({
    lines: lines.map(publicLine),
    subtotal: lines.reduce((s, l) => s + (l.error === 'unavailable' ? 0 : l.lineTotal || 0), 0),
    ok: lines.length > 0 && lines.every((l) => !l.error),
  });
});

router.post('/orders', async (req, res) => {
  const b = req.body || {};
  const requestId = String(b.requestId || '');
  if (!/^[\w-]{8,80}$/.test(requestId)) fail('طلب غير صالح. حدّث الصفحة وحاول مجددًا');

  // منع التكرار: نفس معرّف المحاولة يعيد الطلب المحفوظ نفسه دون إنشاء طلب ثانٍ
  const dup = () => data.orders.find((o) => o.requestId === requestId);
  if (dup()) return res.json({ order: publicOrder(dup()), duplicate: true });

  const name = text(b.name, 'الاسم', { max: 80 });
  const phone = normPhone(b.phone);
  if (!phone) fail('رقم الهاتف غير صالح. مثال: 0501234567');
  const zone = data.zones.find((z) => z.id === Number(b.zoneId) && z.active);
  if (!zone) fail('يرجى اختيار منطقة التوصيل');
  const address = text(b.address, 'عنوان التوصيل', { max: 300 });
  const notes = text(b.notes, 'الملاحظات', { max: 500, required: false });
  const payment = getSetting('payments').find((p) => p.enabled && p.key === b.paymentMethod);
  if (!payment) fail('يرجى اختيار طريقة الدفع');

  const check = () => {
    const lines = resolveCart(b.items);
    if (!lines.length) fail('السلة فارغة');
    if (lines.some((l) => l.error)) {
      fail('بعض القطع في السلة لم تعد متاحة بالكمية المطلوبة. راجع السلة ثم أعد التأكيد', 409, { lines: lines.map(publicLine) });
    }
    const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
    const total = subtotal + zone.fee;
    if (b.expectedTotal !== undefined && Number(b.expectedTotal) !== total) {
      fail('تغيّر السعر أو رسوم التوصيل منذ فتح الصفحة. راجع الإجمالي الجديد ثم أكّد الطلب', 409, { priceChanged: true });
    }
    return { lines, subtotal, total };
  };

  // 1) تحقق أولي ثم تجهيز ملفات الطلب (معاينة كل قطعة + نسخة ملف الطباعة)
  const first = check();
  const token = crypto.randomBytes(12).toString('hex');
  const created = [];
  let files;
  try {
    files = await Promise.all(first.lines.map(async (l, i) => {
      const preview = `orders/${token}-${i + 1}.webp`;
      await composePreview(l.image, l.designImage, l.printArea, preview);
      created.push(publicPath(preview));
      const printFile = `orders/${token}-${i + 1}${path.extname(l.printFile)}`;
      fs.copyFileSync(privatePath(l.printFile), privatePath(printFile));
      created.push(privatePath(printFile));
      return { preview, printFile };
    }));
  } catch (e) {
    removeFiles(...created);
    throw e;
  }

  // 2) القسم الذرّي (متزامن بلا انتظار): إعادة التحقق ثم خصم المخزون وحفظ الطلب
  try {
    if (dup()) {
      removeFiles(...created);
      return res.json({ order: publicOrder(dup()), duplicate: true });
    }
    const { lines, subtotal, total } = check();
    const same = lines.length === first.lines.length && lines.every((l, i) =>
      l.key === first.lines[i].key && l.designImage === first.lines[i].designImage && l.image === first.lines[i].image);
    if (!same) fail('تغيّرت بيانات المنتج أثناء تأكيد الطلب. حاول مجددًا', 409);

    for (const l of lines) {
      const color = data.products.find((p) => p.id === l.productId).colors.find((c) => c.id === l.colorId);
      color.stock[l.size] -= l.qty;
    }
    let customer = data.customers.find((c) => c.phone === phone);
    if (customer) customer.name = name;
    else {
      customer = { id: nextId('customers'), name, phone, createdAt: now() };
      data.customers.push(customer);
    }
    const id = nextId('orders');
    const order = {
      id, number: `TB-${todayLocal().slice(2).replaceAll('-', '')}-${String(id).padStart(4, '0')}`,
      token, requestId, customerId: customer.id, customerName: name, customerPhone: phone,
      zoneName: zone.name, address, notes, paymentMethod: payment.key, paymentLabel: payment.label,
      subtotal, discount: 0, deliveryFee: zone.fee, total,
      status: 'new', paymentStatus: 'unpaid', paidAmount: 0, refundedAmount: 0, restocked: false,
      printedAt: null, paidAt: null, costAt: null, cancelledAt: null, createdAt: now(),
      // نسخة كاملة وقت الشراء: لا تتأثر بتعديل المنتج أو التصميم أو حذفهما لاحقًا
      items: lines.map((l, i) => ({
        id: i + 1, productId: l.productId, colorId: l.colorId, designId: l.designId,
        productName: l.productName, categoryName: l.categoryName, colorName: l.colorName, colorHex: l.colorHex,
        size: l.size, designName: l.designName, qty: l.qty,
        unitPrice: l.unitPrice, printPrice: l.printPrice, unitCost: l.unitCost, printCost: l.printCost, lineTotal: l.lineTotal,
        previewImage: files[i].preview, printFile: files[i].printFile, printFileName: l.printFileName,
        printArea: l.printArea, designWidth: l.designWidth, designHeight: l.designHeight,
      })),
      events: [], payments: [],
    };
    addEvent(order, 'created', 'أنشأ الزبون الطلب من المتجر');
    data.orders.push(order);
    save('products', 'customers', 'orders');
    res.status(201).json({ order: publicOrder(order) });
  } catch (e) {
    removeFiles(...created);
    throw e;
  }
});

function findPrivateOrder(number, token) {
  const order = data.orders.find((entry) => entry.number === number);
  if (!order || typeof token !== 'string' || !/^[0-9a-f]{24}$/.test(token) ||
      !crypto.timingSafeEqual(Buffer.from(token), Buffer.from(order.token))) fail('الطلب غير موجود', 404);
  return order;
}

router.get('/orders/:number', (req, res) => {
  res.json({ order: publicOrder(findPrivateOrder(req.params.number, req.query.t)) });
});

router.post('/orders/:number/returns', (req, res) => {
  const order = findPrivateOrder(req.params.number, req.body?.token);
  const { kind, note, itemId, quantity, requestId = '' } = req.body;
  if (requestId && (typeof requestId !== 'string' || !/^[\w-]{8,80}$/.test(requestId))) fail('معرّف الطلب غير صالح');
  const item = order.items.find((entry) => entry.id === itemId);
  if (!item) fail('اختر قطعة من هذا الطلب');
  if (kind !== 'return' && kind !== 'exchange') fail('اختر الإرجاع أو الاستبدال');
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > item.qty) fail('راجع عدد القطع');
  const detail = text(note, 'تفاصيل الطلب', { max: 500 });
  const requests = order.events.filter((event) => event.type === 'return_request');
  const sameDetails = (event) => event.itemId === itemId && event.kind === kind && event.quantity === quantity && event.detail === detail;
  const existing = requests.find((event) => requestId ? event.requestId === requestId : sameDetails(event));
  if (existing) {
    if (sameDetails(existing)) return res.json({ order: publicOrder(order) });
    fail('تغيّرت تفاصيل طلبك. راجع الطلب وحاول مجددًا.', 409, { order: publicOrder(order) });
  }
  const requested = requests.filter((entry) => entry.itemId === itemId).reduce((sum, entry) => sum + entry.quantity, 0);
  if (quantity + requested > item.qty) fail('هذه الكمية مشمولة في طلب سابق. راجع الكمية المتبقية.', 409, { order: publicOrder(order) });
  if (order.status === 'cancelled') fail('هذا الطلب ملغى', 409);
  const label = kind === 'exchange' ? 'استبدال' : 'إرجاع';
  addEvent(order, 'return_request', `طلب ${label} · ${item.productName} · ${item.colorName} · ${item.size} · ${item.designName} · العدد ${quantity} — ${detail}`);
  Object.assign(order.events.at(-1), { itemId, kind, quantity, detail, requestId });
  try {
    save('orders');
  } catch (error) {
    order.events.pop();
    throw error;
  }
  res.status(201).json({ order: publicOrder(order) });
});
