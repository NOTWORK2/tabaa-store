import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import '@fontsource/ibm-plex-sans-arabic/400.css';
import '@fontsource/ibm-plex-sans-arabic/500.css';
import '@fontsource/ibm-plex-sans-arabic/600.css';
import '@fontsource/ibm-plex-sans-arabic/700.css';
import '@fontsource-variable/alexandria';
import '@fontsource/aref-ruqaa/arabic-700.css';
import './styles.css';
import './store/storefront.css';
import { ToastProvider, Spinner } from './ui.jsx';
import StoreLayout from './store/StoreLayout.jsx';
import { Home, Pick } from './store/Home.jsx';
import { Collection } from './store/Collection.jsx';
import Help from './store/Help.jsx';
import Studio from './store/Studio.jsx';
import { Cart, Checkout, OrderDone, NotFound } from './store/Cart.jsx';

// لوحة الإدارة تُحمَّل عند الحاجة فقط حتى تبقى واجهة الزبون خفيفة
const Admin = lazy(() => import('./admin/AdminApp.jsx'));

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <Routes>
          <Route path="/admin/*" element={<Suspense fallback={<Spinner />}><Admin /></Suspense>} />
          <Route element={<StoreLayout />}>
            <Route index element={<Home />} />
            <Route path="collection" element={<Collection />} />
            <Route path="help" element={<Help />} />
            <Route path="help/:topic" element={<Help />} />
            <Route path="design" element={<Pick />} />
            <Route path="design/:slug" element={<Studio />} />
            <Route path="cart" element={<Cart />} />
            <Route path="checkout" element={<Checkout />} />
            <Route path="order/:number" element={<OrderDone />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
);
