import { TZ_SUFFIX } from './config.js';

export class HttpError extends Error {
  constructor(status, message, extra) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}
export const fail = (message, status = 400, extra) => {
  throw new HttpError(status, message, extra);
};

export function toLatinDigits(s) {
  return String(s ?? '')
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

export function text(v, label, { max = 200, required = true } = {}) {
  const s = String(v ?? '').trim();
  if (!s && required) fail(`يرجى إدخال ${label}`);
  if (s.length > max) fail(`${label}: النص أطول من المسموح (${max} حرفًا)`);
  return s;
}

// المبالغ تُخزَّن بالفلس (عدد صحيح) لتفادي أخطاء الكسور
export function money(v, label, { min = 0, max = 100_000_00 } = {}) {
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) fail(`${label}: مبلغ غير صالح`);
  return n;
}

export function int(v, label, { min = 0, max = 1_000_000 } = {}) {
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) fail(`${label}: قيمة غير صالحة`);
  return n;
}

export function hexColor(v, label = 'اللون') {
  const s = String(v ?? '').trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(s)) fail(`${label}: صيغة اللون غير صالحة`);
  return s.toLowerCase();
}

export function area(v) {
  const a = typeof v === 'string' ? JSON.parse(v) : v;
  const ok = a && ['x', 'y', 'w', 'h'].every((k) => typeof a[k] === 'number' && a[k] >= 0 && a[k] <= 1);
  if (!ok || a.w < 0.03 || a.h < 0.03 || a.x + a.w > 1.001 || a.y + a.h > 1.001) fail('مساحة الطباعة غير صالحة');
  const r = (n) => Math.round(n * 10000) / 10000;
  return { x: r(a.x), y: r(a.y), w: r(a.w), h: r(a.h) };
}

export function normPhone(raw) {
  let s = toLatinDigits(raw).replace(/[^\d+]/g, '');
  if (s.startsWith('00')) s = '+' + s.slice(2);
  if (/^05\d{8}$/.test(s)) s = '+971' + s.slice(1);
  else if (/^5\d{8}$/.test(s)) s = '+971' + s;
  else if (/^971\d{9}$/.test(s)) s = '+' + s;
  const digits = s.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) return null;
  return s.startsWith('+') ? '+' + digits : digits;
}

export function isDate(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
}
export const dayStartUtc = (d) => new Date(`${d}T00:00:00${TZ_SUFFIX}`).toISOString();
export const dayEndUtc = (d) => new Date(new Date(`${d}T00:00:00${TZ_SUFFIX}`).getTime() + 86400000).toISOString();
export function todayLocal() {
  return new Date(Date.now() + 4 * 3600000).toISOString().slice(0, 10);
}
export function addDays(d, n) {
  return new Date(Date.parse(`${d}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
}

// «مقاس M»، لكن «مقاس موحّد» لا تُكرَّر فيها الكلمة
export const sizeLabel = (s) => (String(s).startsWith("مقاس") ? String(s) : `مقاس ${s}`);

export function fmtMoney(fils) {
  const v = Math.abs(fils) / 100;
  // علامة السالب قبل الرقم مع محرف اتجاه حتى لا تنقلب في النص العربي
  return `${fils < 0 ? "‎−" : ""}${Number.isInteger(v) ? v : v.toFixed(2)} د.إ`;
}
