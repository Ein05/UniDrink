import React, { useState, useEffect, type FormEvent } from 'react';
import { motion } from 'motion/react';
import { cn, formatCurrency } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { useApp } from '../context/AppContext';
import type { Order, OrderLog } from '../types';

const TrackOrder = () => {
  const { t, lang } = useApp();
  const [code, setCode] = useState('');
  const [order, setOrder] = useState<Order | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<OrderLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setOrder(null);
    const cleanCode = code.replace('#', '').trim().toUpperCase();
    try {
      const { data, error } = await (supabase as any).rpc('get_order_by_code', { p_code: cleanCode });
      if (error) throw error;
      const result = data as Order[] | null;
      if (!result || result.length === 0) {
        setErrorMsg(t.orderNotFound);
      } else {
        setOrder(result[0]);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || t.orderError);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!order?.id) {
      setLogs([]);
      return;
    }

    const fetchLogs = async () => {
      setLoadingLogs(true);
      const { data, error } = await supabase
        .from('order_logs')
        .select('*')
        .eq('order_id', order.id)
        .order('created_at', { ascending: true });
      if (!error && data) {
        setLogs(data as OrderLog[]);
      }
      setLoadingLogs(false);
    };

    fetchLogs();

    // Subscribe to order status and detail updates
    const orderChannel = supabase
      .channel(`public:orders:id=eq.${order.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${order.id}` }, (payload) => {
        setOrder(prev => prev ? { ...prev, ...(payload.new as Partial<Order>) } : null);
      })
      .subscribe();

    // Subscribe to order log updates
    const logChannel = supabase
      .channel(`public:order_logs:order_id=eq.${order.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'order_logs', filter: `order_id=eq.${order.id}` }, (payload) => {
        setLogs(prev => {
          if (prev.some(l => l.id === payload.new.id)) return prev;
          return [...prev, payload.new as OrderLog];
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(orderChannel);
      supabase.removeChannel(logChannel);
    };
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
        <h2 className="text-3xl md:text-4xl font-serif text-brand-ink">{t.trackTitle}</h2>
        <p className="text-[10px] uppercase font-black tracking-widest text-brand-muted">{t.trackSubtitle}</p>
      </div>
      <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
        <input
          required
          type="text"
          placeholder={t.trackSearchPlaceholder}
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase())}
          className="flex-1 bg-white border border-brand-beige rounded-2xl px-6 py-4 outline-none font-medium uppercase focus:border-brand-brown/50 transition-all text-center sm:text-left"
        />
        <button
          disabled={loading}
          className="bg-brand-brown text-white px-8 py-4 rounded-2xl font-black uppercase text-xs hover:bg-brand-ink transition-all shadow-lg shadow-brand-brown/20 flex justify-center disabled:opacity-60"
        >
          {loading ? '...' : t.searchButton}
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
              <p className="text-[10px] uppercase font-black tracking-widest text-brand-muted mb-1">{t.orderCode}</p>
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
              <p className="text-[10px] uppercase font-black tracking-widest text-brand-muted mb-1">{t.customerLabel}</p>
              <p className="font-bold text-brand-ink">{order.customer_name}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase font-black tracking-widest text-brand-muted mb-1">{t.paymentLabel}</p>
              <p className={cn("font-bold", order.is_paid ? "text-green-600" : "text-brand-caramel")}>
                {order.is_paid ? t.paid : t.unpaid}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-black tracking-widest text-brand-muted mb-1">{t.total}</p>
              <p className="font-black text-brand-brown text-lg">{formatCurrency(order.total_price)}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase font-black tracking-widest text-brand-muted mb-1">{t.orderTimeLabel}</p>
              <p className="font-bold text-brand-muted/70">
                {new Date(order.created_at).toLocaleString(lang === 'EN' ? 'en-US' : 'vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
              </p>
            </div>
          </div>

          {/* Order History Timeline */}
          <div className="border-t border-brand-beige pt-6 space-y-4">
            <h4 className="text-xs font-black uppercase tracking-widest text-brand-muted">{t.orderHistory}</h4>
            {loadingLogs ? (
              <p className="text-xs text-brand-muted animate-pulse">{lang === 'EN' ? 'Loading history...' : 'Đang tải lịch sử...'}</p>
            ) : logs.length === 0 ? (
              <p className="text-xs text-brand-muted italic">{t.historyEmpty}</p>
            ) : (
              <div className="relative pl-6 border-l-2 border-brand-caramel/30 space-y-5">
                {logs.map((log) => (
                  <div key={log.id} className="relative space-y-1">
                    {/* Timeline node */}
                    <div className={cn(
                      "absolute -left-[29px] top-1 w-3 h-3 rounded-full border-2 border-white shadow-sm",
                      log.action_type === 'create' ? "bg-green-500" :
                      log.action_type === 'update_status' ? "bg-brand-caramel" :
                      "bg-brand-muted"
                    )} />
                    <p className="text-xs font-bold text-brand-ink leading-tight">{log.description}</p>
                    <p className="text-[10px] text-brand-muted font-mono">
                      {new Date(log.created_at).toLocaleString(lang === 'EN' ? 'en-US' : 'vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};

export default TrackOrder;
