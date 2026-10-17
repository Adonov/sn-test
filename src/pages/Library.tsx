import { useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import { RecipeImage } from '../components/RecipeImage';
import { useI18n } from '../i18n';
import { formatMinutes } from '../lib/dates';
import { toggleFavorite, useAppState } from '../lib/store';

const FAVORITES = '__favorites';

export function Library() {
  const { recipes } = useAppState();
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<string>();

  const tags = useMemo(() => {
    const counts = new Map<string, number>();
    recipes.forEach((r) => r.tags.forEach((tag) => counts.set(tag, (counts.get(tag) ?? 0) + 1)));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([tag]) => tag);
  }, [recipes]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return recipes.filter((r) => {
      if (filter === FAVORITES && !r.favorite) return false;
      if (filter && filter !== FAVORITES && !r.tags.includes(filter)) return false;
      if (!q) return true;
      return (
        r.title.toLowerCase().includes(q) ||
        r.tags.some((tag) => tag.includes(q)) ||
        r.ingredients.some((i) => i.toLowerCase().includes(q))
      );
    });
  }, [recipes, query, filter]);

  return (
    <>
      <header className="page-header">
        <h1>{t('library.title')}</h1>
        <div className="header-actions">
          <a className="btn" href="#/import">
            {t('library.import')}
          </a>
          <a className="btn primary" href="#/new">
            <Icon name="plus" size={18} /> {t('library.new')}
          </a>
        </div>
      </header>

      <input
        className="search"
        type="search"
        placeholder={t('library.search')}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="chips" role="group" aria-label={t('library.filters')}>
        <button className={`chip ${!filter ? 'active' : ''}`} onClick={() => setFilter(undefined)}>
          {t('library.all', { count: recipes.length })}
        </button>
        <button className={`chip ${filter === FAVORITES ? 'active' : ''}`} onClick={() => setFilter(FAVORITES)}>
          {t('library.favorites')}
        </button>
        {tags.map((tag) => (
          <button key={tag} className={`chip ${filter === tag ? 'active' : ''}`} onClick={() => setFilter(filter === tag ? undefined : tag)}>
            #{tag}
          </button>
        ))}
      </div>

      {recipes.length === 0 ? (
        <div className="empty">
          <h2>{t('library.emptyTitle')}</h2>
          <p>{t('library.emptyText')}</p>
          <a className="btn primary" href="#/import">
            {t('library.emptyCta')}
          </a>
        </div>
      ) : visible.length === 0 ? (
        <p className="muted center">{t('library.noMatches')}</p>
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
                      {[time, t('library.ingredientCount', { count: r.ingredients.length })].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                </a>
                <button
                  className={`fav-btn ${r.favorite ? 'on' : ''}`}
                  onClick={() => toggleFavorite(r.id)}
                  aria-label={r.favorite ? t('library.favRemove') : t('library.favAdd')}
                  aria-pressed={r.favorite}
                >
                  <Icon name="heart" size={18} filled={r.favorite} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
