import { useEffect, useState } from 'react';
import qrCodeService from '../services/qrCodeService';

export default function QRCodeDisplay({ sessionCode, onClose }) {
  const [qrData, setQrData] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    generateQR();
  }, [sessionCode]);

  const generateQR = async () => {
    try {
      const data = await qrCodeService.generateGameJoinQR(sessionCode);
      setQrData(data);
    } catch (error) {
      console.error('QR generation failed:', error);
    }
  };

  const handleShare = async () => {
    const result = await qrCodeService.shareGame(sessionCode);
    if (result === 'copied') {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    if (qrData) {
      qrCodeService.downloadQR(qrData.dataUrl, `game-${sessionCode}.png`);
    }
  };

  const copyCode = async () => {
    await navigator.clipboard.writeText(sessionCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4">
      <div className="bg-concrete rounded-2xl p-6 max-w-md w-full">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-graffiti text-hot-pink">
            Game QR Code
          </h2>
          <button
            onClick={onClose}
            className="text-spray-white hover:text-hot-pink text-3xl"
          >
            ×
          </button>
        </div>

        {qrData ? (
          <>
            <div className="qr-container mb-6">
              <img 
                src={qrData.dataUrl} 
                alt="Game Join QR Code" 
                className="w-full h-auto"
              />
            </div>

            <div className="bg-asphalt p-4 rounded-lg mb-4">
              <p className="text-spray-white text-sm mb-2 text-center">
                Game Code
              </p>
              <div className="flex items-center justify-between">
                <span className="text-electric-blue font-graffiti text-3xl">
                  {sessionCode}
                </span>
                <button
                  onClick={copyCode}
                  className="bg-lime text-asphalt px-4 py-2 rounded-lg font-bold text-sm"
                >
                  {copied ? '✓ Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleShare}
                className="w-full bg-electric-blue text-asphalt font-graffiti text-lg py-3 rounded-lg"
              >
                📱 Share Link
              </button>

              <button
                onClick={handleDownload}
                className="w-full bg-hot-pink text-white font-graffiti text-lg py-3 rounded-lg"
              >
                💾 Download QR
              </button>
            </div>

            <p className="text-spray-white text-xs text-center mt-4 opacity-75">
              Players scan this QR code to install the app and join your game automatically!
            </p>
          </>
        ) : (
          <div className="text-center py-8">
            <div className="loading-spray text-electric-blue text-4xl mb-4">
              🎨
            </div>
            <p className="text-spray-white">Generating QR code...</p>
          </div>
        )}
      </div>
    </div>
  );
}
