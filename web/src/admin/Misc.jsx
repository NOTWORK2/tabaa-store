import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, useLoad, fmt, media, fmtDay, fmtDate, todayLocal } from '../lib.js';
import { Icon, Spinner, ErrorBox, Empty, Badge, Modal, Field, MoneyInput, Toggle, useToast } from '../ui.jsx';
import { Page, Confirm, ImageUpload, DateRange, PERM_LABELS, useAdmin, useAction } from './parts.jsx';
import { socialPlatforms } from '../../../shared/social.js';

/* ───────────── المصاريف ───────────── */

const EXPENSE_CATS = ['شحن وتوصيل', 'تسويق وإعلانات', 'تغليف', 'إيجار ومرافق', 'رواتب', 'معدات وصيانة', 'رسوم ومنصات', 'أخرى'];

function ExpenseForm({ initial, onClose, onSaved }) {
  const [f, setF] = useState(initial
    ? { amount: initial.amount, date: initial.date, category: initial.category, description: initial.description, orderNumber: initial.orderNumber || '' }
    : { amount: NaN, date: todayLocal(), category: EXPENSE_CATS[0], description: '', orderNumber: '' });
  const [run, busy] = useAction();
  const save = async (e) => {
    e.preventDefault();
    const r = await run(() => (initial ? api(`/admin/expenses/${initial.id}`, { method: 'PUT', body: f }) : api('/admin/expenses', { method: 'POST', body: f })),
      'تم حفظ المصروف وتحدّثت الأرباح');
    if (r) { onSaved(); onClose(); }
  };
  return (
    <Modal title={initial ? 'تعديل مصروف' : 'تسجيل مصروف'} onClose={onClose}>
      <form className="a-form" onSubmit={save}>
        <div className="form-grid">
          <Field label="المبلغ"><MoneyInput value={f.amount} onChange={(amount) => setF((s) => ({ ...s, amount }))} autoFocus /></Field>
          <Field label="التاريخ"><input type="date" value={f.date} max={todayLocal()} onChange={(e) => setF({ ...f, date: e.target.value })} required /></Field>
        </div>
        <Field label="الفئة">
          <select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
            {[...new Set([...EXPENSE_CATS, f.category])].map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="الوصف"><input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} maxLength={300} placeholder="مثال: شحنة أرامكس لطلبات الأسبوع" /></Field>
        <Field label="رقم الطلب المرتبط (اختياري)" hint="اربط المصروف بطلب محدد عند الحاجة، مثل تكلفة شحنه">
          <input value={f.orderNumber} onChange={(e) => setF({ ...f, orderNumber: e.target.value })} dir="ltr" placeholder="TB-000000-0000" />
        </Field>
        <p className="muted">تكلفة القطع والطباعة تُحسب تلقائيًا من الطلبات، فلا تسجّلها هنا.</p>
        <button className="btn btn-ink" disabled={busy || Number.isNaN(f.amount)}>حفظ</button>
      </form>
    </Modal>
  );
}

