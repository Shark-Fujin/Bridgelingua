import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import zh from './zh.json';
import es from './es.json';
import fr from './fr.json';
import pt from './pt.json';

const savedLang = localStorage.getItem('bl-language') || 'en';

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    zh: { translation: zh },
    es: { translation: es },
    fr: { translation: fr },
    pt: { translation: pt },
  },
  lng: savedLang,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;
