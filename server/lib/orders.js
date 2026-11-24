import { data, byId, getSetting, now } from '../store.js';
import { dayStartUtc, dayEndUtc, addDays, fmtMoney, sizeLabel } from '../util.js';

export const FLOW = ['new', 'printing', 'ready', 'shipped', 'delivered'];
export const STATUS_LABEL = {
  new: 'جديد', printing: 'قيد الطباعة', ready: 'جاهز للشحن', shipped: 'تم الشحن', delivered: 'تم التسليم', cancelled: 'ملغى',
};
export const PAY_LABEL = {
  unpaid: 'بانتظار الدفع', partial: 'مدفوع جزئيًا', paid: 'مدفوع', partial_refund: 'مسترجع جزئيًا', refunded: 'مسترجع',
};

export function payStatus(o) {
  if (o.paidAmount <= 0) return 'unpaid';
  if (o.refundedAmount >= o.paidAmount) return 'refunded';
  if (o.refundedAmount > 0) return 'partial_refund';
  return o.paidAmount >= o.total ? 'paid' : 'partial';
}

export function addEvent(o, type, text, staffName = null) {
  o.events.push({ type, text, staffName, at: now() });
}

/** إعادة قطع الطلب إلى المخزون (مرة واحدة فقط لكل طلب) */
export function restock(o) {
  if (o.restocked) return false;
  for (const it of o.items) {
    const color = byId('products', it.productId)?.colors.find((c) => c.id === it.colorId);
    if (color && it.size in (color.stock || {})) color.stock[it.size] += it.qty;
  }
  o.restocked = true;
  return true;
}

/**
 * تكلفة الطلب الفعلية من النسخة المحفوظة وقت الشراء:
 * - تكلفة القطع تسقط إذا أُعيدت القطع إلى المخزون
 * - تكلفة الطباعة تسقط إذا أُلغي الطلب قبل أن يدخل الطباعة
 */
export function orderCosts(o) {
  const garment = o.restocked ? 0 : o.items.reduce((s, i) => s + i.qty * i.unitCost, 0);
  const print = o.status === 'cancelled' && !o.printedAt ? 0 : o.items.reduce((s, i) => s + i.qty * i.printCost, 0);
  return { garment, print };
}

export function whatsappText(o) {
  const L = [`السلام عليكم، هذا طلبي رقم ${o.number}`, `الاسم: ${o.customerName}`, `الهاتف: ${o.customerPhone}`, ''];
  o.items.forEach((it, i) => {
    L.push(`${i + 1}. ${it.productName} — ${it.colorName} — ${sizeLabel(it.size)}`);
    L.push(`التصميم: ${it.designName} | الكمية: ${it.qty} | المجموع: ${fmtMoney(it.lineTotal)}`);
    L.push('');
  });
  L.push(`عنوان التوصيل: ${o.zoneName}، ${o.address}`);
  if (o.discount > 0) L.push(`الخصم: ${fmtMoney(o.discount)}`);
  L.push(`رسوم التوصيل: ${fmtMoney(o.deliveryFee)}`);
  L.push(`الإجمالي: ${fmtMoney(o.total)}`);
  L.push(`طريقة الدفع: ${o.paymentLabel}`);
  if (o.notes) L.push(`ملاحظات: ${o.notes}`);
  return L.join('\n');
}

export function whatsappUrl(o) {
  const number = String(getSetting('store').whatsapp || '').replace(/\D/g, '');
  if (!number) return null;
  // wa.me يعمل على الهاتف والكمبيوتر، و encodeURIComponent يحفظ العربية وفواصل الأسطر (%0A)
  return `https://wa.me/${number}?text=${encodeURIComponent(whatsappText(o))}`;
}

const publicItem = (it) => ({
  id: it.id, productName: it.productName, categoryName: it.categoryName, colorName: it.colorName, colorHex: it.colorHex,
  size: it.size, designName: it.designName, qty: it.qty, unitPrice: it.unitPrice, printPrice: it.printPrice,
  lineTotal: it.lineTotal, previewImage: it.previewImage,
});

export const publicOrder = (o) => ({
  number: o.number, token: o.token, createdAt: o.createdAt, status: o.status, statusLabel: STATUS_LABEL[o.status],
  customerName: o.customerName, customerPhone: o.customerPhone, zoneName: o.zoneName, address: o.address, notes: o.notes,
  paymentLabel: o.paymentLabel, subtotal: o.subtotal, discount: o.discount, deliveryFee: o.deliveryFee, total: o.total,
  items: o.items.map(publicItem), whatsappText: whatsappText(o), whatsappUrl: whatsappUrl(o),
  returnRequests: (o.events || []).filter((event) => event.type === 'return_request')
    .map(({ itemId, kind, quantity, detail, at }) => ({ itemId, kind, quantity, detail, at })),
});

export const orderRow = (o) => ({
  id: o.id, number: o.number, customerId: o.customerId, customerName: o.customerName, customerPhone: o.customerPhone,
  createdAt: o.createdAt, total: o.total, paidAmount: o.paidAmount, refundedAmount: o.refundedAmount,
  status: o.status, paymentStatus: o.paymentStatus, itemsCount: o.items.reduce((s, i) => s + i.qty, 0),
  thumb: o.items[0]?.previewImage || null,
});

