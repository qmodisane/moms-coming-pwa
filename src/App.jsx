import { useEffect, useState } from 'react';
import { useGameStore } from './store/gameStore';
import socketService from './services/socketService';
import HomeScreen from './screens/HomeScreen';
import LobbyScreen from './screens/LobbyScreen';
import GameMapScreen from './screens/GameMapScreen';

export default function App() {
  const { gameStatus, setSession, setGameStatus } = useGameStore();
  const [serverUrl] = useState(import.meta.env.VITE_API_URL || 'http://localhost:3000');

  useEffect(() => {
    // Connect to server on app load
    socketService.connect(serverUrl.replace('/api', ''));

    // Listen for game started event
    socketService.onGameJoined((data) => {
      console.log('Game joined successfully');
    });

    // Cleanup on unmount
    return () => {
      socketService.disconnect();
    };
  }, []);

  const handleGameCreated = ({ sessionId, sessionCode, isHost }) => {
    setSession(sessionId, sessionCode, isHost);
    setGameStatus('lobby');

    // Join socket room
    const { playerId, playerName } = useGameStore.getState();
    socketService.joinGame(sessionId, playerId, playerName);
  };

  const handleGameJoined = ({ sessionId, sessionCode, isHost }) => {
    setSession(sessionId, sessionCode, isHost);
    setGameStatus('lobby');

    // Join socket room
    const { playerId, playerName } = useGameStore.getState();
    socketService.joinGame(sessionId, playerId, playerName);
  };

  const handleStartSetup = () => {
    // For now, skip setup and go straight to game
    // TODO: Add boundary drawing screen
    setGameStatus('active');
  };

  return (
    <div className="app">
      {gameStatus === 'idle' && (
        <HomeScreen
          onGameCreated={handleGameCreated}
          onGameJoined={handleGameJoined}
        />
      )}

      {gameStatus === 'lobby' && (
        <LobbyScreen onStartSetup={handleStartSetup} />
      )}

      {gameStatus === 'active' && <GameMapScreen />}

      {gameStatus === 'ended' && (
        <div className="min-h-screen bg-asphalt flex items-center justify-center p-4">
          <div className="text-center">
            <h1 className="font-graffiti text-6xl text-hot-pink mb-4">
              Game Over!
            </h1>
            <button
              onClick={() => {
                useGameStore.getState().resetGame();
              }}
              className="btn-primary"
            >
              Back to Home
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
