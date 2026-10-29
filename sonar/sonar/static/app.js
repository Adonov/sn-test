// Sonar – vmesnik brez gradnje (vanilla JS moduli)

const ICONS = {
  home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  list: '<path d="M4 6h11M4 12h11M4 18h7M18 8v10M15 15l3 3 3-3"/>',
  disc: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/>',
  headphones: '<path d="M4 18v-5a8 8 0 0 1 16 0v5"/><rect x="3" y="15" width="5" height="6" rx="1.5"/><rect x="16" y="15" width="5" height="6" rx="1.5"/>',
  play: '<path d="M7 4.5v15l13-7.5z" stroke="none" fill="currentColor"/>',
  pause: '<rect x="6" y="4" width="4" height="16" rx="1" stroke="none" fill="currentColor"/><rect x="14" y="4" width="4" height="16" rx="1" stroke="none" fill="currentColor"/>',
  heart: '<path d="M12 20s-7-4.4-9.2-9A5 5 0 0 1 12 6.3 5 5 0 0 1 21.2 11C19 15.6 12 20 12 20z"/>',
  bookmark: '<path d="M6 3h12v18l-6-4-6 4z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  arrowL: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  arrowR: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  chevR: '<path d="M9 6l6 6-6 6"/>',
  ext: '<path d="M7 17L17 7M9 7h8v8"/>',
  prev: '<path d="M18 5L9 12l9 7zM6 5v14"/>',
  next: '<path d="M6 5l9 7-9 7zM18 5v14"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  waves: '<path d="M3 9c3-3 6 3 9 0s6 3 9 0M3 15c3-3 6 3 9 0s6 3 9 0"/>',
  download: '<path d="M12 4v12M6 11l6 6 6-6M4 20h16"/>',
}
const icon = (name, cls = '') =>
  `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`

const $ = (sel, root = document) => root.querySelector(sel)
const view = $('#view')
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const fmtTime = (s) => {
  s = Math.max(0, Math.floor(s || 0))
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
}
const fmtNum = (n) => Number(n || 0).toLocaleString('en-US')

async function api(path, opts = {}) {
  const init = { ...opts }
  if (opts.json !== undefined) {
    init.method = init.method || 'POST'
    init.headers = { 'Content-Type': 'application/json' }
    init.body = JSON.stringify(opts.json)
  }
  const res = await fetch(path, init)
  if (!res.ok) {
    let msg = res.statusText
    try { msg = (await res.json()).detail || msg } catch {}
    throw new Error(msg)
  }
  return res.json()
}

let toastTimer
function toast(msg) {
  const el = $('#toast')
  el.textContent = msg
  el.hidden = false
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (el.hidden = true), 3000)
}

const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d } catch { return d } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} },
}

// ---------- naslovnice ----------

function hue(seed) {
  let h = 0
  for (const c of String(seed)) h = (h * 31 + c.charCodeAt(0)) % 360
  return h
}
function fallbackCover(seed) {
  const h = hue(seed)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${h},55%,55%)"/><stop offset="1" stop-color="hsl(${(h + 50) % 360},45%,28%)"/></linearGradient></defs><rect width="10" height="10" fill="url(#g)"/></svg>`
  return 'data:image/svg+xml,' + encodeURIComponent(svg)
}
function cover(t, cls = '') {
  const fb = fallbackCover(t.id ?? t.name)
  const src = t.id ? `/api/tracks/${t.id}/cover` : t.cover || fb
  return `<img class="cover ${cls}" loading="lazy" src="${src}" data-fb="${fb}" onerror="this.onerror=null;this.src=this.dataset.fb" alt="">`
}

// ---------- seznami komadov ----------

const lists = new Map()
const trackById = new Map()
let listSeq = 0

const LABELS = {
  found: ['TRACK ID FOUND', 'found'],
  closest: ['CLOSEST WE FOUND', 'closest'],
  similar: ['SIMILAR', 'similar'],
}

function trackRow(t, listId, i, opts = {}) {
  trackById.set(t.id, t)
  const label = opts.label && LABELS[opts.label]
  const playing = player.current()?.id === t.id
  const facets = t.facets
    ? `<div class="facet-bars">${Object.entries(t.facets).map(([k, v]) => `<span>${k} <b>${v}%</b></span>`).join('')}</div>`
    : ''
  return `
  <div class="track ${playing ? 'playing' : ''}" data-id="${t.id}">
    <button class="play" data-act="play" data-list="${listId}" data-i="${i}" title="Play">${icon(playing && player.playing() ? 'pause' : 'play')}</button>
    ${cover(t)}
    <div style="min-width:0">
      <div class="name">${label?.[1] === 'closest' ? '<span class="accent">≈</span> ' : ''}${esc(t.title || 'Untitled')}${t.artist ? `<span class="sep">·</span><span class="artist">${esc(t.artist)}</span>` : ''}</div>
      <div class="meta">
        ${opts.rank ? `<span class="rank">${String(opts.rank).padStart(2, '0')}</span>` : ''}
        ${label ? `<span class="tag">${label[0]}</span>` : ''}
        ${t.match != null ? `<span class="match">${t.match}% match</span>` : ''}
        ${t.bpm ? `<span>${Math.round(t.bpm)} BPM</span>` : ''}
        ${t.camelot ? `<span class="keych" title="${esc(t.key)}">${esc(t.camelot)}</span>` : ''}
        ${t.local || t.owned ? '<span class="tag" style="color:var(--green)">IN YOUR COLLECTION</span>' : ''}
        ${PLATFORMS[t.source] ? `<span class="src" title="${sourceName(t.source)}">${platformIcon(t.source, 14)}${sourceName(t.source)}</span>` : ''}
      </div>
      ${facets}
    </div>
    <div class="actions">
      <button class="chip-btn" data-act="buy" title="Buy / open">Buy ${icon('ext')}</button>
      <button class="icon-btn" data-act="add" title="Add to playlist">${icon('plus')}</button>
      <button class="icon-btn ${t.liked ? 'on' : ''}" data-act="like" title="Like (L)">${icon('heart')}</button>
      <button class="icon-btn ${t.saved ? 'on' : ''}" data-act="save" title="Save for later (S)">${icon('bookmark')}</button>
      ${opts.remove ? `<button class="icon-btn" data-act="remove" title="Remove from playlist">${icon('x')}</button>` : ''}
      <a class="chip-btn" href="#/dig/track/${t.id}">Dig ${icon('chevR')}</a>
    </div>
  </div>`
}

function trackList(tracks, opts = {}) {
  const id = String(++listSeq)
  lists.set(id, tracks)
  if (!tracks.length) return `<div class="empty">${opts.empty || 'Nothing here yet.'}</div>`
  return `<div class="tracks">${tracks.map((t, i) => trackRow(t, id, i, { rank: opts.ranked ? i + 1 : 0, label: opts.label?.(t, i), remove: opts.remove })).join('')}</div>`
}

function refreshRows(id) {
  const t = trackById.get(id)
  document.querySelectorAll(`.track[data-id="${id}"]`).forEach((row) => {
    row.querySelector('[data-act=like]')?.classList.toggle('on', !!t.liked)
    row.querySelector('[data-act=save]')?.classList.toggle('on', !!t.saved)
  })
  player.render()
}

