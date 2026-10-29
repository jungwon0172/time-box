// 타임박스 서비스워커 — 오프라인에서도 열리도록 같은 도메인의 페이지/아이콘만 캐시합니다.
// 광고·폰트 등 외부 도메인 요청은 건드리지 않습니다. 기록 데이터는 localStorage에 있어 캐시와 무관합니다.
const VERSION = 'timebox-v1';
const PRECACHE = [
  '/', '/index.html', '/track.html', '/calendar.html', '/compare.html',
  '/about.html', '/privacy.html',
  '/manifest.webmanifest', '/favicon.svg', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // 외부(광고/폰트)는 통과

  // 페이지 이동: 네트워크 우선(항상 최신), 실패하면 캐시
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(VERSION).then(c => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req).then(r => r || caches.match('/track.html') || caches.match('/index.html')))
    );
    return;
  }

  // 정적 파일: 캐시 우선 + 백그라운드 갱신
  e.respondWith(
    caches.match(req).then(cached => {
      const net = fetch(req).then(res => {
        if (res && res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
        return res;
      }).catch(() => cached);
      return cached || net;
    })
  );
});
