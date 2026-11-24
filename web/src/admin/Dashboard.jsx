import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLoad, fmt, media, todayLocal, addDays, fmtDay, fmtDate, STATUS } from '../lib.js';
import { Spinner, ErrorBox, Empty, Icon } from '../ui.jsx';
import { Page, DateRange, useAdmin } from './parts.jsx';

/* لونا السلسلتين مُتحقَّق منهما بأداة فحص الألوان (تمييز لعمى الألوان وتباين على الأبيض) */
const SERIES = [
  { key: 'sales', label: 'المبيعات', color: '#1f4f9c' },
  { key: 'profit', label: 'صافي الربح', color: '#c2410c' },
];

const aed = (fils) => Math.round(fils / 100).toLocaleString('en-US');

function niceTicks(min, max, count = 4) {
  if (min === max) { max = min + 100; }
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw);
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v));
  return ticks;
}

/** رسم خطّي للمبيعات وصافي الربح على محور واحد (بالدرهم)، مع مؤشر تتبّع وجدول بديل */
function TrendChart({ rows, monthly }) {
  const host = useRef(null);
  const [w, setW] = useState(640);
  const [hover, setHover] = useState(null);
  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(host.current);
    return () => ro.disconnect();
  }, []);

  const H = 280;
  const m = { t: 16, r: 16, b: 30, l: 52 };
  const iw = w - m.l - m.r;
  const ih = H - m.t - m.b;
  const vals = rows.flatMap((r) => SERIES.map((s) => r[s.key] / 100));
  const ticks = niceTicks(Math.min(0, ...vals), Math.max(0, ...vals, 100));
  const y0 = ticks[0];
  const y1 = ticks[ticks.length - 1];
  const X = (i) => m.l + (rows.length === 1 ? iw / 2 : (i / (rows.length - 1)) * iw);
  const Y = (v) => m.t + ih - ((v - y0) / (y1 - y0)) * ih;
  const label = (k) => (monthly ? k : `${Number(k.slice(8))}/${Number(k.slice(5, 7))}`);
  const every = Math.max(1, Math.ceil(rows.length / Math.max(2, Math.floor(iw / 64))));

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const i = rows.length === 1 ? 0 : Math.round(((px - m.l) / iw) * (rows.length - 1));
    setHover(Math.min(rows.length - 1, Math.max(0, i)));
  };
  const h = hover === null ? null : rows[hover];

  return (
    <div className="chart" ref={host}>
      <div className="chart-legend">
        {SERIES.map((s) => <span key={s.key}><i style={{ background: s.color }} />{s.label}</span>)}
        <em>بالدرهم الإماراتي</em>
      </div>
      <div className="chart-plot" dir="ltr">
        <svg width={w} height={H} role="img" aria-label="رسم المبيعات وصافي الربح خلال الفترة"
          onPointerMove={onMove} onPointerLeave={() => setHover(null)} onPointerDown={onMove}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={m.l} x2={w - m.r} y1={Y(t)} y2={Y(t)} stroke={t === 0 ? '#8d8477' : '#e8e2d6'} strokeWidth="1" />
              <text x={m.l - 8} y={Y(t) + 4} textAnchor="end" className="chart-tick">{t.toLocaleString('en-US')}</text>
            </g>
          ))}
          {rows.map((r, i) => (i % every === 0 || i === rows.length - 1) && (rows.length - 1 - i >= every / 2 || i === rows.length - 1) && (
            <text key={r.key} x={X(i)} y={H - 8} textAnchor="middle" className="chart-tick">{label(r.key)}</text>
          ))}
          {SERIES.map((s) => (
            <g key={s.key}>
              <polyline fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"
                points={rows.map((r, i) => `${X(i)},${Y(r[s.key] / 100)}`).join(' ')} />
              {rows.length <= 14 && rows.map((r, i) => <circle key={r.key} cx={X(i)} cy={Y(r[s.key] / 100)} r="4" fill={s.color} stroke="#fff" strokeWidth="2" />)}
            </g>
          ))}
          {h && (
            <g pointerEvents="none">
              <line x1={X(hover)} x2={X(hover)} y1={m.t} y2={m.t + ih} stroke="#1b1815" strokeWidth="1" strokeDasharray="3 3" />
              {SERIES.map((s) => <circle key={s.key} cx={X(hover)} cy={Y(h[s.key] / 100)} r="5" fill={s.color} stroke="#fff" strokeWidth="2" />)}
            </g>
          )}
        </svg>
        {h && (
          <div className="chart-tip" dir="rtl" style={{ left: Math.min(w - 170, Math.max(4, X(hover) + (X(hover) > w / 2 ? -172 : 12))), top: m.t }}>
            <strong>{monthly ? h.key : fmtDay(h.key)}</strong>
            {SERIES.map((s) => <span key={s.key}><i style={{ background: s.color }} />{s.label}<b>{fmt(h[s.key])}</b></span>)}
            <span><i style={{ background: '#8d8477' }} />صافي المحصّل<b>{fmt(h.netRevenue)}</b></span>
          </div>
        )}
      </div>
      <details className="chart-table">
        <summary>عرض الأرقام كجدول</summary>
        <div className="a-table-wrap">
          <table className="a-table">
            <thead><tr><th>{monthly ? 'الشهر' : 'اليوم'}</th><th>المبيعات</th><th>صافي المحصّل</th><th>صافي الربح</th></tr></thead>
            <tbody>{rows.map((r) => <tr key={r.key}><td>{monthly ? r.key : fmtDay(r.key)}</td><td>{fmt(r.sales)}</td><td>{fmt(r.netRevenue)}</td><td>{fmt(r.profit)}</td></tr>)}</tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

