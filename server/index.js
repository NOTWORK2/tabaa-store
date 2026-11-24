import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import multer from 'multer';
import { ROOT, PORT, PUBLIC_DIR, DATA_DIR } from './config.js';
import './store.js';
import { ensureOwner } from './auth.js';
import { seedIfEmpty } from './seed.js';
import { installCatalogPhotos } from './catalog-photos.js';
import { installPrintCollection } from './print-collection.js';
import { HttpError } from './util.js';
import { router as publicRouter } from './routes/public.js';
import { router as adminRouter } from './routes/admin.js';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 'loopback');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  next();
});
app.use(express.json({ limit: '1mb' }));

// الملفات المرفوعة (صور وصوت) بأسماء عشوائية ثابتة، فيمكن تخزينها مؤقتًا طويلًا
app.use('/media', express.static(PUBLIC_DIR, { maxAge: '30d', immutable: true, index: false, fallthrough: false }));

app.use('/api', (req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
app.use('/api/admin', adminRouter);
app.use('/api', publicRouter);
app.use('/api', (req, res) => res.status(404).json({ error: 'المسار غير موجود' }));

const DIST = path.join(ROOT, 'web', 'dist');
const hasDist = fs.existsSync(path.join(DIST, 'index.html'));
if (hasDist) {
  app.use(express.static(DIST, { index: false, maxAge: '1h' }));
  // كل روابط المتجر واللوحة (مثل /admin/orders) تفتح مباشرة: تُعاد صفحة التطبيق والتوجيه يتم في المتصفح
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/media')) return next();
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(DIST, 'index.html'));
  });
}

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, ...(err.extra || {}) });
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'حجم الملف أكبر من المسموح' : 'تعذّر رفع الملف' });
  }
  if (err?.status === 404) return res.status(404).json({ error: 'الملف غير موجود' });
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'بيانات غير صالحة' });
  console.error(err);
  res.status(500).json({ error: 'حدث خطأ غير متوقع في الخادم. حاول مجددًا' });
});

ensureOwner();
await seedIfEmpty();
await installCatalogPhotos();
await installPrintCollection();

app.listen(PORT, () => {
  const lan = Object.values(os.networkInterfaces()).flat().find((n) => n && n.family === 'IPv4' && !n.internal)?.address;
  console.log(`المتجر يعمل: http://localhost:${PORT}`);
  console.log(`لوحة الإدارة: http://localhost:${PORT}/admin`);
  if (lan) console.log(`من الهاتف على نفس الشبكة: http://${lan}:${PORT}`);
  console.log(`مجلد البيانات: ${DATA_DIR}`);
  if (!hasDist) console.log('تنبيه: الواجهة غير مبنية بعد. نفّذ: npm run build');
});
