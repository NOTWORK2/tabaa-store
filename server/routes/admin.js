import { Router } from 'express';
import { PERMISSIONS } from '../config.js';
import { socialPlatforms, socialProfileUrl } from '../../shared/social.js';
import { data, save, nextId, now, byId, getSetting, setSetting } from '../store.js';
import {
  requireStaff, requirePerm, can, createSession, destroySession, dropSessionsOf, currentStaff,
  hashPassword, verifyPassword, staffView, loginThrottle, loginReset,
} from '../auth.js';
import { fail, text, money, int, hexColor, area, isDate, todayLocal, addDays, dayStartUtc, dayEndUtc, toLatinDigits, fmtMoney } from '../util.js';
import {
  uploadImage, uploadAudio, saveSquare, saveLogo, saveDesign, saveAudio, publicExists, removePublic, removePrivate, privatePath,
} from '../media.js';
import { productStock, stockOf } from '../lib/catalog.js';
import { FLOW, STATUS_LABEL, payStatus, addEvent, restock, orderRow, adminOrder, finance } from '../lib/orders.js';

export const router = Router();

/* ───────────── الدخول والجلسة ───────────── */

router.post('/login', (req, res) => {
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');
  const key = `${req.ip}|${username.toLowerCase()}`;
  loginThrottle(key);
  const s = data.staff.find((x) => x.username.toLowerCase() === username.toLowerCase());
  if (!s || !s.active || !verifyPassword(password, s.passwordHash)) fail('اسم المستخدم أو كلمة المرور غير صحيحة', 401);
  loginReset(key);
  createSession(req, res, s.id);
  res.json({ staff: staffView(s) });
});

router.post('/logout', (req, res) => {
  destroySession(req, res);
  res.json({ ok: true });
});

router.get('/session', (req, res) => {
  const staff = currentStaff(req);
  const s = getSetting('store');
  res.json({ staff, store: { name: s.name, logo: s.logo } });
});

router.use(requireStaff);

router.put('/me/password', (req, res) => {
  const s = byId('staff', req.staff.id);
  if (!verifyPassword(String(req.body?.current || ''), s.passwordHash)) fail('كلمة المرور الحالية غير صحيحة');
  const next = String(req.body?.next || '');
  if (next.length < 8) fail('كلمة المرور الجديدة يجب ألا تقل عن 8 أحرف');
  s.passwordHash = hashPassword(next);
  save('staff');
  res.json({ ok: true });
});

// نبض اللوحة: عدّاد الطلبات الجديدة وآخر طلب (يُستعلم دوريًا لإظهار التنبيه)
router.get('/pulse', (req, res) => {
  if (!can(req.staff, 'orders')) return res.json({ newOrders: 0, lastOrderId: 0, latest: null });
  const last = data.orders[data.orders.length - 1];
  res.json({
    newOrders: data.orders.filter((o) => o.status === 'new').length,
    lastOrderId: last?.id || 0,
    latest: last ? { id: last.id, number: last.number, customerName: last.customerName, total: last.total } : null,
  });
});

/* ───────────── رفع الصور ───────────── */

const UPLOAD_PERM = { category: 'categories', product: 'products', logo: 'settings' };
router.post('/upload/:kind', uploadImage, async (req, res) => {
  const perm = UPLOAD_PERM[req.params.kind];
  if (!perm) fail('نوع رفع غير معروف', 404);
  if (!can(req.staff, perm)) fail('ليست لديك صلاحية لهذا الإجراء', 403);
  const buf = req.file?.buffer;
  const rel = req.params.kind === 'logo' ? await saveLogo(buf)
    : await saveSquare(buf, req.params.kind === 'category' ? 'categories' : 'products', req.params.kind === 'category' ? 900 : 1200);
  res.json({ path: rel });
});

const imagePath = (v, dir, label) => {
  if (!v) return null;
  if (typeof v !== 'string' || !new RegExp(`^${dir}/[a-z0-9-]+\\.(webp|png)$`).test(v) || !publicExists(v)) fail(`${label}: صورة غير صالحة`);
  return v;
};

/* ───────────── أنواع الملابس ───────────── */

const DEFAULT_AREA = { x: 0.32, y: 0.26, w: 0.36, h: 0.36 };
const categoryView = (c) => ({
  ...c, productCount: data.products.filter((p) => p.categoryId === c.id).length,
});
const sortedCategories = () => [...data.categories].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);

