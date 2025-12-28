import { useState, useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import apiService from '../services/apiService';
import qrCodeService from '../services/qrCodeService';
import QRScanner from '../components/QRScanner';
import InstallPrompt from '../components/InstallPrompt';

export default function HomeScreen({ onGameCreated, onGameJoined }) {
  const { playerId, playerName, setPlayerName, toggleQRScanner, showQRScanner } = useGameStore();
  const [name, setName] = useState(playerName || '');
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Check if there's a join code in URL (from QR scan)
    const autoJoinCode = qrCodeService.getJoinCodeFromUrl();
    if (autoJoinCode) {
      setJoinCode(autoJoinCode);
      // Auto-scroll to join section
      setTimeout(() => {
        document.getElementById('join-section')?.scrollIntoView({ behavior: 'smooth' });
      }, 500);
    }
  }, []);

  const handleCreateGame = async () => {
  if (!name.trim()) {
    setError('Please enter your name');
    return;
  }

  setLoading(true);
  setError(null);

  try {
    setPlayerName(name);
    const result = await apiService.createGame(name);
    
    onGameCreated({
      sessionId: result.session.id,
      sessionCode: result.session.code,
      isHost: true,
      playerId: result.player.id
    });
  } catch (err) {
    setError(err.message || 'Failed to create game');
  } finally {
    setLoading(false);
  }
};

  const handleJoinGame = async () => {
    if (!name.trim()) {
      setError('Please enter your name');
      return;
    }

    if (!joinCode.trim() || joinCode.length !== 6) {
      setError('Please enter a valid 6-digit game code');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      setPlayerName(name);
      const result = await apiService.joinGame(joinCode, playerId, name);
      
      onGameJoined({
        sessionId: result.sessionId,
        sessionCode: joinCode,
        isHost: false
      });
    } catch (err) {
      setError(err.message || 'Failed to join game');
    } finally {
      setLoading(false);
    }
  };

  const handleQRScan = (scannedCode) => {
    setJoinCode(scannedCode);
    toggleQRScanner();
    // Auto-focus join button
    setTimeout(() => {
      document.getElementById('join-button')?.scrollIntoView({ behavior: 'smooth' });
    }, 300);
  };

  return (
    <div className="min-h-screen bg-asphalt flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6">
        {/* Logo/Title */}
        <div className="text-center mb-8">
          <h1 className="font-graffiti text-6xl text-hot-pink spray-paint-text mb-2 drip-effect">
            MOM'S COMING
          </h1>
          <p className="text-electric-blue font-condensed text-lg">
            Real-World GPS Hide & Seek
          </p>
        </div>

        {/* Player Name Input */}
        <div className="game-card">
          <label className="block text-spray-white mb-2 font-bold">
            Your Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your name"
            className="w-full bg-asphalt text-spray-white px-4 py-3 rounded-lg border-2 border-electric-blue focus:outline-none focus:border-hot-pink text-lg"
            maxLength={20}
          />
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-danger text-white p-4 rounded-lg font-bold text-center">
            {error}
          </div>
        )}

        {/* Create Game */}
        <div className="game-card">
          <h2 className="text-electric-blue font-graffiti text-2xl mb-4">
            Host a Game
          </h2>
          <p className="text-spray-white mb-4 text-sm">
            Create a new game and share the QR code with friends
          </p>
          <button
            onClick={handleCreateGame}
            disabled={loading}
            className="btn-primary w-full disabled:opacity-50"
          >
            {loading ? 'Creating...' : '🎮 Create Game'}
          </button>
        </div>

        {/* Join Game */}
        <div id="join-section" className="game-card">
          <h2 className="text-lime font-graffiti text-2xl mb-4">
            Join a Game
          </h2>
          
          <div className="space-y-3">
            <div>
              <label className="block text-spray-white mb-2 font-bold text-sm">
                Game Code
              </label>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="123456"
                className="w-full bg-asphalt text-spray-white px-4 py-3 rounded-lg border-2 border-lime focus:outline-none focus:border-electric-blue text-2xl text-center font-graffiti tracking-wider"
                maxLength={6}
              />
            </div>

            <button
              id="join-button"
              onClick={handleJoinGame}
              disabled={loading}
              className="btn-secondary w-full disabled:opacity-50"
            >
              {loading ? 'Joining...' : '✨ Join Game'}
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-spray-white opacity-25"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-concrete text-spray-white">or</span>
              </div>
            </div>

            <button
              onClick={toggleQRScanner}
              className="w-full bg-gold text-asphalt font-graffiti text-lg py-3 rounded-lg transform transition-all active:scale-95"
            >
              📷 Scan QR Code
            </button>
          </div>
        </div>

        {/* Info */}
        <div className="text-center text-spray-white text-xs opacity-50">
          <p>v1.0.0 • PWA Edition</p>
          <p className="mt-1">Polead</p>
        </div>
      </div>

      {/* QR Scanner Modal */}
      {showQRScanner && (
        <QRScanner
          onScanSuccess={handleQRScan}
          onClose={toggleQRScanner}
        />
      )}
{/* PWA Install Prompt */}
      <InstallPrompt />
 
    </div>
  );
}
