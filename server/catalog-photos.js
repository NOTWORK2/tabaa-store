import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { ROOT } from './config.js';
import { publicPath } from './media.js';
import { data, save } from './store.js';
import { CATEGORY_SEED, PRODUCT_SEED, garmentSvg } from './seed-art.js';

const sourceDirectory = path.join(ROOT, 'server', 'assets', 'garments');
const coversDirectory = path.join(ROOT, 'server', 'assets', 'category-covers');
const colorNames = {
  '#f4f1ea': 'ivory', '#1d1d1f': 'black', '#1c2b4a': 'navy', '#d9cbb0': 'sand',
  '#b9b6b0': 'grey', '#2f4a3c': 'olive', '#7a2e2a': 'burgundy', '#3a3f47': 'graphite',
};

function photoStyle(product) {
  if (product.cat !== 'tshirt') return product.cat;
  return product === PRODUCT_SEED.find((p) => p.cat === 'tshirt') ? 'classic-tee' : 'oversize-tee';
}

async function existingImage(rel) {
  try {
    return await fs.readFile(publicPath(rel));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

async function originalIllustration(kind, color, size) {
  const png = await sharp(Buffer.from(garmentSvg(kind, color))).png().toBuffer();
  return sharp(png)
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 88 }).toBuffer();
}

// Only update recognised stock files. Keep the existing category references valid
// for running stores and leave photographs uploaded by the merchant untouched.
export async function refreshCategoryCovers() {
  for (const seed of CATEGORY_SEED) {
    const category = data.categories.find((c) => c.slug === seed.slug);
    if (!category?.image?.startsWith('categories/')) continue;
    const current = await existingImage(category.image);
    if (!current) continue;
    const cover = await fs.readFile(path.join(coversDirectory, seed.slug + '.webp'));
    if (current.equals(cover)) continue;

    const lead = PRODUCT_SEED.find((p) => p.cat === seed.slug);
    const previousPhoto = photoStyle(lead) + '-' + colorNames[lead.colors[0][1]] + '.webp';
    let previous;
    if (category.image === `categories/atelier-${category.id}-${previousPhoto}`) {
      previous = await fs.readFile(path.join(sourceDirectory, previousPhoto));
    } else if (/^categories\/[a-f0-9]{20}\.webp$/.test(category.image)) {
      previous = await originalIllustration(seed.art, seed.hero, 900);
    }
    if (!previous || !current.equals(previous)) continue;

    const destination = publicPath(category.image);
    const temp = destination + '.' + randomUUID() + '.tmp';
    try {
      await fs.writeFile(temp, cover);
      await fs.rename(temp, destination);
    } finally {
      await fs.rm(temp, { force: true });
    }
  }
}

async function replaceProductPhoto(color, kind, hex, photoName) {
  if (!/^products\/[a-f0-9]{20}\.webp$/.test(color.image || '')) return false;
  const current = await existingImage(color.image);
  if (!current || !current.equals(await originalIllustration(kind, hex, 1200))) return false;
  const dest = `products/atelier-${color.id}-${photoName}.webp`;
  await fs.copyFile(path.join(sourceDirectory, photoName + '.webp'), publicPath(dest));
  color.image = dest;
  return true;
}

export async function installCatalogPhotos() {
  if (!data.meta.displayCoversInstalled) {
    await refreshCategoryCovers();
    data.meta.displayCoversInstalled = true;
    save('meta');
  }
  if (data.meta.catalogPhotosInstalled) return;
  let changed = false;
  for (const seed of CATEGORY_SEED) {
    const category = data.categories.find((c) => c.slug === seed.slug);
    if (!category) continue;
    const models = PRODUCT_SEED.filter((p) => p.cat === seed.slug);
    for (const model of models) {
      const product = data.products.find((p) => p.categoryId === category.id && p.name === model.name);
      if (!product) continue;
      for (const [, hex] of model.colors) {
        const color = product.colors.find((c) => c.hex.toLowerCase() === hex);
        const photo = photoStyle(model) + '-' + colorNames[hex];
        if (color && await replaceProductPhoto(color, seed.art, hex, photo)) changed = true;
      }
    }
  }
  if (changed) save('products');
  data.meta.catalogPhotosInstalled = true;
  save('meta');
}
