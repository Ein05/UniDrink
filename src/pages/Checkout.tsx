import React, { useState, useRef, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { CheckCircle } from 'lucide-react';
import { cn, formatCurrency, normalizePhone } from '../lib/utils';
import { useApp } from '../context/AppContext';
import { supabase, withTimeout } from '../lib/supabase';

// Kiểm tra đồng bộ xem có Supabase token trong localStorage không (không cần await)
const hasStoredSession = () =>
  Object.keys(localStorage).some(
    (key) => key.startsWith('sb-') && key.endsWith('-auth-token')
  );

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
  // authLoading chỉ true nếu có token trong localStorage (tức là có thể có session)
  // Nếu khách chưa đăng nhập thì không cần chờ — false ngay lập tức.
  const [authLoading, setAuthLoading] = useState(() => hasStoredSession());

  React.useEffect(() => {
    // Chỉ cần gọi getSession nếu có token (đã set authLoading=true)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setAuthLoading(false);
    });

    // Lần đầu load: lấy session hiện tại
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Không cần handleGoogleSignIn tại đây — việc đăng nhập được xử lý tại /login

  // Đang chờ xác nhận session (chỉ với user đã có token)
  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
        <div className="w-8 h-8 border-4 border-brand-beige border-t-brand-brown rounded-full animate-spin" />
      </div>
    );
  }

  // Chưa đăng nhập → chuyển về trang login, truyền đích /checkout để redirect lại sau khi login
  if (!session) {
    return <Navigate to="/login" state={{ from: '/checkout' }} replace />;
  }

  // Giỏ hàng trống
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
      const { data, error } = await withTimeout(
        (supabase as any).rpc('create_order_with_items', {
          p_customer_name: formData.name.trim(),
          p_customer_phone: normalizedPhone,
          p_address: formData.address.trim(),
          p_note: formData.note.trim(),
          p_payment_method: formData.paymentMethod,
          p_customer_email: session?.user?.email || '',
          p_items: cart.items.map(item => ({ id: item.id, quantity: item.quantity })),
        }),
        30000
      ) as any;

      if (error) throw error;

      // Save order time to prevent spam
      localStorage.setItem('last_order_time', Date.now().toString());

      const orderCodeText = data as string;
      const orderTotalAmount = cart.total;

      // Clear cart immediately to prevent duplicate orders
      cart.clearCart();

      if (formData.paymentMethod === 'transfer') {
        try {
          // Call serverless API to create PayOS payment link
          const response = await fetch('/api/payos-create', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              orderCodeText,
              totalPrice: orderTotalAmount,
            }),
          });

          if (!response.ok) {
            throw new Error('Failed to create PayOS link');
          }

          const payosData = await response.json();
          if (payosData && payosData.checkoutUrl) {
            // Redirect customer directly to PayOS secure portal
            window.location.href = payosData.checkoutUrl;
            return;
          } else {
            throw new Error('Invalid response data from PayOS API');
          }
        } catch (payosErr) {
          console.error('[Checkout PayOS Error]:', payosErr);
          // Fallback to manual QR display if PayOS integration fails
          setOrderTotal(orderTotalAmount);
          setSuccessCode(orderCodeText);
        }
      } else {
        // Cash order: Show standard checkout success screen
        setOrderTotal(orderTotalAmount);
        setSuccessCode(orderCodeText);
      }
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
