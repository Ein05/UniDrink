import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Plus, CheckCircle } from 'lucide-react';
import { cn, formatCurrency } from '../lib/utils';
import { useApp } from '../context/AppContext';
import type { Product } from '../types';

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
      className="group bg-white p-3 md:p-4 rounded-[1.5rem] shadow-sm border border-brand-beige/50 hover:shadow-md transition-all flex items-center gap-3 md:gap-4 relative"
    >
      <div className="w-20 h-20 md:w-24 md:h-24 bg-[#F8F7F4] rounded-2xl flex items-center justify-center text-2xl md:text-3xl shrink-0">
        {product.image_url ? (
          <img src={product.image_url} alt={name} className="w-full h-full object-cover rounded-2xl" />
        ) : (
          <span>{product.emoji || '☕'}</span>
        )}
      </div>

      <div className="flex flex-col justify-between py-1 grow">
        <div className="flex justify-between items-start">
          <h3 className="font-serif italic font-extrabold text-[#2D1B14] text-lg md:text-xl leading-tight">{name}</h3>
          <span className="text-[#2D1B14] font-bold text-sm">
            {formatCurrency(product.price)}
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
        {isAdded ? <CheckCircle className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
      </button>

      {!product.is_available && (
        <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] rounded-[1.5rem] flex items-center justify-center">
          <span className="text-[10px] font-black uppercase tracking-widest text-brand-muted">{t.unavailable}</span>
        </div>
      )}
    </motion.div>
  );
};

export default ProductCard;
