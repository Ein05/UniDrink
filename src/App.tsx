import React, { useState, createContext, useContext, useEffect, type FormEvent } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Coffee, ShoppingCart, User, Globe, Menu as MenuIcon, X, Plus, Minus, 
  Trash2, CheckCircle, ArrowRight, ChevronRight, Search, Filter, 
  GlassWater as Tea, CupSoda, Cookie, Heart, Sparkles, ShoppingBag,
  ArrowUp, ArrowDown 
} from 'lucide-react';
import { translations } from './translations';
import { useCart } from './hooks/useCart';
import { cn, formatCurrency } from './lib/utils';
import { supabase } from './lib/supabase';
import type { Language, Product, Order } from './types';

import { format } from 'date-fns';

// Context
interface AppContextType {
  lang: Language;
  setLang: (l: Language) => void;
  t: typeof translations.VI;
  cart: ReturnType<typeof useCart>;
}

const AppContext = createContext<AppContextType | null>(null);

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};

// Components
const Header = () => {
  const { lang, setLang, t, cart } = useApp();
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header 
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300 px-4 py-4 md:px-10",
        isScrolled ? "bg-brand-beige/90 backdrop-blur-md border-b border-brand-muted/10 shadow-sm" : "bg-brand-beige/50 backdrop-blur-sm"
      )}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 bg-brand-brown rounded-xl flex items-center justify-center text-white">
            <Coffee className="w-6 h-6 stroke-[2]" />
          </div>
          <h1 className="text-4xl font-serif font-black text-brand-brown italic tracking-tight">
            UniDrink
          </h1>
        </Link>

        <div className="flex items-center gap-6">
          <div className="flex border border-brand-beige rounded-lg overflow-hidden">
            <button 
              onClick={() => setLang('VI')}
              className={cn(
                "px-4 py-1.5 text-xs font-bold transition-all", 
                lang === 'VI' ? "bg-brand-brown text-white" : "bg-white text-brand-muted hover:bg-brand-cream"
              )}
            >VI</button>
            <button 
              onClick={() => setLang('EN')}
              className={cn(
                "px-4 py-1.5 text-xs font-bold transition-all", 
                lang === 'EN' ? "bg-brand-brown text-white" : "bg-white text-brand-muted hover:bg-brand-cream"
              )}
            >EN</button>
          </div>

          <Link to="/cart" className="relative p-2 text-brand-ink hover:text-brand-brown transition-colors">
            <ShoppingCart className="w-6 h-6 stroke-[1.5]" />
            {cart.items.length > 0 && (
              <span className="absolute top-0 right-0 w-4 h-4 bg-brand-caramel text-white text-[10px] flex items-center justify-center rounded-full font-bold">
                {cart.items.length}
              </span>
            )}
          </Link>

          <Link to="/admin" className="p-2 text-brand-ink hover:text-brand-brown transition-colors">
            <User className="w-6 h-6 stroke-[1.5]" />
          </Link>
        </div>
      </div>
    </header>
  );
};

const Footer = () => {
  const { t } = useApp();
  return (
    <footer className="mt-20 bg-brand-brown py-12 px-10 text-white">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
        <div className="text-center md:text-left">
          <h2 className="text-2xl font-serif font-bold mb-2">UniDrink.</h2>
          <p className="text-[10px] text-white/60 tracking-wider uppercase">© 2024 UNIDRINK - UNIVERSITY CAMPUS ORDERING</p>
        </div>
        <div className="flex gap-8 text-[10px] text-white/60 tracking-widest uppercase font-bold">
          <a href="#" className="hover:text-white transition-colors">Điều khoản</a>
          <a href="#" className="hover:text-white transition-colors">Bảo mật</a>
          <Link to="/admin" className="text-white border-b border-brand-caramel pb-1">ADMIN PORTAL</Link>
        </div>
      </div>
    </footer>
  );
};

