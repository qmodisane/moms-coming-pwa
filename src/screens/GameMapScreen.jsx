import { useEffect, useState, useRef, useCallback } from 'react';
import Map, { Marker, Source, Layer } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useGameStore } from '../store/gameStore';
import socketService from '../services/socketService';

export default function GameMapScreen({ onGameEnd }) {
  const mapRef = useRef(null);
  const watchIdRef = useRef(null);
  const lastLocationRef = useRef(null);
  
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

  // Core state
  const [isLoading, setIsLoading] = useState(true);
  const [myLocation, setMyLocation] = useState(null);
  const [viewState, setViewState] = useState({
    longitude: 28.0473,
    latitude: -26.2041,
    zoom: 17
  });
  
  // UI state
  const [mapStyle, setMapStyle] = useState('mapbox://styles/mapbox/satellite-streets-v12');
  const [showStyleSelector, setShowStyleSelector] = useState(false);
  const [showBoundary, setShowBoundary] = useState(true);
  const [followMode, setFollowMode] = useState(true);
  const [showMissions, setShowMissions] = useState(false);
  const [showMessaging, setShowMessaging] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [showTagConfirm, setShowTagConfirm] = useState(false);
  
  // Game state
  const [missions, setMissions] = useState([]);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [gameTime, setGameTime] = useState(0);
  const [shrinkCountdown, setShrinkCountdown] = useState(600);
  const [isCaught, setIsCaught] = useState(false);
  const [revealedPlayers, setRevealedPlayers] = useState(new Set());
  const [targetToTag, setTargetToTag] = useState(null);
  const [closestPlayer, setClosestPlayer] = useState(null);
  const [boundaryFlash, setBoundaryFlash] = useState(false);
  const [proximityAlert, setProximityAlert] = useState(null);
  
  // GPS state
  const [gpsAccuracy, setGpsAccuracy] = useState(null);
  const [locationError, setLocationError] = useState(null);

  // FIX #1: Notification state instead of DOM manipulation
  const [notification, setNotification] = useState(null);
  const [violationOverlay, setViolationOverlay] = useState(false);

  // FIX #2: Refs to access current values in callbacks/intervals
  const playerRoleRef = useRef(playerRole);
  const isCaughtRef = useRef(isCaught);
  const myLocationRef = useRef(myLocation);
  const playersRef = useRef(players);
  const boundaryRef = useRef(boundary);
  const followModeRef = useRef(followMode);
  const sessionIdRef = useRef(sessionId);
  const playerIdRef = useRef(playerId);

  // Keep refs in sync with state
  useEffect(() => { playerRoleRef.current = playerRole; }, [playerRole]);
  useEffect(() => { isCaughtRef.current = isCaught; }, [isCaught]);
  useEffect(() => { myLocationRef.current = myLocation; }, [myLocation]);
  useEffect(() => { playersRef.current = players; }, [players]);
  useEffect(() => { boundaryRef.current = boundary; }, [boundary]);
  useEffect(() => { followModeRef.current = followMode; }, [followMode]);
  useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);
  useEffect(() => { playerIdRef.current = playerId; }, [playerId]);

  const mapStyles = [
    { name: 'Satellite', value: 'mapbox://styles/mapbox/satellite-streets-v12' },
    { name: 'Streets', value: 'mapbox://styles/mapbox/streets-v12' },
    { name: 'Dark', value: 'mapbox://styles/mapbox/dark-v11' },
    { name: 'Outdoors', value: 'mapbox://styles/mapbox/outdoors-v12' }
  ];

  // ========== UTILITY FUNCTIONS ==========

  const calculateDistance = useCallback((loc1, loc2) => {
    if (!loc1 || !loc2) return Infinity;
    const R = 6371000;
    const lat1 = loc1.lat * Math.PI / 180;
    const lat2 = loc2.lat * Math.PI / 180;
    const deltaLat = (loc2.lat - loc1.lat) * Math.PI / 180;
    const deltaLng = (loc2.lng - loc1.lng) * Math.PI / 180;
    const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }, []);

  const isPointInBounds = useCallback((point, boundary) => {
    if (!point || !boundary?.coordinates) return true;
    const { lat, lng } = point;
    const polygon = boundary.coordinates;
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].lng, yi = polygon[i].lat;
      const xj = polygon[j].lng, yj = polygon[j].lat;
      const intersect = ((yi > lat) !== (yj > lat)) && (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }, []);

  // FIX #3: React-based notification instead of DOM manipulation
  const showNotification = useCallback((message, type, duration = 3000) => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), duration);
  }, []);

  const formatTime = useCallback((seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // ========== DATA LOADING ==========

  const loadPlayerRole = useCallback(async () => {
    try {
      console.log('👤 Loading player role...');
      const apiService = (await import('../services/apiService')).default;
      const gameState = await apiService.getGameState(sessionIdRef.current);
      const me = gameState.players?.find(p => p.player_id === playerIdRef.current);
      if (me) {
        console.log('✅ Player data:', me);
        setPlayerRole(me.role);
        updatePlayerPoints(me.points || 0);
        setIsCaught(me.status === 'caught');
      }
    } catch (error) {
      console.error('❌ Load role error:', error);
    }
  }, [setPlayerRole, updatePlayerPoints]);

  const loadMissions = useCallback(async () => {
    // FIX #4: Use refs for current values
    if (playerRoleRef.current === 'seeker' || isCaughtRef.current) return;
    try {
      const apiService = (await import('../services/apiService')).default;
      const result = await apiService.getPlayerMissions(sessionIdRef.current, playerIdRef.current);
      setMissions(result.missions || []);
      console.log('📋 Missions:', result.missions?.length || 0);
    } catch (error) {
      console.error('Mission load error:', error);
    }
  }, []);

  const completeMission = useCallback(async (missionId) => {
    try {
      socketService.completeMission(missionId, {});
      showNotification('✅ MISSION COMPLETED!', 'info', 3000);
      // FIX #5: Use Promise-based delay instead of nested setTimeout
      await new Promise(resolve => setTimeout(resolve, 500));
      loadMissions();
      loadPlayerRole();
    } catch (error) {
      console.error('Complete mission error:', error);
    }
  }, [showNotification, loadMissions, loadPlayerRole]);

  // ========== TAGGING ==========

  // FIX #6: Use refs in interval callback
  const updateClosestPlayer = useCallback(() => {
    const currentLocation = myLocationRef.current;
    const currentRole = playerRoleRef.current;
    const currentPlayers = playersRef.current;
    const currentPlayerId = playerIdRef.current;

    if (!currentLocation || currentRole !== 'seeker') return;
    
    const activeHiders = currentPlayers.filter(p => 
      p.role === 'hider' && 
      p.status === 'active' && 
      p.last_location &&
      p.player_id !== currentPlayerId
    );
    
    if (activeHiders.length === 0) {
      setClosestPlayer(null);
      return;
    }
    
    let closest = null;
    let minDistance = Infinity;
    
    activeHiders.forEach(player => {
      const distance = calculateDistance(currentLocation, player.last_location);
      if (distance < minDistance) {
        minDistance = distance;
        closest = { ...player, distance };
      }
    });
    
    setClosestPlayer(closest && minDistance <= 30 ? closest : null);
  }, [calculateDistance]);

  const initiateTag = useCallback(() => {
    if (!closestPlayer) {
      showNotification('No players within 30m!', 'warning', 2000);
      return;
    }
    setTargetToTag(closestPlayer);
    setShowTagConfirm(true);
  }, [closestPlayer, showNotification]);

  const confirmTag = useCallback(() => {
    if (!targetToTag) return;
    socketService.tagPlayer(sessionId, targetToTag.player_id);
    showNotification(`🎯 TAGGED ${targetToTag.player_name.toUpperCase()}!`, 'info', 3000);
    setShowTagConfirm(false);
    setTargetToTag(null);
  }, [targetToTag, sessionId, showNotification]);

  // ========== PROXIMITY ALERTS ==========

  // FIX #7: Use refs in interval callback
  const checkProximityToSeeker = useCallback(() => {
    const currentLocation = myLocationRef.current;
    const currentRole = playerRoleRef.current;
    const currentIsCaught = isCaughtRef.current;
    const currentPlayers = playersRef.current;

    if (!currentLocation || currentRole !== 'hider' || currentIsCaught) return;
    
    const seeker = currentPlayers.find(p => p.role === 'seeker');
    if (!seeker?.last_location) return;
    
    const distance = calculateDistance(currentLocation, seeker.last_location);
    
    if (distance <= 30) {
      setProximityAlert('danger');
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    } else if (distance <= 50) {
      setProximityAlert('near');
    } else if (distance <= 100) {
      setProximityAlert('far');
    } else {
      setProximityAlert(null);
    }
  }, [calculateDistance]);

  // ========== MESSAGING ==========

  const sendMessage = useCallback(() => {
    if (!message.trim()) return;
    socketService.sendMessage(sessionId, null, message, true);
    setMessage('');
  }, [message, sessionId]);

  // ========== GPS TRACKING ==========

  const startLocationTracking = useCallback(() => {
    console.log('🛰️ Starting GPS tracking...');
    
    if (!navigator.geolocation) {
      console.error('GPS not supported');
      setLocationError('GPS not supported');
      setIsLoading(false);
      return;
    }

    const options = {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 1000
    };

    // Get initial position
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy
        };
        console.log('📍 Initial GPS fix:', location);
        setMyLocation(location);
        setGpsAccuracy(Math.round(position.coords.accuracy));
        lastLocationRef.current = location;
        setIsLoading(false);
        
        // Center map
        setViewState(prev => ({
          ...prev,
          longitude: location.lng,
          latitude: location.lat
        }));
      },
      (error) => {
        console.error('GPS error:', error);
        setLocationError(error.message);
        setIsLoading(false);
      },
      options
    );

    // Watch position
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy
        };
        
        // Only update if location changed significantly (>5m)
        if (lastLocationRef.current) {
          const distance = calculateDistance(lastLocationRef.current, location);
          if (distance < 5) return;
        }
        
        console.log('📍 GPS update:', location);
        setMyLocation(location);
        setGpsAccuracy(Math.round(position.coords.accuracy));
        lastLocationRef.current = location;
        setLocationError(null);

        // Center map if following (use ref for current value)
        if (followModeRef.current) {
          setViewState(prev => ({
            ...prev,
            longitude: location.lng,
            latitude: location.lat
          }));
        }

        // Send to server (use refs for current values)
        socketService.updateLocation(sessionIdRef.current, playerIdRef.current, location);

        // Check boundaries (hiders only) - use refs
        if (playerRoleRef.current === 'hider' && boundaryRef.current && !isPointInBounds(location, boundaryRef.current)) {
          setNotification({ message: '⚠️ OUT OF BOUNDS!', type: 'warning' });
          setTimeout(() => setNotification(null), 2000);
        }
      },
      (error) => {
        console.error('GPS watch error:', error);
        setLocationError(error.message);
      },
      options
    );
  }, [calculateDistance, isPointInBounds]);

  // ========== MAIN EFFECT ==========

  useEffect(() => {
    console.log('🎮 GameMapScreen mounted');
    console.log('Session:', sessionId, 'Player:', playerId, 'Role:', playerRole);

    // Start GPS
    startLocationTracking();
    
    // Load initial data
    loadPlayerRole();
    setTimeout(() => loadMissions(), 1000);

    // Game timer
    const timerInterval = setInterval(() => {
      setGameTime(prev => prev + 1);
      setShrinkCountdown(prev => prev <= 1 ? 600 : prev - 1);
    }, 1000);

    // Proximity check - functions now use refs internally
    const proximityInterval = setInterval(() => {
      if (playerRoleRef.current === 'seeker') {
        updateClosestPlayer();
      } else {
        checkProximityToSeeker();
      }
    }, 3000);

    // Mission refresh
    const missionInterval = setInterval(() => {
      loadMissions();
    }, 15000);

    // ========== SOCKET LISTENERS ==========
    // FIX #8: Store handler references for cleanup

    const handleGameState = (gameState) => {
      console.log('📊 Game state update');
      if (gameState.players) updatePlayers(gameState.players);
      if (gameState.boundary) updateBoundary(gameState.boundary);
    };

    const handleBoundaryShrinking = () => {
      console.log('⚠️ Boundary shrinking');
      // Use ref for current role
      if (playerRoleRef.current === 'hider') {
        setNotification({ message: '⚠️ BOUNDARY SHRINKING IN 30 SECONDS!', type: 'danger' });
        setTimeout(() => setNotification(null), 5000);
      }
      setShrinkCountdown(30);
      setBoundaryFlash(true);
    };

    const handleBoundaryShrunk = (data) => {
      console.log('📍 Boundary shrunk');
      if (data.newBoundary) updateBoundary(data.newBoundary);
      if (playerRoleRef.current === 'hider') {
        setNotification({ message: '🎯 BOUNDARY SHRUNK!', type: 'warning' });
        setTimeout(() => setNotification(null), 5000);
      }
      setShrinkCountdown(600);
      setBoundaryFlash(false);
    };

    const handleViolation = (data) => {
      console.log('🚨 Violation:', data.playerId);
      
      // Reveal player for 5 seconds
      setRevealedPlayers(prev => new Set(prev).add(data.playerId));
      setTimeout(() => {
        setRevealedPlayers(prev => {
          const newSet = new Set(prev);
          newSet.delete(data.playerId);
          return newSet;
        });
      }, 5000);
      
      // Show alert if it's me (use ref)
      if (data.playerId === playerIdRef.current) {
        setViolationOverlay(true);
        if (navigator.vibrate) navigator.vibrate([500, 200, 500]);
        setTimeout(() => setViolationOverlay(false), 5000);
      }
    };

    const handleMessageReceived = (data) => {
      console.log('💬 Message:', data);
      setMessages(prev => [...prev, data]);
      setNotification({ message: `💬 ${data.fromPlayerName}: ${data.message}`, type: 'info' });
      setTimeout(() => setNotification(null), 3000);
    };

    const handlePlayerTagged = (data) => {
      console.log('🎯 Player tagged:', data.targetId);
      if (data.targetId === playerIdRef.current) {
        setIsCaught(true);
        setNotification({ message: '😱 YOU WERE CAUGHT!', type: 'danger' });
        setTimeout(() => setNotification(null), 5000);
        if (navigator.vibrate) navigator.vibrate([1000, 500, 1000]);
      }
      loadPlayerRole();
    };

    const handleGameEnded = (data) => {
      console.log('🏁 Game ended');
      setGameStatus('ended');
      if (onGameEnd) onGameEnd(data);
    };

    const handleMissionsSpawned = () => {
      console.log('📋 New missions spawned');
      loadMissions();
      if (playerRoleRef.current === 'hider') {
        setNotification({ message: '🎯 New missions available!', type: 'info' });
        setTimeout(() => setNotification(null), 3000);
      }
    };

    const handleImmunityClaimed = (data) => {
      if (data.playerId === playerIdRef.current) {
        setNotification({ message: '🛡️ IMMUNITY CLAIMED!', type: 'info' });
        setTimeout(() => setNotification(null), 3000);
      }
    };

    // Register listeners
    socketService.onGameState(handleGameState);
    socketService.onBoundaryShrinking(handleBoundaryShrinking);
    socketService.onBoundaryShrunk(handleBoundaryShrunk);
    socketService.onViolation(handleViolation);
    socketService.onMessageReceived(handleMessageReceived);
    socketService.onPlayerTagged(handlePlayerTagged);
    socketService.onGameEnded(handleGameEnded);
    socketService.onMissionsSpawned(handleMissionsSpawned);
    socketService.onImmunityClaimed(handleImmunityClaimed);

    // FIX #9: Cleanup function
    return () => {
      console.log('🧹 Cleanup');
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      clearInterval(timerInterval);
      clearInterval(proximityInterval);
      clearInterval(missionInterval);

      // Remove socket listeners (assuming socketService has off methods)
      // If socketService doesn't have off methods, this needs to be implemented
      if (socketService.offGameState) socketService.offGameState(handleGameState);
      if (socketService.offBoundaryShrinking) socketService.offBoundaryShrinking(handleBoundaryShrinking);
      if (socketService.offBoundaryShrunk) socketService.offBoundaryShrunk(handleBoundaryShrunk);
      if (socketService.offViolation) socketService.offViolation(handleViolation);
      if (socketService.offMessageReceived) socketService.offMessageReceived(handleMessageReceived);
      if (socketService.offPlayerTagged) socketService.offPlayerTagged(handlePlayerTagged);
      if (socketService.offGameEnded) socketService.offGameEnded(handleGameEnded);
      if (socketService.offMissionsSpawned) socketService.offMissionsSpawned(handleMissionsSpawned);
      if (socketService.offImmunityClaimed) socketService.offImmunityClaimed(handleImmunityClaimed);
    };
  }, [
    sessionId,
    playerId,
    playerRole,
    onGameEnd,
    startLocationTracking,
    loadPlayerRole,
    loadMissions,
    updateClosestPlayer,
    checkProximityToSeeker,
    updatePlayers,
    updateBoundary,
    setGameStatus
  ]);

  // ========== BOUNDARY GEOJSON ==========

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

  // ========== LOADING SCREEN ==========

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-asphalt flex items-center justify-center">
        <div className="text-center">
          <div className="text-9xl mb-6 animate-bounce">🎮</div>
          <h1 className="text-white font-graffiti text-6xl mb-4">MOM'S COMING</h1>
          <div className="flex justify-center gap-2 mb-4">
            <div className="w-4 h-4 bg-electric-blue rounded-full animate-pulse"></div>
            <div className="w-4 h-4 bg-hot-pink rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></div>
            <div className="w-4 h-4 bg-lime rounded-full animate-pulse" style={{animationDelay: '0.4s'}}></div>
          </div>
          <p className="text-spray-white text-2xl">Getting your location...</p>
          {locationError && (
            <p className="text-danger text-lg mt-4">⚠️ {locationError}</p>
          )}
        </div>
      </div>
    );
  }

  // ========== MAIN RENDER ==========

  return (
    <div className="fixed inset-0 bg-asphalt">

      {/* FIX #10: React-based notification component */}
      {notification && (
        <div 
          className={`fixed top-4 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-lg font-bold text-white z-50 shadow-2xl ${
            notification.type === 'danger' ? 'bg-danger' :
            notification.type === 'warning' ? 'bg-gold text-asphalt' :
            'bg-electric-blue text-asphalt'
          }`}
        >
          {notification.message}
        </div>
      )}

      {/* FIX #11: React-based violation overlay */}
      {violationOverlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-danger bg-opacity-90 animate-pulse">
          <div className="text-center">
            <div className="text-9xl mb-4">⚠️</div>
            <h1 className="text-white font-graffiti text-6xl mb-4">OUT OF BOUNDS!</h1>
            <p className="text-white text-2xl">LOCATION REVEALED FOR 5 SECONDS!</p>
          </div>
        </div>
      )}

      {/* ========== MODALS ========== */}

      {/* RULES MODAL */}
      {showRules && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90 p-4 overflow-y-auto">
          <div className="bg-concrete rounded-2xl p-6 max-w-2xl w-full max-h-screen overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-hot-pink font-graffiti text-3xl">📖 GAME RULES</h2>
              <button onClick={() => setShowRules(false)} className="text-spray-white text-3xl">✕</button>
            </div>
            
            <div className="space-y-4 text-spray-white text-sm">
              <div className="bg-asphalt rounded-lg p-4">
                <h3 className="text-danger font-graffiti text-xl mb-2">⚠️ VIOLATIONS</h3>
                <ul className="space-y-2">
                  <li>• <span className="font-bold">Out of bounds:</span> Location revealed for 5 seconds</li>
                  <li>• <span className="font-bold">Immunity drain:</span> 1pt/sec (10pt/sec in final 10min)</li>
                  <li>• <span className="font-bold">Tagging range:</span> Seeker must be within 30m</li>
                </ul>
              </div>

              <div className="bg-asphalt rounded-lg p-4">
                <h3 className="text-lime font-graffiti text-xl mb-2">🎯 ABILITIES</h3>
                <ul className="space-y-2">
                  <li>• <span className="font-bold">Missions:</span> Complete for 40-100 points</li>
                  <li>• <span className="font-bold">Immunity:</span> Claim with 50+ points (drains over time)</li>
                  <li>• <span className="font-bold">Messaging:</span> Unlimited messages anytime</li>
                  <li>• <span className="font-bold">Point transfers:</span> Help teammates</li>
                </ul>
              </div>

              <div className="bg-asphalt rounded-lg p-4">
                <h3 className="text-hot-pink font-graffiti text-xl mb-2">👁️ SEEKER RULES</h3>
                <ul className="space-y-2">
                  <li>• Can ONLY see violators (out-of-bounds players)</li>
                  <li>• Must get within 30m to tag</li>
                  <li>• Press TAG button to auto-detect closest hider</li>
                  <li>• Win by catching all hiders before time runs out</li>
                </ul>
              </div>

              <div className="bg-asphalt rounded-lg p-4">
                <h3 className="text-electric-blue font-graffiti text-xl mb-2">🏃 HIDER RULES</h3>
                <ul className="space-y-2">
                  <li>• Stay inside boundary to avoid revealing location</li>
                  <li>• Complete missions to earn points</li>
                  <li>• Earn 10 points per minute for survival</li>
                  <li>• Win if time runs out with at least 1 hider free</li>
                </ul>
              </div>

              <div className="bg-asphalt rounded-lg p-4">
                <h3 className="text-gold font-graffiti text-xl mb-2">📍 BOUNDARY SHRINKING</h3>
                <ul className="space-y-2">
                  <li>• Shrinks 20% every 10 minutes</li>
                  <li>• 30-second warning before each shrink</li>
                  <li>• Forces closer encounters over time</li>
                </ul>
              </div>
            </div>

            <button
              onClick={() => setShowRules(false)}
              className="w-full mt-4 bg-hot-pink text-white font-graffiti py-4 rounded-lg text-2xl"
            >
              GOT IT!
            </button>
          </div>
        </div>
      )}

      {/* TAG CONFIRMATION */}
      {showTagConfirm && targetToTag && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80 p-4">
          <div className="bg-danger p-8 rounded-2xl text-center max-w-sm w-full">
            <div className="text-8xl mb-4">🎯</div>
            <h2 className="text-white font-graffiti text-4xl mb-4">TAG PLAYER?</h2>
            <div className="bg-black bg-opacity-50 rounded-lg p-4 mb-6">
              <p className="text-white text-3xl font-bold mb-2">{targetToTag.player_name}</p>
              <p className="text-gold text-2xl">{Math.round(targetToTag.distance)}m away</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowTagConfirm(false); setTargetToTag(null); }}
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

      {/* ========== MAP ========== */}

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
                'line-width': boundaryFlash ? 6 : 4,
                'line-opacity': 1
              }}
            />
          </Source>
        )}

        {/* MY LOCATION */}
        {myLocation && (
          <Marker longitude={myLocation.lng} latitude={myLocation.lat} anchor="center">
            <div className="relative">
              <div
                className="rounded-full border-4 border-white shadow-xl animate-pulse"
                style={{
                  width: '40px',
                  height: '40px',
                  backgroundColor: playerRole === 'seeker' ? '#FF3838' : '#00F5FF',
                  boxShadow: '0 0 30px rgba(0,245,255,0.8)'
                }}
              />
              <div className="absolute -top-14 left-1/2 transform -translate-x-1/2 text-5xl">
                {isCaught ? '😵' : (playerRole === 'seeker' ? '👁️' : '🏃')}
              </div>
              <div className="absolute top-12 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
                <span className="text-sm bg-electric-blue text-asphalt px-3 py-1 rounded-full font-bold shadow-lg">
                  YOU
                </span>
              </div>
            </div>
          </Marker>
        )}

        {/* OTHER PLAYERS - ONLY VIOLATORS */}
        {players.map((player) => {
          if (!player.last_location || player.player_id === playerId) return null;
          
          const isRevealed = revealedPlayers.has(player.player_id);
          if (!isRevealed) return null;

          const isCaughtPlayer = player.status === 'caught';

          return (
            <Marker
              key={player.id}
              longitude={player.last_location.lng}
              latitude={player.last_location.lat}
              anchor="center"
            >
              <div className="relative">
                <div
                  className="rounded-full border-4 border-red-500 shadow-xl animate-pulse"
                  style={{
                    width: '32px',
                    height: '32px',
                    backgroundColor: isCaughtPlayer ? '#888' : '#FFFF00',
                    boxShadow: '0 0 30px rgba(255,255,0,1)'
                  }}
                />
                <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 text-4xl animate-bounce">
                  ⚠️
                </div>
                <div className="absolute top-10 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
                  <span className="text-xs bg-danger text-white px-2 py-1 rounded-full font-bold shadow-lg">
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
            <div className="text-6xl animate-pulse" style={{ filter: 'drop-shadow(0 0 30px gold)' }}>
              🛡️
            </div>
          </Marker>
        )}
      </Map>

      {/* ========== HUD ELEMENTS ========== */}

      {/* GPS Status */}
      <div className="absolute top-2 left-2 z-10 bg-black bg-opacity-75 rounded-lg px-3 py-2">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${myLocation ? 'bg-lime animate-pulse' : 'bg-danger'}`} />
          <span className="text-white font-bold text-xs">
            GPS: {gpsAccuracy ? `±${gpsAccuracy}m` : 'Searching...'}
          </span>
        </div>
      </div>

      {/* Top HUD */}
      <div className="absolute top-2 right-2 z-10 bg-concrete bg-opacity-95 rounded-lg p-2 shadow-lg">
        <div className="flex gap-2 items-center text-xs">
          <div className="text-center">
            <div className="text-spray-white opacity-75">Role</div>
            <div className={`font-graffiti text-lg ${playerRole === 'seeker' ? 'text-danger' : 'text-lime'}`}>
              {playerRole === 'seeker' ? '👁️' : '🏃'}
            </div>
          </div>
          <div className="text-center">
            <div className="text-spray-white opacity-75">Pts</div>
            <div className="font-graffiti text-lime text-lg">{playerPoints}</div>
          </div>
          <div className="text-center">
            <div className="text-spray-white opacity-75">Time</div>
            <div className="font-graffiti text-electric-blue text-lg">{formatTime(gameTime)}</div>
          </div>
          <button
            onClick={() => setShowRules(true)}
            className="bg-gold text-asphalt px-2 py-1 rounded font-bold"
          >
            📖
          </button>
          {playerRole === 'hider' && !isCaught && (
            <button
              onClick={() => setShowMissions(!showMissions)}
              className="bg-hot-pink text-white px-2 py-1 rounded font-bold"
            >
              🎯 {missions.length}
            </button>
          )}
          <button
            onClick={() => setShowMessaging(!showMessaging)}
            className="bg-electric-blue text-asphalt px-2 py-1 rounded font-bold relative"
          >
            💬
            {messages.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-hot-pink text-white text-xs w-4 h-4 rounded-full flex items-center justify-center">
                {messages.length}
              </span>
            )}
          </button>
        </div>
        
        {shrinkCountdown <= 60 && playerRole === 'hider' && (
          <div className="mt-2 bg-gold text-asphalt px-2 py-1 rounded text-xs font-bold text-center animate-pulse">
            ⚠️ Shrinking in {formatTime(shrinkCountdown)}
          </div>
        )}
      </div>

      {/* Proximity Alert (Hiders) */}
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

      {/* Seeker Tag Interface */}
      {playerRole === 'seeker' && !isCaught && (
        <div className="absolute top-20 left-4 right-4 z-10 flex justify-center">
          <div className="bg-concrete bg-opacity-95 rounded-2xl p-6 shadow-2xl max-w-md w-full">
            {closestPlayer ? (
              <>
                <p className="text-spray-white text-sm mb-2 text-center">Closest Player:</p>
                <p className="text-lime font-graffiti text-3xl text-center mb-1">{closestPlayer.player_name}</p>
                <p className="text-hot-pink text-xl font-bold text-center mb-4">{Math.round(closestPlayer.distance)}m away</p>
              </>
            ) : (
              <p className="text-spray-white text-lg mb-4 text-center">No players within 30m</p>
            )}
            <button
              onClick={initiateTag}
              disabled={!closestPlayer}
              className={`w-full font-graffiti text-4xl py-6 rounded-xl shadow-lg transition ${
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
        <div className="absolute top-40 left-4 right-4 z-10 bg-concrete bg-opacity-95 rounded-lg p-4 shadow-lg max-h-64 overflow-y-auto">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-hot-pink font-graffiti text-xl">Missions</h3>
            <button onClick={() => setShowMissions(false)} className="text-spray-white text-2xl">✕</button>
          </div>
          {missions.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-spray-white text-sm opacity-75 mb-2">Waiting for missions...</p>
              <p className="text-electric-blue text-xs">First spawn: 30s after game start<br />Then every 5 minutes</p>
            </div>
          ) : (
            missions.map(mission => (
              <div key={mission.id} className="bg-asphalt rounded-lg p-3 mb-3">
                <p className="text-spray-white text-sm mb-2">{mission.description}</p>
                <div className="flex justify-between items-center">
                  <span className="text-lime text-sm font-bold">+{mission.point_value} points</span>
                  <button
                    onClick={() => completeMission(mission.id)}
                    className="bg-lime text-asphalt px-4 py-2 rounded text-sm font-bold hover:bg-opacity-90"
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
        <div className="absolute top-40 left-4 right-4 z-10 bg-concrete bg-opacity-95 rounded-lg p-4 shadow-lg">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-electric-blue font-graffiti text-xl">Messages</h3>
            <button onClick={() => setShowMessaging(false)} className="text-spray-white text-2xl">✕</button>
          </div>
          
          <div className="max-h-40 overflow-y-auto mb-3 space-y-2">
            {messages.slice(-5).map((msg, i) => (
              <div key={i} className="bg-asphalt rounded-lg p-2">
                <span className="text-lime font-bold text-sm">{msg.fromPlayerName}: </span>
                <span className="text-spray-white text-sm">{msg.message}</span>
              </div>
            ))}
            {messages.length === 0 && (
              <p className="text-spray-white text-sm opacity-75 text-center py-4">No messages yet</p>
            )}
          </div>
          
          <div className="flex gap-2">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="Type message..."
              className="flex-1 bg-asphalt text-spray-white px-3 py-2 rounded text-sm"
              maxLength={50}
            />
            <button
              onClick={sendMessage}
              disabled={!message.trim()}
              className="bg-electric-blue text-asphalt px-4 py-2 rounded font-bold text-sm disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </div>
      )}

      {/* Bottom Controls */}
      <div className="absolute bottom-4 left-4 right-4 z-10">
        <div className="flex gap-2 mb-2">
          <button
            onClick={() => {
              if (myLocation) {
                setViewState(prev => ({
                  ...prev,
                  longitude: myLocation.lng,
                  latitude: myLocation.lat,
                  zoom: 17
                }));
                setFollowMode(true);
              }
            }}
            className={`w-16 h-16 rounded-full shadow-lg flex items-center justify-center text-3xl ${
              followMode ? 'bg-hot-pink text-white' : 'bg-concrete text-electric-blue'
            }`}
          >
            🎯
          </button>

          {playerRole === 'hider' && !isCaught && playerPoints >= 50 && immunitySpot && (
            <button
              onClick={() => socketService.claimImmunity(sessionId, playerId)}
              className="flex-1 bg-gold text-asphalt font-graffiti py-4 rounded-lg shadow-lg text-lg font-bold"
            >
              🛡️ CLAIM IMMUNITY
            </button>
          )}

          <button
            onClick={() => setShowBoundary(!showBoundary)}
            className={`w-16 h-16 rounded-full shadow-lg flex items-center justify-center text-2xl ${
              showBoundary ? 'bg-electric-blue text-asphalt' : 'bg-concrete text-spray-white'
            }`}
          >
            {showBoundary ? '👁️' : '🗺️'}
          </button>
          
          <button
            onClick={() => setShowStyleSelector(!showStyleSelector)}
            className="w-16 h-16 bg-hot-pink text-white rounded-full shadow-lg flex items-center justify-center text-2xl"
          >
            🗺️
          </button>
        </div>
        
        {showStyleSelector && (
          <div className="bg-concrete bg-opacity-95 rounded-lg p-3 shadow-lg">
            <div className="grid grid-cols-2 gap-2">
              {mapStyles.map(style => (
                <button
                  key={style.value}
                  onClick={() => {
                    setMapStyle(style.value);
                    setShowStyleSelector(false);
                  }}
                  className={`px-4 py-3 rounded text-sm font-bold ${
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
        <div className="absolute inset-0 bg-black bg-opacity-80 flex items-center justify-center z-30">
          <div className="bg-danger p-10 rounded-2xl text-center">
            <div className="text-9xl mb-6">😵</div>
            <h2 className="text-white font-graffiti text-5xl mb-4">CAUGHT!</h2>
            <p className="text-white text-xl">You can spectate the game</p>
          </div>
        </div>
      )}

      {/* Location Error */}
      {locationError && (
        <div className="absolute bottom-24 left-4 right-4 z-10 bg-danger bg-opacity-90 rounded-lg p-4">
          <p className="text-white text-sm font-bold text-center">
            📍 GPS Error: {locationError}
          </p>
        </div>
      )}
    </div>
  );
}