router.get('/categories', requirePerm('categories', 'products', 'designs'), (req, res) => {
  res.json({ categories: sortedCategories().map(categoryView) });
});

router.post('/categories', requirePerm('categories'), (req, res) => {
  const b = req.body || {};
  const id = nextId('categories');
  const c = {
    id, name: text(b.name, 'اسم النوع', { max: 60 }), slug: `type-${id}`,
    image: imagePath(b.image, 'categories', 'صورة النوع'),
    sortOrder: Math.max(0, ...data.categories.map((x) => x.sortOrder)) + 1,
    visible: b.visible !== false, printArea: DEFAULT_AREA, createdAt: now(),
  };
  data.categories.push(c);
  save('categories');
  res.status(201).json({ category: categoryView(c) });
});

router.put('/categories/:id', requirePerm('categories'), (req, res) => {
  const c = byId('categories', req.params.id);
  if (!c) fail('النوع غير موجود', 404);
  const b = req.body || {};
  if (b.name !== undefined) c.name = text(b.name, 'اسم النوع', { max: 60 });
  if (b.image !== undefined && b.image !== c.image) {
    const old = c.image;
    c.image = imagePath(b.image, 'categories', 'صورة النوع');
    if (old && !old.startsWith('seed/')) removePublic(old);
  }
  if (b.visible !== undefined) c.visible = !!b.visible;
  save('categories');
  res.json({ category: categoryView(c) });
});

router.post('/categories/reorder', requirePerm('categories'), (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number) : [];
  ids.forEach((id, i) => {
    const c = byId('categories', id);
    if (c) c.sortOrder = i + 1;
  });
  save('categories');
  res.json({ categories: sortedCategories().map(categoryView) });
});

router.delete('/categories/:id', requirePerm('categories'), (req, res) => {
  const c = byId('categories', req.params.id);
  if (!c) fail('النوع غير موجود', 404);
  if (data.products.some((p) => p.categoryId === c.id)) fail('لا يمكن حذف نوع مرتبط بمنتجات. انقل منتجاته أو أخفِ النوع من المتجر');
  data.categories = data.categories.filter((x) => x.id !== c.id);
  for (const d of data.designs) d.categoryIds = d.categoryIds.filter((x) => x !== c.id);
  save('categories', 'designs');
  removePublic(c.image);
  res.json({ ok: true });
});

/* ───────────── المنتجات والمخزون ───────────── */

function lowVariants(p, threshold) {
  const out = [];
  for (const c of p.colors) for (const s of p.sizes) {
    const stock = stockOf(c, s);
    if (stock <= threshold) out.push({ colorName: c.name, size: s, stock });
  }
  return out;
}
const productRow = (p, threshold) => ({
  id: p.id, name: p.name, categoryId: p.categoryId, categoryName: byId('categories', p.categoryId)?.name || '—',
  price: p.price, cost: p.cost, active: p.active, image: p.colors[0]?.image || null,
  colors: p.colors.map((c) => ({ name: c.name, hex: c.hex })), sizes: p.sizes,
  stockTotal: productStock(p), low: lowVariants(p, threshold),
});

function readProduct(b, existing) {
  const cat = byId('categories', b.categoryId);
  if (!cat) fail('يرجى اختيار نوع اللباس');
  const sizes = [...new Set((Array.isArray(b.sizes) ? b.sizes : []).map((s) => String(s).trim()).filter(Boolean))];
  if (!sizes.length) fail('أضف مقاسًا واحدًا على الأقل');
  if (sizes.length > 15 || sizes.some((s) => s.length > 12)) fail('المقاسات غير صالحة');
  const colorsIn = Array.isArray(b.colors) ? b.colors : [];
  if (!colorsIn.length) fail('أضف لونًا واحدًا على الأقل مع صورته');
  if (colorsIn.length > 24) fail('عدد الألوان أكبر من المسموح');
  const colors = colorsIn.map((c, i) => {
    const prev = existing?.colors.find((x) => x.id === Number(c.id));
    const name = text(c.name, `اسم اللون رقم ${i + 1}`, { max: 30 });
    const image = imagePath(c.image, '(products|seed)', `صورة اللون «${name}»`);
    if (!image) fail(`ارفع صورة للون «${name}»`);
    return {
      id: prev ? prev.id : nextId('colors'), name, hex: hexColor(c.hex, `اللون «${name}»`), image,
      stock: Object.fromEntries(sizes.map((s) => [s, int(c.stock?.[s] ?? 0, `مخزون ${name} / ${s}`, { max: 100000 })])),
    };
  });
  return {
    categoryId: cat.id,
    name: text(b.name, 'اسم المنتج', { max: 80 }),
    description: text(b.description, 'الوصف', { max: 1000, required: false }),
    price: money(b.price, 'سعر البيع', { min: 1 }),
    cost: money(b.cost, 'تكلفة القطعة'),
    active: b.active !== false,
    printArea: area(b.printArea),
    sizes, colors,
  };
}

