import { create } from 'zustand';
import api from '../hooks/useApi';

export interface LexiconItem {
  id: number;
  name: string;
  source_lang: string;
  target_lang: string;
  description: string;
  is_public: boolean;
  created_at: string;
  entry_count: number;
}

export interface EntryItem {
  id: number;
  headword: string;
  ipa: string;
  definition: string;
  pos: string;
  example: string;
  semantic_domain: string;
  notes: string;
  audio_filename: string;
  created_at: string;
}

export type CommunityTab = 'my' | 'community';

export interface CommunityEntryResult extends EntryItem {
  lexicon_id: number;
  lexicon_name: string;
  source_lang: string;
  target_lang: string;
}

interface LexiconState {
  lexicons: LexiconItem[];
  entries: EntryItem[];
  selectedLexiconId: number | null;
  selectedEntryId: number | null;
  search: string;
  loading: boolean;

  communityTab: CommunityTab;
  communityLexicons: LexiconItem[];
  communitySearch: string;
  communityResults: CommunityEntryResult[];
  communityLoading: boolean;

  loadLexicons: () => Promise<void>;
  loadEntries: (lexiconId: number, search?: string) => Promise<void>;
  createLexicon: (name: string, srcLang: string, tgtLang: string) => Promise<void>;
  renameLexicon: (id: number, name: string) => Promise<void>;
  deleteLexicon: (id: number) => Promise<void>;
  createEntry: (lexiconId: number, data: Partial<EntryItem>) => Promise<void>;
  updateEntry: (lexiconId: number, entryId: number, data: Partial<EntryItem>) => Promise<void>;
  deleteEntry: (lexiconId: number, entryId: number) => Promise<void>;
  togglePublic: (lexiconId: number, isPublic: boolean) => Promise<void>;
  importCSV: (lexiconId: number, file: File) => Promise<number>;
  selectLexicon: (id: number | null) => void;
  selectEntry: (id: number | null) => void;
  setSearch: (s: string) => void;

  setCommunityTab: (tab: CommunityTab) => void;
  loadCommunityLexicons: () => Promise<void>;
  searchCommunity: (q: string) => Promise<void>;
  setCommunitySearch: (s: string) => void;
  contributeEntry: (lexiconId: number, data: Partial<EntryItem>) => Promise<void>;
}

export const useLexiconStore = create<LexiconState>((set, get) => ({
  lexicons: [],
  entries: [],
  selectedLexiconId: null,
  selectedEntryId: null,
  search: '',
  loading: false,

  communityTab: 'my',
  communityLexicons: [],
  communitySearch: '',
  communityResults: [],
  communityLoading: false,

  loadLexicons: async () => {
    const { data } = await api.get('/api/lexicons');
    set({ lexicons: data });
  },

  loadEntries: async (lexiconId, search) => {
    set({ loading: true });
    const params: Record<string, string> = {};
    if (search) params.search = search;
    const { data } = await api.get(`/api/lexicons/${lexiconId}/entries`, { params });
    set({ entries: data, loading: false });
  },

  createLexicon: async (name, srcLang, tgtLang) => {
    await api.post('/api/lexicons', { name, source_lang: srcLang, target_lang: tgtLang });
    await get().loadLexicons();
  },

  renameLexicon: async (id, name) => {
    await api.put(`/api/lexicons/${id}`, { name });
    await get().loadLexicons();
  },

  deleteLexicon: async (id) => {
    await api.delete(`/api/lexicons/${id}`);
    set({ selectedLexiconId: null, entries: [], selectedEntryId: null });
    await get().loadLexicons();
  },

  createEntry: async (lexiconId, data) => {
    await api.post(`/api/lexicons/${lexiconId}/entries`, data);
    await get().loadEntries(lexiconId, get().search);
    await get().loadLexicons();
  },

  updateEntry: async (lexiconId, entryId, data) => {
    await api.put(`/api/lexicons/${lexiconId}/entries/${entryId}`, data);
    await get().loadEntries(lexiconId, get().search);
  },

  deleteEntry: async (lexiconId, entryId) => {
    await api.delete(`/api/lexicons/${lexiconId}/entries/${entryId}`);
    set({ selectedEntryId: null });
    await get().loadEntries(lexiconId, get().search);
    await get().loadLexicons();
  },

  togglePublic: async (lexiconId, isPublic) => {
    await api.put(`/api/lexicons/${lexiconId}`, { is_public: isPublic });
    await get().loadLexicons();
  },

  importCSV: async (lexiconId, file) => {
    const form = new FormData();
    form.append('file', file);
    const { data } = await api.post(`/api/lexicons/${lexiconId}/import`, form);
    await get().loadEntries(lexiconId, get().search);
    await get().loadLexicons();
    return data.imported as number;
  },

  selectLexicon: (id) => set({ selectedLexiconId: id, selectedEntryId: null, entries: [], search: '' }),
  selectEntry: (id) => set({ selectedEntryId: id }),
  setSearch: (s) => set({ search: s }),

  setCommunityTab: (tab) => set({
    communityTab: tab,
    selectedLexiconId: null,
    selectedEntryId: null,
    entries: [],
    search: '',
    communitySearch: '',
    communityResults: [],
  }),

  loadCommunityLexicons: async () => {
    const { data } = await api.get('/api/lexicons', { params: { is_public: true } });
    set({ communityLexicons: data });
  },

  searchCommunity: async (q) => {
    if (!q.trim()) { set({ communityResults: [] }); return; }
    set({ communityLoading: true });
    const { data } = await api.get('/api/lexicons/community/search', { params: { q } });
    set({ communityResults: data, communityLoading: false });
  },

  setCommunitySearch: (s) => set({ communitySearch: s }),

  contributeEntry: async (lexiconId, data) => {
    await api.post(`/api/lexicons/${lexiconId}/entries`, data);
    await get().loadEntries(lexiconId, get().search);
    await get().loadCommunityLexicons();
  },
}));
