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
  const [messagesRemaining, setMessagesRemaining] = useState(999); // Unlimited
  const [shrinkCountdown, setShrinkCountdown] = useState(600);
  const [isCaught, setIsCaught] = useState(false);
  const [proximityAlert, setProximityAlert] = useState(null); // null, 'far', 'near', 'danger'
  const [showViolationAlert, setShowViolationAlert] = useState(false);

  useEffect(() => {
    startLocationTracking();
    loadPlayerRole();
    loadMissions();

    // Game timer
    const timerInterval = setInterval(() => {
      setGameTime(prev => prev + 1);
      setShrinkCountdown(prev => {
        if (prev <= 1) return 600;
        return prev - 1;
      });
    }, 1000);

    // Proximity check every 2 seconds
    const proximityInterval = setInterval(() => {
      checkProximityToSeeker();
    }, 2000);

    // Socket listeners
    socketService.onGameState((gameState) => {
      updatePlayers(gameState.players || []);
      if (gameState.boundary) {
        updateBoundary(gameState.boundary);
      }
    });

    socketService.onBoundaryShrinking((data) => {
      showNotification('⚠️ BOUNDARY SHRINKING IN 30 SECONDS!', 'danger', 5000);
      setShrinkCountdown(30);
    });

    socketService.onBoundaryShrunk((data) => {
      updateBoundary(data.newBoundary);
      showNotification('🎯 BOUNDARY HAS SHRUNK!', 'warning', 3000);
      setShrinkCountdown(600);
      flashBoundary();
    });

    socketService.onViolation((data) => {
      if (data.playerId === playerId) {
        triggerViolationAlert();
      }
    });

    socketService.onMessageReceived((data) => {
      setMessages(prev => [...prev, data]);
      showNotification(`💬 ${data.fromPlayerName}: ${data.message}`, 'info', 3000);
    });

    socketService.onPlayerTagged((data) => {
      if (data.targetId === playerId) {
        setIsCaught(true);
        showNotification('😱 YOU WERE CAUGHT!', 'danger', 5000);
      }
      loadPlayerRole();
    });

    socketService.onGameEnded((data) => {
      setGameStatus('ended');
      if (onGameEnd) onGameEnd(data);
    });

    socketService.onImmunityClaimed((data) => {
      if (data.playerId === playerId) {
        showNotification('🛡️ IMMUNITY CLAIMED! SAFE FROM TAGGING!', 'info', 3000);
      }
    });

    // Refresh missions every 30 seconds
    const missionInterval = setInterval(() => {
      loadMissions();
    }, 30000);

    return () => {
      geolocationService.stopTracking();
      clearInterval(timerInterval);
      clearInterval(proximityInterval);
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
      showNotification('✅ MISSION COMPLETED!', 'info', 3000);
      loadMissions();
      loadPlayerRole();
    } catch (error) {
      showNotification('Failed to complete mission', 'danger', 3000);
    }
  };

  const checkProximityToSeeker = () => {
    if (playerRole === 'seeker' || !playerLocation || isCaught) return;
    
    const seeker = players.find(p => p.role === 'seeker');
    if (!seeker?.last_location) return;
    
    const distance = geolocationService.calculateDistance(playerLocation, seeker.last_location);
    
    // Update proximity state
    if (distance <= 30) {
      setProximityAlert('danger');
      if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200]);
      showNotification('🚨 SEEKER VERY CLOSE! (<30m)', 'danger', 2000);
    } else if (distance <= 50) {
      setProximityAlert('near');
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    } else if (distance <= 100) {
      setProximityAlert('far');
    } else {
      setProximityAlert(null);
    }
  };

  const triggerViolationAlert = () => {
    setShowViolationAlert(true);
    if (navigator.vibrate) navigator.vibrate([500, 200, 500, 200, 500]);
    
    setTimeout(() => {
      setShowViolationAlert(false);
    }, 5000);
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
          showNotification('⚠️ YOU ARE OUT OF BOUNDS!', 'warning', 3000);
        }
      },
      (error) => {
        setLocationError(error);
        showNotification(error, 'danger', 3000);
      }
    );
  };

  const showNotification = (message, type, duration = 3000) => {
    const notification = document.createElement('div');
    notification.className = `fixed top-20 left-1/2 transform -translate-x-1/2 px-4 py-3 rounded-lg font-bold text-white z-50 text-base shadow-lg animate-bounce ${
      type === 'danger' ? 'bg-danger' :
      type === 'warning' ? 'bg-gold text-asphalt' :
      'bg-electric-blue text-asphalt'
    }`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
    }, duration);
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
      showNotification(`TOO FAR! ${Math.round(distance)}m (need <30m)`, 'warning', 3000);
      return;
    }
    
    socketService.tagPlayer(sessionId, targetPlayerId);
    showNotification('🎯 PLAYER TAGGED!', 'info', 3000);
  };

  const sendMessage = () => {
    if (!message.trim()) return;
    
    socketService.sendMessage(sessionId, null, message, true);
    setMessage('');
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
      {/* VIOLATION ALERT OVERLAY */}
      {showViolationAlert && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-danger bg-opacity-90 animate-pulse">
          <div className="text-center">
            <div className="text-9xl mb-4">⚠️</div>
            <h1 className="text-white font-graffiti text-6xl mb-4">OUT OF BOUNDS!</h1>
            <p className="text-white text-2xl">YOUR LOCATION IS REVEALED FOR 5 SECONDS!</p>
          </div>
        </div>
      )}

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
          
          // 🚨 CRITICAL VISIBILITY RULES 🚨
          const shouldShow = 
            isMe ||                              // Always show myself
            (player.violations || 0) > 0;        // Show violators to everyone
            // NOTE: Seeker is NOT shown to hiders (stealth mode)
            // Seeker can ONLY see violators, not all hiders

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
                    width: isMe ? '24px' : '18px',
                    height: isMe ? '24px' : '18px',
                    backgroundColor: isCaughtPlayer ? '#888' : (isSeeker ? '#FF3838' : isMe ? '#00F5FF' : '#CCFF00'),
                    borderRadius: '50%',
                    border: '3px solid white',
                    boxShadow: '0 0 15px rgba(0,0,0,0.8)',
                    cursor: playerRole === 'seeker' && !isMe && !isCaughtPlayer ? 'pointer' : 'default',
                    opacity: isCaughtPlayer ? 0.5 : 1
                  }}
                />
                {isMe && (
                  <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 text-3xl">
                    {isCaught ? '😵' : (playerRole === 'seeker' ? '👁️' : '🏃')}
                  </div>
                )}
                {!isMe && playerRole === 'seeker' && (
                  <div className="absolute top-5 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
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
            <div className="text-4xl animate-pulse" style={{ filter: 'drop-shadow(0 0 15px gold)' }}>
              🛡️
            </div>
          </Marker>
        )}
      </Map>

      {/* Proximity Alert Banner */}
      {proximityAlert && playerRole === 'hider' && !isCaught && (
        <div className={`absolute top-0 left-0 right-0 z-20 py-3 text-center font-bold text-white text-lg ${
          proximityAlert === 'danger' ? 'bg-danger animate-pulse' :
          proximityAlert === 'near' ? 'bg-hot-pink' :
          'bg-gold text-asphalt'
        }`}>
          {proximityAlert === 'danger' && '🚨 SEEKER VERY CLOSE! (<30m)'}
          {proximityAlert === 'near' && '⚠️ Seeker Nearby (<50m)'}
          {proximityAlert === 'far' && '👀 Seeker in Area (<100m)'}
        </div>
      )}

      {/* Top HUD - REDESIGNED */}
      <div className="absolute top-2 left-2 right-2 z-10">
        <div className="bg-concrete bg-opacity-95 rounded-lg p-2 shadow-lg">
          <div className="flex justify-between items-center text-xs">
            <div className="flex items-center gap-2">
              <div>
                <div className="text-spray-white opacity-75">Role</div>
                <div className={`font-graffiti text-sm ${playerRole === 'seeker' ? 'text-danger' : 'text-lime'}`}>
                  {playerRole === 'seeker' ? '👁️ SEEK' : '🏃 HIDE'}
                </div>
              </div>
              <div>
                <div className="text-spray-white opacity-75">Points</div>
                <div className="font-graffiti text-lime text-base">{playerPoints}</div>
              </div>
              <div>
                <div className="text-spray-white opacity-75">Time</div>
                <div className="font-graffiti text-electric-blue text-base">{formatTime(gameTime)}</div>
              </div>
            </div>
            
            {/* TOP RIGHT BUTTONS */}
            <div className="flex gap-1">
              {playerRole === 'hider' && !isCaught && (
                <button
                  onClick={() => setShowMissions(!showMissions)}
                  className="bg-hot-pink text-white px-2 py-1 rounded text-xs font-bold"
                >
                  🎯 {missions.length}
                </button>
              )}
              
              <button
                onClick={() => setShowMessaging(!showMessaging)}
                className="bg-electric-blue text-asphalt px-2 py-1 rounded text-xs font-bold relative"
              >
                💬
                {messages.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-hot-pink text-white text-xs w-4 h-4 rounded-full flex items-center justify-center">
                    {messages.length}
                  </span>
                )}
              </button>
            </div>
          </div>
          
          {/* Shrink Warning */}
          {shrinkCountdown <= 60 && (
            <div className="mt-1 bg-gold text-asphalt px-2 py-1 rounded text-xs font-bold text-center">
              ⚠️ Shrinking in {formatTime(shrinkCountdown)}
            </div>
          )}
        </div>
      </div>

      {/* Missions Panel */}
      {showMissions && (
        <div className="absolute top-20 left-2 right-2 z-10 bg-concrete bg-opacity-95 rounded-lg p-3 shadow-lg max-h-48 overflow-y-auto">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-hot-pink font-graffiti text-base">Missions</h3>
            <button onClick={() => setShowMissions(false)} className="text-spray-white text-lg">✕</button>
          </div>
          {missions.length === 0 ? (
            <p className="text-spray-white text-xs opacity-75 text-center py-4">
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

      {/* Messaging Panel */}
      {showMessaging && (
        <div className="absolute top-20 left-2 right-2 z-10 bg-concrete bg-opacity-95 rounded-lg p-3 shadow-lg">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-electric-blue font-graffiti text-base">Messages</h3>
            <button onClick={() => setShowMessaging(false)} className="text-spray-white text-lg">✕</button>
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
              placeholder="Type message..."
              className="flex-1 bg-asphalt text-spray-white px-2 py-2 rounded text-xs"
              maxLength={50}
            />
            <button
              onClick={sendMessage}
              disabled={!message.trim()}
              className="bg-electric-blue text-asphalt px-3 py-2 rounded font-bold text-xs disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </div>
      )}

      {/* Bottom Controls */}
      <div className="absolute bottom-2 left-2 right-2 z-10">
        <div className="flex gap-2">
          <button
            onClick={() => {
              if (playerLocation) {
                setViewState(prev => ({ ...prev, longitude: playerLocation.lng, latitude: playerLocation.lat, zoom: 18 }));
                setFollowMode(true);
              }
            }}
            className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-2xl ${
              followMode ? 'bg-hot-pink text-white' : 'bg-concrete text-electric-blue'
            }`}
          >
            🎯
          </button>

          {playerRole === 'hider' && !isCaught && playerPoints >= 50 && immunitySpot && (
            <button
              onClick={() => socketService.claimImmunity(sessionId, playerId)}
              className="flex-1 bg-gold text-asphalt font-graffiti py-3 rounded-lg shadow-lg text-sm font-bold"
            >
              🛡️ IMMUNITY
            </button>
          )}

          <button
            onClick={() => setShowBoundary(!showBoundary)}
            className="w-14 h-14 bg-electric-blue text-asphalt rounded-full shadow-lg flex items-center justify-center text-xl font-bold"
          >
            {showBoundary ? '👁️' : '🗺️'}
          </button>
        </div>
      </div>

      {/* Caught Overlay */}
      {isCaught && (
        <div className="absolute inset-0 bg-black bg-opacity-70 flex items-center justify-center z-20">
          <div className="bg-danger p-8 rounded-lg text-center">
            <div className="text-8xl mb-4">😵</div>
            <h2 className="text-white font-graffiti text-4xl mb-2">CAUGHT!</h2>
            <p className="text-white text-base">You can still watch the game</p>
          </div>
        </div>
      )}
    </div>
  );
}