async function toggleFlag(id, flag) {
  const t = trackById.get(id)
  if (!t) return
  const updated = await api(`/api/tracks/${id}`, { json: { [flag]: !t[flag] } })
  t[flag] = updated[flag]
  refreshRows(id)
  toast(flag === 'liked' ? (t.liked ? 'Liked' : 'Unliked') : t.saved ? 'Saved for later' : 'Removed from saved')
}

function openMenu(anchor, html) {
  closeMenu()
  const m = document.createElement('div')
  m.className = 'menu'
  m.innerHTML = html
  document.body.appendChild(m)
  const r = anchor.getBoundingClientRect()
  m.style.top = `${window.scrollY + r.bottom + 6}px`
  m.style.left = `${Math.max(8, Math.min(window.innerWidth - m.offsetWidth - 8, r.right - m.offsetWidth))}px`
  return m
}
function closeMenu() {
  document.querySelectorAll('.menu').forEach((m) => m.remove())
}

function buyMenu(anchor, t) {
  const q = encodeURIComponent(`${t.artist || ''} ${t.title || ''}`.trim())
  openMenu(anchor, `
    <div class="menu-label label">Find this track</div>
    <a target="_blank" rel="noopener" href="https://bandcamp.com/search?q=${q}">Bandcamp</a>
    <a target="_blank" rel="noopener" href="https://www.beatport.com/search?q=${q}">Beatport</a>
    <a target="_blank" rel="noopener" href="https://www.juno.co.uk/search/?q%5Ball%5D%5B%5D=${q}">Juno Download</a>
    <a target="_blank" rel="noopener" href="https://www.discogs.com/search/?q=${q}&type=all">Discogs</a>
    <a target="_blank" rel="noopener" href="https://www.youtube.com/results?search_query=${q}">YouTube</a>
    ${t.link ? `<a target="_blank" rel="noopener" href="${esc(t.link)}">Deezer</a>` : ''}`)
}

async function addMenu(anchor, t) {
  const pls = await api('/api/playlists')
  const m = openMenu(anchor, `
    <div class="menu-label label">Add to playlist</div>
    ${pls.map((p) => `<button data-pl="${p.id}">${esc(p.name)} <span class="muted">· ${p.count}</span></button>`).join('')}
    <button data-pl="new"><span class="accent">+ New playlist</span></button>`)
  m.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-pl]')
    if (!b) return
    let pid = b.dataset.pl
    if (pid === 'new') {
      const name = prompt('Playlist name')
      if (!name) return
      pid = (await api('/api/playlists', { json: { name } })).id
    }
    await api(`/api/playlists/${pid}/tracks`, { json: { track_id: t.id } })
    closeMenu()
    toast('Added to playlist')
  })
}

document.addEventListener('click', async (e) => {
  if (!e.target.closest('.menu')) closeMenu()
  const btn = e.target.closest('[data-act]')
  if (!btn) return
  const row = btn.closest('.track')
  const id = row && Number(row.dataset.id)
  const t = id && trackById.get(id)
  try {
    switch (btn.dataset.act) {
      case 'play': {
        const list = lists.get(btn.dataset.list)
        const i = Number(btn.dataset.i)
        const c = player.current()
        if (c && (c === list[i] || (c.id && c.id === list[i].id))) player.toggle()
        else player.play(list, i)
        break
      }
      case 'like': return toggleFlag(id, 'liked')
      case 'save': return toggleFlag(id, 'saved')
      case 'buy': e.stopPropagation(); return buyMenu(btn, t)
      case 'add': e.stopPropagation(); return addMenu(btn, t)
      case 'remove': return btn.dispatchEvent(new CustomEvent('remove-track', { bubbles: true, detail: id }))
      case 'upload': return $('#file-input').click()
    }
  } catch (err) {
    toast(err.message)
  }
})

// ---------- predvajalnik ----------

const player = (() => {
  const audio = new Audio()
  audio.preload = 'auto'
  let queue = [], idx = -1
  let startAt = store.get('startAt', true)
  let skip = store.get('skip', 30)
  const el = $('#player')

  const cur = () => queue[idx]
  const srcOf = (t) => {
    if (t.src) return t.src
    // pretočni komadi (SoundCloud, YouTube …) se ne dajo previjati, zato začetek pošljemo strežniku
    const start = t.streamed && startAt && t.duration > 90 ? Math.round(t.duration * 0.25) : 0
    return `/api/tracks/${t.id}/audio${start ? `?start=${start}` : ''}`
  }

  function play(list, i) {
    queue = list
    idx = i
    const t = cur()
    if (!t) return
    audio.src = srcOf(t)
    audio.play().catch((err) => toast(`Can't play: ${err.message}`))
    render()
  }
  audio.addEventListener('loadedmetadata', () => {
    const t = cur()
    if (t?.startTime != null) audio.currentTime = t.startTime
    else if (startAt && !t?.streamed && audio.duration > 90) audio.currentTime = audio.duration * 0.25
  })
  audio.addEventListener('ended', () => (cur()?.src ? render() : next()))
  audio.addEventListener('error', () => cur() && toast('This track has no playable audio'))
  for (const ev of ['play', 'pause']) audio.addEventListener(ev, render)
  audio.addEventListener('timeupdate', () => {
    const bar = $('.bar i', el)
    if (bar) bar.style.width = `${(audio.currentTime / (audio.duration || 1)) * 100}%`
    const tm = $('.time', el)
    if (tm) tm.textContent = `${fmtTime(audio.currentTime)} / ${fmtTime(audio.duration)}`
    document.dispatchEvent(new CustomEvent('player-time', { detail: { t: cur(), time: audio.currentTime } }))
  })

  function next() { if (idx < queue.length - 1) play(queue, idx + 1) }
  function prev() { if (audio.currentTime > 5 || idx === 0) audio.currentTime = 0; else play(queue, idx - 1) }
  function toggle() { if (!cur()) return; audio.paused ? audio.play() : audio.pause() }

  function render() {
    const t = cur()
    document.querySelectorAll('.track').forEach((row) => {
      const on = t && Number(row.dataset.id) === t.id
      row.classList.toggle('playing', !!on)
      const b = row.querySelector('[data-act=play]')
      if (b) b.innerHTML = icon(on && !audio.paused ? 'pause' : 'play')
    })
    document.dispatchEvent(new CustomEvent('player-state'))
    if (!t) { el.hidden = true; return }
    el.hidden = false
    el.innerHTML = `
      <div class="bar"><i></i></div>
      <div class="inner">
        <button class="icon-btn" data-p="toggle">${icon(audio.paused ? 'play' : 'pause')}</button>
        <div class="now">
          ${t.id ? cover(t, 'sm') : ''}
          <div><div class="t">${esc(t.title)}</div><div class="a">${esc(t.artist || '')}</div></div>
        </div>
        <div class="keys">
          <button class="keybtn" data-p="next"><kbd>↓</kbd> Next</button>
          <button class="keybtn" data-p="prev"><kbd>↑</kbd> Prev</button>
          <button class="keybtn" data-p="toggle"><kbd>Space</kbd> Play</button>
          <button class="keybtn" data-p="back"><kbd>←</kbd></button><button class="keybtn" data-p="fwd"><kbd>→</kbd></button>
          <button class="keybtn" data-p="skip">${skip} s</button>
          ${t.id ? `<button class="keybtn ${t.liked ? 'accent' : ''}" data-p="like"><kbd>L</kbd> Like</button>` : ''}
          <span class="switch ${startAt ? 'on' : ''}" data-p="startAt"><i></i> Start at 25%</span>
        </div>
        <span class="time">${fmtTime(audio.currentTime)} / ${fmtTime(audio.duration)}</span>
        <button class="icon-btn" data-p="close" title="Close">${icon('x')}</button>
      </div>`
  }

  el.addEventListener('click', (e) => {
    const bar = e.target.closest('.bar')
    if (bar) {
      const r = bar.getBoundingClientRect()
      audio.currentTime = ((e.clientX - r.left) / r.width) * (audio.duration || 0)
      return
    }
    const a = e.target.closest('[data-p]')?.dataset.p
    if (a === 'toggle') toggle()
    if (a === 'next') next()
    if (a === 'prev') prev()
    if (a === 'back') audio.currentTime -= skip
    if (a === 'fwd') audio.currentTime += skip
    if (a === 'skip') { skip = skip === 30 ? 10 : skip === 10 ? 60 : 30; store.set('skip', skip); render() }
    if (a === 'like') toggleFlag(cur().id, 'liked')
    if (a === 'startAt') { startAt = !startAt; store.set('startAt', startAt); render() }
    if (a === 'close') { audio.pause(); queue = []; idx = -1; render() }
  })

  document.addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea, select') || e.metaKey || e.ctrlKey || e.altKey || !cur()) return
    const k = e.key
    if (k === ' ') { e.preventDefault(); toggle() }
    else if (k === 'ArrowDown') { e.preventDefault(); next() }
    else if (k === 'ArrowUp') { e.preventDefault(); prev() }
    else if (k === 'ArrowRight') audio.currentTime += skip
    else if (k === 'ArrowLeft') audio.currentTime -= skip
    else if ((k === 'l' || k === 'L') && cur().id) toggleFlag(cur().id, 'liked')
    else if ((k === 's' || k === 'S') && cur().id) toggleFlag(cur().id, 'saved')
  })

  return {
    play, toggle, next, prev, render, audio,
    current: cur,
    playing: () => !audio.paused,
    seekTo(time) { audio.currentTime = time; audio.play() },
  }
})()