export function Expenses() {
  const { can } = useAdmin();
  const today = todayLocal();
  const [range, setRange] = useState({ from: `${today.slice(0, 8)}01`, to: today });
  const [cat, setCat] = useState('');
  const [edit, setEdit] = useState(null);
  const [del, setDel] = useState(null);
  const { data, error, loading, reload } = useLoad(`/admin/expenses?from=${range.from || ''}&to=${range.to || ''}&category=${encodeURIComponent(cat)}`);
  return (
    <Page title="المصاريف" sub={data ? `مجموع الفترة: ${fmt(data.total)}` : null}
      actions={<button className="btn btn-ink" onClick={() => setEdit({})}><Icon name="plus" /> تسجيل مصروف</button>}>
      <div className="a-filters">
        <DateRange from={range.from} to={range.to} onChange={setRange} />
        <select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="الفئة">
          <option value="">كل الفئات</option>
          {EXPENSE_CATS.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>
      {error && <ErrorBox error={error} onRetry={reload} />}
      {loading && !data && <Spinner />}
      {data && (data.expenses.length === 0 ? <Empty title="لا توجد مصاريف في هذه الفترة">سجّل مصروفًا ليُطرح من أرباح الداشبورد.</Empty> : (
        <div className="a-table-wrap">
          <table className="a-table a-table-cards">
            <thead><tr><th>التاريخ</th><th>الفئة</th><th>الوصف</th><th>الطلب</th><th>المبلغ</th><th>سجّله</th><th /></tr></thead>
            <tbody>
              {data.expenses.map((e) => (
                <tr key={e.id}>
                  <td data-label="التاريخ">{fmtDay(e.date)}</td>
                  <td data-label="الفئة"><Badge>{e.category}</Badge></td>
                  <td data-label="الوصف">{e.description || '—'}</td>
                  <td data-label="الطلب">{e.orderNumber ? (can('orders') ? <Link className="link" to={`/admin/orders/${e.orderId}`} dir="ltr">{e.orderNumber}</Link> : <bdi dir="ltr">{e.orderNumber}</bdi>) : '—'}</td>
                  <td data-label="المبلغ"><b>{fmt(e.amount)}</b></td>
                  <td data-label="سجّله">{e.createdBy}</td>
                  <td className="a-cell-actions">
                    <button className="icon-btn" onClick={() => setEdit(e)} aria-label="تعديل"><Icon name="edit" size={18} /></button>
                    <button className="icon-btn" onClick={() => setDel(e)} aria-label="حذف"><Icon name="trash" size={18} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      {edit && <ExpenseForm initial={edit.id ? edit : null} onClose={() => setEdit(null)} onSaved={reload} />}
      {del && (
        <Confirm title="حذف المصروف" danger confirmLabel="حذف" onClose={() => setDel(null)}
          onConfirm={async () => { await api(`/admin/expenses/${del.id}`, { method: 'DELETE' }); reload(); }}>
          حذف مصروف «{del.category}» بقيمة {fmt(del.amount)}؟ سيُعاد احتساب الأرباح.
        </Confirm>
      )}
    </Page>
  );
}

/* ───────────── الموسيقى ───────────── */

export function MusicPage() {
  const { data, error, loading, reload, setData } = useLoad('/admin/music');
  const [url, setUrl] = useState('');
  const [volume, setVolume] = useState(40);
  const [del, setDel] = useState(false);
  const [run, busy] = useAction();
  const audio = useRef(null);
  const fileInput = useRef(null);
  const m = data?.music;
  useEffect(() => { if (m) setVolume(m.volume); }, [m]);
  useEffect(() => { if (audio.current) audio.current.volume = volume / 100; }, [volume, m]);

  if (loading && !data) return <Page title="الموسيقى"><Spinner /></Page>;
  if (error) return <Page title="الموسيقى"><ErrorBox error={error} onRetry={reload} /></Page>;

  const put = (body, ok) => run(async () => setData(await api('/admin/music', { method: 'PUT', body })), ok);
  const upload = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    run(async () => setData(await api('/admin/music/file', { method: 'POST', form })), 'تم رفع الملف الصوتي');
  };

  return (
    <Page title="الموسيقى" sub="موسيقى خلفية اختيارية لواجهة المتجر">
      <section className="a-card">
        <div className="a-card-row">
          <div>
            <h2>تشغيل الموسيقى في المتجر</h2>
            <p className="muted">عند التفعيل تبدأ الموسيقى مع دخول الزبون إن سمح متصفحه، وإلا يظهر له زر «تشغيل الموسيقى». يستطيع الزبون إيقافها أو كتمها دائمًا.</p>
          </div>
          <Toggle checked={m.enabled} disabled={busy || !m.source} onChange={(enabled) => put({ enabled }, enabled ? 'الموسيقى مفعّلة في المتجر' : 'الموسيقى معطّلة')} label={m.enabled ? 'مفعّلة' : 'معطّلة'} />
        </div>
        {!m.source && <p className="notice notice-info"><Icon name="music" /> أضف مصدرًا أولًا: ملف صوتي أو رابط يوتيوب.</p>}
      </section>

      <section className="a-card">
        <h2>المصدر الحالي والمعاينة</h2>
        {!m.source && <p className="muted">لا يوجد مصدر.</p>}
        {m.source === 'file' && (
          <div className="music-preview">
            <p><Badge tone="info">ملف صوتي</Badge> {m.fileName}</p>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <audio ref={audio} controls src={media(m.file)} preload="metadata" />
          </div>
        )}
        {m.source === 'youtube' && (
          <div className="music-preview">
            <p><Badge tone="info">يوتيوب</Badge> <a className="link" href={m.youtubeUrl} target="_blank" rel="noopener noreferrer" dir="ltr">{m.youtubeUrl}</a></p>
            <iframe title="معاينة مقطع يوتيوب" src={`https://www.youtube.com/embed/${m.youtubeId}`} allow="autoplay; encrypted-media" allowFullScreen />
          </div>
        )}
        {m.source && <button className="btn btn-danger btn-sm" onClick={() => setDel(true)}><Icon name="trash" size={16} /> حذف المصدر</button>}
      </section>

      <section className="a-card">
        <h2>{m.source ? 'استبدال المصدر' : 'إضافة مصدر'}</h2>
        <div className="source-grid">
          <div>
            <strong>رفع ملف صوتي</strong>
            <p className="muted">MP3 أو M4A أو AAC أو OGG أو WAV، حتى 30 ميغابايت.</p>
            <input ref={fileInput} type="file" accept=".mp3,.m4a,.aac,.ogg,.wav,audio/*" hidden onChange={upload} />
            <button className="btn btn-ghost" disabled={busy} onClick={() => fileInput.current.click()}><Icon name="upload" /> اختيار ملف</button>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); put({ youtubeUrl: url }, 'تم حفظ رابط يوتيوب').then(() => setUrl('')); }}>
            <strong>رابط يوتيوب</strong>
            <p className="muted">يُشغَّل عبر مشغّل يوتيوب الرسمي.</p>
            <div className="inline-add">
              <input value={url} onChange={(e) => setUrl(e.target.value)} dir="ltr" placeholder="https://www.youtube.com/watch?v=..." required aria-label="رابط يوتيوب" />
              <button className="btn btn-ghost" disabled={busy}>حفظ الرابط</button>
            </div>
          </form>
        </div>
      </section>

      <section className="a-card">
        <h2>مستوى الصوت الافتراضي</h2>
        <div className="volume-row">
          <Icon name="volume" />
          <input type="range" min="0" max="100" step="5" value={volume} onChange={(e) => setVolume(Number(e.target.value))} aria-label="مستوى الصوت الافتراضي" />
          <output>{volume}%</output>
          <button className="btn btn-ink btn-sm" disabled={busy || volume === m.volume} onClick={() => put({ volume }, 'تم حفظ مستوى الصوت')}>حفظ</button>
        </div>
      </section>

      {del && (
        <Confirm title="حذف مصدر الموسيقى" danger confirmLabel="حذف" onClose={() => setDel(false)}
          onConfirm={async () => setData(await api('/admin/music/source', { method: 'DELETE' }))}>
          حذف المصدر الحالي وتعطيل الموسيقى في المتجر؟
        </Confirm>
      )}
    </Page>
  );
}

/* ───────────── الموظفون والصلاحيات ───────────── */

function StaffForm({ initial, onClose, onSaved }) {
  const { staff: me } = useAdmin();
  const [f, setF] = useState(initial
    ? { name: initial.name, username: initial.username, password: '', permissions: initial.permissions, active: initial.active }
    : { name: '', username: '', password: '', permissions: ['orders'], active: true });
  const [run, busy] = useAction();
  const owner = initial?.isOwner;
  const toggle = (p) => setF((s) => ({ ...s, permissions: s.permissions.includes(p) ? s.permissions.filter((x) => x !== p) : [...s.permissions, p] }));
  const save = async (e) => {
    e.preventDefault();
    const body = { ...f, password: f.password || undefined };
    const r = await run(() => (initial ? api(`/admin/staff/${initial.id}`, { method: 'PUT', body }) : api('/admin/staff', { method: 'POST', body })),
      initial ? 'تم حفظ الحساب' : 'تم إنشاء حساب الموظف');
    if (r) { onSaved(); onClose(); }
  };
  return (
    <Modal title={initial ? `تعديل حساب ${initial.name}` : 'حساب موظف جديد'} onClose={onClose}>
      <form className="a-form" onSubmit={save}>
        <Field label="اسم الموظف"><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} maxLength={60} required autoFocus /></Field>
        <Field label="اسم المستخدم" hint="أحرف لاتينية وأرقام، يُستخدم لتسجيل الدخول">
          <input value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} dir="ltr" autoComplete="off" required />
        </Field>
        <Field label={initial ? 'كلمة مرور جديدة (اتركها فارغة للإبقاء على الحالية)' : 'كلمة المرور'} hint="8 أحرف على الأقل">
          <input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} dir="ltr" autoComplete="new-password" minLength={8} required={!initial} />
        </Field>
        {owner ? <p className="notice notice-info">حساب مدير المتجر يملك كل الصلاحيات دائمًا.</p> : (
          <>
            <fieldset className="opt">
              <legend>الصلاحيات</legend>
              <div className="check-grid check-grid-1">
                {Object.entries(PERM_LABELS).map(([p, label]) => (
                  <label key={p} className="check">
                    <input type="checkbox" checked={f.permissions.includes(p)} onChange={() => toggle(p)} disabled={!me.isOwner && !me.permissions.includes(p)} /> {label}
                  </label>
                ))}
              </div>
            </fieldset>
            {initial && initial.id !== me.id && <Toggle checked={f.active} onChange={(active) => setF({ ...f, active })} label={f.active ? 'الحساب مفعّل' : 'الحساب معطّل (لا يستطيع الدخول)'} />}
          </>
        )}
        <button className="btn btn-ink" disabled={busy}>حفظ</button>
      </form>
    </Modal>
  );
}

