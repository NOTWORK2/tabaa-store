import fs from 'node:fs/promises';
import sharp from 'sharp';
import { data, nextId, now, save } from './store.js';
import { privatePath, saveDesign } from './media.js';
import { DESIGN_ART } from './seed-art.js';

const upper = ['tshirt', 'hoodie', 'sweatshirt', 'jacket'];
const all = [...upper, 'cap', 'pants', 'shorts'];
export const inkPrints = [
  { key: 'granary', name: 'قصر الواحة', price: 25, cost: 8, categories: all },
  { key: 'caravan', name: 'ركب الصحراء', price: 30, cost: 9, categories: all },
  { key: 'casbah', name: 'باب القصبة', price: 30, cost: 9, categories: all },
  { key: 'nitaqayn', name: 'ذات النطاقين', price: 20, cost: 6, categories: upper },
  { key: 'nurayn', name: 'ذو النورين', price: 20, cost: 6, categories: upper },
  { key: 'siddiq', name: 'الصدّيق', price: 25, cost: 7, categories: upper },
  { key: 'farouq', name: 'الفاروق', price: 25, cost: 7, categories: upper },
  { key: 'traveller', name: 'على الدرب', price: 25, cost: 7, categories: upper },
  { key: 'sahaba', name: 'الصحابة', price: 25, cost: 7, categories: upper },
];

export const inkFilename = (key) => `tabaa-ink-${key}.png`;
export const inkArtwork = (key) => fs.readFile(new URL(`./assets/ink-prints/${key}.png`, import.meta.url));

export async function isOriginalLegacyPrint(design, readOriginal) {
  if (!design.published || design.createdBy !== 'بيانات أولية') return false;
  const key = design.originalName?.replace(/\.png$/, '');
  if (!Object.hasOwn(DESIGN_ART, key) || design.originalName !== `${key}.png`) return false;
  let current;
  try { current = await readOriginal(design.fileOriginal); }
  catch (error) { if (error.code === 'ENOENT') return false; throw error; }
  const photo = await fs.readFile(new URL(`./assets/transfer-art/${key}.png`, import.meta.url));
  return current.equals(photo) || current.equals(await sharp(Buffer.from(DESIGN_ART[key])).png().toBuffer());
}

export async function installInkPrints() {
  if (data.meta.inkPrintsInstalled) return;
  const additions = [];
  for (const print of inkPrints) {
    const filename = inkFilename(print.key);
    if (data.designs.some((design) => design.originalName === filename)) continue;
    const categoryIds = data.categories.filter((c) => print.categories.includes(c.slug)).map((c) => c.id);
    if (!categoryIds.length) continue;
    const files = await saveDesign(await inkArtwork(print.key), filename);
    additions.push({ id: nextId('designs'), name: print.name, ...files, printPrice: print.price * 100,
      printCost: print.cost * 100, categoryIds, published: true, createdBy: 'طبعة', createdAt: now() });
  }
  // Keep retired IDs and artwork for old orders. A saved cart never silently changes motifs.
  const retired = [];
  for (const design of data.designs) {
    if (await isOriginalLegacyPrint(design, (rel) => fs.readFile(privatePath(rel)))) retired.push(design);
  }
  for (const design of retired) design.published = false;
  data.designs.push(...additions);
  if (additions.length || retired.length) save('designs');
  data.meta.inkPrintsInstalled = true;
  save('meta');
}