// ---------- nalaganje datotek ----------

async function upload(file) {
  if (!file) return
  toast(`Uploading ${file.name}…`)
  const fd = new FormData()
  fd.append('file', file)
  try {
    const a = await api('/api/analyses', { method: 'POST', body: fd })
    location.hash = `#/a/${a.id}`
  } catch (err) {
    toast(err.message)
  }
}
$('#file-input').addEventListener('change', (e) => { upload(e.target.files[0]); e.target.value = '' })
let dragDepth = 0
window.addEventListener('dragenter', (e) => { if (e.dataTransfer?.types?.includes('Files')) { dragDepth++; $('#drop-overlay').hidden = false } })
window.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; $('#drop-overlay').hidden = true } })
window.addEventListener('dragover', (e) => e.preventDefault())
window.addEventListener('drop', (e) => {
  e.preventDefault()
  dragDepth = 0
  $('#drop-overlay').hidden = true
  upload(e.dataTransfer.files[0])
})

// ---------- strani ----------

let cleanup = []
const onLeave = (fn) => cleanup.push(fn)
function poll(fn, ms) {
  let stop = false, timer
  const loop = async () => {
    if (stop) return
    try { if ((await fn()) === false) return } catch {}
    if (!stop) timer = setTimeout(loop, ms)
  }
  loop()
  onLeave(() => { stop = true; clearTimeout(timer) })
}

function waveBars(seed, n = 64) {
  let x = hue(seed) + 7
  return Array.from({ length: n }, (_, i) => {
    x = (x * 9301 + 49297) % 233280
    const h = 25 + (x / 233280) * 55 + (i % 8 === 0 ? 20 : 0)
    return `<span style="height:${Math.min(100, h)}%"></span>`
  }).join('')
}

async function homePage() {
  const [stats, analyses] = await Promise.all([api('/api/stats'), api('/api/analyses')])
  let demo = null
  const lastTrack = analyses.find((a) => a.kind === 'track' && a.status === 'done')
  if (lastTrack) {
    demo = { ref: { name: lastTrack.name, title: lastTrack.name, artist: '' }, href: `#/a/${lastTrack.id}`,
      results: (await api(`/api/analyses/${lastTrack.id}/similar?k=4`)).results }
  } else if (stats.tracks > 1) {
    const [t] = await api('/api/tracks?limit=1')
    const r = await api(`/api/tracks/${t.id}/similar?k=4`)
    demo = { ref: r.reference, href: `#/dig/track/${t.id}`, results: r.results }
  }
  const demoCard = demo
    ? `<a class="card demo-card" href="${demo.href}" style="display:block">
        <div style="display:flex;justify-content:space-between"><span class="label">Reference track</span><span class="label accent">● Ranked by sound</span></div>
        <div class="ref">${cover(demo.ref, 'sm')}<div><div style="font-size:22px;font-weight:600">${esc(demo.ref.title)}</div><div class="label">${esc(demo.ref.artist || '')}</div></div></div>
        <div class="wave">${waveBars(demo.ref.title)}</div>
        <div class="facets"><span class="facet">Rhythm</span><span class="facet">Bass</span><span class="facet">Texture</span><span class="facet">Atmosphere</span></div>
        <div class="mini-list">
          <div style="display:flex;justify-content:space-between"><span class="label">Most similar tracks</span><span class="label">Top 100</span></div>
          ${demo.results.map((r, i) => `
            <div class="mini-row"><span class="label">${String(i + 1).padStart(2, '0')}</span>${cover(r, 'sm')}
              <div style="min-width:0"><div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(r.title)}</div><div class="label" style="font-size:11px">${esc(r.artist || '')}</div></div>
              <div><div class="pct">${r.match}<small>%</small></div><div class="bar"><i style="width:${r.match}%"></i></div></div></div>`).join('')}
        </div>
      </a>`
    : `<div class="card demo-card">
        <span class="label">Step 1 · Build your catalog</span>
        <h3 style="font-size:26px;margin:16px 0 8px">Your catalog is empty</h3>
        <p class="muted">Sonar compares sound against a catalog that lives on your computer. Add your own music folder
        (Rekordbox / Serato / Traktor library) and grow it with 30-second previews from Deezer – artists, labels, genres or playlists.</p>
        <div class="wave">${waveBars('empty')}</div>
        <a class="chip-btn primary" href="#/collection">Build catalog ${icon('arrowR')}</a>
      </div>`

  view.innerHTML = `
    <section class="hero">
      <div>
        <div class="eyebrow">Sound-alike radar for DJs</div>
        <h1>Play one track.<br>Hear what fits next<span class="dot">.</span></h1>
        <p class="lead">Drop a track or a whole DJ set. Sonar pings your crate and brings back the closest-sounding tracks – ranked by groove, bass, texture and mood.</p>
        <div class="actions">
          <button class="btn" data-act="upload">Drop a track or set ${icon('arrowR')}</button>
          <a class="btn dark" href="#/collection">Connect collection <span class="btn-icons">${['bandcamp', 'youtube', 'soundcloud', 'discogs'].map((k) => platformIcon(k, 22)).join('')}</span></a>
        </div>
        ${linkForm()}
        <div class="stat-line"><span class="dot-live"></span>Search across <b>${fmtNum(stats.tracks)}</b> tracks</div>
      </div>
      ${demoCard}
    </section>
    ${analyses.length ? `
      <div class="section-title"><h2>Recent digs</h2><a class="label" href="#/sets">All sets →</a></div>
      <div class="grid-cards">${analyses.slice(0, 6).map(analysisCard).join('')}</div>` : ''}`
}

