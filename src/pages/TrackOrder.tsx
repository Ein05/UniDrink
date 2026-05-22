import React, { useState, useEffect, type FormEvent } from 'react';
import { motion } from 'motion/react';
import { cn, formatCurrency } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { useApp } from '../context/AppContext';
import type { Order } from '../types';

const TrackOrder = () => {
  const { t } = useApp();
  const [code, setCode] = useState('');
  const [order, setOrder] = useState<Order | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setOrder(null);
    try {
      const { data, error } = await (supabase as any).rpc('get_order_by_code', { p_code: code.toUpperCase() });
      if (error) throw error;
      const result = data as Order[] | null;
      if (!result || result.length === 0) {
        setErrorMsg('Không tìm thấy đơn hàng. Vui lòng kiểm tra lại mã.');
      } else {
        setOrder(result[0]);
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Có lỗi xảy ra. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!order?.id) return;
    const channel = supabase
      .channel(`public:orders:id=eq.${order.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${order.id}` }, (payload) => {
        setOrder(prev => prev ? { ...prev, ...(payload.new as Partial<Order>) } : null);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [order?.id]);

  const statusStyle = (status: Order['status']) => {
    if (status === 'done') return 'bg-green-50 text-green-700 border-green-200 shadow-sm';
    if (status === 'processing') return 'bg-brand-caramel/10 text-brand-caramel border-brand-caramel/20 shadow-sm animate-pulse';
    if (status === 'cancelled') return 'bg-red-50 text-red-700 border-red-200';
    return 'bg-brand-cream text-brand-brown border-brand-beige shadow-sm';
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl mx-auto space-y-10 pt-4">
      <div className="text-center space-y-2">
        <h2 className="text-3xl md:text-4xl font-serif text-brand-ink">Tra cứu đơn hàng.</h2>
        <p className="text-[10px] uppercase font-black tracking-widest text-brand-muted">Theo dõi tiến độ realtime</p>
      </div>
      <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
        <input
          type="text"
          placeholder="Nhập mã đơn, vd: DH000001"
          value={code}
          onChange={e => setCode(e.target.value)}
          className="flex-1 bg-white border border-brand-beige rounded-2xl px-6 py-4 outline-none font-medium uppercase focus:border-brand-brown/50 transition-all text-center sm:text-left"
        />
        <button
          disabled={loading}
          className="bg-brand-brown text-white px-8 py-4 rounded-2xl font-black uppercase text-xs hover:bg-brand-ink transition-all shadow-lg shadow-brand-brown/20 flex justify-center disabled:opacity-60"
        >
          {loading ? '...' : 'Tìm kiếm'}
        </button>
      </form>

      {errorMsg && (
        <div className="text-red-500 text-center font-bold text-sm bg-red-50 p-4 rounded-2xl border border-red-100">
          {errorMsg}
        </div>
      )}

      {order && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-brand-beige shadow-lg space-y-6">
          <div className="flex flex-wrap justify-between items-center border-b border-brand-beige pb-6 gap-4">
            <div>
              <p className="text-[10px] uppercase font-black tracking-widest text-brand-muted mb-1">Mã đơn</p>
              <p className="text-2xl md:text-3xl font-black text-brand-brown font-sans tracking-tighter">#{order.order_code}</p>
            </div>
            <div className="text-right">
              <span className={cn("text-[10px] font-black uppercase px-6 py-2 rounded-full border", statusStyle(order.status))}>
                {t[`status${order.status.charAt(0).toUpperCase() + order.status.slice(1)}` as keyof typeof t] || order.status}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-6 text-sm">
            <div>
              <p className="text-[10px] uppercase font-black tracking-widest text-brand-muted mb-1">Khách hàng</p>
              <p className="font-bold text-brand-ink">{order.customer_name}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase font-black tracking-widest text-brand-muted mb-1">Thanh toán</p>
              <p className={cn("font-bold", order.is_paid ? "text-green-600" : "text-brand-caramel")}>
                {order.is_paid ? 'Đã thanh toán' : 'Chưa thanh toán'}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-black tracking-widest text-brand-muted mb-1">Tổng cộng</p>
              <p className="font-black text-brand-brown text-lg">{formatCurrency(order.total_price)}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase font-black tracking-widest text-brand-muted mb-1">Thời gian đặt</p>
              <p className="font-bold text-brand-muted/70">
                {new Date(order.created_at).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};

export default TrackOrder;