router.get('/products', requirePerm('products'), (req, res) => {
  const threshold = getSetting('lowStock');
  res.json({
    threshold,
    products: [...data.products].sort((a, b) => b.id - a.id).map((p) => productRow(p, threshold)),
  });
});

router.get('/products/:id', requirePerm('products'), (req, res) => {
  const p = byId('products', req.params.id);
  if (!p) fail('المنتج غير موجود', 404);
  res.json({ product: p });
});

router.post('/products', requirePerm('products'), (req, res) => {
  const p = { id: nextId('products'), ...readProduct(req.body || {}, null), createdAt: now() };
  data.products.push(p);
  save('products');
  res.status(201).json({ product: p });
});

router.put('/products/:id', requirePerm('products'), (req, res) => {
  const p = byId('products', req.params.id);
  if (!p) fail('المنتج غير موجود', 404);
  const oldImages = p.colors.map((c) => c.image);
  Object.assign(p, readProduct(req.body || {}, p));
  save('products');
  const kept = new Set(data.products.flatMap((x) => x.colors.map((c) => c.image)));
  removePublic(...oldImages.filter((img) => img && !kept.has(img) && !img.startsWith('seed/')));
  res.json({ product: p });
});

router.delete('/products/:id', requirePerm('products'), (req, res) => {
  const p = byId('products', req.params.id);
  if (!p) fail('المنتج غير موجود', 404);
  data.products = data.products.filter((x) => x.id !== p.id);
  save('products');
  const kept = new Set(data.products.flatMap((x) => x.colors.map((c) => c.image)));
  removePublic(...p.colors.map((c) => c.image).filter((img) => img && !kept.has(img) && !img.startsWith('seed/')));
  res.json({ ok: true });
});

// قطع نموذجية لمعاينة التصاميم قبل النشر (لكل نوع: أول قطعة ومساحة طباعتها)
router.get('/preview-garments', requirePerm('designs', 'products'), (req, res) => {
  res.json({
    garments: sortedCategories().map((c) => {
      const p = data.products.find((x) => x.categoryId === c.id && x.colors[0]?.image);
      return p ? { categoryId: c.id, categoryName: c.name, image: p.colors[0].image, printArea: p.printArea,
        colors: p.colors.map((x) => ({ name: x.name, hex: x.hex, image: x.image })) } : null;
    }).filter(Boolean),
  });
});

/* ───────────── مكتبة التصاميم ───────────── */

const designView = (d) => ({
  id: d.id, name: d.name, thumb: d.thumb, image: d.fileWeb, width: d.width, height: d.height,
  printPrice: d.printPrice, printCost: d.printCost, published: d.published, categoryIds: d.categoryIds,
  originalName: d.originalName, createdBy: d.createdBy, createdAt: d.createdAt,
});

function readDesign(b) {
  let ids = b.categoryIds;
  if (typeof ids === 'string') { try { ids = JSON.parse(ids); } catch { ids = []; } }
  const categoryIds = [...new Set((Array.isArray(ids) ? ids : []).map(Number))].filter((id) => byId('categories', id));
  const published = b.published === true || b.published === 'true' || b.published === '1';
  if (published && !categoryIds.length) fail('اختر نوع لباس واحدًا على الأقل قبل النشر');
  return {
    name: text(b.name, 'اسم التصميم', { max: 80 }),
    printPrice: money(b.printPrice, 'سعر الطباعة'),
    printCost: money(b.printCost, 'تكلفة الطباعة'),
    categoryIds, published,
  };
}

router.get('/designs', requirePerm('designs'), (req, res) => {
  res.json({ designs: [...data.designs].sort((a, b) => b.id - a.id).map(designView) });
});

router.post('/designs', requirePerm('designs'), uploadImage, async (req, res) => {
  const fields = readDesign(req.body || {});
  if (!req.file) fail('ارفع صورة التصميم');
  const files = await saveDesign(req.file.buffer, Buffer.from(req.file.originalname, 'latin1').toString('utf8'));
  const d = { id: nextId('designs'), ...fields, ...files, createdBy: req.staff.name, createdAt: now() };
  data.designs.push(d);
  save('designs');
  res.status(201).json({ design: designView(d) });
});

