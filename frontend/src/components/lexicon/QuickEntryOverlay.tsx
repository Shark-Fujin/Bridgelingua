import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';
import { useLexiconStore } from '../../stores/lexicon';
import { useLanguagesStore } from '../../stores/languages';
import api from '../../hooks/useApi';

const POS_OPTIONS = ['noun', 'verb', 'adjective', 'adverb', 'pronoun', 'preposition', 'conjunction', 'interjection', 'other'];

interface QuickEntryOverlayProps {
  lexiconId: number;
  srcLang: string;
  onClose: () => void;
}

export default function QuickEntryOverlay({ lexiconId, srcLang, onClose }: QuickEntryOverlayProps) {
  const { t } = useTranslation();
  const recorder = useAudioRecorder();
  const store = useLexiconStore();
  const { asr, load: loadLangs } = useLanguagesStore();

  useEffect(() => { loadLangs(); }, [loadLangs]);

  const asrLangCode = useMemo(() => {
    if (!srcLang || !asr.length) return srcLang;
    const q = srcLang.toLowerCase();
    const match = asr.find(
      (l) => l.code === srcLang || l.name.toLowerCase() === q || (l.native || '').toLowerCase() === q,
    );
    return match?.code || srcLang;
  }, [srcLang, asr]);

  const [headword, setHeadword] = useState('');
  const [definition, setDefinition] = useState('');
  const [pos, setPos] = useState('');
  const [transcribing, setTranscribing] = useState(false);
  const [recentEntries, setRecentEntries] = useState<{ headword: string; definition: string }[]>([]);
  const [count, setCount] = useState(0);

  const headwordRef = useRef<HTMLInputElement>(null);
  const definitionRef = useRef<HTMLInputElement>(null);
  const posRef = useRef<HTMLSelectElement>(null);
  const handleSaveRef = useRef<() => void>(() => {});

  const handleASR = useCallback(async (blob: Blob) => {
    setTranscribing(true);
    try {
      const form = new FormData();
      form.append('audio', new File([blob], 'quick.webm'));
      form.append('language', asrLangCode);
      const { data } = await api.post('/api/transcribe', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const text = (data.segments || []).map((s: { text: string }) => s.text).join(' ').trim();
      if (text) {
        setHeadword(text);
        definitionRef.current?.focus();
      }
    } catch {
      // 静默处理
    } finally {
      setTranscribing(false);
    }
  }, [asrLangCode]);

  const handleSave = useCallback(async () => {
    if (!headword.trim()) return;
    await store.createEntry(lexiconId, {
      headword: headword.trim(),
      definition: definition.trim(),
      pos,
    });
    setRecentEntries((prev) => [{ headword: headword.trim(), definition: definition.trim() }, ...prev].slice(0, 10));
    setCount((c) => c + 1);
    setHeadword('');
    setDefinition('');
    setPos('');
    recorder.reset();
    headwordRef.current?.focus();
  }, [headword, definition, pos, lexiconId, store, recorder]);

  handleSaveRef.current = handleSave;

  // Space 键录音控制
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        if (e.key === 'Escape') {
          onClose();
          return;
        }
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          handleSaveRef.current();
          return;
        }
        return;
      }

      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        if (recorder.recording) {
          recorder.stop();
        } else {
          recorder.reset();
          recorder.start();
        }
      }
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [recorder, onClose]);

  // 录音结束后自动 ASR
  useEffect(() => {
    if (recorder.blob && !recorder.recording) {
      handleASR(recorder.blob);
    }
  }, [recorder.blob, recorder.recording, handleASR]);

  return (
    <div className="quick-entry-overlay">
      <div className="quick-entry-panel">
        {/* Header */}
        <div className="quick-entry-header">
          <h2>{t('quick.title')}</h2>
          <div className="quick-entry-progress">
            <span className="badge badge-primary">{count}</span> {t('quick.entries_done')}
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>{t('quick.exit')}</button>
        </div>

        {/* Record area */}
        <div className="quick-record-area">
          <button
            className={`record-btn-large${recorder.recording ? ' recording' : ''}`}
            onClick={() => {
              if (recorder.recording) {
                recorder.stop();
              } else {
                recorder.reset();
                recorder.start();
              }
            }}
          >
            {recorder.recording ? '\u23F9' : '\u{1F3A4}'}
          </button>
          <div className="quick-record-hint">
            {transcribing ? 'Recognizing...' : t('quick.shortcut')}
          </div>
        </div>

        {/* Form fields */}
        <div className="quick-entry-form">
          <div className="form-group">
            <label>{t('quick.headword')}</label>
            <input
              ref={headwordRef}
              className="input-field input-lg"
              value={headword}
              onChange={(e) => setHeadword(e.target.value)}
              placeholder={t('quick.headword')}
            />
          </div>
          <div className="form-group">
            <label>{t('quick.translation')}</label>
            <input
              ref={definitionRef}
              className="input-field"
              value={definition}
              onChange={(e) => setDefinition(e.target.value)}
              placeholder={t('quick.translation')}
            />
          </div>
          <div className="form-group">
            <label>{t('quick.pos')} <span style={{ color: 'var(--text-muted)' }}>({t('quick.optional')})</span></label>
            <select ref={posRef} className="input-field" value={pos} onChange={(e) => setPos(e.target.value)}>
              <option value="">—</option>
              {POS_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => {
              setHeadword(''); setDefinition(''); setPos(''); recorder.reset();
            }}>
              {t('quick.skip')}
            </button>
            <button className="btn btn-primary" style={{ flex: 2 }} onClick={handleSave}>
              {t('quick.save_next')} (Enter)
            </button>
          </div>
        </div>

        {/* Recent entries */}
        {recentEntries.length > 0 && (
          <div className="quick-recent">
            <h4>{t('quick.recent')}</h4>
            <div className="quick-recent-list">
              {recentEntries.map((e, i) => (
                <div key={i} className="quick-recent-item">
                  <span className="quick-recent-hw">{e.headword}</span>
                  <span className="quick-recent-def">{e.definition || '—'}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
