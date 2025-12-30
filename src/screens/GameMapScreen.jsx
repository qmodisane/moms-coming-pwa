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
    zoom: 17
  });
  
  const [mapStyle, setMapStyle] = useState('mapbox://styles/mapbox/satellite-streets-v12');
  const [showStyleSelector, setShowStyleSelector] = useState(false);
  
  const mapStyles = [
    { name: 'Satellite', value: 'mapbox://styles/mapbox/satellite-streets-v12' },
    { name: 'Streets', value: 'mapbox://styles/mapbox/streets-v12' },
    { name: 'Dark', value: 'mapbox://styles/mapbox/dark-v11' },
    { name: 'Outdoors', value: 'mapbox://styles/mapbox/outdoors-v12' },
    { name: 'Light', value: 'mapbox://styles/mapbox/light-v11' }
  ];
  
  const [locationError, setLocationError] = useState(null);
  const [showBoundary, setShowBoundary] = useState(true);
  const [missions, setMissions] = useState([]);
  const [showMissions, setShowMissions] = useState(false);
  const [showMessaging, setShowMessaging] = useState(false);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [followMode, setFollowMode] = useState(true);
  const [gameTime, setGameTime] = useState(0);
  const [messagesRemaining, setMessagesRemaining] = useState(999);
  const [shrinkCountdown, setShrinkCountdown] = useState(600);
  const [isCaught, setIsCaught] = useState(false);
  const [proximityAlert, setProximityAlert] = useState(null);
  const [showViolationAlert, setShowViolationAlert] = useState(false);
  const [boundaryFlash, setBoundaryFlash] = useState(false);
  const [revealedPlayers, setRevealedPlayers] = useState(new Set());
  
  // 🎯 TAGGING STATE
  const [showTagConfirm, setShowTagConfirm] = useState(false);
  const [targetToTag, setTargetToTag] = useState(null);
  const [closestPlayer, setClosestPlayer] = useState(null);

  useEffect(() => {
    startLocationTracking();
    loadPlayerRole();
    loadMissions();

    const timerInterval = setInterval(() => {
      setGameTime(prev => prev + 1);
      setShrinkCountdown(prev => {
        if (prev <= 1) return 600;
        return prev - 1;
      });
    }, 1000);

    const proximityInterval = setInterval(() => {
      checkProximityToSeeker();
      if (playerRole === 'seeker') {
        updateClosestPlayer();
      }
    }, 2000);

    socketService.onGameState((gameState) => {
      console.log('📊 Game state update:', gameState);
      updatePlayers(gameState.players || []);
      if (gameState.boundary) {
        updateBoundary(gameState.boundary);
      }
    });

    socketService.onBoundaryShrinking((data) => {
      console.log('⚠️ Boundary shrinking!');
      showNotification('⚠️ BOUNDARY SHRINKING IN 30 SECONDS!', 'danger', 5000);
      setShrinkCountdown(30);
      setBoundaryFlash(true);
    });

    socketService.onBoundaryShrunk((data) => {
      console.log('📍 Boundary shrunk:', data.newBoundary);
      updateBoundary(data.newBoundary);
      showNotification('🎯 BOUNDARY HAS SHRUNK!', 'warning', 5000);
      setShrinkCountdown(600);
      setBoundaryFlash(false);
      setShowBoundary(true);
    });

    socketService.onViolation((data) => {
      console.log('🚨 Violation:', data);
      
      setRevealedPlayers(prev => new Set(prev).add(data.playerId));
      setTimeout(() => {
        setRevealedPlayers(prev => {
          const newSet = new Set(prev);
          newSet.delete(data.playerId);
          return newSet;
        });
      }, 5000);
      
      if (data.playerId === playerId) {
        triggerViolationAlert();
      }
    });

    socketService.onMessageReceived((data) => {
      console.log('💬 Message received:', data);
      setMessages(prev => [...prev, data]);
      showNotification(`💬 ${data.fromPlayerName}: ${data.message}`, 'info', 3000);
    });

    socketService.onPlayerTagged((data) => {
      console.log('🎯 Player tagged:', data);
      if (data.targetId === playerId) {
        setIsCaught(true);
        triggerTaggedAlert();
      }
      loadPlayerRole();
    });

    socketService.onGameEnded((data) => {
      console.log('🏁 Game ended:', data);
      setGameStatus('ended');
      if (onGameEnd) onGameEnd(data);
    });

    socketService.onImmunityClaimed((data) => {
      console.log('🛡️ Immunity claimed:', data);
      if (data.playerId === playerId) {
        showNotification('🛡️ IMMUNITY CLAIMED!', 'info', 3000);
      }
    });

    socketService.onMissionCompleted((data) => {
      console.log('✅ Mission completed:', data);
      loadMissions();
      loadPlayerRole();
    });

    socketService.onMissionsSpawned(() => {
      console.log('📋 New missions spawned!');
      loadMissions();
    });

    const missionInterval = setInterval(() => {
      loadMissions();
    }, 10000);

    return () => {
      geolocationService.stopTracking();
      clearInterval(timerInterval);
      clearInterval(proximityInterval);
      clearInterval(missionInterval);
    };
  }, [sessionId, playerRole]);

  const loadPlayerRole = async () => {
    try {
      const apiService = (await import('../services/apiService')).default;
      const gameState = await apiService.getGameState(sessionId);
      console.log('🎮 Game state:', gameState);
      const me = gameState.players.find(p => p.player_id === playerId);
      if (me) {
        console.log('👤 My data:', me);
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
      console.log('📋 Missions loaded:', result.missions);
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

  // 🎯 UPDATE CLOSEST PLAYER FOR SEEKER
  const updateClosestPlayer = () => {
    if (playerRole !== 'seeker' || !playerLocation) return;
    
    const activeHiders = players.filter(p => 
      p.role === 'hider' && 
      p.status === 'active' && 
      p.last_location &&
      p.player_id !== playerId
    );
    
    if (activeHiders.length === 0) {
      setClosestPlayer(null);
      return;
    }
    
    let closest = null;
    let minDistance = Infinity;
    
    activeHiders.forEach(player => {
      const distance = geolocationService.calculateDistance(playerLocation, player.last_location);
      if (distance < minDistance) {
        minDistance = distance;
        closest = { ...player, distance };
      }
    });
    
    setClosestPlayer(closest && minDistance <= 30 ? closest : null);
  };

  // 🎯 INITIATE TAG
  const initiateTag = () => {
    if (!closestPlayer) {
      showNotification('No players within 30m!', 'warning', 3000);
      return;
    }
    
    setTargetToTag(closestPlayer);
    setShowTagConfirm(true);
  };

  // 🎯 CONFIRM TAG
  const confirmTag = () => {
    if (!targetToTag) return;
    
    console.log(`🎯 Tagging ${targetToTag.player_name}`);
    socketService.tagPlayer(sessionId, targetToTag.player_id);
    showNotification(`🎯 TAGGED ${targetToTag.player_name.toUpperCase()}!`, 'info', 3000);
    
    setShowTagConfirm(false);
    setTargetToTag(null);
  };

  const triggerViolationAlert = () => {
    setShowViolationAlert(true);
    if (navigator.vibrate) navigator.vibrate([500, 200, 500, 200, 500]);
    
    setTimeout(() => {
      setShowViolationAlert(false);
    }, 5000);
  };

  const triggerTaggedAlert = () => {
    showNotification('😱 YOU WERE CAUGHT!', 'danger', 5000);
    if (navigator.vibrate) navigator.vibrate([1000, 500, 1000, 500, 1000]);
  };

  const startLocationTracking = () => {
    geolocationService.startTracking(
      (location) => {
        console.log('📍 Location update:', location);
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
        console.error('Location error:', error);
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
            <p className="text-white text-2xl">LOCATION REVEALED FOR 5 SECONDS!</p>
          </div>
        </div>
      )}

      {/* TAG CONFIRMATION OVERLAY */}
      {showTagConfirm && targetToTag && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80">
          <div className="bg-danger p-8 rounded-2xl text-center max-w-sm">
            <div className="text-7xl mb-4">🎯</div>
            <h2 className="text-white font-graffiti text-3xl mb-4">TAG PLAYER?</h2>
            <div className="bg-black bg-opacity-50 rounded-lg p-4 mb-6">
              <p className="text-white text-2xl font-bold mb-1">{targetToTag.player_name}</p>
              <p className="text-gold text-xl">
                {Math.round(targetToTag.distance)}m away
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowTagConfirm(false);
                  setTargetToTag(null);
                }}
                className="flex-1 bg-concrete text-asphalt font-graffiti py-4 rounded-lg text-xl"
              >
                Cancel
              </button>
              <button
                onClick={confirmTag}
                className="flex-1 bg-lime text-asphalt font-graffiti py-4 rounded-lg text-xl animate-pulse"
              >
                CONFIRM TAG
              </button>
            </div>
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
        mapStyle={mapStyle}
        mapboxAccessToken={import.meta.env.VITE_MAPBOX_TOKEN}
        style={{ width: '100%', height: '100%' }}
      >
        {/* Boundary */}
        {boundaryGeoJSON && showBoundary && (
          <Source id="boundary-source" type="geojson" data={boundaryGeoJSON}>
            <Layer
              id="boundary-fill"
              type="fill"
              paint={{ 
                'fill-color': boundaryFlash ? '#FF0000' : '#00F5FF', 
                'fill-opacity': boundaryFlash ? 0.3 : 0.15 
              }}
            />
            <Layer
              id="boundary-line"
              type="line"
              paint={{ 
                'line-color': boundaryFlash ? '#FF0000' : '#00F5FF', 
                'line-width': boundaryFlash ? 5 : 3,
                'line-opacity': 1
              }}
            />
          </Source>
        )}

        {/* MY LOCATION */}
        {playerLocation && (
          <Marker
            longitude={playerLocation.lng}
            latitude={playerLocation.lat}
            anchor="center"
          >
            <div className="relative">
              <div
                className="animate-pulse"
                style={{
                  width: '32px',
                  height: '32px',
                  backgroundColor: playerRole === 'seeker' ? '#FF3838' : '#00F5FF',
                  borderRadius: '50%',
                  border: '4px solid white',
                  boxShadow: '0 0 20px rgba(0,245,255,0.8)'
                }}
              />
              <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 text-4xl">
                {isCaught ? '😵' : (playerRole === 'seeker' ? '👁️' : '🏃')}
              </div>
              <div className="absolute top-10 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
                <span className="text-sm bg-electric-blue text-asphalt px-2 py-1 rounded font-bold">
                  YOU
                </span>
              </div>
            </div>
          </Marker>
        )}

        {/* OTHER PLAYERS - ONLY VIOLATORS */}
        {players.map((player) => {
          if (!player.last_location) return null;
          if (player.player_id === playerId) return null;
          
          const isCaughtPlayer = player.status === 'caught';
          const isRevealed = revealedPlayers.has(player.player_id);
          
          const shouldShow = isRevealed;

          if (!shouldShow) return null;

          return (
            <Marker
              key={player.id}
              longitude={player.last_location.lng}
              latitude={player.last_location.lat}
              anchor="center"
            >
              <div className="relative">
                <div
                  className="animate-pulse"
                  style={{
                    width: '28px',
                    height: '28px',
                    backgroundColor: isCaughtPlayer ? '#888' : '#FFFF00',
                    borderRadius: '50%',
                    border: '4px solid red',
                    boxShadow: '0 0 20px rgba(255,255,0,1)',
                    opacity: isCaughtPlayer ? 0.5 : 1
                  }}
                />
                <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 text-3xl animate-bounce">
                  ⚠️
                </div>
                <div className="absolute top-9 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
                  <span className="text-xs bg-danger text-white px-2 py-1 rounded font-bold">
                    {player.player_name} {isCaughtPlayer && '💀'}
                  </span>
                </div>
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
            <div className="text-5xl animate-pulse" style={{ filter: 'drop-shadow(0 0 20px gold)' }}>
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

      {/* Top HUD */}
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
          
          {shrinkCountdown <= 60 && (
            <div className="mt-1 bg-gold text-asphalt px-2 py-1 rounded text-xs font-bold text-center animate-pulse">
              ⚠️ Shrinking in {formatTime(shrinkCountdown)}
            </div>
          )}
        </div>
      </div>

      {/* 🎯 SEEKER: TAG BUTTON + CLOSEST PLAYER INDICATOR */}
      {playerRole === 'seeker' && !isCaught && (
        <div className="absolute top-20 left-0 right-0 z-10 flex justify-center">
          <div className="bg-concrete bg-opacity-95 rounded-lg p-3 shadow-lg">
            {closestPlayer ? (
              <div className="text-center mb-2">
                <p className="text-spray-white text-xs mb-1">Closest Player:</p>
                <p className="text-lime font-graffiti text-lg">{closestPlayer.player_name}</p>
                <p className="text-hot-pink text-sm">{Math.round(closestPlayer.distance)}m away</p>
              </div>
            ) : (
              <p className="text-spray-white text-xs mb-2 text-center">No players within 30m</p>
            )}
            
            <button
              onClick={initiateTag}
              disabled={!closestPlayer}
              className={`w-full font-graffiti text-2xl py-4 rounded-lg shadow-lg ${
                closestPlayer 
                  ? 'bg-danger text-white animate-pulse' 
                  : 'bg-concrete text-spray-white opacity-50 cursor-not-allowed'
              }`}
            >
              {closestPlayer ? '🎯 TAG!' : '🚫 NO TARGET'}
            </button>
          </div>
        </div>
      )}

      {/* Missions Panel */}
      {showMissions && (
        <div className="absolute top-20 left-2 right-2 z-10 bg-concrete bg-opacity-95 rounded-lg p-3 shadow-lg max-h-48 overflow-y-auto">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-hot-pink font-graffiti text-base">Missions</h3>
            <button onClick={() => setShowMissions(false)} className="text-spray-white text-lg">✕</button>
          </div>
          {missions.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-spray-white text-xs opacity-75 mb-2">
                Waiting for missions...
              </p>
              <p className="text-electric-blue text-xs">
                First spawn: 30s after start<br />Then every 5 minutes
              </p>
            </div>
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
        <div className="flex gap-2 mb-2">
          <button
            onClick={() => {
              if (playerLocation) {
                setViewState(prev => ({ ...prev, longitude: playerLocation.lng, latitude: playerLocation.lat, zoom: 17 }));
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
            className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-xl font-bold ${
              showBoundary ? 'bg-electric-blue text-asphalt' : 'bg-concrete text-spray-white'
            }`}
          >
            {showBoundary ? '👁️' : '🗺️'}
          </button>
          
          <button
            onClick={() => setShowStyleSelector(!showStyleSelector)}
            className="w-14 h-14 bg-hot-pink text-white rounded-full shadow-lg flex items-center justify-center text-xl font-bold"
          >
            🗺️
          </button>
        </div>
        
        {showStyleSelector && (
          <div className="bg-concrete bg-opacity-95 rounded-lg p-2 mb-2 shadow-lg">
            <div className="grid grid-cols-2 gap-2">
              {mapStyles.map(style => (
                <button
                  key={style.value}
                  onClick={() => {
                    setMapStyle(style.value);
                    setShowStyleSelector(false);
                  }}
                  className={`px-3 py-2 rounded text-xs font-bold ${
                    mapStyle === style.value 
                      ? 'bg-electric-blue text-asphalt' 
                      : 'bg-asphalt text-spray-white'
                  }`}
                >
                  {style.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Caught Overlay */}
      {isCaught && (
        <div className="absolute inset-0 bg-black bg-opacity-70 flex items-center justify-center z-20">
          <div className="bg-danger p-8 rounded-lg text-center">
            <div className="text-8xl mb-4">😵</div>
            <h2 className="text-white font-graffiti text-4xl mb-2">CAUGHT!</h2>
            <p className="text-white text-base">Spectating...</p>
          </div>
        </div>
      )}
    </div>
  );
}