// رفع الملفات ومعالجة الصور: كل ملف يُحفظ باسم عشوائي داخل data/storage
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import sharp from 'sharp';
import { PUBLIC_DIR, PRIVATE_DIR } from './config.js';
import { HttpError, fail } from './util.js';

const MB = 1024 * 1024;
export const uploadImage = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * MB, files: 1 } }).single('file');
export const uploadAudio = multer({ storage: multer.memoryStorage(), limits: { fileSize: 30 * MB, files: 1 } }).single('file');

const rand = () => crypto.randomBytes(10).toString('hex');
const IMAGE_EXT = { png: 'png', jpeg: 'jpg', webp: 'webp' };
const AUDIO_EXT = ['.mp3', '.m4a', '.aac', '.ogg', '.wav'];
export const PAPER = '#efe9dd';

async function inspect(buffer) {
  if (!buffer?.length) fail('لم يُرفع أي ملف');
  let meta;
  try {
    meta = await sharp(buffer).metadata();
  } catch {
    fail('الملف ليس صورة صالحة');
  }
  if (!IMAGE_EXT[meta.format]) fail('الصيغ المسموحة: PNG و JPG و WebP');
  if (meta.width * meta.height > 80_000_000) fail('أبعاد الصورة كبيرة جدًا');
  return meta;
}

/** صورة مربّعة (قطعة ملابس أو نوع لباس): تُحتوى كاملة دون قص، مع الحفاظ على الشفافية */
export async function saveSquare(buffer, dir, size = 1200) {
  const meta = await inspect(buffer);
  let background = { r: 0, g: 0, b: 0, alpha: 0 };
  if (!meta.hasAlpha) {
    // صور بلا شفافية: نكمل الحواف بلون ركن الصورة حتى لا تظهر أشرطة غريبة
    const px = await sharp(buffer).rotate().extract({ left: 0, top: 0, width: 1, height: 1 }).removeAlpha().raw().toBuffer();
    background = { r: px[0], g: px[1], b: px[2], alpha: 1 };
  }
  const rel = `${dir}/${rand()}.webp`;
  await sharp(buffer).rotate().resize(size, size, { fit: 'contain', background }).webp({ quality: 88 }).toFile(path.join(PUBLIC_DIR, rel));
  return rel;
}

export async function saveLogo(buffer) {
  await inspect(buffer);
  const rel = `brand/${rand()}.webp`;
  await sharp(buffer).rotate().resize(480, 480, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 92 }).toFile(path.join(PUBLIC_DIR, rel));
  return rel;
}

/** تصميم: الملف الأصلي يُحفظ كما هو في تخزين خاص (للطباعة)، ونسخة ويب ومصغّرة للعرض */
export async function saveDesign(buffer, originalName) {
  const meta = await inspect(buffer);
  const id = rand();
  const ext = IMAGE_EXT[meta.format];
  const fileOriginal = `designs/${id}.${ext}`;
  fs.writeFileSync(path.join(PRIVATE_DIR, fileOriginal), buffer);
  const fileWeb = `designs/${id}.webp`;
  const thumb = `designs/${id}-t.webp`;
  await sharp(buffer).rotate().resize(1400, 1400, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 90 }).toFile(path.join(PUBLIC_DIR, fileWeb));
  await sharp(buffer).rotate().resize(420, 420, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 84 }).toFile(path.join(PUBLIC_DIR, thumb));
  const safeName = String(originalName || `design.${ext}`).replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').slice(-120);
  return { fileOriginal, originalName: safeName, fileWeb, thumb, width: meta.width, height: meta.height };
}

export function saveAudio(file) {
  if (!file?.buffer?.length) fail('لم يُرفع أي ملف');
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (!AUDIO_EXT.includes(ext) || !/^(audio|video\/mp4|application\/octet-stream)/.test(file.mimetype || '')) {
    fail('الصيغ الصوتية المسموحة: MP3 و M4A و AAC و OGG و WAV');
  }
  const rel = `audio/${rand()}${ext}`;
  fs.writeFileSync(path.join(PUBLIC_DIR, rel), file.buffer);
  return rel;
}

/** صورة المعاينة المحفوظة مع الطلب: القطعة + التصميم داخل مساحة الطباعة (نفس حساب الواجهة) */
export async function composePreview(garmentRel, designWebRel, area, outRel, size = 1000) {
  const layers = [];
  if (garmentRel && fs.existsSync(path.join(PUBLIC_DIR, garmentRel))) {
    layers.push({
      input: await sharp(path.join(PUBLIC_DIR, garmentRel))
        .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer(),
      left: 0, top: 0,
    });
  }
  const box = {
    left: Math.round(area.x * size), top: Math.round(area.y * size),
    w: Math.max(8, Math.round(area.w * size)), h: Math.max(8, Math.round(area.h * size)),
  };
  const d = await sharp(path.join(PUBLIC_DIR, designWebRel)).resize(box.w, box.h, { fit: 'inside' }).png().toBuffer({ resolveWithObject: true });
  layers.push({
    input: d.data,
    left: box.left + Math.round((box.w - d.info.width) / 2),
    top: box.top + Math.round((box.h - d.info.height) / 2),
  });
  await sharp({ create: { width: size, height: size, channels: 4, background: PAPER } })
    .composite(layers).webp({ quality: 88 }).toFile(path.join(PUBLIC_DIR, outRel));
  return outRel;
}

function inside(root, rel) {
  const abs = path.resolve(root, rel);
  if (!abs.startsWith(path.resolve(root) + path.sep)) throw new HttpError(400, 'مسار غير صالح');
  return abs;
}
export const publicPath = (rel) => inside(PUBLIC_DIR, rel);
export const privatePath = (rel) => inside(PRIVATE_DIR, rel);
export const publicExists = (rel) => typeof rel === 'string' && fs.existsSync(inside(PUBLIC_DIR, rel));

export function removeFiles(...files) {
  for (const f of files) {
    if (!f) continue;
    try { fs.rmSync(f, { force: true }); } catch { /* الملف مستخدم أو محذوف مسبقًا */ }
  }
}
export const removePublic = (...rels) => removeFiles(...rels.filter(Boolean).map((r) => publicPath(r)));
export const removePrivate = (...rels) => removeFiles(...rels.filter(Boolean).map((r) => privatePath(r)));
