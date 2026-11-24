import { data, byId } from '../store.js';
import { sizeLabel } from '../util.js';

export const stockOf = (color, size) => Math.max(0, Number(color?.stock?.[size]) || 0);
export const productStock = (p) => p.colors.reduce((s, c) => s + p.sizes.reduce((x, z) => x + stockOf(c, z), 0), 0);

/** الأنواع الظاهرة للزبون: منشورة وفيها منتج مفعّل واحد على الأقل */
export function storefrontCategories() {
  return data.categories
    .filter((c) => c.visible)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
    .map((c) => {
      const products = data.products.filter((p) => p.active && p.categoryId === c.id && p.colors.length);
      if (!products.length) return null;
      return {
        id: c.id, slug: c.slug, name: c.name,
        image: c.image || products[0].colors[0]?.image || null,
        fromPrice: Math.min(...products.map((p) => p.price)),
        productCount: products.length,
      };
    })
    .filter(Boolean);
}

export const publicProduct = (p) => ({
  id: p.id, name: p.name, description: p.description, price: p.price, printArea: p.printArea, sizes: p.sizes,
  colors: p.colors.map((c) => ({
    id: c.id, name: c.name, hex: c.hex, image: c.image,
    stock: Object.fromEntries(p.sizes.map((s) => [s, stockOf(c, s)])),
  })),
});

export const publicDesign = (d) => ({
  id: d.id, name: d.name, thumb: d.thumb, image: d.fileWeb, printPrice: d.printPrice, width: d.width, height: d.height,
});

export const designsFor = (categoryId) =>
  data.designs.filter((d) => d.published && d.categoryIds.includes(categoryId)).sort((a, b) => b.id - a.id);

/**
 * يحوّل سطر سلة {productId,colorId,size,designId,qty} إلى سطر كامل بأسعار وتوفّر اللحظة الحالية.
 * السعر والتكلفة والمخزون تُقرأ دائمًا من الخادم، ولا يُعتمد على ما يرسله المتصفح.
 */
export function resolveLine(it) {
  const qty = Math.floor(Number(it?.qty));
  const base = {
    key: `${it?.productId}|${it?.colorId}|${it?.size}|${it?.designId}`,
    productId: Number(it?.productId), colorId: Number(it?.colorId), size: String(it?.size ?? ''),
    designId: Number(it?.designId), qty: Number.isFinite(qty) ? qty : 0,
  };
  const p = byId('products', base.productId);
  const cat = p && byId('categories', p.categoryId);
  const color = p?.colors.find((c) => c.id === base.colorId);
  if (!p || !p.active || !cat || !cat.visible || !color || !p.sizes.includes(base.size)) {
    return { ...base, error: 'unavailable', message: 'هذه القطعة لم تعد متوفرة في المتجر' };
  }
  const d = byId('designs', base.designId);
  const line = {
    ...base,
    productName: p.name, categoryName: cat.name, categoryId: cat.id, colorName: color.name, colorHex: color.hex,
    image: color.image, printArea: p.printArea, unitPrice: p.price, unitCost: p.cost, available: stockOf(color, base.size),
  };
  if (!d || !d.published || !d.categoryIds.includes(cat.id)) {
    return { ...line, error: 'unavailable', message: 'التصميم المختار لم يعد متوفرًا لهذه القطعة' };
  }
  Object.assign(line, {
    designName: d.name, designImage: d.fileWeb, designThumb: d.thumb, designWidth: d.width, designHeight: d.height,
    printPrice: d.printPrice, printCost: d.printCost, printFile: d.fileOriginal, printFileName: d.originalName,
    itemPrice: p.price + d.printPrice, lineTotal: (p.price + d.printPrice) * Math.max(base.qty, 0),
  });
  if (!(base.qty >= 1 && base.qty <= 99)) return { ...line, error: 'qty', message: 'الكمية غير صالحة' };
  if (line.available <= 0) return { ...line, error: 'out_of_stock', message: `نفد مخزون ${color.name} ${sizeLabel(base.size)}` };
  if (base.qty > line.available) {
    return { ...line, error: 'insufficient', message: `المتوفر من ${color.name} ${sizeLabel(base.size)} هو ${line.available} فقط` };
  }
  return line;
}

/** سطور السلة مع فحص المخزون المجمّع (سطران بتصميمين مختلفين قد يتشاركان نفس اللون والمقاس) */
export function resolveCart(items) {
  const lines = (Array.isArray(items) ? items : []).slice(0, 40).map(resolveLine);
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

const PRIVATE_KEYS = ['unitCost', 'printCost', 'printFile', 'printFileName'];
export function publicLine(l) {
  const out = { ...l };
  for (const k of PRIVATE_KEYS) delete out[k];
  return out;
}
