import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

interface Props {
  open: boolean;
  onClose: () => void;
}

const navItems = [
  { to: '/', icon: '\u{1F3E0}', labelKey: 'nav.workspace' },
  { to: '/library', icon: '\u{1F4C1}', labelKey: 'nav.library' },
  { to: '/lexicon', icon: '\u{1F4D6}', labelKey: 'nav.lexicon' },
  { to: '/settings', icon: '\u2699\uFE0F', labelKey: 'nav.settings' },
];

export default function Sidebar({ open, onClose }: Props) {
  const { t } = useTranslation();
  return (
    <>
      <div
        className={`sidebar-overlay${open ? ' open' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside className={`sidebar${open ? ' open' : ''}`} aria-label={t('nav.workspace')}>
        <div className="sidebar-logo">
          <div className="logo-icon" aria-hidden="true">B</div>
          <span className="logo-text">Bridgelingua</span>
        </div>
        <nav className="sidebar-nav" aria-label="Main navigation">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `nav-item${isActive ? ' active' : ''}`
              }
              onClick={onClose}
            >
              <span className="nav-icon" aria-hidden="true">{item.icon}</span>
              <span>{t(item.labelKey)}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div style={{ marginBottom: 4 }}>Bridgelingua v0.1-MVP</div>
          <div>
            Open Source &middot; <a href="#">{t('nav.care')}</a>
          </div>
          <div style={{ marginTop: 6, fontSize: 10, color: '#475569' }}>
            1600+ Languages &middot; OmniASR
          </div>
        </div>
      </aside>
    </>
  );
}
