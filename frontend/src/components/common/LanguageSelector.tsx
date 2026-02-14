import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { Language } from '../../types/language';

const REGIONS = ['all', 'africa', 'americas', 'asia', 'europe', 'pacific'] as const;
const REGION_LABELS: Record<string, string> = {
  all: '\u{1F30D} All',
  africa: 'Africa',
  americas: 'Americas',
  asia: 'Asia',
  europe: 'Europe',
  pacific: 'Pacific',
};

interface Props {
  languages: Language[];
  value: Language | null;
  onChange: (lang: Language) => void;
  placeholder?: string;
}

export default function LanguageSelector({ languages, value, onChange, placeholder }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [region, setRegion] = useState<string>('all');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = languages.filter((lang) => {
    if (region !== 'all' && lang.region !== region) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      lang.name.toLowerCase().includes(q) ||
      (lang.native || '').toLowerCase().includes(q) ||
      (lang.iso639_3 || '').toLowerCase().includes(q) ||
      lang.code.toLowerCase().includes(q)
    );
  });

  const displayValue = value ? `${value.name} (${value.iso639_3 || value.code.split('_')[0]})` : '';

  return (
    <div className="lang-selector" ref={ref}>
      <input
        type="text"
        className="lang-selector-input"
        placeholder={placeholder || t('workspace.src_placeholder')}
        value={displayValue}
        readOnly
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen((v) => !v); } }}
      />
      <span className="arrow" aria-hidden="true">{'\u25BE'}</span>
      {open && (
        <div className="lang-dropdown" style={{ display: 'block' }}>
          <div className="lang-dropdown-search">
            <input
              type="text"
              placeholder={t('workspace.search_lang_placeholder', { count: languages.length })}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
          {languages.some((l) => l.region) && (
            <div className="lang-region-tabs" role="tablist">
              {REGIONS.map((r) => (
                <div
                  key={r}
                  role="tab"
                  tabIndex={0}
                  aria-selected={region === r}
                  className={`lang-region-tab${region === r ? ' active' : ''}`}
                  onClick={() => setRegion(r)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setRegion(r); } }}
                >
                  {REGION_LABELS[r]}
                </div>
              ))}
            </div>
          )}
          <div style={{ maxHeight: 220, overflowY: 'auto' }} role="listbox">
            {filtered.map((lang) => (
              <div
                key={lang.code}
                className="lang-option"
                role="option"
                tabIndex={0}
                aria-selected={value?.code === lang.code}
                onClick={() => { onChange(lang); setOpen(false); setSearch(''); }}
                onKeyDown={(e) => { if (e.key === 'Enter') { onChange(lang); setOpen(false); setSearch(''); } }}
              >
                <div>
                  <span className="lang-name">{lang.name}</span>
                  {lang.native && lang.native !== lang.name && (
                    <span style={{ marginLeft: 6, fontSize: 12, color: 'var(--text-tertiary)' }}>{lang.native}</span>
                  )}
                </div>
                <div className="lang-meta">
                  <span className="lang-code">{lang.iso639_3 || lang.code}</span>
                  {lang.speakers && (
                    <span className="lang-speakers">{lang.speakers}</span>
                  )}
                  {lang.status && (
                    <span className={`badge ${lang.status.includes('critically') ? 'badge-danger' : lang.status === 'endangered' ? 'badge-accent' : 'badge-secondary'}`}>
                      {lang.status}
                    </span>
                  )}
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
                No languages found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
