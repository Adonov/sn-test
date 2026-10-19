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
import { AddFood } from './pages/AddFood';
import { Goals } from './pages/Goals';
import { Nutrition } from './pages/Nutrition';
import { Progress } from './pages/Progress';
import { Fasting } from './pages/Fasting';
import { Health } from './pages/Health';
import { Reminders } from './pages/Reminders';
import { Welcome } from './pages/Welcome';
import { Training } from './pages/Training';
import { Connections } from './pages/Connections';
import { NotFound } from './components/NotFound';

export function App() {
  const [page, id, sub, extra] = useRoute();
  const { recipes, onboardedAt, profile } = useAppState();
  const { lang } = useI18n();
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  useAutoTranslate(lang, recipes);

  const found = page === 'recipe' ? recipes.find((r) => r.id === id) : undefined;
  // Every screen shows recipes in the UI language (translated when needed).
  const recipe = found && localize(found, lang);
  if (page === 'recipe' && sub === 'cook' && recipe) return <CookMode recipe={recipe} />;
  // First launch: a short setup instead of the home screen (shared links and the account still open).
  if (!onboardedAt && !profile && (page === undefined || page === 'nutrition' || page === 'welcome')) return <Welcome />;

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
    case 'fasting':
      content = <Fasting />;
      break;
    case 'connections':
      content = <Connections />;
      break;
    case 'training':
      content = <Training />;
      break;
    case 'reminders':
      content = <Reminders />;
      break;
    case 'health':
      content = <Health />;
      break;
    case 'welcome':
      content = <Welcome />;
      break;
    case 'nutrition':
      content =
        id === 'add' ? (
          <AddFood key={`${sub}-${extra}`} date={sub} slot={extra} />
        ) : id === 'goals' ? (
          <Goals />
        ) : id === 'progress' ? (
          <Progress />
        ) : (
          <Nutrition date={id} />
        );
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
