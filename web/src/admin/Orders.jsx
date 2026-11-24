import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api, useLoad, fmt, media, fmtDateTime, fmtDate, STATUS, FLOW, PAY } from '../lib.js';
import { Icon, Spinner, ErrorBox, Empty, Modal, Field, MoneyInput, useToast } from '../ui.jsx';
import { Page, StatusBadge, PayBadge, DateRange, useAdmin, useAction } from './parts.jsx';

/* ───────────── قائمة الطلبات ───────────── */

function OrdersTable({ orders, linkOrders = true }) {
  return (
    <div className="a-table-wrap">
      <table className="a-table a-table-cards">
        <thead><tr><th>رقم الطلب</th><th>الزبون</th><th>التاريخ</th><th>الإجمالي</th><th>الدفع</th><th>التنفيذ</th></tr></thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id} className={o.status === 'new' ? 'is-new' : ''}>
              <td data-label="رقم الطلب">
                {linkOrders
                  ? <Link to={`/admin/orders/${o.id}`} className="a-cell-main"><span className="a-thumb">{o.thumb && <img src={media(o.thumb)} alt="" />}</span><strong dir="ltr">{o.number}</strong></Link>
                  : <strong dir="ltr">{o.number}</strong>}
              </td>
              <td data-label="الزبون"><span className="stack"><span>{o.customerName}</span><small dir="ltr">{o.customerPhone}</small></span></td>
              <td data-label="التاريخ">{fmtDateTime(o.createdAt)}</td>
              <td data-label="الإجمالي"><span className="stack"><b>{fmt(o.total)}</b><small>{o.itemsCount} قطعة</small></span></td>
              <td data-label="الدفع"><PayBadge status={o.paymentStatus} /></td>
              <td data-label="التنفيذ"><StatusBadge status={o.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Orders() {
  const { pulse } = useAdmin();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') || '');
  const query = params.toString();
  // وصول طلب جديد (تغيّر آخر رقم في النبض) يعيد تحميل القائمة تلقائيًا
  const { data, error, loading, reload } = useLoad(`/admin/orders?${query}`, [pulse.lastOrderId]);

  const setParam = (patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    if (!('page' in patch)) next.delete('page');
    setParams(next, { replace: true });
  };
  useEffect(() => {
    const id = setTimeout(() => { if ((params.get('q') || '') !== q.trim()) setParam({ q: q.trim() }); }, 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const status = params.get('status') || '';
  const hasFilter = !!(params.get('q') || status || params.get('payment') || params.get('from') || params.get('to'));

  return (
    <Page title="الطلبات" sub={data ? `${data.total} طلب${hasFilter ? ' مطابق للتصفية' : ''} · الأحدث أولًا` : 'الأحدث أولًا'}>
      <div className="a-filters">
        <label className="search">
          <Icon name="search" size={18} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث برقم الطلب أو اسم الزبون أو هاتفه" aria-label="بحث في الطلبات" />
        </label>
        <select value={status} onChange={(e) => setParam({ status: e.target.value })} aria-label="حالة التنفيذ">
          <option value="">كل حالات التنفيذ</option>
          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}{data ? ` (${data.counts[k]})` : ''}</option>)}
        </select>
        <select value={params.get('payment') || ''} onChange={(e) => setParam({ payment: e.target.value })} aria-label="حالة الدفع">
          <option value="">كل حالات الدفع</option>
          {Object.entries(PAY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <DateRange from={params.get('from')} to={params.get('to')} onChange={({ from, to }) => setParam({ from, to })} />
        {hasFilter && <button className="link" onClick={() => { setQ(''); setParams({}, { replace: true }); }}>مسح التصفية</button>}
      </div>

      {error && <ErrorBox error={error} onRetry={reload} />}
      {loading && !data && <Spinner />}
      {data && (data.orders.length === 0
        ? <Empty title={hasFilter ? 'لا توجد طلبات مطابقة' : 'لا توجد طلبات بعد'}>{hasFilter ? 'غيّر البحث أو التصفية.' : 'تظهر هنا طلبات الزبائن فور تأكيدها.'}</Empty>
        : (
          <>
            <OrdersTable orders={data.orders} />
            {data.pages > 1 && (
              <div className="pager">
                <button className="btn btn-ghost btn-sm" disabled={data.page <= 1} onClick={() => setParam({ page: String(data.page - 1) })}>السابق</button>
                <span>صفحة {data.page} من {data.pages}</span>
                <button className="btn btn-ghost btn-sm" disabled={data.page >= data.pages} onClick={() => setParam({ page: String(data.page + 1) })}>التالي</button>
              </div>
            )}
          </>
        ))}
    </Page>
  );
}

/* ───────────── تفاصيل الطلب ───────────── */

function MoneyModal({ title, label, max, hint, confirm, withRestock, withMethod, defaultMethod, onSubmit, onClose }) {
  const [amount, setAmount] = useState(max);
  const [note, setNote] = useState('');
  const [method, setMethod] = useState(defaultMethod || '');
  const [restock, setRestock] = useState(false);
  const [run, busy] = useAction();
  const go = async (e) => {
    e.preventDefault();
    if (await run(() => onSubmit({ amount, note, method, restock }))) onClose();
  };
  return (
    <Modal title={title} onClose={onClose}>
      <form className="a-form" onSubmit={go}>
        <Field label={label} hint={hint}><MoneyInput value={amount} onChange={setAmount} autoFocus /></Field>
        {withMethod && <Field label="طريقة الدفع"><input value={method} onChange={(e) => setMethod(e.target.value)} maxLength={60} /></Field>}
        <Field label="ملاحظة (اختياري)"><input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} /></Field>
        {withRestock && <label className="check"><input type="checkbox" checked={restock} onChange={(e) => setRestock(e.target.checked)} /> أُعيدت القطع سليمة إلى المخزون (تسقط تكلفتها من الأرباح)</label>}
        <button className="btn btn-ink" disabled={busy || Number.isNaN(amount)}>{confirm}</button>
      </form>
    </Modal>
  );
}

function CancelModal({ order, onSubmit, onClose }) {
  const [note, setNote] = useState('');
  const [restock, setRestock] = useState(false);
  const [run, busy] = useAction();
  const printed = !!order.printedAt;
  const go = async (e) => {
    e.preventDefault();
    if (await run(() => onSubmit({ note, restock }))) onClose();
  };
  return (
    <Modal title={`إلغاء الطلب ${order.number}`} onClose={onClose}>
      <form className="a-form" onSubmit={go}>
        <p>{printed
          ? 'الطلب دخل الطباعة: القطع المطبوعة لا تعود إلى المخزون تلقائيًا، وتبقى تكلفتها محسوبة.'
          : 'الطلب لم يدخل الطباعة: تعود القطع إلى المخزون تلقائيًا ولا تُحسب عليه تكلفة.'}</p>
        {order.refundable > 0 && <p className="notice notice-warn">على الطلب مبلغ محصَّل ({fmt(order.refundable)}). سجّل الاسترجاع بعد الإلغاء إن أعدته للزبون.</p>}
        <Field label="سبب الإلغاء (اختياري)"><input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} autoFocus /></Field>
        {printed && <label className="check"><input type="checkbox" checked={restock} onChange={(e) => setRestock(e.target.checked)} /> القطع لم تُطبع فعليًا وأُعيدت إلى المخزون</label>}
        <button className="btn btn-danger" disabled={busy}>تأكيد الإلغاء</button>
      </form>
    </Modal>
  );
}

const pct = (n) => `${Math.round(n * 100)}%`;

export function OrderDetail() {
  const { id } = useParams();
  const { can, refreshPulse } = useAdmin();
  const toast = useToast();
  const { data, error, loading, reload, setData } = useLoad(`/admin/orders/${id}`);
  const [modal, setModal] = useState(null);
  const [run, busy] = useAction();
  const back = <Link className="a-back" to="/admin/orders"><Icon name="next" size={16} /> الطلبات</Link>;

  if (loading && !data) return <Page title="تفاصيل الطلب" back={back}><Spinner /></Page>;
  if (error) return <Page title="تفاصيل الطلب" back={back}><ErrorBox error={error} onRetry={error.status === 404 ? null : reload} /></Page>;
  const o = data.order;
  const idx = FLOW.indexOf(o.status);
  const next = o.status !== 'cancelled' && idx < FLOW.length - 1 ? FLOW[idx + 1] : null;

  const post = (path, body, ok) => async () => {
    const r = await api(`/admin/orders/${id}/${path}`, { method: 'POST', body });
    setData(r);
    refreshPulse();
    if (ok) toast(ok);
    return r;
  };
  const setStatus = (status) => run(post('status', { status }, `الحالة الآن: ${STATUS[status].label}`));
  const copyWa = async () => {
    try { await navigator.clipboard.writeText(o.whatsappText); toast('نُسخ نص الرسالة'); } catch { toast('تعذّر النسخ', 'error'); }
  };

  return (
    <Page title={`الطلب ${o.number}`} sub={`أُنشئ ${fmtDateTime(o.createdAt)}`} back={back}
      actions={<><PayBadge status={o.paymentStatus} /><StatusBadge status={o.status} /></>}>
      <div className="order-layout">
        <div className="order-main">
          <section className="a-card">
            <h2>حالة التنفيذ</h2>
            {o.status === 'cancelled'
              ? <p className="notice notice-error">الطلب ملغى منذ {fmtDateTime(o.cancelledAt)}{o.restocked ? ' · أُعيدت القطع إلى المخزون' : ''}</p>
              : (
                <>
                  <ol className="flow">
                    {FLOW.map((s, i) => (
                      <li key={s} className={i < idx ? 'is-done' : i === idx ? 'is-current' : ''}>
                        <button onClick={() => setStatus(s)} disabled={busy || i === idx} title={`تغيير الحالة إلى ${STATUS[s].label}`}>
                          <b>{i < idx ? <Icon name="check" size={14} /> : i + 1}</b>{STATUS[s].label}
                        </button>
                      </li>
                    ))}
                  </ol>
                  <div className="a-actions">
                    {next && <button className="btn btn-ink" disabled={busy} onClick={() => setStatus(next)}>نقل إلى «{STATUS[next].label}»</button>}
                    {o.status !== 'delivered' && <button className="btn btn-danger" onClick={() => setModal('cancel')}>إلغاء الطلب</button>}
                  </div>
                </>
              )}
          </section>

          <section className="a-card">
            <h2>القطع ومواصفات الطباعة</h2>
            <ul className="order-items">
              {o.items.map((it, i) => (
                <li key={it.id}>
                  <a href={media(it.previewImage)} target="_blank" rel="noopener noreferrer" className="order-preview" title="فتح المعاينة بالحجم الكامل">
                    <img src={media(it.previewImage)} alt={`معاينة ${it.productName} بتصميم ${it.designName}`} />
                  </a>
                  <div className="order-spec">
                    <strong>{i + 1}. {it.productName}</strong>
                    <dl>
                      <div><dt>النوع</dt><dd>{it.categoryName}</dd></div>
                      <div><dt>اللون</dt><dd><i className="dot" style={{ background: it.colorHex }} /> {it.colorName}</dd></div>
                      <div><dt>المقاس</dt><dd>{it.size}</dd></div>
                      <div><dt>الكمية</dt><dd>{it.qty}</dd></div>
                      <div><dt>التصميم</dt><dd>{it.designName}</dd></div>
                      <div><dt>موضع الطباعة</dt><dd>{pct(it.printArea.x)} من اليسار، {pct(it.printArea.y)} من الأعلى · عرض {pct(it.printArea.w)} × ارتفاع {pct(it.printArea.h)} من صورة القطعة</dd></div>
                      <div><dt>ملف الطباعة</dt><dd><bdi dir="ltr">{it.designWidth}×{it.designHeight}px</bdi> · {it.printFileName}</dd></div>
                      <div><dt>السعر</dt><dd>{fmt(it.unitPrice)} قطعة + {fmt(it.printPrice)} طباعة = <b>{fmt(it.lineTotal)}</b></dd></div>
                      {it.unitCost !== undefined && <div><dt>التكلفة</dt><dd>{fmt(it.unitCost)} قطعة + {fmt(it.printCost)} طباعة (للواحدة)</dd></div>}
                    </dl>
                    <a className="btn btn-ghost btn-sm" href={`/api/admin/orders/${o.id}/items/${it.id}/print-file`} download>
                      <Icon name="download" size={16} /> تنزيل ملف الطباعة الأصلي
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="a-card">
            <h2>سجل التحديثات</h2>
            <ol className="timeline">
              {o.events.map((e, i) => (
                <li key={i}><span>{e.text}</span><small>{fmtDateTime(e.at)} · {e.staffName || 'الزبون'}</small></li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="order-side">
          <section className="a-card">
            <h2>الزبون والتوصيل</h2>
            <dl className="facts">
              <div><dt>الاسم</dt><dd>{can('customers') ? <Link className="link" to={`/admin/customers/${o.customerId}`}>{o.customerName}</Link> : o.customerName}</dd></div>
              <div><dt>الهاتف</dt><dd><a className="link" href={`tel:${o.customerPhone}`} dir="ltr">{o.customerPhone}</a></dd></div>
              <div><dt>المنطقة</dt><dd>{o.zoneName}</dd></div>
              <div><dt>العنوان</dt><dd>{o.address}</dd></div>
              <div><dt>الملاحظات</dt><dd>{o.notes || <span className="muted">لا توجد</span>}</dd></div>
              <div><dt>طريقة الدفع</dt><dd>{o.paymentLabel}</dd></div>
            </dl>
            <details className="wa-text">
              <summary>نص رسالة واتساب للطلب</summary>
              <pre>{o.whatsappText}</pre>
              <button className="btn btn-ghost btn-sm" onClick={copyWa}><Icon name="copy" size={16} /> نسخ النص</button>
            </details>
          </section>

          <section className="a-card">
            <h2>الدفع</h2>
            <dl className="price-list">
              <div><dt>مجموع القطع</dt><dd>{fmt(o.subtotal)}</dd></div>
              {o.discount > 0 && <div><dt>الخصم</dt><dd>− {fmt(o.discount)}</dd></div>}
              <div><dt>رسوم التوصيل</dt><dd>{fmt(o.deliveryFee)}</dd></div>
              <div className="total"><dt>الإجمالي</dt><dd>{fmt(o.total)}</dd></div>
              <div><dt>المحصَّل</dt><dd>{fmt(o.paidAmount)}</dd></div>
              {o.refundedAmount > 0 && <div><dt>المسترجع</dt><dd>− {fmt(o.refundedAmount)}</dd></div>}
              {o.status !== 'cancelled' && <div><dt>المتبقي</dt><dd><b>{fmt(o.due)}</b></dd></div>}
            </dl>
            <div className="a-actions a-actions-col">
              {o.status !== 'cancelled' && o.due > 0 && <button className="btn btn-ink" onClick={() => setModal('pay')}><Icon name="wallet" size={18} /> تسجيل الدفع</button>}
              {o.refundable > 0 && <button className="btn btn-ghost" onClick={() => setModal('refund')}>تسجيل استرجاع</button>}
              {o.status !== 'cancelled' && o.paidAmount === 0 && <button className="btn btn-ghost" onClick={() => setModal('discount')}>{o.discount > 0 ? 'تعديل الخصم' : 'تطبيق خصم'}</button>}
            </div>
            {o.payments.length > 0 && (
              <ul className="ledger">
                {o.payments.map((p) => (
                  <li key={p.id}>
                    <span>{p.kind === 'refund' ? 'استرجاع' : 'دفعة'}{p.method ? ` · ${p.method}` : ''}{p.note ? ` · ${p.note}` : ''}</span>
                    <b className={p.kind === 'refund' ? 'neg' : ''}>{p.kind === 'refund' ? '− ' : ''}{fmt(p.amount)}</b>
                    <small>{fmtDateTime(p.at)} · {p.staffName}</small>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {o.costs && (
            <section className="a-card">
              <h2>ربحية الطلب</h2>
              <dl className="price-list">
                <div><dt>صافي المحصَّل</dt><dd>{fmt(o.paidAmount - o.refundedAmount)}</dd></div>
                <div><dt>تكلفة القطع</dt><dd>− {fmt(o.costs.garment)}</dd></div>
                <div><dt>تكلفة الطباعة</dt><dd>− {fmt(o.costs.print)}</dd></div>
                <div className="total"><dt>الربح قبل المصاريف</dt><dd>{fmt(o.profit)}</dd></div>
              </dl>
              {o.paidAmount === 0 && <p className="muted">يدخل الطلب في أرباح الداشبورد بعد تسجيل الدفع.</p>}
            </section>
          )}
        </aside>
      </div>

      {modal === 'pay' && (
        <MoneyModal title="تسجيل الدفع" label="المبلغ المحصَّل" max={o.due} hint={`المتبقي على الطلب ${fmt(o.due)}`} confirm="تسجيل الدفعة"
          withMethod defaultMethod={o.paymentLabel} onClose={() => setModal(null)}
          onSubmit={({ amount, note, method }) => post('payment', { amount, note, method }, 'سُجّلت الدفعة وتحدّثت الأرباح')()} />
      )}
      {modal === 'refund' && (
        <MoneyModal title="تسجيل استرجاع" label="المبلغ المسترجع للزبون" max={o.refundable} hint={`أقصى مبلغ ${fmt(o.refundable)}`} confirm="تسجيل الاسترجاع"
          withRestock={!o.restocked} onClose={() => setModal(null)}
          onSubmit={({ amount, note, restock }) => post('refund', { amount, note, restock }, 'سُجّل الاسترجاع')()} />
      )}
      {modal === 'discount' && (
        <MoneyModal title="خصم على الطلب" label="قيمة الخصم" max={o.discount} hint={`يُخصم من مجموع القطع (${fmt(o.subtotal)}). اكتب 0 لإزالة الخصم`} confirm="حفظ الخصم"
          onClose={() => setModal(null)} onSubmit={({ amount }) => post('discount', { amount }, 'تم تحديث الخصم')()} />
      )}
      {modal === 'cancel' && <CancelModal order={o} onClose={() => setModal(null)} onSubmit={(b) => post('cancel', b, 'أُلغي الطلب')()} />}
    </Page>
  );
}

/* ───────────── العملاء ───────────── */

export function Customers() {
  const [q, setQ] = useState('');
  const [term, setTerm] = useState('');
  useEffect(() => { const id = setTimeout(() => setTerm(q.trim()), 300); return () => clearTimeout(id); }, [q]);
  const { data, error, loading, reload } = useLoad(`/admin/customers?q=${encodeURIComponent(term)}`);
  return (
    <Page title="العملاء" sub={data ? `${data.customers.length} عميل` : null}>
      <div className="a-filters">
        <label className="search"><Icon name="search" size={18} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث بالاسم أو رقم الهاتف" aria-label="بحث في العملاء" /></label>
      </div>
      {error && <ErrorBox error={error} onRetry={reload} />}
      {loading && !data && <Spinner />}
      {data && (data.customers.length === 0 ? <Empty title={term ? 'لا يوجد عميل مطابق' : 'لا يوجد عملاء بعد'}>{term ? 'جرّب اسمًا أو رقمًا آخر.' : 'يُضاف العميل تلقائيًا مع أول طلب له.'}</Empty> : (
        <div className="a-table-wrap">
          <table className="a-table a-table-cards">
            <thead><tr><th>العميل</th><th>الهاتف</th><th>الطلبات</th><th>المدفوع</th><th>المستحق</th><th>آخر طلب</th></tr></thead>
            <tbody>
              {data.customers.map((c) => (
                <tr key={c.id}>
                  <td data-label="العميل"><Link className="link" to={`/admin/customers/${c.id}`}>{c.name}</Link></td>
                  <td data-label="الهاتف"><bdi dir="ltr">{c.phone}</bdi></td>
                  <td data-label="الطلبات">{c.ordersCount}</td>
                  <td data-label="المدفوع">{fmt(c.totalPaid)}</td>
                  <td data-label="المستحق">{c.totalDue > 0 ? fmt(c.totalDue) : '—'}</td>
                  <td data-label="آخر طلب">{fmtDate(c.lastOrderAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </Page>
  );
}

export function CustomerDetail() {
  const { id } = useParams();
  const { data, error, loading, reload } = useLoad(`/admin/customers/${id}`);
  const back = <Link className="a-back" to="/admin/customers"><Icon name="next" size={16} /> العملاء</Link>;
  if (loading && !data) return <Page title="العميل" back={back}><Spinner /></Page>;
  if (error) return <Page title="العميل" back={back}><ErrorBox error={error} onRetry={error.status === 404 ? null : reload} /></Page>;
  const c = data.customer;
  return (
    <Page title={c.name} sub={`عميل منذ ${fmtDate(c.createdAt)}`} back={back}>
      <div className="kpi-grid">
        <div className="kpi"><span>عدد الطلبات</span><strong>{c.ordersCount}</strong></div>
        <div className="kpi"><span>المبالغ المدفوعة</span><strong>{fmt(c.totalPaid)}</strong><small>بعد خصم الاسترجاعات</small></div>
        <div className="kpi"><span>مبالغ مستحقة</span><strong>{fmt(c.totalDue)}</strong></div>
      </div>
      <section className="a-card">
        <h2>بيانات التواصل</h2>
        <dl className="facts">
          <div><dt>الهاتف</dt><dd><a className="link" href={`tel:${c.phone}`} dir="ltr">{c.phone}</a></dd></div>
          <div><dt>واتساب</dt><dd><a className="link" href={`https://wa.me/${c.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">فتح محادثة</a></dd></div>
          <div><dt>آخر عنوان</dt><dd>{c.lastAddress || '—'}</dd></div>
        </dl>
      </section>
      <section className="a-card">
        <h2>سجل الطلبات</h2>
        {data.orders.length === 0 ? <p className="muted">لا توجد طلبات.</p> : <OrdersTable orders={data.orders} linkOrders={data.canOpenOrders} />}
      </section>
    </Page>
  );
}
