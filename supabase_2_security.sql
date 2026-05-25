-- ============================================================
-- STEP 2: ACCESS POLICIES & SECURITY RULES
-- Run this second to configure strict read/write policies on all tables.
-- ============================================================

-- 1. Helper Admin Checking Function
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.admins
        WHERE LOWER(TRIM(email)) = LOWER(TRIM(auth.jwt() ->> 'email'))
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Clean up existing policies if any
DROP POLICY IF EXISTS "Allow admin access to admins" ON public.admins;
DROP POLICY IF EXISTS "Allow admin access to blacklisted_emails" ON public.blacklisted_emails;
DROP POLICY IF EXISTS "Allow public read access to products" ON public.products;
DROP POLICY IF EXISTS "Allow admin write access to products" ON public.products;
DROP POLICY IF EXISTS "Allow read orders owned or admin" ON public.orders;
DROP POLICY IF EXISTS "Allow admin update orders" ON public.orders;
DROP POLICY IF EXISTS "Allow read order_items if order is viewable" ON public.order_items;
DROP POLICY IF EXISTS "Allow read order_logs if order is viewable" ON public.order_logs;

-- 4. Create Policies

-- Admins Table: Only admins can view/manage
CREATE POLICY "Allow admin access to admins" ON public.admins
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Blacklist: Only admins can view/manage
CREATE POLICY "Allow admin access to blacklisted_emails" ON public.blacklisted_emails
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Products: Everyone can read, only Admin can write
CREATE POLICY "Allow public read access to products" ON public.products
    FOR SELECT USING (true);

CREATE POLICY "Allow admin write access to products" ON public.products
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Orders: Owner (matching email) can view, Admin can view and update. Direct inserts prohibited.
CREATE POLICY "Allow read orders owned or admin" ON public.orders
    FOR SELECT USING (
        (customer_email = LOWER(TRIM(auth.jwt() ->> 'email'))) OR public.is_admin()
    );

CREATE POLICY "Allow admin update orders" ON public.orders
    FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Order Items: Viewable if parent order is viewable
CREATE POLICY "Allow read order_items if order is viewable" ON public.order_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.orders
            WHERE orders.id = order_items.order_id
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
