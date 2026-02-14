import { create } from 'zustand';
import api from '../hooks/useApi';

export interface Segment {
  id: number;
  start: number;
  end: number;
  text: string;
  translation: string;
}

export interface Transcription {
  id: number;
  source_lang: string;
  target_lang: string;
  asr_model: string;
  trans_model: string;
  segments: Segment[];
}

export interface AudioFile {
  id: number;
  folder_id: number | null;
  filename: string;
  original_name: string;
  language: string;
  duration: number;
  size_bytes: number;
  speaker: string;
  location: string;
  license: string;
  tags: string;
  notes: string;
  created_at: string;
  transcription: Transcription | null;
}

export interface Folder {
  id: number;
  name: string;
  parent_id: number | null;
  created_at: string;
}

export interface FileFilters {
  language: string;
  tag: string;
  dateFrom: string;
  dateTo: string;
}

interface LibraryState {
  folders: Folder[];
  files: AudioFile[];
  selectedFolderId: number | null;
  selectedFileId: number | null;
  search: string;
  filters: FileFilters;
  loading: boolean;

  loadFolders: () => Promise<void>;
  loadFiles: (folderId?: number | null, search?: string) => Promise<void>;
  createFolder: (name: string, parentId?: number | null) => Promise<void>;
  renameFolder: (id: number, name: string) => Promise<void>;
  deleteFolder: (id: number) => Promise<void>;
  deleteFile: (id: number) => Promise<void>;
  updateFile: (id: number, data: Partial<AudioFile>) => Promise<void>;
  selectFolder: (id: number | null) => void;
  selectFile: (id: number | null) => void;
  setSearch: (s: string) => void;
  setFilters: (f: Partial<FileFilters>) => void;
  clearFilters: () => void;
  moveFile: (fileId: number, folderId: number | null) => Promise<void>;
  renameTag: (oldTag: string, newTag: string) => Promise<void>;
  deleteTag: (tag: string) => Promise<void>;
}

const emptyFilters: FileFilters = { language: '', tag: '', dateFrom: '', dateTo: '' };

export const useLibraryStore = create<LibraryState>((set, get) => ({
  folders: [],
  files: [],
  selectedFolderId: null,
  selectedFileId: null,
  search: '',
  filters: { ...emptyFilters },
  loading: false,

  loadFolders: async () => {
    const { data } = await api.get('/api/library/folders');
    set({ folders: data });
  },

  loadFiles: async (folderId, search) => {
    set({ loading: true });
    const { filters } = get();
    const params: Record<string, string> = {};
    if (folderId != null) params.folder_id = String(folderId);
    if (search) params.search = search;
    if (filters.language) params.language = filters.language;
    if (filters.tag) params.tag = filters.tag;
    if (filters.dateFrom) params.date_from = filters.dateFrom;
    if (filters.dateTo) params.date_to = filters.dateTo;
    const { data } = await api.get('/api/library/files', { params });
    set({ files: data, loading: false });
  },

  createFolder: async (name, parentId) => {
    await api.post('/api/library/folders', { name, parent_id: parentId ?? null });
    await get().loadFolders();
  },

  renameFolder: async (id, name) => {
    await api.put(`/api/library/folders/${id}`, { name });
    await get().loadFolders();
  },

  deleteFolder: async (id) => {
    await api.delete(`/api/library/folders/${id}`);
    set({ selectedFolderId: null });
    await get().loadFolders();
  },

  deleteFile: async (id) => {
    await api.delete(`/api/library/files/${id}`);
    const state = get();
    set({ selectedFileId: null });
    await state.loadFiles(state.selectedFolderId, state.search);
  },

  updateFile: async (id, data) => {
    await api.put(`/api/library/files/${id}`, data);
    const state = get();
    await state.loadFiles(state.selectedFolderId, state.search);
  },

  selectFolder: (id) => set({ selectedFolderId: id, selectedFileId: null }),
  selectFile: (id) => set({ selectedFileId: id }),
  setSearch: (s) => set({ search: s }),

  setFilters: (f) => {
    set((state) => ({ filters: { ...state.filters, ...f } }));
    const state = get();
    state.loadFiles(state.selectedFolderId, state.search);
  },

  clearFilters: () => {
    set({ filters: { ...emptyFilters } });
    const state = get();
    state.loadFiles(state.selectedFolderId, state.search);
  },

  moveFile: async (fileId, folderId) => {
    await api.put(`/api/library/files/${fileId}`, { folder_id: folderId });
    const state = get();
    await state.loadFiles(state.selectedFolderId, state.search);
  },

  renameTag: async (oldTag, newTag) => {
    const { files } = get();
    const affected = files.filter((f) =>
      f.tags.split(',').map((t) => t.trim()).includes(oldTag),
    );
    for (const f of affected) {
      const updated = f.tags
        .split(',')
        .map((t) => t.trim())
        .map((t) => (t === oldTag ? newTag : t))
        .join(', ');
      await api.put(`/api/library/files/${f.id}`, { tags: updated });
    }
    const state = get();
    await state.loadFiles(state.selectedFolderId, state.search);
  },

  deleteTag: async (tag) => {
    const { files } = get();
    const affected = files.filter((f) =>
      f.tags.split(',').map((t) => t.trim()).includes(tag),
    );
    for (const f of affected) {
      const updated = f.tags
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t !== tag)
        .join(', ');
      await api.put(`/api/library/files/${f.id}`, { tags: updated });
    }
    const state = get();
    await state.loadFiles(state.selectedFolderId, state.search);
  },
}));