router.put('/designs/:id', requirePerm('designs'), uploadImage, async (req, res) => {
  const d = byId('designs', req.params.id);
  if (!d) fail('التصميم غير موجود', 404);
  const fields = readDesign(req.body || {});
  let old = null;
  if (req.file) {
    const files = await saveDesign(req.file.buffer, Buffer.from(req.file.originalname, 'latin1').toString('utf8'));
    old = { fileOriginal: d.fileOriginal, fileWeb: d.fileWeb, thumb: d.thumb };
    Object.assign(d, files);
  }
  Object.assign(d, fields);
  save('designs');
  if (old) { removePublic(old.fileWeb, old.thumb); removePrivate(old.fileOriginal); }
  res.json({ design: designView(d) });
});

router.delete('/designs/:id', requirePerm('designs'), (req, res) => {
  const d = byId('designs', req.params.id);
  if (!d) fail('التصميم غير موجود', 404);
  data.designs = data.designs.filter((x) => x.id !== d.id);
  save('designs');
  // الطلبات السابقة تحتفظ بنسختها الخاصة من الملف، فحذف التصميم لا يؤثر عليها
  removePublic(d.fileWeb, d.thumb);
  removePrivate(d.fileOriginal);
  res.json({ ok: true });
});

/* ───────────── الطلبات ───────────── */

const digits = (s) => toLatinDigits(s).replace(/\D/g, '').replace(/^0+/, '');

router.get('/orders', requirePerm('orders'), (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  const qd = digits(q);
  const { status, payment, from, to } = req.query;
  const a = isDate(from) ? dayStartUtc(from) : null;
  const b = isDate(to) ? dayEndUtc(to) : null;
  const rows = data.orders.filter((o) => {
    if (status && o.status !== status) return false;
    if (payment && o.paymentStatus !== payment) return false;
    if (a && o.createdAt < a) return false;
    if (b && o.createdAt >= b) return false;
    if (!q) return true;
    return o.number.toLowerCase().includes(q) || o.customerName.toLowerCase().includes(q)
      || (qd.length >= 3 && o.customerPhone.replace(/\D/g, '').includes(qd));
  }).sort((x, y) => y.id - x.id);
  const page = Math.max(1, Number(req.query.page) || 1);
  const size = 25;
  res.json({
    total: rows.length, page, pages: Math.max(1, Math.ceil(rows.length / size)),
    orders: rows.slice((page - 1) * size, page * size).map(orderRow),
    counts: Object.fromEntries(Object.keys(STATUS_LABEL).map((s) => [s, data.orders.filter((o) => o.status === s).length])),
  });
});

const orderOr404 = (id) => byId('orders', id) || fail('الطلب غير موجود', 404);
const sendOrder = (req, res, o) => res.json({ order: adminOrder(o, can(req.staff, 'dashboard')) });

router.get('/orders/:id', requirePerm('orders'), (req, res) => sendOrder(req, res, orderOr404(req.params.id)));

router.post('/orders/:id/status', requirePerm('orders'), (req, res) => {
  const o = orderOr404(req.params.id);
  const next = String(req.body?.status || '');
  if (!FLOW.includes(next)) fail('حالة غير معروفة');
  if (o.status === 'cancelled') fail('الطلب ملغى ولا يمكن تغيير حالته');
  if (o.status === next) return sendOrder(req, res, o);
  const prev = o.status;
  o.status = next;
  if (FLOW.indexOf(next) >= 1 && !o.printedAt) o.printedAt = now();
  if (next === 'new') o.printedAt = null;
  addEvent(o, 'status', `تغيير حالة التنفيذ من «${STATUS_LABEL[prev]}» إلى «${STATUS_LABEL[next]}»`, req.staff.name);
  save('orders');
  sendOrder(req, res, o);
});

