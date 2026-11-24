import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, useLoad, fmt, media, cartStore, useCart, useTitle, sizeLabel, fmtDateTime, toLatin, STATIC } from '../lib.js';
import { Icon, Mockup, Spinner, ErrorBox, Empty, Stepper, Field, WhatsAppIcon, useToast } from '../ui.jsx';
import { useStore } from './StoreLayout.jsx';

/** أسعار وتوفّر سطور السلة كما هي على الخادم الآن */
function useQuote(cart) {
  const sig = JSON.stringify(cart);
  const [state, setState] = useState({ quote: null, error: null, loading: true });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!cart.length) { setState({ quote: { lines: [], subtotal: 0, ok: false }, error: null, loading: false }); return undefined; }
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    api('/cart/quote', { method: 'POST', body: { items: cart } })
      .then((quote) => alive && setState({ quote, error: null, loading: false }))
      .catch((error) => alive && setState((s) => ({ ...s, error, loading: false })));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, tick]);
  return { ...state, refresh: () => setTick((t) => t + 1), sig };
}

function LineInfo({ l }) {
  return (
    <div className="line-info">
      <strong>{l.productName || 'قطعة غير متوفرة'}</strong>
      {l.productName && (
        <ul>
          <li><i className="dot" style={{ background: l.colorHex }} /> {l.colorName}</li>
          <li>{sizeLabel(l.size)}</li>
          {l.designName && <li>التصميم: {l.designName}</li>}
        </ul>
      )}
    </div>
  );
}

export function Cart() {
  const { store } = useStore();
  const cart = useCart();
  const { quote, error, loading, refresh } = useQuote(cart);
  useTitle(`السلة — ${store.name}`);

  if (!cart.length) {
    return (
      <div className="wrap section">
        <Empty title="سلتك فارغة">ابدأ بتصميم قطعتك الأولى.</Empty>
        <p className="center"><Link to="/design" className="btn btn-primary">صمّم قطعتك</Link></p>
      </div>
    );
  }
  if (!quote && loading) return <Spinner />;
  if (!quote) return <div className="wrap section"><ErrorBox error={error} onRetry={refresh} /></div>;

  const count = quote.lines.reduce((s, l) => s + l.qty, 0);
  return (
    <div className="wrap section">
      <header className="section-head"><h1 className="h2">السلة</h1><p>{count} قطعة</p></header>
      {error && <ErrorBox error={error} onRetry={refresh} />}
      <div className="cart-layout">
        <ul className="cart-lines">
          {quote.lines.map((l) => (
            <li key={l.key} className={`cart-line ${l.error ? 'has-error' : ''}`}>
              <Mockup image={l.image} design={l.designImage} area={l.printArea} className="cart-thumb" />
              <div className="cart-main">
                <LineInfo l={l} />
                {l.error && <p className="line-error"><Icon name="alert" size={16} /> {l.message}</p>}
                <div className="cart-controls">
                  {l.error === 'unavailable' ? <span /> : (
                    <Stepper value={l.qty} max={Math.max(1, Math.min(99, l.available || 1))} onChange={(q) => cartStore.setQty(l.key, q)} />
                  )}
                  <button className="link link-danger" onClick={() => cartStore.remove(l.key)}><Icon name="trash" size={16} /> حذف</button>
                </div>
              </div>
              <div className="cart-price">
                {l.itemPrice != null && <><strong>{fmt(l.lineTotal)}</strong>{l.qty > 1 && <span>{fmt(l.itemPrice)} للقطعة</span>}</>}
              </div>
            </li>
          ))}
        </ul>
        <aside className="summary">
          <h2>ملخص السلة</h2>
          <dl className="price-list">
            <div><dt>مجموع القطع</dt><dd>{fmt(quote.subtotal)}</dd></div>
            <div><dt>رسوم التوصيل</dt><dd className="muted">تُحسب حسب منطقتك في الخطوة التالية</dd></div>
          </dl>
          {quote.ok
            ? <Link to="/checkout" className="btn btn-primary btn-block">إتمام الطلب <Icon name="back" /></Link>
            : <button className="btn btn-primary btn-block" disabled>عدّل القطع غير المتاحة للمتابعة</button>}
          <Link to="/design" className="btn btn-ghost btn-block">أضف قطعة أخرى</Link>
        </aside>
      </div>
    </div>
  );
}

