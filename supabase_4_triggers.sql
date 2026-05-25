-- ============================================================
-- STEP 4: ORDER LOGGING TRIGGERS
-- Run this fourth to establish automatic order logging in the database.
-- ============================================================

-- 1. Trigger function for automatic logging on order changes
CREATE OR REPLACE FUNCTION public.log_order_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO public.order_logs (order_id, action_type, description)
        VALUES (NEW.id, 'create', 'Đơn hàng được khởi tạo thành công.');

    ELSIF (TG_OP = 'UPDATE') THEN
        -- Order status changed
        IF OLD.status IS DISTINCT FROM NEW.status THEN
            DECLARE
                old_status_text TEXT;
                new_status_text TEXT;
            BEGIN
                old_status_text := CASE
                    WHEN OLD.status = 'pending'    THEN 'Chờ duyệt'
                    WHEN OLD.status = 'processing' THEN 'Đang làm'
                    WHEN OLD.status = 'done'       THEN 'Hoàn thành'
                    WHEN OLD.status = 'cancelled'  THEN 'Đã hủy'
                    ELSE OLD.status
                END;
                new_status_text := CASE
                    WHEN NEW.status = 'pending'    THEN 'Chờ duyệt'
                    WHEN NEW.status = 'processing' THEN 'Đang làm'
                    WHEN NEW.status = 'done'       THEN 'Hoàn thành'
                    WHEN NEW.status = 'cancelled'  THEN 'Đã hủy'
                    ELSE NEW.status
                END;
                INSERT INTO public.order_logs (order_id, action_type, description)
                VALUES (NEW.id, 'update_status',
                    'Trạng thái đơn hàng thay đổi từ "' || old_status_text || '" sang "' || new_status_text || '".');
            END;
        END IF;

        -- Payment status changed
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

        -- Order details edited (name, phone, address, note, total, payment_method)
        IF OLD.customer_name     IS DISTINCT FROM NEW.customer_name  OR
           OLD.customer_phone    IS DISTINCT FROM NEW.customer_phone OR
           OLD.address           IS DISTINCT FROM NEW.address        OR
           OLD.note              IS DISTINCT FROM NEW.note           OR
           OLD.total_price       IS DISTINCT FROM NEW.total_price    OR
           OLD.payment_method    IS DISTINCT FROM NEW.payment_method THEN
            INSERT INTO public.order_logs (order_id, action_type, description)
            VALUES (NEW.id, 'edit_details', 'Thông tin đơn hàng được quản trị viên chỉnh sửa.');
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Clean up and apply trigger
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'orders') THEN
        DROP TRIGGER IF EXISTS trigger_log_order_changes ON public.orders;
    END IF;
END $$;

CREATE TRIGGER trigger_log_order_changes
AFTER INSERT OR UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.log_order_changes();