router.post('/orders/:id/cancel', requirePerm('orders'), (req, res) => {
  const o = orderOr404(req.params.id);
  if (o.status === 'cancelled') fail('الطلب ملغى مسبقًا');
  if (o.status === 'delivered') fail('الطلب مُسلَّم. استخدم «تسجيل استرجاع» بدل الإلغاء');
  const note = text(req.body?.note, 'سبب الإلغاء', { max: 200, required: false });
  const wasPrinted = !!o.printedAt;
  // قبل الطباعة تعود القطع الخام للمخزون تلقائيًا. بعد الطباعة لا تعود إلا إذا طلب الموظف ذلك صراحة
  const back = !wasPrinted || req.body?.restock === true;
  o.status = 'cancelled';
  o.cancelledAt = now();
  if (back) restock(o);
  if (wasPrinted && !o.costAt) o.costAt = o.cancelledAt; // قطع طُبعت ولم تُحصَّل: تُسجَّل تكلفتها خسارة بتاريخ الإلغاء
  addEvent(o, 'cancel', `إلغاء الطلب${note ? `: ${note}` : ''}${back ? ' (أُعيدت القطع إلى المخزون)' : ' (القطع مطبوعة ولم تُعَد إلى المخزون)'}`, req.staff.name);
  save('orders', 'products');
  sendOrder(req, res, o);
});

router.post('/orders/:id/payment', requirePerm('orders'), (req, res) => {
  const o = orderOr404(req.params.id);
  if (o.status === 'cancelled') fail('لا يمكن تسجيل دفعة على طلب ملغى');
  const due = o.total - o.paidAmount;
  if (due <= 0) fail('الطلب مدفوع بالكامل');
  const amount = money(req.body?.amount, 'مبلغ الدفعة', { min: 1 });
  if (amount > due) fail(`المبلغ أكبر من المتبقي على الطلب (${fmtMoney(due)})`);
  const method = text(req.body?.method || o.paymentLabel, 'طريقة الدفع', { max: 60 });
  const note = text(req.body?.note, 'ملاحظة', { max: 200, required: false });
  const at = now();
  o.payments.push({ id: nextId('payments'), kind: 'payment', amount, method, note, staffName: req.staff.name, at });
  o.paidAmount += amount;
  if (!o.paidAt) o.paidAt = at;
  if (!o.costAt) o.costAt = at;
  o.paymentStatus = payStatus(o);
  addEvent(o, 'payment', `تسجيل دفعة ${fmtMoney(amount)} (${method})${note ? ` — ${note}` : ''}`, req.staff.name);
  save('orders');
  sendOrder(req, res, o);
});

router.post('/orders/:id/refund', requirePerm('orders'), (req, res) => {
  const o = orderOr404(req.params.id);
  const refundable = o.paidAmount - o.refundedAmount;
  if (refundable <= 0) fail('لا يوجد مبلغ محصَّل يمكن استرجاعه');
  const amount = money(req.body?.amount, 'مبلغ الاسترجاع', { min: 1 });
  if (amount > refundable) fail(`المبلغ أكبر من المحصَّل القابل للاسترجاع (${fmtMoney(refundable)})`);
  const note = text(req.body?.note, 'سبب الاسترجاع', { max: 200, required: false });
  o.payments.push({ id: nextId('payments'), kind: 'refund', amount, method: '', note, staffName: req.staff.name, at: now() });
  o.refundedAmount += amount;
  o.paymentStatus = payStatus(o);
  const back = req.body?.restock === true && restock(o);
  addEvent(o, 'refund', `تسجيل استرجاع ${fmtMoney(amount)}${note ? ` — ${note}` : ''}${back ? ' (أُعيدت القطع إلى المخزون)' : ''}`, req.staff.name);
  save('orders', 'products');
  sendOrder(req, res, o);
});

router.post('/orders/:id/discount', requirePerm('orders'), (req, res) => {
  const o = orderOr404(req.params.id);
  if (o.status === 'cancelled') fail('الطلب ملغى');
  if (o.paidAmount > 0) fail('لا يمكن تعديل الخصم بعد تسجيل الدفع');
  const amount = money(req.body?.amount, 'الخصم');
  if (amount > o.subtotal) fail('الخصم أكبر من قيمة القطع');
  o.discount = amount;
  o.total = o.subtotal - amount + o.deliveryFee;
  addEvent(o, 'discount', amount ? `تطبيق خصم ${fmtMoney(amount)}` : 'إزالة الخصم', req.staff.name);
  save('orders');
  sendOrder(req, res, o);
});