function linkForm() {
  return `<form class="link-form" onsubmit="event.preventDefault(); window.analyzeLink(this.url.value)">
    <input type="text" name="url" placeholder="…or paste a SoundCloud, Mixcloud, YouTube or Bandcamp link to a set or track" required>
    <button class="chip-btn primary">Dig</button>
  </form>`
}

window.analyzeLink = async (url) => {
  try {
    const a = await api('/api/analyses/link', { json: { url: url.trim() } })
    location.hash = `#/a/${a.id}`
  } catch (err) {
    toast(err.message)
  }
}

function analysisCard(a, extra = '') {
  const status = a.status === 'done'
    ? `${a.kind === 'set' ? 'DJ set' : 'Track'} · ${fmtTime(a.duration)}${a.bpm ? ` · ${Math.round(a.bpm)} BPM` : ''}${a.camelot ? ` · ${a.camelot}` : ''}`
    : a.status === 'error' ? `<span class="accent">Error: ${esc(a.error)}</span>` : `Analyzing… ${Math.round(a.progress * 100)}%`
  return `<a class="card set-card" href="#/a/${a.id}">
    <span class="label">${a.kind === 'set' ? icon('headphones', 'i14') + ' Set' : a.kind === 'track' ? 'Track' : 'Upload'}</span>
    <div class="name">${esc(a.name)}</div>
    <div class="muted">${status}${extra}</div>
  </a>`
}

// ----- Dig -----

async function digSearchPage() {
  const q = store.get('digQuery', '')
  view.innerHTML = `
    <div class="search-bar"><input type="search" id="dig-q" placeholder="Search any artist or track…" value="${esc(q)}" autofocus></div>
    <div id="dig-results"></div>
    <div id="web-results"></div>
    <div class="dropzone" data-act="upload" style="margin-top:28px"><b>Or drop any audio file</b>A track (MP3, WAV, FLAC, AIFF …) or a full DJ set</div>`
  const input = $('#dig-q')
  let timer, seq = 0
  const run = async () => {
    const query = input.value.trim()
    const mine = ++seq
    store.set('digQuery', query)
    const tracks = await api(`/api/tracks?limit=100&q=${encodeURIComponent(query)}`)
    if (mine !== seq) return
    $('#dig-results').innerHTML = tracks.length
      ? `<div class="section-title" style="margin-top:0"><h2>In your catalog</h2><span class="label">${tracks.length}</span></div>${trackList(tracks)}`
      : ''
    if (!query) { $('#web-results').innerHTML = ''; return }
    $('#web-results').innerHTML = '<div class="section-title"><h2>On the web</h2><span class="label">searching Deezer…</span></div>'
    try {
      const web = (await api(`/api/online/search?q=${encodeURIComponent(query)}`)).filter((t) => !t.id)
      if (mine !== seq) return
      const id = String(++listSeq)
      lists.set(id, web.map((t) => ({ ...t, src: t.preview })))
      $('#web-results').innerHTML = `<div class="section-title"><h2>On the web</h2><span class="label">Deezer · ${web.length}</span></div>
        ${web.length ? `<div class="tracks">${web.map((t, i) => webRow(t, id, i)).join('')}</div>` : '<div class="empty">Nothing found.</div>'}`
    } catch (err) {
      $('#web-results').innerHTML = `<div class="empty">Online search failed: ${esc(err.message)}</div>`
    }
  }
  input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(run, 350) })
  $('#web-results').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-webdig]')
    if (!b) return
    b.disabled = true
    b.textContent = 'Listening…'
    try {
      const r = await api('/api/online/dig', { json: { deezer_id: Number(b.dataset.webdig) } })
      location.hash = `#/dig/track/${r.id}`
    } catch (err) {
      toast(err.message)
      b.disabled = false
      b.innerHTML = `Dig ${icon('chevR')}`
    }
  })
  run()
}

function webRow(t, listId, i) {
  return `<div class="track" data-web="${t.deezer_id}">
    <button class="play" data-act="play" data-list="${listId}" data-i="${i}" title="Play preview">${icon('play')}</button>
    <img class="cover" loading="lazy" src="${esc(t.cover || fallbackCover(t.deezer_id))}" alt="">
    <div style="min-width:0">
      <div class="name">${esc(t.title)}${t.artist ? `<span class="sep">·</span><span class="artist">${esc(t.artist)}</span>` : ''}</div>
      <div class="meta">${t.album ? `<span>${esc(t.album)}</span>` : ''}${t.duration ? `<span>${fmtTime(t.duration)}</span>` : ''}</div>
    </div>
    <div class="actions">
      <button class="chip-btn primary" data-webdig="${t.deezer_id}" title="Analyze it and find similar tracks">Dig ${icon('chevR')}</button>
    </div>
  </div>`
}

const bpmFilter = () => store.get('bpmTol', 0)
const resultCount = () => store.get('resultCount', 100)

