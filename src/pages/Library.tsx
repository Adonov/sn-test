import { useMemo, useState } from 'react';
import { RecipeImage } from '../components/RecipeImage';
import { formatMinutes } from '../lib/dates';
import { toggleFavorite, useAppState } from '../lib/store';

const FAVORITES = '__favorites';

export function Library() {
  const { recipes } = useAppState();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<string>();

  const tags = useMemo(() => {
    const counts = new Map<string, number>();
    recipes.forEach((r) => r.tags.forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1)));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
  }, [recipes]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return recipes.filter((r) => {
      if (filter === FAVORITES && !r.favorite) return false;
      if (filter && filter !== FAVORITES && !r.tags.includes(filter)) return false;
      if (!q) return true;
      return (
        r.title.toLowerCase().includes(q) ||
        r.tags.some((t) => t.includes(q)) ||
        r.ingredients.some((i) => i.toLowerCase().includes(q))
      );
    });
  }, [recipes, query, filter]);

  return (
    <>
      <header className="page-header">
        <h1>Moji recepti</h1>
        <div className="header-actions">
          <a className="btn" href="#/import">
            ⬇️ Uvozi
          </a>
          <a className="btn primary" href="#/new">
            ＋ Nov
          </a>
        </div>
      </header>

      <input
        className="search"
        type="search"
        placeholder="Išči po imenu, sestavini ali oznaki…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="chips" role="group" aria-label="Filtri">
        <button className={`chip ${!filter ? 'active' : ''}`} onClick={() => setFilter(undefined)}>
          Vsi ({recipes.length})
        </button>
        <button className={`chip ${filter === FAVORITES ? 'active' : ''}`} onClick={() => setFilter(FAVORITES)}>
          ♥ Priljubljeni
        </button>
        {tags.map((t) => (
          <button key={t} className={`chip ${filter === t ? 'active' : ''}`} onClick={() => setFilter(filter === t ? undefined : t)}>
            #{t}
          </button>
        ))}
      </div>

      {recipes.length === 0 ? (
        <div className="empty">
          <p className="empty-icon">📖</p>
          <h2>Še nimaš receptov</h2>
          <p>Uvozi recept s spletne strani, Instagrama ali TikToka, ali ga dodaj ročno.</p>
          <a className="btn primary" href="#/import">
            Uvozi prvi recept
          </a>
        </div>
      ) : visible.length === 0 ? (
        <p className="muted center">Ni receptov, ki bi ustrezali iskanju.</p>
      ) : (
        <ul className="recipe-grid">
          {visible.map((r) => {
            const time = formatMinutes((r.prepMinutes ?? 0) + (r.cookMinutes ?? 0));
            return (
              <li key={r.id} className="recipe-card">
                <a href={`#/recipe/${r.id}`}>
                  <RecipeImage className="card-image" src={r.image} title={r.title} />
                  <div className="card-body">
                    <h3>{r.title}</h3>
                    <p className="muted small">
                      {[time && `⏱ ${time}`, `${r.ingredients.length} sestavin`].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                </a>
                <button
                  className={`fav-btn ${r.favorite ? 'on' : ''}`}
                  onClick={() => toggleFavorite(r.id)}
                  aria-label={r.favorite ? 'Odstrani iz priljubljenih' : 'Dodaj med priljubljene'}
                  aria-pressed={r.favorite}
                >
                  {r.favorite ? '♥' : '♡'}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
