import { useState, type FormEvent } from 'react';
import { CATEGORIES, formatGroceryAmount, groceryListAsText } from '../lib/grocery';
import { addManualGroceryItem, clearGrocery, removeGroceryItem, toggleGroceryItem, updateGroceryItem, useAppState } from '../lib/store';

export function Grocery() {
  const { grocery, recipes } = useAppState();
  const [text, setText] = useState('');
  const [copied, setCopied] = useState(false);
  const open = grocery.filter((g) => !g.checked);
  const done = grocery.filter((g) => g.checked);

  const add = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    addManualGroceryItem(text.trim());
    setText('');
  };

  const share = async () => {
    const body = groceryListAsText(grocery);
    if (navigator.share) {
      await navigator.share({ title: 'Nakupovalni seznam', text: body }).catch(() => {});
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
        <h1>Nakupovalni seznam</h1>
        <div className="header-actions">
          <button className="btn" onClick={share} disabled={!open.length}>
            {copied ? '✓ Kopirano' : '📤 Deli'}
          </button>
        </div>
      </header>

      <form className="add-item" onSubmit={add}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Dodaj artikel, npr. 2 l mleka" aria-label="Nov artikel" />
        <button className="btn primary">Dodaj</button>
      </form>

      {grocery.length === 0 && (
        <div className="empty">
          <p className="empty-icon">🛒</p>
          <h2>Seznam je prazen</h2>
          <p>Dodaj sestavine iz recepta ali ustvari seznam iz tedenskega načrta obrokov.</p>
          <a className="btn" href="#/planner">
            Odpri načrt obrokov
          </a>
        </div>
      )}

      {CATEGORIES.map((category) => {
        const items = open.filter((g) => g.category === category);
        if (!items.length) return null;
        return (
          <section key={category} className="card grocery-group">
            <h2>{category}</h2>
            <ul>
              {items.map((item) => (
                <li key={item.id} className="grocery-item">
                  <label>
                    <input type="checkbox" checked={false} onChange={() => toggleGroceryItem(item.id)} />
                    <span>
                      {formatGroceryAmount(item) && <strong>{formatGroceryAmount(item)} </strong>}
                      {item.name}
                      {item.recipeIds.length > 0 && <small className="muted block">{recipeNames(item.recipeIds)}</small>}
                    </span>
                  </label>
                  <select
                    className="category-select"
                    value={item.category}
                    onChange={(e) => updateGroceryItem(item.id, { category: e.target.value })}
                    aria-label="Kategorija"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                  <button className="icon-btn small" onClick={() => removeGroceryItem(item.id)} aria-label="Odstrani">
                    ✕
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
            <h2>V košarici ({done.length})</h2>
            <button className="link-btn small" onClick={() => clearGrocery(true)}>
              Počisti
            </button>
          </div>
          <ul>
            {done.map((item) => (
              <li key={item.id} className="grocery-item">
                <label>
                  <input type="checkbox" checked onChange={() => toggleGroceryItem(item.id)} />
                  <span>{[formatGroceryAmount(item), item.name].filter(Boolean).join(' ')}</span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      )}

      {grocery.length > 0 && (
        <button className="link-btn danger center-block" onClick={() => confirm('Izbrišem celoten seznam?') && clearGrocery(false)}>
          Izbriši celoten seznam
        </button>
      )}
    </>
  );
}
