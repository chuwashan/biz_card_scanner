const CACHE_NAME = 'meishi-crm-v1';
const STATIC_ASSETS = ['/', '/index.html', '/app.js', '/api.js', '/style.css', '/manifest.json'];

self.addEventListener('install', (e) => {
    e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(STATIC_ASSETS)));
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
