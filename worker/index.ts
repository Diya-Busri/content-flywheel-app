/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope;

// Handle incoming push notifications
self.addEventListener("push", (event: PushEvent) => {
  if (!event.data) return;

  let payload: { title?: string; body?: string; url?: string; icon?: string } = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Content Flywheel", body: event.data.text() };
  }

  const title = payload.title ?? "Content Flywheel";
  const options: NotificationOptions = {
    body: payload.body ?? "",
    icon: payload.icon ?? "/logo192.png",
    badge: "/logo192.png",
    data: { url: payload.url ?? "/dashboard" },
    vibrate: [200, 100, 200],
    tag: "cf-notification",
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Handle notification click — open/focus the app
self.addEventListener("notificationclick", (event: NotificationClickEvent) => {
  event.notification.close();
  const url: string = (event.notification.data as { url?: string })?.url ?? "/dashboard";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        return self.clients.openWindow(url);
      })
  );
});
