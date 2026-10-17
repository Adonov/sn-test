import { useState } from 'react';

const PALETTE = ['#ffd8a8', '#ffc9c9', '#d3f9d8', '#c5f6fa', '#e5dbff', '#fff3bf'];

/** Recipe photo with a colored placeholder when there is no image or it fails to load. */
export function RecipeImage({ src, title, className }: { src?: string; title: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (src && !failed) {
    return <img className={className} src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />;
  }
  const color = PALETTE[[...title].reduce((sum, c) => sum + c.charCodeAt(0), 0) % PALETTE.length];
  return (
    <div className={`${className ?? ''} placeholder`} style={{ background: color }} aria-hidden>
      {title.trim()[0]?.toUpperCase() ?? '🍽'}
    </div>
  );
}