router.get('/orders/:id/items/:itemId/print-file', requirePerm('orders'), (req, res) => {
  const o = orderOr404(req.params.id);
  const idx = o.items.findIndex((i) => i.id === Number(req.params.itemId));
  if (idx < 0) fail('القطعة غير موجودة', 404);
  const it = o.items[idx];
  const ext = it.printFile.slice(it.printFile.lastIndexOf('.'));
  const clean = it.designName.replace(/[\\/:*?"<>|]/g, ' ').trim();
  res.download(privatePath(it.printFile), `${o.number}-${idx + 1}-${clean}${ext}`);
});

/* ───────────── العملاء ───────────── */

function customerStats(c) {
  const orders = data.orders.filter((o) => o.customerId === c.id);
  return {
    id: c.id, name: c.name, phone: c.phone, createdAt: c.createdAt, ordersCount: orders.length,
    totalPaid: orders.reduce((s, o) => s + o.paidAmount - o.refundedAmount, 0),
    totalDue: orders.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + Math.max(0, o.total - o.paidAmount), 0),
    lastOrderAt: orders.length ? orders[orders.length - 1].createdAt : null,
    orders,
  };
}

router.get('/customers', requirePerm('customers'), (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  const qd = digits(q);
  const rows = data.customers
    .filter((c) => !q || c.name.toLowerCase().includes(q) || (qd.length >= 3 && c.phone.replace(/\D/g, '').includes(qd)))
    .map((c) => { const { orders, ...r } = customerStats(c); return r; })
    .sort((a, b) => ((a.lastOrderAt || '') < (b.lastOrderAt || '') ? 1 : -1));
  res.json({ customers: rows });
});

router.get('/customers/:id', requirePerm('customers'), (req, res) => {
  const c = byId('customers', req.params.id);
  if (!c) fail('العميل غير موجود', 404);
  const { orders, ...stats } = customerStats(c);
  const last = orders[orders.length - 1];
  res.json({
    customer: { ...stats, lastAddress: last ? `${last.zoneName}، ${last.address}` : '' },
    orders: [...orders].reverse().map(orderRow),
    canOpenOrders: can(req.staff, 'orders'),
  });
});

/* ───────────── المصاريف ───────────── */

const expenseView = (e) => ({ ...e, orderNumber: e.orderId ? byId('orders', e.orderId)?.number || null : null });

function readExpense(b) {
  if (!isDate(b.date)) fail('تاريخ المصروف غير صالح');
  let orderId = null;
  const num = String(b.orderNumber || '').trim();
  if (num) {
    const o = data.orders.find((x) => x.number.toLowerCase() === num.toLowerCase());
    if (!o) fail(`لا يوجد طلب بالرقم ${num}`);
    orderId = o.id;
  }
  return {
    amount: money(b.amount, 'مبلغ المصروف', { min: 1 }), date: b.date,
    category: text(b.category, 'فئة المصروف', { max: 40 }),
    description: text(b.description, 'الوصف', { max: 300, required: false }), orderId,
  };
}

router.get('/expenses', requirePerm('expenses'), (req, res) => {
  const { from, to, category } = req.query;
  const rows = data.expenses.filter((e) =>
    (!isDate(from) || e.date >= from) && (!isDate(to) || e.date <= to) && (!category || e.category === category))
    .sort((a, b) => (a.date === b.date ? b.id - a.id : a.date < b.date ? 1 : -1));
  res.json({ expenses: rows.map(expenseView), total: rows.reduce((s, e) => s + e.amount, 0) });
});

router.post('/expenses', requirePerm('expenses'), (req, res) => {
  const e = { id: nextId('expenses'), ...readExpense(req.body || {}), createdBy: req.staff.name, createdAt: now() };
  data.expenses.push(e);
  save('expenses');
  res.status(201).json({ expense: expenseView(e) });
});

router.put('/expenses/:id', requirePerm('expenses'), (req, res) => {
  const e = byId('expenses', req.params.id);
  if (!e) fail('المصروف غير موجود', 404);
  Object.assign(e, readExpense(req.body || {}));
  save('expenses');
  res.json({ expense: expenseView(e) });
});

router.delete('/expenses/:id', requirePerm('expenses'), (req, res) => {
  data.expenses = data.expenses.filter((e) => e.id !== Number(req.params.id));
  save('expenses');
  res.json({ ok: true });
});

/* ───────────── الداشبورد والأرباح ───────────── */

router.get('/dashboard', requirePerm('dashboard'), (req, res) => {
  const today = todayLocal();
  let { from, to } = req.query;
  if (!isDate(from) || !isDate(to)) { from = addDays(today, -29); to = today; }
  if (from > to) [from, to] = [to, from];
  if ((Date.parse(to) - Date.parse(from)) / 86400000 > 800) fail('الفترة أطول من المسموح (سنتان تقريبًا)');
  res.json({ ...finance(from, to), today });
});

/* ───────────── الموسيقى ───────────── */

function youtubeId(url) {
  try {
    const u = new URL(String(url).trim());
    const host = u.hostname.replace(/^(www\.|m\.|music\.)/, '');
    let id = null;
    if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
    else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      if (u.pathname === '/watch') id = u.searchParams.get('v');
      else { const m = u.pathname.match(/^\/(embed|shorts|live)\/([^/?]+)/); id = m ? m[2] : null; }
    }
    return id && /^[\w-]{11}$/.test(id) ? id : null;
  } catch { return null; }
}

