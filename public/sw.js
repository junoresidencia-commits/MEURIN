/* Service Worker do Meu Rim — PWA + Web Push.
   Estratégia conservadora: NÃO faz cache de HTML dinâmico (evita "app velho").
   - navegações: network-first, com fallback offline mínimo;
   - estáticos do próprio app (ícones/manifest): cache-first;
   - push: mostra notificação discreta (sem dados clínicos);
   - clique: abre/deep-link no destino, focando aba existente quando possível. */

const VERSION = "meurim-v1";
const STATIC_CACHE = `${VERSION}-static`;
const OFFLINE_URL = "/offline.html";
const STATIC_ASSETS = [
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-192.png",
  "/icons/icon-maskable-512.png",
  "/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((c) => c.addAll(STATIC_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Estáticos do PWA: cache-first.
  if (url.pathname.startsWith("/icons/") || url.pathname === "/manifest.webmanifest") {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(STATIC_CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      }))
    );
    return;
  }

  // Navegações (HTML): network-first, fallback offline. Nunca serve HTML cacheado velho.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() => caches.match(OFFLINE_URL).then((r) => r || new Response("Offline", { status: 503 })))
    );
    return;
  }
  // Demais GETs: rede direta (deixa o Next cuidar do cache de assets com hash).
});

// ---- Web Push ----
self.addEventListener("push", (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch (_e) { payload = { body: event.data ? event.data.text() : "" }; }
  const title = payload.title || "Meu Rim";
  const options = {
    body: payload.body || "Você recebeu uma atualização no Meu Rim.",
    icon: payload.icon || "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: payload.tag || undefined,
    renotify: Boolean(payload.tag),
    data: { url: payload.url || "/", ...(payload.data || {}) },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of all) {
        try {
          const u = new URL(client.url);
          if (u.origin === self.location.origin && "focus" in client) {
            await client.focus();
            if ("navigate" in client) { try { await client.navigate(target); } catch (_e) {} }
            return;
          }
        } catch (_e) {}
      }
      if (self.clients.openWindow) await self.clients.openWindow(target);
    })()
  );
});
