import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, useLoad, fmt, media } from '../lib.js';
import { Icon, Spinner, ErrorBox, Empty, Badge, Modal, Field, MoneyInput, Toggle, Mockup, useToast } from '../ui.jsx';
import { Page, Confirm, ImageUpload, PrintAreaEditor, useAction } from './parts.jsx';

/* ───────────── أنواع الملابس ───────────── */

function CategoryForm({ initial, onClose, onSaved }) {
  const [f, setF] = useState(initial || { name: '', image: null, visible: true });
  const [run, busy] = useAction();
  const save = async (e) => {
    e.preventDefault();
    const r = await run(() => (initial
      ? api(`/admin/categories/${initial.id}`, { method: 'PUT', body: f })
      : api('/admin/categories', { method: 'POST', body: f })), initial ? 'تم حفظ التعديلات' : 'تمت إضافة النوع');
    if (r) { onSaved(); onClose(); }
  };
  return (
    <Modal title={initial ? `تعديل «${initial.name}»` : 'نوع لباس جديد'} onClose={onClose}>
      <form className="a-form" onSubmit={save}>
        <Field label="اسم النوع"><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} maxLength={60} required autoFocus placeholder="مثال: فستان" /></Field>
        <Field label="صورة النوع" hint="تظهر في بطاقة النوع بالصفحة الرئيسية. PNG أو JPG أو WebP">
          <ImageUpload kind="category" value={f.image} onChange={(image) => setF({ ...f, image })} />
        </Field>
        <Toggle checked={f.visible} onChange={(visible) => setF({ ...f, visible })} label="ظاهر في المتجر" />
        {!initial && <p className="muted">يظهر النوع للزبائن بعد إضافة منتج مفعّل واحد على الأقل إليه.</p>}
        <button className="btn btn-ink" disabled={busy}>حفظ</button>
      </form>
    </Modal>
  );
}

