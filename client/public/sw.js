self.addEventListener("push", function (event) {
    if (event.data) {
        try {
            const data = event.data.json();

            const title = data.title || "AniCircle Notification";
            const options = {
                body: data.body || "You have a new anime update!",
                icon: data.icon || "/logo.png",
                badge: "/logo.png",
                vibrate: [100, 50, 100],
                data: {
                    url: data.url || "/",
                },
            };

            event.waitUntil(self.registration.showNotification(title, options));
        } catch (e) {
            // Fallback if data is not JSON
            event.waitUntil(
                self.registration.showNotification("AniCircle", {
                    body: event.data.text(),
                    icon: "/logo.png",
                })
            );
        }
    }
});

self.addEventListener("notificationclick", function (event) {
    event.notification.close();

    // Navigate to the URL provided in the notification data
    if (event.notification.data && event.notification.data.url) {
        event.waitUntil(
            clients.matchAll({ type: "window" }).then((windowClients) => {
                // Check if there is already a window/tab open with the target URL
                for (let i = 0; i < windowClients.length; i++) {
                    const client = windowClients[i];
                    if (client.url === event.notification.data.url && "focus" in client) {
                        return client.focus();
                    }
                }
                // If not, open a new window
                if (clients.openWindow) {
                    return clients.openWindow(event.notification.data.url);
                }
            })
        );
    }
});
