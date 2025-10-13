/**
 * PWA Installation and Offline Support
 * Handles service worker registration, app installation prompt, and offline functionality
 */

class PWAManager {
  constructor() {
    this.deferredPrompt = null;
    this.isOnline = navigator.onLine;
    this.init();
  }

  async init() {
    // Register service worker
    await this.registerServiceWorker();
    
    // Setup install prompt
    this.setupInstallPrompt();
    
    // Setup offline detection
    this.setupOfflineDetection();
    
    // Setup background sync
    this.setupBackgroundSync();
    
    // Setup push notifications (optional)
    this.setupPushNotifications();
    
    console.log('✅ PWA Manager initialized');
  }

  async registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        console.log('✅ Service Worker registered:', registration);
        
        // Listen for updates
        registration.addEventListener('updatefound', () => {
          console.log('🔄 Service Worker update found');
          this.showUpdateNotification();
        });
        
        return registration;
      } catch (error) {
        console.error('❌ Service Worker registration failed:', error);
      }
    }
  }

  setupInstallPrompt() {
    // Listen for the beforeinstallprompt event
    window.addEventListener('beforeinstallprompt', (e) => {
      console.log('📱 PWA install prompt available');
      
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      
      // Save the event so it can be triggered later
      this.deferredPrompt = e;
      
      // Show custom install button
      this.showInstallButton();
    });

    // Listen for app installation
    window.addEventListener('appinstalled', () => {
      console.log('✅ PWA was installed');
      this.hideInstallButton();
      this.showInstallSuccessMessage();
    });
  }

  setupOfflineDetection() {
    // Listen for online/offline events
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.hideOfflineMessage();
      this.syncPendingData();
      console.log('🌐 Back online');
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.showOfflineMessage();
      console.log('📱 Gone offline');
    });

    // Show initial state
    if (!this.isOnline) {
      this.showOfflineMessage();
    }
  }

  setupBackgroundSync() {
    // Register for background sync when saving results
    if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
      console.log('✅ Background sync supported');
    }
  }

  async setupPushNotifications() {
    // Check if push notifications are supported
    if ('Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window) {
      console.log('✅ Push notifications supported');
    }
  }

  showInstallButton() {
    // Create install button if it doesn't exist
    let installBtn = document.getElementById('pwa-install-btn');
    
    if (!installBtn) {
      installBtn = document.createElement('button');
      installBtn.id = 'pwa-install-btn';
      installBtn.className = 'btn btn-primary pwa-install-btn';
      installBtn.innerHTML = '📱 Install App';
      installBtn.title = 'Install this app on your device for a better experience';
      
      // Add click handler
      installBtn.addEventListener('click', () => this.promptInstall());
      
      // Add to header or appropriate location
      const header = document.querySelector('.container h1') || document.body;
      header.parentNode.insertBefore(installBtn, header.nextSibling);
    }
    
    installBtn.style.display = 'inline-block';
  }

  hideInstallButton() {
    const installBtn = document.getElementById('pwa-install-btn');
    if (installBtn) {
      installBtn.style.display = 'none';
    }
  }

  async promptInstall() {
    if (!this.deferredPrompt) {
      console.log('❌ No install prompt available');
      return;
    }

    // Show the install prompt
    this.deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await this.deferredPrompt.userChoice;
    
    console.log(`📱 Install prompt outcome: ${outcome}`);
    
    // Clear the deferredPrompt for next time
    this.deferredPrompt = null;
    
    if (outcome === 'accepted') {
      this.hideInstallButton();
    }
  }

  showOfflineMessage() {
    // Create offline indicator
    let offlineMsg = document.getElementById('offline-indicator');
    
    if (!offlineMsg) {
      offlineMsg = document.createElement('div');
      offlineMsg.id = 'offline-indicator';
      offlineMsg.className = 'offline-indicator';
      offlineMsg.innerHTML = `
        <div class="offline-content">
          <span class="offline-icon">📱</span>
          <span class="offline-text">You're offline. Changes will sync when you reconnect.</span>
        </div>
      `;
      
      document.body.appendChild(offlineMsg);
    }
    
    offlineMsg.style.display = 'block';
  }

  hideOfflineMessage() {
    const offlineMsg = document.getElementById('offline-indicator');
    if (offlineMsg) {
      offlineMsg.style.display = 'none';
    }
  }

  showUpdateNotification() {
    // Create update notification
    const updateMsg = document.createElement('div');
    updateMsg.className = 'update-notification';
    updateMsg.innerHTML = `
      <div class="update-content">
        <span>🔄 App update available!</span>
        <button onclick="window.location.reload()" class="btn btn-sm btn-primary">Refresh</button>
        <button onclick="this.parentElement.parentElement.remove()" class="btn btn-sm btn-secondary">Later</button>
      </div>
    `;
    
    document.body.appendChild(updateMsg);
    
    // Auto-hide after 10 seconds
    setTimeout(() => {
      if (updateMsg.parentNode) {
        updateMsg.remove();
      }
    }, 10000);
  }

  showInstallSuccessMessage() {
    // Show success message
    const successMsg = document.createElement('div');
    successMsg.className = 'install-success';
    successMsg.innerHTML = `
      <div class="success-content">
        <span>✅ App installed successfully!</span>
        <span>You can now use it offline and find it in your app drawer.</span>
      </div>
    `;
    
    document.body.appendChild(successMsg);
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      if (successMsg.parentNode) {
        successMsg.remove();
      }
    }, 5000);
  }

  async syncPendingData() {
    // Sync any pending data when back online
    if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
      const registration = await navigator.serviceWorker.ready;
      await registration.sync.register('save-spelling-results');
    }
  }

  // Save results with offline support
  async saveResultsOffline(resultData) {
    if (this.isOnline) {
      // Try to save online first
      try {
        const response = await fetch('/saveResults', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(resultData)
        });
        
        if (response.ok) {
          return await response.json();
        }
      } catch (error) {
        console.warn('⚠️ Online save failed, storing offline:', error);
      }
    }
    
    // Store offline for later sync
    const pendingResults = JSON.parse(localStorage.getItem('pendingResults') || '[]');
    resultData.id = Date.now() + Math.random(); // Temporary ID
    resultData.timestamp = new Date().toISOString();
    resultData.offline = true;
    
    pendingResults.push(resultData);
    localStorage.setItem('pendingResults', JSON.stringify(pendingResults));
    
    console.log('📱 Result saved offline, will sync when online');
    
    // Try to register background sync
    if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
      const registration = await navigator.serviceWorker.ready;
      await registration.sync.register('save-spelling-results');
    }
    
    return { success: true, offline: true };
  }

  // Request notification permission
  async requestNotificationPermission() {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      console.log('📱 Notification permission:', permission);
      return permission === 'granted';
    }
    return false;
  }

  // Show local notification
  showNotification(title, options = {}) {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        body: options.body || '',
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        ...options
      });
    }
  }
}

// Initialize PWA Manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.pwaManager = new PWAManager();
});

// Expose functions globally for use in other scripts
window.PWAManager = PWAManager;