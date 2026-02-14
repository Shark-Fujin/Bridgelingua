import { create } from 'zustand';
import api from '../hooks/useApi';

interface SettingsState {
  values: Record<string, string>;
  connected: boolean;
  loading: boolean;
  testResult: { success: boolean; message: string; latency_ms?: number } | null;
  load: () => Promise<void>;
  save: (settings: Record<string, string>) => Promise<void>;
  set: (key: string, value: string) => void;
  testConnection: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  values: {},
  connected: false,
  loading: false,
  testResult: null,

  load: async () => {
    set({ loading: true });
    try {
      const [{ data }, langRes] = await Promise.all([
        api.get('/api/settings'),
        api.get('/api/languages').catch(() => ({ data: { asr: [] } })),
      ]);
      const asrAvailable = Array.isArray(langRes.data?.asr) && langRes.data.asr.length > 0;
      set({ values: data.settings || {}, connected: asrAvailable, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  save: async (settings) => {
    set({ loading: true });
    try {
      await api.put('/api/settings', { settings });
      set({ values: { ...get().values, ...settings }, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  set: (key, value) => {
    set({ values: { ...get().values, [key]: value } });
  },

  testConnection: async () => {
    const v = get().values;
    set({ testResult: null, loading: true });
    try {
      const { data } = await api.post('/api/settings/test-connection', {
        connection_mode: v.connection_mode || 'huggingface',
        endpoint: v.gpu_endpoint || '',
        api_token: v.hf_token || '',
        cloud_provider: v.cloud_provider || '',
        cloud_api_key: v.cloud_api_key || '',
      });
      set({ testResult: data, connected: data.success, loading: false });
    } catch {
      set({ testResult: { success: false, message: 'Network error' }, connected: false, loading: false });
    }
  },
}));
