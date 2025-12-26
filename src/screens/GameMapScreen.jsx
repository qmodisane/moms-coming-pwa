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
    updateBoundary
  } = useGameStore();

  const [viewState, setViewState] = useState({
    longitude: 28.0473,
    latitude: -26.2041,
    zoom: 18
  });
  const [locationError, setLocationError] = useState(null);

  useEffect(() => {
    startLocationTracking();

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

  const startLocationTracking = () => {
    geolocationService.startTracking(
      (location) => {
        updatePlayerLocation(location);
        setViewState(prev => ({
          ...prev,
          longitude: location.lng,
          latitude: location.lat
        }));

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
    notification.className = `fixed top-4 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-lg font-bold text-white z-50 ${
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
    }
  };

  const boundaryLayerStyle = {
    id: 'boundary',
    type: 'fill',
    paint: {
      'fill-color': '#00F5FF',
      'fill-opacity': 0.1
    }
  };

  const boundaryOutlineStyle = {
    id: 'boundary-outline',
    type: 'line',
    paint: {
      'line-color': '#00F5FF',
      'line-width': 3,
      'line-opacity': 0.8
    }
  };

  const boundaryGeoJSON = boundary?.coordinates ? {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [boundary.coordinates.map(coord => [coord.lng, coord.lat])]
    }
  } : null;

  return (
    <div className="game-view">
      <Map
        ref={mapRef}
        {...viewState}
        onMove={evt => setViewState(evt.viewState)}
        mapStyle="mapbox://styles/mapbox/satellite-streets-v12"
        mapboxAccessToken={import.meta.env.VITE_MAPBOX_TOKEN}
        style={{ width: '100vw', height: '100vh' }}
      >
        {boundaryGeoJSON && (
          <Source id="boundary-source" type="geojson" data={boundaryGeoJSON}>
            <Layer {...boundaryLayerStyle} />
            <Layer {...boundaryOutlineStyle} />
          </Source>
        )}

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
                  <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-2xl">
                    📍
                  </div>
                )}
              </div>
            </Marker>
          );
        })}

        {immunitySpot && (
          <Marker
            longitude={immunitySpot.location.lng}
            latitude={immunitySpot.location.lat}
            anchor="center"
          >
            <div 
              className="relative text-3xl"
              style={{
                filter: 'drop-shadow(0 0 10px rgba(255,215,0,0.8))'
              }}
            >
              🛡️
            </div>
          </Marker>
        )}
      </Map>

      <div className="map-overlay top-4 left-4 right-4">
        <div className="bg-concrete bg-opacity-90 rounded-lg p-3 flex justify-between items-center mb-3">
          <div className="flex items-center space-x-4">
            <div>
              <p className="text-xs text-spray-white opacity-75">Points</p>
              <p className="text-2xl font-graffiti text-lime">{playerPoints}</p>
            </div>
            <div>
              <p className="text-xs text-spray-white opacity-75">Violations</p>
              <p className="text-2xl font-graffiti text-danger">{playerViolations}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-spray-white opacity-75">Role</p>
            <p className="text-lg font-bold text-electric-blue">
              {playerRole === 'seeker' ? '👁️ Seeker' : '🏃 Hider'}
            </p>
          </div>
        </div>

        {activeMission && playerRole === 'hider' && (
          <div className="bg-hot-pink bg-opacity-90 rounded-lg p-4 mb-3">
            <div className="flex justify-between items-start mb-2">
              <p className="text-white font-bold text-sm">ACTIVE MISSION</p>
              <span className={`mission-${activeMission.risk_level}`}>
                {activeMission.risk_level?.toUpperCase()}
              </span>
            </div>
            <p className="text-white mb-2">{activeMission.description}</p>
            <div className="flex justify-between items-center">
              <span className="text-lime font-graffiti text-xl">
                +{activeMission.point_value} pts
              </span>
              <button className="bg-white text-hot-pink px-4 py-1 rounded font-bold text-sm">
                Complete
              </button>
            </div>
          </div>
        )}

        {locationError && (
          <div className="bg-danger bg-opacity-90 rounded-lg p-3 mb-3">
            <p className="text-white text-sm font-bold">📍 {locationError}</p>
          </div>
        )}
      </div>

      <div className="map-overlay bottom-4 left-4 right-4">
        <div className="flex space-x-2">
          <button
            onClick={recenterMap}
            className="bg-concrete bg-opacity-90 p-3 rounded-full text-electric-blue text-2xl hover:bg-opacity-100 transition"
          >
            🎯
          </button>

          {playerRole === 'hider' && playerPoints >= 50 && (
            <button
              onClick={() => socketService.claimImmunity(sessionId, playerId)}
              className="flex-1 bg-gold text-asphalt font-graffiti text-lg py-3 rounded-lg hover:bg-opacity-90 transition"
            >
              🛡️ Claim Immunity ({playerPoints >= 100 ? '100 pts' : 'FREE'})
            </button>
          )}
        </div>
      </div>
    </div>
  );
}