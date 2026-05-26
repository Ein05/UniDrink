import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'motion/react';

import { AppContext } from './context/AppContext';
import { translations } from './translations';
import { useCart } from './hooks/useCart';
import type { Language, Product } from './types';

import Header from './components/Header';
import Footer from './components/Footer';
import Home from './pages/Home';
import CartPage from './pages/CartPage';
import Checkout from './pages/Checkout';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import TrackOrder from './pages/TrackOrder';

const AnimatedRoutes = () => {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location}>
        <Route path="/" element={<Home />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/track" element={<TrackOrder />} />
        <Route path="/login" element={<Login />} />
        <Route path="/admin" element={<Login />} />
        <Route path="/admin/dashboard/*" element={<AdminDashboard />} />
      </Routes>
    </AnimatePresence>
  );
};

export default function App() {
  const [lang, setLang] = useState<Language>(() => {
    const saved = localStorage.getItem('unicafe_lang');
    return (saved as Language) || 'VI';
  });

  const [products, setProducts] = useState<Product[]>(() => {
    const saved = localStorage.getItem('unidrink_products');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [productsLoaded, setProductsLoaded] = useState(() => {
    return localStorage.getItem('unidrink_products') !== null;
  });

  const cart = useCart();

  useEffect(() => {
    localStorage.setItem('unicafe_lang', lang);
  }, [lang]);

  const t = translations[lang];

  return (
    <BrowserRouter>
      <AppContext.Provider value={{
        lang,
        setLang,
        t,
        cart,
        products,
        setProducts,
        productsLoaded,
        setProductsLoaded
      }}>
        <div className="min-h-screen flex flex-col">
          <Header />
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 md:px-10 pt-28">
            <AnimatedRoutes />
          </main>
          <Footer />
        </div>
      </AppContext.Provider>
    </BrowserRouter>
  );
}
