-- ============================================================
-- STEP 5: SEED DATA
-- Run this last to populate the database with default drinks and admins.
-- ============================================================

-- 1. Seed Default Administrator (Change this to your Google email if needed)
INSERT INTO public.admins (email)
VALUES ('admin@phenikaa-uni.edu.vn')
ON CONFLICT (email) DO NOTHING;

-- 2. Seed Default Drink Products
INSERT INTO public.products (id, name, name_en, price, category, emoji, description, description_en, is_available)
VALUES
    ('1', 'Cà Phê Sữa Đá', 'Iced Coffee', 25000, 'coffee', '☕', 'Cà phê Robusta đậm đà.', 'Strong Vietnamese Robusta coffee.', true),
    ('2', 'Bạc Xỉu', 'White Coffee', 28000, 'coffee', '🥤', 'Nhiều sữa ít cà phê cho người thích ngọt.', 'Creamy Vietnamese white coffee.', true),
    ('3', 'Trà Sữa Trân Châu', 'Pearl Milk Tea', 35000, 'teaMilk', '🧋', 'Trà sữa truyền thống kèm trân châu.', 'Classic milk tea with chewy pearls.', true),
    ('4', 'Trà Đào Cam Sả', 'Peach Tea', 32000, 'tea', '🍑', 'Thanh mát giải nhiệt mùa hè.', 'Refreshing peach orange lemongrass tea.', true),
    ('5', 'Nước Ép Cam', 'Orange Juice', 30000, 'juice', '🍊', 'Cam tươi nguyên chất 100%.', '100% fresh orange juice.', true),
    ('6', 'Sinh Tố Bơ', 'Avocado Smoothie', 40000, 'smoothie', '🥑', 'Bơ sáp béo ngậy xay mịn.', 'Creamy avocado smoothie.', true)
ON CONFLICT (id) DO NOTHING;
