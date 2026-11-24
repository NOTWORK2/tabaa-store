import { useEffect, useState, useSyncExternalStore, useCallback } from 'react';
import { staticApi } from './static-api.js';

// النسخة الثابتة (GitHub Pages) تُبنى بـ VITE_STATIC=1: واجهة الزبون فقط، بلا خادم
export const STATIC = import.meta.env.VITE_STATIC === '1';
/** مسار ملف عام (من web/public) يحترم المسار الأساسي للموقع */
export const asset = (p) => `${import.meta.env.BASE_URL}${String(p).replace(/^\//, '')}`;

/* ───── الاتصال بالخادم ───── */
export async function api(path, { method = 'GET', body, form } = {}) {
  if (STATIC) return staticApi(path, { method, body });
  const opt = { method, headers: {}, credentials: 'same-origin' };
  if (form) opt.body = form;
  else if (body !== undefined) {
    opt.headers['Content-Type'] = 'application/json';
    opt.body = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(`/api${path}`, opt);
  } catch {
    const e = new Error('تعذّر الاتصال بالخادم. تحقق من الإنترنت ثم حاول مجددًا');
    e.status = 0;
    throw e;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // انتهاء الجلسة أثناء العمل في اللوحة: نعيد الموظف إلى صفحة الدخول
    if (res.status === 401 && path.startsWith('/admin/') && path !== '/admin/login') window.dispatchEvent(new Event('tb:unauth'));
    const e = new Error(data.error || 'حدث خطأ غير متوقع');
    e.status = res.status;
    e.data = data;
    throw e;
  }
  return data;
}

/** جلب بيانات مع حالات التحميل والخطأ وإعادة المحاولة */
export function useLoad(path, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!path) return undefined;
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    api(path)
      .then((data) => alive && setState({ data, error: null, loading: false }))
      .catch((error) => alive && setState({ data: null, error, loading: false }));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, tick, ...deps]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  const setData = useCallback((fn) => setState((s) => ({ ...s, data: typeof fn === 'function' ? fn(s.data) : fn })), []);
  return { ...state, reload, setData };
}

/* ───── تنسيق ───── */
export const media = (rel) => (rel ? `${import.meta.env.BASE_URL}media/${rel}${rel.startsWith('categories/') ? '?v=lookbook-1' : ''}` : null);

export function printLink(item) {
  const params = new URLSearchParams({ design: item.id, product: item.productId, color: item.colorId });
  return `/design/${item.slug}?${params}`;
}

export const sizeLabel = (s) => (String(s).startsWith("مقاس") ? String(s) : `مقاس ${s}`);

export function fmt(fils) {
  const neg = Number(fils) < 0;
  const v = Math.abs(Number(fils) || 0) / 100;
  const s = Number.isInteger(v)
    ? v.toLocaleString('en-US')
    : v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  // علامة السالب قبل الرقم مع محرف اتجاه حتى لا تنقلب في النص العربي
  return `${neg ? "‎−" : ""}${s} د.إ`;
}

export function toLatin(s) {
  return String(s ?? '')
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/٫/g, '.');
}
/** نص مبلغ بالدرهم ← فلس (NaN إن لم يكن رقمًا) */
export function toFils(str) {
  const t = toLatin(str).replace(/,/g, '.').trim();
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return NaN;
  return Math.round(Number(t) * 100);
}
export const fromFils = (f) => (f === undefined || f === null || f === '' || Number.isNaN(Number(f)) ? '' : String(Number(f) / 100));

const DT = { timeZone: 'Asia/Dubai', numberingSystem: 'latn' };
export const fmtDate = (iso) => (iso ? new Intl.DateTimeFormat('ar-AE', { ...DT, day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso)) : '—');
export const fmtDateTime = (iso) => (iso ? new Intl.DateTimeFormat('ar-AE', { ...DT, day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(iso)) : '—');
export const fmtDay = (ymd) => fmtDate(`${ymd}T12:00:00+04:00`);
export const todayLocal = () => new Date(Date.now() + 4 * 3600000).toISOString().slice(0, 10);
export const addDays = (d, n) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

export function onBrand(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(String(hex).slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.6 ? '#1b1815' : '#ffffff';
}

/* ───── السلة (محفوظة في المتصفح، والأسعار والمخزون تُتحقق دائمًا من الخادم) ───── */
const CART_KEY = 'tb:cart';
let cart = [];
try { cart = JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch { cart = []; }
const subs = new Set();
function commit(next) {
  cart = next;
  try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch { /* تخزين المتصفح ممتلئ أو معطّل */ }
  subs.forEach((f) => f());
}
export const lineKey = (i) => `${i.productId}|${i.colorId}|${i.size}|${i.designId}`;
export const cartStore = {
  get: () => cart,
  subscribe: (f) => { subs.add(f); return () => subs.delete(f); },
  // نفس القطعة بنفس اللون والمقاس والتصميم تزيد الكمية. أي اختلاف ينشئ سطرًا مستقلًا
  add(item) {
    const key = lineKey(item);
    const found = cart.find((l) => lineKey(l) === key);
    commit(found
      ? cart.map((l) => (lineKey(l) === key ? { ...l, qty: Math.min(99, l.qty + item.qty) } : l))
      : [...cart, { productId: item.productId, colorId: item.colorId, size: item.size, designId: item.designId, qty: item.qty }]);
  },
  setQty: (key, qty) => commit(cart.map((l) => (lineKey(l) === key ? { ...l, qty: Math.max(1, Math.min(99, qty)) } : l))),
  remove: (key) => commit(cart.filter((l) => lineKey(l) !== key)),
  clear: () => commit([]),
};
window.addEventListener('storage', (e) => {
  if (e.key !== CART_KEY) return;
  try { cart = JSON.parse(e.newValue) || []; } catch { cart = []; }
  subs.forEach((f) => f());
});
export const useCart = () => useSyncExternalStore(cartStore.subscribe, cartStore.get);

export function useTitle(title) {
  useEffect(() => { if (title) document.title = title; }, [title]);
}

export const STATUS = {
  new: { label: 'جديد', tone: 'brand' },
  printing: { label: 'قيد الطباعة', tone: 'info' },
  ready: { label: 'جاهز للشحن', tone: 'info' },
  shipped: { label: 'تم الشحن', tone: 'info' },
  delivered: { label: 'تم التسليم', tone: 'ok' },
  cancelled: { label: 'ملغى', tone: 'mute' },
};
export const FLOW = ['new', 'printing', 'ready', 'shipped', 'delivered'];
export const PAY = {
  unpaid: { label: 'بانتظار الدفع', tone: 'warn' },
  partial: { label: 'مدفوع جزئيًا', tone: 'warn' },
  paid: { label: 'مدفوع', tone: 'ok' },
  partial_refund: { label: 'مسترجع جزئيًا', tone: 'mute' },
  refunded: { label: 'مسترجع', tone: 'mute' },
};
