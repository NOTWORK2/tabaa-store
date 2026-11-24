import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useLoad, fmt, media, cartStore, useCart, useTitle, sizeLabel } from '../lib.js';
import { Icon, Mockup, Spinner, ErrorBox, Empty, Stepper, Modal } from '../ui.jsx';
import { useStore } from './StoreLayout.jsx';

const LOW = 3;
const anyStock = (color, sizes) => sizes.some((s) => (color.stock[s] || 0) > 0);

function firstChoice(product) {
  const color = product.colors.find((c) => anyStock(c, product.sizes)) || product.colors[0];
  const inStock = product.sizes.filter((s) => (color.stock[s] || 0) > 0);
  // المقاس الوحيد المتاح يُختار تلقائيًا (مثل القبعة بمقاس موحّد)
  return { productId: product.id, colorId: color.id, size: product.sizes.length === 1 && inStock.length === 1 ? inStock[0] : null };
}

export default function Studio() {
  const { slug } = useParams();
  const [params] = useSearchParams();
  const initialProduct = Number(params.get('product'));
  const initialColor = Number(params.get('color'));
  const initialDesign = Number(params.get('design'));
  const { store } = useStore();
  const navigate = useNavigate();
  const cart = useCart();
  const { data, error, loading, reload } = useLoad(`/categories/${slug}`);
  const [sel, setSel] = useState(null);
  const [designId, setDesignId] = useState(null);
  const [qty, setQty] = useState(1);
  const [step, setStep] = useState(2);
  const [added, setAdded] = useState(null);

  useTitle(data ? `تخصيص ${data.category.name} — ${store.name}` : store.name);

  useEffect(() => {
    const chosen = data?.products.find((p) => p.id === initialProduct) || data?.products[0];
    const selection = chosen ? firstChoice(chosen) : null;
    const color = chosen?.colors.find((c) => c.id === initialColor && anyStock(c, chosen.sizes));
    if (color) {
      selection.colorId = color.id;
      selection.size = chosen.sizes.length === 1 ? chosen.sizes[0] : null;
    }
    setSel(selection);
    setDesignId(data?.designs.find((d) => d.id === initialDesign)?.id ?? null);
    setQty(1); setStep(2); setAdded(null);
  }, [data, initialProduct, initialColor, initialDesign]);

  const product = useMemo(() => data?.products.find((p) => p.id === sel?.productId) || null, [data, sel]);
  const color = product?.colors.find((c) => c.id === sel?.colorId) || null;
  const design = data?.designs.find((d) => d.id === designId) || null;

  if (loading && !data) return <Spinner />;
  if (error) {
    return (
      <div className="wrap section">
        <ErrorBox error={error} onRetry={error.status === 404 ? null : reload} />
        <p><Link className="link" to="/design">العودة إلى أنواع الملابس</Link></p>
      </div>
    );
  }
  if (data.products.length && !sel) return <Spinner />;
  if (!product || !color) {
    return <div className="wrap section"><Empty title="لا توجد قطع متاحة في هذا النوع الآن"><Link className="link" to="/design">اختر نوعًا آخر</Link></Empty></div>;
  }

  const stock = sel.size ? color.stock[sel.size] || 0 : 0;
  // ما في السلة من نفس اللون والمقاس (ولو بتصاميم أخرى) يُخصم من المتاح
  const inCart = cart.filter((l) => l.productId === product.id && l.colorId === color.id && l.size === sel.size).reduce((s, l) => s + l.qty, 0);
  const maxQty = Math.max(0, stock - inCart);
  const pieceReady = !!sel.size && stock > 0;
  const itemPrice = product.price + (design ? design.printPrice : 0);
  const safeQty = Math.min(qty, Math.max(1, maxQty));

  const pickProduct = (p) => { setSel(firstChoice(p)); setQty(1); };
  const pickColor = (c) => {
    setSel((s) => ({ ...s, colorId: c.id, size: s.size && (c.stock[s.size] || 0) > 0 ? s.size : null }));
    setQty(1);
  };

  const addToCart = () => {
    cartStore.add({ productId: product.id, colorId: color.id, size: sel.size, designId: design.id, qty: safeQty });
    setAdded({ image: color.image, design: design.image, area: product.printArea, name: product.name, designName: design.name, qty: safeQty });
    setQty(1);
  };

  const steps = [
    { n: 1, label: 'النوع', done: true, to: '/design' },
    { n: 2, label: 'القطعة', done: pieceReady, enabled: true },
    { n: 3, label: 'التصميم', done: !!design, enabled: pieceReady },
    { n: 4, label: 'المعاينة', done: false, enabled: pieceReady && !!design },
  ];

  let action;
  if (step === 2) {
    action = <button className="btn btn-primary" disabled={!pieceReady} onClick={() => setStep(3)}>{sel.size ? 'التالي: اختر التصميم' : 'اختر المقاس أولًا'}</button>;
  } else if (step === 3) {
    action = <button className="btn btn-primary" disabled={!design} onClick={() => setStep(4)}>{design ? 'التالي: المعاينة والسعر' : 'اختر تصميمًا'}</button>;
  } else {
    action = <button className="btn btn-primary" disabled={maxQty < 1} onClick={addToCart}><Icon name="cart" /> أضف إلى السلة</button>;
  }

  return (
    <div className="wrap studio">
      <div className="studio-preview">
        <Mockup image={color.image} design={design?.image} area={product.printArea} className="studio-mock">
          {!design && <span className="print-zone" style={{ left: `${product.printArea.x * 100}%`, top: `${product.printArea.y * 100}%`, width: `${product.printArea.w * 100}%`, height: `${product.printArea.h * 100}%` }}><span>مكان الطباعة</span></span>}
        </Mockup>
        <p className="studio-caption">{product.name} · {color.name}{sel.size ? ` · ${sizeLabel(sel.size)}` : ''}{design ? ` · ${design.name}` : ''}</p>
      </div>

      <div className="studio-panel">
        <nav className="steps" aria-label="خطوات التخصيص">
          {steps.map((s) => (s.to
            ? <Link key={s.n} to={s.to} className="step is-done"><b><Icon name="check" size={14} /></b>{s.label}: {data.category.name}</Link>
            : (
              <button key={s.n} className={`step ${step === s.n ? 'is-current' : ''} ${s.done && step !== s.n ? 'is-done' : ''}`}
                disabled={!s.enabled} onClick={() => setStep(s.n)} aria-current={step === s.n ? 'step' : undefined}>
                <b>{s.done && step !== s.n ? <Icon name="check" size={14} /> : s.n}</b>{s.label}
              </button>
            )))}
        </nav>

        {step === 2 && (
          <div className="studio-body">
            {data.products.length > 1 && (
              <fieldset className="opt">
                <legend>القطعة</legend>
                <div className="product-list">
                  {data.products.map((p) => (
                    <button key={p.id} type="button" className={`product-opt ${p.id === product.id ? 'is-on' : ''}`} onClick={() => pickProduct(p)} aria-pressed={p.id === product.id}>
                      <img src={media(p.colors[0]?.image)} alt="" />
                      <span><strong>{p.name}</strong><em>{fmt(p.price)}</em></span>
                    </button>
                  ))}
                </div>
              </fieldset>
            )}
            {data.products.length === 1 && <h1 className="studio-title">{product.name}</h1>}
            {product.description && <p className="studio-desc">{product.description}</p>}

            <fieldset className="opt">
              <legend>اللون: <strong>{color.name}</strong></legend>
              <div className="swatches">
                {product.colors.map((c) => {
                  const out = !anyStock(c, product.sizes);
                  return (
                    <button key={c.id} type="button" className={`swatch ${c.id === color.id ? 'is-on' : ''} ${out ? 'is-out' : ''}`}
                      onClick={() => pickColor(c)} aria-pressed={c.id === color.id} aria-label={`${c.name}${out ? ' (نفد)' : ''}`} title={`${c.name}${out ? ' (نفد)' : ''}`}>
                      <i style={{ background: c.hex }} />
                    </button>
                  );
                })}
              </div>
              {!anyStock(color, product.sizes) && <p className="opt-warn">نفد هذا اللون من المخزون. اختر لونًا آخر.</p>}
            </fieldset>

            <fieldset className="opt">
              <legend>المقاس{sel.size ? <>: <strong>{sel.size}</strong></> : ''}</legend>
              <div className="sizes">
                {product.sizes.map((s) => {
                  const n = color.stock[s] || 0;
                  return (
                    <button key={s} type="button" className={`size ${sel.size === s ? 'is-on' : ''}`} disabled={n <= 0}
                      onClick={() => { setSel((x) => ({ ...x, size: s })); setQty(1); }} aria-pressed={sel.size === s}>
                      {s}
                      {n <= 0 ? <small>نفد</small> : n <= LOW ? <small className="low">بقي {n}</small> : null}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          </div>
        )}

        {step === 3 && (
          <div className="studio-body">
            <fieldset className="opt">
              <legend>التصميم{design ? <>: <strong>{design.name}</strong></> : ''}</legend>
              {data.designs.length === 0
                ? <Empty title="لا توجد تصاميم لهذا النوع بعد">يضيف فريق المتجر تصاميم جديدة باستمرار.</Empty>
                : (
                  <div className="design-grid">
                    {data.designs.map((d) => (
                      <button key={d.id} type="button" className={`design-opt ${d.id === designId ? 'is-on' : ''}`} onClick={() => setDesignId(d.id)} aria-pressed={d.id === designId}>
                        <span className="design-thumb"><img src={media(d.thumb)} alt="" loading="lazy" /></span>
                        <strong>{d.name}</strong>
                        <em>+ {fmt(d.printPrice)}</em>
                      </button>
                    ))}
                  </div>
                )}
            </fieldset>
          </div>
        )}

        {step === 4 && design && (
          <div className="studio-body">
            <h2 className="studio-title">مراجعة قطعتك</h2>
            <ul className="review">
              <li>
                <span>القطعة</span>
                <strong>{product.name} — {color.name} — {sizeLabel(sel.size)}</strong>
                <button className="link" onClick={() => setStep(2)}>تغيير</button>
              </li>
              <li>
                <span>التصميم</span>
                <strong>{design.name}</strong>
                <button className="link" onClick={() => setStep(3)}>تغيير</button>
              </li>
            </ul>
            <dl className="price-list">
              <div><dt>سعر القطعة</dt><dd>{fmt(product.price)}</dd></div>
              <div><dt>سعر الطباعة</dt><dd>{fmt(design.printPrice)}</dd></div>
              <div className="total"><dt>سعر القطعة بعد التخصيص</dt><dd>{fmt(itemPrice)}</dd></div>
            </dl>
            {maxQty < 1
              ? <p className="opt-warn">الكمية المتوفرة من هذا اللون والمقاس موجودة كلها في سلتك.</p>
              : (
                <div className="qty-row">
                  <span>الكمية</span>
                  <Stepper value={safeQty} max={maxQty} onChange={setQty} />
                  {maxQty <= LOW && <small className="low">المتاح {maxQty} فقط</small>}
                </div>
              )}
          </div>
        )}

        <div className="buybar">
          <div className="buybar-price">
            <span>{design ? (step === 4 && safeQty > 1 ? `المجموع (${safeQty} قطع)` : 'بعد التخصيص') : 'سعر القطعة'}</span>
            <strong>{fmt(step === 4 ? itemPrice * safeQty : itemPrice)}</strong>
          </div>
          {action}
        </div>
      </div>

      {added && (
        <Modal title="أُضيفت القطعة إلى السلة" onClose={() => setAdded(null)}
          footer={(
            <>
              <button className="btn btn-primary" onClick={() => navigate('/cart')}>عرض السلة وإتمام الطلب</button>
              <button className="btn btn-ghost" onClick={() => navigate('/design')}>صمّم قطعة أخرى</button>
            </>
          )}>
          <div className="added">
            <Mockup image={added.image} design={added.design} area={added.area} />
            <div><strong>{added.name}</strong><p>التصميم: {added.designName} · الكمية: {added.qty}</p></div>
          </div>
        </Modal>
      )}
    </div>
  );
}
