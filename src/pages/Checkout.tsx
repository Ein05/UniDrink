import React, { useState, useRef, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { CheckCircle } from 'lucide-react';
import { cn, formatCurrency, normalizePhone } from '../lib/utils';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';

const Checkout = () => {
  const { t, cart, lang } = useApp();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successCode, setSuccessCode] = useState<string | null>(null);
  const [orderTotal, setOrderTotal] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    note: '',
    paymentMethod: 'cash' as 'cash' | 'transfer',
  });
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);

  React.useEffect(() => {
    let resolved = false;

    // Cooldown timeout 4s để giải phóng màn hình loading nếu Supabase phản hồi chậm
    const timeout = setTimeout(() => {
      if (!resolved) {
        console.warn('[UniDrink] Session check timed out, continuing with null session.');
        setAuthLoading(false);
      }
    }, 4000);

    supabase.auth.getSession().then(({ data: { session } }) => {
      resolved = true;
      clearTimeout(timeout);
      setSession(session);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      resolved = true;
      clearTimeout(timeout);
      setSession(session);
      setAuthLoading(false);
    });

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setErrorMsg(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/checkout',
      }
    });
    if (error) {
      setErrorMsg(error.message);
      setLoading(false);
    }
  };

  // Ưu tiên show loading trước khi redirect để tránh race condition
  if (authLoading) {
    return (
      <div className="text-center py-20 text-[10px] font-black uppercase tracking-[0.3em] text-brand-muted animate-pulse">
        {lang === 'EN' ? 'Verifying Session...' : 'Đang xác thực phiên...'}
      </div>
    );
  }

  // FIX #1: dùng Navigate thay vì render <Home /> trong layout sai
  if (cart.items.length === 0 && !successCode) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // Rate limit cooldown (60 seconds)
    const lastOrderTime = localStorage.getItem('last_order_time');
    if (lastOrderTime) {
      const diff = Date.now() - parseInt(lastOrderTime, 10);
      if (diff < 60000) {
        setErrorMsg(t.orderCooldown);
        return;
      }
    }

    // FIX #6: validate số điện thoại VN (10 số, bắt đầu bằng 0)
    const normalizedPhone = normalizePhone(formData.phone);
    if (!/^0\d{9}$/.test(normalizedPhone)) {
      setErrorMsg(t.invalidPhone);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await (supabase as any).rpc('create_order_with_items', {
        p_customer_name: formData.name.trim(),
        p_customer_phone: normalizedPhone,
        p_address: formData.address.trim(),
        p_note: formData.note.trim(),
        p_payment_method: formData.paymentMethod,
        p_customer_email: session?.user?.email || '',
        p_items: cart.items.map(item => ({ id: item.id, quantity: item.quantity })),
      });

      if (error) throw error;

      // Save order time to prevent spam
      localStorage.setItem('last_order_time', Date.now().toString());

      setOrderTotal(cart.total);
      setSuccessCode(data as string);
      cart.clearCart();
    } catch (err: any) {
      console.error('Order creation error:', err);
      const msg = err?.message || (err instanceof Error ? err.message : null) || t.orderFailed;
      setErrorMsg(msg);
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
          <h2 className="text-3xl md:text-4xl font-serif text-brand-ink">{t.orderSuccess}</h2>
          <div className="bg-brand-cream px-8 py-6 rounded-[2rem] inline-block border-2 border-dashed border-brand-beige">
            <p className="text-brand-muted uppercase font-black text-[10px] tracking-[0.2em] mb-2">{t.orderCode}</p>
            <p className="text-3xl font-black text-brand-brown font-sans">#{successCode}</p>
          </div>
        </div>

        {formData.paymentMethod === 'transfer' && (
          <div className="space-y-4 py-4 animate-in fade-in zoom-in duration-500">
            <p className="text-brand-ink font-bold font-sans">{t.scanToPay}</p>
            <div className="bg-white p-4 rounded-3xl inline-block border-2 border-brand-caramel shadow-lg shadow-brand-caramel/20">
              <img
                src={`https://img.vietqr.io/image/${import.meta.env.VITE_BANK_ID || 'BIDV'}-${import.meta.env.VITE_BANK_ACCOUNT || '8843962433'}-compact.png?amount=${orderTotal}&addInfo=${successCode}&accountName=${encodeURIComponent(import.meta.env.VITE_BANK_ACCOUNT_NAME || 'VU DUC ANH')}`}
                alt="VietQR Code"
                className="w-48 h-48 md:w-56 md:h-56 object-cover rounded-2xl mx-auto"
              />
            </div>
            <p className="text-xs text-brand-muted font-bold">{t.transferNote} <span className="text-brand-brown font-black">{successCode}</span></p>
          </div>
        )}

        <p className="text-brand-muted font-medium italic font-serif text-sm">
          {formData.paymentMethod === 'cash'
            ? t.cashInstructions
            : t.transferInstructions}
        </p>
        <Link to="/" className="inline-flex items-center gap-2 bg-brand-brown text-white px-10 py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-xs hover:scale-105 transition-all shadow-xl shadow-brand-brown/20">
          {t.backToHome}
        </Link>
      </motion.div>
    );
  }


  if (!session) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md mx-auto text-center space-y-8 pt-12"
      >
        <div className="bg-brand-cream border border-brand-beige rounded-[2.5rem] p-10 shadow-xl space-y-6">
          <div className="w-16 h-16 bg-white border border-brand-beige rounded-2xl flex items-center justify-center mx-auto text-3xl shadow-sm">
            🎓
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-serif font-black text-brand-ink">
              {lang === 'EN' ? 'Phenikaa Campus Auth' : 'Xác thực sinh viên'}
            </h2>
            <p className="text-xs text-brand-muted font-medium leading-relaxed font-sans px-4">
              {t.googleLoginRequired}
            </p>
          </div>
          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full py-4 bg-white border border-brand-beige hover:border-brand-brown text-brand-ink rounded-2xl font-black uppercase tracking-wider text-xs shadow-md transition-all flex items-center justify-center gap-3"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-brand-muted/30 border-t-brand-brown rounded-full animate-spin" />
            ) : (
              <>
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
                </svg>
                {t.signInWithGoogle}
              </>
            )}
          </button>
        </div>
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
        <h2 className="text-3xl md:text-4xl font-serif text-brand-ink">{t.checkoutTitle}</h2>

        {errorMsg && (
          <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-sm font-bold border border-red-100">
            {errorMsg}
          </div>
        )}

        <form ref={formRef} onSubmit={handleSubmit} className="space-y-8">
          <div className="space-y-2">
            <label className="text-[10px] uppercase font-black text-brand-muted tracking-[0.2em] ml-2">{t.emailLabel}</label>
            <input
              disabled
              className="w-full bg-[#FAF9F5] border border-brand-beige rounded-2xl px-6 py-4 outline-none font-medium text-brand-muted cursor-not-allowed opacity-80"
              value={session?.user?.email || ''}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-black text-brand-muted tracking-[0.2em] ml-2">{t.name}</label>
              <input
                required
                className="w-full bg-white border border-brand-beige rounded-2xl px-6 py-4 focus:ring-2 focus:ring-brand-caramel outline-none font-medium text-brand-ink transition-all"
                placeholder={lang === 'EN' ? "Ex: John Doe" : "Ex: Nguyễn Văn A"}
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-black text-brand-muted tracking-[0.2em] ml-2">{t.phone}</label>
              <input
                required
                type="tel"
                minLength={10}
                maxLength={11}
                className="w-full bg-white border border-brand-beige rounded-2xl px-6 py-4 focus:ring-2 focus:ring-brand-caramel outline-none font-medium text-brand-ink transition-all"
                placeholder="Ex: 0912345678"
                value={formData.phone}
                onChange={e => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 11);
                  setFormData({ ...formData, phone: val });
                }}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] uppercase font-black text-brand-muted tracking-[0.2em] ml-2">{t.address}</label>
            <input
              required
              className="w-full bg-white border border-brand-beige rounded-2xl px-6 py-4 focus:ring-2 focus:ring-brand-caramel outline-none font-medium text-brand-ink transition-all"
              placeholder={lang === 'EN' ? "Ex: Room 502, Building A1, Dept of IT" : "Ex: Phòng 502, Tòa A1, Khoa CNTT"}
              value={formData.address}
              onChange={e => setFormData({ ...formData, address: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] uppercase font-black text-brand-muted tracking-[0.2em] ml-2">{t.note}</label>
            <textarea
              className="w-full bg-white border border-brand-beige rounded-2xl px-6 py-4 focus:ring-2 focus:ring-brand-caramel outline-none font-medium text-brand-ink transition-all"
              rows={3}
              placeholder={lang === 'EN' ? "Ex: No ice, deliver before 10 AM..." : "Ex: Không lấy đá, ship trước 10h..."}
              value={formData.note}
              onChange={e => setFormData({ ...formData, note: e.target.value })}
            />
          </div>

          <div className="space-y-4">
            <label className="text-[10px] uppercase font-black text-brand-muted tracking-[0.2em] ml-2">{t.paymentMethod}</label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, paymentMethod: 'cash' })}
                className={cn(
                  "py-4 rounded-2xl border-2 font-black uppercase tracking-widest text-[10px] transition-all",
                  formData.paymentMethod === 'cash' ? "bg-brand-brown border-brand-brown text-white shadow-md" : "bg-white border-brand-beige text-brand-muted hover:border-brand-brown hover:text-brand-brown"
                )}
              >
                {t.cash}
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, paymentMethod: 'transfer' })}
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
          <h3 className="font-serif text-2xl font-bold text-brand-ink">{t.confirmTitle}</h3>

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
              <span className="text-brand-muted font-bold uppercase tracking-widest">{t.subtotal}</span>
              <span className="font-black text-brand-ink">{formatCurrency(cart.total)}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-brand-muted font-bold uppercase tracking-widest">{t.cartShipping}</span>
              <span className="font-black text-green-600">{formatCurrency(0)}</span>
            </div>
            <div className="h-px bg-brand-beige my-2" />
            <div className="flex justify-between items-baseline">
              <span className="text-[10px] text-brand-muted font-black uppercase tracking-widest leading-none">{t.total}</span>
              <span className="text-2xl font-serif font-black text-brand-brown">{formatCurrency(cart.total)}</span>
            </div>
          </div>

          <button
            onClick={() => formRef.current?.requestSubmit()}
            disabled={loading}
            className="w-full py-5 bg-brand-brown text-white rounded-2xl font-black uppercase tracking-[0.2em] text-xs shadow-lg shadow-brand-brown/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading
              ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : t.placeOrder}
          </button>
        </div>
      </aside>
    </motion.div>
  );
};

export default Checkout;