router.get('/music', requirePerm('music'), (req, res) => res.json({ music: getSetting('music') }));

router.put('/music', requirePerm('music'), (req, res) => {
  const m = getSetting('music');
  const b = req.body || {};
  if (b.volume !== undefined) m.volume = int(b.volume, 'مستوى الصوت', { min: 0, max: 100 });
  if (b.youtubeUrl !== undefined) {
    const id = youtubeId(b.youtubeUrl);
    if (!id) fail('رابط يوتيوب غير صالح. الصق رابط الفيديو كما يظهر في المتصفح');
    if (m.file) removePublic(m.file);
    Object.assign(m, { source: 'youtube', youtubeId: id, youtubeUrl: String(b.youtubeUrl).trim(), file: null, fileName: null });
  }
  if (b.enabled !== undefined) {
    if (b.enabled && !m.source) fail('أضف مصدرًا للموسيقى أولًا (ملف صوتي أو رابط يوتيوب)');
    m.enabled = !!b.enabled;
  }
  setSetting('music', m);
  res.json({ music: m });
});

router.post('/music/file', requirePerm('music'), uploadAudio, (req, res) => {
  const m = getSetting('music');
  const rel = saveAudio(req.file);
  if (m.file) removePublic(m.file);
  Object.assign(m, {
    source: 'file', file: rel, fileName: Buffer.from(req.file.originalname, 'latin1').toString('utf8').slice(-100),
    youtubeId: null, youtubeUrl: null,
  });
  setSetting('music', m);
  res.json({ music: m });
});

router.delete('/music/source', requirePerm('music'), (req, res) => {
  const m = getSetting('music');
  if (m.file) removePublic(m.file);
  Object.assign(m, { enabled: false, source: null, file: null, fileName: null, youtubeId: null, youtubeUrl: null });
  setSetting('music', m);
  res.json({ music: m });
});

/* ───────────── الموظفون والصلاحيات ───────────── */

function readPerms(req, list) {
  const perms = [...new Set(Array.isArray(list) ? list : [])].filter((p) => PERMISSIONS.includes(p));
  // غير المالك لا يمنح صلاحية لا يملكها هو
  if (!req.staff.isOwner && perms.some((p) => !can(req.staff, p))) fail('لا يمكنك منح صلاحية لا تملكها', 403);
  return perms;
}
const username = (v) => {
  const u = String(v || '').trim();
  if (!/^[a-zA-Z0-9._-]{3,30}$/.test(u)) fail('اسم المستخدم: 3 إلى 30 حرفًا لاتينيًا أو رقمًا');
  return u;
};

router.get('/staff', requirePerm('staff'), (req, res) => {
  res.json({ staff: data.staff.map((s) => ({ ...staffView(s), createdAt: s.createdAt })) });
});

router.post('/staff', requirePerm('staff'), (req, res) => {
  const b = req.body || {};
  const u = username(b.username);
  if (data.staff.some((s) => s.username.toLowerCase() === u.toLowerCase())) fail('اسم المستخدم مستعمل');
  if (String(b.password || '').length < 8) fail('كلمة المرور يجب ألا تقل عن 8 أحرف');
  const s = {
    id: nextId('staff'), name: text(b.name, 'اسم الموظف', { max: 60 }), username: u,
    passwordHash: hashPassword(b.password), isOwner: false, permissions: readPerms(req, b.permissions),
    active: true, createdAt: now(),
  };
  data.staff.push(s);
  save('staff');
  res.status(201).json({ staff: staffView(s) });
});

