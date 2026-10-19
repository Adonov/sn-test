import { useI18n, type MessageKey } from '../i18n';
import { Icon, type IconName } from './Icon';
import { useAppState } from '../lib/store';

const ITEMS: { id: string; href: string; label: MessageKey; icon: IconName }[] = [
  { id: 'library', href: '#/', label: 'nav.recipes', icon: 'book' },
  { id: 'planner', href: '#/planner', label: 'nav.plan', icon: 'calendar' },
  { id: 'grocery', href: '#/grocery', label: 'nav.grocery', icon: 'cart' },
  { id: 'settings', href: '#/settings', label: 'nav.more', icon: 'more' },
];

export function BottomNav({ active }: { active: string }) {
  const { grocery } = useAppState();
  const { t } = useI18n();
  const open = grocery.filter((g) => !g.checked).length;
  const current =
    active === 'recipe' || active === 'new' || active === 'import' ? 'library' : active === 'account' ? 'settings' : active;
  return (
    <nav className="bottom-nav" aria-label={t('nav.label')}>
      <div className="brand">
        <Icon name="logo" /> Forkful
      </div>
      {ITEMS.map((item) => (
        <a key={item.id} href={item.href} className={current === item.id ? 'active' : ''} aria-current={current === item.id ? 'page' : undefined}>
          <span className="nav-icon" aria-hidden>
            <Icon name={item.icon} />
            {item.id === 'grocery' && open > 0 && <span className="badge">{open}</span>}
          </span>
          <span>{t(item.label)}</span>
        </a>
      ))}
    </nav>
  );
}
