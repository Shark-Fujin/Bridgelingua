import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLexiconStore } from '../../stores/lexicon';
import type { AudioFile } from '../../stores/library';

interface Props {
  file: AudioFile;
  onClose: () => void;
}

export default function ExtractToLexiconModal({ file, onClose }: Props) {
  const { t } = useTranslation();
  const lexStore = useLexiconStore();
  const segments = file.transcription?.segments || [];
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [targetLexId, setTargetLexId] = useState<number | null>(
    lexStore.lexicons[0]?.id ?? null,
  );
  const [saving, setSaving] = useState(false);

  if (!lexStore.lexicons.length) {
    lexStore.loadLexicons();
  }

  const toggle = (id: number) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = (on: boolean) => {
    setChecked(on ? new Set(segments.map((s) => s.id)) : new Set());
  };

  const handleExtract = async () => {
    if (!targetLexId || checked.size === 0) return;
    setSaving(true);
    const selected = segments.filter((s) => checked.has(s.id));
    for (const seg of selected) {
      await lexStore.createEntry(targetLexId, {
        headword: seg.text,
        definition: seg.translation,
      });
    }
    setSaving(false);
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{t('lexicon.extract_title')}</h3>
          <button className="modal-close" onClick={onClose}>{'\u00D7'}</button>
        </div>
        <div className="modal-body">
          {segments.length === 0 ? (
            <p style={{ color: 'var(--text-tertiary)', textAlign: 'center', padding: 20 }}>
              {t('lexicon.no_transcription')}
            </p>
          ) : (
            <>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label>{t('workspace.target_lexicon')}</label>
                <select
                  className="input-field"
                  value={targetLexId ?? ''}
                  onChange={(e) => setTargetLexId(Number(e.target.value))}
                >
                  {lexStore.lexicons.map((lex) => (
                    <option key={lex.id} value={lex.id}>{lex.name}</option>
                  ))}
                </select>
              </div>

              <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 8 }}>
                {t('lexicon.extract_hint')}
              </p>

              <div style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ padding: '6px 12px', borderBottom: '1px solid var(--border)', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={checked.size === segments.length && segments.length > 0}
                    onChange={(e) => toggleAll(e.target.checked)}
                    style={{ accentColor: 'var(--primary)' }}
                  />
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {t('lexicon.extract_count', { count: checked.size })}
                  </span>
                </div>
                {segments.map((seg) => (
                  <div
                    key={seg.id}
                    style={{
                      padding: '8px 12px',
                      borderBottom: '1px solid var(--border)',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 8,
                      cursor: 'pointer',
                      background: checked.has(seg.id) ? 'var(--primary-bg)' : undefined,
                    }}
                    onClick={() => toggle(seg.id)}
                  >
                    <input
                      type="checkbox"
                      checked={checked.has(seg.id)}
                      readOnly
                      style={{ marginTop: 3, accentColor: 'var(--primary)' }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{seg.text}</div>
                      {seg.translation && (
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{seg.translation}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>{t('modal.cancel')}</button>
          <button
            className="btn btn-primary"
            onClick={handleExtract}
            disabled={saving || checked.size === 0 || !targetLexId}
          >
            {saving ? t('common.saving') : t('lexicon.extract_btn')} ({checked.size})
          </button>
        </div>
      </div>
    </div>
  );
}
