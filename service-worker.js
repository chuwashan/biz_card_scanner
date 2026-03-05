const CACHE_NAME = 'meishi-crm-v2';
const STATIC_ASSETS = ['/', '/index.html', '/app.js', '/api.js', '/style.css', '/manifest.json'];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then(c => c.addAll(STATIC_ASSETS))
    );
    self.skipWaiting(); // 待機せずすぐにアクティブ化
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
            )
        ).then(() => self.clients.claim()) // 既存タブにも即時反映
    );
});

self.addEventListener('fetch', (e) => {
    // APIリクエストはNetwork First
    if (e.request.url.includes('googleapis.com') || e.request.url.includes('generativelanguage')) {
        e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
        return;
    }

    // 静的ファイルはCache First
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