function digToolbar() {
  return `<div class="toolbar">
    <span class="label">Tempo</span>
    <select id="bpm-tol">${[[0, 'Any BPM'], [3, '± 3 %'], [6, '± 6 %'], [10, '± 10 %']].map(([v, l]) => `<option value="${v}" ${bpmFilter() === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
    <span class="label">Show</span>
    <select id="result-count">${[25, 50, 100, 200].map((v) => `<option ${resultCount() === v ? 'selected' : ''}>${v}</option>`).join('')}</select>
    <span style="flex:1"></span><span class="label">Hover a row to see rhythm / bass / texture / atmosphere</span>
  </div>`
}
function bindToolbar(reload) {
  $('#bpm-tol').addEventListener('change', (e) => { store.set('bpmTol', Number(e.target.value)); reload() })
  $('#result-count').addEventListener('change', (e) => { store.set('resultCount', Number(e.target.value)); reload() })
}
const similarQuery = () => `k=${resultCount()}${bpmFilter() ? `&bpm_tol=${bpmFilter()}` : ''}`

async function digTrackPage(id) {
  const r = await api(`/api/tracks/${id}/similar?${similarQuery()}`)
  const t = r.reference
  trackById.set(t.id, t)
  view.innerHTML = `
    <a class="back label" href="#/dig">${icon('arrowL')} Dig</a>
    <div class="panel">
      <div class="ref-head">
        <button class="icon-btn" data-act="play" data-list="${(lists.set('ref' + t.id, [t]), 'ref' + t.id)}" data-i="0">${icon('play')}</button>
        ${cover(t, 'lg')}
        <div><div class="title">${esc(t.title)} <span class="artist">· ${esc(t.artist || '')}</span></div>
          <div class="sub">${t.duration ? fmtTime(t.duration) : ''}${t.bpm ? `<span>${Math.round(t.bpm)} BPM</span>` : ''}${t.camelot ? `<span class="keych">${t.camelot}</span>` : ''}<span class="label">${t.source === 'local' ? 'Your library' : sourceName(t.source)}</span></div></div>
        <span class="spacer"></span><span class="label">Reference</span>
      </div>
      <div class="tabs"><button class="active">Similar tracks <span class="count" id="dig-count">${r.results.length}</span></button></div>
      <div id="grow" class="note" hidden></div>
      ${digToolbar()}
      <div id="dig-list"></div>
    </div>`
  const show = (results) => {
    $('#dig-count').textContent = results.length
    $('#dig-list').innerHTML = trackList(results, { ranked: true, empty: 'Your catalog needs more tracks to compare against – it is growing in the background, or <a class="accent" href="#/collection">add music →</a>' })
    player.render()
  }
  const refresh = async () => show((await api(`/api/tracks/${id}/similar?${similarQuery()}`)).results)
  show(r.results)
  bindToolbar(refresh)

  // med zajemom v ozadju se rezultati sproti osvežujejo
  let wasRunning = false
  poll(async () => {
    const running = (await api('/api/jobs')).filter((j) => j.kind !== 'analysis' && (j.status === 'running' || j.status === 'queued'))
    const grow = $('#grow')
    if (!grow) return false
    if (running.length) {
      wasRunning = true
      const added = running.reduce((n, j) => n + j.added, 0)
      grow.hidden = false
      grow.innerHTML = `<span class="dot-live" style="display:inline-block;margin-right:8px"></span>Growing the catalog around this artist and related ones · <b>${fmtNum(added)}</b> tracks added · results update automatically`
      if (!document.querySelector('.track.playing')) await refresh()
      refreshCount()
    } else if (wasRunning) {
      wasRunning = false
      grow.innerHTML = 'Catalog updated.'
      await refresh()
      refreshCount()
    }
    return true
  }, 5000)
}

async function analysisPage(id) {
  const a = await api(`/api/analyses/${id}`)
  if (a.status === 'queued' || a.status === 'running') {
    view.innerHTML = `<div class="card status-card"><span class="label">Listening</span>
      <h2 id="an-name">${esc(a.name)}</h2><p class="muted" id="an-msg">Analyzing the audio…</p>
      <div class="progress"><i id="an-prog" style="width:${a.progress * 100}%"></i></div></div>`
    poll(async () => {
      const b = await api(`/api/analyses/${id}`)
      $('#an-prog') && ($('#an-prog').style.width = `${Math.max(3, b.progress * 100)}%`)
      $('#an-msg') && !b.duration && b.status === 'running' && ($('#an-msg').textContent = 'Downloading from the link…')
      $('#an-msg') && b.duration && ($('#an-msg').textContent = b.duration > 720
        ? `DJ set, ${fmtTime(b.duration)} – cutting it into passages…` : 'Single track – fingerprinting…')
      if (b.status === 'queued' || b.status === 'running') return true
      route()
      return false
    }, 1000)
    return
  }
  if (a.status === 'error') {
    view.innerHTML = `<div class="card status-card"><h2>Couldn't analyze ${esc(a.name)}</h2><p class="muted">${esc(a.error)}</p>
      <button class="chip-btn primary" data-act="upload">Try another file</button></div>`
    return
  }
  return a.kind === 'set' ? setPage(a) : uploadedTrackPage(a)
}

async function uploadedTrackPage(a) {
  const ref = { name: a.name, title: a.name, src: `/api/analyses/${a.id}/audio`, startTime: null }
  const load = async () => {
    const r = await api(`/api/analyses/${a.id}/similar?${similarQuery()}`)
    lists.set('up' + a.id, [ref])
    view.innerHTML = `
      <a class="back label" href="#/sets">${icon('arrowL')} All uploads</a>
      <div class="panel">
        <div class="ref-head">
          <button class="icon-btn" data-act="play" data-list="up${a.id}" data-i="0">${icon('play')}</button>
          ${cover(ref, 'lg')}
          <div><div class="title">${esc(a.name)}</div>
            <div class="sub">${fmtTime(a.duration)}${a.bpm ? `<span>${Math.round(a.bpm)} BPM</span>` : ''}${a.camelot ? `<span class="keych">${a.camelot}</span>` : ''}</div></div>
          <span class="spacer"></span><span class="label">Reference</span>
          <button class="icon-btn" id="del" title="Delete">${icon('trash')}</button>
        </div>
        <div class="tabs"><button class="active">Similar tracks <span class="count">${r.results.length}</span></button></div>
        ${digToolbar()}
        ${trackList(r.results, { ranked: true, empty: 'Your catalog needs more tracks. <a class="accent" href="#/collection">Add music →</a>' })}
      </div>`
    bindToolbar(load)
    $('#del').addEventListener('click', () => deleteAnalysis(a))
  }
  await load()
}

async function deleteAnalysis(a) {
  if (!confirm(`Delete "${a.name}"?`)) return
  await api(`/api/analyses/${a.id}`, { method: 'DELETE' })
  location.hash = '#/sets'
}

// ----- Sets -----

async function setsPage() {
  const all = await api('/api/analyses')
  view.innerHTML = `
    <div class="dropzone" data-act="upload"><b>Drop a DJ set or a track</b>Anything longer than 12 minutes is treated as a set and cut into passages</div>
    ${linkForm()}
    <div class="section-title"><h2>Sets</h2></div>
    <div class="grid-cards">${all.filter((a) => a.kind !== 'track').map(analysisCard).join('') || '<div class="muted">No sets yet.</div>'}</div>
    <div class="section-title"><h2>Uploaded tracks</h2></div>
    <div class="grid-cards">${all.filter((a) => a.kind === 'track').map(analysisCard).join('') || '<div class="muted">No tracks yet.</div>'}</div>`
  if (all.some((a) => a.status === 'queued' || a.status === 'running')) {
    const t = setTimeout(route, 2000)
    onLeave(() => clearTimeout(t))
  }
}

function drawArt(canvas, seed) {
  const ctx = canvas.getContext('2d')
  const w = (canvas.width = canvas.clientWidth * 2), h = (canvas.height = canvas.clientHeight * 2)
  const base = hue(seed)
  ctx.fillStyle = `hsl(${base},45%,18%)`
  ctx.fillRect(0, 0, w, h)
  let x = base + 3
  const rnd = () => ((x = (x * 9301 + 49297) % 233280) / 233280)
  for (let k = 0; k < 4; k++) {
    const cx = rnd() * w, cy = rnd() * h, col = [`hsl(${(base + 140) % 360},70%,55%)`, '#2fe0c0', '#f5d36b', `hsl(${(base + 300) % 360},50%,45%)`][k]
    for (let r = 20; r < w; r += 26) {
      ctx.beginPath()
      ctx.strokeStyle = col
      ctx.globalAlpha = 0.55 - r / w / 2
      ctx.lineWidth = 9
      ctx.ellipse(cx, cy, r, r * (0.5 + rnd() * 0.3), rnd() * 3, 0, Math.PI * (1 + rnd()))
      ctx.stroke()
    }
  }
  ctx.globalAlpha = 1
}

async function setPage(a) {
  const [tracklist, similar, sets] = await Promise.all([
    api(`/api/analyses/${a.id}/tracklist`),
    api(`/api/analyses/${a.id}/similar?k=100`),
    api(`/api/analyses/${a.id}/similar-sets`),
  ])
  const setItem = { name: a.name, title: a.name, artist: 'DJ set', src: `/api/analyses/${a.id}/audio` }
  lists.set('set' + a.id, [setItem])
  let tab = store.get('setTab', 'tracklist')
  let currentPassage = -1

  const isThisSet = () => player.current() === setItem
  const playAt = (time) => {
    if (!isThisSet()) { setItem.startTime = time; player.play([setItem], 0) }
    else player.seekTo(time)
  }

  const passageHtml = (p) => {
    const [top, ...rest] = p.matches
    const id = String(++listSeq)
    lists.set(id, p.matches)
    return `<div class="passage" data-pi="${p.index}">
      <div class="time"><button data-seek="${p.start}" title="Play the set from here">${icon('play')}</button><span>${fmtTime(p.start)}</span></div>
      <div class="rows">
        ${top ? trackRow(top, id, 0, { label: top.label }) : '<div class="empty">No match – add more music to your catalog.</div>'}
        ${rest.length ? `<details class="more"><summary class="label" style="cursor:pointer">+ ${rest.length} more that fit${p.bpm ? ` · passage ${Math.round(p.bpm)} BPM` : ''}${p.camelot ? ` · ${p.camelot}` : ''}</summary>
          ${rest.map((t, i) => trackRow(t, id, i + 1, { label: 'similar' })).join('')}</details>` : ''}
      </div></div>`
  }

  const tabBody = () => {
    if (tab === 'similar') return digToolbarless(similar.results)
    if (tab === 'sets') {
      return sets.length
        ? `<div class="grid-cards" style="padding:28px">${sets.map((s) => analysisCard(s, ` · <span class="accent">${s.match}% match</span>`)).join('')}</div>`
        : '<div class="empty">Analyze more sets to compare them.</div>'
    }
    const anyFound = tracklist.some((p) => p.matches[0]?.label === 'found')
    return `<p class="note">${anyFound ? 'Passages marked TRACK ID FOUND are almost identical to a track in your catalog.' : 'No IDs found. A lot of what DJs play is unreleased, so each passage shows the closest sounding catalog tracks instead.'}</p>
      <div class="timeline">${tracklist.map(passageHtml).join('')}</div>`
  }
  const digToolbarless = (results) => trackList(results, { ranked: true, empty: 'Add more music to your catalog.' })

  view.innerHTML = `
    <a class="back label" href="#/sets">${icon('arrowL')} All sets</a>
    <div class="set-grid">
      <div class="set-side">
        <div class="set-player">
          <div class="art"><canvas></canvas><button class="big-play" id="set-play">${icon('play')}</button></div>
          <div class="info">
            <div class="now" id="set-now">${esc(tracklist[0]?.matches[0] ? `${tracklist[0].matches[0].title} – ${tracklist[0].matches[0].artist || ''}` : a.name)}</div>
            <div class="muted" id="set-now-sub">Passage 1 · closest match</div>
            <div class="seek" id="set-seek"><i></i><div class="marks">${tracklist.map((p) => `<span style="left:${(p.start / a.duration) * 100}%"></span>`).join('')}</div></div>
          </div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:22px">
          <div><div style="font-size:24px;font-weight:600">${esc(a.name)}</div><div class="muted">${fmtTime(a.duration)} · ${tracklist.length} passages${a.bpm ? ` · ${Math.round(a.bpm)} BPM` : ''}</div></div>
          <button class="icon-btn" id="del" title="Delete set">${icon('trash')}</button>
        </div>
        <div class="card" style="display:flex;align-items:center;gap:8px;padding:14px 18px;margin-top:18px">
          <button class="chip-btn" id="p-prev">${icon('prev')}</button>
          <span class="label" id="p-idx">– / ${tracklist.length}</span>
          <button class="chip-btn" id="p-next">${icon('next')}</button>
        </div>
        <div class="legend">
          <div><span class="label accent">● Track ID found</span> played here</div>
          <div><span class="label accent">≈ Closest we found</span> no ID, nearest by sound</div>
          <div><span class="label accent">◐ Similar</span> more that fit</div>
        </div>
      </div>
      <div class="panel">
        <div class="ref-head">
          <div><div class="title">${esc(a.name)}</div><div class="sub">${fmtTime(a.duration)} · ${icon('waves', 'i14')} ${tracklist.length} passages${a.bpm ? ` · ${Math.round(a.bpm)} BPM` : ''}${a.camelot ? ` <span class="keych">${a.camelot}</span>` : ''}</div></div>
          <span class="spacer"></span><span class="label">Reference</span>
        </div>
        <div class="tabs">
          <button data-tab="similar">Similar tracks <span class="count">${similar.results.length}</span></button>
          <button data-tab="sets">Similar sets <span class="count">${sets.length}</span></button>
          <button data-tab="tracklist">Tracklist <span class="count">${tracklist.length}</span></button>
        </div>
        <div id="tab-body"></div>
      </div>
    </div>`
  drawArt($('canvas', view), a.name)

  const showTab = () => {
    view.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab))
    $('#tab-body').innerHTML = tabBody()
    markPassage(currentPassage, true)
  }
  view.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab; store.set('setTab', tab); showTab() }))
  showTab()

  $('#tab-body').addEventListener('click', (e) => {
    const s = e.target.closest('[data-seek]')
    if (s) playAt(Number(s.dataset.seek))
  })
  $('#set-play').addEventListener('click', () => (isThisSet() ? player.toggle() : playAt(tracklist[Math.max(0, currentPassage)]?.start || 0)))
  $('#set-seek').addEventListener('click', (e) => {
    const r = e.currentTarget.getBoundingClientRect()
    playAt(((e.clientX - r.left) / r.width) * a.duration)
  })
  $('#p-prev').addEventListener('click', () => playAt(tracklist[Math.max(0, currentPassage - 1)].start))
  $('#p-next').addEventListener('click', () => playAt(tracklist[Math.min(tracklist.length - 1, currentPassage + 1)].start))
  $('#del').addEventListener('click', () => deleteAnalysis(a))

  function markPassage(i, force) {
    if (i === currentPassage && !force) return
    currentPassage = i
    view.querySelectorAll('.passage').forEach((el) => el.classList.toggle('current', Number(el.dataset.pi) === i))
    const p = tracklist[i]
    if (!p) return
    const m = p.matches[0]
    $('#set-now').textContent = m ? `${m.title} – ${m.artist || ''}` : a.name
    $('#set-now-sub').textContent = `Passage ${i + 1} · ${m ? (m.label === 'found' ? 'track ID found' : `closest match ${m.match}%`) : 'no match'}`
    $('#p-idx').textContent = `${i + 1} / ${tracklist.length}`
  }
  const onTime = (e) => {
    if (e.detail.t !== setItem) return
    const time = e.detail.time
    $('#set-seek i').style.width = `${(time / a.duration) * 100}%`
    let i = 0
    while (i < tracklist.length - 1 && tracklist[i + 1].start <= time) i++
    markPassage(i)
  }
  const onState = () => { const b = $('#set-play'); if (b) b.innerHTML = icon(isThisSet() && player.playing() ? 'pause' : 'play') }
  document.addEventListener('player-time', onTime)
  document.addEventListener('player-state', onState)
  onLeave(() => { document.removeEventListener('player-time', onTime); document.removeEventListener('player-state', onState) })
  onState()
}

// ----- Collection -----

const PLATFORMS = {
  bandcamp: { name: 'Bandcamp', color: '#1da0c3', icon: '<path d="M2 18L8.5 6H22l-6.5 12z"/>', hint: 'Your Bandcamp username (bandcamp.com/<b>username</b>) – everything you bought', ph: 'username' },
  soundcloud: { name: 'SoundCloud', color: '#ff5500', icon: '<path d="M3 15v3M6 12v6M9 10v8M12 8v10M15 7c4 0 6 3 6 6a5 5 0 0 1-5 5h-1z"/>', hint: 'Username or link – your likes, or any profile / playlist link', ph: 'username or link' },
  youtube: { name: 'YouTube', color: '#ff0033', icon: '<rect x="2" y="5" width="20" height="14" rx="4"/><path d="M10 9l5 3-5 3z" fill="#151210" stroke="none"/>', hint: 'A public playlist link (or a channel)', ph: 'playlist link' },
  discogs: { name: 'Discogs', color: '#f2ede8', icon: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5" fill="#151210" stroke="none"/><circle cx="12" cy="12" r="1.5"/>', hint: 'Your Discogs username – records in your collection, via their YouTube clips', ph: 'username', token: true },
  mixcloud: { name: 'Mixcloud', color: '#5000ff', icon: '<path d="M7 18a4 4 0 0 1 0-8 6 6 0 0 1 11 2 3 3 0 0 1 0 6z"/>', hint: 'Username – tracks from your favourites (sets go on the Sets page)', ph: 'username' },
}
const sourceName = (k) => PLATFORMS[k]?.name || (k === 'deezer' ? 'Deezer' : k === 'local' ? 'local' : k)
const platformIcon = (k, size = 22) => PLATFORMS[k]
  ? `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${PLATFORMS[k].color}" stroke="${PLATFORMS[k].color}" stroke-width="1.5" stroke-linejoin="round">${PLATFORMS[k].icon}</svg>` : ''

function connectTile(c) {
  const p = PLATFORMS[c.platform]
  return `<form class="connect-tile ${c.handle ? 'connected' : ''}" data-platform="${c.platform}">
    <div class="connect-head">${platformIcon(c.platform, 26)}<b>${p.name}</b>
      ${c.handle ? `<span class="label" style="color:var(--green);margin-left:auto">● Connected</span>` : ''}</div>
    <p class="hint" style="margin:6px 0 10px">${p.hint}</p>
    <input type="text" name="handle" value="${esc(c.handle || '')}" placeholder="${p.ph}" required>
    ${p.token ? '<input type="text" name="token" placeholder="Personal token (only for a private collection)" style="margin-top:8px">' : ''}
    <div class="form-row" style="margin-top:10px">
      <button class="chip-btn primary">${c.handle ? 'Sync' : 'Connect'}</button>
      ${c.handle ? `<button type="button" class="chip-btn" data-disconnect="${c.platform}">Disconnect</button>
        <span class="hint" style="margin:0">synced ${new Date(c.synced * 1000).toLocaleDateString()}</span>` : ''}
    </div>
  </form>`
}

async function collectionPage() {
  const stats = await api('/api/stats')
  let tab = store.get('collTab', 'owned')
  const [conns, settings] = await Promise.all([api('/api/connections'), api('/api/settings')])
  view.innerHTML = `
    <div class="section-title" style="margin-top:0"><h2>Collection</h2>
      <span class="label">${[`${fmtNum(stats.tracks)} tracks`, `${fmtNum(stats.owned || 0)} yours`,
        ...Object.entries(stats.by_source).filter(([k]) => k !== 'local').map(([k, n]) => `${fmtNum(n)} ${sourceName(k)}`)].join(' · ')}</span></div>

    <div class="card" id="connect">
      <span class="label">Connect collection</span>
      <h3 style="margin:10px 0 4px">Bring in what you already own, like and follow</h3>
      <p class="muted" style="margin:0">Sonar reads your public collection, fingerprints every track and marks matches as <span style="color:var(--green)">IN YOUR COLLECTION</span>. Press Sync any time to pick up new ones.</p>
      <div class="connect-grid">${conns.map(connectTile).join('')}</div>
    </div>

    <div class="two-col" style="margin-top:24px">
      <form class="card" id="f-folder">
        <span class="label">Your music</span>
        <h3 style="margin:10px 0 4px">Add a folder from this computer</h3>
        <p class="muted" style="margin:0">Every audio file in it (and sub-folders) gets fingerprinted. Files never leave your computer.</p>
        <div class="form-row"><input type="text" name="path" placeholder="/Users/you/Music/DJ" required><button class="chip-btn primary">Import</button></div>
        <p class="hint">Tip: point it at your Rekordbox / Serato / Traktor music folder.</p>
      </form>
      <form class="card" id="f-sources">
        <span class="label">Discover</span>
        <h3 style="margin:10px 0 4px">Grow the catalog from anywhere</h3>
        <p class="muted" style="margin:0">Artists, searches or links – one per line. Paste a SoundCloud, YouTube, Bandcamp, Mixcloud, Beatport, Audiomack or Deezer link: a track, playlist, profile, label or album.</p>
        <textarea name="lines" rows="4" style="margin-top:12px" placeholder="Octave&#10;https://soundcloud.com/rinsefm/sets/...&#10;https://perlon.bandcamp.com&#10;label:Innervisions&#10;q:minimal house"></textarea>
        <div class="form-row">
          <label>Search names on</label>
          <select name="search_on" style="width:auto"><option value="deezer">Deezer</option><option value="soundcloud">SoundCloud</option><option value="youtube">YouTube</option></select>
          <label><input type="checkbox" name="related" checked> Related artists</label>
        </div>
        <div class="form-row">
          <label>Max new tracks</label><input type="number" name="max" value="1000" min="10" max="100000" style="width:110px">
          <label>Per artist</label><input type="number" name="per" value="10" min="1" max="100" style="width:80px">
          <button class="chip-btn primary">Start</button>
        </div>
        <p class="hint">Deezer extras: <code>label:Name</code> · <code>q:any search</code>. Related artists works for Deezer names. Mixes longer than 15 min are skipped – drop those on the Sets page instead.</p>
      </form>
    </div>
    <div class="jobs" id="jobs"></div>
    <div class="panel" style="margin-top:36px">
      <div class="tabs">
        <button data-tab="owned">In your collection</button><button data-tab="liked">Liked</button><button data-tab="saved">Saved</button><button data-tab="all">All tracks</button>
      </div>
      <div id="coll-search" class="toolbar" hidden><input type="search" placeholder="Filter by artist or title"></div>
      <div id="coll-body"></div>
    </div>`

  view.querySelectorAll('form[data-platform]').forEach((f) => f.addEventListener('submit', async (e) => {
    e.preventDefault()
    const platform = f.dataset.platform
    try {
      if (f.token?.value) await api('/api/settings', { json: { discogs_token: f.token.value } })
      await api(`/api/connections/${platform}`, { json: { handle: f.handle.value.trim() } })
      toast(`Syncing ${PLATFORMS[platform].name}… progress is shown below`)
      watchJobs()
      setTimeout(() => $('#jobs')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 600)
    } catch (err) { toast(err.message) }
  }))
  view.querySelectorAll('[data-disconnect]').forEach((b) => b.addEventListener('click', async () => {
    await api(`/api/connections/${b.dataset.disconnect}`, { method: 'DELETE' })
    route()
  }))
  if (settings.discogs_token) view.querySelector('form[data-platform=discogs] [name=token]')?.setAttribute('placeholder', 'Token saved ✓')

  $('#f-folder').addEventListener('submit', async (e) => {
    e.preventDefault()
    try {
      await api('/api/import/folder', { json: { path: e.target.path.value.trim() } })
      toast('Import started')
      watchJobs()
    } catch (err) { toast(err.message) }
  })
  $('#f-sources').addEventListener('submit', async (e) => {
    e.preventDefault()
    const f = e.target
    try {
      await api('/api/import/sources', { json: {
        lines: f.lines.value.split('\n').map((s) => s.trim()).filter(Boolean), search_on: f.search_on.value,
        max_tracks: Number(f.max.value), per_artist: Number(f.per.value), related: f.related.checked,
      } })
      toast('Started')
      watchJobs()
    } catch (err) { toast(err.message) }
  })

  let q = ''
  const showTab = async () => {
    view.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab))
    $('#coll-search').hidden = tab !== 'all'
    const params = tab === 'all' ? `q=${encodeURIComponent(q)}&limit=200` : `${tab}=true&limit=500`
    const tracks = await api(`/api/tracks?${params}`)
    const empty = {
      all: 'No tracks yet – connect a collection, import a folder or discover above.',
      owned: 'Connect a collection or import a folder above.',
    }[tab] || `Nothing ${tab} yet. Press ♥ or the bookmark on any track.`
    $('#coll-body').innerHTML = trackList(tracks, { empty })
  }
  view.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab; store.set('collTab', tab); showTab() }))
  let timer
  $('#coll-search input').addEventListener('input', (e) => { q = e.target.value; clearTimeout(timer); timer = setTimeout(showTab, 200) })
  showTab()

  let watching = false
  function watchJobs() {
    if (watching) return
    watching = true
    poll(async () => {
      const jobs = await api('/api/jobs')
      const el = $('#jobs')
      if (!el) return false
      el.innerHTML = jobs.filter((j) => j.kind !== 'analysis').map((j) => `
        <div class="card job">
          <div><b>${esc(j.label)}</b><div class="muted" style="font-size:14px">${j.status === 'error' ? `<span class="accent">${esc(j.message)}</span>` : `${j.status} · ${fmtNum(j.added)} added${j.failed ? ` · ${j.failed} failed` : ''} · ${esc(j.message)}`}</div>
            ${j.errors?.length ? `<details class="hint"><summary>${j.errors.length} problem${j.errors.length > 1 ? 's' : ''}</summary>${j.errors.slice(-10).map((x) => `<div>${esc(x)}</div>`).join('')}</details>` : ''}</div>
          <div class="progress"><i style="width:${j.total ? Math.min(100, (j.done / j.total) * 100) : j.status === 'done' ? 100 : 3}%"></i></div>
          ${j.status === 'running' || j.status === 'queued' ? `<button class="chip-btn" data-cancel="${j.id}">Stop</button>` : '<span></span>'}
        </div>`).join('')
      const running = jobs.some((j) => j.status === 'running' || j.status === 'queued')
      if (!running) {
        watching = false
        refreshCount()
      }
      return running
    }, 1500)
  }
  $('#jobs').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-cancel]')
    if (b) await api(`/api/jobs/${b.dataset.cancel}/cancel`, { method: 'POST' })
  })
  watchJobs()
}