router.put('/staff/:id', requirePerm('staff'), (req, res) => {
  const s = byId('staff', req.params.id);
  if (!s) fail('الحساب غير موجود', 404);
  if (s.isOwner && !req.staff.isOwner) fail('لا يمكن تعديل حساب المدير', 403);
  const b = req.body || {};
  if (b.name !== undefined) s.name = text(b.name, 'اسم الموظف', { max: 60 });
  if (b.username !== undefined && b.username !== s.username) {
    const u = username(b.username);
    if (data.staff.some((x) => x.id !== s.id && x.username.toLowerCase() === u.toLowerCase())) fail('اسم المستخدم مستعمل');
    s.username = u;
  }
  let dropped = false;
  if (b.password) {
    if (String(b.password).length < 8) fail('كلمة المرور يجب ألا تقل عن 8 أحرف');
    s.passwordHash = hashPassword(b.password);
    dropped = s.id !== req.staff.id;
  }
  if (!s.isOwner) {
    if (b.permissions !== undefined) s.permissions = readPerms(req, b.permissions);
    if (b.active !== undefined) {
      if (s.id === req.staff.id && !b.active) fail('لا يمكنك تعطيل حسابك');
      s.active = !!b.active;
      if (!s.active) dropped = true;
    }
  }
  save('staff');
  if (dropped) dropSessionsOf(s.id);
  res.json({ staff: staffView(s) });
});

/* ───────────── إعدادات المتجر ───────────── */

function whatsappNumber(v) {
  let d = toLatinDigits(v).replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('00')) d = d.slice(2);
  if (/^05\d{8}$/.test(d)) d = '971' + d.slice(1);
  if (d.length < 8 || d.length > 15) fail('رقم واتساب غير صالح. اكتبه بالصيغة الدولية مثل 971501234567');
  return d;
}

const settingsView = () => ({
  store: getSetting('store'), payments: getSetting('payments'), lowStock: getSetting('lowStock'),
  zones: [...data.zones].sort((a, b) => a.sortOrder - b.sortOrder),
});

router.get('/settings', requirePerm('settings'), (req, res) => res.json(settingsView()));

router.put('/settings', requirePerm('settings'), (req, res) => {
  const b = req.body || {};
  const cur = getSetting('store');
  const s = b.store || {};
  const store = {
    name: text(s.name, 'اسم المتجر', { max: 40 }),
    tagline: text(s.tagline, 'الوصف المختصر', { max: 120, required: false }),
    logo: s.logo ? imagePath(s.logo, 'brand', 'الشعار') : null,
    primary: hexColor(s.primary, 'اللون الأساسي'),
    secondary: hexColor(s.secondary, 'اللون الثانوي'),
    phone: text(s.phone, 'الهاتف', { max: 30, required: false }),
    email: text(s.email, 'البريد', { max: 80, required: false }),
    address: text(s.address, 'العنوان', { max: 160, required: false }),
    whatsapp: whatsappNumber(s.whatsapp),
  };
  for (const platform of socialPlatforms) {
    const value = text(s[platform.key] ?? cur[platform.key], platform.label, { max: 512, required: false });
    if (value && value !== cur[platform.key] && !socialProfileUrl(platform, value)) {
      fail(`أدخل رابط حساب ${platform.label} أو اسم المستخدم الخاص به`);
    }
    store[platform.key] = value;
  }
  const payments = (Array.isArray(b.payments) ? b.payments : []).slice(0, 8).map((p, i) => ({
    key: /^[a-z0-9_]{2,24}$/.test(p.key || '') ? p.key : `pay_${Date.now().toString(36)}${i}`,
    label: text(p.label, 'اسم طريقة الدفع', { max: 50 }), enabled: !!p.enabled,
  }));
  if (!payments.some((p) => p.enabled)) fail('فعّل طريقة دفع واحدة على الأقل');
  const zonesIn = (Array.isArray(b.zones) ? b.zones : []).slice(0, 60);
  const zones = zonesIn.map((z, i) => ({
    id: byId('zones', z.id) ? Number(z.id) : nextId('zones'),
    name: text(z.name, 'اسم المنطقة', { max: 50 }), fee: money(z.fee, `رسوم ${z.name || 'المنطقة'}`, { max: 1000_00 }),
    active: z.active !== false, sortOrder: i + 1,
  }));
  if (!zones.some((z) => z.active)) fail('أضف منطقة توصيل مفعّلة واحدة على الأقل');

  if (cur.logo && cur.logo !== store.logo) removePublic(cur.logo);
  data.zones = zones;
  save('zones');
  setSetting('store', store);
  setSetting('payments', payments);
  setSetting('lowStock', int(b.lowStock ?? 3, 'حد تنبيه المخزون', { max: 1000 }));
  res.json(settingsView());
});
