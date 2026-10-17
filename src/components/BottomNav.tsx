import { useAppState } from '../lib/store';

const ITEMS = [
  { id: 'library', href: '#/', label: 'Recepti', icon: '📖' },
  { id: 'planner', href: '#/planner', label: 'Načrt', icon: '📅' },
  { id: 'grocery', href: '#/grocery', label: 'Nakupi', icon: '🛒' },
  { id: 'settings', href: '#/settings', label: 'Več', icon: '⚙️' },
];

export function BottomNav({ active }: { active: string }) {
  const { grocery } = useAppState();
  const open = grocery.filter((g) => !g.checked).length;
  const current = active === 'recipe' || active === 'new' || active === 'import' ? 'library' : active;
  return (
    <nav className="bottom-nav" aria-label="Glavna navigacija">
      <div className="brand">
        <span aria-hidden>🍲</span> Forkful
      </div>
      {ITEMS.map((item) => (
        <a key={item.id} href={item.href} className={current === item.id ? 'active' : ''} aria-current={current === item.id ? 'page' : undefined}>
          <span className="nav-icon" aria-hidden>
            {item.icon}
            {item.id === 'grocery' && open > 0 && <span className="badge">{open}</span>}
          </span>
          <span>{item.label}</span>
        </a>
      ))}
    </nav>
  );
}
