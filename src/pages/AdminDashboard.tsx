import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { cn, formatCurrency } from '../lib/utils';
import { supabase, withTimeout } from '../lib/supabase';
import { useApp } from '../context/AppContext';
import type { Order, Product, OrderLog } from '../types';

type DayReport = {
  date: string;
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  revenue: number;
  unpaidDoneOrders: number; // FIX #5: theo dõi đơn done chưa thu tiền
  unpaidRevenue: number; // NEW: số tiền chưa thu
  pendingOrders: number;
};

const AdminDashboard = () => {
  const { t, lang } = useApp();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState<'orders' | 'products' | 'reports'>('orders');
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [expandedLogs, setExpandedLogs] = useState<Record<string, OrderLog[]>>({});
  const [loadingLogs, setLoadingLogs] = useState<Record<string, boolean>>({});
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [savingProduct, setSavingProduct] = useState(false);

  const [blacklistedEmails, setBlacklistedEmails] = useState<string[]>([]);

  const fetchOrderLogs = async (orderId: string) => {
    if (expandedLogs[orderId]) {
      setExpandedLogs(prev => {
        const copy = { ...prev };
        delete copy[orderId];
        return copy;
      });
      return;
    }

    setLoadingLogs(prev => ({ ...prev, [orderId]: true }));
    try {
      const { data, error } = await withTimeout(
        supabase
          .from('order_logs')
          .select('*')
          .eq('order_id', orderId)
          .order('created_at', { ascending: true }) as unknown as Promise<any>,
        20000
      );

      if (!error && data) {
        setExpandedLogs(prev => ({ ...prev, [orderId]: data as OrderLog[] }));
      }
    } catch (e: any) {
      console.error('[UniDrink] fetchOrderLogs timeout/error:', e?.message || e);
    } finally {
      setLoadingLogs(prev => ({ ...prev, [orderId]: false }));
    }
  };

  // Báo cáo theo ngày — memoized và tự động điền các ngày trống
  const reportsByDate = useMemo(() => {
    const grouped = orders.reduce<Record<string, DayReport>>((acc, order) => {

      const date = format(new Date(order.created_at), 'yyyy-MM-dd');
      if (!acc[date]) {
        acc[date] = { date, totalOrders: 0, completedOrders: 0, cancelledOrders: 0, revenue: 0, unpaidDoneOrders: 0, unpaidRevenue: 0, pendingOrders: 0 };
      }
      acc[date].totalOrders += 1;
      if (order.status === 'done') {
        acc[date].completedOrders += 1;
        if (order.is_paid) {
          acc[date].revenue += order.total_price;
        } else {
          acc[date].unpaidDoneOrders += 1; // FIX #5: đếm đơn done chưa thu tiền
          acc[date].unpaidRevenue += order.total_price; // NEW: cộng dồn tiền chưa thu
        }
      }
      if (order.status === 'cancelled') {
        acc[date].cancelledOrders += 1;
      }
      if (order.status === 'pending') {
        acc[date].pendingOrders += 1;
      }
      return acc;
    }, {});

    const dates = Object.keys(grouped);
    if (dates.length === 0) return [];

    // Tìm ngày có đơn hàng sớm nhất và ngày muộn nhất (hôm nay)
    const sortedDates = [...dates].sort();
    const minDateStr = sortedDates[0];
    const maxDateStr = format(new Date(), 'yyyy-MM-dd');

    const minDateParts = minDateStr.split('-').map(Number);
    const maxDateParts = maxDateStr.split('-').map(Number);

    // Tạo đối tượng Date ở múi giờ địa phương vào lúc giữa trưa để tránh các vấn đề về DST
    const start = new Date(minDateParts[0], minDateParts[1] - 1, minDateParts[2], 12, 0, 0);
    const end = new Date(maxDateParts[0], maxDateParts[1] - 1, maxDateParts[2], 12, 0, 0);

    const filledReports: DayReport[] = [];
    let current = new Date(start);

    while (current <= end) {
      const dateStr = format(current, 'yyyy-MM-dd');
      if (grouped[dateStr]) {
        filledReports.push(grouped[dateStr]);
      } else {
        filledReports.push({
          date: dateStr,
          totalOrders: 0,
          completedOrders: 0,
          cancelledOrders: 0,
          revenue: 0,
          unpaidDoneOrders: 0,
          unpaidRevenue: 0,
          pendingOrders: 0,
        });
      }
      current.setDate(current.getDate() + 1);
    }

    return filledReports.sort((a, b) => b.date.localeCompare(a.date));
  }, [orders]);

  const handleExportCSV = () => {
    if (reportsByDate.length === 0) return;

    const headers = lang === 'EN'
      ? ['Date', 'Total Orders', 'Completed Orders', 'Cancelled Orders', 'Unpaid Done Orders', 'Unpaid Amount (VND)', 'Unapproved Orders', 'Revenue (VND)']
      : ['Ngày', 'Tổng số đơn', 'Số đơn hoàn thành', 'Số đơn đã hủy', 'Đơn done chưa thu tiền', 'Tiền chưa thu (VND)', 'Đơn chưa duyệt', 'Doanh thu (VND)'];

    const rows = reportsByDate.map(r => [
      r.date,
      r.totalOrders,
      r.completedOrders,
      r.cancelledOrders,
      r.unpaidDoneOrders,
      r.unpaidRevenue,
      r.pendingOrders,
      r.revenue
    ]);

    const csvContent = "\uFEFF" + [
      headers.join(','),
      ...rows.map(e => e.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);

    const todayStr = format(new Date(), 'yyyy-MM-dd');
    link.setAttribute("download", `UniDrink_Revenue_Report_${todayStr}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Doanh thu hôm nay — memoized
  const todayRevenue = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    return orders
      .filter(o => o.status === 'done' && o.is_paid && format(new Date(o.created_at), 'yyyy-MM-dd') === today)
      .reduce((acc, o) => acc + o.total_price, 0);
  }, [orders]);



  useEffect(() => {
    // FIX #2: khai báo channel biến ngoài để cleanup đúng
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const fetchOrders = async () => {
      try {
        const { data, error } = await withTimeout(
          supabase
            .from('orders')
            .select('*')
            .order('created_at', { ascending: false }) as unknown as Promise<any>,
          25000
        );
        if (!error && data) setOrders(data as Order[]);
      } catch (e: any) {
        console.error('[UniDrink] Admin fetchOrders timeout/error:', e?.message || e);
      }
    };

    const fetchProducts = async () => {
      try {
        const { data, error } = await withTimeout(
          supabase
            .from('products')
            .select('*')
            .eq('is_deleted', false)
            .order('name') as unknown as Promise<any>,
          25000
        );
        if (!error && data) setProducts(data as Product[]);
      } catch (e: any) {
        console.error('[UniDrink] Admin fetchProducts timeout/error:', e?.message || e);
      } finally {
        setLoading(false);
      }
    };

    const fetchBlacklistedEmails = async () => {
      try {
        const { data, error } = await withTimeout(
          (supabase as any)
            .from('blacklisted_emails')
            .select('email') as unknown as Promise<any>,
          25000
        );
        if (!error && data) setBlacklistedEmails(data.map((item: any) => item.email.toLowerCase()));
      } catch (e: any) {
        console.error('[UniDrink] Admin fetchBlacklistedEmails timeout/error:', e?.message || e);
      }
    };

    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/login');
        return;
      }

      // Kiểm tra quyền admin qua bảng admins trong DB (SECURITY DEFINER RPC)
      const { data: isAdmin } = await withTimeout(
        (supabase as any).rpc('check_is_admin'),
        20000
      ) as any;
      if (!isAdmin) {
        // Không gọi signOut() để giữ phiên đăng nhập của User thường
        navigate('/login', { state: { notAuthorized: true } });
        return;
      }

      setIsAuthenticated(true);
      await Promise.all([fetchOrders(), fetchProducts(), fetchBlacklistedEmails()]);

      // FIX #2: chỉ subscribe realtime SAU KHI xác nhận auth
      channel = supabase
        .channel('schema-db-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchOrders)
        .subscribe();
    };

    checkAuth();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [navigate]);

  // FIX #3: Optimistic update với rollback khi lỗi
  const updateStatus = async (id: string, status: Order['status']) => {
    const previous = orders.find(o => o.id === id);
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o));
    const { error } = await (supabase as any).from('orders').update({ status }).eq('id', id);
    if (error) {
      if (previous) setOrders(prev => prev.map(o => o.id === id ? previous : o));
      alert(t.updateError + error.message);
    }
  };

  // FIX #3: rollback cho togglePaid
  const togglePaid = async (id: string, is_paid: boolean) => {
    const previous = orders.find(o => o.id === id);
    setOrders(prev => prev.map(o => o.id === id ? { ...o, is_paid } : o));
    const { error } = await (supabase as any).from('orders').update({ is_paid }).eq('id', id);
    if (error) {
      if (previous) setOrders(prev => prev.map(o => o.id === id ? previous : o));
      alert(t.updateError + error.message);
    }
  };

  // FIX #3: rollback cho toggleProduct
  const toggleProduct = async (id: string, is_available: boolean) => {
    const previous = products.find(p => p.id === id);
    setProducts(prev => prev.map(p => p.id === id ? { ...p, is_available } : p));
    const { error } = await (supabase as any).from('products').update({ is_available }).eq('id', id);
    if (error) {
      if (previous) setProducts(prev => prev.map(p => p.id === id ? previous : p));
      alert(t.productUpdateError + error.message);
    }
  };



  // Thêm/Xóa email khỏi blacklist (chặn spam)
  const toggleEmailBlacklist = async (email: string) => {
    if (!email) return;
    const cleanEmail = email.toLowerCase().trim();
    const isBlacklisted = blacklistedEmails.includes(cleanEmail);
    const previous = [...blacklistedEmails];

    // Optimistic Update
    if (isBlacklisted) {
      setBlacklistedEmails(prev => prev.filter(e => e !== cleanEmail));
    } else {
      setBlacklistedEmails(prev => [...prev, cleanEmail]);
    }

    if (isBlacklisted) {
      const { error } = await (supabase as any)
        .from('blacklisted_emails')
        .delete()
        .eq('email', cleanEmail);
      if (error) {
        setBlacklistedEmails(previous);
        alert((lang === 'EN' ? 'Failed to unblock email: ' : 'Lỗi khi bỏ chặn email: ') + error.message);
      }
    } else {
      const { error } = await (supabase as any)
        .from('blacklisted_emails')
        .insert({ email: cleanEmail, reason: 'Spam orders' });
      if (error) {
        setBlacklistedEmails(previous);
        alert((lang === 'EN' ? 'Failed to block email: ' : 'Lỗi khi chặn email: ') + error.message);
      }
    }
  };

  // Cập nhật thông tin sản phẩm (optimistic + rollback)
  const updateProduct = async (fields: Partial<Product>) => {
    if (!editingProduct) return;
    // FIX: capture id trước khi setEditingProduct(null) để tránh stale closure
    const targetProductId = editingProduct.id;
    const previous = products.find(p => p.id === targetProductId);
    setSavingProduct(true);
    setProducts(prev => prev.map(p => p.id === targetProductId ? { ...p, ...fields } : p));
    setEditingProduct(null);

    const { error } = await (supabase as any)
      .from('products')
      .update(fields)
      .eq('id', targetProductId);

    if (error) {
      if (previous) setProducts(prev => prev.map(p => p.id === targetProductId ? previous : p));
      alert(t.productUpdateError + error.message);
    }
    setSavingProduct(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/admin');
  };

  if (!isAuthenticated || loading) {
    return (
      <div className="text-center py-20 text-[10px] font-black uppercase tracking-[0.3em] text-brand-muted animate-pulse">
        {lang === 'EN' ? 'Loading Portal...' : 'Đang tải...'}
      </div>
    );
  }

  return (
    <div className="space-y-12 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-4">
          <h2 className="text-4xl md:text-5xl font-serif text-brand-ink">{t.adminTitle}</h2>
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
                {tab === 'orders' ? t.orders : tab === 'products' ? (lang === 'EN' ? 'Inventory' : 'Kho hàng') : (lang === 'EN' ? 'Reports' : 'Báo cáo')}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-4">
          <div className="bg-brand-cream border border-brand-beige px-8 py-4 rounded-2xl flex flex-col justify-center min-w-[200px]">
            <span className="text-[10px] uppercase font-black tracking-widest text-brand-muted leading-none mb-1">{t.todayRevenueLabel}</span>
            <span className="text-2xl font-serif font-black text-brand-brown">{formatCurrency(todayRevenue)}</span>
          </div>
          <button
            onClick={handleLogout}
            className="px-6 py-4 bg-brand-brown text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg shadow-brand-brown/10"
          >
            {t.logoutButton}
          </button>
        </div>
      </div>

      {activeTab === 'reports' ? (
        <div className="grid grid-cols-1 gap-6">
          <div className="bg-white rounded-[2.5rem] p-6 md:p-10 border border-brand-beige shadow-sm overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
              <h3 className="text-2xl font-serif font-black text-brand-ink leading-none">{t.dailyReportTitle}</h3>
              {reportsByDate.length > 0 && (
                <button
                  onClick={handleExportCSV}
                  className="px-6 py-3 bg-brand-brown text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-ink transition-colors shadow-lg shadow-brand-brown/10 self-start sm:self-auto"
                >
                  {t.exportReport}
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[650px] border-collapse">
                <thead>
                  <tr className="border-b border-brand-beige">
                    <th className="py-4 px-4 text-[10px] font-black uppercase tracking-widest text-brand-muted whitespace-nowrap">{t.colDate}</th>
                    <th className="py-4 px-4 text-[10px] font-black uppercase tracking-widest text-brand-muted text-center whitespace-nowrap">{t.colTotalOrders}</th>
                    <th className="py-4 px-4 text-[10px] font-black uppercase tracking-widest text-brand-muted text-center whitespace-nowrap">{t.colCompleted}</th>
                    <th className="py-4 px-4 text-[10px] font-black uppercase tracking-widest text-brand-muted text-center whitespace-nowrap">{t.colCancelled}</th>
                    <th className="py-4 px-4 text-[10px] font-black uppercase tracking-widest text-brand-muted text-center whitespace-nowrap">{t.colUnpaid}</th>
                    <th className="py-4 px-4 text-[10px] font-black uppercase tracking-widest text-brand-muted text-right whitespace-nowrap">{t.colUnpaidRevenue}</th>
                    <th className="py-4 px-4 text-[10px] font-black uppercase tracking-widest text-brand-muted text-center whitespace-nowrap">{t.colPendingOrders}</th>
                    <th className="py-4 px-4 text-[10px] font-black uppercase tracking-widest text-brand-muted text-right whitespace-nowrap">{t.colRevenue}</th>
                  </tr>
                </thead>
                <tbody>
                  {reportsByDate.map(report => (
                    <tr key={report.date} className="border-b border-brand-beige last:border-0 hover:bg-brand-cream/30 transition-colors">
                      <td className="py-5 px-4 font-bold text-brand-ink whitespace-nowrap">
                        {new Date(report.date).toLocaleDateString(lang === 'EN' ? 'en-US' : 'vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </td>
                      <td className="py-5 px-4 font-bold text-center">{report.totalOrders}</td>
                      <td className="py-5 px-4 font-bold text-green-600 text-center">{report.completedOrders}</td>
                      <td className="py-5 px-4 font-bold text-red-500 text-center">{report.cancelledOrders}</td>
                      {/* FIX #5: cột cảnh báo đơn done chưa thu tiền */}
                      <td className="py-5 px-4 text-center">
                        {report.unpaidDoneOrders > 0
                          ? <span className="bg-amber-100 text-amber-700 font-black text-[10px] px-2 py-1 rounded-full">{report.unpaidDoneOrders}</span>
                          : <span className="text-brand-muted font-bold">—</span>
                        }
                      </td>
                      <td className="py-5 px-4 text-right font-bold text-amber-600 whitespace-nowrap">
                        {report.unpaidRevenue > 0 ? (
                          <span>{formatCurrency(report.unpaidRevenue)}</span>
                        ) : (
                          <span className="text-brand-muted/40 font-bold">—</span>
                        )}
                      </td>
                      <td className="py-5 px-4 text-center font-bold text-amber-500">
                        {report.pendingOrders > 0 ? (
                          <span className="bg-amber-50 text-amber-700 text-xs px-2 py-1 rounded-full border border-amber-200">{report.pendingOrders}</span>
                        ) : (
                          <span className="text-brand-muted/40 font-bold">—</span>
                        )}
                      </td>
                      <td className="py-5 px-4 font-black text-brand-brown text-right whitespace-nowrap">{formatCurrency(report.revenue)}</td>
                    </tr>
                  ))}
                  {reportsByDate.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-brand-muted italic">{t.noReportData}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : activeTab === 'orders' ? (
        <div className="space-y-6">

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
                    order.status === 'processing' ? "bg-amber-50 text-amber-700 border-amber-200" :
                    "bg-brand-cream text-brand-brown border-brand-beige"
                  )}>
                    {t[`status${order.status.charAt(0).toUpperCase() + order.status.slice(1)}` as keyof typeof t] || order.status}
                  </span>
                  {order.is_paid && (
                    <span className="bg-blue-50 text-blue-700 text-[10px] font-black uppercase px-4 py-1 rounded-full border border-blue-200">
                      {t.paid}
                    </span>
                  )}
                  {/* FIX #5: cảnh báo đơn done nhưng chưa thu tiền */}
                  {order.status === 'done' && !order.is_paid && (
                    <span className="bg-amber-50 text-amber-700 text-[10px] font-black uppercase px-4 py-1 rounded-full border border-amber-200 animate-pulse">
                      {t.unpaidWarning}
                    </span>
                  )}

                  {/* Blocked email badge */}
                  {order.customer_email && blacklistedEmails.includes(order.customer_email.toLowerCase()) && (
                    <span className="bg-red-50 text-red-700 text-[10px] font-black uppercase px-4 py-1 rounded-full border border-red-200">
                      {lang === 'EN' ? 'Blocked Email' : 'Email bị chặn'}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-3 text-sm">
                  <div className="space-y-1">
                    <p className="text-[10px] text-brand-muted font-black uppercase tracking-widest leading-none">{t.customerLabel}</p>
                    <p className="font-bold text-brand-ink">{order.customer_name} • {order.customer_phone}</p>
                    {order.customer_email && (
                      <p className="text-xs text-brand-muted font-bold truncate">
                        Email: {order.customer_email}
                        {blacklistedEmails.includes(order.customer_email.toLowerCase()) && (
                          <span className="ml-2 text-red-500 font-black">({lang === 'EN' ? 'Blocked' : 'Đang chặn'})</span>
                        )}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-brand-muted font-black uppercase tracking-widest leading-none">{t.deliveryAddress}</p>
                    <p className="font-bold text-brand-ink">{order.address}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-brand-muted font-black uppercase tracking-widest leading-none">{t.noteLabel}</p>
                    <p className="italic font-serif text-brand-muted">{order.note || t.noNote}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-brand-muted font-black uppercase tracking-widest leading-none">{t.paymentInfo}</p>
                    <p className="font-black text-brand-brown">{formatCurrency(order.total_price)} ({order.payment_method === 'cash' ? t.cash : t.transfer})</p>
                  </div>
                </div>

                <p className="text-[10px] text-brand-muted font-bold uppercase tracking-[0.2em] opacity-40">
                  {new Date(order.created_at).toLocaleString(lang === 'EN' ? 'en-US' : 'vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'long', year: 'numeric' })}
                </p>

                <div className="pt-2">
                  <button
                    onClick={() => fetchOrderLogs(order.id)}
                    className="text-xs text-brand-muted hover:text-brand-brown font-black uppercase tracking-wider flex items-center gap-1 underline"
                  >
                    {loadingLogs[order.id] ? (lang === 'EN' ? 'Loading...' : 'Đang tải...') : expandedLogs[order.id] ? (lang === 'EN' ? 'Hide History' : 'Ẩn lịch sử') : (lang === 'EN' ? 'View History' : 'Xem lịch sử')}
                  </button>
                  
                  {expandedLogs[order.id] && (
                    <div className="mt-4 pt-4 border-t border-brand-beige space-y-3 pl-4 border-l-2 border-brand-caramel/30">
                      <p className="text-[10px] font-black uppercase tracking-widest text-brand-muted mb-2">{t.orderHistory}</p>
                      {expandedLogs[order.id].length === 0 ? (
                        <p className="text-xs text-brand-muted italic">{t.historyEmpty}</p>
                      ) : (
                        expandedLogs[order.id].map(log => (
                          <div key={log.id} className="relative space-y-0.5">
                            <div className="absolute -left-[21px] top-1.5 w-2 h-2 rounded-full bg-brand-caramel border border-white" />
                            <p className="text-xs font-bold text-brand-ink">{log.description}</p>
                            <p className="text-[9px] text-brand-muted font-mono">
                              {new Date(log.created_at).toLocaleString(lang === 'EN' ? 'en-US' : 'vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit', day: '2-digit', month: '2-digit' })}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap md:flex-col gap-3 justify-center md:items-end md:min-w-[160px]">
                {order.status !== 'done' && order.status !== 'cancelled' && (
                  <>
                    <button
                      onClick={() => updateStatus(order.id, 'processing')}
                      className="bg-brand-caramel text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-brown transition-all grow md:grow-0"
                    >
                      {lang === 'EN' ? 'Processing' : 'Đang làm'}
                    </button>
                    <button
                      onClick={() => updateStatus(order.id, 'done')}
                      className="bg-brand-brown text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-ink transition-all shadow-lg shadow-brand-brown/20 grow md:grow-0"
                    >
                      {lang === 'EN' ? 'Mark Done' : 'Hoàn thành'}
                    </button>
                  </>
                )}
                {!order.is_paid && order.status !== 'cancelled' && (
                  <button
                    onClick={() => togglePaid(order.id, true)}
                    className="bg-white border-2 border-brand-brown text-brand-brown px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-brown hover:text-white transition-all grow md:grow-0"
                  >
                    {lang === 'EN' ? 'Confirm Paid' : 'Đã thu tiền'}
                  </button>
                )}
                {order.status === 'pending' && (
                  <button
                    onClick={() => updateStatus(order.id, 'cancelled')}
                    className="bg-transparent text-red-400 hover:text-red-600 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors grow md:grow-0 underline underline-offset-4"
                  >
                    {lang === 'EN' ? 'Cancel' : 'Hủy'}
                  </button>
                )}
                <button
                  onClick={() => setEditingOrder(order)}
                  className="bg-white border border-brand-beige text-brand-muted px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-brown hover:text-white transition-all grow md:grow-0"
                >
                  {t.editButton}
                </button>

                {order.customer_email && (
                  <button
                    onClick={() => toggleEmailBlacklist(order.customer_email!)}
                    className={cn(
                      "px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all grow md:grow-0",
                      blacklistedEmails.includes(order.customer_email.toLowerCase())
                        ? "bg-red-100 text-red-700 hover:bg-red-200"
                        : "bg-white border border-brand-beige text-brand-muted hover:bg-red-50 hover:text-red-700 hover:border-red-200"
                    )}
                  >
                    {blacklistedEmails.includes(order.customer_email.toLowerCase()) ? t.unblockEmail : t.blockEmail}
                  </button>
                )}
              </div>
            </div>
          ))}
          {orders.length === 0 && (
            <div className="py-20 text-center text-brand-muted italic">{t.noOrders}</div>
          )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map(product => (
              <div key={product.id} className="bg-white p-5 rounded-[2rem] border border-brand-beige flex items-center gap-4 hover:shadow-md transition-all group">
                <div className="w-16 h-16 bg-[#F8F7F4] rounded-2xl flex items-center justify-center text-3xl shrink-0 overflow-hidden">
                  {product.image_url ? (
                    <img src={product.image_url} alt={product.name} className="w-full h-full object-cover rounded-2xl" loading="lazy" />
                  ) : (
                    <span>{product.emoji || '☕'}</span>
                  )}
                </div>
                <div className="grow min-w-0">
                  <h3 className="font-bold text-brand-ink truncate">{lang === 'EN' ? product.name_en || product.name : product.name}</h3>
                  <p className="text-brand-brown text-sm font-black">{formatCurrency(product.price)}</p>
                  <p className="text-[10px] text-brand-muted uppercase tracking-widest font-bold">{product.category}</p>
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  <button
                    onClick={() => toggleProduct(product.id, !product.is_available)}
                    className={cn(
                      "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                      product.is_available ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-red-100 text-red-700 hover:bg-red-200"
                    )}
                  >
                    {product.is_available ? t.availableLabel : t.unavailableLabel}
                  </button>
                  <button
                    onClick={() => setEditingProduct(product)}
                    className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-white border border-brand-beige text-brand-muted hover:bg-brand-brown hover:text-white hover:border-brand-brown transition-all"
                  >
                    {t.editButton}
                  </button>
                </div>
              </div>
          ))}
        </div>
      )}

      {/* Edit Order Modal */}
      {editingOrder && (
        <div className="fixed inset-0 bg-brand-ink/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-brand-cream border border-brand-beige rounded-[2.5rem] max-w-lg w-full p-6 md:p-10 shadow-2xl max-h-[90vh] overflow-y-auto space-y-6">
            <h3 className="text-2xl font-serif font-black text-brand-ink">{t.editOrder} #{editingOrder.order_code}</h3>
            
            <form onSubmit={async (e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const formData = new FormData(form);
              
              const updatedFields = {
                customer_name: formData.get('customer_name') as string,
                customer_phone: formData.get('customer_phone') as string,
                address: formData.get('address') as string,
                note: formData.get('note') as string,
                total_price: parseFloat(formData.get('total_price') as string),
                status: formData.get('status') as Order['status'],
                is_paid: formData.get('is_paid') === 'true',
              };

              // FIX: capture id trước khi setEditingOrder(null) để tránh stale closure
              const targetOrderId = editingOrder.id;
              const previous = orders.find(o => o.id === targetOrderId);
              const hadExpandedLogs = !!expandedLogs[targetOrderId];

              // Optimistic update
              setOrders(prev => prev.map(o => o.id === targetOrderId ? { ...o, ...updatedFields } : o));
              setEditingOrder(null);

              const { error } = await (supabase as any)
                .from('orders')
                .update(updatedFields)
                .eq('id', targetOrderId);

              if (error) {
                if (previous) setOrders(prev => prev.map(o => o.id === targetOrderId ? previous : o));
                alert(t.updateError + error.message);
              } else {
                // Nếu log đang mở, refresh sau 500ms để trigger mới nhất
                if (hadExpandedLogs) {
                  setTimeout(() => {
                    supabase
                      .from('order_logs')
                      .select('*')
                      .eq('order_id', targetOrderId)
                      .order('created_at', { ascending: true })
                      .then(({ data }) => {
                        if (data) {
                          setExpandedLogs(prev => ({ ...prev, [targetOrderId]: data as OrderLog[] }));
                        }
                      });
                  }, 500);
                }
              }
            }} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-black tracking-widest text-brand-muted">{t.name}</label>
                  <input
                    required
                    type="text"
                    name="customer_name"
                    defaultValue={editingOrder.customer_name}
                    className="w-full bg-white border border-brand-beige rounded-xl px-4 py-2.5 text-sm outline-none focus:border-brand-brown"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-black tracking-widest text-brand-muted">{t.phone}</label>
                  <input
                    required
                    type="text"
                    name="customer_phone"
                    defaultValue={editingOrder.customer_phone}
                    className="w-full bg-white border border-brand-beige rounded-xl px-4 py-2.5 text-sm outline-none focus:border-brand-brown"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-black tracking-widest text-brand-muted">{t.address}</label>
                <input
                  required
                  type="text"
                  name="address"
                  defaultValue={editingOrder.address}
                  className="w-full bg-white border border-brand-beige rounded-xl px-4 py-2.5 text-sm outline-none focus:border-brand-brown"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-black tracking-widest text-brand-muted">{t.noteLabel}</label>
                <textarea
                  name="note"
                  defaultValue={editingOrder.note || ''}
                  className="w-full bg-white border border-brand-beige rounded-xl px-4 py-2.5 text-sm outline-none focus:border-brand-brown min-h-[80px]"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-black tracking-widest text-brand-muted">{t.total} (VND)</label>
                  <input
                    required
                    type="number"
                    name="total_price"
                    defaultValue={editingOrder.total_price}
                    className="w-full bg-white border border-brand-beige rounded-xl px-4 py-2.5 text-sm outline-none focus:border-brand-brown"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-black tracking-widest text-brand-muted">{lang === 'EN' ? 'Status' : 'Trạng thái'}</label>
                  <select
                    name="status"
                    defaultValue={editingOrder.status}
                    className="w-full bg-white border border-brand-beige rounded-xl px-4 py-2.5 text-sm outline-none focus:border-brand-brown"
                  >
                    <option value="pending">{t.statusPending}</option>
                    <option value="processing">{t.statusProcessing}</option>
                    <option value="done">{t.statusDone}</option>
                    <option value="cancelled">{t.statusCancelled}</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-black tracking-widest text-brand-muted">{lang === 'EN' ? 'Payment' : 'Thanh toán'}</label>
                  <select
                    name="is_paid"
                    defaultValue={String(editingOrder.is_paid)}
                    className="w-full bg-white border border-brand-beige rounded-xl px-4 py-2.5 text-sm outline-none focus:border-brand-brown"
                  >
                    <option value="false">{t.unpaid}</option>
                    <option value="true">{t.paid}</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingOrder(null)}
                  className="px-6 py-3 bg-white border border-brand-beige text-brand-muted rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-cream transition-colors"
                >
                  {t.cancelButton}
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 bg-brand-brown text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-ink transition-colors shadow-lg shadow-brand-brown/10"
                >
                  {t.saveButton}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Product Modal */}
      {editingProduct && (
        <div className="fixed inset-0 bg-brand-ink/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-brand-cream border border-brand-beige rounded-[2.5rem] max-w-xl w-full p-6 md:p-10 shadow-2xl max-h-[90vh] overflow-y-auto space-y-6">

            {/* Header với live preview */}
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-white border-2 border-brand-beige rounded-2xl flex items-center justify-center text-3xl shrink-0 overflow-hidden">
                {editingProduct.image_url ? (
                  <img src={editingProduct.image_url} alt="" className="w-full h-full object-cover rounded-2xl" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                ) : (
                  <span>{editingProduct.emoji || '☕'}</span>
                )}
              </div>
              <div>
                <h3 className="text-xl font-serif font-black text-brand-ink">{t.editProduct}</h3>
                <p className="text-[10px] text-brand-muted uppercase tracking-widest font-bold">{editingProduct.name}</p>
              </div>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const updatedFields: Partial<Product> = {
                  name: (fd.get('name') as string).trim(),
                  name_en: (fd.get('name_en') as string).trim() || undefined,
                  price: parseFloat(fd.get('price') as string),
                  category: (fd.get('category') as string).trim(),
                  emoji: (fd.get('emoji') as string).trim() || undefined,
                  description: (fd.get('description') as string).trim() || undefined,
                  description_en: (fd.get('description_en') as string).trim() || undefined,
                  image_url: (fd.get('image_url') as string).trim() || undefined,
                  is_available: fd.get('is_available') === 'true',
                };
                await updateProduct(updatedFields);
              }}
              className="space-y-5"
            >
              {/* Tên VI / EN */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-black tracking-widest text-brand-muted">{t.productName}</label>
                  <input
                    required
                    name="name"
                    defaultValue={editingProduct.name}
                    className="w-full bg-white border border-brand-beige rounded-xl px-4 py-2.5 text-sm outline-none focus:border-brand-brown"
                    placeholder="Ví dụ: Cà Phê Sữa Đá"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-black tracking-widest text-brand-muted">{t.productNameEn}</label>
                  <input
                    name="name_en"
                    defaultValue={editingProduct.name_en || ''}
                    className="w-full bg-white border border-brand-beige rounded-xl px-4 py-2.5 text-sm outline-none focus:border-brand-brown"
                    placeholder="Ex: Iced Coffee"
                  />
                </div>
              </div>

              {/* Giá & Trạng thái */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-black tracking-widest text-brand-muted">{t.productPrice}</label>
                  <input
                    required
                    name="price"
                    type="number"
                    min={0}
                    step={500}
                    defaultValue={editingProduct.price}
                    className="w-full bg-white border border-brand-beige rounded-xl px-4 py-2.5 text-sm outline-none focus:border-brand-brown"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-black tracking-widest text-brand-muted">{lang === 'EN' ? 'Status' : 'Trạng thái'}</label>
                  <select
                    name="is_available"
                    defaultValue={String(editingProduct.is_available)}
                    className="w-full bg-white border border-brand-beige rounded-xl px-4 py-2.5 text-sm outline-none focus:border-brand-brown"
                  >
                    <option value="true">{t.availableLabel}</option>
                    <option value="false">{t.unavailableLabel}</option>
                  </select>
                </div>
              </div>

              {/* Nhóm hàng (category) — input tự do + gợi ý */}
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-black tracking-widest text-brand-muted">
                  {t.productCategory}
                  <span className="ml-2 normal-case font-medium text-brand-muted/60">
                    {lang === 'EN' ? '(type freely or pick a suggestion)' : '(gõ tự do hoặc chọn gợi ý)'}
                  </span>
                </label>
                <input
                  required
                  name="category"
                  list="category-suggestions"
                  defaultValue={editingProduct.category}
                  className="w-full bg-white border border-brand-beige rounded-xl px-4 py-2.5 text-sm outline-none focus:border-brand-brown"
                  placeholder={lang === 'EN' ? 'e.g. coffee, teaMilk, juice...' : 'Ví dụ: coffee, teaMilk, juice...'}
                />
                <datalist id="category-suggestions">
                  <option value="coffee">{lang === 'EN' ? 'Coffee' : 'Cà phê'}</option>
                  <option value="teaMilk">{lang === 'EN' ? 'Milk Tea' : 'Trà Sữa'}</option>
                  <option value="tea">{lang === 'EN' ? 'Tea' : 'Trà'}</option>
                  <option value="juice">{lang === 'EN' ? 'Juice' : 'Nước ép'}</option>
                  <option value="smoothie">{lang === 'EN' ? 'Smoothie' : 'Sinh Tố'}</option>
                </datalist>
                <p className="text-[10px] text-amber-600 font-bold">
                  {lang === 'EN'
                    ? '⚠ If you use a new category name, add it to Home.tsx categories list to show filter button.'
                    : '⚠ Nếu tạo nhóm mới, cần thêm vào danh sách categories trong Home.tsx để hiện nút lọc.'}
                </p>
              </div>

              {/* Emoji */}
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-black tracking-widest text-brand-muted">{t.productEmoji}</label>
                <input
                  name="emoji"
                  defaultValue={editingProduct.emoji || ''}
                  onChange={(e) => setEditingProduct(prev => prev ? { ...prev, emoji: e.target.value, image_url: prev.image_url } : null)}
                  className="w-full bg-white border border-brand-beige rounded-xl px-4 py-2.5 text-sm outline-none focus:border-brand-brown"
                  placeholder="☕, 🧋, 🍑..."
                />
              </div>

              {/* Ảnh URL với live preview */}
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-black tracking-widest text-brand-muted">{t.productImageUrl}</label>
                <input
                  name="image_url"
                  type="url"
                  defaultValue={editingProduct.image_url || ''}
                  onChange={(e) => setEditingProduct(prev => prev ? { ...prev, image_url: e.target.value } : null)}
                  className="w-full bg-white border border-brand-beige rounded-xl px-4 py-2.5 text-sm outline-none focus:border-brand-brown"
                  placeholder="https://..."
                />
                <p className="text-[10px] text-brand-muted">
                  {lang === 'EN' ? 'Leave blank to use emoji instead. Preview updates live above.' : 'Bỏ trống để dùng emoji. Preview cập nhật trực tiếp ở trên.'}
                </p>
              </div>

              {/* Mô tả VI / EN */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-black tracking-widest text-brand-muted">{t.productDesc}</label>
                  <textarea
                    name="description"
                    defaultValue={editingProduct.description || ''}
                    rows={3}
                    className="w-full bg-white border border-brand-beige rounded-xl px-4 py-2.5 text-sm outline-none focus:border-brand-brown resize-none"
                    placeholder="Mô tả ngắn gọn..."
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-black tracking-widest text-brand-muted">{t.productDescEn}</label>
                  <textarea
                    name="description_en"
                    defaultValue={editingProduct.description_en || ''}
                    rows={3}
                    className="w-full bg-white border border-brand-beige rounded-xl px-4 py-2.5 text-sm outline-none focus:border-brand-brown resize-none"
                    placeholder="Short description..."
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="px-6 py-3 bg-white border border-brand-beige text-brand-muted rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-cream transition-colors"
                >
                  {t.cancelButton}
                </button>
                <button
                  type="submit"
                  disabled={savingProduct}
                  className="px-6 py-3 bg-brand-brown text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-ink transition-colors shadow-lg shadow-brand-brown/10 disabled:opacity-60 flex items-center gap-2"
                >
                  {savingProduct
                    ? <><div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />{lang === 'EN' ? 'Saving...' : 'Đang lưu...'}</>
                    : t.saveButton}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
