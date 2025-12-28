import { useEffect, useState, useRef } from 'react';
import Map, { Marker, Source, Layer } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useGameStore } from '../store/gameStore';
import apiService from '../services/apiService';
import geolocationService from '../services/geolocationService';

export default function SetupScreen({ onSetupComplete }) {
  const mapRef = useRef(null);
  const { sessionId, playerId, players, isHost } = useGameStore();
  
  const [step, setStep] = useState(1); // 1=boundary, 2=immunity, 3=seeker
  const [viewState, setViewState] = useState({
    longitude: 28.0473,
    latitude: -26.2041,
    zoom: 16
  });
  
  const [boundaryPoints, setBoundaryPoints] = useState([]);
  const [immunitySpot, setImmunitySpot] = useState(null);
  const [selectedSeeker, setSelectedSeeker] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Get user's location for map centering
    geolocationService.getCurrentPosition()
      .then(location => {
        setViewState(prev => ({
          ...prev,
          longitude: location.lng,
          latitude: location.lat
        }));
      })
      .catch(err => {
        console.error('Location error:', err);
        setError('Could not get your location. Using default.');
      });
  }, []);

  const handleMapClick = (event) => {
    if (step === 1) {
      // Drawing boundary
      const { lngLat } = event;
      setBoundaryPoints([...boundaryPoints, { lng: lngLat.lng, lat: lngLat.lat }]);
    } else if (step === 2) {
      // Placing immunity spot
      const { lngLat } = event;
      setImmunitySpot({ lng: lngLat.lng, lat: lngLat.lat });
    }
  };

  const undoLastPoint = () => {
    setBoundaryPoints(boundaryPoints.slice(0, -1));
  };

  const clearBoundary = () => {
    setBoundaryPoints([]);
  };

  const completeBoundary = async () => {
    if (boundaryPoints.length < 3) {
      setError('Need at least 3 points to create boundary!');
      return;
    }

    setLoading(true);
    try {
      await apiService.setBoundary(sessionId, boundaryPoints);
      setStep(2);
      setError(null);
    } catch (err) {
      setError('Failed to set boundary: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const skipImmunity = () => {
    setStep(3);
  };

  const placeImmunity = async () => {
    if (!immunitySpot) {
      setError('Click on map to place immunity spot!');
      return;
    }

    setLoading(true);
    try {
      await apiService.setImmunitySpot(sessionId, immunitySpot);
      setStep(3);
      setError(null);
    } catch (err) {
      setError('Failed to place immunity: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const startGame = async () => {
    if (!selectedSeeker) {
      setError('Please select a seeker!');
      return;
    }

    setLoading(true);
    try {
      // Assign seeker
      await apiService.assignSeeker(sessionId, selectedSeeker);
      
      // Start the game
      await apiService.startGame(sessionId);
      
      // Notify parent
      onSetupComplete();
    } catch (err) {
      setError('Failed to start game: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Create GeoJSON for boundary polygon
  const boundaryGeoJSON = boundaryPoints.length >= 3 ? {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [[...boundaryPoints.map(p => [p.lng, p.lat]), [boundaryPoints[0].lng, boundaryPoints[0].lat]]]
    }
  } : null;

  const boundaryFillStyle = {
    id: 'boundary-fill',
    type: 'fill',
    paint: {
      'fill-color': '#00d9ff',
      'fill-opacity': 0.2
    }
  };

  const boundaryLineStyle = {
    id: 'boundary-line',
    type: 'line',
    paint: {
      'line-color': '#00d9ff',
      'line-width': 3
    }
  };

  return (
    <div className="min-h-screen bg-asphalt">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-concrete bg-opacity-95 p-4 border-b-2 border-electric-blue">
        <h1 className="font-graffiti text-3xl text-hot-pink text-center mb-2">
          Game Setup
        </h1>
        
        {/* Step Indicator */}
        <div className="flex justify-center space-x-2 mb-2">
          <div className={`w-3 h-3 rounded-full ${step >= 1 ? 'bg-electric-blue' : 'bg-asphalt'}`}></div>
          <div className={`w-3 h-3 rounded-full ${step >= 2 ? 'bg-electric-blue' : 'bg-asphalt'}`}></div>
          <div className={`w-3 h-3 rounded-full ${step >= 3 ? 'bg-electric-blue' : 'bg-asphalt'}`}></div>
        </div>

        <p className="text-center text-spray-white font-bold">
          {step === 1 && '📍 Step 1: Draw Game Boundary'}
          {step === 2 && '🛡️ Step 2: Place Immunity Spot (Optional)'}
          {step === 3 && '👁️ Step 3: Choose Seeker'}
        </p>

        {error && (
          <div className="mt-2 bg-danger text-white p-2 rounded text-sm text-center">
            {error}
          </div>
        )}
      </div>

      {/* Map */}
      <Map
        ref={mapRef}
        {...viewState}
        onMove={evt => setViewState(evt.viewState)}
        onClick={handleMapClick}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        mapboxAccessToken={import.meta.env.VITE_MAPBOX_TOKEN}
        style={{ width: '100vw', height: '100vh' }}
      >
        {/* Boundary Polygon */}
        {boundaryGeoJSON && (
          <Source id="boundary" type="geojson" data={boundaryGeoJSON}>
            <Layer {...boundaryFillStyle} />
            <Layer {...boundaryLineStyle} />
          </Source>
        )}

        {/* Boundary Points */}
        {boundaryPoints.map((point, index) => (
          <Marker
            key={index}
            longitude={point.lng}
            latitude={point.lat}
            anchor="center"
          >
            <div className="w-4 h-4 bg-electric-blue rounded-full border-2 border-white"></div>
          </Marker>
        ))}

        {/* Immunity Spot */}
        {immunitySpot && (
          <Marker
            longitude={immunitySpot.lng}
            latitude={immunitySpot.lat}
            anchor="center"
          >
            <div className="text-4xl" style={{ filter: 'drop-shadow(0 0 10px rgba(255,215,0,0.8))' }}>
              🛡️
            </div>
          </Marker>
        )}
      </Map>

      {/* Controls */}
      <div className="absolute bottom-0 left-0 right-0 z-10 p-4 bg-concrete bg-opacity-95 border-t-2 border-electric-blue">
        {step === 1 && (
          <div className="space-y-2">
            <div className="bg-asphalt p-3 rounded-lg">
              <p className="text-spray-white text-sm mb-2">
                ✓ Tap map to add boundary points ({boundaryPoints.length} points)
              </p>
              <p className="text-electric-blue text-xs">
                Draw the area where players can move. Need at least 3 points.
              </p>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={undoLastPoint}
                disabled={boundaryPoints.length === 0}
                className="flex-1 bg-asphalt text-spray-white py-3 rounded-lg font-bold disabled:opacity-30"
              >
                ↶ Undo
              </button>
              <button
                onClick={clearBoundary}
                disabled={boundaryPoints.length === 0}
                className="flex-1 bg-danger text-white py-3 rounded-lg font-bold disabled:opacity-30"
              >
                ✕ Clear
              </button>
            </div>

            <button
              onClick={completeBoundary}
              disabled={boundaryPoints.length < 3 || loading}
              className="w-full btn-primary disabled:opacity-50"
            >
              {loading ? 'Saving...' : `✓ Complete Boundary (${boundaryPoints.length} points)`}
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-2">
            <div className="bg-asphalt p-3 rounded-lg">
              <p className="text-spray-white text-sm mb-2">
                🛡️ {immunitySpot ? 'Immunity spot placed!' : 'Tap map to place immunity spot'}
              </p>
              <p className="text-electric-blue text-xs">
                Safe zone where hiders can't be tagged. Costs points to activate.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={skipImmunity}
                className="flex-1 bg-asphalt text-spray-white py-3 rounded-lg font-bold"
              >
                Skip →
              </button>
              <button
                onClick={placeImmunity}
                disabled={!immunitySpot || loading}
                className="flex-1 btn-primary disabled:opacity-50"
              >
                {loading ? 'Saving...' : '✓ Place Immunity'}
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-2">
            <div className="bg-asphalt p-3 rounded-lg">
              <p className="text-spray-white text-sm mb-2">
                👁️ Select one player to be the seeker
              </p>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {players.map((player) => (
                  <button
                    key={player.id}
                    onClick={() => setSelectedSeeker(player.id)}
                    className={`w-full p-2 rounded flex items-center justify-between ${
                      selectedSeeker === player.id
                        ? 'bg-hot-pink text-white'
                        : 'bg-concrete text-spray-white hover:bg-electric-blue hover:text-asphalt'
                    }`}
                  >
                    <span className="font-bold">{player.player_name}</span>
                    {selectedSeeker === player.id && <span>✓</span>}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={startGame}
              disabled={!selectedSeeker || loading}
              className="w-full btn-primary text-xl py-4 disabled:opacity-50"
            >
              {loading ? '🚀 Starting...' : '🚀 Start Game!'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}