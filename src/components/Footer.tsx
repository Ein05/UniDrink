import React from 'react';
import { Phone, Mail, MapPin, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';

const Footer = () => {
  return (
    <footer className="mt-20 bg-brand-brown py-16 px-6 md:px-10 text-white border-t border-white/10">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-16 pb-12 border-b border-white/10">

        {/* Brand Column */}
        <div className="space-y-4">
          <h2 className="text-3xl font-serif font-black italic tracking-tight text-brand-cream">
            UniDrink.
          </h2>
          <p className="text-sm text-white/70 font-serif italic max-w-sm">
            Trạm đồ uống campus lý tưởng dành cho sinh viên năng động. Thực đơn sạch, giao nhanh, thanh toán tiện lợi.
          </p>
        </div>

        {/* Contact Column */}
        <div className="space-y-4">
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-brand-caramel">
            Thông tin liên hệ
          </h3>
          <ul className="space-y-3 text-sm text-white/80">
            <li className="flex items-center gap-3">
              <Phone className="w-4 h-4 text-brand-caramel shrink-0" />
              <a href="tel:0884396243" className="hover:text-brand-caramel transition-colors">088 439 6243</a>
            </li>
            <li className="flex items-center gap-3">
              <Mail className="w-4 h-4 text-brand-caramel shrink-0" />
              <a href="mailto:23010179@st.phenikaa.edu.vn" className="hover:text-brand-caramel transition-colors">23010179@st.phenikaa.edu.vn</a>
            </li>
            <li className="flex items-center gap-3">
              <MapPin className="w-4 h-4 text-brand-caramel shrink-0" />
              <span>Đại học Phenikaa, Yên Nghĩa, Hà Đông, Hà Nội</span>
            </li>
            <li className="flex items-center gap-3">
              <Clock className="w-4 h-4 text-brand-caramel shrink-0" />
              <span>Giờ hoạt động: 07:30 - 21:00 hàng ngày</span>
            </li>
          </ul>
        </div>

        {/* Navigation Column */}
        <div className="space-y-4">
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-brand-caramel">
            Liên kết nhanh
          </h3>
          <ul className="grid grid-cols-2 gap-2 text-sm text-white/80">
            <li>
              <Link to="/" className="hover:text-brand-caramel transition-colors">Trang chủ</Link>
            </li>
            <li>
              <Link to="/cart" className="hover:text-brand-caramel transition-colors">Giỏ hàng</Link>
            </li>
            <li>
              <Link to="/track" className="hover:text-brand-caramel transition-colors">Tra cứu đơn</Link>
            </li>
            <li>
              <Link to="/admin" className="hover:text-brand-caramel transition-colors">Quản trị viên</Link>
            </li>
          </ul>
        </div>

      </div>

      <div className="max-w-7xl mx-auto pt-8 flex flex-col md:flex-row items-center justify-between text-center md:text-left gap-4">
        <p className="text-[10px] text-white/40 tracking-wider uppercase">
          © 2026 UNIDRINK - UNIVERSITY CAMPUS ORDERING. ALL RIGHTS RESERVED.
        </p>
        <div className="flex gap-6 text-[10px] text-white/40 uppercase tracking-widest">
          <a href="#" className="hover:text-white transition-colors">Điều khoản</a>
          <a href="#" className="hover:text-white transition-colors">Bảo mật</a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
