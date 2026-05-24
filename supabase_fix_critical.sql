-- ============================================================
-- SUPABASE CRITICAL FIXES FOR UNIDRINK
-- Chạy file này trong Supabase SQL Editor TRƯỚC KHI dùng production.
-- ============================================================

-- ====================================================
-- FIX 1: Thêm RLS Policy cho UPDATE trên bảng orders
-- (Admin cần quyền UPDATE để cập nhật status, is_paid, v.v.)
-- ====================================================

-- Policy: Authenticated users (admin) có thể UPDATE orders
CREATE POLICY "Allow authenticated update access to orders" ON public.orders
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Policy: Authenticated users (admin) có thể UPDATE products
CREATE POLICY "Allow authenticated update access to products" ON public.products
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Policy: Authenticated users (admin) có thể xem tất cả orders (không giới hạn)
-- (Policy SELECT hiện tại đã là public, giữ nguyên)


-- ====================================================
-- FIX 2: Sửa race condition trong generate_order_code()
-- Dùng SEQUENCE thay vì MAX() để tránh duplicate order_code
-- khi nhiều user đặt hàng cùng lúc.
-- ====================================================

-- Tạo sequence nếu chưa có
CREATE SEQUENCE IF NOT EXISTS public.order_code_seq START 1;

-- Tính giá trị hiện tại dựa vào số đơn hàng đã có để sequence tiếp nối đúng
-- (Chạy một lần, sau đó sequence sẽ tự tăng)
SELECT setval('public.order_code_seq',
    COALESCE((SELECT MAX(SUBSTRING(order_code FROM 3)::INTEGER) FROM public.orders WHERE order_code ~ '^DH[0-9]+$'), 0)
);

-- Cập nhật hàm generate_order_code để dùng SEQUENCE
CREATE OR REPLACE FUNCTION public.generate_order_code()
RETURNS TEXT AS $$
DECLARE
    next_seq BIGINT;
    new_code TEXT;
BEGIN
    next_seq := nextval('public.order_code_seq');
    new_code := 'DH' || LPAD(next_seq::TEXT, 6, '0');
    RETURN new_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ====================================================
-- FIX 3: Thêm product_name vào order_items để bảo toàn lịch sử
-- (Khi sản phẩm bị đổi tên/xóa, lịch sử đơn hàng vẫn hiển thị đúng)
-- ====================================================

-- Thêm cột product_name vào order_items (nếu chưa có)
ALTER TABLE public.order_items
    ADD COLUMN IF NOT EXISTS product_name TEXT,
    ADD COLUMN IF NOT EXISTS product_name_en TEXT;

-- Cập nhật product_name cho các đơn hàng cũ từ bảng products
UPDATE public.order_items oi
SET
    product_name = p.name,
    product_name_en = p.name_en
FROM public.products p
WHERE oi.product_id = p.id
  AND oi.product_name IS NULL;

-- Cập nhật hàm create_order_with_items để lưu product_name khi tạo đơn
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
    v_product_name TEXT;
    v_product_name_en TEXT;
BEGIN
    -- Generate order code (now uses SEQUENCE - race-condition safe)
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
        -- Get product price and name
        SELECT price, name, name_en
        INTO v_price, v_product_name, v_product_name_en
        FROM public.products WHERE id = v_item.id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Product with id % not found', v_item.id;
        END IF;

        -- Insert order item with product_name snapshot
        INSERT INTO public.order_items (
            order_id, product_id, product_name, product_name_en, quantity, price
        ) VALUES (
            v_order_id, v_item.id, v_product_name, v_product_name_en, v_item.quantity, v_price
        );

        -- Add to total
        v_total_price := v_total_price + (v_price * v_item.quantity);
    END LOOP;

    -- Update order total price
    UPDATE public.orders SET total_price = v_total_price WHERE id = v_order_id;

    RETURN v_order_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ====================================================
-- DONE! Tất cả critical fixes đã được áp dụng.
-- Tiếp theo hãy chạy supabase_add_is_fake.sql nếu chưa chạy.
-- ====================================================
