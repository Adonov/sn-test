import { useState, type FormEvent } from 'react';
import { parseRecipeText, type ExtractionMethod, type RecipeDraft } from '../../shared/recipeParsing';
import { navigate } from '../lib/router';
import { setPendingDraft } from '../lib/store';

type Tab = 'link' | 'text';

const SOCIAL_HOSTS = /(instagram\.com|tiktok\.com|facebook\.com|pinterest\.|youtube\.com|youtu\.be)/i;

export function ImportPage() {
  const [tab, setTab] = useState<Tab>('link');
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  // Title/image/source from a link import, merged into a later text import.
  const [pendingLink, setPendingLink] = useState<RecipeDraft>();

  const review = (draft: RecipeDraft) => {
    setPendingDraft(draft);
    navigate('/new');
  };

  const importLink = async (e: FormEvent) => {
    e.preventDefault();
    setError(undefined);
    setLoading(true);
    try {
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = (await res.json()) as { recipe?: RecipeDraft; method?: ExtractionMethod; error?: string };
      if (!res.ok || !data.recipe) throw new Error(data.error ?? 'Uvoz ni uspel.');
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
      setError(err instanceof Error && err.message !== 'Failed to fetch' ? err.message : 'Strežnik ni dosegljiv.');
      if (SOCIAL_HOSTS.test(url)) setTab('text');
    } finally {
      setLoading(false);
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
          <button className="btn primary" disabled={loading}>
            {loading ? 'Uvažam…' : 'Uvozi'}
          </button>
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
          <button className="btn primary">Prepoznaj recept</button>
        </form>
      )}

      <section className="card tips">
        <h2>Namig</h2>
        <p className="muted small">
          Na telefonu lahko aplikacijo dodaš na začetni zaslon (»Dodaj na začetni zaslon«) in recepte uvažaš kot iz običajne
          aplikacije.
        </p>
      </section>
    </>
  );
}
