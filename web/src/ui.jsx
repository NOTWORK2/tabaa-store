import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { media, toFils, fromFils } from './lib.js';

/* ───── أيقونات خطية بسيطة ───── */
const P = {
  facebook: 'M14.5 21v-8h3l.5-3h-3.5V8c0-1 .4-1.5 1.6-1.5H18V3.7c-.7-.1-1.6-.2-2.5-.2-2.8 0-4.5 1.7-4.5 4.4V10H8v3h3v8Z',
  instagram: 'M8 3h8a5 5 0 0 1 5 5v8a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5V8a5 5 0 0 1 5-5Zm8 9a4 4 0 1 1-8 0 4 4 0 0 1 8 0Zm1-5h.1',
  tiktok: 'M13 3h3a5.5 5.5 0 0 0 5 5v3a8.5 8.5 0 0 1-5-1.8V16a6 6 0 1 1-7-5.9v3.2a2.9 2.9 0 1 0 4 2.7Z',
  telegram: 'm2.5 11 18-7-3.2 16-6-4.5-3 2.5v-5l8-6-10 5.5Z',
  youtube: 'M6 5.5h12c2 0 3 1 3.3 3a25 25 0 0 1 0 7c-.3 2-1.3 3-3.3 3H6c-2 0-3-1-3.3-3a25 25 0 0 1 0-7c.3-2 1.3-3 3.3-3Zm4 3.5v6l5-3Z',
  bag: 'M5 8.5h14l1 12H4l1-12ZM8.5 9V6a3.5 3.5 0 0 1 7 0v3',
  spool: 'm5 3 12 1-1 3-9-1-2-3Zm2 3-1 11m10-10-1 11M4 17l13 1-1 3-13-1 1-3ZM7 8l8 4M7 11l8 4m1 6c3.5 1.3 4.5-1 5-3',
  truck: 'M2 5h12v11H6m8-8h4l4 5v3h-2m-6 0h2M7 18a2 2 0 1 0 0-4 2 2 0 1 0 0 4Zm11 0a2 2 0 1 0 0-4 2 2 0 1 0 0 4Z',
  return: 'M4 10h11a5.5 5.5 0 0 1 0 11h-3M9 5l-5 5 5 5',
  cart: 'M3 4h2.5l2.2 11h10.6l2-8H7M9.5 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm8 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z',
  play: 'M7 4.5v15l12-7.5-12-7.5Z',
  pause: 'M7 5v14M17 5v14',
  volume: 'M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4ZM15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11',
  mute: 'M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4ZM16 9.5l5 5M21 9.5l-5 5',
  check: 'M4.5 12.5 10 18 19.5 7',
  trash: 'M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10 11v5.5M14 11v5.5',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  back: 'M10 6l-6 6 6 6M4 12h16',
  next: 'M14 6l6 6-6 6M20 12H4',
  menu: 'M4 7h16M4 12h16M4 17h16',
  close: 'M6 6l12 12M18 6 6 18',
  download: 'M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 19.5h14',
  search: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13ZM20 20l-4.6-4.6',
  edit: 'M4 20h4L19 9l-4-4L4 16v4ZM13.5 6.5l4 4',
  eye: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  eyeOff: 'M4 4l16 16M9.5 5.9A8.6 8.6 0 0 1 12 5.5c6 0 9.500 6.5 9.500 6.5a15 15 0 0 1-3 3.700M14.500 17.900a8.300 8.300 0 0 1-2.500.600C6 18.500 2.500 12 2.500 12a15.300 15.300 0 0 1 4-4.400M10 10a3 3 0 0 0 4 4',
  up: 'M12 19V5M6 11l6-6 6 6',
  down: 'M12 5v14M6 13l6 6 6-6',
  upload: 'M12 16V5m0 0L7.5 9.5M12 5l4.5 4.5M5 19.5h14',
  alert: 'M12 4 2.5 20h19L12 4ZM12 10v4.500M12 17.200v.100',
  logout: 'M14 4h5v16h-5M10 8l-4 4 4 4M6 12h9',
  home: 'M4 11.500 12 4l8 7.500V20h-5v-5h-6v5H4v-8.500Z',
  box: 'M4 8l8-4 8 4v8l-8 4-8-4V8ZM4 8l8 4 8-4M12 12v8',
  image: 'M4 5h16v14H4V5ZM4 15l4.500-4.500 4 4 2.500-2.500L20 17M15.500 9.500v.100',
  users: 'M9 11a3.500 3.500 0 1 0 0-7 3.500 3.500 0 0 0 0 7ZM2.500 20a6.500 6.500 0 0 1 13 0M16 4.300a3.500 3.500 0 0 1 0 6.400M18.500 14.500A6.500 6.500 0 0 1 21.500 20',
  receipt: 'M6 3.500h12v17l-3-2-3 2-3-2-3 2v-17ZM9 8h6M9 12h6',
  chart: 'M4 20V4M4 20h16M8 16v-4M12 16V8M16 16v-6',
  tag: 'M4 4h7l9 9-7 7-9-9V4ZM8 8v.100',
  music: 'M9 18V5.500l10-2V16M9 18a2.500 2.500 0 1 1-5 0 2.500 2.500 0 0 1 5 0ZM19 16a2.500 2.500 0 1 1-5 0 2.500 2.500 0 0 1 5 0Z',
  shield: 'M12 3.500 5 6v6c0 4 3 7 7 8.500 4-1.500 7-4.500 7-8.500V6l-7-2.500ZM9 12l2.500 2.500L15.500 10',
  gear: 'M12 15.500a3.500 3.500 0 1 0 0-7 3.500 3.500 0 0 0 0 7ZM12 2.500v3M12 18.500v3M2.500 12h3M18.500 12h3M5.300 5.300l2.100 2.100M16.600 16.600l2.100 2.100M5.300 18.700l2.100-2.100M16.600 7.400l2.100-2.100',
  wallet: 'M4 7.500A2.500 2.500 0 0 1 6.500 5H18v3M4 7.500V17a2 2 0 0 0 2 2h14V8H6.500A2.500 2.500 0 0 1 4 7.500ZM16.500 13.500v.100',
  copy: 'M8 8h11v12H8V8ZM5 16V4h11',
  link: 'M10 14a4 4 0 0 0 5.700 0l3-3a4 4 0 0 0-5.700-5.700l-1 1M14 10a4 4 0 0 0-5.700 0l-3 3A4 4 0 0 0 11 18.700l1-1',
};
export function Icon({ name, size = 20, fill = false, className = '' }) {
  return (
    <svg className={`icon ${className}`} width={size} height={size} viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'}
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={P[name]} />
    </svg>
  );
}
export const WhatsAppIcon = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 2a10 10 0 0 0-8.600 15.100L2 22l5-1.300A10 10 0 1 0 12 2Zm0 1.800a8.200 8.200 0 1 1-4.300 15.200l-.300-.200-2.900.800.800-2.800-.200-.300A8.200 8.200 0 0 1 12 3.800Zm-3.200 4c-.200 0-.500.100-.700.400-.300.300-1 1-1 2.300s1 2.700 1.100 2.900c.100.200 1.900 3 4.700 4.100 2.300.900 2.800.700 3.300.700.500-.100 1.600-.700 1.800-1.300.200-.600.200-1.200.200-1.300-.100-.100-.300-.200-.600-.300l-1.900-.900c-.300-.100-.500-.200-.600.100l-.900 1.100c-.200.200-.300.200-.600.100-.300-.200-1.200-.500-2.300-1.400-.800-.800-1.400-1.700-1.600-2-.200-.300 0-.400.100-.600l.500-.500.300-.500c.100-.200 0-.400 0-.500l-.900-2c-.200-.400-.400-.400-.600-.400h-.300Z" />
  </svg>
);