export function Categories() {
  const { data, error, loading, reload, setData } = useLoad('/admin/categories');
  const [edit, setEdit] = useState(null);
  const [del, setDel] = useState(null);
  const [run] = useAction();
  if (loading && !data) return <Page title="أنواع الملابس"><Spinner /></Page>;
  if (error) return <Page title="أنواع الملابس"><ErrorBox error={error} onRetry={reload} /></Page>;
  const list = data.categories;

  const move = (i, d) => {
    const ids = list.map((c) => c.id);
    [ids[i], ids[i + d]] = [ids[i + d], ids[i]];
    run(async () => setData(await api('/admin/categories/reorder', { method: 'POST', body: { ids } })));
  };
  const toggle = (c) => run(async () => {
    await api(`/admin/categories/${c.id}`, { method: 'PUT', body: { visible: !c.visible } });
    reload();
  }, c.visible ? 'أُخفي النوع من المتجر' : 'النوع ظاهر الآن في المتجر');

  return (
    <Page title="أنواع الملابس" sub="رتّب الأنواع كما تريد ظهورها للزبون"
      actions={<button className="btn btn-ink" onClick={() => setEdit({})}><Icon name="plus" /> نوع جديد</button>}>
      {list.length === 0 ? <Empty title="لا توجد أنواع بعد">أضف أول نوع لباس.</Empty> : (
        <ul className="a-list">
          {list.map((c, i) => (
            <li key={c.id} className="a-row">
              <div className="a-row-order">
                <button className="icon-btn" onClick={() => move(i, -1)} disabled={i === 0} aria-label="تحريك للأعلى"><Icon name="up" size={18} /></button>
                <button className="icon-btn" onClick={() => move(i, 1)} disabled={i === list.length - 1} aria-label="تحريك للأسفل"><Icon name="down" size={18} /></button>
              </div>
              <span className="a-thumb">{c.image && <img src={media(c.image)} alt="" />}</span>
              <div className="a-row-main">
                <strong>{c.name}</strong>
                <span>{c.productCount} منتج{c.productCount === 0 && ' · لن يظهر للزبون حتى يُضاف إليه منتج'}</span>
              </div>
              <Badge tone={c.visible ? 'ok' : 'mute'}>{c.visible ? 'ظاهر' : 'مخفي'}</Badge>
              <div className="a-row-actions">
                <button className="btn btn-ghost btn-sm" onClick={() => toggle(c)}><Icon name={c.visible ? 'eyeOff' : 'eye'} size={16} /> {c.visible ? 'إخفاء' : 'إظهار'}</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setEdit(c)}><Icon name="edit" size={16} /> تعديل</button>
                <button className="icon-btn" onClick={() => setDel(c)} aria-label={`حذف ${c.name}`}><Icon name="trash" size={18} /></button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {edit && <CategoryForm initial={edit.id ? { id: edit.id, name: edit.name, image: edit.image, visible: edit.visible } : null} onClose={() => setEdit(null)} onSaved={reload} />}
      {del && (
        <Confirm title="حذف النوع" danger confirmLabel="حذف" onClose={() => setDel(null)}
          onConfirm={async () => { await api(`/admin/categories/${del.id}`, { method: 'DELETE' }); reload(); }}>
          حذف «{del.name}» نهائيًا؟ لا يمكن حذف نوع مرتبط بمنتجات.
        </Confirm>
      )}
    </Page>
  );
}

/* ───────────── المنتجات والمخزون ───────────── */

export function Products() {
  const { data, error, loading, reload } = useLoad('/admin/products');
  if (loading && !data) return <Page title="المنتجات والمخزون"><Spinner /></Page>;
  if (error) return <Page title="المنتجات والمخزون"><ErrorBox error={error} onRetry={reload} /></Page>;
  const low = data.products.filter((p) => p.active && p.low.length);
  return (
    <Page title="المنتجات والمخزون" sub={`${data.products.length} منتج`}
      actions={<Link className="btn btn-ink" to="/admin/products/new"><Icon name="plus" /> منتج جديد</Link>}>
      {low.length > 0 && (
        <div className="notice notice-warn" role="status">
          <Icon name="alert" />
          <div>
            <strong>تنبيه مخزون: {low.reduce((s, p) => s + p.low.length, 0)} تركيبة لون ومقاس عند {data.threshold} قطع أو أقل</strong>
            <ul className="low-list">
              {low.map((p) => (
                <li key={p.id}><Link className="link" to={`/admin/products/${p.id}`}>{p.name}</Link>: {p.low.slice(0, 6).map((v) => `${v.colorName} ${v.size} (${v.stock === 0 ? 'نفد' : v.stock})`).join('، ')}{p.low.length > 6 && ` و${p.low.length - 6} أخرى`}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
      {data.products.length === 0 ? <Empty title="لا توجد منتجات بعد">أضف أول منتج واربطه بنوع لباس.</Empty> : (
        <div className="a-table-wrap">
          <table className="a-table a-table-cards">
            <thead><tr><th>المنتج</th><th>النوع</th><th>سعر البيع</th><th>التكلفة</th><th>المخزون</th><th>الحالة</th><th /></tr></thead>
            <tbody>
              {data.products.map((p) => (
                <tr key={p.id}>
                  <td data-label="المنتج">
                    <Link to={`/admin/products/${p.id}`} className="a-cell-main">
                      <span className="a-thumb">{p.image && <img src={media(p.image)} alt="" />}</span>
                      <span><strong>{p.name}</strong><span className="mini-swatches">{p.colors.map((c) => <i key={c.name} style={{ background: c.hex }} title={c.name} />)}</span></span>
                    </Link>
                  </td>
                  <td data-label="النوع">{p.categoryName}</td>
                  <td data-label="سعر البيع">{fmt(p.price)}</td>
                  <td data-label="التكلفة">{fmt(p.cost)}</td>
                  <td data-label="المخزون">{p.stockTotal} قطعة {p.low.length > 0 && <Badge tone={p.low.some((v) => v.stock === 0) ? 'danger' : 'warn'}>{p.low.length} منخفض</Badge>}</td>
                  <td data-label="الحالة"><Badge tone={p.active ? 'ok' : 'mute'}>{p.active ? 'معروض' : 'موقوف'}</Badge></td>
                  <td><Link className="btn btn-ghost btn-sm" to={`/admin/products/${p.id}`}><Icon name="edit" size={16} /> تعديل</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Page>
  );
}

const SIZE_PRESET = ['S', 'M', 'L', 'XL', 'XXL'];
let tmp = 0;
const newColor = () => ({ key: `n${++tmp}`, name: '', hex: '#f4f1ea', image: null, stock: {} });

export function ProductEdit() {
  const { id } = useParams();
  const isNew = id === 'new';
  const navigate = useNavigate();
  const toast = useToast();
  const cats = useLoad('/admin/categories');
  const prod = useLoad(isNew ? null : `/admin/products/${id}`);
  const [f, setF] = useState(null);
  const [sizeTxt, setSizeTxt] = useState('');
  const [areaColor, setAreaColor] = useState(0);
  const [del, setDel] = useState(false);
  const [run, busy] = useAction();

  useEffect(() => {
    if (isNew) {
      setF({ name: '', description: '', categoryId: '', price: NaN, cost: NaN, active: true, sizes: [], printArea: { x: 0.32, y: 0.26, w: 0.36, h: 0.36 }, colors: [newColor()] });
    } else if (prod.data) {
      const p = prod.data.product;
      setF({ ...p, colors: p.colors.map((c) => ({ ...c, key: `c${c.id}` })) });
    }
  }, [isNew, prod.data]);

  const title = isNew ? 'منتج جديد' : 'تعديل المنتج';
  const back = <Link className="a-back" to="/admin/products"><Icon name="next" size={16} /> المنتجات</Link>;
  if (prod.error || cats.error) return <Page title={title} back={back}><ErrorBox error={prod.error || cats.error} onRetry={() => { prod.reload(); cats.reload(); }} /></Page>;
  if (!f || !cats.data) return <Page title={title} back={back}><Spinner /></Page>;

  const set = (patch) => setF((x) => ({ ...x, ...patch }));
  const setColor = (key, patch) => setF((x) => ({ ...x, colors: x.colors.map((c) => (c.key === key ? { ...c, ...patch } : c)) }));
  const addSizes = (list) => set({ sizes: [...new Set([...f.sizes, ...list.map((s) => s.trim()).filter(Boolean)])] });
  const pickCategory = (categoryId) => {
    const cat = cats.data.categories.find((c) => String(c.id) === String(categoryId));
    // عند إنشاء منتج جديد نبدأ بمساحة الطباعة المعتادة لهذا النوع
    set({ categoryId, ...(isNew && cat ? { printArea: cat.printArea } : {}) });
  };
  const withImage = f.colors.filter((c) => c.image);
  const areaImage = (withImage[areaColor] || withImage[0])?.image || null;

  const save = async (e) => {
    e.preventDefault();
    if (Number.isNaN(f.price) || Number.isNaN(f.cost)) { toast('أدخل سعر البيع وتكلفة القطعة بأرقام صحيحة', 'error'); return; }
    const body = {
      ...f, categoryId: Number(f.categoryId),
      colors: f.colors.map((c) => ({ id: c.id, name: c.name, hex: c.hex, image: c.image, stock: Object.fromEntries(f.sizes.map((s) => [s, Number(c.stock[s]) || 0])) })),
    };
    const r = await run(() => (isNew ? api('/admin/products', { method: 'POST', body }) : api(`/admin/products/${id}`, { method: 'PUT', body })), 'تم حفظ المنتج');
    if (r) navigate('/admin/products');
  };

  return (
    <Page title={title} sub={isNew ? null : f.name} back={back}
      actions={!isNew && <button className="btn btn-danger btn-sm" type="button" onClick={() => setDel(true)}><Icon name="trash" size={16} /> حذف المنتج</button>}>
      <form className="a-form-wide" onSubmit={save}>
        <section className="a-card">
          <h2>البيانات الأساسية</h2>
          <div className="form-grid">
            <Field label="اسم المنتج"><input value={f.name} onChange={(e) => set({ name: e.target.value })} maxLength={80} required /></Field>
            <Field label="نوع اللباس">
              <select value={f.categoryId} onChange={(e) => pickCategory(e.target.value)} required>
                <option value="">اختر النوع</option>
                {cats.data.categories.map((c) => <option key={c.id} value={c.id}>{c.name}{c.visible ? '' : ' (مخفي)'}</option>)}
              </select>
            </Field>
            <Field label="سعر البيع"><MoneyInput value={f.price} onChange={(price) => set({ price })} required /></Field>
            <Field label="تكلفة القطعة" hint="تُستخدم في حساب الأرباح ولا تظهر للزبون"><MoneyInput value={f.cost} onChange={(cost) => set({ cost })} required /></Field>
            <Field label="الوصف" className="span-2"><textarea rows={3} value={f.description} onChange={(e) => set({ description: e.target.value })} maxLength={1000} /></Field>
          </div>
          <Toggle checked={f.active} onChange={(active) => set({ active })} label="معروض للبيع في المتجر" />
        </section>

        <section className="a-card">
          <h2>المقاسات</h2>
          <div className="chips">
            {f.sizes.map((s) => (
              <span key={s} className="chip">{s}<button type="button" onClick={() => set({ sizes: f.sizes.filter((x) => x !== s) })} aria-label={`إزالة ${s}`}><Icon name="close" size={14} /></button></span>
            ))}
            {f.sizes.length === 0 && <span className="muted">لا توجد مقاسات بعد</span>}
          </div>
          <div className="inline-add">
            <input value={sizeTxt} onChange={(e) => setSizeTxt(e.target.value)} placeholder="مقاس جديد، مثل 3XL" maxLength={12}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSizes([sizeTxt]); setSizeTxt(''); } }} />
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { addSizes([sizeTxt]); setSizeTxt(''); }}>إضافة</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => addSizes(SIZE_PRESET)}>S إلى XXL</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => addSizes(['مقاس موحّد'])}>مقاس موحّد</button>
          </div>
        </section>

        <section className="a-card">
          <h2>الألوان والمخزون</h2>
          <p className="muted">لكل لون صورة للقطعة وكمية لكل مقاس. المقاس الذي كميته صفر يظهر للزبون «نفد».</p>
          <div className="color-list">
            {f.colors.map((c, i) => (
              <div key={c.key} className="color-card">
                <ImageUpload kind="product" value={c.image} onChange={(image) => setColor(c.key, { image })} label="صورة القطعة" />
                <div className="color-fields">
                  <div className="color-top">
                    <Field label="اسم اللون"><input value={c.name} onChange={(e) => setColor(c.key, { name: e.target.value })} maxLength={30} required placeholder="مثال: أسود" /></Field>
                    <Field label="اللون"><input type="color" value={c.hex} onChange={(e) => setColor(c.key, { hex: e.target.value })} aria-label={`لون ${c.name || i + 1}`} /></Field>
                    {f.colors.length > 1 && <button type="button" className="icon-btn" onClick={() => set({ colors: f.colors.filter((x) => x.key !== c.key) })} aria-label="حذف اللون"><Icon name="trash" size={18} /></button>}
                  </div>
                  {f.sizes.length > 0 && (
                    <div className="stock-grid">
                      {f.sizes.map((s) => (
                        <label key={s}><span>{s}</span>
                          <input type="number" min="0" max="100000" inputMode="numeric" dir="ltr" value={c.stock[s] ?? 0}
                            onChange={(e) => setColor(c.key, { stock: { ...c.stock, [s]: e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value, 10) || 0) } })} />
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => set({ colors: [...f.colors, newColor()] })}><Icon name="plus" size={16} /> لون آخر</button>
        </section>

        <section className="a-card">
          <h2>مساحة الطباعة</h2>
          <p className="muted">اسحب المستطيل إلى مكان الطباعة على القطعة واسحب زواياه لتغيير حجمه. يظهر تصميم الزبون داخل هذه المساحة تمامًا.</p>
          {withImage.length > 1 && (
            <div className="seg seg-sm">{withImage.map((c, i) => <button type="button" key={c.key} className={i === areaColor ? 'is-on' : ''} onClick={() => setAreaColor(i)}>{c.name || `لون ${i + 1}`}</button>)}</div>
          )}
          <PrintAreaEditor image={areaImage} value={f.printArea} onChange={(printArea) => set({ printArea })} />
        </section>

        <div className="a-savebar">
          <button className="btn btn-ink" disabled={busy}>{busy ? 'جارٍ الحفظ…' : 'حفظ المنتج'}</button>
          <Link className="btn btn-ghost" to="/admin/products">إلغاء</Link>
        </div>
      </form>
      {del && (
        <Confirm title="حذف المنتج" danger confirmLabel="حذف نهائي" onClose={() => setDel(false)}
          onConfirm={async () => { await api(`/admin/products/${id}`, { method: 'DELETE' }); toast('حُذف المنتج'); navigate('/admin/products'); }}>
          حذف «{f.name}» من المتجر؟ الطلبات السابقة تحتفظ بتفاصيلها ومعايناتها. إن أردت إيقاف بيعه مؤقتًا فعطّل «معروض للبيع» بدل الحذف.
        </Confirm>
      )}
    </Page>
  );
}

/* ───────────── مكتبة التصاميم ───────────── */

function DesignForm({ initial, categories, garments, onClose, onSaved }) {
  const [f, setF] = useState(initial
    ? { name: initial.name, printPrice: initial.printPrice, printCost: initial.printCost, categoryIds: initial.categoryIds }
    : { name: '', printPrice: NaN, printCost: NaN, categoryIds: categories.map((c) => c.id) });
  const [file, setFile] = useState(null);
  const [garment, setGarment] = useState(0);
  const [colorIdx, setColorIdx] = useState(0);
  const [run, busy] = useAction();
  const toast = useToast();
  const blobUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => { if (blobUrl) URL.revokeObjectURL(blobUrl); }, [blobUrl]);

  const usable = garments.filter((g) => f.categoryIds.includes(g.categoryId));
  const g = usable[Math.min(garment, usable.length - 1)] || garments[0];
  const gColor = g?.colors[Math.min(colorIdx, g.colors.length - 1)];
  const previewUrl = blobUrl || (initial ? media(initial.image) : null);

  const pick = (e) => {
    const x = e.target.files?.[0];
    if (!x) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(x.type)) { toast('الصيغ المسموحة: PNG و JPG و WebP', 'error'); return; }
    setFile(x);
    if (!f.name) setF((s) => ({ ...s, name: x.name.replace(/\.[^.]+$/, '').slice(0, 80) }));
  };
  const toggleCat = (id) => setF((s) => ({ ...s, categoryIds: s.categoryIds.includes(id) ? s.categoryIds.filter((x) => x !== id) : [...s.categoryIds, id] }));

  const save = async (published) => {
    if (!initial && !file) { toast('ارفع صورة التصميم أولًا', 'error'); return; }
    if (!f.name.trim()) { toast('اكتب اسم التصميم', 'error'); return; }
    if (Number.isNaN(f.printPrice) || Number.isNaN(f.printCost)) { toast('أدخل سعر الطباعة وتكلفتها', 'error'); return; }
    const form = new FormData();
    if (file) form.append('file', file);
    form.append('name', f.name); form.append('printPrice', f.printPrice); form.append('printCost', f.printCost);
    form.append('categoryIds', JSON.stringify(f.categoryIds)); form.append('published', published ? '1' : '0');
    const r = await run(() => (initial ? api(`/admin/designs/${initial.id}`, { method: 'PUT', form }) : api('/admin/designs', { method: 'POST', form })),
      published ? 'تم الحفظ والتصميم منشور في المتجر' : 'تم الحفظ كمسودة غير منشورة');
    if (r) { onSaved(); onClose(); }
  };

  return (
    <Modal wide title={initial ? `تعديل «${initial.name}»` : 'رفع تصميم جديد'} onClose={onClose}
      footer={(
        <>
          <button className="btn btn-ink" disabled={busy} onClick={() => save(true)}>حفظ ونشر في المتجر</button>
          <button className="btn btn-ghost" disabled={busy} onClick={() => save(false)}>{initial?.published ? 'حفظ وإخفاء من المتجر' : 'حفظ كمسودة'}</button>
        </>
      )}>
      <div className="design-form">
        <div className="a-form">
          <Field label={initial ? 'استبدال ملف التصميم (اختياري)' : 'ملف التصميم'} hint="PNG أو JPG أو WebP. الخلفية الشفافة مدعومة. يُحفظ الملف الأصلي كما هو للطباعة.">
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={pick} />
          </Field>
          <Field label="اسم التصميم"><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} maxLength={80} /></Field>
          <div className="form-grid">
            <Field label="سعر الطباعة"><MoneyInput value={f.printPrice} onChange={(printPrice) => setF((s) => ({ ...s, printPrice }))} /></Field>
            <Field label="تكلفة الطباعة" hint="لحساب الأرباح فقط"><MoneyInput value={f.printCost} onChange={(printCost) => setF((s) => ({ ...s, printCost }))} /></Field>
          </div>
          <fieldset className="opt">
            <legend>أنواع الملابس المتوافقة</legend>
            <div className="check-grid">
              {categories.map((c) => (
                <label key={c.id} className="check"><input type="checkbox" checked={f.categoryIds.includes(c.id)} onChange={() => toggleCat(c.id)} /> {c.name}</label>
              ))}
            </div>
          </fieldset>
        </div>
        <div className="design-preview">
          <strong>المعاينة قبل النشر</strong>
          {g && previewUrl ? (
            <>
              <Mockup image={gColor.image} designUrl={previewUrl} area={g.printArea} />
              <div className="seg seg-sm">{usable.map((x, i) => <button type="button" key={x.categoryId} className={x === g ? 'is-on' : ''} onClick={() => { setGarment(i); setColorIdx(0); }}>{x.categoryName}</button>)}</div>
              <div className="mini-swatches is-pick">{g.colors.map((c, i) => <button type="button" key={c.name} className={c === gColor ? 'is-on' : ''} style={{ background: c.hex }} onClick={() => setColorIdx(i)} aria-label={c.name} title={c.name} />)}</div>
            </>
          ) : <div className="design-thumb design-thumb-lg">{previewUrl ? <img src={previewUrl} alt="" /> : <span className="muted">ارفع ملفًا لتظهر المعاينة على القطعة</span>}</div>}
        </div>
      </div>
    </Modal>
  );
}

export function Designs() {
  const designs = useLoad('/admin/designs');
  const cats = useLoad('/admin/categories');
  const garments = useLoad('/admin/preview-garments');
  const [edit, setEdit] = useState(null);
  const [del, setDel] = useState(null);
  const [run] = useAction();

  const err = designs.error || cats.error || garments.error;
  if (err) return <Page title="مكتبة التصاميم"><ErrorBox error={err} onRetry={() => { designs.reload(); cats.reload(); garments.reload(); }} /></Page>;
  if (!designs.data || !cats.data || !garments.data) return <Page title="مكتبة التصاميم"><Spinner /></Page>;
  const catName = (id) => cats.data.categories.find((c) => c.id === id)?.name;

  const togglePublish = (d) => {
    const form = new FormData();
    form.append('name', d.name); form.append('printPrice', d.printPrice); form.append('printCost', d.printCost);
    form.append('categoryIds', JSON.stringify(d.categoryIds)); form.append('published', d.published ? '0' : '1');
    run(async () => { await api(`/admin/designs/${d.id}`, { method: 'PUT', form }); designs.reload(); }, d.published ? 'أُخفي التصميم من المتجر' : 'التصميم منشور الآن');
  };

  return (
    <Page title="مكتبة التصاميم" sub={`${designs.data.designs.length} تصميم · ${designs.data.designs.filter((d) => d.published).length} منشور`}
      actions={<button className="btn btn-ink" onClick={() => setEdit({})}><Icon name="upload" /> رفع تصميم</button>}>
      {designs.data.designs.length === 0 ? <Empty title="المكتبة فارغة">ارفع أول تصميم ليختاره الزبائن.</Empty> : (
        <ul className="design-cards">
          {designs.data.designs.map((d) => (
            <li key={d.id} className="design-card">
              <span className="design-thumb"><img src={media(d.thumb)} alt="" loading="lazy" /></span>
              <div className="design-card-body">
                <div className="design-card-top"><strong>{d.name}</strong><Badge tone={d.published ? 'ok' : 'mute'}>{d.published ? 'منشور' : 'مسودة'}</Badge></div>
                <span>طباعة {fmt(d.printPrice)} · تكلفة {fmt(d.printCost)}</span>
                <span className="muted">{d.categoryIds.map(catName).filter(Boolean).join('، ') || 'بلا أنواع متوافقة'}</span>
                <span className="muted" dir="ltr">{d.width}×{d.height}px</span>
              </div>
              <div className="design-card-actions">
                <button className="btn btn-ghost btn-sm" onClick={() => togglePublish(d)}><Icon name={d.published ? 'eyeOff' : 'eye'} size={16} /> {d.published ? 'إخفاء' : 'نشر'}</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setEdit(d)}><Icon name="edit" size={16} /> تعديل</button>
                <button className="icon-btn" onClick={() => setDel(d)} aria-label={`حذف ${d.name}`}><Icon name="trash" size={18} /></button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {edit && <DesignForm initial={edit.id ? edit : null} categories={cats.data.categories} garments={garments.data.garments} onClose={() => setEdit(null)} onSaved={designs.reload} />}
      {del && (
        <Confirm title="حذف التصميم" danger confirmLabel="حذف نهائي" onClose={() => setDel(null)}
          onConfirm={async () => { await api(`/admin/designs/${del.id}`, { method: 'DELETE' }); designs.reload(); }}>
          حذف «{del.name}» من المكتبة؟ الطلبات السابقة تحتفظ بنسختها من ملف الطباعة.
        </Confirm>
      )}
    </Page>
  );
}
