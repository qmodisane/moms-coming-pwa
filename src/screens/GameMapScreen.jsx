import { useEffect, useState, useRef } from 'react';
import Map, { Marker, Source, Layer } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useGameStore } from '../store/gameStore';
import socketService from '../services/socketService';

export default function GameMapScreen({ onGameEnd }) {
  const mapRef = useRef(null);
  const watchIdRef = useRef(null);
  const locationUpdateInterval = useRef(null);
  
  const {
    sessionId,
    playerId,
    playerRole,
    playerPoints,
    playerViolations,
    players,
    boundary,
    immunitySpot,
    updatePlayers,
    updateBoundary,
    setPlayerRole,
    updatePlayerPoints,
    setGameStatus
  } = useGameStore();

  // Local state for MY location (separate from store)
  const [myLocation, setMyLocation] = useState(null);
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
    { name: 'Outdoors', value: 'mapbox://styles/mapbox/outdoors-v12' }
  ];
  
  const [locationError, setLocationError] = useState(null);
  const [showBoundary, setShowBoundary] = useState(true); // ALWAYS SHOW BY DEFAULT
  const [missions, setMissions] = useState([]);
  const [showMissions, setShowMissions] = useState(false);
  const [showMessaging, setShowMessaging] = useState(false);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [followMode, setFollowMode] = useState(true);
  const [gameTime, setGameTime] = useState(0);
  const [shrinkCountdown, setShrinkCountdown] = useState(600);
  const [isCaught, setIsCaught] = useState(false);
  const [proximityAlert, setProximityAlert] = useState(null);
  const [showViolationAlert, setShowViolationAlert] = useState(false);
  const [boundaryFlash, setBoundaryFlash] = useState(false);
  const [revealedPlayers, setRevealedPlayers] = useState(new Set());
  const [showTagConfirm, setShowTagConfirm] = useState(false);
  const [targetToTag, setTargetToTag] = useState(null);
  const [closestPlayer, setClosestPlayer] = useState(null);
  const [lastLocationUpdate, setLastLocationUpdate] = useState(null);
  const [gpsAccuracy, setGpsAccuracy] = useState(null);
  const [showRules, setShowRules] = useState(false);

  // 🔧 NATIVE GPS TRACKING - ROBUST VERSION
  const startLocationTracking = () => {
    console.log('🛰️ Starting native GPS tracking...');
    
    if (!navigator.geolocation) {
      setLocationError('GPS not supported');
      return;
    }

    // Request high accuracy GPS
    const options = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    };

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const newLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp
        };

        console.log('📍 GPS UPDATE:', newLocation);
        
        // Update local state immediately
        setMyLocation(newLocation);
        setGpsAccuracy(Math.round(position.coords.accuracy));
        setLastLocationUpdate(new Date().toLocaleTimeString());
        setLocationError(null);

        // Center map on me if follow mode
        if (followMode) {
          setViewState(prev => ({
            ...prev,
            longitude: newLocation.lng,
            latitude: newLocation.lat
          }));
        }

        // Send to server
        socketService.updateLocation(sessionId, playerId, newLocation);

        // Check if out of bounds (HIDERS ONLY)
        if (playerRole === 'hider' && boundary && !isPointInBounds(newLocation, boundary)) {
          showNotification('⚠️ YOU ARE OUT OF BOUNDS!', 'warning', 3000);
        }
      },
      (error) => {
        console.error('GPS Error:', error);
        setLocationError(`GPS Error: ${error.message}`);
        
        // Retry after 5 seconds
        setTimeout(() => {
          console.log('🔄 Retrying GPS...');
          startLocationTracking();
        }, 5000);
      },
      options
    );
  };

  // Calculate distance between two points
  const calculateDistance = (loc1, loc2) => {
    const R = 6371000; // Earth radius in meters
    const lat1 = loc1.lat * Math.PI / 180;
    const lat2 = loc2.lat * Math.PI / 180;
    const deltaLat = (loc2.lat - loc1.lat) * Math.PI / 180;
    const deltaLng = (loc2.lng - loc1.lng) * Math.PI / 180;

    const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  // Check if point is inside boundary
  const isPointInBounds = (point, boundary) => {
    if (!boundary?.coordinates) return true;
    
    const { lat, lng } = point;
    const polygon = boundary.coordinates;
    
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].lng, yi = polygon[i].lat;
      const xj = polygon[j].lng, yj = polygon[j].lat;
      
      const intersect = ((yi > lat) !== (yj > lat))
        && (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    
    return inside;
  };

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

    // Update closest player for seeker
    const proximityInterval = setInterval(() => {
      if (playerRole === 'seeker' && myLocation) {
        updateClosestPlayer();
      }
      if (playerRole === 'hider' && myLocation) {
        checkProximityToSeeker();
      }
    }, 2000);

    // Socket listeners
    socketService.onGameState((gameState) => {
      console.log('📊 Game state:', gameState);
      updatePlayers(gameState.players || []);
      if (gameState.boundary) {
        updateBoundary(gameState.boundary);
      }
    });

    socketService.onBoundaryShrinking((data) => {
      console.log('⚠️ Boundary shrinking!');
      // ONLY SHOW TO HIDERS
      if (playerRole === 'hider') {
        showNotification('⚠️ BOUNDARY SHRINKING IN 30 SECONDS!', 'danger', 5000);
      }
      setShrinkCountdown(30);
      setBoundaryFlash(true);
    });

    socketService.onBoundaryShrunk((data) => {
      console.log('📍 Boundary shrunk:', data.newBoundary);
      updateBoundary(data.newBoundary);
      // ONLY SHOW TO HIDERS
      if (playerRole === 'hider') {
        showNotification('🎯 BOUNDARY HAS SHRUNK!', 'warning', 5000);
      }
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
      setMessages(prev => [...prev, data]);
      showNotification(`💬 ${data.fromPlayerName}: ${data.message}`, 'info', 3000);
    });

    socketService.onPlayerTagged((data) => {
      if (data.targetId === playerId) {
        setIsCaught(true);
        triggerTaggedAlert();
      }
      loadPlayerRole();
    });

    socketService.onGameEnded((data) => {
      setGameStatus('ended');
      if (onGameEnd) onGameEnd(data);
    });

    socketService.onMissionsSpawned(() => {
      loadMissions();
    });

    const missionInterval = setInterval(() => {
      loadMissions();
    }, 10000);

    return () => {
      // Cleanup GPS tracking
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      clearInterval(timerInterval);
      clearInterval(proximityInterval);
      clearInterval(missionInterval);
    };
  }, [sessionId, playerRole, myLocation]);

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
    if (!myLocation || isCaught) return;
    
    const seeker = players.find(p => p.role === 'seeker');
    if (!seeker?.last_location) return;
    
    const distance = calculateDistance(myLocation, seeker.last_location);
    
    if (distance <= 30) {
      setProximityAlert('danger');
      if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200]);
    } else if (distance <= 50) {
      setProximityAlert('near');
    } else if (distance <= 100) {
      setProximityAlert('far');
    } else {
      setProximityAlert(null);
    }
  };

  const updateClosestPlayer = () => {
    if (!myLocation) return;
    
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
      const distance = calculateDistance(myLocation, player.last_location);
      if (distance < minDistance) {
        minDistance = distance;
        closest = { ...player, distance };
      }
    });
    
    setClosestPlayer(closest && minDistance <= 30 ? closest : null);
  };

  const initiateTag = () => {
    if (!closestPlayer) {
      showNotification('No players within 30m!', 'warning', 3000);
      return;
    }
    
    setTargetToTag(closestPlayer);
    setShowTagConfirm(true);
  };

  const confirmTag = () => {
    if (!targetToTag) return;
    
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
      {/* RULES MODAL */}
      {showRules && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90 p-4 overflow-y-auto">
          <div className="bg-concrete rounded-2xl p-6 max-w-2xl w-full max-h-screen overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-hot-pink font-graffiti text-3xl">📖 GAME RULES</h2>
              <button onClick={() => setShowRules(false)} className="text-spray-white text-3xl">✕</button>
            </div>
            
            <div className="space-y-4 text-spray-white">
              <div className="bg-asphalt rounded-lg p-4">
                <h3 className="text-lime font-graffiti text-xl mb-2">⚠️ VIOLATIONS</h3>
                <ul className="text-sm space-y-2">
                  <li>• <span className="text-danger font-bold">OUT OF BOUNDS:</span> Location revealed for 5 seconds</li>
                  <li>• <span className="text-gold font-bold">IMMUNITY DRAIN:</span> 1pt/sec (10pt/sec in final 10min)</li>
                  <li>• <span className="text-hot-pink font-bold">TAGGING RANGE:</span> Seeker must be within 30m</li>
                </ul>
              </div>

              <div className="bg-asphalt rounded-lg p-4">
                <h3 className="text-electric-blue font-graffiti text-xl mb-2">🎯 ABILITIES</h3>
                <ul className="text-sm space-y-2">
                  <li>• <span className="text-lime font-bold">MISSIONS:</span> Complete for 40-100 points</li>
                  <li>• <span className="text-gold font-bold">IMMUNITY:</span> Claim with 50+ points (drains over time)</li>
                  <li>• <span className="text-electric-blue font-bold">MESSAGING:</span> Unlimited messages throughout game</li>
                  <li>• <span className="text-hot-pink font-bold">POINT TRANSFERS:</span> Help teammates with points</li>
                </ul>
              </div>

              <div className="bg-asphalt rounded-lg p-4">
                <h3 className="text-danger font-graffiti text-xl mb-2">👁️ SEEKER RULES</h3>
                <ul className="text-sm space-y-2">
                  <li>• Can ONLY see violators (out-of-bounds players)</li>
                  <li>• Must get within 30m to tag</li>
                  <li>• Press TAG button to auto-detect closest hider</li>
                  <li>• Win by catching all hiders before time runs out</li>
                </ul>
              </div>

              <div className="bg-asphalt rounded-lg p-4">
                <h3 className="text-lime font-graffiti text-xl mb-2">🏃 HIDER RULES</h3>
                <ul className="text-sm space-y-2">
                  <li>• Stay inside boundary to avoid revealing location</li>
                  <li>• Complete missions to earn points</li>
                  <li>• Earn 10 points per minute for survival</li>
                  <li>• Win if time runs out with at least 1 hider free</li>
                </ul>
              </div>

              <div className="bg-asphalt rounded-lg p-4">
                <h3 className="text-gold font-graffiti text-xl mb-2">📍 BOUNDARY SHRINKING</h3>
                <ul className="text-sm space-y-2">
                  <li>• Shrinks 20% every 10 minutes</li>
                  <li>• 30-second warning before each shrink</li>
                  <li>• Forces closer encounters over time</li>
                </ul>
              </div>
            </div>

            <button
              onClick={() => setShowRules(false)}
              className="w-full mt-4 bg-hot-pink text-white font-graffiti py-3 rounded-lg text-xl"
            >
              GOT IT!
            </button>
          </div>
        </div>
      )}

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
                CONFIRM
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
        {/* Boundary - ALWAYS VISIBLE */}
        {boundaryGeoJSON && showBoundary && (
          <Source id="boundary-source" type="geojson" data={boundaryGeoJSON}>
            <Layer
              id="boundary-fill"
              type="fill"
              paint={{ 
                'fill-color': boundaryFlash ? '#FF0000' : '#00F5FF', 
                'fill-opacity': boundaryFlash ? 0.4 : 0.2
              }}
            />
            <Layer
              id="boundary-line"
              type="line"
              paint={{ 
                'line-color': boundaryFlash ? '#FF0000' : '#00F5FF', 
                'line-width': boundaryFlash ? 6 : 4,
                'line-opacity': 1
              }}
            />
          </Source>
        )}

        {/* MY LOCATION - FROM LOCAL STATE */}
        {myLocation && (
          <Marker
            longitude={myLocation.lng}
            latitude={myLocation.lat}
            anchor="center"
          >
            <div className="relative">
              <div
                className="animate-pulse"
                style={{
                  width: '36px',
                  height: '36px',
                  backgroundColor: playerRole === 'seeker' ? '#FF3838' : '#00F5FF',
                  borderRadius: '50%',
                  border: '5px solid white',
                  boxShadow: '0 0 25px rgba(0,245,255,1)'
                }}
              />
              <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 text-5xl">
                {isCaught ? '😵' : (playerRole === 'seeker' ? '👁️' : '🏃')}
              </div>
              <div className="absolute top-11 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
                <span className="text-sm bg-electric-blue text-asphalt px-3 py-1 rounded-full font-bold shadow-lg">
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
          
          if (!isRevealed) return null;

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
                    width: '30px',
                    height: '30px',
                    backgroundColor: isCaughtPlayer ? '#888' : '#FFFF00',
                    borderRadius: '50%',
                    border: '4px solid red',
                    boxShadow: '0 0 25px rgba(255,255,0,1)'
                  }}
                />
                <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 text-4xl animate-bounce">
                  ⚠️
                </div>
                <div className="absolute top-10 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
                  <span className="text-xs bg-danger text-white px-2 py-1 rounded-full font-bold">
                    {player.player_name}
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
            <div className="text-6xl animate-pulse" style={{ filter: 'drop-shadow(0 0 30px gold)' }}>
              🛡️
            </div>
          </Marker>
        )}
      </Map>

      {/* GPS STATUS INDICATOR */}
      <div className="absolute top-2 left-2 z-10">
        <div className="bg-black bg-opacity-75 rounded-lg px-3 py-2 text-xs">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${myLocation ? 'bg-lime animate-pulse' : 'bg-danger'}`} />
            <span className="text-white font-bold">
              GPS: {myLocation ? `${gpsAccuracy}m` : 'Searching...'}
            </span>
          </div>
          {lastLocationUpdate && (
            <div className="text-spray-white text-xs mt-1">
              Updated: {lastLocationUpdate}
            </div>
          )}
        </div>
      </div>

      {/* Top HUD */}
      <div className="absolute top-2 right-2 z-10">
        <div className="bg-concrete bg-opacity-95 rounded-lg p-2 shadow-lg">
          <div className="flex justify-between items-center gap-3 text-xs">
            <div className="flex items-center gap-2">
              <div>
                <div className="text-spray-white opacity-75">Role</div>
                <div className={`font-graffiti text-sm ${playerRole === 'seeker' ? 'text-danger' : 'text-lime'}`}>
                  {playerRole === 'seeker' ? '👁️' : '🏃'}
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
              <button
                onClick={() => setShowRules(true)}
                className="bg-gold text-asphalt px-2 py-1 rounded text-xs font-bold"
              >
                📖
              </button>
              
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
          
          {shrinkCountdown <= 60 && playerRole === 'hider' && (
            <div className="mt-1 bg-gold text-asphalt px-2 py-1 rounded text-xs font-bold text-center animate-pulse">
              ⚠️ Shrinking in {formatTime(shrinkCountdown)}
            </div>
          )}
        </div>
      </div>

      {/* Proximity Alert Banner (HIDERS ONLY) */}
      {proximityAlert && playerRole === 'hider' && !isCaught && (
        <div className={`absolute top-16 left-0 right-0 z-20 py-3 text-center font-bold text-white text-lg ${
          proximityAlert === 'danger' ? 'bg-danger animate-pulse' :
          proximityAlert === 'near' ? 'bg-hot-pink' :
          'bg-gold text-asphalt'
        }`}>
          {proximityAlert === 'danger' && '🚨 SEEKER VERY CLOSE! (<30m)'}
          {proximityAlert === 'near' && '⚠️ Seeker Nearby (<50m)'}
          {proximityAlert === 'far' && '👀 Seeker in Area (<100m)'}
        </div>
      )}

      {/* SEEKER: TAG BUTTON */}
      {playerRole === 'seeker' && !isCaught && (
        <div className="absolute top-20 left-0 right-0 z-10 flex justify-center px-4">
          <div className="bg-concrete bg-opacity-95 rounded-xl p-4 shadow-2xl w-full max-w-sm">
            {closestPlayer ? (
              <div className="text-center mb-3">
                <p className="text-spray-white text-xs mb-1">Closest Player:</p>
                <p className="text-lime font-graffiti text-2xl">{closestPlayer.player_name}</p>
                <p className="text-hot-pink text-lg font-bold">{Math.round(closestPlayer.distance)}m away</p>
              </div>
            ) : (
              <p className="text-spray-white text-sm mb-3 text-center">
                Move within 30m of a hider
              </p>
            )}
            
            <button
              onClick={initiateTag}
              disabled={!closestPlayer}
              className={`w-full font-graffiti text-3xl py-5 rounded-xl shadow-lg ${
                closestPlayer 
                  ? 'bg-danger text-white animate-pulse' 
                  : 'bg-concrete text-spray-white opacity-50'
              }`}
            >
              {closestPlayer ? '🎯 TAG!' : '🚫 NO TARGET'}
            </button>
          </div>
        </div>
      )}

      {/* Missions Panel */}
      {showMissions && (
        <div className="absolute top-32 left-2 right-2 z-10 bg-concrete bg-opacity-95 rounded-lg p-3 shadow-lg max-h-48 overflow-y-auto">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-hot-pink font-graffiti text-base">Missions</h3>
            <button onClick={() => setShowMissions(false)} className="text-spray-white text-lg">✕</button>
          </div>
          {missions.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-spray-white text-xs opacity-75">
                Waiting for missions...<br/>
                First spawn: 30s after start
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
        <div className="absolute top-32 left-2 right-2 z-10 bg-concrete bg-opacity-95 rounded-lg p-3 shadow-lg">
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
              if (myLocation) {
                setViewState(prev => ({ ...prev, longitude: myLocation.lng, latitude: myLocation.lat, zoom: 17 }));
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

      {/* Error Display */}
      {locationError && (
        <div className="absolute bottom-20 left-2 right-2 z-10 bg-danger bg-opacity-90 rounded-lg p-3">
          <p className="text-white text-sm font-bold text-center">
            📍 {locationError}
          </p>
        </div>
      )}
    </div>
  );
}