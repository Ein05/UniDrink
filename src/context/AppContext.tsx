import { createContext, useContext } from 'react';
import { translations } from '../translations';
import { useCart } from '../hooks/useCart';
import type { Language } from '../types';

export interface AppContextType {
  lang: Language;
  setLang: (l: Language) => void;
  t: typeof translations.VI;
  cart: ReturnType<typeof useCart>;
}

export const AppContext = createContext<AppContextType | null>(null);

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};
