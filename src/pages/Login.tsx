import React, { useState, useEffect, type FormEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import { supabase, withTimeout } from '../lib/supabase';
import { useApp } from '../context/AppContext';

type AuthMode = 'signin' | 'signup';

const Login = () => {
  const { t, lang } = useApp();
  const navigate = useNavigate();
  const location = useLocation();

  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Lấy trang đích (nếu được redirect từ /checkout hoặc trang khác)
  const fromPage = (location.state as any)?.from as string | undefined;
  const notAuthorized = (location.state as any)?.notAuthorized;

  // Helper: điều hướng sau khi đăng nhập thành công
  const redirectAfterLogin = async (active: { value: boolean }) => {
    // Ưu tiên: trang đích từ state hoặc sessionStorage (sau Google OAuth redirect)
    const stored = sessionStorage.getItem('login_redirect_to');
    const destination = stored || fromPage;
    if (stored) sessionStorage.removeItem('login_redirect_to');

    if (destination) {
      navigate(destination, { replace: true });
      return;
    }

    // Kiểm tra quyền admin để điều hướng mặc định (dùng cache nếu đã có)
    let isAdmin = false;
    try {
      const cached = sessionStorage.getItem('is_admin');
      if (cached !== null) {
        isAdmin = cached === 'true';
      } else {
        const { data } = await withTimeout(
          (supabase as any).rpc('check_is_admin'),
          5000
        ) as any;
        isAdmin = !!data;
        sessionStorage.setItem('is_admin', String(isAdmin));
      }
    } catch (err) {
      console.warn('[UniDrink] check_is_admin timed out or failed in Login:', err);
    }
    if (active.value) {
      navigate(isAdmin ? '/admin/dashboard' : '/', { replace: true });
    }
  };

  useEffect(() => {
    const active = { value: true };
    const checkSessionAndRedirect = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session && active.value && !notAuthorized) {
        await redirectAfterLogin(active);
      }
    };
    checkSessionAndRedirect();
    return () => { active.value = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, notAuthorized]);

  /* ── Email auth ── */
  const handleEmailAuth = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const active = { value: true };
    if (mode === 'signup') {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setErrorMsg(error.message);
      } else if (!data.session) {
        setSuccessMsg(t.adminConfirmEmail);
      } else {
        await redirectAfterLogin(active);
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setErrorMsg(error.message);
      } else {
        await redirectAfterLogin(active);
      }
    }
    setLoading(false);
  };

  /* ── Google auth ── */
  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setErrorMsg(null);
    // Lưu trang đích vào sessionStorage trước khi browser redirect
    // (React Router state bị mất khi reload)
    if (fromPage) {
      sessionStorage.setItem('login_redirect_to', fromPage);
    } else {
      sessionStorage.removeItem('login_redirect_to');
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/login' },
    });
    if (error) {
      setErrorMsg(error.message);
      setGoogleLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="max-w-md mx-auto pt-12 space-y-8"
    >
      {/* Title */}
      <div className="text-center space-y-2">
        <h2 className="text-4xl md:text-5xl font-serif text-brand-brown">{t.adminPortalTitle}</h2>
        <p className="text-brand-muted font-black uppercase text-[10px] tracking-[0.2em]">{t.adminPortalSubtitle}</p>
      </div>

      {/* Banner khi redirect từ checkout */}
      {fromPage === '/checkout' && !notAuthorized && (
        <div className="bg-brand-caramel/10 border border-brand-caramel/30 rounded-2xl px-5 py-3 text-center">
          <p className="text-xs font-bold text-brand-brown">
            {lang === 'EN'
              ? '🛒 Sign in to complete your order'
              : '🛒 Đăng nhập để hoàn tất đặt hàng'}
          </p>
        </div>
      )}

      <div className="bg-white rounded-[2.5rem] p-8 md:p-10 shadow-2xl border border-brand-beige space-y-6">

        {/* Not authorized error */}
        {notAuthorized && (
          <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-sm font-bold border border-red-100 text-center">
            {t.adminNotAuthorized}
          </div>
        )}

        {/* Generic error */}
        {errorMsg && !notAuthorized && (
          <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-sm font-bold border border-red-100 text-center">
            {errorMsg}
          </div>
        )}

        {/* Success message (email confirmation) */}
        {successMsg && (
          <div className="bg-green-50 text-green-700 p-4 rounded-2xl text-sm font-bold border border-green-100 text-center">
            {successMsg}
          </div>
        )}

        {/* Sign in / Sign up toggle */}
        <div className="flex bg-brand-cream p-1 rounded-2xl gap-1">
          {(['signin', 'signup'] as AuthMode[]).map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); setErrorMsg(null); setSuccessMsg(null); }}
              className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                mode === m
                  ? 'bg-white shadow-sm text-brand-brown'
                  : 'text-brand-muted hover:text-brand-ink'
              }`}
            >
              {m === 'signin' ? t.adminSignIn : t.adminSignUp}
            </button>
          ))}
        </div>

        {/* Email/Password form */}
        <form onSubmit={handleEmailAuth} className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] uppercase font-black text-brand-muted tracking-[0.2em] ml-2">
              Email
            </label>
            <input
              type="email"
              required
              autoComplete="email"
              className="w-full bg-brand-cream border border-brand-beige rounded-2xl px-6 py-4 outline-none font-medium text-brand-ink focus:ring-2 focus:ring-brand-caramel transition-all"
              placeholder="example@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] uppercase font-black text-brand-muted tracking-[0.2em] ml-2">
              {lang === 'EN' ? 'Password' : 'Mật khẩu'}
            </label>
            <input
              type="password"
              required
              minLength={6}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              className="w-full bg-brand-cream border border-brand-beige rounded-2xl px-6 py-4 outline-none font-medium text-brand-ink focus:ring-2 focus:ring-brand-caramel transition-all"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-brown text-white py-4 rounded-2xl font-black uppercase tracking-[0.2em] text-xs hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-brand-brown/20 disabled:opacity-50 flex items-center justify-center"
          >
            {loading
              ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : mode === 'signin' ? t.adminSignIn : t.adminSignUp}
          </button>
        </form>

        {/* Divider */}
        <div className="relative flex items-center gap-3">
          <div className="flex-1 h-px bg-brand-beige" />
          <span className="text-[10px] text-brand-muted font-black uppercase tracking-widest shrink-0">
            {t.adminOrDivider}
          </span>
          <div className="flex-1 h-px bg-brand-beige" />
        </div>

        {/* Google sign in */}
        <button
          onClick={handleGoogleSignIn}
          disabled={googleLoading}
          className="w-full py-4 bg-white border-2 border-brand-beige hover:border-brand-brown text-brand-ink rounded-2xl font-black uppercase tracking-wider text-xs shadow-sm transition-all flex items-center justify-center gap-3 disabled:opacity-60"
        >
          {googleLoading ? (
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

        {/* Access note */}
        <p className="text-center text-[10px] text-brand-muted/60 font-medium leading-relaxed">
          {lang === 'EN'
            ? 'Sign in to buy items and track your order history. Only authorized accounts can access the Admin Dashboard.'
            : 'Đăng nhập để đặt hàng và theo dõi lịch sử mua hàng. Chỉ tài khoản được phân quyền mới có thể vào Dashboard Admin.'}
        </p>
      </div>
    </motion.div>
  );
};

export default Login;
