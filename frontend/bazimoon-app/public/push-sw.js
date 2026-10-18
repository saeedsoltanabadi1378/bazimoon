// Web Push handlers, loaded into the generated service worker (see workbox.importScripts in vite.config.ts).

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Bazimoon", {
      body: data.body || "",
      icon: "/pwa-192x192.png",
      badge: "/pwa-64x64.png",
      lang: data.lang,
      dir: data.dir,
      tag: data.url,
      data: { url: data.url || "/" },
    }),
  );
});

// Opens the game or screen the notification is about, reusing an open window when there is one.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => new URL(w.url).origin === self.location.origin);
      if (open) return open.focus().then((w) => w.navigate(url));
      return self.clients.openWindow(url);
    }),
  );
});
