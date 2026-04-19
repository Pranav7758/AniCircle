import { useState, useEffect } from "react";
import { toast } from "sonner";

// For a real production app, this should securely come from the server environment
// Using a placeholder public VAPID key for demonstration/local functionality
const PUBLIC_VAPID_KEY = "BDwB7Ea4NXY_w-l6P7T9QW2X3Y4Z5_6a7b8c9d0e1f2g3h4i5j6k7l8m9n0o1p2q3r4s5t6u7v8w9x0y1z2A3B4";

function urlBase64ToUint8Array(base64String: string) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/\-/g, "+").replace(/_/g, "/");

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

export function usePushNotifications() {
    const [isSupported, setIsSupported] = useState(false);
    const [permission, setPermission] = useState<NotificationPermission>("default");
    const [subscription, setSubscription] = useState<PushSubscription | null>(null);
    const [isSubscribing, setIsSubscribing] = useState(false);

    useEffect(() => {
        // Check if push messaging is supported
        if ("serviceWorker" in navigator && "PushManager" in window) {
            setIsSupported(true);
            setPermission(Notification.permission);
            checkSubscription();
        }
    }, []);

    const checkSubscription = async () => {
        try {
            const registration = await navigator.serviceWorker.ready;
            const existingSub = await registration.pushManager.getSubscription();
            setSubscription(existingSub);
        } catch (error) {
            console.error("Error checking push subscription:", error);
        }
    };

    const subscribe = async () => {
        if (!isSupported) {
            toast.error("Push notifications are not supported in this browser.");
            return;
        }

        try {
            setIsSubscribing(true);

            const requestedPermission = await Notification.requestPermission();
            setPermission(requestedPermission);

            if (requestedPermission !== "granted") {
                toast.error("You blocked notifications. Enable them in your browser settings.");
                setIsSubscribing(false);
                return;
            }

            // Register or get the service worker
            const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });

            // Wait for it to be active
            await navigator.serviceWorker.ready;

            // Unsubscribe from any old subscriptions first to avoid errors
            const oldSub = await registration.pushManager.getSubscription();
            if (oldSub) {
                await oldSub.unsubscribe();
            }

            // Create a new subscription
            const newSubscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY),
            });

            setSubscription(newSubscription);
            toast.success("Successfully enabled push notifications!");

            // Ideally here we would send `newSubscription` to our Supabase backend
            console.log("Push Subscription Object:", newSubscription);

        } catch (error: any) {
            console.error("Failed to subscribe:", error);
            toast.error("Failed to enable push notifications: " + (error.message || "Unknown error"));
        } finally {
            setIsSubscribing(false);
        }
    };

    const unsubscribe = async () => {
        if (!subscription) return;
        try {
            await subscription.unsubscribe();
            setSubscription(null);
            toast.success("Push notifications disabled.");
        } catch (error) {
            console.error("Failed to unsubscribe", error);
            toast.error("Failed to disable notifications.");
        }
    };

    // For testing purposes: trigger a local push notification directly via the Service Worker
    const triggerLocalTestNotification = async () => {
        if (permission === 'granted' && 'serviceWorker' in navigator) {
            const registration = await navigator.serviceWorker.ready;
            registration.showNotification("Test Success! 🎉", {
                body: "Your device is now receiving background anime updates.",
                icon: "/logo.png",
                vibrate: [200, 100, 200, 100, 200, 100, 200]
            });
        } else {
            toast.error("Enable notifications first to run a test.");
        }
    }

    return {
        isSupported,
        permission,
        subscription,
        isSubscribed: !!subscription,
        isSubscribing,
        subscribe,
        unsubscribe,
        triggerLocalTestNotification
    };
}
