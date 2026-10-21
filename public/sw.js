// Service worker do Team Jean.
// - Arquivos estáticos do Next (/_next/static, com hash no nome): cache-first.
// - Navegação: sempre pela rede. Sem conexão, usa a cópia da página (telas do
//   aluno já abertas neste aparelho, ex.: o treino) ou mostra /offline.html.
// - Notificações push: mostra o aviso e, ao tocar, abre a tela certa do app.
// - Requisições de outras origens (Supabase) e métodos diferentes de GET não
//   são interceptadas.
// Mude CACHE_VERSION para descartar os caches antigos.
const CACHE_VERSION = 'team-jean-v3';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const PAGES_CACHE = `${CACHE_VERSION}-pages`;
const OFFLINE_URL = '/offline.html';
const PRECACHE_URLS = [OFFLINE_URL, '/manifest.json'];
const APP_ICON = 'https://iqoiyqjndyvcputmllwq.supabase.co/storage/v1/object/public/assets/icon-512.png';
// Páginas guardadas para abrir sem internet (só as do aluno).
const OFFLINE_PAGES = /^\/student\//;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => !key.startsWith(CACHE_VERSION)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkWithOfflineFallback(request, url));
  }
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(STATIC_CACHE);
    cache.put(request, response.clone());
  }
  return response;
}

function isPage(response) {
  return response.ok && !response.redirected && (response.headers.get('content-type') || '').includes('text/html');
}

async function networkWithOfflineFallback(request, url) {
  try {
    const response = await fetch(request);
    if (OFFLINE_PAGES.test(url.pathname) && isPage(response)) {
      const cache = await caches.open(PAGES_CACHE);
      cache.put(url.pathname, response.clone());
    }
    return response;
  } catch {
    // O app instalado abre em "/": sem internet, vai para o "Hoje" guardado.
    const path = url.pathname === '/' ? '/student/today' : url.pathname;
    const page = OFFLINE_PAGES.test(path) ? await caches.match(path, { cacheName: PAGES_CACHE }) : null;
    const offline = page || (await caches.match(OFFLINE_URL));
    return (
      offline ||
      new Response('Sem conexão com a internet.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      })
    );
  }
}

self.addEventListener('message', (event) => {
  const data = event.data || {};
  // A tela pede para guardar a página atual (ex.: treino aberto por um link).
  if (data.type === 'cache-page' && typeof data.url === 'string' && OFFLINE_PAGES.test(data.url)) {
    event.waitUntil(
      fetch(data.url, { credentials: 'same-origin' })
        .then(async (response) => {
          if (!isPage(response)) return;
          const cache = await caches.open(PAGES_CACHE);
          await cache.put(data.url, response);
        })
        .catch(() => undefined),
    );
  }
  // Ao sair da conta, as páginas guardadas são apagadas.
  if (data.type === 'clear-pages') event.waitUntil(caches.delete(PAGES_CACHE));
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'Team Jean';
  event.waitUntil(
    (async () => {
      await self.registration.showNotification(title, {
        body: data.body || '',
        icon: APP_ICON,
        tag: data.tag || undefined,
        data: { url: data.url || '/' },
      });
      // Com o app aberto, o sino recarrega os avisos.
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      windows.forEach((client) => client.postMessage({ type: 'push-received' }));
    })(),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const existing = windows.find((client) => new URL(client.url).origin === self.location.origin);
      if (existing) {
        await existing.focus();
        if ('navigate' in existing) await existing.navigate(target).catch(() => undefined);
        return;
      }
      await self.clients.openWindow(target);
    })(),
  );
});
