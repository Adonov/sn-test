import { useEffect, useState, type FormEvent } from 'react';
import { fileToDataUrl } from '../lib/image';
import { navigate } from '../lib/router';
import { clearPendingDraft, getPendingDraft, saveRecipe } from '../lib/store';
import type { Recipe } from '../lib/types';

interface FormState {
  title: string;
  description: string;
  image: string;
  sourceUrl: string;
  servings: string;
  prepMinutes: string;
  cookMinutes: string;
  ingredients: string;
  steps: string;
  tags: string;
  notes: string;
}

function toForm(r?: Partial<Recipe>): FormState {
  return {
    title: r?.title ?? '',
    description: r?.description ?? '',
    image: r?.image ?? '',
    sourceUrl: r?.sourceUrl ?? '',
    servings: String(r?.servings ?? 4),
    prepMinutes: r?.prepMinutes ? String(r.prepMinutes) : '',
    cookMinutes: r?.cookMinutes ? String(r.cookMinutes) : '',
    ingredients: (r?.ingredients ?? []).join('\n'),
    steps: (r?.steps ?? []).join('\n\n'),
    tags: (r?.tags ?? []).join(', '),
    notes: r?.notes ?? '',
  };
}

const lines = (text: string) =>
  text
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);

const optionalNumber = (text: string) => {
  const n = parseInt(text, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

export function RecipeEditor({ recipe }: { recipe?: Recipe }) {
  const [draft] = useState(() => (recipe ? undefined : getPendingDraft()));
  const [form, setForm] = useState<FormState>(() => toForm(recipe ?? draft));
  const [imageError, setImageError] = useState<string>();
  const isImported = Boolean(draft);

  useEffect(() => clearPendingDraft, []);

  const set = (key: keyof FormState) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const onPhoto = async (file?: File) => {
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      setForm((f) => ({ ...f, image: dataUrl }));
      setImageError(undefined);
    } catch {
      setImageError('Fotografije ni bilo mogoče naložiti.');
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const id = saveRecipe({
      id: recipe?.id,
      title: form.title.trim() || 'Recept brez imena',
      description: form.description.trim() || undefined,
      image: form.image.trim() || undefined,
      sourceUrl: form.sourceUrl.trim() || undefined,
      servings: optionalNumber(form.servings) ?? 1,
      prepMinutes: optionalNumber(form.prepMinutes),
      cookMinutes: optionalNumber(form.cookMinutes),
      ingredients: lines(form.ingredients),
      steps: lines(form.steps),
      tags: [...new Set(form.tags.split(',').map((t) => t.trim().replace(/^#/, '').toLowerCase()).filter(Boolean))],
      notes: form.notes.trim() || undefined,
    });
    navigate(`/recipe/${id}`);
  };

  return (
    <form className="editor" onSubmit={submit}>
      <header className="page-header">
        <h1>{recipe ? 'Uredi recept' : isImported ? 'Preveri uvoženi recept' : 'Nov recept'}</h1>
      </header>
      {isImported && <p className="notice">Preveri, ali so sestavine in koraki pravilno prepoznani, nato shrani.</p>}

      <label className="field">
        <span>Ime recepta</span>
        <input required value={form.title} onChange={set('title')} placeholder="npr. Domača pica" />
      </label>

      <div className="field">
        <span>Fotografija</span>
        {form.image && <img className="editor-preview" src={form.image} alt="" referrerPolicy="no-referrer" />}
        <div className="row">
          <input value={form.image.startsWith('data:') ? '(naložena fotografija)' : form.image} onChange={set('image')} placeholder="Povezava do slike" disabled={form.image.startsWith('data:')} />
          <label className="btn file-btn">
            📷 Naloži
            <input type="file" accept="image/*" onChange={(e) => onPhoto(e.target.files?.[0])} hidden />
          </label>
          {form.image && (
            <button type="button" className="btn" onClick={() => setForm((f) => ({ ...f, image: '' }))}>
              Odstrani
            </button>
          )}
        </div>
        {imageError && <p className="error">{imageError}</p>}
      </div>

      <label className="field">
        <span>Kratek opis</span>
        <input value={form.description} onChange={set('description')} />
      </label>

      <div className="grid-3">
        <label className="field">
          <span>Porcije</span>
          <input type="number" min={1} value={form.servings} onChange={set('servings')} />
        </label>
        <label className="field">
          <span>Priprava (min)</span>
          <input type="number" min={0} value={form.prepMinutes} onChange={set('prepMinutes')} />
        </label>
        <label className="field">
          <span>Kuhanje (min)</span>
          <input type="number" min={0} value={form.cookMinutes} onChange={set('cookMinutes')} />
        </label>
      </div>

      <label className="field">
        <span>Sestavine</span>
        <small className="muted">Ena sestavina na vrstico. Vrstica, ki se konča z dvopičjem (npr. »Za omako:«), je naslov skupine.</small>
        <textarea rows={8} value={form.ingredients} onChange={set('ingredients')} placeholder={'500 g moke\n2 jajci\n1 žlička soli'} />
      </label>

      <label className="field">
        <span>Postopek</span>
        <small className="muted">Vsak korak v svoji vrstici.</small>
        <textarea rows={10} value={form.steps} onChange={set('steps')} />
      </label>

      <label className="field">
        <span>Oznake</span>
        <input value={form.tags} onChange={set('tags')} placeholder="kosilo, hitro, vegetarijansko" />
      </label>

      <label className="field">
        <span>Vir (povezava)</span>
        <input type="url" value={form.sourceUrl} onChange={set('sourceUrl')} placeholder="https://…" />
      </label>

      <label className="field">
        <span>Opombe</span>
        <textarea rows={3} value={form.notes} onChange={set('notes')} />
      </label>

      <div className="action-row sticky-actions">
        <button type="button" className="btn" onClick={() => history.back()}>
          Prekliči
        </button>
        <button type="submit" className="btn primary">
          Shrani recept
        </button>
      </div>
    </form>
  );
}
