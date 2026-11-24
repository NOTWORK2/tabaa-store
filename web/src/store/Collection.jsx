import { useState } from 'react';
import { Link } from 'react-router-dom';
import { fmt, media, printLink, useTitle } from '../lib.js';
import { Icon, Empty } from '../ui.jsx';
import { useStore } from './StoreLayout.jsx';

export function PrintGrid({ items }) {
  return (
    <ul className="print-grid">
      {items.map((item) => (
        <li key={item.id}>
          <Link className="print-card" to={printLink(item)}>
            <div className="print-photo">
              <img src={media(item.image)} loading="lazy" alt={`طبعة ${item.name} على ${item.productName} باللون ${item.colorName}`} />
              <span className="photo-open" aria-hidden="true"><Icon name="back" size={17} /></span>
            </div>
            <div className="print-meta"><h3>{item.name}</h3><span>{fmt(item.price)}</span></div>
            <p>{item.productName} <span>·</span> {item.colorName}</p>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function Collection() {
  const { store, featured = [], categories } = useStore();
  const [filter, setFilter] = useState('');
  useTitle(`مجموعة الأسماء — ${store.name}`);
  const visible = featured.filter((item) => !filter || item.slug === filter);
  return (
    <section className="wrap browse-page">
      <Link className="crumb" to="/">الرئيسية <Icon name="back" size={15} /></Link>
      <header className="page-heading">
        <h1>مجموعة الأسماء</h1>
        <p>أسماء الصحابة رضي الله عنهم في طبعات خطّية على التيشيرت والهودي. اختر تصميمًا لتجرّبه بمقاسك.</p>
      </header>
      {featured.length ? <>
        <div className="filter-row" aria-label="تصفية حسب نوع القطعة">
          <button aria-pressed={!filter} onClick={() => setFilter('')}>الكل</button>
          {categories.filter((c) => featured.some((item) => item.slug === c.slug)).map((c) => (
            <button key={c.id} aria-pressed={filter === c.slug} onClick={() => setFilter(c.slug)}>{c.name}</button>
          ))}
        </div>
        <PrintGrid items={visible} />
      </> : <Empty title="نجهّز طبعات المجموعة"><Link className="link" to="/design">تصفّح القطع المتاحة</Link></Empty>}
    </section>
  );
}
