class GeolocationService {
  constructor() {
    this.watchId = null;
    this.currentLocation = null;
    this.isTracking = false;
  }

  /**
   * Check if geolocation is supported
   */
  isSupported() {
    return 'geolocation' in navigator;
  }

  /**
   * Request location permission
   */
  async requestPermission() {
    if (!this.isSupported()) {
      throw new Error('Geolocation not supported');
    }

    try {
      const result = await navigator.permissions.query({ name: 'geolocation' });
      return result.state; // 'granted', 'prompt', or 'denied'
    } catch (error) {
      // Fallback: try to get position (will trigger permission prompt)
      return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          () => resolve('granted'),
          () => reject('denied'),
          { timeout: 10000 }
        );
      });
    }
  }

  /**
   * Get current position once
   */
  async getCurrentPosition() {
    if (!this.isSupported()) {
      throw new Error('Geolocation not supported');
    }

    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: Date.now()
          };
          this.currentLocation = location;
          resolve(location);
        },
        (error) => {
          console.error('Geolocation error:', error);
          reject(this.parseError(error));
        },
        {
          enableHighAccuracy: true,
          maximumAge: 5000,
          timeout: 15000  // ← CHANGED from 10000
        }
      );
    });
  }

  /**
   * Start continuous tracking
   */
  startTracking(onUpdate, onError) {
    if (!this.isSupported()) {
      throw new Error('Geolocation not supported');
    }

    if (this.isTracking) {
      console.warn('Already tracking');
      return;
    }

    this.watchId = navigator.geolocation.watchPosition(
      (position) => {
        const location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          heading: position.coords.heading,
          speed: position.coords.speed,
          timestamp: Date.now()
        };
        
        this.currentLocation = location;
        this.isTracking = true;
        
        if (onUpdate) {
          onUpdate(location);
        }
      },
      (error) => {
        console.error('Tracking error:', error);
        if (onError) {
          onError(this.parseError(error));
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,   // ← CHANGED from 1000
        timeout: 15000      // ← CHANGED from 5000
      }
    );

    console.log('📍 GPS tracking started');
  }

  /**
   * Stop tracking
   */
  stopTracking() {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
      this.isTracking = false;
      console.log('📍 GPS tracking stopped');
    }
  }

  /**
   * Calculate distance between two points (in meters)
   */
  calculateDistance(point1, point2) {
    const R = 6371e3; // Earth radius in meters
    const φ1 = (point1.lat * Math.PI) / 180;
    const φ2 = (point2.lat * Math.PI) / 180;
    const Δφ = ((point2.lat - point1.lat) * Math.PI) / 180;
    const Δλ = ((point2.lng - point1.lng) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  }

  /**
   * Check if point is inside polygon (for boundary checking)
   */
  isPointInBounds(point, boundary) {
    if (!boundary || !boundary.coordinates) return true;

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
  }

  /**
   * Parse geolocation error
   */
  parseError(error) {
    switch (error.code) {
      case error.PERMISSION_DENIED:
        return 'Location permission denied. Enable location in settings.';
      case error.POSITION_UNAVAILABLE:
        return 'Location unavailable. Check GPS/WiFi.';
      case error.TIMEOUT:
        return 'Location request timeout. Try again.';
      default:
        return 'Unknown location error.';
    }
  }

  /**
   * Get current location or null
   */
  getLastLocation() {
    return this.currentLocation;
  }
}

export default new GeolocationService();