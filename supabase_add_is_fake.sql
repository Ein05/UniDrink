-- SQL SCRIPT FOR ADDING FAKE ORDER FLAG AND LOGGING
-- Chạy đoạn mã này trong Supabase SQL Editor để cập nhật cơ sở dữ liệu.

-- 1. Thêm cột is_fake vào bảng orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS is_fake BOOLEAN DEFAULT false NOT NULL;

-- 2. Nâng cấp hàm trigger log_order_changes để ghi nhận nhật ký thay đổi trạng thái đơn ảo
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

        -- Đánh dấu / hủy đánh dấu đơn hàng ảo (is_fake)
        IF OLD.is_fake IS DISTINCT FROM NEW.is_fake THEN
            IF NEW.is_fake THEN
                INSERT INTO public.order_logs (order_id, action_type, description)
                VALUES (NEW.id, 'edit_details', 'Đơn hàng bị đánh dấu là đơn ảo (Không liên hệ được qua Zalo/SMS).');
            ELSE
                INSERT INTO public.order_logs (order_id, action_type, description)
                VALUES (NEW.id, 'edit_details', 'Hủy đánh dấu đơn ảo cho đơn hàng.');
            END IF;
        END IF;

        -- Thông tin chi tiết thay đổi (tên, sđt, địa chỉ, ghi chú, tổng tiền)
        -- Loại trừ trường hợp chỉ đổi is_fake (để tránh bị trùng lặp log ở trên)
        IF (OLD.customer_name IS DISTINCT FROM NEW.customer_name OR
            OLD.customer_phone IS DISTINCT FROM NEW.customer_phone OR
            OLD.address IS DISTINCT FROM NEW.address OR
            OLD.note IS DISTINCT FROM NEW.note OR
            OLD.total_price IS DISTINCT FROM NEW.total_price OR
            OLD.payment_method IS DISTINCT FROM NEW.payment_method) AND
           OLD.is_fake IS NOT DISTINCT FROM NEW.is_fake THEN
            
            INSERT INTO public.order_logs (order_id, action_type, description)
            VALUES (NEW.id, 'edit_details', 'Thông tin đơn hàng được quản trị viên chỉnh sửa.');
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
