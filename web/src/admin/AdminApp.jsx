import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import './admin.css';
import { api, fmt, media, useTitle, STATIC } from '../lib.js';
import { Icon, Spinner, ErrorBox, Field, Modal, Empty, useToast } from '../ui.jsx';
import { AdminCtx, useAdmin, useAction } from './parts.jsx';
import Dashboard from './Dashboard.jsx';
import { Categories, Products, ProductEdit, Designs } from './Catalog.jsx';
import { Orders, OrderDetail, Customers, CustomerDetail } from './Orders.jsx';
import { Expenses, MusicPage, StaffPage, SettingsPage } from './Misc.jsx';

const NAV = [
  { to: 'dashboard', perm: 'dashboard', label: 'الداشبورد والأرباح', icon: 'chart' },
  { to: 'categories', perm: 'categories', label: 'أنواع الملابس', icon: 'tag' },
  { to: 'products', perm: 'products', label: 'المنتجات والمخزون', icon: 'box' },
  { to: 'designs', perm: 'designs', label: 'مكتبة التصاميم', icon: 'image' },
  { to: 'orders', perm: 'orders', label: 'الطلبات', icon: 'receipt' },
  { to: 'customers', perm: 'customers', label: 'العملاء', icon: 'users' },
  { to: 'expenses', perm: 'expenses', label: 'المصاريف', icon: 'wallet' },
  { to: 'music', perm: 'music', label: 'الموسيقى', icon: 'music' },
  { to: 'staff', perm: 'staff', label: 'الموظفون والصلاحيات', icon: 'shield' },
  { to: 'settings', perm: 'settings', label: 'إعدادات المتجر', icon: 'gear' },
];

function Login({ store, onDone }) {
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  useTitle(`تسجيل الدخول — لوحة ${store.name}`);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try { onDone((await api('/admin/login', { method: 'POST', body: form })).staff); } catch (err) { setError(err.message); setBusy(false); }
  };
  return (
    <div className="a-login">
      <form className="a-login-card" onSubmit={submit}>
        <span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span>
        <h1>لوحة إدارة {store.name}</h1>
        <p>سجّل الدخول بحساب الموظف.</p>
        <Field label="اسم المستخدم">
          <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} dir="ltr" autoComplete="username" autoFocus required />
        </Field>
        <Field label="كلمة المرور">
          <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} dir="ltr" autoComplete="current-password" required />
        </Field>
        {error && <p className="field-error" role="alert">{error}</p>}
        <button className="btn btn-ink btn-block" disabled={busy}>{busy ? 'جارٍ الدخول…' : 'تسجيل الدخول'}</button>
        <Link to="/" className="link center-link">العودة إلى المتجر</Link>
      </form>
    </div>
  );
}

function PasswordModal({ onClose }) {
  const [f, setF] = useState({ current: '', next: '' });
  const [run, busy] = useAction();
  const save = async (e) => {
    e.preventDefault();
    if (await run(() => api('/admin/me/password', { method: 'PUT', body: f }), 'تم تغيير كلمة المرور')) onClose();
  };
  return (
    <Modal title="تغيير كلمة المرور" onClose={onClose}>
      <form className="a-form" onSubmit={save}>
        <Field label="كلمة المرور الحالية"><input type="password" dir="ltr" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} autoComplete="current-password" required /></Field>
        <Field label="كلمة المرور الجديدة" hint="8 أحرف على الأقل"><input type="password" dir="ltr" value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} autoComplete="new-password" minLength={8} required /></Field>
        <button className="btn btn-ink" disabled={busy}>حفظ</button>
      </form>
    </Modal>
  );
}

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.frequency.value = 880; g.gain.value = 0.08;
    o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + 0.18);
    o.onended = () => ctx.close();
  } catch { /* الصوت غير متاح */ }
}

function Guard({ perm, children }) {
  const { can } = useAdmin();
  if (!can(perm)) {
    return <div className="a-page"><Empty title="لا تملك صلاحية فتح هذه الصفحة">اطلب من مدير المتجر منحك الصلاحية المناسبة.</Empty></div>;
  }
  return children;
}

