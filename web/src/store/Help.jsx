import { Link, useParams } from 'react-router-dom';
import { fmt, useTitle } from '../lib.js';
import { Icon } from '../ui.jsx';
import { useStore } from './StoreLayout.jsx';
import './guide.css';

const topics = {
  faq: { name: 'الأسئلة الشائعة', intro: 'إجابات عن اختيار القطعة ومعاينة طبعتها ومتابعة الطلب.' },
  shipping: { name: 'التوصيل والدفع', intro: 'اختر منطقتك لتعرف تكلفة التوصيل قبل تأكيد الطلب.' },
  returns: { name: 'الإرجاع والاستبدال', intro: 'إذا احتجت إلى إرجاع قطعة أو استبدالها، يمكنك إرسال التفاصيل مباشرةً من طلبك.' },
  privacy: { name: 'سياسة الخصوصية', intro: 'كيف نستخدم البيانات التي تشاركها معنا عند تصميم قطعة وطلبها.' },
  terms: { name: 'شروط الشراء', intro: 'تفاصيل اختيار التصميم وتأكيد السعر وتسجيل طلب الطباعة.' },
};

function Section({ title, children }) {
  return <section className="guide-section"><h2>{title}</h2>{children}</section>;
}

function OrderLink() {
  let order;
  try { order = JSON.parse(localStorage.getItem('tb:lastOrder')); } catch { /* قد يكون تخزين المتصفح معطّلًا */ }
  if (!order?.number || !order.token) return null;
  return (
    <Link className="guide-action" to={`/order/${encodeURIComponent(order.number)}?t=${encodeURIComponent(order.token)}`}>
      افتح آخر طلب على هذا الجهاز <Icon name="back" size={17} />
    </Link>
  );
}

function Shipping({ zones, payments }) {
  return <>
    <Section title="مناطق التوصيل ورسومه">
      {zones.length ? <dl className="guide-rates">{zones.map((zone) => (
        <div key={zone.id}><dt>{zone.name}</dt><dd>{zone.fee === 0 ? 'مجاني' : fmt(zone.fee)}</dd></div>
      ))}</dl> : <p>مناطق التوصيل غير متاحة حاليًا.</p>}
    </Section>
    <Section title="موعد استلام القطعة">
      <p>تمرّ القطعة بمرحلة الطباعة قبل الشحن. يمكنك متابعة حالتها من رابط الطلب، ويستخدم فريق المتجر رقم الهاتف والعنوان اللذين أدخلتهما لتنسيق التسليم.</p>
      <OrderLink />
    </Section>
    <Section title="طرق الدفع المتاحة">
      {payments.length ? <ul className="guide-list">{payments.map((method) => <li key={method.key}>{method.label}</li>)}</ul> : <p>خيارات الدفع غير متاحة حاليًا.</p>}
      <p>يظهر مجموع القطع والطباعة والتوصيل بالدرهم الإماراتي قبل تأكيد الطلب.</p>
    </Section>
  </>;
}

function Returns() {
  return <>
    <Section title="إذا وصلتك قطعة معيبة أو مختلفة">
      <p>إذا وجدت عيبًا في الخياطة أو الطباعة، أو اختلف التصميم أو اللون أو المقاس عمّا اخترته، افتح طلبك وبيّن الفرق. نراجع وصفك مع معاينة القطعة المحفوظة عند الشراء، ثم نتواصل معك لترتيب المعالجة المناسبة، بما فيها الاستبدال أو ردّ الثمن بحسب الحالة.</p>
    </Section>
    <Section title="إرسال طلب الإرجاع أو الاستبدال">
      <ol className="guide-steps">
        <li>افتح الرابط الخاص الذي ظهر لك بعد تأكيد الشراء.</li>
        <li>في قسم «خدمة ما بعد الشراء»، حدّد القطعة والكمية واختر الإرجاع أو الاستبدال. اكتب سبب الطلب، والمقاس المطلوب إذا كان الطلب متعلقًا بالمقاس.</li>
        <li>اضغط «إرسال الطلب». يظهر تأكيد الاستلام في الصفحة نفسها. احتفظ بالقطعة بعبوتها إن أمكن، وانتظر تعليمات الاستلام قبل إرسالها.</li>
      </ol>
      <OrderLink />
    </Section>
    <Section title="تغيير الاختيار">
      <p>نطبع كل قطعة وفق اختياراتك. إذا وافقت القطعة الطلب وأردت لونًا أو مقاسًا مختلفًا، أرسل طلب استبدال وسنراجع الخيارات المتاحة وأي تكلفة معك قبل الاتفاق على الخطوة التالية.</p>
    </Section>
    <p className="guide-reference"><a href="https://u.ae/ar/information-and-services/justice-safety-and-the-law/consumer-protection" target="_blank" rel="noreferrer">حقوق المستهلك في الإمارات</a></p>
  </>;
}

