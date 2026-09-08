/* Firebase Cloud Messaging Service Worker for CrimX & CrimsonFlame */
importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "AIzaSyBSSJKDrFJ1_qlliZqgw34CY2TSaKOxxxM",
    authDomain: "crimsonflame-8169e.firebaseapp.com",
    projectId: "crimsonflame-8169e",
    storageBucket: "crimsonflame-8169e.firebasestorage.app",
    messagingSenderId: "406321213530",
    appId: "1:406321213530:web:92d27a69d34d147393a863"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw] Received background message:', payload);
    const data = payload.data || {};
    const title = payload.notification?.title || data.title || (data.senderName ? `${data.senderName} (CIM)` : 'CrimX Instant Message');
    const options = {
        body: payload.notification?.body || data.text || data.lastMessage || 'You have received a new instant message!',
        icon: payload.notification?.icon || data.senderPfp || '/favicon.ico',
        badge: '/favicon.ico',
        tag: 'cim-message',
        data: {
            url: '/dashboard',
            senderUid: data.senderUid || data.senderId
        }
    };

    self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if (client.url.includes('/dashboard') && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow('/dashboard');
            }
        })
    );
});
