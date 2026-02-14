import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from '../common/Modal';
import { useWorkspaceStore } from '../../stores/workspace';
import { useSettingsStore } from '../../stores/settings';
import api from '../../hooks/useApi';

interface Folder {
  id: number;
  name: string;
  parent_id: number | null;
}

interface SaveToLibraryModalProps {
  open: boolean;
  onClose: () => void;
  recordingBlob?: Blob | null;
}

export default function SaveToLibraryModal({ open, onClose, recordingBlob }: SaveToLibraryModalProps) {
  const { t } = useTranslation();
  const ws = useWorkspaceStore();
  const settings = useSettingsStore();
  const [folderId, setFolderId] = useState<number | ''>('');
  const [folders, setFolders] = useState<Folder[]>([]);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [speaker, setSpeaker] = useState('');
  const [location, setLocation] = useState('');
  const [license, setLicense] = useState('CC-BY');
  const [tags, setTags] = useState('');
  const [notes, setNotes] = useState('');
  const [recordingDate, setRecordingDate] = useState('');
  const [isSacred, setIsSacred] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    api.get('/api/library/folders').then((r) => setFolders(r.data)).catch(() => {});
  }, [open]);

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    setCreatingFolder(true);
    try {
      const r = await api.post('/api/library/folders', { name: newFolderName.trim() });
      setFolders((prev) => [...prev, r.data]);
      setFolderId(r.data.id);
      setNewFolderName('');
    } catch { /* ignore */ }
    setCreatingFolder(false);
  };

  const handleSave = async () => {
    let audio: File | null = ws.audioFile;
    if (!audio && recordingBlob) {
      const base = recordingBlob.type.split(';')[0];
      const extMap: Record<string, string> = {
        'audio/webm': '.webm', 'audio/ogg': '.ogg', 'audio/mp4': '.m4a',
        'audio/mpeg': '.mp3', 'audio/aac': '.m4a', 'audio/wav': '.wav',
        'audio/x-m4a': '.m4a', 'audio/x-wav': '.wav', 'audio/flac': '.flac',
      };
      const ext = extMap[base] || '.wav';
      audio = new File([recordingBlob], `recording${ext}`, { type: recordingBlob.type });
    }
    if (!audio) return;
    setSaving(true);
    try {
      const form = new FormData();
      form.append('audio', audio);
      form.append('language', ws.srcLang?.code || '');
      form.append('speaker', speaker);
      form.append('location', location);
      form.append('license_type', license);
      form.append('tags', tags);
      form.append('notes', notes);
      form.append('source_lang', ws.srcLang?.code || '');
      form.append('target_lang', ws.tgtLang?.code || '');
      form.append('segments_json', JSON.stringify(ws.segments));
      if (folderId !== '') form.append('folder_id', String(folderId));
      if (recordingDate) form.append('recording_date', recordingDate);
      if (isSacred) form.append('is_sacred', 'true');
      await api.post('/api/library/files', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onClose();
    } catch {
      alert('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const licenses = ['CC-BY', 'CC-BY-SA', 'CC-BY-NC', 'Restricted', 'Community-Only'];
  const showSacredPrompt = settings.values.sensitive_prompt !== 'false';

  return (
    <Modal open={open} onClose={onClose} title={t('workspace.save_library')}>
      <div className="form-group">
        <label>{t('modal.folder') || 'Folder'}</label>
        <div style={{ display: 'flex', gap: 6 }}>
          <select className="input-field" style={{ flex: 1 }} value={folderId} onChange={(e) => setFolderId(e.target.value ? Number(e.target.value) : '')}>
            <option value="">{t('library.root_folder') || '/ (Root)'}</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
          <input
            className="input-field"
            style={{ flex: 1 }}
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder={t('library.new_folder_placeholder') || 'New folder name'}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
          />
          <button className="btn btn-secondary" onClick={handleCreateFolder} disabled={creatingFolder || !newFolderName.trim()} style={{ whiteSpace: 'nowrap' }}>
            + {t('library.folders') || 'Folder'}
          </button>
        </div>
      </div>
      <div className="form-group">
        <label>{t('library.speaker') || 'Speaker'}</label>
        <input className="input-field" value={speaker} onChange={(e) => setSpeaker(e.target.value)} />
      </div>
      <div className="form-group">
        <label>{t('library.location') || 'Location'}</label>
        <input className="input-field" value={location} onChange={(e) => setLocation(e.target.value)} />
      </div>
      <div className="form-group">
        <label>{t('library.recording_date')}</label>
        <input type="date" className="input-field" value={recordingDate} onChange={(e) => setRecordingDate(e.target.value)} />
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{t('library.recording_date_hint')}</div>
      </div>
      <div className="form-group">
        <label>{t('library.license') || 'License'}</label>
        <select className="input-field" value={license} onChange={(e) => setLicense(e.target.value)}>
          {licenses.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
      </div>
      <div className="form-group">
        <label>{t('library.tags') || 'Tags'}</label>
        <input className="input-field" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="comma separated" />
      </div>
      <div className="form-group">
        <label>{t('library.notes') || 'Notes'}</label>
        <textarea className="input-field" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      {showSacredPrompt && (
        <div className="form-group" style={{ padding: '10px 12px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', margin: 0 }}>
            <input type="checkbox" checked={isSacred} onChange={(e) => setIsSacred(e.target.checked)} style={{ marginTop: 3 }} />
            <div>
              <div style={{ fontWeight: 500, fontSize: 13 }}>{t('care.sacred_label')}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 2 }}>{t('care.sacred_hint')}</div>
            </div>
          </label>
        </div>
      )}
      <div style={{ marginTop: 16, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button className="btn btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? t('common.saving') || 'Saving...' : t('workspace.save_library')}
        </button>
      </div>
    </Modal>
  );
}
