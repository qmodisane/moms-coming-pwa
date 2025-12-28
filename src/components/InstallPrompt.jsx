import { useState, useEffect } from 'react';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // Check if iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(iOS);

    // Listen for install prompt (Android/Desktop)
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // For iOS, show instructions after 3 seconds
    if (iOS && !isInstalled) {
      setTimeout(() => setShowPrompt(true), 3000);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setShowPrompt(false);
    }

    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa-install-dismissed', Date.now());
  };

  // Don't show if already installed
  if (isInstalled) return null;

  // Don't show if dismissed recently (within 7 days)
  const dismissed = localStorage.getItem('pwa-install-dismissed');
  if (dismissed && Date.now() - parseInt(dismissed) < 7 * 24 * 60 * 60 * 1000) {
    return null;
  }

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:w-96">
      <div className="game-card relative">
        <button
          onClick={handleDismiss}
          className="absolute top-2 right-2 text-spray-white hover:text-hot-pink text-xl"
        >
          ✕
        </button>

        <div className="flex items-center gap-3 mb-3">
          <span className="text-4xl">📱</span>
          <div>
            <h3 className="text-electric-blue font-graffiti text-lg">
              Install App
            </h3>
            <p className="text-spray-white text-xs">
              Better experience + Offline mode
            </p>
          </div>
        </div>

        {isIOS ? (
          // iOS Instructions
          <div className="space-y-2 text-sm text-spray-white">
            <p className="font-bold text-lime">For iPhone/iPad:</p>
            <ol className="list-decimal list-inside space-y-1 text-xs">
              <li>Tap the Share button <span className="inline-block">⎋</span></li>
              <li>Scroll down and tap "Add to Home Screen"</li>
              <li>Tap "Add" to confirm</li>
            </ol>
          </div>
        ) : (
          // Android/Desktop Button
          <button
            onClick={handleInstallClick}
            className="btn-primary w-full text-sm"
          >
            📥 Install Now
          </button>
        )}

        <button
          onClick={handleDismiss}
          className="w-full mt-2 text-spray-white text-xs opacity-75 hover:opacity-100"
        >
          Maybe later
        </button>
      </div>
    </div>
  );
}