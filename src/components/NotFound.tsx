import { useI18n } from '../i18n';

export function NotFound() {
  const { t } = useI18n();
  return (
    <div className="empty">
      <h2>{t('notFound.title')}</h2>
      <a className="btn" href="#/">
        {t('notFound.back')}
      </a>
    </div>
  );
}
