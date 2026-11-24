import path from 'node:path';
import { fileURLToPath } from 'node:url';

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DATA_DIR = path.resolve(ROOT, arg('data') || process.env.DATA_DIR || 'data');
export const PUBLIC_DIR = path.join(DATA_DIR, 'storage', 'public');
export const PRIVATE_DIR = path.join(DATA_DIR, 'storage', 'private');
export const PORT = Number(arg('port') || process.env.PORT || 3000);

// توقيت الإمارات ثابت (UTC+4) بلا توقيت صيفي
export const TZ_SQL = '+4 hours';
export const TZ_SUFFIX = '+04:00';

export const PERMISSIONS = [
  'dashboard', 'categories', 'products', 'designs', 'orders',
  'customers', 'expenses', 'music', 'staff', 'settings',
];
