import { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { useGameStore } from '../store/gameStore';

export default function QRScanner({ onScanSuccess, onClose }) {
  const scannerRef = useRef(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      'qr-reader',
      { 
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0
      },
      false
    );

    scanner.render(
      (decodedText) => {
        // Success - stop scanner and process result
        scanner.clear();
        handleScanResult(decodedText);
      },
      (error) => {
        // Ignore errors during scanning (too noisy)
        console.debug('QR scan error:', error);
      }
    );

    scannerRef.current = scanner;

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error);
      }
    };
  }, []);

  const handleScanResult = (decodedText) => {
    try {
      // Check if it's a join URL
      const url = new URL(decodedText);
      const joinCode = url.searchParams.get('join');
      
      if (joinCode) {
        onScanSuccess(joinCode);
      } else {
        setError('Invalid QR code. Scan a game join code.');
      }
    } catch (e) {
      // Not a valid URL, might be just the code
      if (/^\d{6}$/.test(decodedText)) {
        onScanSuccess(decodedText);
      } else {
        setError('Invalid QR code format');
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4">
      <div className="bg-concrete rounded-2xl p-6 max-w-md w-full">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-graffiti text-electric-blue">
            Scan QR Code
          </h2>
          <button
            onClick={onClose}
            className="text-spray-white hover:text-hot-pink text-3xl"
          >
            ×
          </button>
        </div>

        <div className="bg-white rounded-lg p-4 mb-4">
          <div id="qr-reader" className="w-full"></div>
        </div>

        {error && (
          <div className="bg-danger text-white p-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        <p className="text-spray-white text-center text-sm">
          Point your camera at a Mom's Coming QR code
        </p>
      </div>
    </div>
  );
}
