// ينشئ نسخة ثابتة من المتجر لاستضافة GitHub Pages، ويرفعها عند إضافة --deploy.
//
//   npm run pages:build     يبني النسخة في web/dist-pages
//   npm run pages:deploy    يبنيها ثم يرفعها إلى مستودع الصفحات
//
// ما يُنشر:
//   - واجهة الزبون + لقطة من الكتالوج العام (الأنواع، المنتجات، التصاميم المنشورة، مناطق التوصيل) وصورها.
//   - لوحة الإدارة كنسخة عرض للقراءة فقط: الكتالوج الحقيقي (بما فيه تكلفة القطع والطباعة وإعدادات المتجر)
//     مع طلبات وعملاء ومصاريف وموظفين وهميين يولّدهم هذا السكربت في نسخة مؤقتة من البيانات.
// ما لا يُنشر: الطلبات والعملاء والمصاريف والحسابات الحقيقية، كلمات المرور، ملفات الطباعة الأصلية.
// بعد أي تعديل في المنتجات أو الأسعار من لوحة الإدارة أعد تنفيذ pages:deploy لتحديث الموقع المنشور.
import { spawn, execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { build } from 'vite';
import { ROOT, DATA_DIR, PUBLIC_DIR } from '../server/config.js';

const REPO = process.env.PAGES_REPO || 'NOTWORK2/tabaa';
const BASE = `/${REPO.split('/')[1]}/`;
const OUT = path.join(ROOT, 'web', 'dist-pages');
const MEDIA = /^[\w-]+(\/[\w.-]+)*\/[\w.-]+\.(webp|png|jpe?g|gif|mp3|m4a|aac|ogg|wav)$/i;

const today = () => new Date(Date.now() + 4 * 3600000).toISOString().slice(0, 10); // توقيت الإمارات
const addDays = (d, n) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

/** يشغّل نسخة مؤقتة من الخادم، ينفّذ fn ثم يوقفها وينتظر خروجها */
async function withServer(port, args, env, fn) {
  const server = spawn(process.execPath, ['server/index.js', '--port', String(port), ...args], {
    cwd: ROOT, stdio: 'ignore', env: { ...process.env, ...env },
  });
  const exited = new Promise((r) => server.once('exit', r));
  const base = `http://127.0.0.1:${port}/api`;
  try {
    let up = false;
    for (let i = 0; i < 120 && !up; i++) {
      await new Promise((r) => setTimeout(r, 500));
      up = await fetch(`${base}/store`).then((r) => r.ok).catch(() => false);
    }
    if (!up) throw new Error('تعذّر تشغيل الخادم المؤقت');
    return await fn(base);
  } finally {
    server.kill();
    await exited;
  }
}

async function call(base, route, { method = 'GET', body, cookie } = {}) {
  const r = await fetch(base + route, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(`${method} ${route} → ${r.status} ${json.error || ''}`), { status: r.status });
  return json;
}

async function readCatalog(base) {
  const store = await call(base, '/store');
  const categories = {};
  for (const c of store.categories) categories[c.slug] = await call(base, `/categories/${encodeURIComponent(c.slug)}`);
  return { exportedAt: new Date().toISOString(), store, categories };
}

function copyMedia(snapshot, fromDir) {
  const files = new Set();
  const walk = (v) => {
    if (typeof v === 'string') {
      const rel = v.replace(/^\/media\//, '');
      if (MEDIA.test(rel) && fs.existsSync(path.join(fromDir, rel))) files.add(rel);
    } else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(snapshot);
  let bytes = 0;
  for (const rel of files) {
    const to = path.join(OUT, 'media', rel);
    if (fs.existsSync(to)) continue;
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(path.join(fromDir, rel), to);
    bytes += fs.statSync(to).size;
  }
  return { count: files.size, bytes };
}

/* ───── نسخة عرض لوحة الإدارة: بيانات وهمية فوق الكتالوج الحقيقي ───── */

// أسماء وأرقام وعناوين مختلقة للعرض فقط
const DEMO_CUSTOMERS = [
  ['نورة السويدي', '0500000101', 'شارع الوصل، فيلا 14'],
  ['حمد المزروعي', '0500000102', 'الخالدية، بناية اللؤلؤة، شقة 802'],
  ['مريم البلوشي', '0500000103', 'المجاز 2، برج النخيل، شقة 1205'],
  ['سيف الكعبي', '0500000104', 'الجيمي، شارع 7، فيلا 3'],
  ['فاطمة الحمادي', '0500000105', 'النعيمية 1، بناية 9، شقة 301'],
  ['عبدالله الشامسي', '0500000106', 'البرشاء 1، شارع 23، فيلا 41'],
  ['علياء النقبي', '0500000107', 'الظيت الجنوبي، فيلا 18'],
  ['راشد المنصوري', '0500000108', 'مدينة خليفة أ، شارع 12، فيلا 6'],
];
// عمر كل طلب بالأيام، وما حدث له في اللوحة
const DEMO_PLAN = [
  { age: 17, steps: ['printing', 'ready', 'shipped', 'delivered'], pay: true },
  { age: 13, steps: ['printing', 'ready', 'shipped', 'delivered'], pay: true, refund: 2000 },
  { age: 9, steps: ['printing', 'ready', 'shipped'], pay: true },
  { age: 6, cancel: 'طلب الزبون الإلغاء قبل الطباعة' },
  { age: 4, steps: ['printing', 'ready'], discount: 1000 },
  { age: 2, steps: ['printing'], pay: true },
  { age: 1 },
  { age: 0 },
];
const DEMO_EXPENSES = [
  { age: 11, amount: 18000, category: 'تسويق وإعلانات', description: 'إعلان إنستغرام لمجموعة الأسماء' },
  { age: 8, amount: 4500, category: 'شحن وتوصيل', description: 'توصيل طلب خارج المدينة', order: 2 },
  { age: 3, amount: 9500, category: 'تغليف', description: 'أكياس وعلب تغليف' },
];

async function seedDemo(base, password) {
  const catalog = await readCatalog(base);
  const cats = Object.values(catalog.categories).filter((c) => c.products.length && c.designs.length);
  const zones = catalog.store.zones;
  const payments = catalog.store.payments;
  let n = 0;
  const line = () => {
    for (let tries = 0; tries < 40; tries++, n++) {
      const cat = cats[n % cats.length];
      const p = cat.products[Math.floor(n / cats.length) % cat.products.length];
      const color = p.colors.find((c) => p.sizes.some((s) => c.stock[s] >= 3));
      if (!color) continue;
      const size = p.sizes.find((s) => color.stock[s] >= 3);
      color.stock[size] -= 2; // نحسب محليًا ما حجزناه حتى لا نتجاوز المخزون
      const item = { productId: p.id, colorId: color.id, size, designId: cat.designs[n % cat.designs.length].id, qty: 1 + (n % 2) };
      n++;
      return item;
    }
    throw new Error('لا يوجد مخزون كافٍ لتوليد طلبات العرض');
  };

  const created = [];
  for (const [i, [name, phone, address]] of DEMO_CUSTOMERS.entries()) {
    const { order } = await call(base, '/orders', {
      method: 'POST',
      body: {
        requestId: `demo-order-${crypto.randomBytes(8).toString('hex')}`, name, phone, address,
        zoneId: zones[i % zones.length].id, paymentMethod: payments[i % payments.length].key,
        notes: i === 2 ? 'التسليم بعد الساعة 5 مساءً' : '', items: i % 3 === 0 ? [line(), line()] : [line()],
      },
    });
    created.push(order);
  }

  const login = await fetch(`${base}/admin/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password }),
  });
  const cookie = (login.headers.getSetCookie()[0] || '').split(';')[0];
  const admin = (route, method, body) => call(base, `/admin${route}`, { method, body, cookie });
  const list = (await admin('/orders')).orders.sort((a, b) => a.id - b.id);

  for (const [i, plan] of DEMO_PLAN.entries()) {
    const o = list[i];
    if (plan.discount) await admin(`/orders/${o.id}/discount`, 'POST', { amount: plan.discount });
    for (const status of plan.steps || []) await admin(`/orders/${o.id}/status`, 'POST', { status });
    if (plan.pay) {
      const { order } = await admin(`/orders/${o.id}`);
      await admin(`/orders/${o.id}/payment`, 'POST', { amount: order.due });
    }
    if (plan.refund) await admin(`/orders/${o.id}/refund`, 'POST', { amount: plan.refund, note: 'تعويض عن تأخير التوصيل' });
    if (plan.cancel) await admin(`/orders/${o.id}/cancel`, 'POST', { note: plan.cancel });
  }
  for (const e of DEMO_EXPENSES) {
    await admin('/expenses', 'POST', {
      amount: e.amount, date: today(), category: e.category, description: e.description,
      orderNumber: e.order !== undefined ? list[e.order].number : '',
    });
  }
  const pass = () => crypto.randomBytes(12).toString('base64url');
  await admin('/staff', 'POST', { name: 'سارة (تصاميم)', username: 'designer', password: pass(), permissions: ['designs'] });
  await admin('/staff', 'POST', { name: 'خالد (طلبات)', username: 'orders', password: pass(), permissions: ['orders', 'customers'] });
}

/** يوزّع الطلبات والمصاريف على الأيام الماضية حتى يظهر الرسم والفلاتر ببيانات واقعية الشكل */
function spreadDates(dir) {
  const file = (name) => path.join(dir, 'db', `${name}.json`);
  const read = (name) => JSON.parse(fs.readFileSync(file(name), 'utf8'));
  const back = (iso, days) => (iso ? new Date(Date.parse(iso) - days * 86400000).toISOString() : iso);
  const orders = read('orders');
  orders.forEach((o, i) => {
    const days = DEMO_PLAN[i]?.age ?? 0;
    for (const k of ['createdAt', 'printedAt', 'paidAt', 'costAt', 'cancelledAt']) o[k] = back(o[k], days);
    o.events.forEach((e) => { e.at = back(e.at, days); });
    o.payments.forEach((p) => { p.at = back(p.at, days); });
    const day = new Date(Date.parse(o.createdAt) + 4 * 3600000).toISOString().slice(2, 10).replaceAll('-', '');
    o.number = `TB-${day}-${String(o.id).padStart(4, '0')}`;
  });
  const customers = read('customers');
  for (const c of customers) c.createdAt = orders.find((o) => o.customerId === c.id)?.createdAt || c.createdAt;
  const expenses = read('expenses');
  expenses.forEach((e, i) => { e.date = addDays(today(), -(DEMO_EXPENSES[i]?.age ?? 0)); });
  fs.writeFileSync(file('orders'), JSON.stringify(orders));
  fs.writeFileSync(file('customers'), JSON.stringify(customers));
  fs.writeFileSync(file('expenses'), JSON.stringify(expenses));
}

async function snapshotAdmin(base, password) {
  const login = await fetch(`${base}/admin/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password }),
  });
  const cookie = (login.headers.getSetCookie()[0] || '').split(';')[0];
  const admin = (route) => call(base, `/admin${route}`, { cookie });
  const pages = {};
  for (const route of ['/session', '/pulse', '/categories', '/products', '/designs', '/preview-garments', '/music', '/staff', '/settings']) {
    pages[`/admin${route}`] = await admin(route);
  }
  for (const p of pages['/admin/products'].products) pages[`/admin/products/${p.id}`] = await admin(`/products/${p.id}`);
  const orders = await admin('/orders');
  for (const o of orders.orders) pages[`/admin/orders/${o.id}`] = await admin(`/orders/${o.id}`);
  const { customers } = await admin('/customers?q=');
  for (const c of customers) pages[`/admin/customers/${c.id}`] = await admin(`/customers/${c.id}`);
  const t = today();
  const range = (from) => admin(`/dashboard?from=${from}&to=${t}`);
  return {
    exportedAt: new Date().toISOString(), session: pages['/admin/session'], pages,
    orders: orders.orders, orderCounts: orders.counts, customers,
    expenses: (await admin(`/expenses?from=${addDays(t, -120)}&to=${t}&category=`)).expenses,
    dashboard: { day: await range(t), week: await range(addDays(t, -6)), month: await range(addDays(t, -29)) },
  };
}

