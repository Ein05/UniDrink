-- ============================================================
-- STEP 2: ACCESS POLICIES & SECURITY RULES
-- Run this second to configure strict read/write policies on all tables.
-- ============================================================

-- 1. Clean up existing policies first to avoid dependency blocks
DROP POLICY IF EXISTS "Allow admin access to admins" ON public.admins;
DROP POLICY IF EXISTS "Allow admin access to blacklisted_emails" ON public.blacklisted_emails;
DROP POLICY IF EXISTS "Allow public read access to products" ON public.products;
DROP POLICY IF EXISTS "Allow admin write access to products" ON public.products;
DROP POLICY IF EXISTS "Allow read orders owned or admin" ON public.orders;
DROP POLICY IF EXISTS "Allow insert orders" ON public.orders;
DROP POLICY IF EXISTS "Allow update orders" ON public.orders;
DROP POLICY IF EXISTS "Allow admin update orders" ON public.orders;
DROP POLICY IF EXISTS "Allow read order_items if order is viewable" ON public.order_items;
DROP POLICY IF EXISTS "Allow insert order_items" ON public.order_items;
DROP POLICY IF EXISTS "Allow read order_logs if order is viewable" ON public.order_logs;

-- 2. Helper Admin Checking Function (Marked as STABLE for performance)
DROP FUNCTION IF EXISTS public.is_admin() CASCADE;

CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.admins
        WHERE LOWER(TRIM(email)) = LOWER(TRIM(auth.jwt() ->> 'email'))
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

GRANT USAGE ON SCHEMA private TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_admin() TO authenticated, service_role;

-- 3. Create Policies

-- Admins Table: Only admins can view/manage
CREATE POLICY "Allow admin access to admins" ON public.admins
    FOR ALL TO authenticated 
    USING (
        EXISTS (
            SELECT 1 FROM public.admins
            WHERE LOWER(TRIM(email)) = LOWER(TRIM(auth.jwt() ->> 'email'))
        )
    ) 
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.admins
            WHERE LOWER(TRIM(email)) = LOWER(TRIM(auth.jwt() ->> 'email'))
        )
    );

-- Blacklist: Only admins can view/manage
CREATE POLICY "Allow admin access to blacklisted_emails" ON public.blacklisted_emails
    FOR ALL TO authenticated 
    USING (
        EXISTS (
            SELECT 1 FROM public.admins
            WHERE LOWER(TRIM(email)) = LOWER(TRIM(auth.jwt() ->> 'email'))
        )
    ) 
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.admins
            WHERE LOWER(TRIM(email)) = LOWER(TRIM(auth.jwt() ->> 'email'))
        )
    );

-- Products: Everyone can read, only Admin can write
CREATE POLICY "Allow public read access to products" ON public.products
    FOR SELECT USING (true);

CREATE POLICY "Allow admin write access to products" ON public.products
    FOR ALL TO authenticated 
    USING (
        EXISTS (
            SELECT 1 FROM public.admins
            WHERE LOWER(TRIM(email)) = LOWER(TRIM(auth.jwt() ->> 'email'))
        )
    ) 
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.admins
            WHERE LOWER(TRIM(email)) = LOWER(TRIM(auth.jwt() ->> 'email'))
        )
    );

-- Orders Policies
-- Read: Owner (matching email) or Admin can view
CREATE POLICY "Allow read orders owned or admin" ON public.orders
    FOR SELECT USING (
        (customer_email = LOWER(TRIM(auth.jwt() ->> 'email'))) 
        OR EXISTS (
            SELECT 1 FROM public.admins
            WHERE LOWER(TRIM(email)) = LOWER(TRIM(auth.jwt() ->> 'email'))
        )
    );

-- Insert: Customers can insert pending, unpaid orders with total_price = 0. Admin can insert anything.
CREATE POLICY "Allow insert orders" ON public.orders
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.admins
            WHERE LOWER(TRIM(email)) = LOWER(TRIM(auth.jwt() ->> 'email'))
        )
        OR (
            customer_email = LOWER(TRIM(auth.jwt() ->> 'email'))
            AND total_price = 0
            AND status = 'pending'
            AND is_paid = false
        )
    );

-- Update: Customers can update their own order (details and total). Admins can update anything.
CREATE POLICY "Allow update orders" ON public.orders
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.admins
            WHERE LOWER(TRIM(email)) = LOWER(TRIM(auth.jwt() ->> 'email'))
        )
        OR customer_email = LOWER(TRIM(auth.jwt() ->> 'email'))
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.admins
            WHERE LOWER(TRIM(email)) = LOWER(TRIM(auth.jwt() ->> 'email'))
        )
        OR customer_email = LOWER(TRIM(auth.jwt() ->> 'email'))
    );

-- Order Items Policies
-- Read: Viewable if parent order is viewable
CREATE POLICY "Allow read order_items if order is viewable" ON public.order_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.orders
            WHERE orders.id = order_items.order_id
        )
    );

-- Insert: Customers can insert items for their own orders if the price matches the official product price. Admin can insert anything.
CREATE POLICY "Allow insert order_items" ON public.order_items
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.admins
            WHERE LOWER(TRIM(email)) = LOWER(TRIM(auth.jwt() ->> 'email'))
        )
        OR (
            EXISTS (
                SELECT 1 FROM public.orders o
                WHERE o.id = order_items.order_id
                  AND o.customer_email = LOWER(TRIM(auth.jwt() ->> 'email'))
            )
            AND EXISTS (
                SELECT 1 FROM public.products p
                WHERE p.id = order_items.product_id
                  AND p.price = order_items.price
                  AND p.is_deleted = false
              )
        )
    );

-- Order Logs: Viewable if parent order is viewable
CREATE POLICY "Allow read order_logs if order is viewable" ON public.order_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.orders
            WHERE orders.id = order_logs.order_id
        )
    );

-- ============================================================
-- STEP 2b: TABLE-LEVEL GRANTS
-- RLS policies only filter rows — roles also need table-level
-- SELECT/INSERT/UPDATE/DELETE privileges to pass the first gate.
-- ============================================================

-- anon (unauthenticated visitors) can read products
GRANT SELECT ON public.products TO anon;

-- authenticated users get read access to relevant tables
GRANT SELECT ON public.products      TO authenticated;
GRANT SELECT ON public.orders        TO authenticated;
GRANT SELECT ON public.order_items   TO authenticated;
GRANT SELECT ON public.order_logs    TO authenticated;
GRANT SELECT ON public.admins        TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.blacklisted_emails TO authenticated;

-- authenticated customers/admins get write access for ordering workflow
GRANT INSERT, UPDATE ON public.orders TO authenticated;
GRANT INSERT ON public.order_items TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.order_code_seq TO authenticated;

-- authenticated admins can update products (RLS enforces is_admin check)
GRANT UPDATE ON public.products TO authenticated;
