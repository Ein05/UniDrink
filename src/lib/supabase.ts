import { createClient } from '@supabase/supabase-js';

// Demo data fallback khi thiếu Supabase config
const defaultData = [
  { id: '1', name: 'Cà Phê Sữa Đá', name_en: 'Iced Coffee', price: 25000, category: 'coffee', emoji: '☕', description: 'Cà phê Robusta đậm đà.', description_en: 'Strong Vietnamese Robusta coffee.', is_available: true, is_deleted: false },
  { id: '2', name: 'Bạc Xỉu', name_en: 'White Coffee', price: 28000, category: 'coffee', emoji: '🥤', description: 'Nhiều sữa ít cà phê cho người thích ngọt.', description_en: 'Creamy Vietnamese white coffee.', is_available: true, is_deleted: false },
  { id: '3', name: 'Trà Sữa Trân Châu', name_en: 'Pearl Milk Tea', price: 35000, category: 'teaMilk', emoji: '🧋', description: 'Trà sữa truyền thống kèm trân châu.', description_en: 'Classic milk tea with chewy pearls.', is_available: true, is_deleted: false },
  { id: '4', name: 'Trà Đào Cam Sả', name_en: 'Peach Tea', price: 32000, category: 'tea', emoji: '🍑', description: 'Thanh mát giải nhiệt mùa hè.', description_en: 'Refreshing peach orange lemongrass tea.', is_available: true, is_deleted: false },
  { id: '5', name: 'Nước Ép Cam', name_en: 'Orange Juice', price: 30000, category: 'juice', emoji: '🍊', description: 'Cam tươi nguyên chất 100%.', description_en: '100% fresh orange juice.', is_available: true, is_deleted: false },
  { id: '6', name: 'Sinh Tố Bơ', name_en: 'Avocado Smoothie', price: 40000, category: 'smoothie', emoji: '🥑', description: 'Bơ sáp béo ngậy xay mịn.', description_en: 'Creamy avocado smoothie.', is_available: true, is_deleted: false },
];

// Create a mock chain that allows any method call and returns a promise resolving to demo data
const createMockChain = () => {
  const mock: any = () => mock;

  const methods = [
    'select', 'insert', 'update', 'delete', 'upsert', 'eq', 'neq', 'gt', 'lt',
    'gte', 'lte', 'like', 'ilike', 'is', 'in', 'contains', 'containedBy',
    'rangeGt', 'rangeGte', 'rangeLt', 'rangeLte', 'rangeAdjacent', 'overlaps',
    'match', 'not', 'or', 'filter', 'order', 'limit', 'range', 'single',
    'maybeSingle', 'rpc', 'auth', 'storage', 'channel', 'on', 'subscribe', 'from',
  ];

  methods.forEach(m => { mock[m] = () => mock; });

  mock.then = (onfulfilled: any) => {
    console.warn('Supabase configuration is missing. Using demo data.');
    return Promise.resolve({ data: defaultData, error: null }).then(onfulfilled);
  };

  return mock;
};

// Singleton client — chỉ khởi tạo một lần duy nhất
let _client: ReturnType<typeof createClient> | null = null;
let _useMock = false;

const getClient = () => {
  if (_client) return _client;

  const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL;
  const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    _useMock = true;
    return null;
  }

  _client = createClient(supabaseUrl, supabaseAnonKey);
  return _client;
};

const mockChain = createMockChain();

export const supabase = new Proxy({} as ReturnType<typeof createClient>, {
  get(_target, prop) {
    const client = getClient();
    if (_useMock || !client) {
      return (mockChain as any)[prop] ?? mockChain;
    }
    const value = (client as any)[prop];
    return typeof value === 'function' ? value.bind(client) : value;
  },
});