// ----- Playlists -----

async function playlistsPage() {
  const pls = await api('/api/playlists')
  view.innerHTML = `
    <div class="section-title" style="margin-top:0"><h2>Playlists</h2></div>
    <form class="search-bar" id="f-new"><input type="text" name="name" placeholder="New playlist name, e.g. Warm-up Friday" required><button class="chip-btn primary">Create</button></form>
    <div class="grid-cards">${pls.map((p) => `
      <a class="card set-card" href="#/playlists/${p.id}"><span class="label">Playlist</span><div class="name">${esc(p.name)}</div><div class="muted">${p.count} tracks</div></a>`).join('') || '<div class="muted">No playlists yet. Use + on any track to add it to one.</div>'}</div>`
  $('#f-new').addEventListener('submit', async (e) => {
    e.preventDefault()
    const { id } = await api('/api/playlists', { json: { name: e.target.name.value } })
    location.hash = `#/playlists/${id}`
  })
}

async function playlistPage(id) {
  const p = await api(`/api/playlists/${id}`)
  view.innerHTML = `
    <a class="back label" href="#/playlists">${icon('arrowL')} Playlists</a>
    <div class="panel">
      <div class="ref-head">
        <div><div class="title">${esc(p.name)}</div><div class="sub">${p.tracks.length} tracks</div></div>
        <span class="spacer"></span>
        <a class="chip-btn" href="/api/playlists/${p.id}/export.m3u">${icon('download')} Export M3U</a>
        <button class="icon-btn" id="del" title="Delete playlist">${icon('trash')}</button>
      </div>
      ${trackList(p.tracks, { remove: true, empty: 'Empty. Press + on any track to add it here.' })}
    </div>`
  const onRemove = async (e) => {
    await api(`/api/playlists/${id}/tracks/${e.detail}`, { method: 'DELETE' })
    route()
  }
  view.addEventListener('remove-track', onRemove)
  onLeave(() => view.removeEventListener('remove-track', onRemove))
  $('#del').addEventListener('click', async () => {
    if (!confirm(`Delete playlist "${p.name}"?`)) return
    await api(`/api/playlists/${id}`, { method: 'DELETE' })
    location.hash = '#/playlists'
  })
}

