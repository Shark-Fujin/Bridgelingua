import { create } from 'zustand';
import type { Language } from '../types/language';

export interface Segment {
  start: number;
  end: number;
  text: string;
  translation?: string;
  confidence?: number;
}

const DRAFT_KEY = 'bridgelingua_draft';

interface Draft {
  srcLang: Language | null;
  tgtLang: Language | null;
  segments: Segment[];
  savedAt: number;
}

function saveDraft(state: { srcLang: Language | null; tgtLang: Language | null; segments: Segment[] }) {
  if (state.segments.length === 0) {
    localStorage.removeItem(DRAFT_KEY);
    return;
  }
  const draft: Draft = { srcLang: state.srcLang, tgtLang: state.tgtLang, segments: state.segments, savedAt: Date.now() };
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch { /* quota exceeded */ }
}

function loadDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Draft;
  } catch { return null; }
}

interface WorkspaceState {
  srcLang: Language | null;
  tgtLang: Language | null;
  audioFile: File | null;
  recordedBlob: Blob | null;
  segments: Segment[];
  status: 'idle' | 'uploading' | 'transcribing' | 'translating' | 'done' | 'error';
  errorMessage: string;
  hasDraft: boolean;
  setSrcLang: (lang: Language | null) => void;
  setTgtLang: (lang: Language | null) => void;
  setAudioFile: (file: File | null) => void;
  setRecordedBlob: (blob: Blob | null) => void;
  setSegments: (segments: Segment[]) => void;
  setStatus: (status: WorkspaceState['status']) => void;
  setError: (msg: string) => void;
  updateSegmentText: (index: number, text: string) => void;
  updateSegmentTranslation: (index: number, translation: string) => void;
  restoreDraft: () => void;
  dismissDraft: () => void;
  reset: () => void;
}

const draft = loadDraft();

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  srcLang: null,
  tgtLang: null,
  audioFile: null,
  recordedBlob: null,
  segments: [],
  status: 'idle',
  errorMessage: '',
  hasDraft: draft !== null && draft.segments.length > 0,
  setSrcLang: (lang) => {
    set({ srcLang: lang });
    saveDraft({ ...get(), srcLang: lang });
  },
  setTgtLang: (lang) => {
    set({ tgtLang: lang });
    saveDraft({ ...get(), tgtLang: lang });
  },
  setAudioFile: (file) => set({ audioFile: file, recordedBlob: null }),
  setRecordedBlob: (blob) => set({ recordedBlob: blob, audioFile: null }),
  setSegments: (segments) => {
    set({ segments });
    saveDraft({ ...get(), segments });
  },
  setStatus: (status) => set({ status }),
  setError: (msg) => set({ errorMessage: msg, status: 'error' }),
  updateSegmentText: (index, text) => {
    const segs = [...get().segments];
    if (segs[index]) segs[index] = { ...segs[index], text };
    set({ segments: segs });
    saveDraft({ ...get(), segments: segs });
  },
  updateSegmentTranslation: (index, translation) => {
    const segs = [...get().segments];
    if (segs[index]) segs[index] = { ...segs[index], translation };
    set({ segments: segs });
    saveDraft({ ...get(), segments: segs });
  },
  restoreDraft: () => {
    const d = loadDraft();
    if (d) {
      set({ srcLang: d.srcLang, tgtLang: d.tgtLang, segments: d.segments, status: 'done', hasDraft: false });
    }
  },
  dismissDraft: () => {
    localStorage.removeItem(DRAFT_KEY);
    set({ hasDraft: false });
  },
  reset: () => {
    localStorage.removeItem(DRAFT_KEY);
    set({ audioFile: null, recordedBlob: null, segments: [], status: 'idle', errorMessage: '', hasDraft: false });
  },
}));