async function buildAdminDemo() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tabaa-demo-'));
  try {
    // نسخة مؤقتة من الكتالوج الحقيقي، بلا أي بيانات عمل حقيقية (طلبات، عملاء، مصاريف، حسابات، جلسات)
    fs.cpSync(DATA_DIR, tmp, {
      recursive: true,
      filter: (src) => {
        const rel = path.relative(DATA_DIR, src).split(path.sep).join('/');
        return !(rel === 'demo' || rel.startsWith('demo/') || rel === 'admin-login.txt' || /^storage\/(public|private)\/orders\/./.test(rel));
      },
    });
    for (const name of ['orders', 'customers', 'expenses', 'sessions', 'staff']) fs.rmSync(path.join(tmp, 'db', `${name}.json`), { force: true });

    const password = crypto.randomBytes(18).toString('base64url'); // حساب مؤقت يُحذف مع المجلد
    const env = { ADMIN_PASSWORD: password };
    await withServer(39872, ['--data', tmp], env, (base) => seedDemo(base, password));
    spreadDates(tmp);
    const demo = await withServer(39872, ['--data', tmp], env, (base) => snapshotAdmin(base, password));

    const text = JSON.stringify(demo);
    if (/passwordHash|tokenHash|"token"|"requestId"/.test(text)) throw new Error('لقطة اللوحة تحتوي حقولًا خاصة');
    fs.writeFileSync(path.join(OUT, 'admin-demo.json'), text);
    copyMedia(demo, path.join(tmp, 'storage', 'public'));
    return demo;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
  }
}

