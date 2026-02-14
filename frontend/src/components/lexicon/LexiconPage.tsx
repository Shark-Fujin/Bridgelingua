import { useEffect, useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useLexiconStore, type EntryItem, type CommunityEntryResult } from '../../stores/lexicon';
import api from '../../hooks/useApi';
import QuickEntryOverlay from './QuickEntryOverlay';

const POS_OPTIONS = ['noun', 'verb', 'adjective', 'adverb', 'pronoun', 'preposition', 'conjunction', 'interjection', 'other'];

export default function LexiconPage() {
  const { t } = useTranslation();
  const store = useLexiconStore();
  const [showNewDict, setShowNewDict] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSrcLang, setNewSrcLang] = useState('');
  const [newTgtLang, setNewTgtLang] = useState('');
  const [showEntryForm, setShowEntryForm] = useState(false);
  const [showContributeForm, setShowContributeForm] = useState(false);
  const [quickEntryOpen, setQuickEntryOpen] = useState(false);
  const [renamingDictId, setRenamingDictId] = useState<number | null>(null);
  const [dictRenameValue, setDictRenameValue] = useState('');
  const importRef = useRef<HTMLInputElement>(null);

  const isCommunity = store.communityTab === 'community';

  useEffect(() => {
    store.loadLexicons();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectLexicon = useCallback((id: number) => {
    store.selectLexicon(id);
    store.loadEntries(id);
    setShowContributeForm(false);
  }, [store]);

  const handleSearch = useCallback(() => {
    if (store.selectedLexiconId) {
      store.loadEntries(store.selectedLexiconId, store.search);
    }
  }, [store]);

  const handleCreateDict = async () => {
    if (!newName.trim() || !newSrcLang.trim() || !newTgtLang.trim()) {
      alert(t('lexicon.fill_all_fields') || 'Please fill in all fields: name, source language, and target language.');
      return;
    }
    try {
      await store.createLexicon(newName.trim(), newSrcLang.trim(), newTgtLang.trim());
      setNewName('');
      setNewSrcLang('');
      setNewTgtLang('');
      setShowNewDict(false);
    } catch {
      alert(t('lexicon.create_failed') || 'Failed to create dictionary.');
    }
  };

  const handleTogglePublic = useCallback(async (isPublic: boolean) => {
    if (!store.selectedLexiconId) return;
    await store.togglePublic(store.selectedLexiconId, isPublic);
  }, [store]);

  const handleImportCSV = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !store.selectedLexiconId) return;
    const count = await store.importCSV(store.selectedLexiconId, file);
    alert(t('lexicon.import_success', { count }));
    e.target.value = '';
  }, [store, t]);

  const handleDictRename = async () => {
    if (!renamingDictId || !dictRenameValue.trim()) {
      setRenamingDictId(null);
      return;
    }
    await store.renameLexicon(renamingDictId, dictRenameValue.trim());
    setRenamingDictId(null);
  };

  const handleDictDelete = async (id: number) => {
    if (!confirm(t('lexicon.confirm_delete_dict'))) return;
    await store.deleteLexicon(id);
  };

  const handleTabSwitch = useCallback((tab: 'my' | 'community') => {
    store.setCommunityTab(tab);
    setShowNewDict(false);
    setShowContributeForm(false);
    if (tab === 'community') {
      store.loadCommunityLexicons();
    }
  }, [store]);

  const handleCommunitySearch = useCallback(() => {
    store.searchCommunity(store.communitySearch);
  }, [store]);

  const selectedLex = isCommunity
    ? store.communityLexicons.find((l) => l.id === store.selectedLexiconId)
    : store.lexicons.find((l) => l.id === store.selectedLexiconId);
  const selectedEntry = store.entries.find((e) => e.id === store.selectedEntryId);

  return (
    <div className="page-enter lexicon-layout">
      {/* Dictionary sidebar */}
      <div className="dict-sidebar">
        <div className="dict-sidebar-header">
          <div className="dict-tab-switcher">
            <button
              className={`dict-tab${!isCommunity ? ' active' : ''}`}
              onClick={() => handleTabSwitch('my')}
            >
              {t('lexicon.my_dicts')}
            </button>
            <button
              className={`dict-tab${isCommunity ? ' active' : ''}`}
              onClick={() => handleTabSwitch('community')}
            >
              {t('lexicon.community')}
            </button>
          </div>
          {!isCommunity && (
            <button className="btn btn-sm btn-ghost" title="New dictionary" onClick={() => setShowNewDict(!showNewDict)}>+</button>
          )}
        </div>

        {!isCommunity && showNewDict && (
          <div className="new-dict-form">
            <input className="input-field" placeholder="Dictionary name" value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus />
            <input className="input-field" placeholder="Source language" value={newSrcLang} onChange={(e) => setNewSrcLang(e.target.value)} />
            <input className="input-field" placeholder="Target language" value={newTgtLang} onChange={(e) => setNewTgtLang(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleCreateDict()} />
            <button className="btn btn-sm btn-primary" onClick={handleCreateDict}>Create</button>
          </div>
        )}

        <div className="dict-list">
          {isCommunity ? (
            <>
              {store.communityLexicons.map((lex) => (
                <div
                  key={lex.id}
                  className={`dict-item${store.selectedLexiconId === lex.id ? ' active' : ''}`}
                  onClick={() => handleSelectLexicon(lex.id)}
                >
                  <div className="dict-name">{lex.name}</div>
                  <div className="dict-meta">
                    {lex.entry_count} entries {'\u00B7'} {lex.source_lang} {'\u2192'} {lex.target_lang}
                  </div>
                </div>
              ))}
              {store.communityLexicons.length === 0 && (
                <div style={{ padding: 12, fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center' }}>
                  {t('lexicon.no_community')}
                </div>
              )}
            </>
          ) : (
            <>
              {store.lexicons.map((lex) => (
                <div
                  key={lex.id}
                  className={`dict-item${store.selectedLexiconId === lex.id ? ' active' : ''}`}
                  onClick={() => handleSelectLexicon(lex.id)}
                >
                  {renamingDictId === lex.id ? (
                    <input
                      className="dict-rename-input"
                      value={dictRenameValue}
                      onChange={(e) => setDictRenameValue(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleDictRename(); if (e.key === 'Escape') setRenamingDictId(null); }}
                      onBlur={handleDictRename}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                    />
                  ) : (
                    <div className="dict-name">{lex.name}</div>
                  )}
                  <div className="dict-meta">
                    {lex.entry_count} entries {'\u00B7'} {lex.source_lang} {'\u2192'} {lex.target_lang}
                  </div>
                  {renamingDictId !== lex.id && (
                    <span className="dict-actions">
                      <button className="dict-action-btn" title={t('lexicon.rename_dict')} onClick={(e) => {
                        e.stopPropagation(); setRenamingDictId(lex.id); setDictRenameValue(lex.name);
                      }}>{'\u270E'}</button>
                      <button className="dict-action-btn danger" title={t('common.delete')} onClick={(e) => {
                        e.stopPropagation(); handleDictDelete(lex.id);
                      }}>{'\u00D7'}</button>
                    </span>
                  )}
                </div>
              ))}
              {store.lexicons.length === 0 && (
                <div style={{ padding: 12, fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center' }}>
                  No dictionaries yet
                </div>
              )}
            </>
          )}
        </div>

        {/* X-09: 社区共享开关（仅在"我的词典"模式且选中词典时显示） */}
        {!isCommunity && selectedLex && (
          <div className="dict-share">
            <span className="dict-share-label">{t('lexicon.sharing')}</span>
            <div className="dict-share-row">
              <span>{'\uD83D\uDD12'}</span>
              <span>{t('lexicon.private')}</span>
              <label className="toggle-switch" style={{ marginLeft: 'auto' }}>
                <input
                  type="checkbox"
                  checked={selectedLex.is_public}
                  onChange={(e) => handleTogglePublic(e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </label>
              <span>{t('lexicon.public')}</span>
            </div>
          </div>
        )}
      </div>

      {/* Entry list */}
      <div className="entry-main">
        {/* 社区模式 + 未选词典 → 全局搜索 */}
        {isCommunity && !store.selectedLexiconId ? (
          <CommunityGlobalSearch
            search={store.communitySearch}
            results={store.communityResults}
            loading={store.communityLoading}
            onSearchChange={(s) => store.setCommunitySearch(s)}
            onSearch={handleCommunitySearch}
            onSelectEntry={(entry) => {
              store.selectLexicon(entry.lexicon_id);
              store.loadEntries(entry.lexicon_id);
              store.selectEntry(entry.id);
            }}
          />
        ) : selectedLex ? (
          <>
            <div className="entry-toolbar">
              <div className="entry-search">
                <input
                  type="text"
                  placeholder={t('lexicon.search_placeholder')}
                  value={store.search}
                  onChange={(e) => store.setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
              </div>
              {!isCommunity && (
                <>
                  <button className="btn btn-sm btn-secondary" onClick={() => setShowEntryForm(true)}>
                    + {t('lexicon.new_entry')}
                  </button>
                  <button className="btn btn-sm btn-accent" onClick={() => setQuickEntryOpen(true)}>
                    {'\uD83C\uDFA4'} {t('lexicon.quick_entry')}
                  </button>
                </>
              )}
              {isCommunity && (
                <button className="btn btn-sm btn-secondary" onClick={() => setShowContributeForm(!showContributeForm)}>
                  + {t('lexicon.contribute')}
                </button>
              )}
              {!isCommunity && (
                <div className="toolbar-actions">
                  <input ref={importRef} type="file" accept=".csv,.xml,.lift" style={{ display: 'none' }} onChange={handleImportCSV} />
                  <button className="btn btn-sm btn-ghost" onClick={() => importRef.current?.click()}>
                    {'\uD83D\uDCE5'} {t('lexicon.import_csv_lift')}
                  </button>
                  <button className="btn btn-sm btn-ghost" onClick={() => {
                    if (!store.selectedLexiconId) return;
                    const base = api.defaults.baseURL || '';
                    window.open(`${base}/api/lexicons/${store.selectedLexiconId}/export?format=csv`, '_blank');
                  }}>
                    {'\uD83D\uDCE4'} {t('workspace.export')}
                  </button>
                </div>
              )}
            </div>

            {!isCommunity && showEntryForm && (
              <EntryForm
                lexiconId={selectedLex.id}
                onSave={() => setShowEntryForm(false)}
                onCancel={() => setShowEntryForm(false)}
              />
            )}

            {isCommunity && showContributeForm && (
              <ContributeForm
                lexiconId={selectedLex.id}
                onSave={() => setShowContributeForm(false)}
                onCancel={() => setShowContributeForm(false)}
              />
            )}

            <div className="entry-list">
              {store.entries.map((entry) => (
                <div
                  key={entry.id}
                  className={`entry-item${store.selectedEntryId === entry.id ? ' active' : ''}`}
                  onClick={() => store.selectEntry(entry.id)}
                >
                  <div>
                    <div className="entry-word">{entry.headword}</div>
                    {entry.ipa && <div className="entry-ipa">/{entry.ipa}/</div>}
                  </div>
                  <div className="entry-def">{entry.definition || '\u2014'}</div>
                  {entry.pos && <span className="entry-pos">{entry.pos}</span>}
                  {entry.audio_filename && <span className="entry-play" title="Play audio">{'\uD83D\uDD0A'}</span>}
                </div>
              ))}
              {store.entries.length === 0 && !store.loading && (
                <div className="entry-empty">No entries yet</div>
              )}
            </div>
          </>
        ) : (
          <div className="entry-empty">
            <div style={{ fontSize: 28, marginBottom: 8 }}>{'\uD83D\uDCDA'}</div>
            {t('lexicon.select_dict_hint') || 'Select or create a dictionary to get started'}
          </div>
        )}
      </div>

      {/* Entry detail panel */}
      {selectedEntry && selectedLex ? (
        <EntryDetail entry={selectedEntry} lexiconId={selectedLex.id} readOnly={isCommunity} />
      ) : (
        <div className="entry-detail">
          <div className="entry-detail-empty">
            <div className="entry-detail-empty-icon">{'\uD83D\uDCD6'}</div>
            <div className="entry-detail-empty-text">{t('lexicon.select_entry_hint') || 'Select an entry to view details'}</div>
          </div>
        </div>
      )}

      {quickEntryOpen && selectedLex && !isCommunity && (
        <QuickEntryOverlay
          lexiconId={selectedLex.id}
          srcLang={selectedLex.source_lang}
          onClose={() => {
            setQuickEntryOpen(false);
            if (store.selectedLexiconId) store.loadEntries(store.selectedLexiconId);
            store.loadLexicons();
          }}
        />
      )}
    </div>
  );
}

/* ── X-10: 社区全局搜索面板 ── */
function CommunityGlobalSearch({
  search, results, loading, onSearchChange, onSearch, onSelectEntry,
}: {
  search: string;
  results: CommunityEntryResult[];
  loading: boolean;
  onSearchChange: (s: string) => void;
  onSearch: () => void;
  onSelectEntry: (entry: CommunityEntryResult) => void;
}) {
  const { t } = useTranslation();

  return (
    <>
      <div className="community-search-bar">
        <input
          type="text"
          className="input-field"
          placeholder={t('lexicon.community_search_placeholder')}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSearch()}
        />
        <button className="btn btn-sm btn-primary" onClick={onSearch}>
          {t('lexicon.search_btn')}
        </button>
      </div>
      <div className="entry-list">
        {results.map((entry) => (
          <div
            key={`${entry.lexicon_id}-${entry.id}`}
            className="entry-item"
            onClick={() => onSelectEntry(entry)}
            style={{ cursor: 'pointer' }}
          >
            <div>
              <div className="entry-word">{entry.headword}</div>
              {entry.ipa && <div className="entry-ipa">/{entry.ipa}/</div>}
            </div>
            <div className="entry-def">{entry.definition || '\u2014'}</div>
            {entry.pos && <span className="entry-pos">{entry.pos}</span>}
            <span className="community-lexicon-badge">{entry.lexicon_name}</span>
          </div>
        ))}
        {results.length === 0 && !loading && (
          <div className="entry-empty">{t('lexicon.community_search_hint')}</div>
        )}
      </div>
    </>
  );
}

/* ── 新建词条表单 ── */
function EntryForm({ lexiconId, onSave, onCancel }: { lexiconId: number; onSave: () => void; onCancel: () => void }) {
  const { t } = useTranslation();
  const store = useLexiconStore();
  const [headword, setHeadword] = useState('');
  const [ipa, setIpa] = useState('');
  const [definition, setDefinition] = useState('');
  const [pos, setPos] = useState('');
  const [example, setExample] = useState('');

  const handleSubmit = async () => {
    if (!headword.trim()) return;
    await store.createEntry(lexiconId, { headword: headword.trim(), ipa, definition, pos, example });
    onSave();
  };

  return (
    <div className="entry-form-inline">
      <div className="form-group">
        <label>{t('modal.headword')}</label>
        <input className="input-field" value={headword} onChange={(e) => setHeadword(e.target.value)} autoFocus />
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>IPA</label>
          <input className="input-field" value={ipa} onChange={(e) => setIpa(e.target.value)} />
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
        <input className="input-field" value={definition} onChange={(e) => setDefinition(e.target.value)} />
      </div>
      <div className="form-group">
        <label>{t('lexicon.examples')}</label>
        <input className="input-field" value={example} onChange={(e) => setExample(e.target.value)} />
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button className="btn btn-secondary btn-sm" onClick={onCancel}>{t('common.cancel')}</button>
        <button className="btn btn-primary btn-sm" onClick={handleSubmit}>{t('modal.add_entry')}</button>
      </div>
    </div>
  );
}

/* ── X-10: 贡献词条表单 ── */
function ContributeForm({ lexiconId, onSave, onCancel }: { lexiconId: number; onSave: () => void; onCancel: () => void }) {
  const { t } = useTranslation();
  const store = useLexiconStore();
  const [headword, setHeadword] = useState('');
  const [ipa, setIpa] = useState('');
  const [definition, setDefinition] = useState('');
  const [pos, setPos] = useState('');
  const [example, setExample] = useState('');

  const handleSubmit = async () => {
    if (!headword.trim()) return;
    await store.contributeEntry(lexiconId, { headword: headword.trim(), ipa, definition, pos, example });
    setHeadword('');
    setIpa('');
    setDefinition('');
    setPos('');
    setExample('');
    onSave();
  };

  return (
    <div className="contribute-form">
      <div className="form-group">
        <label>{t('modal.headword')}</label>
        <input className="input-field" value={headword} onChange={(e) => setHeadword(e.target.value)} autoFocus />
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>IPA</label>
          <input className="input-field" value={ipa} onChange={(e) => setIpa(e.target.value)} />
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
        <input className="input-field" value={definition} onChange={(e) => setDefinition(e.target.value)} />
      </div>
      <div className="form-group">
        <label>{t('lexicon.examples')}</label>
        <input className="input-field" value={example} onChange={(e) => setExample(e.target.value)} />
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button className="btn btn-secondary btn-sm" onClick={onCancel}>{t('common.cancel')}</button>
        <button className="btn btn-primary btn-sm" onClick={handleSubmit}>{t('lexicon.contribute')}</button>
      </div>
    </div>
  );
}

/* ── X-05: 词条详情面板（含编辑模式 + X-10 只读模式）── */
function EntryDetail({ entry, lexiconId, readOnly = false }: { entry: EntryItem; lexiconId: number; readOnly?: boolean }) {
  const { t } = useTranslation();
  const store = useLexiconStore();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    headword: entry.headword,
    ipa: entry.ipa,
    definition: entry.definition,
    pos: entry.pos,
    example: entry.example,
    semantic_domain: entry.semantic_domain,
    notes: entry.notes,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEditing(false);
    setForm({
      headword: entry.headword,
      ipa: entry.ipa,
      definition: entry.definition,
      pos: entry.pos,
      example: entry.example,
      semantic_domain: entry.semantic_domain,
      notes: entry.notes,
    });
  }, [entry.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async () => {
    setSaving(true);
    await store.updateEntry(lexiconId, entry.id, form);
    setSaving(false);
    setEditing(false);
  };

  if (editing && !readOnly) {
    return (
      <div className="entry-detail">
        <div className="entry-detail-header">
          <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>{t('lexicon.edit_entry')}</h3>
        </div>
        <div className="entry-detail-body">
          <div className="form-group">
            <label>{t('modal.headword')}</label>
            <input className="input-field" value={form.headword} onChange={(e) => setForm({ ...form, headword: e.target.value })} autoFocus />
          </div>
          <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div className="form-group">
              <label>IPA</label>
              <input className="input-field" value={form.ipa} onChange={(e) => setForm({ ...form, ipa: e.target.value })} />
            </div>
            <div className="form-group">
              <label>{t('modal.pos')}</label>
              <select className="input-field" value={form.pos} onChange={(e) => setForm({ ...form, pos: e.target.value })}>
                <option value="">{'\u2014'}</option>
                {POS_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>{t('modal.definition')}</label>
            <input className="input-field" value={form.definition} onChange={(e) => setForm({ ...form, definition: e.target.value })} />
          </div>
          <div className="form-group">
            <label>{t('lexicon.examples')}</label>
            <input className="input-field" value={form.example} onChange={(e) => setForm({ ...form, example: e.target.value })} />
          </div>
          <div className="form-group">
            <label>{t('lexicon.semantic_domain')}</label>
            <input className="input-field" value={form.semantic_domain} onChange={(e) => setForm({ ...form, semantic_domain: e.target.value })} />
          </div>
          <div className="form-group">
            <label>{t('lexicon.notes')}</label>
            <textarea className="input-field" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
            <button className="btn btn-sm btn-secondary" onClick={() => setEditing(false)}>{t('common.cancel')}</button>
            <button className="btn btn-sm btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? t('common.saving') : t('lexicon.save_changes')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="entry-detail">
      <div className="entry-detail-header">
        <div className="headword">{entry.headword}</div>
        <div className="ipa-display">/{entry.ipa || '\u2026'}/</div>
        <div className="mt-2">
          <span className="badge badge-primary">{entry.pos || '\u2014'}</span>
          {entry.semantic_domain && (
            <> <span className="badge badge-secondary">{entry.semantic_domain}</span></>
          )}
        </div>
      </div>

      <div className="entry-detail-body">
        <div className="entry-field">
          <div className="entry-field-label">{t('lexicon.audio') || 'Audio'}</div>
          {entry.audio_filename ? (
            <>
              <div className="inline-player" style={{ margin: 0 }}>
                <button className="play-btn-inline" style={{ width: 28, height: 28, fontSize: 11 }}>{'\u25B6'}</button>
                <div className="progress-bar"><div className="progress" style={{ width: '0%' }} /></div>
                <span className="time-display">0:00</span>
              </div>
            </>
          ) : (
            <div className="entry-field-value" style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
              {t('lexicon.no_audio') || 'No audio recorded'}
            </div>
          )}
        </div>

        <hr className="divider" />

        <div className="entry-field">
          <div className="entry-field-label">{t('modal.definition')}</div>
          <div className="entry-field-value">{entry.definition || '\u2014'}</div>
        </div>

        <hr className="divider" />

        <div className="entry-field">
          <div className="entry-field-label">{t('lexicon.examples') || 'Examples'}</div>
          {entry.example ? (
            <div className="example-block">
              <div className="example-original">{entry.example}</div>
            </div>
          ) : (
            <div className="entry-field-value" style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
              {t('lexicon.no_examples') || 'No examples yet'}
            </div>
          )}
        </div>

        <hr className="divider" />

        <div className="entry-field">
          <div className="entry-field-label">{t('lexicon.semantic_domain') || 'Semantic Domain'}</div>
          <div className="entry-field-value">{entry.semantic_domain || '\u2014'}</div>
        </div>
        <div className="entry-field">
          <div className="entry-field-label">{t('lexicon.notes') || 'Notes'}</div>
          <div className="entry-field-value" style={entry.notes ? { color: 'var(--text-secondary)', fontStyle: 'italic' } : { color: 'var(--text-tertiary)' }}>
            {entry.notes || '\u2014'}
          </div>
        </div>

        <hr className="divider" />

        {!readOnly && (
          <div className="flex gap-2">
            <button className="btn btn-sm btn-secondary" onClick={() => setEditing(true)}>
              {'\u270E'} {t('common.edit')}
            </button>
            <button className="btn btn-sm btn-danger" onClick={() => store.deleteEntry(lexiconId, entry.id)}>
              {'\uD83D\uDDD1'} {t('common.delete')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
