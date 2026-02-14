import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

interface Props {
  connected: boolean;
}

export default function StatusBar({ connected }: Props) {
  const { t } = useTranslation();

  if (connected) {
    return (
      <div className="status-bar connected" role="status" aria-live="polite">
        <span aria-hidden="true">{'\u2705'}</span>
        <span>{t('status.connected')}</span>
      </div>
    );
  }

  return (
    <div className="status-bar" role="alert" aria-live="assertive">
      <span aria-hidden="true">{'\u26A0\uFE0F'}</span>
      <span>{t('status.not_connected')}</span>
      <Link to="/settings">{t('status.go_settings')}</Link>
    </div>
  );
}