/* ───── البناء ───── */

process.env.VITE_STATIC = '1';
await build({ configFile: path.join(ROOT, 'vite.config.js'), base: BASE, logLevel: 'warn', build: { outDir: 'dist-pages', emptyOutDir: true } });

// خادم مؤقت يقرأ مجلد البيانات نفسه، حتى تطابق اللقطة ما يعرضه المتجر الفعلي تمامًا
const snapshot = await withServer(39871, [], {}, readCatalog);
fs.writeFileSync(path.join(OUT, 'catalog.json'), JSON.stringify(snapshot));
const media = copyMedia(snapshot, PUBLIC_DIR);
const demo = await buildAdminDemo();
// GitHub Pages يعيد 404.html لأي رابط داخلي مثل /cart أو /admin/orders، فتفتح الواجهة وتكمل التوجيه في المتصفح
fs.copyFileSync(path.join(OUT, 'index.html'), path.join(OUT, '404.html'));
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');

const products = Object.values(snapshot.categories).reduce((s, c) => s + c.products.length, 0);
console.log(`النسخة الثابتة جاهزة في ${OUT}`);
console.log(`المتجر: ${snapshot.store.categories.length} نوع، ${products} منتج، ${media.count} ملف وسائط (${(media.bytes / 1048576).toFixed(1)} ميغابايت)`);
console.log(`عرض اللوحة: ${demo.orders.length} طلب وهمي، ${demo.customers.length} عميل، ${demo.expenses.length} مصروف`);
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
  const site = `https://${REPO.split('/')[0].toLowerCase()}.github.io${BASE}`;
  console.log(`نُشر الموقع: ${site}\nعرض لوحة الإدارة: ${site}admin`);
}
