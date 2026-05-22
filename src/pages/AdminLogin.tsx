import React, { useState, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { supabase } from '../lib/supabase';
import { useApp } from '../context/AppContext';

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
        <h2 className="text-4xl md:text-5xl font-serif text-brand-brown">Admin.</h2>
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
            {loading ? '...' : 'Đăng nhập'}
          </button>
        </form>
      </div>
    </motion.div>
  );
};

export default AdminLogin;
