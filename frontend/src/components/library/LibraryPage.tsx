import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import JSZip from 'jszip';
import { useLibraryStore, type AudioFile, type Folder } from '../../stores/library';
import { exportELAN, type ExportSegment } from '../../utils/exporters';
import api from '../../hooks/useApi';
import ExtractToLexiconModal from './ExtractToLexiconModal';

interface FolderNode extends Folder { children: FolderNode[] }

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-CA');
}

const LICENSE_OPTIONS = ['CC-BY', 'CC-BY-SA', 'CC-BY-NC', 'Restricted', 'Community-Only'];

export default function LibraryPage() {
  const { t } = useTranslation();
  const store = useLibraryStore();
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [checkedIds, setCheckedIds] = useState<Set<number>>(new Set());
  const [editFile, setEditFile] = useState<AudioFile | null>(null);
  const [extractFile, setExtractFile] = useState<AudioFile | null>(null);
  const [openFilter, setOpenFilter] = useState<'lang' | 'date' | 'tag' | null>(null);
  const [renamingTag, setRenamingTag] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [sortBy, setSortBy] = useState<string>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; folderId: number } | null>(null);
  const [renamingFolderId, setRenamingFolderId] = useState<number | null>(null);
  const [folderRenameValue, setFolderRenameValue] = useState('');
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    store.loadFolders();
    store.loadFiles();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!openFilter) return;
    const handleClick = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setOpenFilter(null);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [openFilter]);

  const handleFolderSelect = useCallback((id: number | null) => {
    store.selectFolder(id);
    store.loadFiles(id, store.search);
  }, [store]);

  const handleSearch = useCallback(() => {
    store.loadFiles(store.selectedFolderId, store.search);
  }, [store]);

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    await store.createFolder(newFolderName.trim(), store.selectedFolderId);
    setNewFolderName('');
    setShowNewFolder(false);
  };

  const toggleCheck = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = (checked: boolean) => {
    setCheckedIds(checked ? new Set(store.files.map((f) => f.id)) : new Set());
  };

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    store.files.forEach((f) => {
      if (f.tags) f.tags.split(',').forEach((t) => { const s = t.trim(); if (s) tags.add(s); });
    });
    return Array.from(tags).sort();
  }, [store.files]);

  const allLanguages = useMemo(() => {
    const langs = new Set<string>();
    store.files.forEach((f) => { if (f.language) langs.add(f.language); });
    return Array.from(langs).sort();
  }, [store.files]);

  const folderTree = useMemo(() => {
    const map = new Map<number, FolderNode>();
    const roots: FolderNode[] = [];
    store.folders.forEach((f) => map.set(f.id, { ...f, children: [] }));
    store.folders.forEach((f) => {
      const node = map.get(f.id)!;
      if (f.parent_id && map.has(f.parent_id)) {
        map.get(f.parent_id)!.children.push(node);
      } else {
        roots.push(node);
      }
    });
    return roots;
  }, [store.folders]);

  const sortedFiles = useMemo(() => {
    return [...store.files].sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case 'name': cmp = a.original_name.localeCompare(b.original_name); break;
        case 'language': cmp = a.language.localeCompare(b.language); break;
        case 'duration': cmp = a.duration - b.duration; break;
        case 'created_at': cmp = a.created_at.localeCompare(b.created_at); break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [store.files, sortBy, sortDir]);

  const toggleSort = (col: string) => {
    if (sortBy === col) { setSortDir((d) => d === 'asc' ? 'desc' : 'asc'); }
    else { setSortBy(col); setSortDir('asc'); }
  };

  const sortArrow = (col: string) => sortBy === col ? (sortDir === 'asc' ? ' \u25B2' : ' \u25BC') : '';

  const handleBatchExport = async () => {
    if (checkedIds.size === 0) return;
    const selected = store.files.filter((f) => checkedIds.has(f.id));
    const zip = new JSZip();
    for (const f of selected) {
      if (!f.transcription) continue;
      const segments: ExportSegment[] = f.transcription.segments.map((s) => ({
        start: s.start, end: s.end, text: s.text, translation: s.translation,
      }));
      const srcLang = f.transcription.source_lang || f.language || 'Transcription';
      const tgtLang = f.transcription.target_lang || 'Translation';
      const eaf = exportELAN(segments, srcLang, tgtLang);
      const name = f.original_name.replace(/\.[^.]+$/, '') + '.eaf';
      zip.file(name, eaf);
    }
    if (Object.keys(zip.files).length === 0) {
      alert(t('library.no_transcription_to_export') || 'No transcription data to export.');
      return;
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'library_export_elan.zip';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFolderContextMenu = (e: React.MouseEvent, folderId: number) => {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ x: e.clientX, y: e.clientY, folderId });
  };

  const handleFolderRename = async () => {
    if (!renamingFolderId || !folderRenameValue.trim()) {
      setRenamingFolderId(null);
      return;
    }
    await store.renameFolder(renamingFolderId, folderRenameValue.trim());
    setRenamingFolderId(null);
  };

  useEffect(() => {
    if (!ctxMenu) return;
    const hide = () => setCtxMenu(null);
    document.addEventListener('click', hide);
    return () => document.removeEventListener('click', hide);
  }, [ctxMenu]);

  const selectedFile = store.files.find((f) => f.id === store.selectedFileId) || null;
  const hasActiveFilters = store.filters.language || store.filters.tag || store.filters.dateFrom || store.filters.dateTo;

  const handleTagClick = useCallback((tag: string) => {
    if (store.filters.tag === tag) {
      store.setFilters({ tag: '' });
    } else {
      store.setFilters({ tag });
    }
  }, [store]);

  const handleRenameTag = async () => {
    if (!renamingTag || !renameValue.trim() || renameValue.trim() === renamingTag) {
      setRenamingTag(null);
      return;
    }
    await store.renameTag(renamingTag, renameValue.trim());
    setRenamingTag(null);
  };

  const handleDeleteTag = async (tag: string) => {
    if (!confirm(t('library.confirm_delete_tag', { tag }))) return;
    await store.deleteTag(tag);
  };

  return (
    <div className="page-enter library-layout">
      {/* Folder sidebar */}
      <div className="folder-sidebar">
        <div className="folder-sidebar-header">
          <h4>{t('library.folders')}</h4>
          <button className="btn btn-sm btn-ghost" title="New folder" onClick={() => setShowNewFolder(!showNewFolder)}>+</button>
        </div>

        {showNewFolder && (
          <div className="new-folder-form">
            <input
              className="input-field"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Folder name"
              onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
              autoFocus
            />
            <button className="btn btn-sm btn-primary" onClick={handleCreateFolder}>{'\u2713'}</button>
          </div>
        )}

        <div className="folder-tree">
          <div
            className={`folder-item${store.selectedFolderId === null ? ' active' : ''}`}
            onClick={() => handleFolderSelect(null)}
          >
            <span className="folder-icon">{'\uD83D\uDCC2'}</span>
            All Files
            <span className="folder-count">{store.files.length}</span>
          </div>
          {folderTree.map((node) => (
            <FolderTreeItem
              key={node.id}
              node={node}
              depth={0}
              selectedId={store.selectedFolderId}
              renamingId={renamingFolderId}
              renameValue={folderRenameValue}
              onSelect={handleFolderSelect}
              onContextMenu={handleFolderContextMenu}
              onRenameChange={setFolderRenameValue}
              onRenameSubmit={handleFolderRename}
              onRenameCancel={() => setRenamingFolderId(null)}
            />
          ))}
        </div>

        {ctxMenu && (
          <div className="context-menu" role="menu" style={{ left: ctxMenu.x, top: ctxMenu.y }}>
            <div className="context-menu-item" role="menuitem" tabIndex={0} onClick={() => { setShowNewFolder(true); setCtxMenu(null); }} onKeyDown={(e) => { if (e.key === 'Enter') { setShowNewFolder(true); setCtxMenu(null); } }}>
              + {t('library.new_subfolder')}
            </div>
            <div className="context-menu-item" role="menuitem" tabIndex={0} onClick={() => {
              const f = store.folders.find((f) => f.id === ctxMenu.folderId);
              if (f) { setRenamingFolderId(f.id); setFolderRenameValue(f.name); }
              setCtxMenu(null);
            }} onKeyDown={(e) => { if (e.key === 'Enter') {
              const f = store.folders.find((f) => f.id === ctxMenu.folderId);
              if (f) { setRenamingFolderId(f.id); setFolderRenameValue(f.name); }
              setCtxMenu(null);
            } }}>
              {'\u270E'} {t('library.rename_folder')}
            </div>
            <div className="context-menu-item danger" role="menuitem" tabIndex={0} onClick={() => {
              if (confirm(t('library.confirm_delete_folder'))) store.deleteFolder(ctxMenu.folderId);
              setCtxMenu(null);
            }} onKeyDown={(e) => { if (e.key === 'Enter') {
              if (confirm(t('library.confirm_delete_folder'))) store.deleteFolder(ctxMenu.folderId);
              setCtxMenu(null);
            } }}>
              <span aria-hidden="true">{'\uD83D\uDDD1'}</span> {t('common.delete')}
            </div>
          </div>
        )}

        {/* L-08: 标签管理 */}
        {allTags.length > 0 && (
          <div className="folder-tags">
            <h5>{t('library.tags')}</h5>
            <div className="folder-tags-list">
              {allTags.map((tag) => (
                <div key={tag} className="tag-managed">
                  {renamingTag === tag ? (
                    <input
                      className="tag-rename-input"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleRenameTag(); if (e.key === 'Escape') setRenamingTag(null); }}
                      onBlur={handleRenameTag}
                      autoFocus
                    />
                  ) : (
                    <>
                      <span
                        className={`tag clickable${store.filters.tag === tag ? ' active' : ''}`}
                        onClick={() => handleTagClick(tag)}
                      >
                        {tag}
                      </span>
                      <span className="tag-actions">
                        <button
                          className="tag-action-btn"
                          title={t('library.rename_tag')}
                          onClick={(e) => { e.stopPropagation(); setRenamingTag(tag); setRenameValue(tag); }}
                        >{'\u270E'}</button>
                        <button
                          className="tag-action-btn danger"
                          title={t('library.delete_tag')}
                          onClick={(e) => { e.stopPropagation(); handleDeleteTag(tag); }}
                        >{'\u00D7'}</button>
                      </span>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* File list main */}
      <div className="file-main">
        <div className="file-toolbar" ref={filterRef}>
          <div className="file-search">
            <span className="search-icon">{'\uD83D\uDD0D'}</span>
            <input
              type="text"
              placeholder={t('library.search_placeholder')}
              value={store.search}
              onChange={(e) => store.setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>

          {/* L-07: 筛选按钮 + 下拉面板 */}
          <div className="filter-wrapper">
            <button
              className={`filter-btn${store.filters.language ? ' active' : ''}`}
              onClick={() => setOpenFilter(openFilter === 'lang' ? null : 'lang')}
              aria-expanded={openFilter === 'lang'}
              aria-haspopup="listbox"
            >
              <span aria-hidden="true">{'\uD83C\uDF10'}</span> {store.filters.language || t('library.filter_lang')} <span aria-hidden="true">{'\u25BE'}</span>
            </button>
            {openFilter === 'lang' && (
              <div className="filter-dropdown">
                <div
                  className={`filter-option${!store.filters.language ? ' active' : ''}`}
                  onClick={() => { store.setFilters({ language: '' }); setOpenFilter(null); }}
                >
                  {t('library.all_languages')}
                </div>
                {allLanguages.map((lang) => (
                  <div
                    key={lang}
                    className={`filter-option${store.filters.language === lang ? ' active' : ''}`}
                    onClick={() => { store.setFilters({ language: lang }); setOpenFilter(null); }}
                  >
                    {lang}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="filter-wrapper">
            <button
              className={`filter-btn${store.filters.dateFrom || store.filters.dateTo ? ' active' : ''}`}
              onClick={() => setOpenFilter(openFilter === 'date' ? null : 'date')}
              aria-expanded={openFilter === 'date'}
            >
              <span aria-hidden="true">{'\uD83D\uDCC5'}</span> {t('library.filter_date')} <span aria-hidden="true">{'\u25BE'}</span>
            </button>
            {openFilter === 'date' && (
              <div className="filter-dropdown filter-date-dropdown">
                <label>{t('library.date_from')}</label>
                <input
                  type="date"
                  value={store.filters.dateFrom}
                  onChange={(e) => store.setFilters({ dateFrom: e.target.value })}
                />
                <label>{t('library.date_to')}</label>
                <input
                  type="date"
                  value={store.filters.dateTo}
                  onChange={(e) => store.setFilters({ dateTo: e.target.value })}
                />
              </div>
            )}
          </div>

          <div className="filter-wrapper">
            <button
              className={`filter-btn${store.filters.tag ? ' active' : ''}`}
              onClick={() => setOpenFilter(openFilter === 'tag' ? null : 'tag')}
              aria-expanded={openFilter === 'tag'}
              aria-haspopup="listbox"
            >
              <span aria-hidden="true">{'\uD83C\uDFF7'}</span> {store.filters.tag || t('library.filter_tag')} <span aria-hidden="true">{'\u25BE'}</span>
            </button>
            {openFilter === 'tag' && (
              <div className="filter-dropdown">
                <div
                  className={`filter-option${!store.filters.tag ? ' active' : ''}`}
                  onClick={() => { store.setFilters({ tag: '' }); setOpenFilter(null); }}
                >
                  {t('library.all_tags')}
                </div>
                {allTags.map((tag) => (
                  <div
                    key={tag}
                    className={`filter-option${store.filters.tag === tag ? ' active' : ''}`}
                    onClick={() => { store.setFilters({ tag }); setOpenFilter(null); }}
                  >
                    {tag}
                  </div>
                ))}
              </div>
            )}
          </div>

          {hasActiveFilters && (
            <button className="filter-btn clear" onClick={() => store.clearFilters()}>
              {'\u2715'} {t('library.clear_filters')}
            </button>
          )}

          <div className="toolbar-actions">
            <select
              className="btn btn-sm btn-secondary move-to-select"
              value=""
              disabled={checkedIds.size === 0}
              onChange={async (e) => {
                const val = e.target.value;
                if (!val) return;
                const targetFolderId = val === '__root__' ? null : Number(val);
                for (const fid of checkedIds) {
                  await store.moveFile(fid, targetFolderId);
                }
                setCheckedIds(new Set());
              }}
            >
              <option value="" disabled>{'\uD83D\uDCC2'} {t('library.move_to') || 'Move to...'} ({checkedIds.size})</option>
              <option value="__root__">{t('library.root_folder') || '/ Root'}</option>
              {store.folders.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
            <button className="btn btn-sm btn-secondary" onClick={handleBatchExport} disabled={checkedIds.size === 0}>
              {'\uD83D\uDCE5'} {t('library.export') || '导出'}
            </button>
          </div>
        </div>

        <div className="file-table">
          <table>
            <thead>
              <tr>
                <th className="cb">
                  <input
                    type="checkbox"
                    checked={store.files.length > 0 && checkedIds.size === store.files.length}
                    onChange={(e) => toggleAll(e.target.checked)}
                  />
                </th>
                <th className="sortable" onClick={() => toggleSort('name')}>{t('library.th_name')}{sortArrow('name')}</th>
                <th className="sortable" onClick={() => toggleSort('language')}>{t('library.th_language')}{sortArrow('language')}</th>
                <th className="sortable" onClick={() => toggleSort('duration')}>{t('library.th_duration')}{sortArrow('duration')}</th>
                <th className="sortable" onClick={() => toggleSort('created_at')}>{t('library.th_date')}{sortArrow('created_at')}</th>
                <th>{t('library.th_tags')}</th>
                <th>{t('library.th_license')}</th>
              </tr>
            </thead>
            <tbody>
              {sortedFiles.length === 0 && (
                <tr>
                  <td colSpan={7} className="empty-row">{t('library.no_files')}</td>
                </tr>
              )}
              {sortedFiles.map((f) => (
                <tr
                  key={f.id}
                  className={store.selectedFileId === f.id ? 'selected' : ''}
                  onClick={() => store.selectFile(f.id)}
                >
                  <td className="cb" onClick={(e) => toggleCheck(f.id, e)}>
                    <input type="checkbox" checked={checkedIds.has(f.id)} readOnly />
                  </td>
                  <td>
                    <div className="file-name-cell">
                      <span className="file-type-icon">{'\uD83C\uDFB5'}</span>
                      {f.original_name}
                    </div>
                  </td>
                  <td><span className="badge badge-primary">{f.language}</span></td>
                  <td>{formatDuration(f.duration)}</td>
                  <td>{formatDate(f.created_at)}</td>
                  <td>
                    {f.tags ? f.tags.split(',').map((tag) => (
                      <span key={tag.trim()} className="tag">{tag.trim()}</span>
                    )) : null}
                  </td>
                  <td><span className="badge badge-secondary">{f.license || '\u2014'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {selectedFile && (
          <FileDetailPanel
            file={selectedFile}
            folders={store.folders}
            onDelete={async () => {
              if (!confirm(t('library.confirm_delete_file') || 'Are you sure you want to delete this file?')) return;
              try { await store.deleteFile(selectedFile.id); } catch { alert('Failed to delete'); }
            }}
            onEdit={() => setEditFile(selectedFile)}
            onExtract={() => setExtractFile(selectedFile)}
            onMove={async (folderId) => {
              await store.moveFile(selectedFile.id, folderId);
            }}
          />
        )}
      </div>

      {/* L-06: 元数据编辑弹窗 */}
      {editFile && (
        <EditMetadataModal
          file={editFile}
          onClose={() => setEditFile(null)}
          onSave={async (data) => {
            await store.updateFile(editFile.id, data);
            setEditFile(null);
          }}
        />
      )}

      {/* X-07: 从转写提取词条 */}
      {extractFile && (
        <ExtractToLexiconModal
          file={extractFile}
          onClose={() => setExtractFile(null)}
        />
      )}
    </div>
  );
}

/* ── FolderTreeItem ── */
function FolderTreeItem({ node, depth, selectedId, renamingId, renameValue, onSelect, onContextMenu, onRenameChange, onRenameSubmit, onRenameCancel }: {
  node: FolderNode; depth: number; selectedId: number | null;
  renamingId: number | null; renameValue: string;
  onSelect: (id: number) => void; onContextMenu: (e: React.MouseEvent, id: number) => void;
  onRenameChange: (v: string) => void; onRenameSubmit: () => void; onRenameCancel: () => void;
}) {
  return (
    <>
      <div
        className={`folder-item${selectedId === node.id ? ' active' : ''}`}
        style={{ paddingLeft: 12 + depth * 16 }}
        onClick={() => onSelect(node.id)}
        onContextMenu={(e) => onContextMenu(e, node.id)}
      >
        <span className="folder-icon">{'\uD83D\uDCC1'}</span>
        {renamingId === node.id ? (
          <input
            className="tag-rename-input"
            value={renameValue}
            onChange={(e) => onRenameChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onRenameSubmit(); if (e.key === 'Escape') onRenameCancel(); }}
            onBlur={onRenameSubmit}
            onClick={(e) => e.stopPropagation()}
            autoFocus
          />
        ) : node.name}
      </div>
      {node.children.map((child) => (
        <FolderTreeItem
          key={child.id} node={child} depth={depth + 1}
          selectedId={selectedId} renamingId={renamingId} renameValue={renameValue}
          onSelect={onSelect} onContextMenu={onContextMenu}
          onRenameChange={onRenameChange} onRenameSubmit={onRenameSubmit} onRenameCancel={onRenameCancel}
        />
      ))}
    </>
  );
}

/* ── L-05 文件详情面板 ── */
function FileDetailPanel({ file, folders, onDelete, onEdit, onExtract, onMove }: {
  file: AudioFile; folders: Folder[];
  onDelete: () => void; onEdit: () => void; onExtract: () => void;
  onMove: (folderId: number | null) => void;
}) {
  const { t } = useTranslation();
  const [showTranscription, setShowTranscription] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);

  const audioUrl = `${api.defaults.baseURL || ''}/api/library/files/${file.id}/audio`;

  const handlePlay = () => {
    if (!audioRef.current) return;
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else { audioRef.current.play(); setPlaying(true); }
  };

  return (
    <div className="file-detail">
      <audio ref={audioRef} src={audioUrl} onEnded={() => setPlaying(false)} />
      <div className="file-detail-grid">
        <div className="file-detail-item">
          <label>{t('library.filename')}</label>
          <div className="value">{file.original_name}</div>
        </div>
        <div className="file-detail-item">
          <label>{t('library.language')}</label>
          <div className="value">{file.language}</div>
        </div>
        <div className="file-detail-item">
          <label>{t('library.speaker')}</label>
          <div className="value">{file.speaker || '\u2014'}</div>
        </div>
        <div className="file-detail-item">
          <label>{t('library.location')}</label>
          <div className="value">{file.location || '\u2014'}</div>
        </div>
        <div className="file-detail-item">
          <label>{t('library.duration_size')}</label>
          <div className="value">{formatDuration(file.duration)} · {formatSize(file.size_bytes)}</div>
        </div>
        <div className="file-detail-item">
          <label>{t('library.license')}</label>
          <div className="value">{file.license || '\u2014'}</div>
        </div>
        <div className="file-detail-item">
          <label>{t('library.transcription')}</label>
          <div className="value" style={file.transcription ? { color: 'var(--success)' } : undefined}>
            {file.transcription ? `\u2713 ${file.transcription.segments.length} segments` : '\u2014'}
          </div>
        </div>
        <div className="file-detail-item">
          <label>{t('library.care_consent')}</label>
          <div className="value">{file.notes || '\u2014'}</div>
        </div>
      </div>
      <div className="file-detail-actions">
        <button className="btn btn-sm btn-primary" onClick={handlePlay}>
          {playing ? '\u23F8' : '\u25B6'} {t('library.play')}
        </button>
        <button className="btn btn-sm btn-secondary" onClick={() => setShowTranscription(!showTranscription)} disabled={!file.transcription}>
          {'\uD83D\uDCDD'} {t('library.view_transcription')}
        </button>
        <button className="btn btn-sm btn-secondary" onClick={onExtract}>{'\uD83D\uDCD6'} {t('library.extract_lexicon')}</button>
        <button className="btn btn-sm btn-secondary" onClick={onEdit}>{'\u270E'} {t('library.edit_meta')}</button>
        <select
          className="btn btn-sm btn-secondary move-to-select"
          value=""
          onChange={(e) => {
            const val = e.target.value;
            if (val === '__root__') onMove(null);
            else if (val) onMove(Number(val));
          }}
        >
          <option value="" disabled>{'\uD83D\uDCC2'} {t('library.move_to') || 'Move to...'}</option>
          {file.folder_id !== null && <option value="__root__">{t('library.root_folder') || '/ Root'}</option>}
          {folders.filter((f) => f.id !== file.folder_id).map((f) => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </select>
        <button className="btn btn-sm btn-ghost" style={{ marginLeft: 'auto' }} onClick={onDelete}>{'\uD83D\uDDD1'} {t('common.delete')}</button>
      </div>
      {showTranscription && file.transcription && (
        <div className="transcription-preview">
          {file.transcription.segments.map((seg) => (
            <div key={seg.id} className="preview-segment">
              <span className="preview-ts">[{formatDuration(seg.start)}-{formatDuration(seg.end)}]</span>
              <span>{seg.text}</span>
              {seg.translation && <span className="preview-trans">{'\u2192'} {seg.translation}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── L-06 元数据编辑弹窗 ── */
function EditMetadataModal({
  file,
  onClose,
  onSave,
}: {
  file: AudioFile;
  onClose: () => void;
  onSave: (data: Partial<AudioFile>) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    language: file.language,
    speaker: file.speaker,
    location: file.location,
    license: file.license,
    tags: file.tags,
    notes: file.notes,
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{t('library.edit_meta_title')}</h3>
          <button className="modal-close" onClick={onClose}>{'\u00D7'}</button>
        </div>
        <div className="modal-body">
          <div className="form-grid">
            <div className="form-group">
              <label>{t('library.language')}</label>
              <input
                className="input-field"
                value={form.language}
                onChange={(e) => setForm({ ...form, language: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>{t('library.speaker')}</label>
              <input
                className="input-field"
                value={form.speaker}
                onChange={(e) => setForm({ ...form, speaker: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>{t('library.location')}</label>
              <input
                className="input-field"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>{t('library.license')}</label>
              <select
                className="input-field"
                value={form.license}
                onChange={(e) => setForm({ ...form, license: e.target.value })}
              >
                {LICENSE_OPTIONS.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
            <div className="form-group full-width">
              <label>{t('library.th_tags')}</label>
              <input
                className="input-field"
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
                placeholder="tag1, tag2, tag3"
              />
            </div>
            <div className="form-group full-width">
              <label>{t('library.notes')}</label>
              <textarea
                className="input-field"
                rows={3}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>{t('modal.cancel')}</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? t('common.saving') : t('modal.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