// Pages
const categories = [
  { id: 'all' },
  { id: 'teaMilk' },
  { id: 'coffee' },
  { id: 'juice' },
  { id: 'tea' },
  { id: 'smoothie' },
];

interface ProductCardProps {
  product: Product;
}

const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const { lang, t, cart } = useApp();
  const [isAdded, setIsAdded] = useState(false);

  useEffect(() => {
    if (!isAdded) return;
    const timeout = setTimeout(() => setIsAdded(false), 1500);
    return () => clearTimeout(timeout);
  }, [isAdded]);

  const handleAdd = () => {
    cart.addToCart(product);
    setIsAdded(true);
  };

  const name = lang === 'EN' ? product.name_en || product.name : product.name;
  const desc = lang === 'EN' ? product.description_en || product.description : product.description;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="group bg-white p-4 rounded-[1.5rem] shadow-sm border border-brand-beige/50 hover:shadow-md transition-all flex items-center gap-4 relative"
    >
      <div className="w-24 h-24 bg-[#F8F7F4] rounded-2xl flex items-center justify-center text-3xl shrink-0">
        {product.image_url ? (
          <img src={product.image_url} alt={name} className="w-full h-full object-cover rounded-2xl" />
        ) : (
          <span>{product.emoji || '☕'}</span>
        )}
      </div>

      <div className="flex flex-col justify-between py-1 grow">
        <div className="flex justify-between items-start">
          <h3 className="font-serif italic font-extrabold text-[#2D1B14] text-xl leading-tight">{name}</h3>
          <span className="text-[#2D1B14] font-bold text-sm">
            {formatCurrency(product.price).replace('₫', '').trim().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}₫
          </span>
        </div>
        
        <p className="text-xs text-brand-muted font-serif italic line-clamp-2 pr-8 leading-relaxed mt-1">
          {desc}
        </p>
      </div>

      <button
        onClick={handleAdd}
        disabled={!product.is_available}
        className={cn(
          "absolute bottom-4 right-4 w-8 h-8 rounded-full flex items-center justify-center transition-all",
          isAdded 
            ? "bg-green-500 text-white" 
            : "bg-brand-beige/50 text-brand-brown hover:bg-brand-brown hover:text-white"
        )}
      >
        <Plus className="w-4 h-4" />
      </button>

      {!product.is_available && (
        <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] rounded-[1.5rem] flex items-center justify-center">
          <span className="text-[10px] font-black uppercase tracking-widest text-brand-muted">{t.unavailable}</span>
        </div>
      )}
    </motion.div>
  );
};

