// طبقة التخزين: لا توجد قاعدة بيانات. كل مجموعة بيانات ملف JSON داخل data/db
// تُحمَّل في الذاكرة عند التشغيل وتُكتب على القرص فور كل تعديل (كتابة ذرّية: ملف مؤقت ثم استبدال).
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR, PUBLIC_DIR, PRIVATE_DIR } from './config.js';
import { socialPlatforms } from '../shared/social.js';

const DB_DIR = path.join(DATA_DIR, 'db');
for (const d of [
  DB_DIR,
  ...['categories', 'products', 'designs', 'brand', 'audio', 'orders'].map((x) => path.join(PUBLIC_DIR, x)),
  ...['designs', 'orders'].map((x) => path.join(PRIVATE_DIR, x)),
]) fs.mkdirSync(d, { recursive: true });

const COLLECTIONS = ['staff', 'sessions', 'categories', 'products', 'designs', 'zones', 'customers', 'orders', 'expenses'];

const SETTINGS_DEFAULTS = {
  store: {
    name: 'طبعة',
    tagline: 'اختر قطعتك، اختر رسمتك، ونحن نطبعها لك',
    logo: null,
    primary: '#742e3a',
    secondary: '#62443b',
    phone: '',
    email: '',
    address: '',
    ...Object.fromEntries(socialPlatforms.map(({ key }) => [key, ''])),
    whatsapp: '',
  },
  payments: [
    { key: 'cod', label: 'الدفع نقدًا عند الاستلام', enabled: true },
    { key: 'card_delivery', label: 'بطاقة عند الاستلام', enabled: true },
    { key: 'bank', label: 'تحويل بنكي', enabled: false },
  ],
  music: { enabled: false, source: null, file: null, fileName: null, youtubeId: null, youtubeUrl: null, volume: 40 },
  lowStock: 3,
};

function readJson(name, fallback) {
  const file = path.join(DB_DIR, `${name}.json`);
  if (!fs.existsSync(file)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    // لا نكمل ببيانات فارغة فوق ملف تالف حتى لا نمسح بيانات المتجر
    throw new Error(`تعذّرت قراءة ملف البيانات ${file}: ${e.message}`);
  }
}

function writeJson(name, value) {
  const file = path.join(DB_DIR, `${name}.json`);
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 1), 'utf8');
  try {
    fs.renameSync(tmp, file);
  } catch {
    fs.copyFileSync(tmp, file);
    fs.rmSync(tmp, { force: true });
  }
}

export const data = { settings: readJson('settings', {}), meta: readJson('meta', { seq: {} }) };
for (const c of COLLECTIONS) data[c] = readJson(c, []);

/** يحفظ المجموعات المذكورة على القرص فورًا */
export function save(...names) {
  for (const n of new Set(names)) writeJson(n, data[n]);
}

/** رقم تسلسلي جديد لمجموعة (يُحفظ مع meta) */
export function nextId(name) {
  const n = (data.meta.seq[name] || 0) + 1;
  data.meta.seq[name] = n;
  writeJson('meta', data.meta);
  return n;
}

export const now = () => new Date().toISOString();
export const byId = (name, id) => data[name].find((x) => x.id === Number(id)) || null;

export function getSetting(key) {
  const def = SETTINGS_DEFAULTS[key];
  const v = data.settings[key];
  if (v === undefined) return structuredClone(def);
  return def && typeof def === 'object' && !Array.isArray(def) ? { ...def, ...v } : structuredClone(v);
}
export function setSetting(key, value) {
  data.settings[key] = value;
  save('settings');
}
