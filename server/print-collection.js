import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PUBLIC_DIR } from './config.js';
import { data, nextId, now, save } from './store.js';
import { saveDesign } from './media.js';
import { stockOf } from './lib/catalog.js';

const sources = fileURLToPath(new URL('./assets/prints/', import.meta.url));
const tops = ['tshirt', 'hoodie', 'sweatshirt', 'jacket'];
const editions = [
  { key: 'umar', name: 'عمر بن الخطاب', product: 'تيشيرت قطن كلاسيكي', color: 'رملي', slug: 'tshirt' },
  { key: 'ali', name: 'علي بن أبي طالب', product: 'تيشيرت أوفرسايز ثقيل', color: 'أسود', slug: 'tshirt' },
  { key: 'bilal', name: 'بلال بن رباح', product: 'هودي قطن مبطّن', color: 'زيتي', slug: 'hoodie' },
];

export async function installPrintCollection() {
  const registered = data.meta.printCollection ??= {};
  const categoryIds = data.categories.filter((c) => tops.includes(c.slug)).map((c) => c.id);
  if (!categoryIds.length) return;

  const imageDir = path.join(PUBLIC_DIR, 'editions');
  await fs.mkdir(imageDir, { recursive: true });
  for (const edition of editions) {
    if (registered[edition.key]) continue;
    await fs.copyFile(path.join(sources, edition.key + '.webp'), path.join(imageDir, edition.key + '.webp'));
    let design = data.designs.find((d) => d.editionKey === edition.key);
    if (!design) {
      const art = await fs.readFile(path.join(sources, edition.key + '.png'));
      const files = await saveDesign(art, edition.name + '.png');
      design = {
        id: nextId('designs'), editionKey: edition.key, name: edition.name, ...files,
        printPrice: 2500, printCost: 700, categoryIds, published: true, createdBy: 'طبعة', createdAt: now(),
      };
      data.designs.push(design);
      save('designs');
    }
    const category = data.categories.find((c) => c.slug === edition.slug);
    const product = data.products.find((p) => p.categoryId === category?.id && p.name === edition.product);
    const color = product?.colors.find((c) => c.name === edition.color);
    // Keep the initial artwork and colour for the photographed sample. Respect later catalogue edits and deletions.
    registered[edition.key] = { id: design.id, artwork: design.fileWeb, productId: product?.id, colorId: color?.id, hex: color?.hex };
    save('meta');
  }
}

export function featuredPrints() {
  const cards = [];
  for (const edition of editions) {
    const record = data.meta.printCollection?.[edition.key];
    if (!record) continue;
    const design = data.designs.find((d) => d.id === record.id && d.published && d.fileWeb === record.artwork);
    const product = data.products.find((p) => p.id === record.productId && p.active);
    if (!design || !product || !design.categoryIds.includes(product.categoryId)) continue;
    const category = data.categories.find((c) => c.id === product.categoryId && c.visible);
    const color = product.colors.find((c) => c.id === record.colorId && c.hex === record.hex);
    if (!category || !color || !product.sizes.some((s) => stockOf(color, s) > 0)) continue;
    cards.push({
      id: design.id, edition: edition.key, name: design.name, productId: product.id, productName: product.name,
      colorId: color.id, colorName: color.name, slug: category.slug, price: product.price + design.printPrice,
      image: 'editions/' + edition.key + '.webp',
    });
  }
  return cards;
}
