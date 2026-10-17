import { Clipboard } from '@capacitor/clipboard';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { parseRecipeText, type RecipeDraft } from '../../shared/recipeParsing';
import { findUrl, importRecipeFromUrl } from '../lib/importer';
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
        setError(
          'Na strani ni bilo mogoče najti sestavin. Kopiraj opis objave (caption) in ga prilepi spodaj — povezavo in sliko bomo ohranili.',
        );
        setTab('text');
        setPendingLink(data.recipe);
        return;
      }
      review(data.recipe);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Uvoz ni uspel.');
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
      setError('Do odložišča ni bilo mogoče dostopati. Besedilo prilepi ročno.');
    }
  };

  const importText = (e: FormEvent) => {
    e.preventDefault();
    const parsed = parseRecipeText(text);
    review({
      ...parsed,
      title: parsed.title === 'Nov recept' && pendingLink ? pendingLink.title : parsed.title,
      image: pendingLink?.image,
      sourceUrl: pendingLink?.sourceUrl ?? (SOCIAL_HOSTS.test(url) ? url : undefined),
    });
  };

  return (
    <>
      <header className="page-header">
        <h1>Uvozi recept</h1>
      </header>

      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'link'} className={tab === 'link' ? 'active' : ''} onClick={() => setTab('link')}>
          🔗 S povezave
        </button>
        <button role="tab" aria-selected={tab === 'text'} className={tab === 'text' ? 'active' : ''} onClick={() => setTab('text')}>
          📝 Iz besedila
        </button>
      </div>

      {error && <p className="notice warn">{error}</p>}

      {tab === 'link' ? (
        <form className="card" onSubmit={importLink}>
          <p className="muted">
            Prilepi povezavo do recepta s katerekoli spletne strani (npr. kulinarični blogi) ali objave na Instagramu, TikToku,
            Pinterestu…
          </p>
          <label className="field">
            <span>Povezava</span>
            <input type="url" required value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" autoFocus />
          </label>
          <div className="action-row">
            <button className="btn primary" disabled={loading}>
              {loading ? 'Uvažam…' : 'Uvozi'}
            </button>
            <button type="button" className="btn" onClick={paste} disabled={loading}>
              📋 Prilepi in uvozi
            </button>
          </div>
        </form>
      ) : (
        <form className="card" onSubmit={importText}>
          <p className="muted">
            Prilepi besedilo recepta ali opis objave z družbenih omrežij. Sestavine in koraki bodo samodejno prepoznani.
          </p>
          <label className="field">
            <span>Besedilo recepta</span>
            <textarea
              rows={12}
              required
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={'Bananin kruh 🍌\n\nSestavine:\n3 zrele banane\n200 g moke\n2 jajci\n\nPostopek:\n1. Banane pretlači.\n2. …'}
            />
          </label>
          <div className="action-row">
            <button className="btn primary">Prepoznaj recept</button>
            <button type="button" className="btn" onClick={paste}>
              📋 Prilepi
            </button>
          </div>
        </form>
      )}

      <section className="card tips">
        <h2>Namig</h2>
        <p className="muted small">
          {isNative
            ? 'V Instagramu, TikToku ali brskalniku tapni »Deli« → »Kopiraj povezavo«, nato tukaj »Prilepi in uvozi«. Na Androidu lahko izbereš tudi »Deli« → Receptko.'
            : 'Na telefonu lahko aplikacijo dodaš na začetni zaslon (»Dodaj na začetni zaslon«) in recepte uvažaš kot iz običajne aplikacije.'}
        </p>
      </section>
    </>
  );
}
