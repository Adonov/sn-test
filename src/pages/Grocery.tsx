import { Share } from '@capacitor/share';
import { useState, type FormEvent } from 'react';
import { Icon } from '../components/Icon';
import { useI18n } from '../i18n';
import { CATEGORIES, formatGroceryAmount, groceryListAsText } from '../lib/grocery';
import { isNative } from '../lib/platform';
import { addManualGroceryItem, clearGrocery, removeGroceryItem, toggleGroceryItem, updateGroceryItem, useAppState } from '../lib/store';
import type { CategoryId } from '../lib/types';

export function Grocery() {
  const { grocery, recipes } = useAppState();
  const { t, decimal } = useI18n();
  const [text, setText] = useState('');
  const [copied, setCopied] = useState(false);
  const open = grocery.filter((g) => !g.checked);
  const done = grocery.filter((g) => g.checked);
  const categoryLabel = (id: CategoryId) => t(`category.${id}`);

  const add = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    addManualGroceryItem(text.trim());
    setText('');
  };

  const share = async () => {
    const body = groceryListAsText(grocery, categoryLabel, decimal);
    const title = t('grocery.title');
    if (isNative) {
      await Share.share({ title, text: body }).catch(() => {});
      return;
    }
    if (navigator.share) {
      await navigator.share({ title, text: body }).catch(() => {});
      return;
    }
    await navigator.clipboard.writeText(body);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const recipeNames = (ids: string[]) =>
    ids
      .map((id) => recipes.find((r) => r.id === id)?.title)
      .filter(Boolean)
      .join(', ');

  return (
    <>
      <header className="page-header">
        <h1>{t('grocery.title')}</h1>
        <div className="header-actions">
          <button className="btn" onClick={share} disabled={!open.length}>
            {copied ? `✓ ${t('grocery.copied')}` : t('grocery.share')}
          </button>
        </div>
      </header>

      <form className="add-item" onSubmit={add}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={t('grocery.addPlaceholder')} aria-label={t('grocery.newItem')} />
        <button className="btn primary">{t('grocery.add')}</button>
      </form>

      {grocery.length === 0 && (
        <div className="empty">
          <h2>{t('grocery.emptyTitle')}</h2>
          <p className="muted">{t('grocery.emptyText')}</p>
          <a className="btn" href="#/planner">
            {t('grocery.openPlanner')}
          </a>
        </div>
      )}

      {CATEGORIES.map((category) => {
        const items = open.filter((g) => g.category === category);
        if (!items.length) return null;
        return (
          <section key={category} className="card grocery-group">
            <h2>{categoryLabel(category)}</h2>
            <ul>
              {items.map((item) => (
                <li key={item.id} className="grocery-item">
                  <label>
                    <input type="checkbox" checked={false} onChange={() => toggleGroceryItem(item.id)} />
                    <span>
                      {formatGroceryAmount(item, decimal) && <strong>{formatGroceryAmount(item, decimal)} </strong>}
                      {item.name}
                      {item.recipeIds.length > 0 && <small className="muted block">{recipeNames(item.recipeIds)}</small>}
                    </span>
                  </label>
                  <select
                    className="category-select"
                    value={item.category}
                    onChange={(e) => updateGroceryItem(item.id, { category: e.target.value as CategoryId })}
                    aria-label={t('grocery.category')}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {categoryLabel(c)}
                      </option>
                    ))}
                  </select>
                  <button className="icon-btn small" onClick={() => removeGroceryItem(item.id)} aria-label={t('common.remove')}>
                    <Icon name="close" size={16} />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {done.length > 0 && (
        <section className="card grocery-group done">
          <div className="section-head">
            <h2>{t('grocery.inCart', { count: done.length })}</h2>
            <button className="link-btn small" onClick={() => clearGrocery(true)}>
              {t('grocery.clear')}
            </button>
          </div>
          <ul>
            {done.map((item) => (
              <li key={item.id} className="grocery-item">
                <label>
                  <input type="checkbox" checked onChange={() => toggleGroceryItem(item.id)} />
                  <span>{[formatGroceryAmount(item, decimal), item.name].filter(Boolean).join(' ')}</span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      )}

      {grocery.length > 0 && (
        <button className="link-btn danger center-block" onClick={() => confirm(t('grocery.confirmClearAll')) && clearGrocery(false)}>
          {t('grocery.clearAll')}
        </button>
      )}
    </>
  );
}
