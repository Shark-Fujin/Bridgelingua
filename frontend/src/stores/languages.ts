import { create } from 'zustand';
import api from '../hooks/useApi';
import type { Language } from '../types/language';

interface LanguagesState {
  asr: Language[];
  translation: Language[];
  loaded: boolean;
  load: () => Promise<void>;
}

export const useLanguagesStore = create<LanguagesState>((set, get) => ({
  asr: [],
  translation: [],
  loaded: false,
  load: async () => {
    if (get().loaded) return;
    try {
      const { data } = await api.get('/api/languages');
      set({ asr: data.asr || [], translation: data.translation || [], loaded: true });
    } catch {
      set({ loaded: true });
    }
  },
}));
