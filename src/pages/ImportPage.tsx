import { Clipboard } from '@capacitor/clipboard';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { isVideoPageUrl, parseRecipeText, type RecipeDraft } from '../../shared/recipeParsing';
import { useI18n } from '../i18n';
import { findUrl, ImportError, importRecipeFromUrl } from '../lib/importer';
import { isNative } from '../lib/platform';
import { navigate } from '../lib/router';
import { clearPendingShare, getPendingShare, setPendingDraft } from '../lib/store';

type Tab = 'link' | 'text';

const SOCIAL_HOSTS = /(instagram\.com|tiktok\.com|facebook\.com|pinterest\.|youtube\.com|youtu\.be)/i;

async function readClipboard(): Promise<string> {
  if (isNative) return (await Clipboard.read()).value ?? '';
  return navigator.clipboard.readText();
}

export function ImportPage() {
  // Content shared from another app: a link is imported right away, other text goes to the text tab.
  const [shared] = useState(() => {
    const text = getPendingShare();
    return text ? { text, url: findUrl(text) } : undefined;
  });
  const [tab, setTab] = useState<Tab>(shared && !shared.url ? 'text' : 'link');
  const [url, setUrl] = useState(shared?.url ?? '');
  const [text, setText] = useState(shared && !shared.url ? shared.text : '');
  const [loading, setLoading] = useState(false);
  const { t } = useI18n();
  const [error, setError] = useState<string>();
  // Title/image/source from a link import, merged into a later text import.
  const [pendingLink, setPendingLink] = useState<RecipeDraft>();

  const review = (draft: RecipeDraft) => {
    setPendingDraft(draft);
    navigate('/new');
  };

  const runImport = async (link: string) => {
    setError(undefined);
    setLoading(true);
    try {
      const data = await importRecipeFromUrl(link);
      if (data.method === 'metadata') {
        // Only got a title/photo (typical for TikTok/Instagram): ask for the caption text.
        setError(t('import.metadataOnly'));
        setTab('text');
        setPendingLink(data.recipe);
        return;
      }
      review(data.recipe);
    } catch (err) {
      setError(err instanceof ImportError ? t(`error.${err.code}`, err.params) : t('error.failed'));
      if (SOCIAL_HOSTS.test(link)) setTab('text');
    } finally {
      setLoading(false);
    }
  };

  // Import a shared link once, even though StrictMode runs effects twice in development.
  const sharedHandled = useRef(false);
  useEffect(() => {
    clearPendingShare();
    if (shared?.url && !sharedHandled.current) {
      sharedHandled.current = true;
      runImport(shared.url);
    }
  }, []);

  const importLink = (e: FormEvent) => {
    e.preventDefault();
    runImport(url.trim());
  };

  const paste = async () => {
    try {
      const clip = (await readClipboard()).trim();
      const link = findUrl(clip);
      if (tab === 'link' && link) {
        setUrl(link);
        runImport(link);
      } else if (clip) {
        setTab('text');
        setText(clip);
      }
    } catch {
      setError(t('import.clipboardError'));
    }
  };

  const importText = (e: FormEvent) => {
    e.preventDefault();
    const parsed = parseRecipeText(text);
    review({
      ...parsed,
      title: parsed.title || pendingLink?.title || '',
      image: pendingLink?.image,
      sourceUrl: pendingLink?.sourceUrl ?? (SOCIAL_HOSTS.test(url) ? url : undefined),
      videoUrl: pendingLink?.videoUrl ?? (isVideoPageUrl(url) ? url : undefined),
    });
  };

  return (
    <>
      <header className="page-header">
        <h1>{t('import.title')}</h1>
      </header>

      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'link'} className={tab === 'link' ? 'active' : ''} onClick={() => setTab('link')}>
          {t('import.tabLink')}
        </button>
        <button role="tab" aria-selected={tab === 'text'} className={tab === 'text' ? 'active' : ''} onClick={() => setTab('text')}>
          {t('import.tabText')}
        </button>
      </div>

      {error && <p className="notice warn">{error}</p>}

      {tab === 'link' ? (
        <form className="card" onSubmit={importLink}>
          <p className="muted">{t('import.linkHelp')}</p>
          <label className="field">
            <span>{t('import.link')}</span>
            <input type="url" required value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" autoFocus />
          </label>
          <div className="action-row">
            <button className="btn primary" disabled={loading}>
              {loading ? t('import.importing') : t('import.import')}
            </button>
            <button type="button" className="btn" onClick={paste} disabled={loading}>
              {t('import.pasteImport')}
            </button>
          </div>
        </form>
      ) : (
        <form className="card" onSubmit={importText}>
          <p className="muted">{t('import.textHelp')}</p>
          <label className="field">
            <span>{t('import.text')}</span>
            <textarea
              rows={12}
              required
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t('import.textPlaceholder')}
            />
          </label>
          <div className="action-row">
            <button className="btn primary">{t('import.recognize')}</button>
            <button type="button" className="btn" onClick={paste}>
              {t('import.paste')}
            </button>
          </div>
        </form>
      )}

      <section className="card tips">
        <h2>{t('import.tipTitle')}</h2>
        <p className="muted small">
          {isNative ? t('import.tipNative') : t('import.tipWeb')}
        </p>
      </section>
    </>
  );
}
