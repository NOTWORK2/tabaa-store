import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { fmt, media, printLink, useTitle, asset } from '../lib.js';
import { Icon, Empty } from '../ui.jsx';
import { useStore } from './StoreLayout.jsx';
import { PrintGrid } from './Collection.jsx';
import { StudioMark, StudioSeal } from './StudioMark.jsx';
import TransferPeel from './TransferPeel.jsx';

function CampaignPhoto({ cover }) {
  const figure = useRef(null);
  const [run, setRun] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 1);
  const [ready, setReady] = useState(false);
  const [inView, setInView] = useState(false);
  const [visible, setVisible] = useState(() => !document.hidden);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting));
    observer.observe(figure.current);
    const onVisibility = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);
  return (
    <figure className="campaign-photo" ref={figure}>
      <img src={asset("editorial/atelier-hero.webp")} alt="تيشيرت قطني رملي مطبوع عليه اسم عمر بن الخطاب بالحبر العنّابي" fetchPriority="high" />
      {run > 0 && <div key={run} className="print-sequence" aria-hidden="true"
        style={{ '--run-state': ready && visible && inView ? 'running' : 'paused' }}
        onAnimationEnd={(event) => { if (event.target === event.currentTarget) setRun(0); }}>
        <TransferPeel />
        <div className="print-workshop-frame">
          <img src={asset("editorial/heat-press.webp")} alt="" onLoad={() => setReady(true)} onError={() => setRun(0)} />
          <span>الطباعة بالمكبس الحراري</span>
        </div>
      </div>}
      <button type="button" className="print-replay" onClick={() => setRun(value => value + 1)}>
        <Icon name="play" size={16} /> شاهد الطباعة
      </button>
      <figcaption><span className="caption-stroke" /> {cover ? <Link to={printLink(cover)}>تسوّق القطعة المصوّرة <Icon name="back" size={14} /></Link> : 'قطن رملي · حبر عنّابي'}</figcaption>
    </figure>
  );
}

function CategoryGrid({ categories }) {
  if (!categories.length) return <Empty title="نجهّز القطع الجديدة">تعود القطع للعرض عند توفرها.</Empty>;
  return (
    <ul className="garment-grid">
      {categories.map((c) => (
        <li key={c.id}>
          <Link to={`/design/${c.slug}`} className="garment-card">
            <span className="garment-photo">{c.image && <img src={media(c.image)} width="768" height="960" alt="" loading="lazy" />}</span>
            <div className="garment-info">
              <span><strong>{c.name}</strong><small>ابتداءً من {fmt(c.fromPrice)}</small></span>
              <span className="garment-arrow" aria-hidden="true"><Icon name="back" size={16} /></span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function Home() {
  const { store, categories, featured = [] } = useStore();
  const cover = featured.find((item) => item.edition === 'umar');
  useTitle(`${store.name} — مشغل الطباعة على الملابس`);
  return (
    <>
      <section className="campaign">
        <div className="campaign-copy">
          <div className="campaign-inner">
            <p className="print-kicker"><i /> {featured.length ? 'مجموعة الأسماء' : 'مشغل الطباعة'}</p>
            <h1>حِبرٌ على قُماش،<br /><em>وأثرٌ يَبقى.</em></h1>
            <p className="campaign-desc">{featured.length ? 'أسماء الصحابة رضي الله عنهم بخطّ عربي على القماش. اختر قطعتك وشاهد طبعتها قبل أن نجهّزها لك.' : 'اختر قطعة من الكتالوج وجرّب عليها التصاميم المتاحة. شاهد المعاينة والسعر قبل تأكيد طلب الطباعة.'}</p>
            <div className="campaign-actions">
              <Link className="btn btn-primary" to={featured.length ? '/collection' : '/design'}>{featured.length ? 'اكتشف المجموعة' : 'تصفّح القطع'} <Icon name="back" size={18} /></Link>
              {featured.length > 0 && <Link className="ink-link" to="/design">صمّم قطعتك</Link>}
            </div>
          </div>
          <StudioSeal />
        </div>
        <CampaignPhoto cover={cover} />
      </section>
      <nav className="service-band" aria-label="خدمات المشغل">
        <div className="wrap">
          <Link to="/design"><Icon name="spool" size={22} /> طباعة حسب الطلب</Link>
          <Link to="/help/shipping"><Icon name="truck" size={23} /> التوصيل داخل الإمارات</Link>
          <Link to="/help/returns"><Icon name="return" size={22} /> الاستبدال والإرجاع</Link>
        </div>
      </nav>
      <section className="wrap selection">
        <header className="shop-section-head">
          <div><p className="print-kicker"><i /> {featured.length ? 'من مجموعة الأسماء' : 'الكتالوج'}</p>
            <h2>{featured.length ? 'مختارات المشغل' : 'قطع للتخصيص'}</h2>
          </div>
          <Link className="text-arrow" to={featured.length ? '/collection' : '/design'}>{featured.length ? 'عرض المجموعة' : 'كل القطع'} <Icon name="back" size={17} /></Link>
        </header>
        {featured.length ? <PrintGrid items={featured} /> : <CategoryGrid categories={categories} />}
      </section>
      <section className="wrap workshop">
        <img className="workshop-photo" src={asset("editorial/heat-press.webp")} alt="تيشيرت على مكبس حراري مفتوح أثناء نزع ورقة النقل عن طبعة عمر بن الخطاب" loading="lazy" />
        <div className="workshop-copy">
          <p className="print-kicker"><StudioMark size={18} /> داخل المشغل</p>
          <h2>من اختيارك إلى القماش.</h2>
          <ol>
            <li><b>١</b><span><strong>اختر القطعة</strong>حدّد نوع اللباس واللون والمقاس المتاح.</span></li>
            <li><b>٢</b><span><strong>جرّب الطبعة</strong>اختر من التصاميم وشاهد موضع الحبر على قطعتك.</span></li>
            <li><b>٣</b><span><strong>أكّد طلبك</strong>راجع السعر والتوصيل وأرسل القطعة إلى المشغل.</span></li>
          </ol>
          <Link className="text-arrow" to="/design">ابدأ تصميمك <Icon name="back" size={18} /></Link>
        </div>
      </section>
    </>
  );
}

export function Pick() {
  const { store, categories } = useStore();
  useTitle(`صمّم قطعتك — ${store.name}`);
  return (
    <section className="wrap browse-page">
      <Link className="crumb" to="/">الرئيسية <Icon name="back" size={15} /></Link>
      <header className="page-heading">
        <p className="print-kicker"><i /> استوديو التخصيص</p>
        <h1>اختر قطعتك.</h1>
        <p>ابدأ بنوع القطعة، ثم جرّب الألوان والتصاميم المتاحة. يظهر سعر الطباعة مع التصميم الذي تختاره.</p>
      </header>
      <CategoryGrid categories={categories} />
    </section>
  );
}
