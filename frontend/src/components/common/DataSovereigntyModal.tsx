import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const SOVEREIGNTY_KEY = 'bridgelingua_sovereignty_accepted';

export default function DataSovereigntyModal() {
  const { t } = useTranslation();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(SOVEREIGNTY_KEY)) {
      setShow(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem(SOVEREIGNTY_KEY, String(Date.now()));
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="modal-overlay" style={{ zIndex: 9999 }}>
      <div className="modal-container" style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <h3>{t('care.sovereignty_title')}</h3>
        </div>
        <div className="modal-body">
          <div style={{ padding: '12px 0', lineHeight: 1.7, fontSize: 14, color: 'var(--text-primary)' }}>
            {t('care.sovereignty_body')}
          </div>
          <div style={{ marginTop: 20, display: 'flex', justifyContent: 'center' }}>
            <button className="btn btn-primary btn-lg" onClick={handleAccept} style={{ minWidth: 200, justifyContent: 'center' }}>
              {t('care.sovereignty_accept')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