export function adminOrder(o, withCosts) {
  const costs = orderCosts(o);
  return {
    ...orderRow(o),
    zoneName: o.zoneName, address: o.address, notes: o.notes, paymentMethod: o.paymentMethod, paymentLabel: o.paymentLabel,
    subtotal: o.subtotal, discount: o.discount, deliveryFee: o.deliveryFee, restocked: o.restocked,
    printedAt: o.printedAt, paidAt: o.paidAt, cancelledAt: o.cancelledAt,
    due: Math.max(0, o.total - o.paidAmount), refundable: Math.max(0, o.paidAmount - o.refundedAmount),
    items: o.items.map((it) => ({
      ...publicItem(it), printArea: it.printArea, designWidth: it.designWidth, designHeight: it.designHeight,
      printFileName: it.printFileName,
      ...(withCosts ? { unitCost: it.unitCost, printCost: it.printCost } : {}),
    })),
    events: [...o.events].reverse(),
    payments: [...o.payments].reverse(),
    ...(withCosts ? { costs, profit: o.paidAmount - o.refundedAmount - costs.garment - costs.print } : {}),
    whatsappText: whatsappText(o),
  };
}

const localDay = (iso) => new Date(Date.parse(iso) + 4 * 3600000).toISOString().slice(0, 10);

/**
 * أرقام الداشبورد للفترة [from, to] بتوقيت الإمارات. كل مبلغ يُحتسب مرة واحدة:
 * - صافي الإيرادات = الدفعات المسجّلة في الفترة − الاسترجاعات المسجّلة في الفترة (الخصم مخصوم أصلًا من إجمالي الطلب)
 * - تكلفة القطع والطباعة تُحمَّل مرة واحدة لكل طلب بتاريخ تحصيله (costAt)، أو بتاريخ إلغائه إن أُلغي بعد الطباعة دون دفع
 * - المصاريف بتاريخها المسجّل
 */
export function finance(from, to) {
  const a = dayStartUtc(from);
  const b = dayEndUtc(to);
  const inRange = (iso) => !!iso && iso >= a && iso < b;

  const span = Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1;
  const monthly = span > 62;
  const bucketOf = (day) => (monthly ? day.slice(0, 7) : day);
  const buckets = new Map();
  for (let i = 0; i < span; i++) {
    const k = bucketOf(addDays(from, i));
    if (!buckets.has(k)) buckets.set(k, { key: k, sales: 0, collected: 0, refunded: 0, garment: 0, print: 0, expenses: 0 });
  }
  const bucket = (day) => buckets.get(bucketOf(day));

  const t = { sales: 0, orders: 0, collected: 0, refunded: 0, garment: 0, print: 0, expenses: 0 };
  const products = new Map();
  const designs = new Map();
  const bump = (map, key, name, image, qty, amount) => {
    const r = map.get(key) || { name, image, qty: 0, amount: 0 };
    r.qty += qty; r.amount += amount;
    map.set(key, r);
  };

  for (const o of data.orders) {
    if (inRange(o.createdAt) && o.status !== 'cancelled') {
      t.sales += o.total; t.orders += 1;
      bucket(localDay(o.createdAt)).sales += o.total;
      for (const it of o.items) {
        bump(products, it.productName, it.productName, it.previewImage, it.qty, it.qty * it.unitPrice);
        bump(designs, it.designName, it.designName, it.previewImage, it.qty, it.qty * it.printPrice);
      }
    }
    for (const p of o.payments) {
      if (!inRange(p.at)) continue;
      const k = p.kind === 'refund' ? 'refunded' : 'collected';
      t[k] += p.amount;
      bucket(localDay(p.at))[k] += p.amount;
    }
    if (inRange(o.costAt)) {
      const c = orderCosts(o);
      t.garment += c.garment; t.print += c.print;
      const bk = bucket(localDay(o.costAt));
      bk.garment += c.garment; bk.print += c.print;
    }
  }
  const expenseCats = new Map();
  for (const e of data.expenses) {
    if (e.date < from || e.date > to) continue;
    t.expenses += e.amount;
    bucket(e.date).expenses += e.amount;
    expenseCats.set(e.category, (expenseCats.get(e.category) || 0) + e.amount);
  }

  const waiting = data.orders.filter((o) => o.status !== 'cancelled' && o.total - o.paidAmount > 0);
  const top = (map) => [...map.values()].sort((x, y) => y.qty - x.qty || y.amount - x.amount).slice(0, 5);
  const net = t.collected - t.refunded;

  return {
    from, to, monthly,
    totals: { ...t, netRevenue: net, profit: net - t.garment - t.print - t.expenses },
    waiting: {
      count: waiting.length,
      amount: waiting.reduce((s, o) => s + (o.total - o.paidAmount), 0),
      orders: waiting.sort((x, y) => (x.createdAt < y.createdAt ? 1 : -1)).slice(0, 6).map((o) => ({
        id: o.id, number: o.number, customerName: o.customerName, due: o.total - o.paidAmount,
        status: o.status, createdAt: o.createdAt,
      })),
    },
    newOrders: data.orders.filter((o) => o.status === 'new').length,
    topProducts: top(products),
    topDesigns: top(designs),
    expenseCategories: [...expenseCats].map(([category, amount]) => ({ category, amount })).sort((x, y) => y.amount - x.amount),
    series: [...buckets.values()].map((r) => ({
      key: r.key, sales: r.sales, netRevenue: r.collected - r.refunded,
      profit: r.collected - r.refunded - r.garment - r.print - r.expenses,
    })),
  };
}
