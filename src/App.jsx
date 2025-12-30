import { useEffect, useState } from 'react';
import { useGameStore } from './store/gameStore';
import socketService from './services/socketService';
import HomeScreen from './screens/HomeScreen';
import LobbyScreen from './screens/LobbyScreen';
import SetupScreen from './screens/SetupScreen';
import GameMapScreen from './screens/GameMapScreen';
import EndGameScreen from './screens/EndGameScreen';

export default function App() {
  const { gameStatus, setSession, setGameStatus } = useGameStore();
  const [serverUrl] = useState(import.meta.env.VITE_API_URL || 'http://localhost:3000');
  const [gameResult, setGameResult] = useState(null);

  useEffect(() => {
    socketService.connect(serverUrl.replace('/api', ''));

    socketService.onGameJoined((data) => {
      console.log('Game joined successfully');
    });

    socketService.onGameStarted((data) => {
      console.log('🚀 Game started!', data);
      setGameStatus('active');
    });

    socketService.onSeekerAssigned((data) => {
      console.log('👁️ Seeker assigned:', data);
    });

    socketService.onGameEnded((data) => {
      console.log('🏁 Game ended:', data);
      setGameResult(data);
      setGameStatus('ended');
    });

    return () => {
      socketService.disconnect();
    };
  }, [serverUrl, setGameStatus]);

  const handleGameCreated = ({ sessionId, sessionCode, isHost, playerId }) => {
    setSession(sessionId, sessionCode, isHost);
    setGameStatus('lobby');

    const { playerName } = useGameStore.getState();
    socketService.joinGame(sessionId, playerId, playerName);
  };

  const handleGameJoined = ({ sessionId, sessionCode, isHost }) => {
    setSession(sessionId, sessionCode, isHost);
    setGameStatus('lobby');

    const { playerId, playerName } = useGameStore.getState();
    socketService.joinGame(sessionId, playerId, playerName);
  };

  const handleStartSetup = () => {
    setGameStatus('setup');
  };

  const handleSetupComplete = () => {
    setGameStatus('active');
  };

  const handleGameEnd = (result) => {
    setGameResult(result);
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

      {gameStatus === 'setup' && (
        <SetupScreen onSetupComplete={handleSetupComplete} />
      )}

      {gameStatus === 'active' && (
        <GameMapScreen onGameEnd={handleGameEnd} />
      )}

      {gameStatus === 'ended' && (
        <EndGameScreen gameResult={gameResult} />
      )}
    </div>
  );
}