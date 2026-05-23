-- SQL SCRIPT FOR UPDATING UNIDRINK DATABASE: ORDER HISTORY / LOGS
-- Chạy đoạn mã này trong Supabase SQL Editor để khởi tạo bảng log và Trigger tự động ghi nhận thay đổi đơn hàng.

-- 1. Tạo bảng order_logs
CREATE TABLE IF NOT EXISTS public.order_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL, -- 'create', 'update_status', 'update_payment', 'edit_details'
    changed_by TEXT DEFAULT 'Admin',
    description TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Kích hoạt Row Level Security (RLS) cho bảng order_logs
ALTER TABLE public.order_logs ENABLE ROW LEVEL SECURITY;

-- Tạo chính sách cho phép đọc công khai (để khách hàng tra cứu và admin xem)
CREATE POLICY "Allow public read access to order_logs" ON public.order_logs
    FOR SELECT USING (true);

-- Tạo chính sách cho phép thêm mới
CREATE POLICY "Allow public insert access to order_logs" ON public.order_logs
    FOR INSERT WITH CHECK (true);

-- 2. Hàm trigger tự động ghi nhật ký thay đổi đơn hàng
CREATE OR REPLACE FUNCTION public.log_order_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO public.order_logs (order_id, action_type, description)
        VALUES (NEW.id, 'create', 'Đơn hàng được khởi tạo thành công.');
    ELSIF (TG_OP = 'UPDATE') THEN
        -- Trạng thái đơn hàng thay đổi
        IF OLD.status IS DISTINCT FROM NEW.status THEN
            DECLARE
                old_status_text TEXT;
                new_status_text TEXT;
            BEGIN
                old_status_text := CASE 
                    WHEN OLD.status = 'pending' THEN 'Chờ duyệt'
                    WHEN OLD.status = 'processing' THEN 'Đang làm'
                    WHEN OLD.status = 'done' THEN 'Hoàn thành'
                    WHEN OLD.status = 'cancelled' THEN 'Đã hủy'
                    ELSE OLD.status
                END;
                new_status_text := CASE 
                    WHEN NEW.status = 'pending' THEN 'Chờ duyệt'
                    WHEN NEW.status = 'processing' THEN 'Đang làm'
                    WHEN NEW.status = 'done' THEN 'Hoàn thành'
                    WHEN NEW.status = 'cancelled' THEN 'Đã hủy'
                    ELSE NEW.status
                END;
                
                INSERT INTO public.order_logs (order_id, action_type, description)
                VALUES (NEW.id, 'update_status', 
                    'Trạng thái đơn hàng thay đổi từ "' || old_status_text || '" sang "' || new_status_text || '".');
            END;
        END IF;
        
        -- Trạng thái thanh toán thay đổi
        IF OLD.is_paid IS DISTINCT FROM NEW.is_paid THEN
            DECLARE
                old_paid_text TEXT := CASE WHEN OLD.is_paid THEN 'Đã thanh toán' ELSE 'Chưa thanh toán' END;
                new_paid_text TEXT := CASE WHEN NEW.is_paid THEN 'Đã thanh toán' ELSE 'Chưa thanh toán' END;
            BEGIN
                INSERT INTO public.order_logs (order_id, action_type, description)
                VALUES (NEW.id, 'update_payment', 
                    'Trạng thái thanh toán thay đổi từ "' || old_paid_text || '" sang "' || new_paid_text || '".');
            END;
        END IF;

        -- Thông tin chi tiết thay đổi (tên, sđt, địa chỉ, ghi chú, tổng tiền)
        IF OLD.customer_name IS DISTINCT FROM NEW.customer_name OR
           OLD.customer_phone IS DISTINCT FROM NEW.customer_phone OR
           OLD.address IS DISTINCT FROM NEW.address OR
           OLD.note IS DISTINCT FROM NEW.note OR
           OLD.total_price IS DISTINCT FROM NEW.total_price OR
           OLD.payment_method IS DISTINCT FROM NEW.payment_method THEN
            
            INSERT INTO public.order_logs (order_id, action_type, description)
            VALUES (NEW.id, 'edit_details', 'Thông tin đơn hàng được quản trị viên chỉnh sửa.');
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Tạo Trigger
DROP TRIGGER IF EXISTS trigger_log_order_changes ON public.orders;
CREATE TRIGGER trigger_log_order_changes
AFTER INSERT OR UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.log_order_changes();
