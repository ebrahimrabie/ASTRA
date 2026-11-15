import { useAstra } from '../context/AstraContext';
import { useI18n } from '../i18n';

export function LanguageSwitcher() {
  const { updatePreferences } = useAstra();
  const { lang, t } = useI18n();

  const handleSelect = (next: 'en' | 'ar') => {
    if (next === lang) return;
    void updatePreferences({ language: next }).catch(() => {
      // Preferences still updated optimistically in localStorage + state
    });
  };

  return (
    <div
      className="lang-switcher"
      role="group"
      aria-label={t('lang.switcherAria')}
    >
      <button
        type="button"
        className={`lang-switcher-btn${lang === 'en' ? ' active' : ''}`}
        aria-pressed={lang === 'en'}
        aria-label={t('lang.enName')}
        onClick={() => handleSelect('en')}
      >
        {t('lang.enLabel')}
      </button>
      <button
        type="button"
        className={`lang-switcher-btn${lang === 'ar' ? ' active' : ''}`}
        aria-pressed={lang === 'ar'}
        aria-label={t('lang.arName')}
        onClick={() => handleSelect('ar')}
      >
        {t('lang.arLabel')}
      </button>
    </div>
  );
}
