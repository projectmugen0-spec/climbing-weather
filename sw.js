// Service Worker - クライミング天気アプリ自動更新対応版
// バージョン：v2（2026-04-09）

const CACHE_VERSION = 'climbing-weather-v2';
const CACHE_NAME = CACHE_VERSION;

// キャッシュするファイル一覧
const FILES_TO_CACHE = [
  './',
  './index.html',
  './manifest.json'
];

// ============================================
// インストール：新しいバージョンをダウンロード
// ============================================
self.addEventListener('install', event => {
  console.log('[SW] インストール開始:', CACHE_NAME);
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] ファイルをキャッシュに追加');
        return cache.addAll(FILES_TO_CACHE)
          .catch(err => {
            console.warn('[SW] キャッシュ追加失敗（ネット接続確認）:', err);
          });
      })
  );
  
  // 新しいバージョンを待たずにすぐに有効化
  self.skipWaiting();
});

// ============================================
// アクティベート：古いキャッシュを削除
// ============================================
self.addEventListener('activate', event => {
  console.log('[SW] アクティベート開始');
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      console.log('[SW] キャッシュ一覧:', cacheNames);
      
      // 古いバージョンのキャッシュを削除
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] 古いキャッシュを削除:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  
  // 古いクライアントを即座に新しいバージョンに更新
  self.clients.claim();
});

// ============================================
// フェッチ：キャッシュ戦略の実装
// ============================================
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  
  // ============================================
  // 戦略1：API呼び出し（常に最新データ）
  // ============================================
  if (url.pathname.includes('/api') || 
      url.hostname.includes('api.open-meteo.com')) {
    // ネットワークファースト
    event.respondWith(
      fetch(request)
        .then(response => {
          // 成功時はキャッシュに保存（オフライン用）
          if (response.ok) {
            const cache = caches.open(CACHE_NAME);
            cache.then(c => c.put(request, response.clone()));
          }
          return response;
        })
        .catch(err => {
          // ネット失敗時はキャッシュから取得
          console.warn('[SW] API失敗。キャッシュから取得:', request.url);
          return caches.match(request)
            .then(response => response || new Response('オフライン'));
        })
    );
  }
  
  // ============================================
  // 戦略2：HTML・CSS・JS（キャッシュ優先）
  // ============================================
  else if (request.method === 'GET' && 
           (url.pathname.endsWith('.html') ||
            url.pathname.endsWith('.js') ||
            url.pathname.endsWith('.css') ||
            url.pathname.endsWith('.json') ||
            url.pathname.endsWith('.png') ||
            url.pathname.endsWith('.svg') ||
            url.pathname === '/')) {
    
    event.respondWith(
      caches.match(request)
        .then(response => {
          // キャッシュにあれば返す
          if (response) {
            console.log('[SW] キャッシュから取得:', request.url);
            return response;
          }
          
          // キャッシュなければ、ネットワークから取得してキャッシュに保存
          return fetch(request)
            .then(response => {
              if (response.ok) {
                const cache = caches.open(CACHE_NAME);
                cache.then(c => {
                  c.put(request, response.clone());
                  console.log('[SW] キャッシュに保存:', request.url);
                });
              }
              return response;
            })
            .catch(err => {
              console.warn('[SW] ネットワーク失敗:', request.url);
              // オフライン時は古いキャッシュがあれば返す
              return caches.match(request)
                .then(cachedResponse => {
                  if (cachedResponse) {
                    console.log('[SW] 古いキャッシュから取得:', request.url);
                    return cachedResponse;
                  }
                  return new Response('オフライン');
                });
            });
        })
    );
  }
  
  // ============================================
  // その他（デフォルト動作）
  // ============================================
  else {
    event.respondWith(fetch(request));
  }
});

// ============================================
// メッセージング：更新通知対応
// ============================================
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW] 更新をスキップして新バージョンを有効化');
    self.skipWaiting();
  }
});

console.log('[SW] Service Worker読み込み完了');
