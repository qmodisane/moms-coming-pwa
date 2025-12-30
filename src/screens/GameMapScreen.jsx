import { useEffect, useState, useRef } from 'react';
import Map, { Marker, Source, Layer } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useGameStore } from '../store/gameStore';
import socketService from '../services/socketService';
import geolocationService from '../services/geolocationService';

export default function GameMapScreen({ onGameEnd }) {
  const mapRef = useRef(null);
  const {
    sessionId,
    playerId,
    playerRole,
    playerPoints,
    playerViolations,
    playerLocation,
    players,
    boundary,
    immunitySpot,
    updatePlayerLocation,
    updatePlayers,
    updateBoundary,
    setPlayerRole,
    updatePlayerPoints,
    setGameStatus
  } = useGameStore();

  const [viewState, setViewState] = useState({
    longitude: 28.0473,
    latitude: -26.2041,
    zoom: 18
  });
  
  const [locationError, setLocationError] = useState(null);
  const [showBoundary, setShowBoundary] = useState(false);
  const [missions, setMissions] = useState([]);
  const [showMissions, setShowMissions] = useState(false);
  const [showMessaging, setShowMessaging] = useState(false);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [followMode, setFollowMode] = useState(true);
  const [gameTime, setGameTime] = useState(0);
  const [canMessage, setCanMessage] = useState(false);
  const [messagesRemaining, setMessagesRemaining] = useState(3);
  const [shrinkCountdown, setShrinkCountdown] = useState(600); // 10 min
  const [isCaught, setIsCaught] = useState(false);

  useEffect(() => {
    startLocationTracking();
    loadPlayerRole();
    loadMissions();

    // Game timer
    const timerInterval = setInterval(() => {
      setGameTime(prev => {
        const newTime = prev + 1;
        
        // Check for end-game communication (last 10 minutes)
        const gameDuration = 3600; // 60 minutes
        if (newTime >= gameDuration - 600) {
          setCanMessage(true);
        }
        
        return newTime;
      });
      
      setShrinkCountdown(prev => {
        if (prev <= 1) return 600; // Reset to 10 min
        return prev - 1;
      });
    }, 1000);

    // Socket listeners
    socketService.onGameState((gameState) => {
      updatePlayers(gameState.players || []);
      if (gameState.boundary) {
        updateBoundary(gameState.boundary);
      }
    });

    socketService.onBoundaryShrinking((data) => {
      showNotification('⚠️ Boundary shrinking in 30 seconds!', 'warning');
      setShrinkCountdown(30);
    });

    socketService.onBoundaryShrunk((data) => {
      updateBoundary(data.newBoundary);
      showNotification('🎯 Boundary has shrunk!', 'info');
      setShrinkCountdown(600);
      flashBoundary();
    });

    socketService.onViolation((data) => {
      if (data.playerId === playerId) {
        showNotification('❌ Out of bounds! Location revealed for 5s!', 'danger');
      }
    });

    socketService.onMessageReceived((data) => {
      setMessages(prev => [...prev, data]);
      showNotification(`💬 ${data.fromPlayerName}: ${data.message}`, 'info');
    });

    socketService.onPlayerTagged((data) => {
      if (data.targetId === playerId) {
        setIsCaught(true);
        showNotification('😱 You were caught!', 'danger');
      }
      loadPlayerRole(); // Refresh player states
    });

    socketService.onGameEnded((data) => {
      setGameStatus('ended');
      if (onGameEnd) onGameEnd(data);
    });

    socketService.onImmunityClaimed((data) => {
      if (data.playerId === playerId) {
        showNotification('🛡️ Immunity claimed! Safe from tagging!', 'info');
      }
    });

    // Refresh missions every 30 seconds
    const missionInterval = setInterval(() => {
      loadMissions();
    }, 30000);

    return () => {
      geolocationService.stopTracking();
      clearInterval(timerInterval);
      clearInterval(missionInterval);
    };
  }, [sessionId]);

  const loadPlayerRole = async () => {
    try {
      const apiService = (await import('../services/apiService')).default;
      const gameState = await apiService.getGameState(sessionId);
      const me = gameState.players.find(p => p.player_id === playerId);
      if (me) {
        setPlayerRole(me.role);
        updatePlayerPoints(me.points || 0);
        setIsCaught(me.status === 'caught');
      }
    } catch (error) {
      console.error('Failed to load role:', error);
    }
  };

  const loadMissions = async () => {
    if (playerRole === 'seeker' || isCaught) return;
    
    try {
      const apiService = (await import('../services/apiService')).default;
      const result = await apiService.getPlayerMissions(sessionId, playerId);
      setMissions(result.missions || []);
    } catch (error) {
      console.error('Failed to load missions:', error);
    }
  };

  const completeMission = async (missionId) => {
    try {
      socketService.completeMission(missionId, {});
      showNotification('✅ Mission completed!', 'info');
      loadMissions();
      loadPlayerRole(); // Refresh points
    } catch (error) {
      showNotification('Failed to complete mission', 'danger');
    }
  };

  const startLocationTracking = () => {
    geolocationService.startTracking(
      (location) => {
        updatePlayerLocation(location);
        
        if (followMode) {
          setViewState(prev => ({
            ...prev,
            longitude: location.lng,
            latitude: location.lat
          }));
        }

        socketService.updateLocation(sessionId, playerId, location);

        if (boundary && !geolocationService.isPointInBounds(location, boundary)) {
          showNotification('⚠️ You are out of bounds!', 'warning');
        }
      },
      (error) => {
        setLocationError(error);
        showNotification(error, 'danger');
      }
    );
  };

  const showNotification = (message, type) => {
    const notification = document.createElement('div');
    notification.className = `fixed top-20 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded-lg font-bold text-white z-50 text-sm shadow-lg ${
      type === 'danger' ? 'bg-danger' :
      type === 'warning' ? 'bg-gold text-asphalt' :
      'bg-electric-blue text-asphalt'
    }`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
    }, 3000);
  };

  const flashBoundary = () => {
    setShowBoundary(true);
    setTimeout(() => setShowBoundary(false), 3000);
  };

  const handleTagPlayer = async (targetPlayerId) => {
    if (playerRole !== 'seeker') return;
    
    const target = players.find(p => p.player_id === targetPlayerId);
    if (!target?.last_location || !playerLocation) return;
    
    const distance = geolocationService.calculateDistance(playerLocation, target.last_location);
    
    if (distance > 30) {
      showNotification(`Too far! ${Math.round(distance)}m (need <30m)`, 'warning');
      return;
    }
    
    socketService.tagPlayer(sessionId, targetPlayerId);
    showNotification('🎯 Player tagged!', 'info');
  };

  const sendMessage = () => {
    if (!canMessage || messagesRemaining === 0 || !message.trim()) return;
    
    socketService.sendMessage(sessionId, null, message, true);
    setMessage('');
    setMessagesRemaining(prev => prev - 1);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const boundaryGeoJSON = boundary?.coordinates ? {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [[
        ...boundary.coordinates.map(coord => [coord.lng, coord.lat]),
        [boundary.coordinates[0].lng, boundary.coordinates[0].lat]
      ]]
    }
  } : null;

  return (
    <div className="fixed inset-0 bg-asphalt">
      {/* Map */}
      <Map
        ref={mapRef}
        {...viewState}
        onMove={evt => {
          setViewState(evt.viewState);
          setFollowMode(false);
        }}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        mapboxAccessToken={import.meta.env.VITE_MAPBOX_TOKEN}
        style={{ width: '100%', height: '100%' }}
      >
        {/* Boundary */}
        {boundaryGeoJSON && showBoundary && (
          <Source id="boundary-source" type="geojson" data={boundaryGeoJSON}>
            <Layer
              id="boundary-fill"
              type="fill"
              paint={{ 'fill-color': shrinkCountdown <= 30 ? '#FF0000' : '#00F5FF', 'fill-opacity': 0.15 }}
            />
            <Layer
              id="boundary-line"
              type="line"
              paint={{ 
                'line-color': shrinkCountdown <= 30 ? '#FF0000' : '#00F5FF', 
                'line-width': 3,
                'line-opacity': 0.8
              }}
            />
          </Source>
        )}

        {/* Players */}
        {players.map((player) => {
          if (!player.last_location) return null;
          
          const isMe = player.player_id === playerId;
          const isSeeker = player.role === 'seeker';
          const isCaughtPlayer = player.status === 'caught';
          
          // Visibility rules
          const shouldShow = 
            isMe ||
            playerRole === 'seeker' ||
            isSeeker ||
            (player.violations || 0) > 0;

          if (!shouldShow) return null;

          return (
            <Marker
              key={player.id}
              longitude={player.last_location.lng}
              latitude={player.last_location.lat}
              anchor="center"
              onClick={() => playerRole === 'seeker' && !isMe && !isCaughtPlayer && handleTagPlayer(player.player_id)}
            >
              <div className="relative">
                <div
                  style={{
                    width: isMe ? '20px' : '14px',
                    height: isMe ? '20px' : '14px',
                    backgroundColor: isCaughtPlayer ? '#888' : (isSeeker ? '#FF3838' : isMe ? '#00F5FF' : '#CCFF00'),
                    borderRadius: '50%',
                    border: '2px solid white',
                    boxShadow: '0 0 10px rgba(0,0,0,0.5)',
                    cursor: playerRole === 'seeker' && !isMe && !isCaughtPlayer ? 'pointer' : 'default',
                    opacity: isCaughtPlayer ? 0.5 : 1
                  }}
                />
                {isMe && (
                  <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-2xl">
                    {isCaught ? '😵' : (playerRole === 'seeker' ? '👁️' : '🏃')}
                  </div>
                )}
                {!isMe && (playerRole === 'seeker' || isSeeker) && (
                  <div className="absolute top-4 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
                    <span className="text-xs bg-black bg-opacity-75 text-white px-1 rounded">
                      {player.player_name} {isCaughtPlayer && '💀'}
                    </span>
                  </div>
                )}
              </div>
            </Marker>
          );
        })}

        {/* Immunity Spot */}
        {immunitySpot && (
          <Marker
            longitude={immunitySpot.location.lng}
            latitude={immunitySpot.location.lat}
            anchor="center"
          >
            <div className="text-3xl animate-pulse" style={{ filter: 'drop-shadow(0 0 10px gold)' }}>
              🛡️
            </div>
          </Marker>
        )}
      </Map>

      {/* Caught Overlay */}
      {isCaught && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-20 pointer-events-none">
          <div className="bg-danger p-6 rounded-lg text-center">
            <div className="text-6xl mb-4">😵</div>
            <h2 className="text-white font-graffiti text-3xl mb-2">CAUGHT!</h2>
            <p className="text-white text-sm">You can still watch the game</p>
          </div>
        </div>
      )}

      {/* Top HUD */}
      <div className="absolute top-2 left-2 right-2 z-10">
        <div className="bg-concrete bg-opacity-95 rounded-lg p-2 shadow-lg">
          <div className="flex justify-between items-center text-xs">
            <div className="flex items-center gap-2">
              <div>
                <div className="text-spray-white opacity-75">Role</div>
                <div className={`font-graffiti text-base ${playerRole === 'seeker' ? 'text-danger' : 'text-lime'}`}>
                  {playerRole === 'seeker' ? '👁️ SEEKER' : '🏃 HIDER'}
                </div>
              </div>
              <div>
                <div className="text-spray-white opacity-75">Points</div>
                <div className="font-graffiti text-lime text-lg">{playerPoints}</div>
              </div>
              <div>
                <div className="text-spray-white opacity-75">Time</div>
                <div className="font-graffiti text-electric-blue text-base">{formatTime(gameTime)}</div>
              </div>
            </div>
            <button
              onClick={() => setShowBoundary(!showBoundary)}
              className="bg-asphalt text-electric-blue px-2 py-1 rounded text-xs font-bold"
            >
              {showBoundary ? 'Hide' : 'Show'}
            </button>
          </div>
          
          {/* Shrink Warning */}
          {shrinkCountdown <= 60 && (
            <div className="mt-2 bg-gold text-asphalt px-2 py-1 rounded text-xs font-bold text-center">
              ⚠️ Boundary shrinking in {formatTime(shrinkCountdown)}
            </div>
          )}
        </div>
      </div>

      {/* Missions Button */}
      {playerRole === 'hider' && !isCaught && (
        <button
          onClick={() => setShowMissions(!showMissions)}
          className="absolute top-16 right-2 z-10 bg-hot-pink text-white px-3 py-2 rounded-lg font-bold text-sm shadow-lg"
        >
          🎯 {missions.length}
        </button>
      )}

      {/* Missions Panel */}
      {showMissions && (
        <div className="absolute top-28 left-2 right-2 z-10 bg-concrete bg-opacity-95 rounded-lg p-3 shadow-lg max-h-48 overflow-y-auto">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-hot-pink font-graffiti text-lg">Missions</h3>
            <button onClick={() => setShowMissions(false)} className="text-spray-white">✕</button>
          </div>
          {missions.length === 0 ? (
            <p className="text-spray-white text-sm opacity-75 text-center py-4">
              No missions yet. Next spawn in {formatTime(300 - (gameTime % 300))}
            </p>
          ) : (
            missions.map(mission => (
              <div key={mission.id} className="bg-asphalt rounded p-2 mb-2">
                <p className="text-spray-white text-xs mb-1">{mission.description}</p>
                <div className="flex justify-between items-center">
                  <span className="text-lime text-xs font-bold">+{mission.point_value}pts</span>
                  <button 
                    onClick={() => completeMission(mission.id)}
                    className="bg-lime text-asphalt px-2 py-1 rounded text-xs font-bold"
                  >
                    Complete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Bottom Controls */}
      <div className="absolute bottom-2 left-2 right-2 z-10">
        <div className="flex gap-2 mb-2">
          <button
            onClick={() => {
              if (playerLocation) {
                setViewState(prev => ({ ...prev, longitude: playerLocation.lng, latitude: playerLocation.lat, zoom: 18 }));
                setFollowMode(true);
              }
            }}
            className={`w-12 h-12 rounded-full shadow-lg flex items-center justify-center text-xl ${
              followMode ? 'bg-hot-pink text-white' : 'bg-concrete text-electric-blue'
            }`}
          >
            🎯
          </button>

          {playerRole === 'hider' && !isCaught && playerPoints >= 50 && immunitySpot && (
            <button
              onClick={() => socketService.claimImmunity(sessionId, playerId)}
              className="flex-1 bg-gold text-asphalt font-graffiti py-3 rounded-lg shadow-lg text-sm"
            >
              🛡️ Immunity
            </button>
          )}

          <button
            onClick={() => setShowMessaging(!showMessaging)}
            className="w-12 h-12 bg-electric-blue text-asphalt rounded-full shadow-lg flex items-center justify-center text-xl relative"
          >
            💬
            {messages.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-hot-pink text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                {messages.length}
              </span>
            )}
          </button>
        </div>

        {/* Messaging Panel */}
        {showMessaging && (
          <div className="bg-concrete bg-opacity-95 rounded-lg p-3 shadow-lg">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-electric-blue font-graffiti">Messages</h3>
              <span className="text-spray-white text-xs">
                {canMessage ? `${messagesRemaining} left` : `🔒 ${formatTime(Math.max(0, 3600 - 600 - gameTime))}`}
              </span>
            </div>
            
            <div className="max-h-32 overflow-y-auto mb-2">
              {messages.slice(-5).map((msg, i) => (
                <div key={i} className="bg-asphalt rounded p-2 mb-1 text-xs">
                  <span className="text-lime font-bold">{msg.fromPlayerName}:</span>
                  <span className="text-spray-white ml-1">{msg.message}</span>
                </div>
              ))}
              {messages.length === 0 && (
                <p className="text-spray-white text-xs opacity-75 text-center py-2">
                  No messages yet
                </p>
              )}
            </div>
            
            <div className="flex gap-2">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                placeholder={canMessage ? "Type message..." : "Locked"}
                className="flex-1 bg-asphalt text-spray-white px-2 py-2 rounded text-sm"
                disabled={!canMessage}
                maxLength={50}
              />
              <button
                onClick={sendMessage}
                disabled={!canMessage || messagesRemaining === 0 || !message.trim()}
                className="bg-electric-blue text-asphalt px-3 py-2 rounded font-bold text-sm disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}