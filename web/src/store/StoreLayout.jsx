import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useLoad, useCart, media, onBrand, printLink } from '../lib.js';
import { Icon, Spinner, ErrorBox, WhatsAppIcon } from '../ui.jsx';
import { socialPlatforms, socialProfileUrl } from '../../../shared/social.js';
import { StudioMark } from './StudioMark.jsx';
import Music from './Music.jsx';

const StoreCtx = createContext(null);
export const useStore = () => useContext(StoreCtx);
const navLinks = [['/', 'الرئيسية'], ['/collection', 'مجموعة الأسماء'], ['/design', 'صمّم قطعتك'], ['/help', 'دليل المتجر']];
const serviceLinks = [['/help/shipping', 'التوصيل والدفع'], ['/help/returns', 'الاستبدال والإرجاع'], ['/help/faq', 'الأسئلة الشائعة']];
const policyLinks = [['/help/privacy', 'سياسة الخصوصية'], ['/help/terms', 'شروط الشراء']];

export function Brand({ store, to = '/' }) {
  return (
    <Link to={to} className="store-brand" aria-label={`${store.name} — الصفحة الرئيسية`}>
      {store.logo ? <img src={media(store.logo)} alt="" className="brand-logo" /> : <StudioMark size={39} />}
      <span className="wordmark"><b>{store.name}</b>{store.name === 'طبعة' && <small dir="ltr">TABAA STUDIO</small>}</span>
    </Link>
  );
}

function StoreNav({ onChoose, mobile = false }) {
  return (
    <nav className={mobile ? 'mobile-nav' : 'shop-nav'} aria-label={mobile ? 'قائمة الهاتف' : 'التنقل الرئيسي'}>
      {navLinks.map(([to, label]) => (
        <NavLink key={to} end={to === '/'} to={to} onClick={onChoose}>
          {label}{mobile && <Icon name="back" size={16} />}
        </NavLink>
      ))}
    </nav>
  );
}

const normalize = (s) => s.toLowerCase().replace(/[\u064B-\u065F\u0670\u0640]/g, '').replace(/[أإآ]/g, 'ا').trim();

function Search({ catalog, onClose }) {
  const ref = useRef(null);
  const [query, setQuery] = useState('');
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  const options = [
    ...(catalog.featured || []).map((f) => ({ name: f.name, hint: f.productName, image: f.image, to: printLink(f) })),
    ...catalog.categories.map((c) => ({ name: c.name, hint: 'قطعة للتخصيص', image: c.image, to: `/design/${c.slug}` })),
  ];
  const matches = options.filter((x) => normalize(`${x.name} ${x.hint}`).includes(normalize(query)));
  return (
    <dialog className="search-dialog" ref={ref} aria-label="البحث في المتجر" onCancel={(e) => { e.preventDefault(); onClose(); }}
      onClick={(e) => { if (e.target === ref.current) onClose(); }}>
      <div className="search-panel">
        <div className="search-title"><h2>ابحث في المشغل</h2><button className="icon-btn" onClick={onClose} aria-label="إغلاق البحث"><Icon name="close" /></button></div>
        <label className="search-input"><Icon name="search" /><input type="search" value={query} autoFocus onChange={(e) => setQuery(e.target.value)} aria-label="اسم القطعة أو الطبعة" placeholder="اكتب اسم القطعة أو الطبعة" /></label>
        {matches.length ? <ul className="search-results">{matches.map((x) => <li key={x.to}>
          <Link to={x.to} onClick={onClose}>{x.image && <img src={media(x.image)} alt="" />}<span><strong>{x.name}</strong><small>{x.hint}</small></span><Icon name="back" size={16} /></Link>
        </li>)}</ul> : <p className="search-none">لم نجد قطعة بهذا الاسم. جرّب اسمًا مثل «تيشيرت» أو «عمر».</p>}
      </div>
    </dialog>
  );
}

function FooterLinks({ title, links }) {
  return <div className="footer-links"><h2>{title}</h2><ul>{links.map(([to, name]) => <li key={to}><Link to={to}>{name}</Link></li>)}</ul></div>;
}