const FORM_KEY = 'tb:checkout';
const REQ_KEY = 'tb:req';
const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`);

/** معرّف المحاولة: ثابت ما دامت السلة نفسها، فإعادة الإرسال أو الضغط مرتين لا ينشئ طلبًا ثانيًا */
function requestIdFor(sig, storageKey = REQ_KEY) {
  try {
    const saved = JSON.parse(sessionStorage.getItem(storageKey));
    if (saved?.sig === sig) return saved.id;
    const id = newId();
    sessionStorage.setItem(storageKey, JSON.stringify({ sig, id }));
    return id;
  } catch { return newId(); }
}

export function Checkout() {
  const { store, zones, payments } = useStore();
  const cart = useCart();
  const navigate = useNavigate();
  const toast = useToast();
  const { quote, error: quoteError, loading, refresh, sig } = useQuote(cart);
  const [form, setForm] = useState(() => {
    const base = { name: '', phone: '', zoneId: '', address: '', paymentMethod: payments.length === 1 ? payments[0].key : '', notes: '' };
    try { return { ...base, ...JSON.parse(sessionStorage.getItem(FORM_KEY)) }; } catch { return base; }
  });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState(null);
  const sending = useRef(false);
  const done = useRef(false);
  useTitle(`إتمام الطلب — ${store.name}`);

  useEffect(() => { try { sessionStorage.setItem(FORM_KEY, JSON.stringify(form)); } catch { /* تخزين المتصفح معطّل */ } }, [form]);

  const zone = zones.find((z) => String(z.id) === String(form.zoneId)) || null;
  const total = useMemo(() => (quote ? quote.subtotal + (zone ? zone.fee : 0) : 0), [quote, zone]);

  if (!cart.length && !done.current) return <Navigate to="/cart" replace />;
  if (!quote && loading) return <Spinner />;
  if (!quote) return <div className="wrap section"><ErrorBox error={quoteError} onRetry={refresh} /></div>;

  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setErrors((x) => ({ ...x, [k]: null })); };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'اكتب اسمك';
    const d = toLatin(form.phone).replace(/\D/g, '');
    if (d.length < 8 || d.length > 15) e.phone = 'اكتب رقم هاتف صحيحًا، مثال: 0501234567';
    if (!zone) e.zoneId = 'اختر منطقة التوصيل';
    if (form.address.trim().length < 5) e.address = 'اكتب عنوان التوصيل بالتفصيل';
    if (!form.paymentMethod) e.paymentMethod = 'اختر طريقة الدفع';
    setErrors(e);
    return !Object.keys(e).length;
  };

  const submit = async (ev) => {
    ev.preventDefault();
    if (sending.current) return; // حماية من الضغط المزدوج
    if (!validate()) { toast('أكمل الحقول المطلوبة', 'error'); return; }
    sending.current = true;
    setBusy(true); setFailure(null);
    try {
      const { order } = await api('/orders', {
        method: 'POST',
        body: { requestId: requestIdFor(sig), items: cart, ...form, zoneId: Number(form.zoneId), expectedTotal: total },
      });
      done.current = true;
      try {
        sessionStorage.removeItem(REQ_KEY); sessionStorage.removeItem(FORM_KEY);
        localStorage.setItem('tb:lastOrder', JSON.stringify({ number: order.number, token: order.token }));
      } catch { /* تخزين المتصفح معطّل */ }
      navigate(`/order/${order.number}?t=${order.token}`, { replace: true });
      cartStore.clear();
    } catch (e) {
      setFailure(e);
      if (e.status === 409) refresh();
      sending.current = false;
      setBusy(false);
    }
  };

  return (
    <form className="wrap section" onSubmit={submit} noValidate>
      <header className="section-head"><h1 className="h2">إتمام الطلب</h1><p>بيانات التواصل وعنوان التوصيل</p></header>
      <div className="cart-layout">
        <div className="checkout-form">
          <div className="form-grid">
            <Field label="الاسم الكامل" error={errors.name}>
              <input value={form.name} onChange={set('name')} autoComplete="name" maxLength={80} />
            </Field>
            <Field label="رقم الهاتف" error={errors.phone} hint="نتواصل معك عليه لتأكيد التوصيل">
              <input value={form.phone} onChange={set('phone')} type="tel" inputMode="tel" dir="ltr" autoComplete="tel" placeholder="05X XXX XXXX" maxLength={20} />
            </Field>
            <Field label="منطقة التوصيل" error={errors.zoneId}>
              <select value={form.zoneId} onChange={set('zoneId')}>
                <option value="">اختر المنطقة</option>
                {zones.map((z) => <option key={z.id} value={z.id}>{z.name} — توصيل {fmt(z.fee)}</option>)}
              </select>
            </Field>
            <Field label="العنوان بالتفصيل" error={errors.address} className="span-2">
              <textarea value={form.address} onChange={set('address')} rows={3} autoComplete="street-address" maxLength={300} placeholder="الحي، الشارع، رقم المبنى أو الفيلا، أقرب معلم" />
            </Field>
          </div>

          <fieldset className="opt">
            <legend>طريقة الدفع</legend>
            <div className="radio-list">
              {payments.map((p) => (
                <label key={p.key} className={`radio-card ${form.paymentMethod === p.key ? 'is-on' : ''}`}>
                  <input type="radio" name="pay" value={p.key} checked={form.paymentMethod === p.key} onChange={set('paymentMethod')} />
                  <span>{p.label}</span>
                </label>
              ))}
            </div>
            {errors.paymentMethod && <span className="field-error">{errors.paymentMethod}</span>}
          </fieldset>

          <Field label="ملاحظات (اختياري)">
            <textarea value={form.notes} onChange={set('notes')} rows={2} maxLength={500} placeholder="مثال: التسليم بعد الساعة 5 مساءً" />
          </Field>
        </div>

        <aside className="summary">
          <h2>ملخص الطلب</h2>
          <ul className="mini-lines">
            {quote.lines.map((l) => (
              <li key={l.key}>
                <Mockup image={l.image} design={l.designImage} area={l.printArea} className="mini-thumb" />
                <div><strong>{l.productName}</strong><span>{l.colorName} · {l.size} · {l.designName} · ×{l.qty}</span>
                  {l.error && <span className="line-error">{l.message}</span>}</div>
                <b>{l.lineTotal != null ? fmt(l.lineTotal) : ''}</b>
              </li>
            ))}
          </ul>
          <dl className="price-list">
            <div><dt>مجموع القطع</dt><dd>{fmt(quote.subtotal)}</dd></div>
            <div><dt>رسوم التوصيل{zone ? ` (${zone.name})` : ''}</dt><dd>{zone ? fmt(zone.fee) : <span className="muted">اختر المنطقة</span>}</dd></div>
            <div className="total"><dt>المبلغ النهائي</dt><dd>{fmt(total)}</dd></div>
          </dl>
          {failure && <div className="notice notice-error" role="alert"><Icon name="alert" /><div><strong>{failure.message}</strong>
            {failure.status === 409 && <div><Link className="link" to="/cart">مراجعة السلة</Link></div>}</div></div>}
          <nav className="checkout-policies" aria-label="معلومات الشراء">
            <Link to="/help/terms">شروط الشراء</Link>
            <Link to="/help/returns">الإرجاع والاستبدال</Link>
            <Link to="/help/privacy">الخصوصية</Link>
          </nav>
          <div className="confirm-bar">
            <div className="buybar-price"><span>المبلغ النهائي</span><strong>{fmt(total)}</strong></div>
            <button type="submit" className="btn btn-primary" disabled={busy || !quote.ok}>
              {busy ? <><span className="spinner spinner-sm" /> جارٍ حفظ الطلب…</> : 'تأكيد الطلب'}
            </button>
          </div>
          <Link to="/cart" className="link center-link">العودة إلى السلة</Link>
        </aside>
      </div>
    </form>
  );
}

function ReturnPanel({ order, onUpdate }) {
  const [selected, setSelected] = useState('');
  const [kind, setKind] = useState('exchange');
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState('');
  const requests = order.returnRequests || [];
  const available = order.items.map((entry) => {
    const requested = requests.filter((r) => r.itemId === entry.id).reduce((sum, r) => sum + r.quantity, 0);
    return { ...entry, remaining: entry.qty - requested };
  }).filter((entry) => entry.remaining > 0);
  const item = available.find((entry) => String(entry.id) === selected) || available[0];
  const canSubmit = item && order.status !== 'cancelled';

  const submit = async (event) => {
    event.preventDefault();
    if (busy || !canSubmit) return;
    setFailure(''); setBusy(true);
    const request = { kind, itemId: item.id, quantity: Math.min(Number(quantity), item.remaining), note: note.trim() };
    const storageKey = `tb:return:${order.number}`;
    try {
      const result = await api(`/orders/${encodeURIComponent(order.number)}/returns`, {
        method: 'POST',
        body: { ...request, token: order.token, requestId: requestIdFor(JSON.stringify(request), storageKey) },
      });
      onUpdate(result.order);
      try { sessionStorage.removeItem(storageKey); } catch { /* تخزين المتصفح معطّل */ }
      setNote(''); setQuantity(1); setSelected('');
    } catch (error) {
      if (error.data?.order) onUpdate(error.data.order);
      setFailure(error.message);
    } finally {
      setBusy(false);
    }
  };
  if (!canSubmit && !requests.length) return null;
  return <section className="return-panel" aria-labelledby="after-order-title">
    <h2 id="after-order-title">خدمة ما بعد الشراء</h2>
    <p>يمكنك تقديم طلب <Link to="/help/returns">إرجاع أو استبدال</Link> لكل قطعة تحتاج إلى مراجعتها.</p>
    <div role="status" aria-live="polite">
      {requests.length > 0 && <ul className="return-receipts">{requests.map((request, index) => {
        const piece = order.items.find((entry) => entry.id === request.itemId);
        return <li key={`${request.itemId}-${index}`}>
          <strong>استلمنا طلب {request.kind === 'return' ? 'إرجاع' : 'استبدال'} {piece?.productName}</strong>
          <span>{piece?.colorName} · {piece?.size} · {piece?.designName} · الكمية {request.quantity}</span>
          <p>{request.detail}</p>
          <small>{fmtDateTime(request.at)} · يتواصل معك فريق المتجر على رقم الهاتف المسجّل في طلبك.</small>
        </li>;
      })}</ul>}
    </div>
    {canSubmit && <details className="return-start" key={requests.length}>
      <summary className="guide-action">تقديم طلب إرجاع أو استبدال <Icon name="plus" size={16} /></summary>
      <form onSubmit={submit} className="return-form">
        <Field label="القطعة">
          <select value={item.id} onChange={(event) => { setSelected(event.target.value); setQuantity(1); }}>
            {available.map((entry) => <option key={entry.id} value={entry.id}>{entry.productName} · {entry.colorName} · {entry.size} · {entry.designName}</option>)}
          </select>
        </Field>
        <Field label="نوع الطلب">
          <select value={kind} onChange={(event) => setKind(event.target.value)}><option value="exchange">استبدال القطعة</option><option value="return">إرجاع القطعة</option></select>
        </Field>
        {item.remaining > 1 && <Field label="عدد القطع"><input type="number" min="1" max={item.remaining} step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} required /></Field>}
        <Field label="تفاصيل الطلب">
          <textarea rows={3} required maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} placeholder="ما الذي تود إرجاعه أو تغييره؟" />
        </Field>
        <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'جارٍ الإرسال…' : 'إرسال الطلب'}</button>
      </form>
    </details>}
    {failure && <p className="field-error" role="alert">{failure}</p>}
  </section>;
}

export function OrderDone() {
  const { number } = useParams();
  const [params] = useSearchParams();
  const { store } = useStore();
  const toast = useToast();
  const { data, error, loading, reload, setData } = useLoad(`/orders/${encodeURIComponent(number)}?t=${encodeURIComponent(params.get('t') || '')}`);
  useTitle(`تأكيد الطلب ${number} — ${store.name}`);

  if (loading && !data) return <Spinner />;
  if (error) return <div className="wrap section"><ErrorBox error={error} onRetry={error.status === 404 ? null : reload} /><p><Link className="link" to="/">العودة إلى المتجر</Link></p></div>;
  const o = data.order;

  const copy = async () => {
    try { await navigator.clipboard.writeText(o.number); toast('نُسخ رقم الطلب'); } catch { toast('تعذّر النسخ. انسخ الرقم يدويًا', 'error'); }
  };

  return (
    <div className="wrap section done">
      <div className="done-head">
        <span className="done-check"><Icon name="check" size={34} /></span>
        <h1>{STATIC ? 'طلبك جاهز للإرسال' : o.status === 'new' ? 'تم تسجيل طلبك بنجاح' : 'تفاصيل طلبك'}</h1>
        <p>{STATIC
          ? 'أرسله الآن إلى المتجر عبر واتساب ليصل ويتم تأكيده. لا يُسجَّل الطلب لدى المتجر قبل إرسال الرسالة.'
          : 'احتفظ برابط هذه الصفحة لمتابعة طلبك.'}</p>
        <button className="order-number" onClick={copy} title="نسخ رقم الطلب">
          <span>رقم الطلب</span><strong dir="ltr">{o.number}</strong><Icon name="copy" size={18} />
        </button>
      </div>

      <section className="wa-box" aria-labelledby="order-whatsapp-title">
        <h2 id="order-whatsapp-title"><WhatsAppIcon size={25} /> {o.whatsappUrl ? 'تواصل مع المتجر عبر واتساب' : 'مشاركة الطلب عبر واتساب'}</h2>
        <p>{o.whatsappUrl
          ? 'يفتح الزر محادثة المتجر برسالة فيها رقم طلبك وتفاصيله. راجعها واضغط «إرسال» في واتساب.'
          : 'اختر المحادثة في واتساب، ثم أرسل الرسالة الجاهزة برقم طلبك وتفاصيله.'}</p>
        <details className="wa-message">
          <summary>معاينة نص الرسالة</summary>
          <p>{o.whatsappText}</p>
        </details>
        <a className="btn btn-wa" href={o.whatsappUrl || `https://wa.me/?text=${encodeURIComponent(o.whatsappText)}`}
          target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">
          {o.whatsappUrl ? 'إرسال الطلب إلى المتجر' : 'مشاركة الطلب عبر واتساب'}
        </a>
      </section>

      <section className="summary done-summary">
        <h2>ملخص الطلب</h2>
        <p className="muted">{fmtDateTime(o.createdAt)} · الحالة: {o.statusLabel}</p>
        <ul className="mini-lines">
          {o.items.map((it) => (
            <li key={it.id}>
              {it.mock
                ? <Mockup image={it.mock.image} design={it.mock.design} area={it.mock.area} className="mini-thumb" />
                : <img className="mini-thumb" src={media(it.previewImage)} alt="" />}
              <div><strong>{it.productName}</strong><span>{it.colorName} · {sizeLabel(it.size)} · التصميم: {it.designName} · ×{it.qty}</span></div>
              <b>{fmt(it.lineTotal)}</b>
            </li>
          ))}
        </ul>
        <dl className="price-list">
          <div><dt>مجموع القطع</dt><dd>{fmt(o.subtotal)}</dd></div>
          {o.discount > 0 && <div><dt>الخصم</dt><dd>− {fmt(o.discount)}</dd></div>}
          <div><dt>رسوم التوصيل ({o.zoneName})</dt><dd>{fmt(o.deliveryFee)}</dd></div>
          <div className="total"><dt>الإجمالي</dt><dd>{fmt(o.total)}</dd></div>
        </dl>
        <dl className="facts">
          <div><dt>الاسم</dt><dd>{o.customerName}</dd></div>
          <div><dt>الهاتف</dt><dd dir="ltr">{o.customerPhone}</dd></div>
          <div><dt>عنوان التوصيل</dt><dd>{o.zoneName}، {o.address}</dd></div>
          <div><dt>طريقة الدفع</dt><dd>{o.paymentLabel}</dd></div>
          {o.notes && <div><dt>ملاحظات</dt><dd>{o.notes}</dd></div>}
        </dl>
      </section>
      {!STATIC && <ReturnPanel key={o.number} order={o} onUpdate={(order) => setData({ order })} />}
      <p className="center"><Link to="/design" className="btn btn-ghost">صمّم قطعة أخرى</Link></p>
    </div>
  );
}

export function NotFound() {
  return (
    <div className="wrap section">
      <Empty title="الصفحة غير موجودة">ربما تغيّر الرابط.</Empty>
      <p className="center"><Link to="/" className="btn btn-primary">العودة إلى المتجر</Link></p>
    </div>
  );
}
