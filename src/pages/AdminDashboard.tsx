import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { cn, formatCurrency } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { useApp } from '../context/AppContext';
import type { Order, Product } from '../types';

type DayReport = {
  date: string;
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  revenue: number;
};

const AdminDashboard = () => {
  const { t } = useApp();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState<'orders' | 'products' | 'reports'>('orders');

  // Báo cáo theo ngày — memoized
  const reportsByDate = useMemo(() => {
    const grouped = orders.reduce<Record<string, DayReport>>((acc, order) => {
      const date = format(new Date(order.created_at), 'yyyy-MM-dd');
      if (!acc[date]) {
        acc[date] = { date, totalOrders: 0, completedOrders: 0, cancelledOrders: 0, revenue: 0 };
      }
      acc[date].totalOrders += 1;
      if (order.status === 'done') {
        acc[date].completedOrders += 1;
        if (order.is_paid) acc[date].revenue += order.total_price;
      }
      if (order.status === 'cancelled') {
        acc[date].cancelledOrders += 1;
      }
      return acc;
    }, {});

    return (Object.values(grouped) as DayReport[]).sort((a, b) => b.date.localeCompare(a.date));
  }, [orders]);

  // Doanh thu hôm nay — memoized
  const todayRevenue = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    return orders
      .filter(o => o.status === 'done' && o.is_paid && format(new Date(o.created_at), 'yyyy-MM-dd') === today)
      .reduce((acc, o) => acc + o.total_price, 0);
  }, [orders]);

  useEffect(() => {
    const fetchOrders = async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data) setOrders(data as Order[]);
    };

    const fetchProducts = async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name');
      if (!error && data) setProducts(data as Product[]);
      setLoading(false);
    };

    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/admin');
        return;
      }
      setIsAuthenticated(true);
      fetchOrders();
      fetchProducts();
    };

    checkAuth();

    const channel = supabase
      .channel('schema-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchOrders)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [navigate]);

  const updateStatus = async (id: string, status: Order['status']) => {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o));
    const { error } = await (supabase as any).from('orders').update({ status }).eq('id', id);
    if (error) alert('Lỗi cập nhật: ' + error.message);
  };

  const togglePaid = async (id: string, is_paid: boolean) => {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, is_paid } : o));
    const { error } = await (supabase as any).from('orders').update({ is_paid }).eq('id', id);
    if (error) alert('Lỗi cập nhật: ' + error.message);
  };

  const toggleProduct = async (id: string, is_available: boolean) => {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, is_available } : p));
    const { error } = await (supabase as any).from('products').update({ is_available }).eq('id', id);
    if (error) alert('Lỗi cập nhật sản phẩm: ' + error.message);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/admin');
  };

  if (!isAuthenticated || loading) {
    return (
      <div className="text-center py-20 text-[10px] font-black uppercase tracking-[0.3em] text-brand-muted animate-pulse">
        Loading Portal...
      </div>
    );
  }

  return (
    <div className="space-y-12 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-4">
          <h2 className="text-4xl md:text-5xl font-serif text-brand-ink">Admin.</h2>
          <div className="flex gap-2">
            {(['orders', 'products', 'reports'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "px-6 py-2 rounded-full text-xs font-bold transition-all uppercase tracking-widest border",
                  activeTab === tab
                    ? "bg-brand-brown text-white border-brand-brown"
                    : "bg-white text-brand-muted border-brand-beige"
                )}
              >
                {tab === 'orders' ? 'Orders' : tab === 'products' ? 'Inventory' : 'Báo cáo'}
              </button>
            ))}
          </div>
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

      {activeTab === 'reports' ? (
        <div className="grid grid-cols-1 gap-6">
          <div className="bg-white rounded-[2.5rem] p-6 md:p-10 border border-brand-beige shadow-sm overflow-hidden">
            <h3 className="text-2xl font-serif font-black text-brand-ink mb-8">Báo cáo doanh thu hằng ngày</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[600px] border-collapse">
                <thead>
                  <tr className="border-b border-brand-beige">
                    <th className="py-4 px-4 text-[10px] font-black uppercase tracking-widest text-brand-muted whitespace-nowrap">Ngày</th>
                    <th className="py-4 px-4 text-[10px] font-black uppercase tracking-widest text-brand-muted text-center whitespace-nowrap">Tổng đơn</th>
                    <th className="py-4 px-4 text-[10px] font-black uppercase tracking-widest text-brand-muted text-center whitespace-nowrap">Hoàn thành</th>
                    <th className="py-4 px-4 text-[10px] font-black uppercase tracking-widest text-brand-muted text-center whitespace-nowrap">Đã hủy</th>
                    <th className="py-4 px-4 text-[10px] font-black uppercase tracking-widest text-brand-muted text-right whitespace-nowrap">Doanh thu</th>
                  </tr>
                </thead>
                <tbody>
                  {reportsByDate.map(report => (
                    <tr key={report.date} className="border-b border-brand-beige last:border-0 hover:bg-brand-cream/30 transition-colors">
                      <td className="py-5 px-4 font-bold text-brand-ink whitespace-nowrap">{format(new Date(report.date), 'dd/MM/yyyy')}</td>
                      <td className="py-5 px-4 font-bold text-center">{report.totalOrders}</td>
                      <td className="py-5 px-4 font-bold text-green-600 text-center">{report.completedOrders}</td>
                      <td className="py-5 px-4 font-bold text-red-500 text-center">{report.cancelledOrders}</td>
                      <td className="py-5 px-4 font-black text-brand-brown text-right whitespace-nowrap">{formatCurrency(report.revenue)}</td>
                    </tr>
                  ))}
                  {reportsByDate.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-brand-muted italic">Chưa có dữ liệu báo cáo</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : activeTab === 'orders' ? (
        <div className="grid grid-cols-1 gap-6">
          {orders.map(order => (
            <div key={order.id} className="bg-white rounded-[2rem] md:rounded-[2.5rem] p-5 md:p-8 border border-brand-beige flex flex-col md:flex-row gap-5 md:gap-8 hover:shadow-xl transition-all group">
              <div className="space-y-4 grow">
                <div className="flex flex-wrap items-center gap-2 md:gap-4">
                  <span className="text-xl md:text-2xl font-black text-brand-brown font-sans tracking-tighter">#{order.order_code}</span>
                  <span className={cn(
                    "text-[10px] font-black uppercase px-4 py-1 rounded-full border",
                    order.status === 'done' ? "bg-green-50 text-green-700 border-green-200" :
                    order.status === 'cancelled' ? "bg-red-50 text-red-700 border-red-200" :
                    "bg-brand-cream text-brand-brown border-brand-beige"
                  )}>
                    {t[`status${order.status.charAt(0).toUpperCase() + order.status.slice(1)}` as keyof typeof t] || order.status}
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
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map(product => (
            <div key={product.id} className="bg-white p-6 rounded-[2rem] border border-brand-beige flex items-center gap-4">
              <div className="w-16 h-16 bg-[#F8F7F4] rounded-2xl flex items-center justify-center text-3xl shrink-0">
                {product.image_url ? (
                  <img src={product.image_url} alt={product.name} className="w-full h-full object-cover rounded-2xl" />
                ) : (
                  <span>{product.emoji || '☕'}</span>
                )}
              </div>
              <div className="grow">
                <h3 className="font-bold text-brand-ink">{product.name}</h3>
                <p className="text-brand-brown text-sm font-black">{formatCurrency(product.price)}</p>
              </div>
              <button
                onClick={() => toggleProduct(product.id, !product.is_available)}
                className={cn(
                  "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                  product.is_available ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-red-100 text-red-700 hover:bg-red-200"
                )}
              >
                {product.is_available ? 'Còn hàng' : 'Hết hàng'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
