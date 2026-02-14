import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { useTheme } from '../../hooks/useTheme';

const routeTitleMap: Record<string, string> = {
  '/': 'page.workspace',
  '/library': 'page.library',
  '/lexicon': 'page.lexicon',
  '/settings': 'page.settings',
};

interface Props {
  onMenuToggle: () => void;
}

export default function Topbar({ onMenuToggle }: Props) {
  const { t, i18n } = useTranslation();
  const { toggle, applied } = useTheme();
  const location = useLocation();
  const titleKey = routeTitleMap[location.pathname] || 'page.workspace';

  const toggleLang = () => {
    const next = i18n.language === 'en' ? 'zh' : 'en';
    i18n.changeLanguage(next);
    localStorage.setItem('bl-language', next);
  };

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="menu-toggle" onClick={onMenuToggle} aria-label={t('nav.toggle_menu')}>
          &#9776;
        </button>
        <h1 className="topbar-title">{t(titleKey)}</h1>
      </div>
      <div className="topbar-right">
        <button className="topbar-btn" onClick={toggleLang} aria-label={t('settings.ui_language')}>
          <span aria-hidden="true">{'\u{1F310}'}</span>
          <span>{i18n.language === 'en' ? 'EN' : '中'}</span>
        </button>
        <button className="topbar-btn" onClick={toggle} aria-label={t('settings.theme')}>
          <span aria-hidden="true">{applied === 'dark' ? '\u2600\uFE0F' : '\u{1F319}'}</span>
        </button>
      </div>
    </header>
  );
}
