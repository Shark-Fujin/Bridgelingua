import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from '../common/Modal';
import { useWorkspaceStore } from '../../stores/workspace';
import {
  exportJSON,
  exportCSV,
  exportSRT,
  exportPlainText,
  exportELAN,
  download,
  type ExportSegment,
} from '../../utils/exporters';

interface ExportModalProps {
  open: boolean;
  onClose: () => void;
}

type Format = 'json' | 'csv' | 'srt' | 'txt' | 'elan';

export default function ExportModal({ open, onClose }: ExportModalProps) {
  const { t } = useTranslation();
  const ws = useWorkspaceStore();
  const [format, setFormat] = useState<Format>('srt');

  const handleExport = () => {
    const segments: ExportSegment[] = ws.segments.map((s) => ({
      start: s.start,
      end: s.end,
      text: s.text,
      translation: s.translation || '',
    }));
    const srcLang = ws.srcLang?.code || 'unknown';
    const tgtLang = ws.tgtLang?.code || '';
    const base = `bridgelingua_${srcLang}`;

    switch (format) {
      case 'json':
        download(exportJSON(segments, srcLang, tgtLang), `${base}.json`, 'application/json');
        break;
      case 'csv':
        download(exportCSV(segments), `${base}.csv`, 'text/csv');
        break;
      case 'srt':
        download(exportSRT(segments), `${base}.srt`);
        break;
      case 'txt':
        download(exportPlainText(segments), `${base}.txt`);
        break;
      case 'elan':
        download(exportELAN(segments, srcLang, tgtLang), `${base}.eaf`, 'application/xml');
        break;
    }
    onClose();
  };

  const formats: { value: Format; label: string }[] = [
    { value: 'srt', label: 'SRT (Subtitles)' },
    { value: 'json', label: 'JSON' },
    { value: 'csv', label: 'CSV' },
    { value: 'txt', label: t('common.plain_text') || 'Plain Text' },
    { value: 'elan', label: 'ELAN XML (.eaf)' },
  ];

  return (
    <Modal open={open} onClose={onClose} title={t('workspace.export')}>
      <div className="export-options">
        {formats.map((f) => (
          <label key={f.value} className="export-option">
            <input
              type="radio"
              name="export-format"
              value={f.value}
              checked={format === f.value}
              onChange={() => setFormat(f.value)}
            />
            <span>{f.label}</span>
          </label>
        ))}
      </div>
      <div style={{ marginTop: 16, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button className="btn btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
        <button className="btn btn-primary" onClick={handleExport}>{t('workspace.export')}</button>
      </div>
    </Modal>
  );
}