export function StaffPage() {
  const { data, error, loading, reload } = useLoad('/admin/staff');
  const [edit, setEdit] = useState(null);
  if (loading && !data) return <Page title="الموظفون والصلاحيات"><Spinner /></Page>;
  if (error) return <Page title="الموظفون والصلاحيات"><ErrorBox error={error} onRetry={reload} /></Page>;
  return (
    <Page title="الموظفون والصلاحيات" sub="كل حساب يرى الصفحات المسموحة له فقط، والصلاحيات تُطبَّق على الخادم"
      actions={<button className="btn btn-ink" onClick={() => setEdit({})}><Icon name="plus" /> حساب جديد</button>}>
      <ul className="a-list">
        {data.staff.map((s) => (
          <li key={s.id} className="a-row">
            <span className="avatar" aria-hidden="true">{s.name.trim().charAt(0)}</span>
            <div className="a-row-main">
              <strong>{s.name} <bdi dir="ltr" className="muted">@{s.username}</bdi></strong>
              <span className="perm-chips">
                {s.isOwner ? <Badge tone="brand">مدير المتجر: كل الصلاحيات</Badge>
                  : s.permissions.length ? s.permissions.map((p) => <Badge key={p}>{PERM_LABELS[p]}</Badge>) : <span className="muted">بلا صلاحيات</span>}
              </span>
            </div>
            <Badge tone={s.active ? 'ok' : 'mute'}>{s.active ? 'مفعّل' : 'معطّل'}</Badge>
            <div className="a-row-actions"><button className="btn btn-ghost btn-sm" onClick={() => setEdit(s)}><Icon name="edit" size={16} /> تعديل</button></div>
          </li>
        ))}
      </ul>
      {edit && <StaffForm initial={edit.id ? edit : null} onClose={() => setEdit(null)} onSaved={reload} />}
    </Page>
  );
}

