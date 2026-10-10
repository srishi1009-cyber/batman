"use strict";

/* =====================================================
   RISHI MUSIC - SERVICE WORKER
   GitHub repository: batman
   Cache version: v8
   ===================================================== */

const CACHE_NAME = "rishi-music-v8";

const APP_SHELL = [
  "/batman/",
  "/batman/index.html",
  "/batman/style.css",
  "/batman/app.js",
  "/batman/manifest.json",
  "/batman/icons/icon-192.png",
  "/batman/icons/icon-512.png"
];

/* =====================================================
   INSTALL
   Cache application files for offline access.
   ===================================================== */

self.addEventListener("install", event => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      await Promise.all(
        APP_SHELL.map(async path => {
          try {
            const response = await fetch(path, {
              cache: "reload"
            });

            if (response.ok) {
              await cache.put(path, response);
            } else {
              console.warn(
                "Rishi Music: Could not cache",
                path,
                response.status
              );
            }
          } catch (error) {
            console.warn(
              "Rishi Music: Cache failed for",
              path,
              error
            );
          }
        })
      );

      await self.skipWaiting();
    })()
  );
});

/* =====================================================
   ACTIVATE
   Remove outdated Rishi Music caches.
   ===================================================== */

self.addEventListener("activate", event => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();

      await Promise.all(
        cacheNames.map(async name => {
          if (
            name.startsWith("rishi-music-") &&
            name !== CACHE_NAME
          ) {
            await caches.delete(name);
          }
        })
      );

      await self.clients.claim();
    })()
  );
});

/* =====================================================
   FETCH
   Network-first for pages.
   Cache-first for app files.
   ===================================================== */

self.addEventListener("fetch", event => {
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  // Only handle requests from this website.
  if (url.origin !== self.location.origin) {
    return;
  }

  // Do not interfere with audio streaming or partial requests.
  if (
    request.headers.has("range") ||
    url.pathname.includes("/songs/")
  ) {
    return;
  }

  // Do not cache browser extension or unrelated requests.
  if (!url.pathname.startsWith("/batman/")) {
    return;
  }

  /* -------------------------------
     PAGE NAVIGATION
     Network first, cached page offline.
     ------------------------------- */

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);

          if (response && response.ok) {
            const cache = await caches.open(CACHE_NAME);

            await cache.put(
              "/batman/index.html",
              response.clone()
            );
          }

          return response;
        } catch (error) {
          const cache = await caches.open(CACHE_NAME);

          const cachedPage = await cache.match(
            "/batman/index.html"
          );

          if (cachedPage) {
            return cachedPage;
          }

          const cachedRoot = await cache.match(
            "/batman/"
          );

          if (cachedRoot) {
            return cachedRoot;
          }

          return new Response(
            "Rishi Music is offline. Please open the app while connected to the internet once.",
            {
              status: 503,
              headers: {
                "Content-Type": "text/plain; charset=utf-8"
              }
            }
          );
        }
      })()
    );

    return;
  }

  /* -------------------------------
     APP FILES
     Cache first, update from network.
     ------------------------------- */

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cachedResponse = await cache.match(request);

      const networkRequest = fetch(request)
        .then(async response => {
          if (response && response.ok) {
            await cache.put(
              request,
              response.clone()
            );
          }

          return response;
        });

      if (cachedResponse) {
        event.waitUntil(
          networkRequest.catch(() => undefined)
        );

        return cachedResponse;
      }

      try {
        return await networkRequest;
      } catch (error) {
        return new Response(
          "This file is not available offline.",
          {
            status: 503,
            headers: {
              "Content-Type": "text/plain; charset=utf-8"
            }
          }
        );
      }
    })()
  );
});
