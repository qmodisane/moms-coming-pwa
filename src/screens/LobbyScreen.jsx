import { useEffect, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import socketService from '../services/socketService';
import QRCodeDisplay from '../components/QRCodeDisplay';

export default function LobbyScreen({ onStartSetup }) {
  const { 
    sessionId, 
    sessionCode, 
    playerName, 
    playerId, 
    isHost,
    players,
    updatePlayers,
    showQRCode,
    toggleQRCode
  } = useGameStore();

  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Listen for player updates
    socketService.onPlayerJoined((data) => {
      console.log('Player joined:', data);
      fetchPlayers();
    });

    socketService.onPlayerLeft((data) => {
      console.log('Player left:', data);
      fetchPlayers();
    });

    // Initial fetch
    fetchPlayers();
  }, [sessionId]);

  const fetchPlayers = async () => {
    try {
      const apiService = (await import('../services/apiService')).default;
      const gameState = await apiService.getGameState(sessionId);
      updatePlayers(gameState.players || []);
    } catch (error) {
      console.error('Failed to fetch players:', error);
    }
  };

  const handleStartSetup = () => {
    if (players.length < 2) {
      alert('Need at least 2 players to start!');
      return;
    }
    onStartSetup();
  };

  return (
    <div className="min-h-screen bg-asphalt p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="font-graffiti text-4xl text-hot-pink mb-2">
            Game Lobby
          </h1>
          <div className="bg-concrete rounded-lg p-4 inline-block">
            <p className="text-spray-white text-sm mb-1">Game Code</p>
            <p className="font-graffiti text-5xl text-electric-blue tracking-wider">
              {sessionCode}
            </p>
          </div>
        </div>

        {/* Share Buttons (Host Only) */}
        {isHost && (
          <div className="game-card mb-6">
            <h2 className="text-lime font-graffiti text-xl mb-3">
              Invite Players
            </h2>
            <div className="space-y-2">
              <button
                onClick={toggleQRCode}
                className="w-full bg-hot-pink text-white font-bold py-3 rounded-lg"
              >
                📱 Show QR Code
              </button>
              <p className="text-spray-white text-xs text-center opacity-75">
                Players scan to install app and join automatically!
              </p>
            </div>
          </div>
        )}

        {/* Players List */}
        <div className="game-card mb-6">
          <h2 className="text-electric-blue font-graffiti text-xl mb-4">
            Players ({players.length})
          </h2>
          <div className="space-y-2">
            {players.length === 0 ? (
              <p className="text-spray-white text-center py-8 opacity-50">
                Waiting for players to join...
              </p>
            ) : (
              players.map((player, index) => (
                <div
                  key={player.id || index}
                  className="bg-asphalt rounded-lg p-3 flex items-center justify-between"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-hot-pink to-electric-blue flex items-center justify-center text-white font-bold">
                      {player.player_name?.charAt(0).toUpperCase() || '?'}
                    </div>
                    <div>
                      <p className="text-spray-white font-bold">
                        {player.player_name || 'Unknown Player'}
                        {player.player_id === playerId && (
                          <span className="text-lime ml-2 text-sm">(You)</span>
                        )}
                      </p>
                      {player.role && (
                        <p className="text-xs text-electric-blue">
                          {player.role === 'seeker' ? '👁️ Seeker' : '🏃 Hider'}
                        </p>
                      )}
                    </div>
                  </div>
                  {/* Show host badge for first player or if they're marked as host */}
                  {(index === 0 || player.is_host) && (
                    <span className="text-gold text-sm font-bold">👑 Host</span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Game Rules */}
        <div className="game-card mb-6">
          <h3 className="text-lime font-graffiti text-lg mb-3">
            Quick Rules
          </h3>
          <ul className="text-spray-white text-sm space-y-2">
            <li>• Complete missions to earn points</li>
            <li>• Stay in bounds or get revealed</li>
            <li>• Use immunity spot when you have 50+ points</li>
            <li>• Last 10 min: messaging unlocks</li>
            <li>• Hiders survive, Seeker catches all</li>
          </ul>
        </div>

        {/* Ready Check (Non-Host) */}
        {!isHost && (
          <div className="game-card mb-6">
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={ready}
                onChange={(e) => setReady(e.target.checked)}
                className="w-6 h-6 rounded border-2 border-electric-blue"
              />
              <span className="text-spray-white font-bold">
                I'm ready to play!
              </span>
            </label>
          </div>
        )}

        {/* Start Button (Host Only) */}
        {isHost && (
          <button
            onClick={handleStartSetup}
            disabled={players.length < 2}
            className="btn-primary w-full text-2xl py-6 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {players.length < 2 
              ? 'Waiting for players...' 
              : '🚀 Setup Game'}
          </button>
        )}

        {/* Waiting Message (Non-Host) */}
        {!isHost && (
          <div className="text-center py-8">
            <div className="loading-spray text-6xl mb-4">🎨</div>
            <p className="text-spray-white text-lg">
              Waiting for host to start setup...
            </p>
          </div>
        )}
      </div>

      {/* QR Code Modal */}
      {showQRCode && (
        <QRCodeDisplay
          sessionCode={sessionCode}
          onClose={toggleQRCode}
        />
      )}
    </div>
  );
}
