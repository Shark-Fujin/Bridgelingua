import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from '../common/Modal';
import { useLexiconStore } from '../../stores/lexicon';

const POS_OPTIONS = ['noun', 'verb', 'adjective', 'adverb', 'pronoun', 'preposition', 'conjunction', 'interjection', 'other'];

interface Props {
  open: boolean;
  onClose: () => void;
  initialHeadword: string;
  initialTranslation?: string;
}

export default function SaveToLexiconModal({ open, onClose, initialHeadword, initialTranslation }: Props) {
  const { t } = useTranslation();
  const store = useLexiconStore();
  const [lexiconId, setLexiconId] = useState<number | null>(null);
  const [headword, setHeadword] = useState('');
  const [ipa, setIpa] = useState('');
  const [definition, setDefinition] = useState('');
  const [pos, setPos] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (open) {
      store.loadLexicons();
      setHeadword(initialHeadword);
      setDefinition(initialTranslation || '');
      setIpa('');
      setPos('');
      setSaved(false);
    }
  }, [open, initialHeadword, initialTranslation]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (store.lexicons.length > 0 && !lexiconId) {
      setLexiconId(store.lexicons[0].id);
    }
  }, [store.lexicons, lexiconId]);

  const handleSave = async () => {
    if (!lexiconId || !headword.trim()) return;
    setSaving(true);
    try {
      await store.createEntry(lexiconId, {
        headword: headword.trim(),
        ipa: ipa.trim(),
        definition: definition.trim(),
        pos,
      });
      setSaved(true);
      setTimeout(() => onClose(), 600);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={t('workspace.save_to_lexicon_title')}>
      {saved ? (
        <div style={{ textAlign: 'center', padding: 24, color: 'var(--success)', fontSize: 14 }}>
          {'\u2713'} {t('workspace.entry_saved')}
        </div>
      ) : (
        <>
          <div className="form-group">
            <label>{t('workspace.target_lexicon')}</label>
            {store.lexicons.length > 0 ? (
              <select
                className="input-field"
                value={lexiconId ?? ''}
                onChange={(e) => setLexiconId(Number(e.target.value))}
              >
                {store.lexicons.map((lex) => (
                  <option key={lex.id} value={lex.id}>
                    {lex.name} ({lex.source_lang} {'\u2192'} {lex.target_lang})
                  </option>
                ))}
              </select>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--text-tertiary)', padding: '8px 0' }}>
                {t('workspace.no_lexicons')}
              </div>
            )}
          </div>

          <div className="form-group">
            <label>{t('modal.headword')}</label>
            <input
              className="input-field"
              value={headword}
              onChange={(e) => setHeadword(e.target.value)}
              autoFocus
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label>IPA</label>
              <input className="input-field" value={ipa} onChange={(e) => setIpa(e.target.value)} placeholder="/.../" />
            </div>
            <div className="form-group">
              <label>{t('modal.pos')}</label>
              <select className="input-field" value={pos} onChange={(e) => setPos(e.target.value)}>
                <option value="">{'\u2014'}</option>
                {POS_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>{t('modal.definition')}</label>
            <input
              className="input-field"
              value={definition}
              onChange={(e) => setDefinition(e.target.value)}
              placeholder={t('workspace.definition_placeholder')}
            />
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <button className="btn btn-secondary btn-sm" onClick={onClose}>{t('common.cancel')}</button>
            <button
              className="btn btn-primary btn-sm"
              disabled={!lexiconId || !headword.trim() || saving}
              onClick={handleSave}
            >
              {saving ? t('common.saving') : t('modal.add_entry')}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