export default function AdminApp() {
  const [session, setSession] = useState({ loading: true, staff: null, store: null, error: null });
  const [pulse, setPulse] = useState({ newOrders: 0, lastOrderId: 0 });
  const [menu, setMenu] = useState(false);
  const [pwd, setPwd] = useState(false);
  const seen = useRef(null);
  const toast = useToast();
  const { pathname } = useLocation();

  const load = useCallback(() => {
    api('/admin/session')
      .then((d) => setSession({ loading: false, staff: d.staff, store: d.store, error: null }))
      .catch((error) => setSession((s) => ({ ...s, loading: false, error })));
  }, []);
  useEffect(load, [load]);
  useEffect(() => {
    const out = () => setSession((s) => ({ ...s, staff: null }));
    window.addEventListener('tb:unauth', out);
    return () => window.removeEventListener('tb:unauth', out);
  }, []);
  useEffect(() => { setMenu(false); window.scrollTo(0, 0); }, [pathname]);

  const staff = session.staff;
  const canOrders = !!staff?.permissions.includes('orders');

  // عدّاد الطلبات الجديدة وتنبيه فوري عند وصول طلب
  useEffect(() => {
    if (!canOrders) return undefined;
    let alive = true;
    const tick = () => api('/admin/pulse').then((p) => {
      if (!alive) return;
      if (seen.current !== null && p.lastOrderId > seen.current && p.latest) {
        toast(`طلب جديد ${p.latest.number} من ${p.latest.customerName} بقيمة ${fmt(p.latest.total)}`, 'new', 9000);
        beep();
      }
      seen.current = p.lastOrderId;
      setPulse(p);
    }).catch(() => {});
    tick();
    const id = setInterval(tick, 6000);
    return () => { alive = false; clearInterval(id); seen.current = null; };
  }, [canOrders, toast]);

  const ctx = useMemo(() => ({
    staff, store: session.store, pulse,
    can: (p) => !!staff?.permissions.includes(p),
    refreshStore: load,
    refreshPulse: () => api('/admin/pulse').then((p) => { seen.current = Math.max(seen.current || 0, p.lastOrderId); setPulse(p); }).catch(() => {}),
  }), [staff, session.store, pulse, load]);

  if (session.loading) return <Spinner />;
  if (session.error && !session.store) return <div className="wrap pad"><ErrorBox error={session.error} onRetry={load} /></div>;
  if (!staff) return <Login store={session.store} onDone={(s) => setSession((x) => ({ ...x, staff: s }))} />;

  const items = NAV.filter((n) => staff.permissions.includes(n.perm));
  const home = items[0]?.to;
  const logout = async () => { await api('/admin/logout', { method: 'POST' }).catch(() => {}); setSession((s) => ({ ...s, staff: null })); };

  return (
    <AdminCtx.Provider value={ctx}>
      <div className={`admin ${menu ? 'menu-open' : ''}`}>
        <header className="a-top">
          <button className="icon-btn" onClick={() => setMenu(!menu)} aria-label="القائمة" aria-expanded={menu}><Icon name="menu" /></button>
          <strong>لوحة {session.store.name}</strong>
          {canOrders && pulse.newOrders > 0 ? <Link to="/admin/orders?status=new" className="a-top-new">{pulse.newOrders} جديد</Link> : <span />}
        </header>
        <div className="a-scrim" onClick={() => setMenu(false)} />
        <aside className="a-side">
          <div className="a-side-brand">
            {session.store.logo ? <img src={media(session.store.logo)} alt="" /> : <span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span>}
            <div><strong>{session.store.name}</strong><span>لوحة الإدارة</span></div>
          </div>
          <nav aria-label="أقسام اللوحة">
            {items.map((n) => (
              <NavLink key={n.to} to={`/admin/${n.to}`} className={({ isActive }) => `a-nav ${isActive ? 'is-active' : ''}`}>
                <Icon name={n.icon} />
                <span>{n.label}</span>
                {n.to === 'orders' && pulse.newOrders > 0 && <b className="a-nav-count" title="طلبات جديدة">{pulse.newOrders}</b>}
              </NavLink>
            ))}
          </nav>
          <div className="a-side-foot">
            <div className="a-user"><strong>{staff.name}</strong><span>{staff.isOwner ? 'مدير المتجر' : 'موظف'}</span></div>
            <a className="a-nav" href={import.meta.env.BASE_URL} target="_blank" rel="noopener noreferrer"><Icon name="home" /><span>فتح المتجر</span></a>
            <button className="a-nav" onClick={() => setPwd(true)}><Icon name="shield" /><span>تغيير كلمة المرور</span></button>
            <button className="a-nav" onClick={logout}><Icon name="logout" /><span>تسجيل الخروج</span></button>
          </div>
        </aside>
        <main className="a-main">
          {STATIC && <p className="a-demo-bar" role="note"><Icon name="eye" size={18} /> نسخة عرض للمعاينة ببيانات تجريبية. التعديلات لا تُحفظ هنا، وتعمل في المتجر الفعلي.</p>}
          <Routes>
            <Route index element={home ? <Navigate to={`/admin/${home}`} replace /> : <div className="a-page"><Empty title="لا توجد صلاحيات على حسابك">اطلب من مدير المتجر تحديد صلاحياتك.</Empty></div>} />
            <Route path="login" element={<Navigate to="/admin" replace />} />
            <Route path="dashboard" element={<Guard perm="dashboard"><Dashboard /></Guard>} />
            <Route path="categories" element={<Guard perm="categories"><Categories /></Guard>} />
            <Route path="products" element={<Guard perm="products"><Products /></Guard>} />
            <Route path="products/:id" element={<Guard perm="products"><ProductEdit /></Guard>} />
            <Route path="designs" element={<Guard perm="designs"><Designs /></Guard>} />
            <Route path="orders" element={<Guard perm="orders"><Orders /></Guard>} />
            <Route path="orders/:id" element={<Guard perm="orders"><OrderDetail /></Guard>} />
            <Route path="customers" element={<Guard perm="customers"><Customers /></Guard>} />
            <Route path="customers/:id" element={<Guard perm="customers"><CustomerDetail /></Guard>} />
            <Route path="expenses" element={<Guard perm="expenses"><Expenses /></Guard>} />
            <Route path="music" element={<Guard perm="music"><MusicPage /></Guard>} />
            <Route path="staff" element={<Guard perm="staff"><StaffPage /></Guard>} />
            <Route path="settings" element={<Guard perm="settings"><SettingsPage /></Guard>} />
            <Route path="*" element={<div className="a-page"><Empty title="الصفحة غير موجودة"><Link className="link" to="/admin">العودة إلى اللوحة</Link></Empty></div>} />
          </Routes>
        </main>
        {pwd && <PasswordModal onClose={() => setPwd(false)} />}
      </div>
    </AdminCtx.Provider>
  );
}
