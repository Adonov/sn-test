export type VideoEmbed =
  | { kind: 'iframe'; src: string; /** Width / height. */ aspect: number }
  | { kind: 'file'; src: string };

/**
 * Turns a video link into something playable inside the recipe: an embedded player for
 * YouTube, Vimeo, TikTok and Instagram, or a <video> element for direct video files.
 * Returns undefined for links that can't be embedded (they are shown as a plain link).
 */
export function toVideoEmbed(link: string | undefined): VideoEmbed | undefined {
  let url: URL;
  try {
    url = new URL(link ?? '');
  } catch {
    return undefined;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return undefined;
  const host = url.hostname.replace(/^(www|m)\./, '');
  const path = url.pathname;

  if (/\.(mp4|webm|mov|m4v)$/i.test(path)) return { kind: 'file', src: url.href };

  if (host === 'youtu.be' || host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
    const id =
      host === 'youtu.be'
        ? path.slice(1)
        : url.searchParams.get('v') ?? path.match(/^\/(?:embed|shorts|live|v)\/([\w-]+)/)?.[1];
    if (!id || !/^[\w-]{6,}$/.test(id)) return undefined;
    const isShort = path.startsWith('/shorts/');
    return { kind: 'iframe', src: `https://www.youtube-nocookie.com/embed/${id}`, aspect: isShort ? 9 / 16 : 16 / 9 };
  }

  if (host.endsWith('vimeo.com')) {
    const id = path.match(/(?:^|\/)(\d{6,})(?:\/|$)/)?.[1];
    return id ? { kind: 'iframe', src: `https://player.vimeo.com/video/${id}`, aspect: 16 / 9 } : undefined;
  }

  if (host.endsWith('tiktok.com')) {
    const id = path.match(/\/(?:video|v|embed(?:\/v2)?)\/(\d{6,})/)?.[1];
    return id ? { kind: 'iframe', src: `https://www.tiktok.com/embed/v2/${id}`, aspect: 9 / 16 } : undefined;
  }

  if (host.endsWith('instagram.com')) {
    const m = path.match(/^\/(p|reel|reels|tv)\/([\w-]+)/);
    if (!m) return undefined;
    const type = m[1] === 'reels' ? 'reel' : m[1];
    return { kind: 'iframe', src: `https://www.instagram.com/${type}/${m[2]}/embed/`, aspect: 9 / 16 };
  }

  return undefined;
}