/* ───── رسائل الإشعار ───── */
const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((text, tone = 'ok', ms = 4200) => {
    const id = Math.random().toString(36).slice(2);
    setItems((l) => [...l.slice(-3), { id, text, tone }]);
    setTimeout(() => setItems((l) => l.filter((t) => t.id !== id)), ms);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast toast-${t.tone}`}>
            <Icon name={t.tone === 'error' ? 'alert' : 'check'} size={18} />
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ───── عناصر عامة ───── */
export const Spinner = ({ label = 'جارٍ التحميل…' }) => (
  <div className="spinner-wrap" role="status"><span className="spinner" /><span>{label}</span></div>
);

export function ErrorBox({ error, onRetry }) {
  return (
    <div className="notice notice-error">
      <Icon name="alert" />
      <div>
        <strong>{error?.message || 'حدث خطأ'}</strong>
        {onRetry && <div><button className="link" onClick={onRetry}>إعادة المحاولة</button></div>}
      </div>
    </div>
  );
}

export function Empty({ title, children }) {
  return <div className="empty"><strong>{title}</strong>{children && <p>{children}</p>}</div>;
}

export const Badge = ({ tone = 'mute', children }) => <span className={`badge badge-${tone}`}>{children}</span>;

export function Modal({ title, onClose, children, footer, wide = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.focus();
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}>
        <header className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="إغلاق"><Icon name="close" /></button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>
  );
}

export function Field({ label, hint, error, children, className = '' }) {
  return (
    <label className={`field ${className}`}>
      {label && <span className="field-label">{label}</span>}
      {children}
      {hint && !error && <span className="field-hint">{hint}</span>}
      {error && <span className="field-error">{error}</span>}
    </label>
  );
}

/** حقل مبلغ بالدرهم: يُظهر الدرهم ويُعيد القيمة بالفلس (أو NaN إذا كان النص غير صالح) */
export function MoneyInput({ value, onChange, ...rest }) {
  const [txt, setTxt] = useState(fromFils(value));
  const last = useRef(value);
  useEffect(() => {
    if (value !== last.current && !(Number.isNaN(value) && Number.isNaN(last.current))) {
      last.current = value;
      setTxt(fromFils(value));
    }
  }, [value]);
  return (
    <span className="money-input">
      <input
        inputMode="decimal" dir="ltr" value={txt} placeholder="0" {...rest}
        onChange={(e) => {
          setTxt(e.target.value);
          const f = e.target.value.trim() === '' ? NaN : toFils(e.target.value);
          last.current = f;
          onChange(f);
        }}
      />
      <span className="money-unit">د.إ</span>
    </span>
  );
}

export function Toggle({ checked, onChange, label, disabled }) {
  return (
    <label className={`toggle ${disabled ? 'is-disabled' : ''}`}>
      <input type="checkbox" checked={!!checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-track" aria-hidden="true"><span className="toggle-thumb" /></span>
      {label && <span>{label}</span>}
    </label>
  );
}

export function Stepper({ value, min = 1, max = 99, onChange, label = 'الكمية' }) {
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button type="button" onClick={() => onChange(value + 1)} disabled={value >= max} aria-label="زيادة"><Icon name="plus" size={18} /></button>
      <output aria-live="polite">{value}</output>
      <button type="button" onClick={() => onChange(value - 1)} disabled={value <= min} aria-label="إنقاص"><Icon name="minus" size={18} /></button>
    </div>
  );
}

/**
 * معاينة القطعة: صورة اللباس المربّعة وفوقها التصميم داخل مساحة الطباعة (نِسَب من 0 إلى 1).
 * نفس الحساب يُستخدم على الخادم عند حفظ صورة المعاينة مع الطلب.
 */
export function Mockup({ image, design, designUrl, area, className = '', marks = false, children }) {
  const src = designUrl || media(design);
  return (
    <div className={`mockup ${marks ? 'mockup-marks' : ''} ${className}`}>
      {image ? <img className="mockup-garment" src={media(image)} alt="" draggable="false" /> : <div className="mockup-blank" />}
      {src && area && (
        <div className="mockup-print" style={{ left: `${area.x * 100}%`, top: `${area.y * 100}%`, width: `${area.w * 100}%`, height: `${area.h * 100}%` }}>
          <img src={src} alt="" draggable="false" />
        </div>
      )}
      {children}
    </div>
  );
}
