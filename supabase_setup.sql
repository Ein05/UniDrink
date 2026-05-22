-- SCHEMA SETUP FOR UNIDRINK DATABASE
-- Run this in the Supabase SQL Editor to initialize all tables and RPC functions.

-- 1. Create tables
CREATE TABLE IF NOT EXISTS public.products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    name_en TEXT,
    price NUMERIC NOT NULL,
    category TEXT,
    emoji TEXT,
    description TEXT,
    description_en TEXT,
    is_available BOOLEAN DEFAULT true,
    is_deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_code TEXT UNIQUE NOT NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    address TEXT NOT NULL,
    note TEXT,
    payment_method TEXT NOT NULL,
    status TEXT DEFAULT 'pending'::text NOT NULL,
    is_paid BOOLEAN DEFAULT false NOT NULL,
    total_price NUMERIC NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id TEXT REFERENCES public.products(id),
    quantity INTEGER NOT NULL,
    price NUMERIC NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Create Policies for RLS
CREATE POLICY "Allow public read access to products" ON public.products
    FOR SELECT USING (true);

CREATE POLICY "Allow public read access to orders" ON public.orders
    FOR SELECT USING (true);

CREATE POLICY "Allow public insert access to orders" ON public.orders
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public read access to order_items" ON public.order_items
    FOR SELECT USING (true);

CREATE POLICY "Allow public insert access to order_items" ON public.order_items
    FOR INSERT WITH CHECK (true);

-- Insert Demo Products if products table is empty
INSERT INTO public.products (id, name, name_en, price, category, emoji, description, description_en, is_available)
VALUES
    ('1', 'Cà Phê Sữa Đá', 'Iced Coffee', 25000, 'coffee', '☕', 'Cà phê Robusta đậm đà.', 'Strong Vietnamese Robusta coffee.', true),
    ('2', 'Bạc Xỉu', 'White Coffee', 28000, 'coffee', '🥤', 'Nhiều sữa ít cà phê cho người thích ngọt.', 'Creamy Vietnamese white coffee.', true),
    ('3', 'Trà Sữa Trân Châu', 'Pearl Milk Tea', 35000, 'teaMilk', '🧋', 'Trà sữa truyền thống kèm trân châu.', 'Classic milk tea with chewy pearls.', true),
    ('4', 'Trà Đào Cam Sả', 'Peach Tea', 32000, 'tea', '🍑', 'Thanh mát giải nhiệt mùa hè.', 'Refreshing peach orange lemongrass tea.', true),
    ('5', 'Nước Ép Cam', 'Orange Juice', 30000, 'juice', '🍊', 'Cam tươi nguyên chất 100%.', '100% fresh orange juice.', true),
    ('6', 'Sinh Tố Bơ', 'Avocado Smoothie', 40000, 'smoothie', '🥑', 'Bơ sáp béo ngậy xay mịn.', 'Creamy avocado smoothie.', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Function to generate sequential order code (e.g. DH000001)
CREATE OR REPLACE FUNCTION public.generate_order_code()
RETURNS TEXT AS $$
DECLARE
    next_seq INTEGER;
    new_code TEXT;
BEGIN
    SELECT COALESCE(MAX(SUBSTRING(order_code FROM 3)::INTEGER), 0) + 1 INTO next_seq FROM public.orders;
    new_code := 'DH' || LPAD(next_seq::TEXT, 6, '0');
    RETURN new_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Function to create order with items in a single transaction
CREATE OR REPLACE FUNCTION public.create_order_with_items(
    p_customer_name TEXT,
    p_customer_phone TEXT,
    p_address TEXT,
    p_note TEXT,
    p_payment_method TEXT,
    p_items JSONB -- Array of { id: string, quantity: number }
)
RETURNS TEXT AS $$
DECLARE
    v_order_id UUID;
    v_order_code TEXT;
    v_total_price NUMERIC := 0;
    v_item RECORD;
    v_price NUMERIC;
BEGIN
    -- Generate order code
    v_order_code := public.generate_order_code();

    -- Create order first with 0 total, we will update it later
    INSERT INTO public.orders (
        customer_name, customer_phone, address, note, payment_method, total_price, order_code
    ) VALUES (
        p_customer_name, p_customer_phone, p_address, p_note, p_payment_method, 0, v_order_code
    ) RETURNING id INTO v_order_id;

    -- Loop through items and insert them
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(id TEXT, quantity INTEGER)
    LOOP
        -- Get product price
        SELECT price INTO v_price FROM public.products WHERE id = v_item.id;
        
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Product with id % not found', v_item.id;
        END IF;

        -- Insert order item
        INSERT INTO public.order_items (
            order_id, product_id, quantity, price
        ) VALUES (
            v_order_id, v_item.id, v_item.quantity, v_price
        );

        -- Add to total
        v_total_price := v_total_price + (v_price * v_item.quantity);
    END LOOP;

    -- Update order total price
    UPDATE public.orders SET total_price = v_total_price WHERE id = v_order_id;

    RETURN v_order_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Function to retrieve order by code
CREATE OR REPLACE FUNCTION public.get_order_by_code(p_code TEXT)
RETURNS SETOF public.orders AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM public.orders
    WHERE UPPER(order_code) = UPPER(p_code);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
