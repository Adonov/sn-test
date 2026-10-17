import { useState } from 'react';

// Soft green/blue tints; the letter on top is drawn in the accent color via CSS.
const PALETTE = ['#e3f1ec', '#e2edf6', '#e9f3e4', '#e0eff1', '#e8edf7', '#edf4ea'];

/** Recipe photo with a colored placeholder when there is no image or it fails to load. */
export function RecipeImage({ src, title, className }: { src?: string; title: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (src && !failed) {
    return <img className={className} src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />;
  }
  const color = PALETTE[[...title].reduce((sum, c) => sum + c.charCodeAt(0), 0) % PALETTE.length];
  return (
    <div className={`${className ?? ''} placeholder`} style={{ background: color }} aria-hidden>
      {title.trim()[0]?.toUpperCase() ?? ''}
    </div>
  );
}
