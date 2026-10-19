import { useEffect } from 'react';
import { useI18n } from './i18n';
import { localize } from './lib/localize';
import { useRoute } from './lib/router';
import { useAutoTranslate } from './lib/translation';
import { useAppState } from './lib/store';
import { BottomNav } from './components/BottomNav';
import { Library } from './pages/Library';
import { RecipeDetail } from './pages/RecipeDetail';
import { RecipeEditor } from './pages/RecipeEditor';
import { ImportPage } from './pages/ImportPage';
import { CookMode } from './pages/CookMode';
import { Planner } from './pages/Planner';
import { Grocery } from './pages/Grocery';
import { Settings } from './pages/Settings';
import { Account } from './pages/Account';
import { NotFound } from './components/NotFound';

export function App() {
  const [page, id, sub] = useRoute();
  const { recipes } = useAppState();
  const { lang } = useI18n();
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  useAutoTranslate(lang, recipes);

  const found = page === 'recipe' ? recipes.find((r) => r.id === id) : undefined;
  // Every screen shows recipes in the UI language (translated when needed).
  const recipe = found && localize(found, lang);
  if (page === 'recipe' && sub === 'cook' && recipe) return <CookMode recipe={recipe} />;

  let content;
  switch (page) {
    case undefined:
      content = <Library />;
      break;
    case 'recipe':
      if (!recipe) content = <NotFound />;
      else if (sub === 'edit') content = <RecipeEditor key={recipe.id} recipe={recipe} />;
      else content = <RecipeDetail recipe={recipe} />;
      break;
    case 'new':
      content = <RecipeEditor key="new" />;
      break;
    case 'import':
      content = <ImportPage key={id ?? 'import'} />;
      break;
    case 'planner':
      content = <Planner />;
      break;
    case 'grocery':
      content = <Grocery />;
      break;
    case 'settings':
      content = <Settings />;
      break;
    case 'account':
      content = <Account />;
      break;
    default:
      content = <NotFound />;
  }

  return (
    <div className="app">
      <main className="main">{content}</main>
      <BottomNav active={page ?? 'library'} />
    </div>
  );
}
