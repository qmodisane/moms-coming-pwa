import { useEffect, useState, useRef } from 'react';
import Map, { Marker, Source, Layer } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useGameStore } from '../store/gameStore';
import socketService from '../services/socketService';
import geolocationService from '../services/geolocationService';

export default function GameMapScreen() {
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
    activeMission,
    updatePlayerLocation,
    updatePlayers,
    updateBoundary,
    setPlayerRole
  } = useGameStore();

  const [viewState, setViewState] = useState({
    longitude: 28.0473,
    latitude: -26.2041,
    zoom: 18
  });
  const [locationError, setLocationError] = useState(null);
  const [showBoundary, setShowBoundary] = useState(true);
  const [missions, setMissions] = useState([]);
  const [showMissions, setShowMissions] = useState(false);
  const [showMessaging, setShowMessaging] = useState(false);
  const [message, setMessage] = useState('');
  const [followMode, setFollowMode] = useState(true); // Auto-follow player

  useEffect(() => {
    startLocationTracking();
    loadPlayerRole();
    loadMissions();

    socketService.onGameState((gameState) => {
      updatePlayers(gameState.players || []);
      if (gameState.boundary) {
        updateBoundary(gameState.boundary);
      }
    });

    socketService.onBoundaryShrinking((data) => {
      showNotification('⚠️ Boundary shrinking in 30 seconds!', 'warning');
    });

    socketService.onBoundaryShrunk((data) => {
      updateBoundary(data.newBoundary);
      showNotification('🎯 Boundary has shrunk!', 'info');
    });

    socketService.onViolation((data) => {
      if (data.playerId === playerId) {
        showNotification('❌ Out of bounds! Location revealed!', 'danger');
      }
    });

    return () => {
      geolocationService.stopTracking();
    };
  }, [sessionId]);

  const loadPlayerRole = async () => {
    try {
      const apiService = (await import('../services/apiService')).default;
      const gameState = await apiService.getGameState(sessionId);
      const me = gameState.players.find(p => p.player_id === playerId);
      if (me) {
        setPlayerRole(me.role);
        console.log('🎭 My role:', me.role);
      }
    } catch (error) {
      console.error('Failed to load role:', error);
    }
  };

  const loadMissions = async () => {
    try {
      const apiService = (await import('../services/apiService')).default;
      const result = await apiService.getPlayerMissions(sessionId, playerId);
      setMissions(result.missions || []);
    } catch (error) {
      console.error('Failed to load missions:', error);
    }
  };

  const startLocationTracking = () => {
    geolocationService.startTracking(
      (location) => {
        updatePlayerLocation(location);
        
        // Auto-follow player in follow mode
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
    notification.className = `fixed top-20 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-lg font-bold text-white z-50 ${
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

  const recenterMap = () => {
    if (playerLocation) {
      setViewState(prev => ({
        ...prev,
        longitude: playerLocation.lng,
        latitude: playerLocation.lat,
        zoom: 18
      }));
      setFollowMode(true);
    }
  };

  const zoomToBoundary = () => {
    if (!boundary?.coordinates || boundary.coordinates.length === 0) return;
    
    // Calculate bounds
    const lngs = boundary.coordinates.map(c => c.lng);
    const lats = boundary.coordinates.map(c => c.lat);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    
    // Center point
    const centerLng = (minLng + maxLng) / 2;
    const centerLat = (minLat + maxLat) / 2;
    
    setViewState({
      longitude: centerLng,
      latitude: centerLat,
      zoom: 16
    });
    setFollowMode(false);
  };

  const boundaryLayerStyle = {
    id: 'boundary',
    type: 'fill',
    paint: {
      'fill-color': '#00F5FF',
      'fill-opacity': showBoundary ? 0.1 : 0
    }
  };

  const boundaryOutlineStyle = {
    id: 'boundary-outline',
    type: 'line',
    paint: {
      'line-color': '#00F5FF',
      'line-width': showBoundary ? 3 : 0,
      'line-opacity': showBoundary ? 0.8 : 0
    }
  };

  const boundaryGeoJSON = boundary?.coordinates ? {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [[
        ...boundary.coordinates.map(coord => [coord.lng, coord.lat]),
        [boundary.coordinates[0].lng, boundary.coordinates[0].lat] // Close polygon
      ]]
    }
  } : null;

  return (
    <div className="game-view relative">
      <Map
        ref={mapRef}
        {...viewState}
        onMove={evt => {
          setViewState(evt.viewState);
          setFollowMode(false); // Disable follow when user manually moves
        }}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        mapboxAccessToken={import.meta.env.VITE_MAPBOX_TOKEN}
        style={{ width: '100vw', height: '100vh' }}
      >
        {boundaryGeoJSON && (
          <Source id="boundary-source" type="geojson" data={boundaryGeoJSON}>
            <Layer {...boundaryLayerStyle} />
            <Layer {...boundaryOutlineStyle} />
          </Source>
        )}

        {/* Players */}
        {players.map((player) => {
          const shouldShow = player.last_location && (
            player.role === 'seeker' ||
            player.violations > 0 ||
            player.player_id === playerId
          );

          if (!shouldShow) return null;

          const isMe = player.player_id === playerId;
          const isSeeker = player.role === 'seeker';

          return (
            <Marker
              key={player.id}
              longitude={player.last_location.lng}
              latitude={player.last_location.lat}
              anchor="center"
            >
              <div 
                className="relative"
                style={{
                  width: isMe ? '24px' : '16px',
                  height: isMe ? '24px' : '16px',
                  backgroundColor: isSeeker ? '#FF3838' : isMe ? '#00F5FF' : '#CCFF00',
                  borderRadius: '50%',
                  border: '2px solid white',
                  boxShadow: '0 0 10px rgba(0,0,0,0.5)'
                }}
              >
                {isMe && (
                  <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 text-3xl">
                    {playerRole === 'seeker' ? '👁️' : '🏃'}
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
            <div className="text-4xl" style={{ filter: 'drop-shadow(0 0 10px rgba(255,215,0,0.8))' }}>
              🛡️
            </div>
          </Marker>
        )}
      </Map>

      {/* Top HUD */}
      <div className="absolute top-4 left-4 right-4 z-10">
        <div className="bg-concrete bg-opacity-95 rounded-lg p-3 flex justify-between items-center shadow-lg">
          <div className="flex items-center space-x-4">
            <div>
              <p className="text-xs text-spray-white opacity-75">Role</p>
              <p className="text-xl font-graffiti text-hot-pink">
                {playerRole === 'seeker' ? '👁️ SEEKER' : '🏃 HIDER'}
              </p>
            </div>
            <div>
              <p className="text-xs text-spray-white opacity-75">Points</p>
              <p className="text-2xl font-graffiti text-lime">{playerPoints}</p>
            </div>
            <div>
              <p className="text-xs text-spray-white opacity-75">Violations</p>
              <p className="text-2xl font-graffiti text-danger">{playerViolations}</p>
            </div>
          </div>
          
          <button
            onClick={() => setShowBoundary(!showBoundary)}
            className="text-xs bg-asphalt text-electric-blue px-3 py-2 rounded font-bold"
          >
            {showBoundary ? '👁️ Hide' : '👁️ Show'} Boundary
          </button>
        </div>

        {locationError && (
          <div className="bg-danger bg-opacity-90 rounded-lg p-3 mt-2">
            <p className="text-white text-sm font-bold">📍 {locationError}</p>
          </div>
        )}
      </div>

      {/* Mission Panel (Hiders Only) */}
      {playerRole === 'hider' && missions.length > 0 && (
        <button
          onClick={() => setShowMissions(!showMissions)}
          className="absolute top-28 right-4 z-10 bg-hot-pink text-white px-4 py-2 rounded-lg font-bold shadow-lg"
        >
          🎯 Missions ({missions.length})
        </button>
      )}

      {showMissions && (
        <div className="absolute top-40 right-4 left-4 z-10 bg-concrete bg-opacity-95 rounded-lg p-4 shadow-lg max-h-64 overflow-y-auto">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-hot-pink font-graffiti text-xl">Active Missions</h3>
            <button onClick={() => setShowMissions(false)} className="text-spray-white text-xl">✕</button>
          </div>
          {missions.map(mission => (
            <div key={mission.id} className="bg-asphalt rounded p-3 mb-2">
              <p className="text-spray-white text-sm mb-1">{mission.description}</p>
              <div className="flex justify-between items-center">
                <span className="text-lime font-bold">+{mission.point_value} pts</span>
                <button className="bg-lime text-asphalt px-3 py-1 rounded text-xs font-bold">
                  Complete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bottom Controls */}
      <div className="absolute bottom-4 left-4 right-4 z-10">
        <div className="flex space-x-2 mb-2">
          <button
            onClick={recenterMap}
            className={`bg-concrete bg-opacity-90 p-3 rounded-full text-2xl hover:bg-opacity-100 transition ${
              followMode ? 'text-hot-pink' : 'text-electric-blue'
            }`}
            title="Follow me"
          >
            🎯
          </button>

          <button
            onClick={zoomToBoundary}
            className="bg-concrete bg-opacity-90 p-3 rounded-full text-electric-blue text-2xl hover:bg-opacity-100 transition"
            title="Zoom to boundary"
          >
            🗺️
          </button>

          {playerRole === 'hider' && playerPoints >= 50 && (
            <button
              onClick={() => socketService.claimImmunity(sessionId, playerId)}
              className="flex-1 bg-gold text-asphalt font-graffiti text-lg py-3 rounded-lg hover:bg-opacity-90 transition shadow-lg"
            >
              🛡️ Claim Immunity (Free)
            </button>
          )}

          <button
            onClick={() => setShowMessaging(!showMessaging)}
            className="bg-hot-pink text-white px-4 py-3 rounded-lg font-bold"
          >
            💬
          </button>
        </div>

        {/* Messaging Panel */}
        {showMessaging && (
          <div className="bg-concrete bg-opacity-95 rounded-lg p-4 shadow-lg">
            <h3 className="text-electric-blue font-graffiti text-xl mb-2">Messages</h3>
            <p className="text-spray-white text-xs mb-3">💡 Available in final 10 minutes</p>
            <div className="flex space-x-2">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type message..."
                className="flex-1 bg-asphalt text-spray-white px-3 py-2 rounded"
                disabled
              />
              <button className="bg-electric-blue text-asphalt px-4 py-2 rounded font-bold" disabled>
                Send
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}