function Footer({ store }) {
  const { phone, email, whatsapp, address } = store;
  const socialLinks = socialPlatforms.map(platform => ({
    key: platform.key, label: platform.label, href: socialProfileUrl(platform, store[platform.key]),
  })).filter(link => link.href);
  if (whatsapp) socialLinks.unshift({ key: 'whatsapp', label: 'واتساب', href: `https://wa.me/${whatsapp.replace(/\D/g, '')}` });
  return (
    <footer className="store-footer">
      <div className="wrap">
        <div className="footer-grid">
          <div className="footer-about">
            <Brand store={store} />
            <p>{store.tagline}</p>
          </div>
          <FooterLinks title="المشغل" links={navLinks.slice(1, 3)} />
          <FooterLinks title="خدمة الزبائن" links={serviceLinks} />
          <FooterLinks title="سياسات المتجر" links={policyLinks} />
        </div>
        {socialLinks.length > 0 && <nav className="footer-social" aria-label="حسابات المتجر">
          <h2>تواصل معنا</h2>
          <ul>{socialLinks.map(({ key, label, href }) => (
            <li key={key}><a href={href} target="_blank" rel="noopener noreferrer">
              {key === 'whatsapp' ? <WhatsAppIcon size={18} /> : <Icon name={key} size={18} />}
              {label}
            </a></li>
          ))}</ul>
        </nav>}
        {(phone || email || address) && <div className="footer-contact">
          {phone && <a href={`tel:${phone.replace(/\s/g, '')}`}><bdi>{phone}</bdi></a>}
          {email && <a href={`mailto:${email}`}><bdi>{email}</bdi></a>}
          {address && <span>{address}</span>}
        </div>}
        <div className="footer-baseline"><span>© {new Date().getFullYear()} {store.name}</span><span>الإمارات العربية المتحدة <span aria-hidden="true">/</span> د.إ</span></div>
      </div>
    </footer>
  );
}

export default function StoreLayout() {
  const { data, error, loading, reload } = useLoad('/store');
  const cart = useCart();
  const location = useLocation();
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState(false);
  const count = cart.reduce((s, l) => s + l.qty, 0);
  useEffect(() => { setMenu(false); setSearch(false); window.scrollTo({ top: 0, behavior: 'instant' }); }, [location.pathname, location.search]);
  useEffect(() => {
    if (!menu) return undefined;
    const close = (e) => { if (e.key === 'Escape') setMenu(false); };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [menu]);

  if (loading && !data) return <div className="store"><Spinner /></div>;
  if (error) return <div className="store"><div className="wrap pad"><ErrorBox error={error} onRetry={reload} /></div></div>;
  const s = data.store;
  const vars = { '--brand': s.primary, '--brand-2': s.secondary, '--on-brand': onBrand(s.primary), '--on-brand-2': onBrand(s.secondary) };
  const cod = data.payments.some((p) => p.key === 'cod');
  return (
    <StoreCtx.Provider value={{ ...data, reload }}>
      <div className="store" style={vars}>
        <a className="skip-link" href="#main">تخطي إلى المحتوى</a>
        <Link className="announcement" to="/help/shipping"><Icon name="truck" size={16} /> توصيل داخل الإمارات {cod && <><i /> الدفع عند الاستلام</>}</Link>
        <header className="shop-header">
          <div className="wrap shop-header-in">
            <Brand store={s} />
            <StoreNav />
            <div className="header-tools">
              <Music config={data.music} />
              <button className="tool-button" onClick={() => { setMenu(false); setSearch(true); }} aria-label="بحث"><Icon name="search" size={20} /></button>
              <Link className="shopping-bag" to="/cart" aria-label={`السلة، ${count} قطعة`}><Icon name="bag" size={20} /><span>السلة</span><b>{count.toLocaleString('ar-AE')}</b></Link>
              <button className="tool-button menu-trigger" aria-label={menu ? 'إغلاق القائمة' : 'فتح القائمة'} aria-expanded={menu} aria-controls="mobile-navigation" onClick={() => setMenu(!menu)}><Icon name={menu ? 'close' : 'menu'} /></button>
            </div>
          </div>
          {menu && <div id="mobile-navigation"><StoreNav mobile onChoose={() => setMenu(false)} /></div>}
        </header>
        <main id="main"><Outlet /></main>
        <Footer store={s} />
        {search && <Search catalog={data} onClose={() => setSearch(false)} />}
      </div>
    </StoreCtx.Provider>
  );
}
