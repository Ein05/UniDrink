import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, CupSoda, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '../lib/utils';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import ProductCard from '../components/ProductCard';
import type { Product } from '../types';

const categories = [
  { id: 'all' },
  { id: 'teaMilk' },
  { id: 'coffee' },
  { id: 'juice' },
  { id: 'tea' },
  { id: 'smoothie' },
];

const Home = () => {
  const { lang, t } = useApp();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'price_asc' | 'price_desc'>('price_asc');
  const [errorStatus, setErrorStatus] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);

    async function fetchProducts() {
      try {
        const { data, error } = await supabase
          .from('products')
          // FIX #4: bỏ filter is_available để hiển thị overlay "hết hàng" đúng nghiệp vụ
          .select('*')
          .eq('is_deleted', false);

        if (error) {
          setErrorStatus(error.message);
        } else if (data) {
          setProducts(data);
          setErrorStatus(null);
        }
      } finally {
        setLoading(false);
      }
    }
    fetchProducts();
  }, []);

  // Filter and sort client-side instantly
  const filteredProducts = useMemo(() => {
    const filtered = products.filter(p => {
      const matchesCategory = activeCategory === 'all' || p.category === activeCategory;
      const name = lang === 'EN' ? (p.name_en || p.name) : p.name;
      const matchesSearch = name.toLowerCase().includes(search.toLowerCase());
      return matchesCategory && matchesSearch;
    });

    return [...filtered].sort((a, b) => {
      return sortBy === 'price_asc' ? a.price - b.price : b.price - a.price;
    });
  }, [products, activeCategory, search, sortBy, lang]);

  if (loading) {
    return (
      <div id="loading-state" className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-12 h-12 border-4 border-brand-beige border-t-brand-brown rounded-full animate-spin" />
        <p className="font-serif italic text-brand-muted uppercase text-xs tracking-widest">UniDrink is preparing...</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="space-y-16"
    >
      {errorStatus && (
        <div className="max-w-4xl mx-auto px-4">
          <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-sm font-bold border border-red-100 text-center">
          {t.error} {errorStatus}
          </div>
        </div>
      )}

      {/* Search & Sort Bar */}
      <section className="max-w-4xl mx-auto flex flex-col md:flex-row items-center gap-4 px-4">
        <div className="relative grow w-full">
          <div className="absolute left-6 top-1/2 -translate-y-1/2 text-brand-muted">
            <Search className="w-6 h-6 stroke-[1.5]" />
          </div>
          <input
            type="text"
            placeholder={t.searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white border border-brand-beige rounded-full pl-16 pr-8 py-4 outline-none focus:border-brand-brown/30 text-lg font-medium shadow-sm transition-all placeholder:text-brand-muted/50"
          />
        </div>

        <button
          onClick={() => setSortBy(prev => prev === 'price_asc' ? 'price_desc' : 'price_asc')}
          className="flex items-center justify-between md:justify-start gap-4 md:gap-10 bg-white border border-brand-beige rounded-2xl px-6 md:px-8 py-3 md:py-4 shadow-sm group hover:border-brand-brown transition-all w-full md:w-auto"
        >
          <span className="text-[10px] font-black uppercase tracking-widest text-[#2D1B14] group-hover:text-brand-brown">
            {t.priceLabel}
          </span>
          <div className="flex items-center gap-3 text-brand-brown">
            {sortBy === 'price_asc' ? (
              <>
                <ArrowUp className="w-5 h-5 stroke-[2.5]" />
                <span className="text-xs font-black uppercase tracking-widest leading-none">{t.sortAsc}</span>
              </>
            ) : (
              <>
                <ArrowDown className="w-5 h-5 stroke-[2.5]" />
                <span className="text-xs font-black uppercase tracking-widest leading-none">{t.sortDesc}</span>
              </>
            )}
          </div>
        </button>
      </section>

      {/* Categories */}
      <section className="flex flex-wrap gap-2 md:gap-4 justify-center px-2 md:px-4">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={cn(
              "px-6 py-2 md:px-10 md:py-3 rounded-full text-xs md:text-sm font-bold transition-all border",
              activeCategory === cat.id
                ? "bg-brand-brown text-white border-brand-brown shadow-xl shadow-brand-brown/10"
                : "bg-white border-brand-beige text-[#2D1B14] hover:bg-brand-cream"
            )}
          >
            {t[`category${cat.id.charAt(0).toUpperCase() + cat.id.slice(1)}` as keyof typeof t]}
          </button>
        ))}
      </section>

      {/* Grid */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-6xl mx-auto">
        <AnimatePresence mode="popLayout">
          {filteredProducts.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </AnimatePresence>
      </section>

      {filteredProducts.length === 0 && (
        <div className="py-20 text-center space-y-4">
          <div className="bg-brand-beige/50 w-20 h-20 rounded-full flex items-center justify-center mx-auto">
            <CupSoda className="w-10 h-10 text-brand-muted opacity-20" />
          </div>
          <p className="text-brand-muted font-bold uppercase tracking-[0.2em] text-[10px]">No signature drinks found</p>
        </div>
      )}
    </motion.div>
  );
};

export default Home;
