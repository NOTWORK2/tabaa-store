// بيانات أولية لتجربة المتجر: تُنشأ مرة واحدة عند أول تشغيل (عندما لا توجد أنواع ملابس)
import sharp from 'sharp';
import { data, save, nextId, now } from './store.js';
import { saveSquare } from './media.js';
import { installInkPrints } from './ink-prints.js';
import { garmentSvg, CATEGORY_SEED, PRODUCT_SEED, ZONE_SEED } from './seed-art.js';

const png = (svg) => sharp(Buffer.from(svg)).png().toBuffer();

export async function seedIfEmpty() {
  if (data.meta.seeded || data.categories.length) {
    await installInkPrints();
    return false;
  }
  console.log('تجهيز البيانات الأولية (أنواع، منتجات، تصاميم)...');

  const catBySlug = {};
  for (const [i, c] of CATEGORY_SEED.entries()) {
    const image = await saveSquare(await png(garmentSvg(c.art, c.hero)), 'categories', 900);
    const cat = { id: nextId('categories'), name: c.name, slug: c.slug, image, sortOrder: i + 1, visible: true, printArea: c.area, createdAt: now() };
    data.categories.push(cat);
    catBySlug[c.slug] = { ...c, id: cat.id };
  }

  for (const [pi, p] of PRODUCT_SEED.entries()) {
    const cat = catBySlug[p.cat];
    const colors = [];
    for (const [ci, [name, hex]] of p.colors.entries()) {
      const image = await saveSquare(await png(garmentSvg(cat.art, hex)), 'products');
      // مخزون متفاوت لإظهار حالات «نفد» و«كمية قليلة» في المتجر واللوحة
      const stock = Object.fromEntries(p.sizes.map((s, si) => {
        const n = (pi * 7 + ci * 5 + si * 3) % 11;
        return [s, n === 0 ? 0 : n === 4 ? 2 : 8 + n];
      }));
      colors.push({ id: nextId('colors'), name, hex, image, stock });
    }
    data.products.push({
      id: nextId('products'), categoryId: cat.id, name: p.name, description: p.description,
      price: p.price * 100, cost: p.cost * 100, active: true, printArea: cat.area, sizes: p.sizes, colors, createdAt: now(),
    });
  }

  ZONE_SEED.forEach(([name, fee], i) => data.zones.push({ id: nextId('zones'), name, fee: fee * 100, active: true, sortOrder: i + 1 }));

  data.meta.seeded = true;
  save('categories', 'products', 'zones', 'meta');
  await installInkPrints();
  console.log('اكتملت البيانات الأولية.');
  return true;
}
