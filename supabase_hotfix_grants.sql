-- ============================================================
-- HOTFIX: TABLE-LEVEL GRANTS
-- Chạy file này trong Supabase SQL Editor để fix lỗi
-- "permission denied for table products" và các bảng liên quan.
--
-- Nguyên nhân: RLS policy chỉ lọc ROW, nhưng role anon/authenticated
-- cũng cần có table-level GRANT mới vượt qua được lớp bảo vệ đầu tiên.
-- ============================================================

-- anon (khách chưa đăng nhập) đọc được products
GRANT SELECT ON public.products TO anon;

-- authenticated (đã đăng nhập) đọc được các bảng liên quan
GRANT SELECT ON public.products      TO authenticated;
GRANT SELECT ON public.orders        TO authenticated;
GRANT SELECT ON public.order_items   TO authenticated;
GRANT SELECT ON public.order_logs    TO authenticated;
GRANT SELECT ON public.admins        TO authenticated;

-- blacklisted_emails: admin quản lý (RLS giới hạn chỉ admin mới thao tác được)
GRANT SELECT, INSERT, DELETE ON public.blacklisted_emails TO authenticated;

-- orders & products: admin có thể update (RLS giới hạn chỉ admin)
GRANT UPDATE ON public.orders   TO authenticated;
GRANT UPDATE ON public.products TO authenticated;
