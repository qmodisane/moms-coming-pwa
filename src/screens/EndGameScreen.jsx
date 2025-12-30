import { useGameStore } from '../store/gameStore';

export default function EndGameScreen({ gameResult }) {
  const { playerRole, playerPoints, players, resetGame } = useGameStore();

  const { winner, reason, finalScores, gameStats } = gameResult || {};

  const didIWin = () => {
    if (winner === 'seeker' && playerRole === 'seeker') return true;
    if (winner === 'hiders' && playerRole === 'hider') return true;
    return false;
  };

  const sortedPlayers = [...(finalScores || players)].sort((a, b) => (b.points || 0) - (a.points || 0));

  return (
    <div className="min-h-screen bg-asphalt flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        {/* Result Banner */}
        <div className={`text-center mb-8 p-8 rounded-2xl ${
          didIWin() ? 'bg-lime' : 'bg-danger'
        }`}>
          <div className="text-8xl mb-4">
            {didIWin() ? '🎉' : '😔'}
          </div>
          <h1 className="font-graffiti text-6xl text-white mb-2">
            {didIWin() ? 'YOU WIN!' : 'GAME OVER'}
          </h1>
          <p className="text-white text-xl opacity-90">
            {reason || `${winner === 'seeker' ? 'Seeker' : 'Hiders'} won!`}
          </p>
        </div>

        {/* Game Stats */}
        {gameStats && (
          <div className="game-card mb-6">
            <h2 className="text-electric-blue font-graffiti text-2xl mb-4">
              Game Stats
            </h2>
            <div className="grid grid-cols-2 gap-4 text-spray-white">
              <div className="bg-asphalt p-3 rounded">
                <p className="text-xs opacity-75">Duration</p>
                <p className="text-xl font-graffiti text-lime">{gameStats.duration || '60:00'}</p>
              </div>
              <div className="bg-asphalt p-3 rounded">
                <p className="text-xs opacity-75">Players Caught</p>
                <p className="text-xl font-graffiti text-hot-pink">{gameStats.caught || 0}</p>
              </div>
              <div className="bg-asphalt p-3 rounded">
                <p className="text-xs opacity-75">Missions Completed</p>
                <p className="text-xl font-graffiti text-electric-blue">{gameStats.missions || 0}</p>
              </div>
              <div className="bg-asphalt p-3 rounded">
                <p className="text-xs opacity-75">Boundary Shrinks</p>
                <p className="text-xl font-graffiti text-gold">{gameStats.shrinks || 0}</p>
              </div>
            </div>
          </div>
        )}

        {/* Leaderboard */}
        <div className="game-card mb-6">
          <h2 className="text-lime font-graffiti text-2xl mb-4">
            🏆 Final Scores
          </h2>
          <div className="space-y-2">
            {sortedPlayers.map((player, index) => (
              <div
                key={player.id || index}
                className={`flex items-center justify-between p-3 rounded-lg ${
                  index === 0 ? 'bg-gold text-asphalt' :
                  index === 1 ? 'bg-electric-blue text-asphalt' :
                  index === 2 ? 'bg-hot-pink text-white' :
                  'bg-asphalt text-spray-white'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <span className="font-graffiti text-2xl w-8">
                    {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`}
                  </span>
                  <div>
                    <p className="font-bold">
                      {player.player_name || player.name}
                    </p>
                    <p className="text-xs opacity-75">
                      {player.role === 'seeker' ? '👁️ Seeker' : '🏃 Hider'}
                      {player.status === 'caught' && ' • 💀 Caught'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-graffiti text-2xl">{player.points || 0}</p>
                  <p className="text-xs opacity-75">points</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-4">
          <button
            onClick={() => {
              resetGame();
              window.location.href = '/';
            }}
            className="flex-1 btn-primary text-xl py-4"
          >
            🏠 Back to Home
          </button>
          <button
            onClick={() => {
              resetGame();
              window.location.reload();
            }}
            className="flex-1 btn-secondary text-xl py-4"
          >
            🔄 Play Again
          </button>
        </div>

        {/* Share Results */}
        <div className="text-center mt-6">
          <p className="text-spray-white text-sm opacity-75 mb-2">
            Share your results:
          </p>
          <button
            onClick={() => {
              const text = `I just played Mom's Coming! ${didIWin() ? '🎉 I WON!' : 'Better luck next time!'} Score: ${playerPoints} points`;
              if (navigator.share) {
                navigator.share({ text });
              } else {
                navigator.clipboard.writeText(text);
                alert('Results copied to clipboard!');
              }
            }}
            className="bg-concrete text-electric-blue px-6 py-2 rounded-lg font-bold hover:bg-electric-blue hover:text-asphalt transition"
          >
            📤 Share
          </button>
        </div>
      </div>
    </div>
  );
}