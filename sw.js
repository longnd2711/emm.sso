const CACHE_NAME = 'hememm-internal-app';

// Danh sách các file cần lưu offline
const urlsToCache = [
  '/',
  '/index.html',
  '/images/logo.svg',
];

// Bước cài đặt: Lưu các file vào Cache
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

// Bước Fetch: Lấy dữ liệu từ Cache khi không có mạng
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Trả về file từ cache nếu có, ngược lại thì tải từ Internet
        return response || fetch(event.request);
      })
  );
});