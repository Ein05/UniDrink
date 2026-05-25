-- SQL SETUP FOR GOOGLE LOGIN & EMAIL BLACKLIST
-- Run this in the Supabase SQL Editor.

-- 1. Add customer_email to orders table
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_email TEXT;

-- 2. Create blacklisted_emails table
CREATE TABLE IF NOT EXISTS public.blacklisted_emails (
    email TEXT PRIMARY KEY,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for blacklist table
ALTER TABLE public.blacklisted_emails ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS Policies
DROP POLICY IF EXISTS "Allow public read access to blacklisted_emails" ON public.blacklisted_emails;
CREATE POLICY "Allow public read access to blacklisted_emails" ON public.blacklisted_emails
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow authenticated full access to blacklisted_emails" ON public.blacklisted_emails;
CREATE POLICY "Allow authenticated full access to blacklisted_emails" ON public.blacklisted_emails
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. Create sequence and generate_order_code function if missing
CREATE SEQUENCE IF NOT EXISTS public.order_code_seq START 1;

SELECT setval('public.order_code_seq',
    COALESCE((SELECT MAX(SUBSTRING(order_code FROM 3)::INTEGER) FROM public.orders WHERE order_code ~ '^DH[0-9]+$'), 0)
);

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

GRANT EXECUTE ON FUNCTION public.generate_order_code() TO anon, authenticated, service_role;

-- 5. Clean up all old overloaded function signatures to avoid conflicts
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oid::regprocedure AS proname 
        FROM pg_proc 
        WHERE proname::text LIKE 'public.create_order_with_items(%'
    LOOP
        EXECUTE 'DROP FUNCTION ' || r.proname;
    END LOOP;
END;
$$;

-- 5. Update create_order_with_items function (7 parameters, with product_name and product_name_en snapshots)
CREATE OR REPLACE FUNCTION public.create_order_with_items(
    p_customer_name TEXT,
    p_customer_phone TEXT,
    p_address TEXT,
    p_note TEXT,
    p_payment_method TEXT,
    p_customer_email TEXT,
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
    -- Kiểm tra email có nằm trong danh sách đen (blacklist) không
    IF EXISTS (SELECT 1 FROM public.blacklisted_emails WHERE email = LOWER(TRIM(p_customer_email))) THEN
        RAISE EXCEPTION 'Email này đã bị khoá hệ thống do vi phạm chính sách spam.';
    END IF;

    -- Generate order code (uses sequence from critical fix)
    v_order_code := public.generate_order_code();

    -- Create order first with 0 total, we will update it later
    INSERT INTO public.orders (
        customer_name, customer_phone, address, note, payment_method, customer_email, total_price, order_code
    ) VALUES (
        p_customer_name, p_customer_phone, p_address, p_note, p_payment_method, LOWER(TRIM(p_customer_email)), 0, v_order_code
    ) RETURNING id INTO v_order_id;

    -- Loop through items and insert them
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(id TEXT, quantity INTEGER)
    LOOP
        -- Get product price and names
        SELECT price, name, name_en
        INTO v_price, v_product_name, v_product_name_en
        FROM public.products WHERE id::text = v_item.id;
        
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Product with id % not found', v_item.id;
        END IF;

        -- Insert order item with names snapshot (retains critical fix)
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

-- 6. Grant execute permissions explicitly to prevent 404/403 errors
GRANT EXECUTE ON FUNCTION public.create_order_with_items(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) TO anon, authenticated, service_role;
