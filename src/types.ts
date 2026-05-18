export interface Product {
  id: string;
  name: string;
  name_en?: string;
  description?: string;
  description_en?: string;
  image_url?: string;
  price: number;
  category: string;
  emoji?: string;
  is_available: boolean;
  is_deleted: boolean;
  created_at: string;
}

export interface Order {
  id: string;
  order_code: string;
  customer_name: string;
  customer_phone: string;
  address: string;
  note?: string;
  total_price: number;
  payment_method: 'cash' | 'transfer';
  is_paid: boolean;
  status: 'pending' | 'processing' | 'done' | 'cancelled';
  created_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id?: string;
  product_name: string;
  quantity: number;
  price: number;
}

export interface Setting {
  key: string;
  value: string;
  is_public: boolean;
  updated_at: string;
}

export type Language = 'VI' | 'EN';
