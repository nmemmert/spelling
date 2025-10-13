// Service Worker for Spelling Practice App
const CACHE_NAME = 'spelling-practice-v3.0.0';
const STATIC_CACHE_URLS = [
  '/',
  '/index.html',
  '/styles.css',
  '/tablet.css',
  '/tablet-menu.css',
  '/gamification.css',
  '/analytics.css',
  '/badges.css',
  '/spaced-repetition.css',
  '/js/main.js',
  '/js/game.js',
  '/js/admin.js',
  '/js/analytics.js',
  '/js/auth.js',
  '/js/gamification.js',
  '/js/spaced-repetition.js',
  '/js/ui.js',
  '/js/init.js',
  '/js/handwriting.js',
  '/js/tablet-menu.js',
  '/favicon.ico'
];

const API_CACHE_URLS = [
  '/getUsers',
  '/getWordlists',
  '/getResults',
  '/getProgress',
  '/getChallenges',
  '/getLeaderboards'
];

// Install event - cache static resources
self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker: Installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('📦 Service Worker: Caching static files');
        return cache.addAll(STATIC_CACHE_URLS);
      })
      .then(() => {
        console.log('✅ Service Worker: Installation complete');
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('🚀 Service Worker: Activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('🗑️ Service Worker: Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('✅ Service Worker: Activation complete');
        return self.clients.claim();
      })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Handle API requests with network-first strategy
  if (API_CACHE_URLS.some(apiUrl => url.pathname.includes(apiUrl))) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Clone response before using it
          const responseClone = response.clone();
          
          // Cache successful responses
          if (response.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          
          return response;
        })
        .catch(() => {
          // Fallback to cache if network fails
          return caches.match(request);
        })
    );
    return;
  }
  
  // Handle static resources with cache-first strategy
  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        
        // Fallback to network
        return fetch(request)
          .then((response) => {
            // Don't cache if not a valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // Clone response before caching
            const responseToCache = response.clone();
            
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
            
            return response;
          });
      })
  );
});

// Background sync for saving spelling results when offline
self.addEventListener('sync', (event) => {
  console.log('🔄 Service Worker: Background sync triggered');
  
  if (event.tag === 'save-spelling-results') {
    event.waitUntil(
      syncSpellingResults()
    );
  }
});

// Push notification handler
self.addEventListener('push', (event) => {

  
  const options = {
    body: event.data ? event.data.text() : 'Time for spelling practice!',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: '1'
    },
    actions: [
      {
        action: 'explore',
        title: 'Start Practice',
        icon: '/favicon.ico'
      },
      {
        action: 'close',
        title: 'Later',
        icon: '/favicon.ico'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('Spelling Practice', options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  console.log('📱 Service Worker: Notification clicked');
  
  event.notification.close();
  
  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Function to sync spelling results when back online
async function syncSpellingResults() {
  try {
    // Get pending results from IndexedDB or localStorage
    const pendingResults = JSON.parse(localStorage.getItem('pendingResults') || '[]');
    
    for (const result of pendingResults) {
      try {
        const response = await fetch('/saveResults', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(result)
        });
        
        if (response.ok) {
          console.log('✅ Synced result:', result.id);
        }
      } catch (error) {
        console.error('❌ Failed to sync result:', error);
      }
    }
    
    // Clear pending results after successful sync
    localStorage.removeItem('pendingResults');
    console.log('✅ All pending results synced');
    
  } catch (error) {
    console.error('❌ Background sync failed:', error);
  }
}