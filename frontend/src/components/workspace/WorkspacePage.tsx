import { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import LanguageSelector from '../common/LanguageSelector';
import { useLanguagesStore } from '../../stores/languages';
import { useWorkspaceStore } from '../../stores/workspace';
import { useSettingsStore } from '../../stores/settings';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';
import { useAudioPlayer } from '../../hooks/useAudioPlayer';
import api from '../../hooks/useApi';
import { compressAudio, needsCompression } from '../../utils/audioCompressor';
import ExportModal from './ExportModal';
import SaveToLibraryModal from './SaveToLibraryModal';
import SaveToLexiconModal from './SaveToLexiconModal';

const ACCEPT = '.wav,.mp3,.flac,.ogg,.m4a,.webm,.mp4';
const MAX_SIZE = 100 * 1024 * 1024; // 100MB

const MIME_EXT: Record<string, string> = {
  'audio/webm': '.webm', 'audio/ogg': '.ogg', 'audio/mp4': '.m4a',
  'audio/mpeg': '.mp3', 'audio/wav': '.wav', 'audio/x-m4a': '.m4a',
  'audio/aac': '.m4a', 'audio/x-wav': '.wav', 'audio/flac': '.flac',
};

function blobToFile(blob: Blob): File {
  const base = blob.type.split(';')[0];
  const ext = MIME_EXT[base] || '.wav';
  return new File([blob], `recording${ext}`, { type: blob.type });
}

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function formatTimestamp(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export default function WorkspacePage() {
  const { t } = useTranslation();
  const { asr, translation, load } = useLanguagesStore();
  const ws = useWorkspaceStore();
  const settingsStore = useSettingsStore();
  const recorder = useAudioRecorder();
  const player = useAudioPlayer();
  const [audioTab, setAudioTab] = useState<'upload' | 'record'>('upload');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [audioDuration, setAudioDuration] = useState(0);
  const [exportOpen, setExportOpen] = useState(false);
  const [saveLibOpen, setSaveLibOpen] = useState(false);
  const [saveLexOpen, setSaveLexOpen] = useState(false);
  const [lexInitWord, setLexInitWord] = useState('');
  const [lexInitTrans, setLexInitTrans] = useState('');
  const [selTooltip, setSelTooltip] = useState<{ x: number; y: number; text: string } | null>(null);
  const dualColRef = useRef<HTMLDivElement>(null);
  const audioUrlRef = useRef<string>('');
  const [compressing, setCompressing] = useState(false);
  const [originalSize, setOriginalSize] = useState(0);
  const [unsupportedPair, setUnsupportedPair] = useState(false);

  const initialLoad = useRef(false);
  useEffect(() => {
    if (!initialLoad.current) {
      initialLoad.current = true;
      load();
      settingsStore.load();
    }
  }, [load, settingsStore]);

  /* S-07: 从设置中读取默认源/目标语言 */
  useEffect(() => {
    if (!asr.length || !translation.length) return;
    const srcCode = settingsStore.values.default_src_lang;
    const tgtCode = settingsStore.values.default_tgt_lang;
    if (srcCode && !ws.srcLang) {
      const found = asr.find((l) => l.code === srcCode);
      if (found) ws.setSrcLang(found);
    }
    if (tgtCode && !ws.tgtLang) {
      const found = translation.find((l) => l.code === tgtCode);
      if (found) ws.setTgtLang(found);
    }
  }, [asr, translation, settingsStore.values.default_src_lang, settingsStore.values.default_tgt_lang]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    const src = ws.audioFile || recorder.blob;
    if (src) {
      const url = URL.createObjectURL(src);
      audioUrlRef.current = url;
      player.load(url);
    }
  }, [ws.audioFile, recorder.blob]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const hide = (e: MouseEvent) => {
      if (dualColRef.current && !dualColRef.current.contains(e.target as Node)) {
        setSelTooltip(null);
      }
    };
    document.addEventListener('mousedown', hide);
    return () => document.removeEventListener('mousedown', hide);
  }, []);

  const handleFileSelect = useCallback(async (file: File) => {
    if (file.size > MAX_SIZE) { alert(t('workspace.file_too_large')); return; }

    const setFileAndDuration = (f: File) => {
      ws.setAudioFile(f);
      const url = URL.createObjectURL(f);
      const audio = new Audio(url);
      audio.onloadedmetadata = () => {
        setAudioDuration(audio.duration);
        URL.revokeObjectURL(url);
      };
    };

    if (needsCompression(file)) {
      setOriginalSize(file.size);
      setCompressing(true);
      try {
        const compressed = await compressAudio(file);
        setFileAndDuration(compressed);
      } catch {
        setFileAndDuration(file);
      } finally {
        setCompressing(false);
      }
    } else {
      setOriginalSize(0);
      setFileAndDuration(file);
    }
  }, [ws]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const handleTranscribe = async () => {
    let audio = ws.audioFile;
    if (!audio && recorder.blob) {
      audio = blobToFile(recorder.blob);
      ws.setAudioFile(audio);
    }
    if (!audio || !ws.srcLang) return;
    ws.setStatus('uploading');
    try {
      const form = new FormData();
      form.append('audio', audio);
      form.append('language', ws.srcLang.code);
      ws.setStatus('transcribing');
      const { data } = await api.post('/api/transcribe', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      ws.setSegments(data.segments || []);
      if (ws.tgtLang) {
        ws.setStatus('translating');
        setUnsupportedPair(false);
        try {
          const { data: transData } = await api.post('/api/translate', {
            segments: data.segments,
            source_lang: ws.srcLang.code,
            target_lang: ws.tgtLang.code,
          });
          const merged = (data.segments || []).map((seg: any, i: number) => ({
            ...seg,
            translation: transData.translations?.[i] || '',
          }));
          ws.setSegments(merged);
        } catch (transErr: any) {
          const detail = transErr?.response?.data?.detail || '';
          if (/unsupported|not.*support|不支持/i.test(detail) || transErr?.response?.status === 400) {
            setUnsupportedPair(true);
          }
        }
      }
      ws.setStatus('done');
    } catch (err: any) {
      const isTimeout = err?.code === 'ECONNABORTED' || err?.message?.includes('timeout');
      const isNetwork = !err?.response && err?.message === 'Network Error';
      if (isTimeout) {
        ws.setError(t('workspace.network_timeout'));
      } else if (isNetwork) {
        ws.setError(t('workspace.network_error'));
      } else {
        ws.setError(err?.response?.data?.detail || 'Transcription failed');
      }
    }
  };

  const handleRetranslate = async (index: number) => {
    const seg = ws.segments[index];
    if (!seg || !ws.srcLang || !ws.tgtLang) return;
    try {
      const { data } = await api.post('/api/translate', {
        segments: [{ start: seg.start, end: seg.end, text: seg.text }],
        source_lang: ws.srcLang.code,
        target_lang: ws.tgtLang.code,
      });
      const newTrans = data.translations?.[0] || '';
      ws.updateSegmentTranslation(index, newTrans);
    } catch { /* silent */ }
  };

  const handleCopyAll = () => {
    const text = ws.segments.map((seg) => {
      const ts = `[${formatTimestamp(seg.start)} - ${formatTimestamp(seg.end)}]`;
      return `${ts}\n${seg.text}${seg.translation ? `\n${seg.translation}` : ''}`;
    }).join('\n\n');
    navigator.clipboard.writeText(text);
  };

  const cycleSpeed = () => {
    const speeds = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
    const idx = speeds.indexOf(player.speed);
    player.setSpeed(speeds[(idx + 1) % speeds.length]);
  };

  const handleSegPlay = useCallback((start: number) => {
    player.seek(start);
    player.play();
  }, [player]);

  const handleTextSelect = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) {
      setSelTooltip(null);
      return;
    }
    const container = dualColRef.current;
    if (!container || !container.contains(sel.anchorNode)) {
      setSelTooltip(null);
      return;
    }
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    setSelTooltip({
      x: rect.left - containerRect.left + rect.width / 2,
      y: rect.top - containerRect.top - 36,
      text: sel.toString().trim(),
    });
  }, []);

  const openLexiconFromSelection = useCallback(() => {
    if (!selTooltip) return;
    const word = selTooltip.text;
    const seg = ws.segments.find((s) => s.text.includes(word));
    setLexInitWord(word);
    setLexInitTrans(seg?.translation || '');
    setSaveLexOpen(true);
    setSelTooltip(null);
    window.getSelection()?.removeAllRanges();
  }, [selTooltip, ws.segments]);

  const openLexiconFromAction = useCallback(() => {
    setLexInitWord('');
    setLexInitTrans('');
    setSaveLexOpen(true);
  }, []);

  const totalDuration = ws.segments.length > 0
    ? ws.segments[ws.segments.length - 1]?.end || 0
    : audioDuration;

  const hasAudio = ws.audioFile !== null || recorder.blob !== null;

  return (
    <div className="page-enter">
      {/* Draft recovery banner */}
      {ws.hasDraft && ws.segments.length === 0 && (
        <div className="draft-banner">
          <span>{t('workspace.draft_found')}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-sm btn-primary" onClick={ws.restoreDraft}>{t('workspace.restore_draft')}</button>
            <button className="btn btn-sm btn-ghost" onClick={ws.dismissDraft}>{t('workspace.dismiss_draft')}</button>
          </div>
        </div>
      )}

      {/* Input card */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body">
          {/* Language selectors */}
          <div className="lang-selector-row">
            <LanguageSelector
              languages={asr}
              value={ws.srcLang}
              onChange={ws.setSrcLang}
              placeholder={t('workspace.src_placeholder')}
            />
            <button
              className="lang-swap-btn"
              onClick={() => {
                const s = ws.srcLang;
                ws.setSrcLang(ws.tgtLang);
                ws.setTgtLang(s);
              }}
              title="Swap languages"
            >
              {'\u21C4'}
            </button>
            <LanguageSelector
              languages={translation}
              value={ws.tgtLang}
              onChange={ws.setTgtLang}
              placeholder={t('workspace.tgt_placeholder')}
            />
          </div>

          {/* Audio tabs */}
          <div className="audio-input-section">
            <div className="audio-tabs">
              <div
                role="tab"
                tabIndex={0}
                aria-selected={audioTab === 'upload'}
                className={`audio-tab${audioTab === 'upload' ? ' active' : ''}`}
                onClick={() => setAudioTab('upload')}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setAudioTab('upload'); } }}
              >
                <span aria-hidden="true">{'\uD83D\uDCC1'}</span> <span>{t('workspace.upload')}</span>
              </div>
              <div
                role="tab"
                tabIndex={0}
                aria-selected={audioTab === 'record'}
                className={`audio-tab${audioTab === 'record' ? ' active' : ''}`}
                onClick={() => setAudioTab('record')}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setAudioTab('record'); } }}
              >
                <span aria-hidden="true">{'\uD83C\uDFA4'}</span> <span>{t('workspace.record')}</span>
              </div>
            </div>

            {/* Upload tab */}
            {audioTab === 'upload' && !ws.audioFile && !compressing && (
              <div
                className="upload-zone"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
              >
                <div className="upload-icon">{'\uD83D\uDCC1'}</div>
                <div className="upload-text">{t('workspace.upload_text')}</div>
                <div className="upload-hint">{t('workspace.upload_hint')}</div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPT}
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileSelect(f);
                  }}
                />
              </div>
            )}

            {audioTab === 'upload' && compressing && (
              <div className="upload-zone" style={{ cursor: 'default', borderStyle: 'solid', borderColor: 'var(--primary)' }}>
                <div className="compress-spinner" />
                <div className="upload-text">{t('workspace.compressing')}</div>
                <div className="upload-hint">
                  {t('workspace.compressing_hint', { size: (originalSize / (1024 * 1024)).toFixed(0) })}
                </div>
              </div>
            )}

            {audioTab === 'upload' && ws.audioFile && (
              <div className="audio-loaded">
                <span className="file-icon">{'\uD83C\uDFB5'}</span>
                <div className="file-info">
                  <div className="file-name">{ws.audioFile.name}</div>
                  <div className="file-meta">
                    {formatTime(audioDuration)} &middot; {(ws.audioFile.size / (1024 * 1024)).toFixed(1)} MB
                    {originalSize > 0 && (
                      <span className="compressed-tag">
                        {t('workspace.compressed', { from: (originalSize / (1024 * 1024)).toFixed(0) })}
                      </span>
                    )}
                  </div>
                </div>
                <button className="remove-btn" onClick={() => { ws.setAudioFile(null); setAudioDuration(0); }} title="Remove">
                  {'\u2715'}
                </button>
              </div>
            )}

            {/* Record tab */}
            {audioTab === 'record' && (
              <div className="record-zone">
                <button
                  className={`record-btn${recorder.recording ? ' recording' : ''}`}
                  onClick={() => {
                    if (recorder.recording) {
                      recorder.stop();
                    } else {
                      recorder.reset();
                      recorder.start();
                    }
                  }}
                >
                  {recorder.recording ? '\u23F9' : '\uD83C\uDFA4'}
                </button>
                <div className="record-timer">{formatTime(recorder.duration)}</div>
                <div className="record-hint">{t('workspace.record_hint')}</div>

                {/* Waveform visualization */}
                {recorder.recording && (
                  <div className="waveform">
                    {Array.from({ length: 20 }, (_, i) => (
                      <div key={i} className="bar" style={{ animationDelay: `${i * 0.05}s` }} />
                    ))}
                  </div>
                )}

                {recorder.blob && !recorder.recording && (
                  <div style={{ marginTop: 16 }}>
                    <audio controls src={URL.createObjectURL(recorder.blob)} style={{ maxWidth: '100%' }} />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Model selectors */}
          <div className="model-row">
            <div className="model-select">
              <label>{t('workspace.asr_model')}</label>
              <select className="input-field">
                <option value="omniasr">OmniASR (1600+ languages)</option>
                <option value="whisper" disabled>Whisper (99 languages) — coming soon</option>
                <option value="mms" disabled>MMS (1100+ languages) — coming soon</option>
              </select>
            </div>
            <div className="model-select">
              <label>{t('workspace.trans_model')}</label>
              <select className="input-field">
                <option value="nllb">NLLB-200 (200 languages)</option>
                <option value="seamless" disabled>SeamlessM4T — coming soon</option>
              </select>
            </div>
          </div>

          {/* Transcribe button */}
          <div className="transcribe-btn-row">
            <button
              className="btn btn-primary btn-lg transcribe-btn"
              disabled={!hasAudio || !ws.srcLang || ws.status === 'transcribing' || ws.status === 'translating'}
              onClick={handleTranscribe}
            >
              {ws.status === 'transcribing' || ws.status === 'translating' ? (
                <span>{ws.status === 'transcribing' ? 'Transcribing...' : 'Translating...'}</span>
              ) : (
                <><span>{'\u25B6'}</span> <span>{t('workspace.transcribe')}</span></>
              )}
            </button>
          </div>

          {(ws.status === 'transcribing' || ws.status === 'translating') && (
            <div className="transcribe-progress" role="status" aria-live="polite">
              <div className="transcribe-progress-bar" aria-hidden="true" />
              <span className="transcribe-progress-text">
                {ws.status === 'transcribing' ? t('workspace.transcribing') : t('workspace.translating')}
              </span>
            </div>
          )}
        </div>
      </div>

      {unsupportedPair && (
        <div className="card" style={{ marginTop: 16, borderColor: 'var(--warning, #f59e0b)' }}>
          <div className="card-body" style={{ color: 'var(--warning, #d97706)', fontSize: 13 }}>
            {t('workspace.unsupported_pair')}
          </div>
        </div>
      )}

      {/* Results section */}
      {ws.segments.length > 0 && (
        <div className="card">
          <div className="card-body">
            <div className="results-header">
              <h3>
                <span>{t('workspace.results_title')}</span>
                <span className="badge badge-primary">{ws.segments.length} segments</span>
                {totalDuration > 0 && <span className="badge badge-secondary">{formatTime(totalDuration)}</span>}
              </h3>
              <div className="flex gap-2">
                <button className="btn btn-sm btn-ghost" onClick={handleCopyAll}>
                  {'\uD83D\uDCCB'} {t('workspace.copy_all')}
                </button>
              </div>
            </div>

            {/* Inline audio player */}
            <div className="inline-player">
              <button className="play-btn-inline" onClick={player.toggle}>
                {player.playing ? '\u23F8' : '\u25B6'}
              </button>
              <div
                className="progress-bar"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const ratio = (e.clientX - rect.left) / rect.width;
                  player.seek(ratio * (player.duration || totalDuration));
                }}
              >
                <div
                  className="progress"
                  style={{ width: `${(player.duration > 0 ? (player.currentTime / player.duration) * 100 : 0)}%` }}
                />
              </div>
              <span className="time-display">
                {formatTime(player.currentTime)} / {formatTime(player.duration || totalDuration)}
              </span>
              <button className="speed-btn" onClick={cycleSpeed}>{player.speed.toFixed(1)}x</button>
            </div>

            {/* Dual column results */}
            <div className="dual-column" ref={dualColRef} onMouseUp={handleTextSelect} style={{ position: 'relative' }}>
              <div className="dual-col-header">{t('workspace.col_original')}{ws.srcLang ? ` (${ws.srcLang.name})` : ''}</div>
              <div className="dual-col-header">{t('workspace.col_translation')}{ws.tgtLang ? ` (${ws.tgtLang.name})` : ''}</div>
              {ws.segments.map((seg, i) => (
                <div className="segment-row" key={i}>
                  {/* Original */}
                  <div className={`segment-cell${seg.confidence !== undefined && seg.confidence < 0.6 ? ' low-confidence' : ''}`}>
                    <div className="timestamp">
                      <span className="play-seg" role="button" tabIndex={0} title="Play segment" aria-label={`Play from ${formatTimestamp(seg.start)}`} onClick={() => handleSegPlay(seg.start)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSegPlay(seg.start); } }}>{'\u25B6'}</span>
                      {formatTimestamp(seg.start)} – {formatTimestamp(seg.end)}
                      {seg.confidence !== undefined && (
                        <span className={`confidence-tag${seg.confidence < 0.6 ? ' low' : seg.confidence < 0.8 ? ' mid' : ''}`}>
                          {Math.round(seg.confidence * 100)}%
                        </span>
                      )}
                    </div>
                    <div
                      className="seg-text"
                      contentEditable={false}
                      suppressContentEditableWarning
                      onDoubleClick={(e) => {
                        const el = e.currentTarget;
                        el.contentEditable = 'true';
                        el.focus();
                      }}
                      onBlur={(e) => {
                        const el = e.currentTarget;
                        el.contentEditable = 'false';
                        ws.updateSegmentText(i, el.textContent || '');
                      }}
                    >
                      {seg.text}
                    </div>
                    <div className="edit-hint">{t('workspace.edit_hint')}</div>
                  </div>
                  {/* Translation */}
                  <div className="segment-cell">
                    <div className="timestamp">
                      {formatTimestamp(seg.start)} – {formatTimestamp(seg.end)}
                    </div>
                    <div className="seg-text">{seg.translation || '\u2014'}</div>
                    <button className="retranslate-btn" onClick={() => handleRetranslate(i)}>{'\u21BB'} {t('workspace.retranslate')}</button>
                  </div>
                </div>
              ))}
              {selTooltip && (
                <div
                  className="selection-tooltip"
                  style={{ left: selTooltip.x, top: selTooltip.y, transform: 'translateX(-50%)' }}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={openLexiconFromSelection}
                >
                  {'\uD83D\uDCD6'} {t('workspace.save_lexicon')}
                </div>
              )}
            </div>

            {/* Action bar */}
            <div className="action-bar">
              <button className="btn btn-secondary" onClick={() => setExportOpen(true)}>
                {'\uD83D\uDCE5'} <span>{t('workspace.export')}</span>
              </button>
              <button className="btn btn-secondary" onClick={() => setSaveLibOpen(true)}>
                {'\uD83D\uDCBE'} <span>{t('workspace.save_library')}</span>
              </button>
              <button className="btn btn-primary" onClick={openLexiconFromAction}>
                {'\uD83D\uDCD6'} <span>{t('workspace.save_lexicon')}</span>
              </button>
            </div>

            <ExportModal open={exportOpen} onClose={() => setExportOpen(false)} />
            <SaveToLibraryModal open={saveLibOpen} onClose={() => setSaveLibOpen(false)} recordingBlob={recorder.blob} />
            <SaveToLexiconModal
              open={saveLexOpen}
              onClose={() => setSaveLexOpen(false)}
              initialHeadword={lexInitWord}
              initialTranslation={lexInitTrans}
            />
          </div>
        </div>
      )}

      {ws.status === 'error' && (
        <div className="card" style={{ marginTop: 16, borderColor: 'var(--danger)' }}>
          <div className="card-body" style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ flex: 1 }}>{ws.errorMessage}</span>
            <button className="btn btn-sm btn-primary" onClick={() => { ws.setStatus('idle'); handleTranscribe(); }}>{t('workspace.retry')}</button>
            <button className="btn btn-sm btn-ghost" onClick={() => ws.setStatus('idle')}>{t('common.close')}</button>
          </div>
        </div>
      )}
    </div>
  );
}
