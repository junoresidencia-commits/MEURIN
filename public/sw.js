/* Service Worker do Meu Rim — PWA + Web Push + cache da aplicação (NÃO clínico).
   - navegação: network-first; prontuário médico cai no shell offline-consulta (dados vêm do IndexedDB);
   - /_next/static e ícones: cache-first (estrutura do app, sem dados de paciente);
   - /api/* NUNCA é cacheado (dados clínicos ficam só no IndexedDB, por médico);
   - push: sem dados clínicos. */

const VERSION = "meurim-v2-offline";
const STATIC_CACHE = `${VERSION}-static`;
const APP_CACHE = `${VERSION}-app`;
const OFFLINE_URL = "/offline.html";
const OFFLINE_CHART = "/offline-consulta.html";
const STATIC_ASSETS = [
  OFFLINE_URL,
  OFFLINE_CHART,
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
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Nunca cachear API (dados clínicos / sessão).
  if (url.pathname.startsWith("/api/")) return;

  if (req.method !== "GET") return;

  if (url.pathname.startsWith("/icons/") || url.pathname === "/manifest.webmanifest" || url.pathname === OFFLINE_URL || url.pathname === OFFLINE_CHART) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(STATIC_CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      }))
    );
    return;
  }

  // Bundles do Next (JS/CSS com hash): estrutura do app, sem prontuário.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(req).then((hit) => {
        if (hit) return hit;
        return fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(APP_CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        });
      })
    );
    return;
  }

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(async () => {
        if (url.pathname.startsWith("/medicos/paciente/")) {
          const chart = await caches.match(OFFLINE_CHART);
          if (chart) return chart;
        }
        const fallback = await caches.match(OFFLINE_URL);
        return fallback || new Response("Offline", { status: 503 });
      })
    );
    return;
  }
});

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
