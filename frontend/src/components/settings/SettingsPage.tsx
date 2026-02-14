import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../../stores/settings';
import { useLanguagesStore } from '../../stores/languages';
import { useTheme } from '../../hooks/useTheme';
import api from '../../hooks/useApi';

type ConnectionMode = 'huggingface' | 'custom_gpu' | 'cloud_gpu';

export default function SettingsPage() {
  const { t, i18n } = useTranslation();
  const { theme, setTheme } = useTheme();
  const { values, connected, testResult, loading, load, save, set: setVal, testConnection } = useSettingsStore();
  const langStore = useLanguagesStore();
  const loaded = useRef(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!loaded.current) {
      loaded.current = true;
      load();
      langStore.load();
    }
  }, [load, langStore]);

  const mode = (values.connection_mode || 'huggingface') as ConnectionMode;

  const handleSave = () => {
    save(values);
  };

  const handleDeleteAll = async () => {
    if (deleteConfirm !== 'DELETE') return;
    setDeleting(true);
    try {
      await api.delete('/api/library/files/all');
      await api.delete('/api/lexicons/all');
      await api.put('/api/settings', { settings: {} });
      localStorage.clear();
      window.location.reload();
    } catch {
      alert('Failed to delete data');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="page-enter">
      <div className="settings-layout">
        {/* Nav */}
        <div className="settings-nav">
          {[
            { id: 'sec-backend', icon: '\u{1F50C}', key: 'settings.backend' },
            { id: 'sec-asr', icon: '\u{1F399}', key: 'settings.asr' },
            { id: 'sec-translate', icon: '\u{1F310}', key: 'settings.translate' },
            { id: 'sec-care', icon: '\u{1F6E1}', key: 'settings.care' },
            { id: 'sec-interface', icon: '\u{1F3A8}', key: 'settings.interface' },
          ].map((item) => (
            <div
              key={item.id}
              role="button"
              tabIndex={0}
              className="settings-nav-item"
              onClick={() => document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth' })}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth' }); } }}
            >
              <span aria-hidden="true">{item.icon}</span> <span>{t(item.key)}</span>
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="settings-content">
          {/* Backend */}
          <div className="settings-section" id="sec-backend">
            <div className="settings-section-header">
              <h3>{'\u{1F50C}'} {t('settings.backend_title')}</h3>
              <span className={`connection-status ${connected ? 'connected' : 'disconnected'}`}>
                <span className="dot" />
                {connected ? t('status.connected_label') : t('status.disconnected_label')}
              </span>
            </div>
            <div className="settings-section-body">
              <div className="settings-row">
                <label>{t('settings.connection_mode')}</label>
                <div>
                  <div className="radio-group" role="radiogroup" aria-label={t('settings.connection_mode')}>
                    {(['huggingface', 'custom_gpu', 'cloud_gpu'] as const).map((m) => (
                      <div
                        key={m}
                        role="radio"
                        tabIndex={0}
                        aria-checked={mode === m}
                        className={`radio-option${mode === m ? ' active' : ''}`}
                        onClick={() => setVal('connection_mode', m)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setVal('connection_mode', m); } }}
                      >
                        {m === 'huggingface' ? 'HuggingFace API' : m === 'custom_gpu' ? 'Custom GPU Endpoint' : 'Cloud GPU Service'}
                      </div>
                    ))}
                  </div>
                  <div className="setting-desc">{t('settings.connection_desc')}</div>
                </div>
              </div>

              {mode === 'huggingface' && (
                <div className="settings-row">
                  <label>HuggingFace API Token</label>
                  <div>
                    <input
                      type="password"
                      className="input-field"
                      placeholder="hf_xxxxxxxxxxxxxxxxxxxx"
                      value={values.hf_token || ''}
                      onChange={(e) => setVal('hf_token', e.target.value)}
                    />
                    <div className="setting-desc">
                      Get your token at <a href="https://huggingface.co/settings/tokens" target="_blank" rel="noreferrer">huggingface.co/settings/tokens</a>
                    </div>
                  </div>
                </div>
              )}

              {mode === 'custom_gpu' && (
                <div className="settings-row">
                  <label>GPU Endpoint URL</label>
                  <div>
                    <input
                      type="url"
                      className="input-field"
                      placeholder="http://gpu.mylab.edu:8080"
                      value={values.gpu_endpoint || ''}
                      onChange={(e) => setVal('gpu_endpoint', e.target.value)}
                    />
                    <div className="setting-desc">{t('settings.gpu_desc')}</div>
                  </div>
                </div>
              )}

              {mode === 'cloud_gpu' && (
                <>
                  <div className="settings-row">
                    <label>Cloud GPU Provider</label>
                    <div>
                      <select
                        className="input-field"
                        value={values.cloud_provider || 'RunPod'}
                        onChange={(e) => setVal('cloud_provider', e.target.value)}
                      >
                        {['RunPod', 'Lambda', 'Modal', 'Replicate'].map((p) => (
                          <option key={p}>{p}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="settings-row">
                    <label>API Key</label>
                    <div>
                      <input
                        type="password"
                        className="input-field"
                        placeholder="API Key"
                        value={values.cloud_api_key || ''}
                        onChange={(e) => setVal('cloud_api_key', e.target.value)}
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="settings-row">
                <label />
                <div className="flex gap-2" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
                  <button className="btn btn-primary" onClick={testConnection} disabled={loading} style={{ flexShrink: 0 }}>
                    {loading && !testResult ? (
                      <><span className="spinner" /> {t('settings.testing')}</>
                    ) : (
                      <>{'\u{1F517}'} {t('settings.test_connection')}</>
                    )}
                  </button>
                  {testResult && (
                    <span style={{ fontSize: 13, color: testResult.success ? 'var(--success)' : 'var(--danger)' }}>
                      {testResult.success ? '\u2705' : '\u274C'} {testResult.message}
                      {testResult.latency_ms != null && ` (${testResult.latency_ms}ms)`}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ASR */}
          <div className="settings-section" id="sec-asr">
            <div className="settings-section-header">
              <h3>{'\u{1F399}'} {t('settings.asr_title')}</h3>
            </div>
            <div className="settings-section-body">
              <div className="settings-row">
                <label>{t('settings.default_model')}</label>
                <div>
                  <select className="input-field" value={values.asr_model || 'omniasr'} onChange={(e) => setVal('asr_model', e.target.value)}>
                    <option value="omniasr">OmniASR (1600+ languages)</option>
                    <option value="whisper" disabled>Whisper (99 languages) — coming soon</option>
                    <option value="mms" disabled>MMS (1100+ languages) — coming soon</option>
                  </select>
                </div>
              </div>
              <div className="settings-row">
                <label>{t('settings.auto_detect')}</label>
                <div className="flex gap-2" style={{ alignItems: 'center' }}>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={values.auto_detect !== 'false'}
                      onChange={(e) => setVal('auto_detect', String(e.target.checked))}
                    />
                    <span className="toggle-slider" />
                  </label>
                  <span className="text-sm text-muted">{t('settings.auto_detect_desc')}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Translation */}
          <div className="settings-section" id="sec-translate">
            <div className="settings-section-header">
              <h3>{'\u{1F310}'} {t('settings.translate_title')}</h3>
            </div>
            <div className="settings-section-body">
              <div className="settings-row">
                <label>{t('settings.default_trans_model')}</label>
                <div>
                  <select className="input-field" value={values.trans_model || 'nllb'} onChange={(e) => setVal('trans_model', e.target.value)}>
                    <option value="nllb">NLLB-200 (200 languages)</option>
                    <option value="seamless" disabled>SeamlessM4T — coming soon</option>
                  </select>
                </div>
              </div>
              <div className="settings-row">
                <label>{t('settings.default_target')}</label>
                <div>
                  <select className="input-field" value={values.default_target_lang || 'eng'} onChange={(e) => setVal('default_target_lang', e.target.value)}>
                    <option value="eng">English (eng)</option>
                    <option value="zho">中文 (zho)</option>
                    <option value="spa">Español (spa)</option>
                    <option value="fra">Français (fra)</option>
                  </select>
                </div>
              </div>
              <div className="settings-row">
                <label>{t('settings.auto_translate')}</label>
                <div className="flex gap-2" style={{ alignItems: 'center' }}>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={values.auto_translate !== 'false'}
                      onChange={(e) => setVal('auto_translate', String(e.target.checked))}
                    />
                    <span className="toggle-slider" />
                  </label>
                  <span className="text-sm text-muted">{t('settings.auto_translate_desc')}</span>
                </div>
              </div>
              <div className="settings-row">
                <label>{t('settings.default_src_lang')}</label>
                <div>
                  <select
                    className="input-field"
                    value={values.default_src_lang || ''}
                    onChange={(e) => setVal('default_src_lang', e.target.value)}
                  >
                    <option value="">—</option>
                    {langStore.asr.map((l) => (
                      <option key={l.code} value={l.code}>{l.name} ({l.code})</option>
                    ))}
                  </select>
                  <div className="setting-desc">{t('settings.default_lang_desc')}</div>
                </div>
              </div>
              <div className="settings-row">
                <label>{t('settings.default_tgt_lang')}</label>
                <div>
                  <select
                    className="input-field"
                    value={values.default_tgt_lang || ''}
                    onChange={(e) => setVal('default_tgt_lang', e.target.value)}
                  >
                    <option value="">—</option>
                    {langStore.translation.map((l) => (
                      <option key={l.code} value={l.code}>{l.name} ({l.code})</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* CARE */}
          <div className="settings-section" id="sec-care">
            <div className="settings-section-header">
              <h3>{'\u{1F6E1}'} {t('settings.care_title')}</h3>
            </div>
            <div className="settings-section-body">
              <div className="settings-row">
                <label>{t('settings.default_license')}</label>
                <div>
                  <select className="input-field" value={values.default_license || 'CC-BY-SA 4.0'} onChange={(e) => setVal('default_license', e.target.value)}>
                    <option>CC-BY 4.0</option>
                    <option>CC-BY-SA 4.0</option>
                    <option>CC-BY-NC 4.0</option>
                    <option>Restricted (Community Only)</option>
                    <option>Custom</option>
                  </select>
                  <div className="setting-desc">{t('settings.license_desc')}</div>
                </div>
              </div>
              <div className="settings-row">
                <label>{t('settings.community')}</label>
                <div>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="e.g., Iu Mien Community, Du'an"
                    value={values.community || ''}
                    onChange={(e) => setVal('community', e.target.value)}
                  />
                  <div className="setting-desc">{t('settings.community_desc')}</div>
                </div>
              </div>
              <div className="settings-row">
                <label>{t('settings.sovereignty')}</label>
                <div>
                  <textarea
                    className="input-field"
                    rows={3}
                    placeholder="Data sovereignty statement..."
                    value={values.sovereignty_statement || ''}
                    onChange={(e) => setVal('sovereignty_statement', e.target.value)}
                  />
                </div>
              </div>
              <div className="settings-row">
                <label>{t('settings.sensitive_prompt')}</label>
                <div className="flex gap-2" style={{ alignItems: 'center' }}>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={values.sensitive_prompt !== 'false'}
                      onChange={(e) => setVal('sensitive_prompt', String(e.target.checked))}
                    />
                    <span className="toggle-slider" />
                  </label>
                  <span className="text-sm text-muted">{t('settings.sensitive_desc')}</span>
                </div>
              </div>
              <div className="settings-row" style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 8 }}>
                <label style={{ color: 'var(--danger)' }}>{t('care.delete_all_title')}</label>
                <div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 10 }}>
                    {t('care.delete_all_desc')}
                  </div>
                  <div className="flex gap-2" style={{ alignItems: 'center' }}>
                    <input
                      className="input-field"
                      style={{ maxWidth: 200 }}
                      placeholder={t('care.delete_all_placeholder')}
                      value={deleteConfirm}
                      onChange={(e) => setDeleteConfirm(e.target.value)}
                    />
                    <button
                      className="btn btn-danger"
                      disabled={deleteConfirm !== 'DELETE' || deleting}
                      onClick={handleDeleteAll}
                    >
                      {deleting ? t('care.deleting') : t('care.delete_all_btn')}
                    </button>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
                    {t('care.delete_all_confirm')}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Interface */}
          <div className="settings-section" id="sec-interface">
            <div className="settings-section-header">
              <h3>{'\u{1F3A8}'} {t('settings.interface_title')}</h3>
            </div>
            <div className="settings-section-body">
              <div className="settings-row">
                <label>{t('settings.ui_language')}</label>
                <div>
                  <div className="radio-group" role="radiogroup" aria-label={t('settings.ui_language')}>
                    {[
                      { code: 'en', label: 'English' },
                      { code: 'zh', label: '中文' },
                      { code: 'es', label: 'Español' },
                      { code: 'fr', label: 'Français' },
                      { code: 'pt', label: 'Português' },
                    ].map((lang) => (
                      <div
                        key={lang.code}
                        role="radio"
                        tabIndex={0}
                        aria-checked={i18n.language === lang.code}
                        className={`radio-option${i18n.language === lang.code ? ' active' : ''}`}
                        onClick={() => { i18n.changeLanguage(lang.code); localStorage.setItem('bl-language', lang.code); }}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); i18n.changeLanguage(lang.code); localStorage.setItem('bl-language', lang.code); } }}
                      >
                        {lang.label}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="settings-row">
                <label>{t('settings.theme')}</label>
                <div>
                  <div className="radio-group" role="radiogroup" aria-label={t('settings.theme')}>
                    {[
                      { val: 'light', label: '\u2600\uFE0F Light' },
                      { val: 'dark', label: '\u{1F319} Dark' },
                      { val: 'auto', label: '\u{1F504} Auto' },
                    ].map((opt) => (
                      <div
                        key={opt.val}
                        role="radio"
                        tabIndex={0}
                        aria-checked={theme === opt.val}
                        className={`radio-option${theme === opt.val ? ' active' : ''}`}
                        onClick={() => setTheme(opt.val as 'light' | 'dark' | 'auto')}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setTheme(opt.val as 'light' | 'dark' | 'auto'); } }}
                      >
                        {opt.label}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="settings-row">
                <label>{t('settings.audio_quality')}</label>
                <div>
                  <select className="input-field" value={values.audio_quality || '44100'} onChange={(e) => setVal('audio_quality', e.target.value)}>
                    <option value="16000">16 kHz (compact, ASR-optimized)</option>
                    <option value="44100">44.1 kHz (high quality)</option>
                    <option value="48000">48 kHz (professional)</option>
                  </select>
                </div>
              </div>
              <div className="settings-row">
                <label>{t('settings.date_format')}</label>
                <div>
                  <select className="input-field" value={values.date_format || 'YYYY-MM-DD'} onChange={(e) => setVal('date_format', e.target.value)}>
                    <option>YYYY-MM-DD</option>
                    <option>MM/DD/YYYY</option>
                    <option>DD/MM/YYYY</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Save */}
          <div style={{ textAlign: 'right' }}>
            <button className="btn btn-primary btn-lg" onClick={handleSave} disabled={loading}>
              {'\u{1F4BE}'} {t('settings.save_settings')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