const Home = () => {
  const { lang, t } = useApp();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'price_asc' | 'price_desc'>('price_asc');

  const [errorStatus, setErrorStatus] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProducts() {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_available', true)
        .eq('is_deleted', false)
        .order('price', { ascending: sortBy === 'price_asc' });
      
      if (error) {
        setErrorStatus(error.message);
      } else if (data) {
        setProducts(data);
      }
      setLoading(false);
    }
    fetchProducts();
  }, [sortBy]);

  const filteredProducts = products
    .filter(p => {
      const matchesCategory = activeCategory === 'all' || p.category === activeCategory;
      const name = lang === 'EN' ? (p.name_en || p.name) : p.name;
      const matchesSearch = name.toLowerCase().includes(search.toLowerCase());
      return matchesCategory && matchesSearch;
    })
    .sort((a, b) => {
      if (sortBy === 'price_asc') return a.price - b.price;
      if (sortBy === 'price_desc') return b.price - a.price;
      return 0;
    });

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
            {t.error || "Có lỗi xảy ra: "} {errorStatus}
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
          className="flex items-center gap-10 bg-white border border-brand-beige rounded-2xl px-8 py-4 shadow-sm group hover:border-brand-brown transition-all w-full md:w-auto"
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
      <section className="flex flex-wrap gap-4 justify-center px-4">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={cn(
              "px-10 py-3 rounded-full text-sm font-bold transition-all border",
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
const CartPage = () => {
  const { t, cart, lang } = useApp();
  const navigate = useNavigate();

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="max-w-4xl mx-auto flex flex-col lg:flex-row gap-10"
    >
      <div className="flex-1 space-y-8">
        <div className="flex items-center gap-4">
          <h2 className="text-4xl font-serif text-brand-ink">Giỏ hàng.</h2>
          <span className="text-xs text-brand-muted uppercase tracking-[0.2em] font-bold">
            {cart.items.length} Món
          </span>
        </div>

        {cart.items.length === 0 ? (
          <div className="bg-white rounded-[2.5rem] p-12 text-center border border-brand-beige space-y-6">
            <div className="bg-brand-cream w-20 h-20 rounded-full flex items-center justify-center mx-auto text-3xl">
              🛒
            </div>
            <p className="text-xl font-serif italic text-brand-muted">{t.emptyCart}</p>
            <Link to="/" className="inline-flex items-center gap-2 bg-brand-brown text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:scale-[1.02] transition-all">
              {t.menu} <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-[2.5rem] overflow-hidden border border-brand-beige shadow-sm">
            {cart.items.map((item) => (
              <div key={item.id} className="p-6 flex items-center gap-5 border-b border-brand-beige last:border-0 hover:bg-brand-cream/30 transition-colors">
                <div className="w-20 h-20 bg-brand-cream rounded-2xl flex items-center justify-center text-3xl shrink-0 group">
                  <span className="group-hover:scale-110 transition-transform">{item.emoji || '☕'}</span>
                </div>
                <div className="grow">
                  <h3 className="font-bold text-brand-ink uppercase tracking-tight text-lg leading-tight">
                    {lang === 'EN' ? item.name_en || item.name : item.name}
                  </h3>
                  <p className="text-brand-brown font-black font-sans">{formatCurrency(item.price)}</p>
                </div>
                <div className="flex items-center gap-4 bg-brand-beige/30 p-1.5 rounded-xl border border-brand-beige">
                  <button 
                    onClick={() => cart.updateQuantity(item.id, item.quantity - 1)}
                    className="p-1 hover:text-brand-brown transition-colors"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="font-black w-6 text-center text-sm">{item.quantity}</span>
                  <button 
                    onClick={() => cart.updateQuantity(item.id, item.quantity + 1)}
                    className="p-1 hover:text-brand-brown transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <button 
                  onClick={() => cart.removeFromCart(item.id)}
                  className="p-2 text-brand-muted hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-5 h-5 stroke-[1.5]" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {cart.items.length > 0 && (
        <aside className="w-full lg:w-96 space-y-6">
          <div className="bg-white rounded-[2.5rem] border border-brand-beige p-8 shadow-xl flex flex-col h-fit sticky top-32">
            <h3 className="font-serif text-2xl font-bold mb-8 text-brand-ink">Tổng đơn hàng</h3>
            
            <div className="space-y-4 mb-8">
              <div className="flex justify-between items-center text-sm">
                <span className="text-brand-muted font-medium">Tạm tính</span>
                <span className="font-black text-brand-ink">{formatCurrency(cart.total)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-brand-muted font-medium">Phí giao hàng</span>
                <span className="font-black text-green-600 uppercase tracking-widest text-[10px]">Freesize</span>
              </div>
              <div className="h-px bg-brand-beige my-4"></div>
              <div className="flex justify-between items-baseline">
                <span className="text-brand-muted uppercase font-black text-xs tracking-widest tracking-tighter">Tổng cộng</span>
                <span className="text-3xl font-serif font-black text-brand-brown">{formatCurrency(cart.total)}</span>
              </div>
            </div>

            <div className="bg-brand-cream p-4 rounded-2xl mb-8 border border-brand-beige">
              <p className="text-[10px] text-brand-muted uppercase font-black tracking-widest mb-2">Miễn phí vận chuyển</p>
              <p className="text-xs text-brand-ink leading-relaxed">Áp dụng cho mọi đơn hàng đặt trực tiếp qua UniDrink Portal.</p>
            </div>

            <button 
              onClick={() => navigate('/checkout')}
              className="w-full py-5 bg-brand-brown text-white rounded-2xl font-black uppercase tracking-[0.2em] text-xs shadow-lg shadow-brand-brown/20 hover:scale-[1.02] active:scale-95 transition-all"
            >
              THANH TOÁN • {formatCurrency(cart.total)}
            </button>
          </div>
        </aside>
      )}
    </motion.div>
  );
};


const Checkout = () => {
  const { t, cart, lang } = useApp();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successCode, setSuccessCode] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    note: '',
    paymentMethod: 'cash' as 'cash' | 'transfer'
  });

  if (cart.items.length === 0 && !successCode) {
    return <Home />;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      const { data, error } = await supabase.rpc('create_order_with_items', {
        p_customer_name: formData.name,
        p_customer_phone: formData.phone,
        p_address: formData.address,
        p_note: formData.note,
        p_payment_method: formData.paymentMethod,
        p_items: cart.items.map(item => ({ id: item.id, quantity: item.quantity }))
      });

      if (error) throw error;
      
      setSuccessCode(data as string);
      cart.clearCart();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg("Ordering failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (successCode) {
    return (
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="max-w-md mx-auto text-center space-y-8 pt-12"
      >
        <div className="bg-green-100 text-green-600 w-24 h-24 rounded-full flex items-center justify-center mx-auto shadow-sm">
          <CheckCircle className="w-12 h-12" />
        </div>
        <div className="space-y-4">
          <h2 className="text-4xl font-serif text-brand-ink">Đặt hàng thành công.</h2>
          <div className="bg-brand-cream px-8 py-6 rounded-[2rem] inline-block border-2 border-dashed border-brand-beige">
            <p className="text-brand-muted uppercase font-black text-[10px] tracking-[0.2em] mb-2">{t.orderCode}</p>
            <p className="text-3xl font-black text-brand-brown font-sans">{successCode}</p>
          </div>
        </div>
        <p className="text-brand-muted font-medium italic font-serif">Nhân viên sẽ liên hệ với bạn trong ít phút để sẵn sàng giao hàng.</p>
        <Link to="/" className="inline-flex items-center gap-2 bg-brand-brown text-white px-10 py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-xs hover:scale-105 transition-all shadow-xl shadow-brand-brown/20">
          {t.backToHome}
        </Link>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-5xl mx-auto flex flex-col lg:flex-row gap-16"
    >
      <div className="flex-1 space-y-10">
        <div className="flex items-center gap-4">
          <h2 className="text-4xl font-serif text-brand-ink">Thanh toán.</h2>
        </div>

        {errorMsg && (
          <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-sm font-bold border border-red-100">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-black text-brand-muted tracking-[0.2em] ml-2">{t.name}</label>
              <input 
                required
                className="w-full bg-white border border-brand-beige rounded-2xl px-6 py-4 focus:ring-2 focus:ring-brand-caramel outline-none font-medium text-brand-ink transition-all"
                placeholder="Ex: Nguyễn Văn A"
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-black text-brand-muted tracking-[0.2em] ml-2">{t.phone}</label>
              <input 
                required
                type="tel"
                className="w-full bg-white border border-brand-beige rounded-2xl px-6 py-4 focus:ring-2 focus:ring-brand-caramel outline-none font-medium text-brand-ink transition-all"
                placeholder="Ex: 0912345678"
                value={formData.phone}
                onChange={e => setFormData({...formData, phone: e.target.value})}
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="text-[10px] uppercase font-black text-brand-muted tracking-[0.2em] ml-2">{t.address}</label>
            <input 
              required
              className="w-full bg-white border border-brand-beige rounded-2xl px-6 py-4 focus:ring-2 focus:ring-brand-caramel outline-none font-medium text-brand-ink transition-all"
              placeholder="Ex: Phòng 502, Tòa A1, Khoa CNTT"
              value={formData.address}
              onChange={e => setFormData({...formData, address: e.target.value})}
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] uppercase font-black text-brand-muted tracking-[0.2em] ml-2">{t.note}</label>
            <textarea 
              className="w-full bg-white border border-brand-beige rounded-2xl px-6 py-4 focus:ring-2 focus:ring-brand-caramel outline-none font-medium text-brand-ink transition-all"
              rows={3}
              placeholder="Ex: Không lấy đá, ship trước 10h..."
              value={formData.note}
              onChange={e => setFormData({...formData, note: e.target.value})}
            />
          </div>

          <div className="space-y-4">
            <label className="text-[10px] uppercase font-black text-brand-muted tracking-[0.2em] ml-2">{t.paymentMethod}</label>
            <div className="grid grid-cols-2 gap-4">
              <button 
                type="button"
                onClick={() => setFormData({...formData, paymentMethod: 'cash'})}
                className={cn(
                  "py-4 rounded-2xl border-2 font-black uppercase tracking-widest text-[10px] transition-all",
                  formData.paymentMethod === 'cash' ? "bg-brand-brown border-brand-brown text-white shadow-md" : "bg-white border-brand-beige text-brand-muted hover:border-brand-brown hover:text-brand-brown"
                )}
              >
                {t.cash}
              </button>
              <button 
                type="button"
                onClick={() => setFormData({...formData, paymentMethod: 'transfer'})}
                className={cn(
                  "py-4 rounded-2xl border-2 font-black uppercase tracking-widest text-[10px] transition-all",
                  formData.paymentMethod === 'transfer' ? "bg-brand-brown border-brand-brown text-white shadow-md" : "bg-white border-brand-beige text-brand-muted hover:border-brand-brown hover:text-brand-brown"
                )}
              >
                {t.transfer}
              </button>
            </div>
          </div>
        </form>
      </div>

      <aside className="w-full lg:w-96">
        <div className="bg-white rounded-[2.5rem] border border-brand-beige p-8 shadow-xl sticky top-32 space-y-8">
          <h3 className="font-serif text-2xl font-bold text-brand-ink">Xác nhận</h3>
          
          <div className="space-y-4">
            {cart.items.map(item => (
              <div key={item.id} className="flex justify-between items-center text-brand-ink">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-brand-cream rounded-xl flex items-center justify-center text-xl shrink-0">
                    {item.emoji || '☕'}
                  </div>
                  <div>
                    <p className="font-bold uppercase tracking-tight text-xs leading-none mb-1">
                      {lang === 'EN' ? item.name_en || item.name : item.name}
                    </p>
                    <p className="text-[10px] text-brand-muted font-bold">x{item.quantity}</p>
                  </div>
                </div>
                <span className="font-black text-sm">{formatCurrency(item.price * item.quantity)}</span>
              </div>
            ))}
          </div>

          <div className="bg-brand-cream p-5 rounded-2xl space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="text-brand-muted font-bold uppercase tracking-widest">Tạm tính</span>
              <span className="font-black text-brand-ink">{formatCurrency(cart.total)}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-brand-muted font-bold uppercase tracking-widest">Phí giao hàng</span>
              <span className="font-black text-green-600">0đ</span>
            </div>
            <div className="h-px bg-brand-beige my-2" />
            <div className="flex justify-between items-baseline">
              <span className="text-[10px] text-brand-muted font-black uppercase tracking-widest leading-none">Tổng cộng</span>
              <span className="text-2xl font-serif font-black text-brand-brown">{formatCurrency(cart.total)}</span>
            </div>
          </div>

          <button 
            onClick={handleSubmit}
            disabled={loading}
            className="w-full py-5 bg-brand-brown text-white rounded-2xl font-black uppercase tracking-[0.2em] text-xs shadow-lg shadow-brand-brown/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center"
          >
            {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : t.placeOrder}
          </button>
        </div>
      </aside>
    </motion.div>
  );
};
const AdminLogin = () => {
  const { t } = useApp();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate('/admin/dashboard');
    });
  }, [navigate]);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setErrorMsg(error.message);
    } else {
      navigate('/admin/dashboard');
    }
    setLoading(false);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="max-w-md mx-auto pt-16 space-y-10"
    >
      <div className="text-center space-y-3">
        <h2 className="text-5xl font-serif text-brand-brown">Admin.</h2>
        <p className="text-brand-muted font-black uppercase text-[10px] tracking-[0.2em]">Cổng quản trị UniDrink</p>
      </div>

      <div className="bg-white rounded-[2.5rem] p-10 shadow-2xl border border-brand-beige">
        {errorMsg && (
          <div className="mb-6 bg-red-50 text-red-600 p-4 rounded-2xl text-sm font-bold border border-red-100 text-center">
            {errorMsg}
          </div>
        )}
        <form onSubmit={handleLogin} className="space-y-8">
          <div className="space-y-2">
            <label className="text-[10px] uppercase font-black text-brand-muted tracking-[0.2em] ml-2">Tài khoản</label>
            <input 
              type="email"
              required
              className="w-full bg-brand-cream border border-brand-beige rounded-2xl px-6 py-4 outline-none font-medium text-brand-ink focus:ring-2 focus:ring-brand-caramel transition-all"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] uppercase font-black text-brand-muted tracking-[0.2em] ml-2">Mật khẩu</label>
            <input 
              type="password"
              required
              className="w-full bg-brand-cream border border-brand-beige rounded-2xl px-6 py-4 outline-none font-medium text-brand-ink focus:ring-2 focus:ring-brand-caramel transition-all"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>
          <button 
            disabled={loading}
            className="w-full bg-brand-brown text-white py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-xs hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-brand-brown/20 disabled:opacity-50"
          >
            {loading ? "..." : "Đăng nhập"}
          </button>
        </form>
      </div>
    </motion.div>
  );
};

