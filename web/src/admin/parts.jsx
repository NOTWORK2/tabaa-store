import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { api, media, useTitle, STATUS, PAY } from '../lib.js';
import { Icon, Badge, Modal, useToast } from '../ui.jsx';

export const AdminCtx = createContext(null);
export const useAdmin = () => useContext(AdminCtx);

export const PERM_LABELS = {
  dashboard: 'الاطلاع على الأرباح والداشبورد',
  categories: 'إدارة أنواع الملابس',
  products: 'إدارة المنتجات والمخزون',
  designs: 'رفع التصاميم ونشرها',
  orders: 'معالجة الطلبات والدفع',
  customers: 'الاطلاع على العملاء',
  expenses: 'تسجيل المصاريف',
  music: 'إدارة موسيقى المتجر',
  staff: 'إدارة الموظفين والصلاحيات',
  settings: 'إعدادات المتجر',
};

export function Page({ title, sub, actions, back, children }) {
  const { store } = useAdmin();
  useTitle(`${title} — لوحة ${store.name}`);
  return (
    <div className="a-page">
      <header className="a-page-head">
        <div>
          {back}
          <h1>{title}</h1>
          {sub && <p>{sub}</p>}
        </div>
        {actions && <div className="a-actions">{actions}</div>}
      </header>
      {children}
    </div>
  );
}

export const StatusBadge = ({ status }) => <Badge tone={STATUS[status]?.tone}>{STATUS[status]?.label || status}</Badge>;
export const PayBadge = ({ status }) => <Badge tone={PAY[status]?.tone}>{PAY[status]?.label || status}</Badge>;

export function Confirm({ title, children, confirmLabel = 'تأكيد', danger = false, onConfirm, onClose }) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const go = async () => {
    setBusy(true);
    try { await onConfirm(); onClose(); } catch (e) { toast(e.message, 'error'); setBusy(false); }
  };
  return (
    <Modal title={title} onClose={onClose}
      footer={<><button className={`btn ${danger ? 'btn-danger' : 'btn-ink'}`} onClick={go} disabled={busy}>{confirmLabel}</button><button className="btn btn-ghost" onClick={onClose}>تراجع</button></>}>
      <div className="confirm-text">{children}</div>
    </Modal>
  );
}

/** رفع صورة إلى الخادم وإرجاع مسارها المحفوظ */
export function ImageUpload({ kind, value, onChange, label = 'رفع صورة', className = '' }) {
  const [busy, setBusy] = useState(false);
  const input = useRef(null);
  const toast = useToast();
  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const { path } = await api(`/admin/upload/${kind}`, { method: 'POST', form });
      onChange(path);
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  };
  return (
    <div className={`img-upload ${className}`}>
      <button type="button" className="img-upload-box" onClick={() => input.current.click()} disabled={busy} aria-label={label}>
        {value ? <img src={media(value)} alt="" /> : <span><Icon name="upload" /><small>{label}</small></span>}
        {busy && <span className="img-upload-busy"><span className="spinner" /></span>}
      </button>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={pick} />
      {value && <button type="button" className="link" onClick={() => input.current.click()}>تغيير الصورة</button>}
    </div>
  );
}

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const MIN = 0.04;

/**
 * أداة تحديد مساحة الطباعة بصريًا: اسحب المستطيل لتحريكه واسحب الزوايا لتغيير حجمه.
 * القيم نِسَب من صورة القطعة المربّعة، وهي نفسها التي تُستخدم في معاينة الزبون وصورة الطلب.
 */
export function PrintAreaEditor({ image, value, onChange, sampleUrl }) {
  const box = useRef(null);
  const drag = useRef(null);

  const start = (mode) => (e) => {
    e.preventDefault(); e.stopPropagation();
    drag.current = { mode, sx: e.clientX, sy: e.clientY, rect: box.current.getBoundingClientRect(), v: value };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e) => {
    const d = drag.current;
    if (!d) return;
    const dx = (e.clientX - d.sx) / d.rect.width;
    const dy = (e.clientY - d.sy) / d.rect.height;
    let { x, y, w, h } = d.v;
    if (d.mode === 'move') { x = clamp(x + dx, 0, 1 - w); y = clamp(y + dy, 0, 1 - h); }
    else {
      if (d.mode.includes('e')) w = clamp(w + dx, MIN, 1 - x);
      if (d.mode.includes('s')) h = clamp(h + dy, MIN, 1 - y);
      if (d.mode.includes('w')) { const nx = clamp(x + dx, 0, x + w - MIN); w += x - nx; x = nx; }
      if (d.mode.includes('n')) { const ny = clamp(y + dy, 0, y + h - MIN); h += y - ny; y = ny; }
    }
    onChange({ x, y, w, h });
  };
  const end = () => { drag.current = null; };

  const nudge = (e) => {
    const step = e.shiftKey ? 0.05 : 0.01;
    const map = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (!map[e.key]) return;
    e.preventDefault();
    const [dx, dy] = map[e.key];
    onChange({ ...value, x: clamp(value.x + dx, 0, 1 - value.w), y: clamp(value.y + dy, 0, 1 - value.h) });
  };
  const pct = (n) => `${Math.round(n * 100)}%`;

  return (
    <div className="area-editor">
      <div className="area-stage mockup" ref={box}>
        {image ? <img className="mockup-garment" src={media(image)} alt="" draggable="false" /> : <div className="area-noimg">ارفع صورة لون واحد على الأقل لتحديد مساحة الطباعة عليها</div>}
        <div className="area-rect" tabIndex={0} role="group" aria-label="مساحة الطباعة. استخدم الأسهم للتحريك"
          style={{ left: pct4(value.x), top: pct4(value.y), width: pct4(value.w), height: pct4(value.h) }}
          onPointerDown={start('move')} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onKeyDown={nudge}>
          {sampleUrl ? <img src={sampleUrl} alt="" draggable="false" /> : <span>مساحة الطباعة</span>}
          {['nw', 'ne', 'sw', 'se'].map((m) => (
            <i key={m} className={`area-handle area-${m}`} onPointerDown={start(m)} onPointerMove={move} onPointerUp={end} onPointerCancel={end} />
          ))}
        </div>
      </div>
      <p className="area-read">
        الموضع: {pct(value.x)} من اليسار، {pct(value.y)} من الأعلى · العرض {pct(value.w)} · الارتفاع {pct(value.h)}
      </p>
    </div>
  );
}
const pct4 = (n) => `${(n * 100).toFixed(2)}%`;

export function DateRange({ from, to, onChange }) {
  return (
    <div className="date-range">
      <label>من <input type="date" value={from || ''} max={to || undefined} onChange={(e) => onChange({ from: e.target.value, to })} /></label>
      <label>إلى <input type="date" value={to || ''} min={from || undefined} onChange={(e) => onChange({ from, to: e.target.value })} /></label>
    </div>
  );
}

/** ينفّذ إجراءً مع رسالة نجاح أو خطأ عربية */
export function useAction() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const run = async (fn, okText) => {
    setBusy(true);
    try {
      const r = await fn();
      if (okText) toast(okText);
      return r;
    } catch (e) {
      toast(e.message, 'error');
      return undefined;
    } finally { if (alive.current) setBusy(false); }
  };
  return [run, busy];
}