function Privacy({ store }) {
  return <>
    <Section title="بيانات الطلب">
      <p>عند الشراء نسجّل اسمك ورقم هاتفك وعنوانك ومنطقة التوصيل، إلى جانب القطع التي اخترتها والمبلغ وطريقة الدفع وأي ملاحظات أضفتها. نستخدم هذه التفاصيل لتجهيز القطعة وتنسيق التسليم ومعالجة طلبات ما بعد الشراء.</p>
    </Section>
    <Section title="ما يحتفظ به متصفحك">
      <p>يحفظ المتصفح سلتك ورابط آخر طلب لتعود إليهما من الجهاز نفسه. تُحفظ الحقول التي تكتبها عند الدفع خلال جلسة التصفح لتتمكّن من إكمالها، ويُزال نموذجها المحفوظ بعد نجاح الطلب. يمكنك مسح البيانات المحلية من إعدادات المتصفح.</p>
    </Section>
    <Section title="رابط الطلب وخدمات التواصل">
      <p>يفتح رابط التأكيد الخاص تفاصيل القطعة وعنوان التسليم، فاحتفظ به في مكان خاص. إذا اخترت التواصل عبر زر واتساب، تُفتح رسالة بتفاصيل طلبك داخل الخدمة لتراجعها وترسلها بنفسك.</p>
    </Section>
    <Section title="مراجعة بياناتك">
      <p>تجد نسخة من بيانات الشراء في صفحة طلبك. إذا تغيّر عنوانك أو رقمك، أو رغبت في طلب تصحيح بياناتك، أخبر فريق المتجر عند التواصل لتنسيق التسليم.</p>
      {store.email && <a className="guide-action" href={`mailto:${store.email}`}>راسل المتجر <Icon name="back" size={17} /></a>}
      <OrderLink />
    </Section>
    <p className="guide-reference"><a href="https://u.ae/ar/about-the-uae/digital-uae/data/data-protection-laws" target="_blank" rel="noreferrer">حماية البيانات الشخصية في الإمارات</a></p>
  </>;
}

function Terms() {
  return <>
    <Section title="مواصفات القطعة">
      <p>اختر نوع اللباس واللون والمقاس والرسم، ثم راجع المعاينة والكمية. توضح المعاينة موضع الطباعة وشكل التصميم، وقد يتأثر ظهور اللون بإضاءة الشاشة وملمس القماش.</p>
    </Section>
    <Section title="السعر وتأكيد الطلب">
      <p>كل الأسعار بالدرهم الإماراتي. يعرض المتجر سعر القطعة وتكلفة الطباعة، ثم يضيف رسوم منطقتك عند إتمام الطلب. نراجع توفّر المخزون والإجمالي عند التأكيد، ويمكنك مراجعة أي تغيير قبل إعادة الإرسال.</p>
    </Section>
    <Section title="الاستلام والمتابعة">
      <p>أدخل رقم هاتف يمكنك الردّ عليه وعنوانًا يسهّل الوصول إليك. بعد تأكيد الشراء، احتفظ برابط الطلب الخاص للاطّلاع على تفاصيله وحالته أو لتقديم طلب إرجاع أو استبدال.</p>
      <Link className="guide-action" to="/help/returns">اقرأ سياسة الإرجاع والاستبدال <Icon name="back" size={17} /></Link>
    </Section>
  </>;
}

const questions = [
  ['كيف أعاين الطباعة على القطعة؟', <>افتح <Link to="/design">صمّم قطعتك</Link> واختر نوع اللباس واللون والمقاس. عند اختيار الرسم، تظهر الطباعة على القطعة قبل إضافتها إلى السلة.</>],
  ['هل يشمل سعر القطعة الطباعة؟', <>تعرض شاشة التخصيص سعر القطعة وقيمة طباعة الرسم الذي تختاره. يمكنك مراجعة المجموع قبل الإضافة إلى السلة، ثم تظهر رسوم التوصيل بعد تحديد منطقتك.</>],
  ['أين أجد رسوم التوصيل وطرق الدفع؟', <>تجد المناطق المتاحة ورسوم كل منطقة وطرق الدفع الحالية في <Link to="/help/shipping">صفحة التوصيل والدفع</Link>.</>],
  ['كيف أتابع طلبي بعد الشراء؟', <>افتح رابط التأكيد الذي ظهر لك عند إتمام الطلب. تجد فيه رقم الطلب وحالته والقطع وعنوان التسليم. <OrderLink /></>],
  ['وصلتني قطعة غير مطابقة. ماذا أفعل؟', <>افتح طلبك واختر القطعة من «خدمة ما بعد الشراء». اكتب ما اختلف عن المعاينة أو المواصفات وأرسل الطلب للمراجعة. تجد الخطوات في <Link to="/help/returns">سياسة الإرجاع والاستبدال</Link>.</>],
];

function Faq() {
  return <div className="guide-faq">{questions.map(([question, answer]) => (
    <details key={question}><summary>{question}<Icon name="plus" size={18} /></summary><div>{answer}</div></details>
  ))}</div>;
}

export default function Help() {
  const { topic = 'faq' } = useParams();
  const { store, zones, payments } = useStore();
  const page = Object.hasOwn(topics, topic) ? topics[topic] : null;
  useTitle(`${page?.name || 'الصفحة غير موجودة'} — ${store.name}`);
  if (!page) return <div className="wrap section"><h1 className="h2">الصفحة غير موجودة</h1><Link className="guide-action" to="/help">العودة إلى دليل المتجر <Icon name="back" size={17} /></Link></div>;
  return <div className="wrap guide">
    <nav className="guide-breadcrumb" aria-label="مسار الصفحة"><Link to="/">الرئيسية</Link><span aria-hidden="true">/</span><Link to="/help">دليل المتجر</Link></nav>
    <div className="guide-layout">
      <nav className="guide-nav" aria-label="أقسام دليل المتجر">
        {Object.entries(topics).map(([slug, info]) => (
          <Link key={slug} to={`/help/${slug}`} aria-current={slug === topic ? 'page' : undefined}>{info.name}<Icon name="back" size={16} /></Link>
        ))}
      </nav>
      <article className="guide-article">
        <header><h1>{page.name}</h1><p>{page.intro}</p></header>
        {topic === 'faq' && <Faq />}
        {topic === 'shipping' && <Shipping zones={zones} payments={payments} />}
        {topic === 'returns' && <Returns />}
        {topic === 'privacy' && <Privacy store={store} />}
        {topic === 'terms' && <Terms />}
      </article>
    </div>
  </div>;
}