// ---------- usmerjanje ----------

async function refreshCount() {
  try {
    const s = await api('/api/stats')
    $('#catalog-count').innerHTML = `${fmtNum(s.tracks)} tracks`
  } catch {}
}

async function route() {
  cleanup.forEach((fn) => fn())
  cleanup = []
  closeMenu()
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  const [page = 'home', a, b] = parts
  document.querySelectorAll('[data-nav]').forEach((el) => {
    const nav = el.dataset.nav
    el.classList.toggle('active', nav === page || (nav === 'sets' && page === 'a'))
  })
  window.scrollTo(0, 0)
  try {
    if (page === 'home') await homePage()
    else if (page === 'dig' && a === 'track') await digTrackPage(Number(b))
    else if (page === 'dig') await digSearchPage()
    else if (page === 'a') await analysisPage(Number(a))
    else if (page === 'sets') await setsPage()
    else if (page === 'collection') await collectionPage()
    else if (page === 'playlists' && a) await playlistPage(Number(a))
    else if (page === 'playlists') await playlistsPage()
    else view.innerHTML = '<div class="empty"><h3>Not found</h3></div>'
  } catch (err) {
    view.innerHTML = `<div class="empty"><h3>Something went wrong</h3>${esc(err.message)}</div>`
  }
  player.render()
}

document.querySelectorAll('[data-icon]').forEach((el) => (el.outerHTML = icon(el.dataset.icon)))
window.addEventListener('hashchange', route)
refreshCount()
route()