function TopList({ title, rows, unit }) {
  return (
    <section className="a-card">
      <h2>{title}</h2>
      {rows.length === 0 ? <p className="muted">لا توجد طلبات في هذه الفترة.</p> : (
        <ol className="top-list">
          {rows.map((r, i) => (
            <li key={r.name}>
              <b>{i + 1}</b>
              {r.image && <img src={media(r.image)} alt="" />}
              <span>{r.name}</span>
              <em>{r.qty} {unit}</em>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

const PRESETS = [
  { key: 'day', label: 'اليوم' },
  { key: 'week', label: 'الأسبوع' },
  { key: 'month', label: 'الشهر' },
  { key: 'custom', label: 'فترة مخصصة' },
];

export default function Dashboard() {
  const { can } = useAdmin();
  const today = todayLocal();
  const [preset, setPreset] = useState('month');
  const [custom, setCustom] = useState({ from: addDays(today, -29), to: today });
  const range = useMemo(() => {
    if (preset === 'day') return { from: today, to: today };
    if (preset === 'week') return { from: addDays(today, -6), to: today };
    if (preset === 'month') return { from: `${today.slice(0, 8)}01`, to: today };
    return custom.from && custom.to ? custom : null;
  }, [preset, custom, today]);
  const { data, error, loading, reload } = useLoad(range ? `/admin/dashboard?from=${range.from}&to=${range.to}` : null);
  const t = data?.totals;

  return (
    <Page title="الداشبورد والأرباح" sub={data ? `من ${fmtDay(data.from)} إلى ${fmtDay(data.to)} · كل المبالغ بالدرهم الإماراتي` : 'كل المبالغ بالدرهم الإماراتي'}>
      <div className="a-filters">
        <div className="seg" role="group" aria-label="الفترة">
          {PRESETS.map((p) => <button key={p.key} className={preset === p.key ? 'is-on' : ''} onClick={() => setPreset(p.key)} aria-pressed={preset === p.key}>{p.label}</button>)}
        </div>
        {preset === 'custom' && <DateRange from={custom.from} to={custom.to} onChange={setCustom} />}
      </div>

      {error && <ErrorBox error={error} onRetry={reload} />}
      {loading && !data && <Spinner />}
      {data && (
        <div className={loading ? 'is-stale' : ''}>
          <div className="kpi-grid">
            <div className={`kpi kpi-hero ${t.profit < 0 ? 'is-neg' : ''}`}>
              <span>صافي الربح</span>
              <strong>{fmt(t.profit)}</strong>
              <small>صافي الإيرادات المحصّلة − تكلفة القطع والطباعة − المصاريف</small>
            </div>
            <div className="kpi"><span>مبيعات الفترة</span><strong>{fmt(t.sales)}</strong><small>{t.orders} طلب (دون الملغاة)</small></div>
            <div className="kpi"><span>المبالغ المحصّلة</span><strong>{fmt(t.collected)}</strong><small>الدفعات المسجّلة في الفترة</small></div>
            <div className="kpi"><span>المبالغ المسترجعة</span><strong>{fmt(t.refunded)}</strong><small>صافي الإيرادات: {fmt(t.netRevenue)}</small></div>
            <div className="kpi"><span>تكلفة الملابس</span><strong>{fmt(t.garment)}</strong><small>من الطلبات المحصّلة</small></div>
            <div className="kpi"><span>تكلفة الطباعة</span><strong>{fmt(t.print)}</strong><small>من الطلبات المحصّلة</small></div>
            <div className="kpi"><span>المصاريف</span><strong>{fmt(t.expenses)}</strong><small>{can('expenses') ? <Link className="link" to="/admin/expenses">سجل المصاريف</Link> : 'المسجّلة في الفترة'}</small></div>
          </div>

          <div className="a-two">
            <section className="a-card a-card-warn">
              <h2><Icon name="wallet" /> طلبات تنتظر الدفع</h2>
              <p className="big">{fmt(data.waiting.amount)} <small>في {data.waiting.count} طلب</small></p>
              <p className="muted">غير محسوبة في الإيرادات ولا في الربح حتى يُسجَّل تحصيلها.</p>
              {data.waiting.orders.length > 0 && (
                <ul className="wait-list">
                  {data.waiting.orders.map((o) => (
                    <li key={o.id}>
                      {can('orders') ? <Link className="link" to={`/admin/orders/${o.id}`}>{o.number}</Link> : <span>{o.number}</span>}
                      <span>{o.customerName} · {STATUS[o.status].label}</span><b>{fmt(o.due)}</b>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="a-card">
              <h2><Icon name="receipt" /> طلبات جديدة</h2>
              <p className="big">{data.newOrders} <small>بانتظار بدء الطباعة</small></p>
              {can('orders') && <Link className="btn btn-ghost btn-sm" to="/admin/orders?status=new">فتح الطلبات الجديدة</Link>}
            </section>
          </div>

          <section className="a-card">
            <h2>المبيعات وصافي الربح {data.monthly ? 'شهريًا' : 'يوميًا'}</h2>
            {t.orders === 0 && t.collected === 0 && t.expenses === 0
              ? <Empty title="لا توجد حركة في هذه الفترة">جرّب فترة أوسع.</Empty>
              : <TrendChart rows={data.series} monthly={data.monthly} />}
          </section>

          <div className="a-two">
            <TopList title="أكثر المنتجات طلبًا" rows={data.topProducts} unit="قطعة" />
            <TopList title="أكثر التصاميم طلبًا" rows={data.topDesigns} unit="طبعة" />
          </div>

          <details className="a-card a-how">
            <summary>كيف يُحسب صافي الربح؟</summary>
            <ul>
              <li>صافي الإيرادات = الدفعات المسجّلة في الفترة − الاسترجاعات المسجّلة فيها. الخصم مخصوم أصلًا من إجمالي الطلب.</li>
              <li>تكلفة القطع والطباعة تؤخذ من النسخة المحفوظة مع كل طلب وقت الشراء، وتُحمَّل مرة واحدة بتاريخ أول تحصيل للطلب.</li>
              <li>تسقط تكلفة القطع إذا أُعيدت إلى المخزون، وتسقط تكلفة الطباعة إذا أُلغي الطلب قبل دخوله الطباعة. طلب أُلغي بعد الطباعة دون دفع تُسجَّل تكلفته خسارة بتاريخ الإلغاء.</li>
              <li>المصاريف تُطرح بتاريخها المسجّل. لا تسجّل شراء الملابس الخام أو الطباعة كمصروف حتى لا تُحتسب مرتين.</li>
              <li>اليوم والفترات بتوقيت الإمارات. آخر تحديث للأرقام: {fmtDate(new Date().toISOString())}.</li>
            </ul>
          </details>
        </div>
      )}
    </Page>
  );
}