/* ───────────── إعدادات المتجر ───────────── */

let zk = 0;
export function SettingsPage() {
  const { refreshStore } = useAdmin();
  const { data, error, loading, reload } = useLoad('/admin/settings');
  const [f, setF] = useState(null);
  const [run, busy] = useAction();
  const toast = useToast();
  useEffect(() => {
    if (data) setF({ store: data.store, lowStock: data.lowStock, payments: data.payments.map((p) => ({ ...p })), zones: data.zones.map((z) => ({ ...z, k: `z${z.id}` })) });
  }, [data]);

  if (error) return <Page title="إعدادات المتجر"><ErrorBox error={error} onRetry={reload} /></Page>;
  if (loading && !f || !f) return <Page title="إعدادات المتجر"><Spinner /></Page>;

  const setStore = (patch) => setF((s) => ({ ...s, store: { ...s.store, ...patch } }));
  const setZone = (k, patch) => setF((s) => ({ ...s, zones: s.zones.map((z) => (z.k === k ? { ...z, ...patch } : z)) }));
  const setPay = (i, patch) => setF((s) => ({ ...s, payments: s.payments.map((p, j) => (j === i ? { ...p, ...patch } : p)) }));
  const txt = (k) => ({ value: f.store[k] || '', onChange: (e) => setStore({ [k]: e.target.value }) });

  const save = async (e) => {
    e.preventDefault();
    if (f.zones.some((z) => Number.isNaN(z.fee))) { toast('أدخل رسوم التوصيل لكل منطقة', 'error'); return; }
    const r = await run(() => api('/admin/settings', { method: 'PUT', body: { ...f, lowStock: Number(f.lowStock) || 0 } }), 'تم حفظ الإعدادات');
    if (r) { reload(); refreshStore(); }
  };

  return (
    <Page title="إعدادات المتجر">
      <form className="a-form-wide" onSubmit={save}>
        <section className="a-card">
          <h2>الهوية</h2>
          <div className="identity">
            <Field label="الشعار"><ImageUpload kind="logo" value={f.store.logo} onChange={(logo) => setStore({ logo })} label="رفع الشعار" />
              {f.store.logo && <button type="button" className="link link-danger" onClick={() => setStore({ logo: null })}>إزالة الشعار</button>}</Field>
            <div className="form-grid">
              <Field label="اسم المتجر"><input {...txt('name')} maxLength={40} required /></Field>
              <Field label="الوصف المختصر"><input {...txt('tagline')} maxLength={120} /></Field>
              <Field label="اللون الأساسي" hint="الأزرار والعناصر البارزة"><span className="color-pick"><input type="color" value={f.store.primary} onChange={(e) => setStore({ primary: e.target.value })} /><code dir="ltr">{f.store.primary}</code></span></Field>
              <Field label="اللون الثانوي" hint="الروابط وحدود التركيز"><span className="color-pick"><input type="color" value={f.store.secondary} onChange={(e) => setStore({ secondary: e.target.value })} /><code dir="ltr">{f.store.secondary}</code></span></Field>
            </div>
          </div>
        </section>

        <section className="a-card">
          <h2>روابط التواصل أسفل المتجر</h2>
          <p className="muted">أدخل رابط الحساب أو اسم المستخدم. اترك الحقل فارغًا لإخفائه من أسفل المتجر.</p>
          <div className="form-grid">
            <Field label="رقم واتساب لاستقبال الطلبات" hint="بالصيغة الدولية دون + أو مسافات، مثل 971501234567. يفتح زر الزبون محادثة مع هذا الرقم.">
              <input {...txt('whatsapp')} dir="ltr" inputMode="tel" placeholder="9715XXXXXXXX" />
            </Field>
            {socialPlatforms.map((platform) => (
              <Field key={platform.key} label={platform.label}>
                <input {...txt(platform.key)} dir="ltr" maxLength={512} autoCapitalize="none" spellCheck={false}
                  placeholder={`${platform.domain}/${platform.prefix || ''}yourstore`} />
              </Field>
            ))}
          </div>
        </section>

        <section className="a-card">
          <h2>بيانات الاتصال</h2>
          <div className="form-grid">
            <Field label="هاتف المتجر"><input {...txt('phone')} dir="ltr" inputMode="tel" /></Field>
            <Field label="البريد الإلكتروني"><input {...txt('email')} dir="ltr" type="email" /></Field>
            <Field label="العنوان" className="span-2"><input {...txt('address')} maxLength={160} /></Field>
          </div>
        </section>

        <section className="a-card">
          <h2>مناطق التوصيل ورسومها</h2>
          <ul className="rows">
            {f.zones.map((z) => (
              <li key={z.k}>
                <input value={z.name} onChange={(e) => setZone(z.k, { name: e.target.value })} placeholder="اسم المنطقة" maxLength={50} required aria-label="اسم المنطقة" />
                <MoneyInput value={z.fee} onChange={(fee) => setZone(z.k, { fee })} aria-label={`رسوم ${z.name}`} />
                <Toggle checked={z.active} onChange={(active) => setZone(z.k, { active })} label="متاحة" />
                <button type="button" className="icon-btn" onClick={() => setF((s) => ({ ...s, zones: s.zones.filter((x) => x.k !== z.k) }))} aria-label={`حذف ${z.name}`}><Icon name="trash" size={18} /></button>
              </li>
            ))}
          </ul>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setF((s) => ({ ...s, zones: [...s.zones, { k: `n${++zk}`, name: '', fee: NaN, active: true }] }))}><Icon name="plus" size={16} /> منطقة جديدة</button>
        </section>

        <section className="a-card">
          <h2>طرق الدفع المتاحة</h2>
          <p className="muted">يختار الزبون إحداها عند تأكيد الطلب، ويسجّل الموظف التحصيل من صفحة الطلب.</p>
          <ul className="rows rows-pay">
            {f.payments.map((p, i) => (
              <li key={p.key || i}>
                <input value={p.label} onChange={(e) => setPay(i, { label: e.target.value })} maxLength={50} required aria-label="اسم طريقة الدفع" />
                <Toggle checked={p.enabled} onChange={(enabled) => setPay(i, { enabled })} label="متاحة" />
                <button type="button" className="icon-btn" onClick={() => setF((s) => ({ ...s, payments: s.payments.filter((_, j) => j !== i) }))} aria-label={`حذف ${p.label}`}><Icon name="trash" size={18} /></button>
              </li>
            ))}
          </ul>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setF((s) => ({ ...s, payments: [...s.payments, { key: '', label: '', enabled: true }] }))}><Icon name="plus" size={16} /> طريقة دفع</button>
        </section>

        <section className="a-card">
          <h2>المخزون</h2>
          <Field label="حد تنبيه المخزون المنخفض" hint="يظهر التنبيه في صفحة المنتجات عندما تصل أي تركيبة لون ومقاس إلى هذا العدد أو أقل" className="narrow">
            <input type="number" min="0" max="1000" dir="ltr" value={f.lowStock} onChange={(e) => setF({ ...f, lowStock: e.target.value })} />
          </Field>
        </section>

        <div className="a-savebar"><button className="btn btn-ink" disabled={busy}>{busy ? 'جارٍ الحفظ…' : 'حفظ الإعدادات'}</button></div>
      </form>
    </Page>
  );
}
