'use strict';

var staticCacheName = 'restaurant-cache';
var contentImgsCache = 'restaurant-content-imgs';
var allCaches = [
  staticCacheName,
  contentImgsCache,
];


/* Cache all url in the storage cache so that any page
 * that has been visited is accessible offline
 * staticCacheName is the variable storing the cache name
*/
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(staticCacheName).then(function(cache) {
      return cache.addAll([
        '/',
        'js/main_bundle.js',
        'js/restaurant_bundle.js',
        'css/styles.css',
        'https://fonts.gstatic.com/s/roboto/v18/KFOmCnqEu92Fr1Mu4mxKKTU1Kg.woff2',
        'https://fonts.googleapis.com/css?family=Roboto'
      ]);
    })
  );
});

/* Remove the old cache */
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.filter(function(cacheName) {
          return cacheName.startsWith('restaurant-') &&
                 !allCaches.includes(cacheName);
        })
          .map(function(cacheName) {
            return caches.delete(cacheName);
          })
      );
    })
  );
});

/* If a request doesn't match anything in the cache, get it from the network,
send it to the page and add it to the cache at the same time.*/
self.addEventListener('fetch', function(event) {
  var requestUrl = new URL(event.request.url);

  // Don't use service worker caches for IndexDB based data.
  if (requestUrl.pathname.startsWith('/restaurants/') ||
      requestUrl.pathname.startsWith('/reviews/')) {
    return;
  }

  if (requestUrl.pathname.startsWith('/img/')) {
    event.respondWith(servePhoto(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request).then(response => {
      if (response) {
        return response;
      }
      return fetch(event.request).then(networkResponse => {
        return caches.open(staticCacheName).then(cache => {
          if (response) return response;
          cache.put(event.request.url, networkResponse.clone());
          return networkResponse;
        });
      });
    }).catch(error => {
      console.log('Error', error);
      return;
    })
  );
});


self.addEventListener('message', (event) => {
  console.log('event', event);
  if (event.data.action == 'skipWaiting') {
    self.skipWaiting();
  }
});

function servePhoto(request) {
  return caches.open(contentImgsCache).then(function(cache) {
    return cache.match(request).then(function(response) {
      if (response) return response;

      return fetch(request).then(function(networkResponse) {
        cache.put(request, networkResponse.clone());
        return networkResponse;
      });
    });
  });
}



//# sourceMappingURL=maps/sw.js.map
