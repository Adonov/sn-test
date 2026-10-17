import { useI18n } from '../i18n';
import { toVideoEmbed } from '../lib/video';

export function RecipeVideo({ url }: { url: string }) {
  const { t } = useI18n();
  const embed = toVideoEmbed(url);

  if (!embed) {
    // Not embeddable (or not a valid http link): offer it as a plain link when it is safe to open.
    return /^https?:\/\//i.test(url) ? (
      <a className="btn" href={url} target="_blank" rel="noreferrer noopener">
        {t('detail.watchVideo')}
      </a>
    ) : null;
  }

  return (
    <section className={`video ${embed.kind === 'iframe' && embed.aspect < 1 ? 'portrait' : ''}`} aria-label={t('detail.video')}>
      {embed.kind === 'file' ? (
        <video src={embed.src} controls playsInline preload="metadata" />
      ) : (
        <iframe
          src={embed.src}
          title={t('detail.video')}
          style={{ aspectRatio: embed.aspect }}
          loading="lazy"
          allow="encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      )}
    </section>
  );
}
