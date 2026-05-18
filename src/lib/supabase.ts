import { createClient } from '@supabase/supabase-js';

const getSupabaseClient = () => {
  const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL;
  const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('SUPABASE_CONFIG_MISSING');
  }

  return createClient(supabaseUrl, supabaseAnonKey);
};

// Create a mock chain that allows any method call and returns a promise resolving to an error
const createMockChain = () => {
  const mock: any = () => mock;
  
  const methods = [
    'select', 'insert', 'update', 'delete', 'upsert', 'eq', 'neq', 'gt', 'lt', 
    'gte', 'lte', 'like', 'ilike', 'is', 'in', 'contains', 'containedBy', 
    'rangeGt', 'rangeGte', 'rangeLt', 'rangeLte', 'rangeAdjacent', 'overlaps', 
    'match', 'not', 'or', 'filter', 'order', 'limit', 'range', 'single', 
    'maybeSingle', 'rpc', 'auth', 'storage', 'channel', 'on', 'subscribe', 
    'from'
  ];
  
  methods.forEach(m => {
    mock[m] = () => mock;
  });

  // Handle Promise compatibility
  mock.then = (onfulfilled: any) => {
    // Check what the user is asking for
    const defaultData = [
      { id: '1', name: 'Cà Phê Sữa Đá', name_en: 'Iced Coffee', price: 25000, category: 'coffee', emoji: '☕', description: 'Cà phê Robusta đậm đà.', description_en: 'Strong Vietnamese Robusta coffee.', is_available: true, is_deleted: false },
      { id: '2', name: 'Bạc Xỉu', name_en: 'White Coffee', price: 28000, category: 'coffee', emoji: '🥤', description: 'Nhiều sữa ít cà phê cho người thích ngọt.', description_en: 'Creamy Vietnamese white coffee.', is_available: true, is_deleted: false },
      { id: '3', name: 'Trà Sữa Trân Châu', name_en: 'Pearl Milk Tea', price: 35000, category: 'teaMilk', emoji: '🧋', description: 'Trà sữa truyền thống kèm trân châu.', description_en: 'Classic milk tea with chewy pearls.', is_available: true, is_deleted: false },
      { id: '4', name: 'Trà Đào Cam Sả', name_en: 'Peach Tea', price: 32000, category: 'tea', emoji: '🍑', description: 'Thanh mát giải nhiệt mùa hè.', description_en: 'Refreshing peach orange lemongrass tea.', is_available: true, is_deleted: false },
      { id: '5', name: 'Nước Ép Cam', name_en: 'Orange Juice', price: 30000, category: 'juice', emoji: '🍊', description: 'Cam tươi nguyên chất 100%.', description_en: '100% fresh orange juice.', is_available: true, is_deleted: false },
      { id: '6', name: 'Sinh Tố Bơ', name_en: 'Avocado Smoothie', price: 40000, category: 'smoothie', emoji: '🥑', description: 'Bơ sáp béo ngậy xay mịn.', description_en: 'Creamy avocado smoothie.', is_available: true, is_deleted: false }
    ];

    console.warn("Supabase configuration is missing. Using demo data.");
    return Promise.resolve({ data: defaultData, error: null }).then(onfulfilled);
  };

  return mock;
};

const mockChain = createMockChain();

// Use a proxy to stay compatible with existing imports but delay initialization
export const supabase = new Proxy({} as any, {
  get(target, prop) {
    try {
      const client = getSupabaseClient();
      return (client as any)[prop];
    } catch (error) {
      if (error instanceof Error && error.message === 'SUPABASE_CONFIG_MISSING') {
        return (mockChain as any)[prop] || mockChain;
      }
      throw error;
    }
  }
});
