// ============================================================
// i18n 国际化配置
// 使用 i18next + browser-languagedetector 自动检测语言
// ============================================================

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en';
import zh from './locales/zh';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      zh: { translation: zh },
    },
    /** 回退语言 */
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // React 已处理 XSS
    },
    detection: {
      /** 检测顺序：先查 localStorage，再查浏览器语言 */
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  });

export default i18n;