const AdminDashboard = () => {
  const { t } = useApp();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/admin');
        return;
      }
      setIsAuthenticated(true);
      fetchOrders();
    };

    const fetchOrders = async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (!error && data) setOrders(data);
      setLoading(false);
    };

    checkAuth();

    const channel = supabase
      .channel('schema-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchOrders)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [navigate]);

  const updateStatus = async (id: string, status: Order['status']) => {
    await supabase.from('orders').update({ status }).eq('id', id);
  };

  const togglePaid = async (id: string, is_paid: boolean) => {
    await supabase.from('orders').update({ is_paid }).eq('id', id);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/admin');
  };

  if (!isAuthenticated || loading) return <div className="text-center py-20 text-[10px] font-black uppercase tracking-[0.3em] text-brand-muted animate-pulse">Loading Portal...</div>;

  const todayRevenue = orders
    .filter(o => o.status === 'done' && o.is_paid && format(new Date(o.created_at), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd'))
    .reduce((acc, o) => acc + o.total_price, 0);

  return (
    <div className="space-y-12 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <h2 className="text-5xl font-serif text-brand-ink">Orders.</h2>
          <p className="text-[10px] text-brand-muted font-black uppercase tracking-[0.2em]">Quản lý vận hành cửa hàng</p>
        </div>
        
        <div className="flex gap-4">
          <div className="bg-brand-cream border border-brand-beige px-8 py-4 rounded-2xl flex flex-col justify-center min-w-[200px]">
            <span className="text-[10px] uppercase font-black tracking-widest text-brand-muted leading-none mb-1">Doanh thu hôm nay</span>
            <span className="text-2xl font-serif font-black text-brand-brown">{formatCurrency(todayRevenue)}</span>
          </div>
          <button 
            onClick={handleLogout} 
            className="px-6 py-4 bg-brand-brown text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg shadow-brand-brown/10"
          >
            Logout
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {orders.map(order => (
          <div key={order.id} className="bg-white rounded-[2.5rem] p-8 border border-brand-beige flex flex-col md:flex-row gap-8 hover:shadow-xl transition-all group">
            <div className="space-y-4 grow">
              <div className="flex items-center gap-4">
                <span className="text-2xl font-black text-brand-brown font-sans tracking-tighter">#{order.order_code}</span>
                <span className={cn(
                  "text-[10px] font-black uppercase px-4 py-1 rounded-full border",
                  order.status === 'done' ? "bg-green-50 text-green-700 border-green-200" :
                  order.status === 'cancelled' ? "bg-red-50 text-red-700 border-red-200" :
                  "bg-brand-cream text-brand-brown border-brand-beige"
                )}>
                  {t[`status${order.status.charAt(0).toUpperCase() + order.status.slice(1)}` as keyof typeof t]}
                </span>
                {order.is_paid && (
                  <span className="bg-blue-50 text-blue-700 text-[10px] font-black uppercase px-4 py-1 rounded-full border border-blue-200">
                    {t.paid}
                  </span>
                )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-3 text-sm">
                <div className="space-y-1">
                  <p className="text-[10px] text-brand-muted font-black uppercase tracking-widest leading-none">Khách hàng</p>
                  <p className="font-bold text-brand-ink">{order.customer_name} • {order.customer_phone}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-brand-muted font-black uppercase tracking-widest leading-none">Địa chỉ giao hàng</p>
                  <p className="font-bold text-brand-ink">{order.address}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-brand-muted font-black uppercase tracking-widest leading-none">Ghi chú</p>
                  <p className="italic font-serif text-brand-muted">{order.note || 'Không có ghi chú'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-brand-muted font-black uppercase tracking-widest leading-none">Thanh toán</p>
                  <p className="font-black text-brand-brown">{formatCurrency(order.total_price)} ({order.payment_method})</p>
                </div>
              </div>
              
              <p className="text-[10px] text-brand-muted font-bold uppercase tracking-[0.2em] opacity-40">
                {format(new Date(order.created_at), 'HH:mm • dd MMMM, yyyy')}
              </p>
            </div>

            <div className="flex flex-wrap md:flex-col gap-3 justify-center md:items-end md:min-w-[160px]">
              {order.status !== 'done' && order.status !== 'cancelled' && (
                <>
                  <button 
                    onClick={() => updateStatus(order.id, 'processing')}
                    className="bg-brand-caramel text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-brown transition-all grow md:grow-0"
                  >
                    Processing
                  </button>
                  <button 
                    onClick={() => updateStatus(order.id, 'done')}
                    className="bg-brand-brown text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-ink transition-all shadow-lg shadow-brand-brown/20 grow md:grow-0"
                  >
                    Mark Done
                  </button>
                </>
              )}
              {!order.is_paid && order.status !== 'cancelled' && (
                <button 
                  onClick={() => togglePaid(order.id, true)}
                  className="bg-white border-2 border-brand-brown text-brand-brown px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-brown hover:text-white transition-all grow md:grow-0"
                >
                  Confirm Paid
                </button>
              )}
              {order.status === 'pending' && (
                <button 
                  onClick={() => updateStatus(order.id, 'cancelled')}
                  className="bg-transparent text-red-400 hover:text-red-600 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors grow md:grow-0 underline underline-offset-4"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const AnimatedRoutes = () => {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Home />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/admin" element={<AdminLogin />} />
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

  const cart = useCart();

  useEffect(() => {
    localStorage.setItem('unicafe_lang', lang);
  }, [lang]);

  const t = translations[lang];

  return (
    <AppContext.Provider value={{ lang, setLang, t, cart }}>
      <BrowserRouter>
        <div className="min-h-screen flex flex-col">
          <Header />
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 md:px-10 pt-28">
            <AnimatedRoutes />
          </main>
          <Footer />
        </div>
      </BrowserRouter>
    </AppContext.Provider>
  );
}
