// ينشئ نسخة ثابتة من واجهة المتجر لاستضافة GitHub Pages، ويرفعها عند إضافة --deploy.
//
//   npm run pages:build     يبني النسخة في web/dist-pages
//   npm run pages:deploy    يبنيها ثم يرفعها إلى مستودع الصفحات
//
// ما يُنشر: واجهة الزبون + لقطة من الكتالوج العام (الأنواع، المنتجات، التصاميم المنشورة، مناطق التوصيل) وصورها.
// ما لا يُنشر: لوحة الإدارة، الطلبات، العملاء، التكاليف، ملفات الطباعة الأصلية، حسابات الموظفين.
// بعد أي تعديل في المنتجات أو الأسعار من لوحة الإدارة أعد تنفيذ pages:deploy لتحديث الموقع المنشور.
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { build } from 'vite';
import { ROOT, PUBLIC_DIR } from '../server/config.js';

const REPO = process.env.PAGES_REPO || 'NOTWORK2/tabaa';
const BASE = `/${REPO.split('/')[1]}/`;
const OUT = path.join(ROOT, 'web', 'dist-pages');
const PORT = 39871;
const API = `http://127.0.0.1:${PORT}/api`;
const MEDIA = /^[\w-]+(\/[\w.-]+)*\/[\w.-]+\.(webp|png|jpe?g|gif|mp3|m4a|aac|ogg|wav)$/i;

const getJson = async (url) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} → ${r.status}`);
  return r.json();
};

async function readCatalog() {
  // خادم مؤقت يقرأ مجلد البيانات نفسه، حتى تطابق اللقطة ما يعرضه المتجر الفعلي تمامًا
  const server = spawn(process.execPath, ['server/index.js', '--port', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
  try {
    let store = null;
    for (let i = 0; i < 120 && !store; i++) {
      await new Promise((r) => setTimeout(r, 500));
      store = await getJson(`${API}/store`).catch(() => null);
    }
    if (!store) throw new Error('تعذّر تشغيل الخادم المؤقت لقراءة الكتالوج');
    const categories = {};
    for (const c of store.categories) categories[c.slug] = await getJson(`${API}/categories/${encodeURIComponent(c.slug)}`);
    return { exportedAt: new Date().toISOString(), store, categories };
  } finally {
    server.kill();
  }
}

function copyMedia(snapshot) {
  const files = new Set();
  const walk = (v) => {
    if (typeof v === 'string') {
      const rel = v.replace(/^\/media\//, '');
      if (MEDIA.test(rel) && fs.existsSync(path.join(PUBLIC_DIR, rel))) files.add(rel);
    } else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(snapshot);
  let bytes = 0;
  for (const rel of files) {
    const to = path.join(OUT, 'media', rel);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(path.join(PUBLIC_DIR, rel), to);
    bytes += fs.statSync(to).size;
  }
  return { count: files.size, bytes };
}

process.env.VITE_STATIC = '1';
await build({ configFile: path.join(ROOT, 'vite.config.js'), base: BASE, logLevel: 'warn', build: { outDir: 'dist-pages', emptyOutDir: true } });

const snapshot = await readCatalog();
fs.writeFileSync(path.join(OUT, 'catalog.json'), JSON.stringify(snapshot));
const media = copyMedia(snapshot);
// GitHub Pages يعيد 404.html لأي رابط داخلي مثل /cart، فتفتح الواجهة وتكمل التوجيه في المتصفح
fs.copyFileSync(path.join(OUT, 'index.html'), path.join(OUT, '404.html'));
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');

const products = Object.values(snapshot.categories).reduce((s, c) => s + c.products.length, 0);
console.log(`النسخة الثابتة جاهزة في ${OUT}`);
console.log(`${snapshot.store.categories.length} نوع، ${products} منتج، ${media.count} ملف وسائط (${(media.bytes / 1048576).toFixed(1)} ميغابايت)`);
if (!snapshot.store.store.whatsapp) {
  console.log('تنبيه: رقم واتساب المتجر غير مضبوط. الزبون سيختار المحادثة بنفسه ولن يصلك الطلب مباشرة.');
}

if (process.argv.includes('--deploy')) {
  const git = (...args) => execFileSync('git', args, { cwd: OUT, stdio: 'inherit' });
  fs.rmSync(path.join(OUT, '.git'), { recursive: true, force: true });
  git('init', '-q', '-b', 'main');
  git('add', '-A');
  git('-c', 'user.name=tabaa-pages', '-c', 'user.email=pages@users.noreply.github.com', 'commit', '-q', '-m', `Publish storefront ${snapshot.exportedAt}`);
  git('push', '--force', `https://github.com/${REPO}.git`, 'main');
  fs.rmSync(path.join(OUT, '.git'), { recursive: true, force: true });
  console.log(`نُشر الموقع: https://${REPO.split('/')[0].toLowerCase()}.github.io${BASE}`);
}
