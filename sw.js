const CACHE_NAME = 'climbing-weather-v1';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
];

// インストール：静的ファイルをキャッシュ
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// アクティベート：古いキャッシュを削除
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys
          .filter(function(key) { return key !== CACHE_NAME; })
          .map(function(key) { return caches.delete(key); })
      );
    })
  );
  self.clients.claim();
});

// フェッチ：Open-Meteo APIはネットワーク優先、それ以外はキャッシュ優先
self.addEventListener('fetch', function(event) {
  var url = event.request.url;

  // Open-Meteo API → ネットワーク優先（失敗してもキャッシュは使わない）
  if (url.includes('api.open-meteo.com')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // 静的アセット → キャッシュ優先、なければネットワーク
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      if (cached) return cached;
      return fetch(event.request).then(function(response) {
        // 正常なレスポンスのみキャッシュに追加
        if (response && response.status === 200 && response.type === 'basic') {
          var toCache = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, toCache);
          });
        }
        return response;
      });
    })
  );
});
