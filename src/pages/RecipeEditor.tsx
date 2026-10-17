import { useEffect, useState, type FormEvent } from 'react';
import { useI18n } from '../i18n';
import { fileToDataUrl } from '../lib/image';
import { navigate } from '../lib/router';
import { clearPendingDraft, getPendingDraft, saveRecipe } from '../lib/store';
import type { Recipe } from '../lib/types';

interface FormState {
  title: string;
  description: string;
  image: string;
  sourceUrl: string;
  videoUrl: string;
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
    videoUrl: r?.videoUrl ?? '',
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
  const { t } = useI18n();
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
      setImageError(t('editor.photoError'));
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const id = saveRecipe({
      id: recipe?.id,
      title: form.title.trim() || t('recipe.untitled'),
      description: form.description.trim() || undefined,
      image: form.image.trim() || undefined,
      sourceUrl: form.sourceUrl.trim() || undefined,
      videoUrl: form.videoUrl.trim() || undefined,
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
        <h1>{recipe ? t('editor.titleEdit') : isImported ? t('editor.titleReview') : t('editor.titleNew')}</h1>
      </header>
      {isImported && <p className="notice">{t('editor.reviewNotice')}</p>}

      <label className="field">
        <span>{t('editor.name')}</span>
        <input required value={form.title} onChange={set('title')} placeholder={t('editor.namePlaceholder')} />
      </label>

      <div className="field">
        <span>{t('editor.photo')}</span>
        {form.image && <img className="editor-preview" src={form.image} alt="" referrerPolicy="no-referrer" />}
        <div className="row">
          <input value={form.image.startsWith('data:') ? t('editor.photoUploaded') : form.image} onChange={set('image')} placeholder={t('editor.photoUrl')} disabled={form.image.startsWith('data:')} />
          <label className="btn file-btn">
            {t('editor.upload')}
            <input type="file" accept="image/*" onChange={(e) => onPhoto(e.target.files?.[0])} hidden />
          </label>
          {form.image && (
            <button type="button" className="btn" onClick={() => setForm((f) => ({ ...f, image: '' }))}>
              {t('common.remove')}
            </button>
          )}
        </div>
        {imageError && <p className="error">{imageError}</p>}
      </div>

      <label className="field">
        <span>{t('editor.description')}</span>
        <input value={form.description} onChange={set('description')} />
      </label>

      <div className="grid-3">
        <label className="field">
          <span>{t('editor.servings')}</span>
          <input type="number" min={1} value={form.servings} onChange={set('servings')} />
        </label>
        <label className="field">
          <span>{t('editor.prep')}</span>
          <input type="number" min={0} value={form.prepMinutes} onChange={set('prepMinutes')} />
        </label>
        <label className="field">
          <span>{t('editor.cook')}</span>
          <input type="number" min={0} value={form.cookMinutes} onChange={set('cookMinutes')} />
        </label>
      </div>

      <label className="field">
        <span>{t('editor.ingredients')}</span>
        <small className="muted">{t('editor.ingredientsHint')}</small>
        <textarea rows={8} value={form.ingredients} onChange={set('ingredients')} placeholder={t('editor.ingredientsPlaceholder')} />
      </label>

      <label className="field">
        <span>{t('editor.steps')}</span>
        <small className="muted">{t('editor.stepsHint')}</small>
        <textarea rows={10} value={form.steps} onChange={set('steps')} />
      </label>

      <label className="field">
        <span>{t('editor.video')}</span>
        <small className="muted">{t('editor.videoHint')}</small>
        <input type="url" value={form.videoUrl} onChange={set('videoUrl')} placeholder="https://…" />
      </label>

      <label className="field">
        <span>{t('editor.tags')}</span>
        <input value={form.tags} onChange={set('tags')} placeholder={t('editor.tagsPlaceholder')} />
      </label>

      <label className="field">
        <span>{t('editor.source')}</span>
        <input type="url" value={form.sourceUrl} onChange={set('sourceUrl')} placeholder="https://…" />
      </label>

      <label className="field">
        <span>{t('editor.notes')}</span>
        <textarea rows={3} value={form.notes} onChange={set('notes')} />
      </label>

      <div className="action-row sticky-actions">
        <button type="button" className="btn" onClick={() => history.back()}>
          {t('editor.cancel')}
        </button>
        <button type="submit" className="btn primary">
          {t('editor.save')}
        </button>
      </div>
    </form>
  );
}
