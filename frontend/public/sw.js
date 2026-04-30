// iMuzik Service Worker v1
// Strategy:
//   - Static assets (JS/CSS/fonts/icons) → Cache First (stale-while-revalidate)
//   - API calls (/stream, /search, /charts) → Network Only (jangan di-cache SW)
//   - Thumbnails YT/Google → Cache First, TTL 7 hari

const CACHE_NAME   = 'imuzik-static-v1';
const THUMB_CACHE  = 'imuzik-thumbs-v1';
const THUMB_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 hari

// Domain API backend — jangan di-cache SW sama sekali
const API_HOSTS = [
  'localhost:7860',
  'localhost:8000',
];
// Pattern URL yang harus selalu ke network
const SKIP_CACHE_PATTERNS = [
  /\/stream\//,
  /\/search\?/,
  /\/charts/,
  /\/health/,
  /\/song\//,
  /\/album\//,
  /\/artist\//,
  /api\.anthropic\.com/,
  /youtube\.com\/embed/,
];

// ── Install: pre-cache shell assets ────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.addAll([
        '/',
        '/index.html',
      ]).catch(() => {}) // graceful — kalau offline pas install, skip aja
    )
  );
  self.skipWaiting(); // aktif langsung, ga nunggu tab lama ditutup
});

// ── Activate: hapus cache lama ──────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME && k !== THUMB_CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: routing logic ────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Bukan GET → bypass semua
  if (request.method !== 'GET') return;

  // API backend atau pola yang harus skip → network only
  const isApiHost = API_HOSTS.some(h => url.host.includes(h));
  const isSkip    = SKIP_CACHE_PATTERNS.some(p => p.test(request.url));
  if (isApiHost || isSkip) return; // biarkan browser handle sendiri

  // Thumbnail YT/Google → cache first, TTL check
  const isThumb = (
    url.hostname.includes('i.ytimg.com') ||
    url.hostname.includes('lh3.googleusercontent.com') ||
    url.hostname.includes('yt3.ggpht.com')
  );
  if (isThumb) {
    event.respondWith(thumbCacheFirst(request));
    return;
  }

  // Static assets (JS/CSS/fonts/woff/png/svg/ico) → stale-while-revalidate
  const isStatic = (
    url.pathname.match(/\.(js|css|woff2?|ttf|otf|png|svg|ico|webp|jpg|jpeg)$/) ||
    url.pathname.startsWith('/assets/')
  );
  if (isStatic) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // HTML navigation → network first, fallback ke cache (offline support)
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstHtml(request));
    return;
  }
  // Lainnya → bypass
});

// ── Strategies ──────────────────────────────────────────────────────────────

async function staleWhileRevalidate(request) {
  const cache    = await caches.open(CACHE_NAME);
  const cached   = await cache.match(request);
  const fetchPrm = fetch(request).then(res => {
    if (res.ok) cache.put(request, res.clone());
    return res;
  }).catch(() => null);
  return cached || await fetchPrm;
}

async function thumbCacheFirst(request) {
  const cache  = await caches.open(THUMB_CACHE);
  const cached = await cache.match(request);

  if (cached) {
    // Cek TTL dari header Date
    const dateHeader = cached.headers.get('date');
    if (dateHeader) {
      const age = Date.now() - new Date(dateHeader).getTime();
      if (age < THUMB_TTL_MS) return cached; // masih fresh
    } else {
      return cached; // ga ada date header → anggap fresh
    }
  }

  // Fetch baru
  try {
    const res = await fetch(request);
    if (res.ok) {
      cache.put(request, res.clone());
      // Limit thumb cache 500 entries
      trimCache(THUMB_CACHE, 500);
    }
    return res;
  } catch {
    return cached || new Response('', { status: 408 });
  }
}

async function networkFirstHtml(request) {
  try {
    const res   = await fetch(request);
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, res.clone());
    return res;
  } catch {
    const cached = await caches.match(request) || await caches.match('/index.html');
    return cached || new Response('Offline', { status: 503 });
  }
}

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys  = await cache.keys();
  if (keys.length > maxEntries) {
    // Hapus yang paling lama (FIFO)
    await Promise.all(keys.slice(0, keys.length - maxEntries).map(k => cache.delete(k)));
  }
}
