const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

class ApiService {
  async request(endpoint, options = {}) {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        ...options
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Request failed');
      }

      return await response.json();
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }

  // Game endpoints
  async createGame(playerName, settings = {}) {
    return this.request('/game/create', {
      method: 'POST',
      body: JSON.stringify({
        playerName,
        gameMode: 'standard',
        settings
      })
    });
  }

  async joinGame(sessionCode, playerId, playerName) {
    return this.request('/game/join', {
      method: 'POST',
      body: JSON.stringify({
        sessionCode,
        playerId,
        playerName
      })
    });
  }

  async setBoundary(sessionId, coordinates) {
    return this.request(`/game/${sessionId}/boundary`, {
      method: 'POST',
      body: JSON.stringify({ coordinates })
    });
  }

  async setImmunitySpot(sessionId, location) {
    return this.request(`/game/${sessionId}/immunity-spot`, {
      method: 'POST',
      body: JSON.stringify({ location })
    });
  }

  async startGame(sessionId) {
    return this.request(`/game/${sessionId}/start`, {
      method: 'POST'
    });
  }

  async getGameState(sessionId) {
    return this.request(`/game/${sessionId}/state`);
  }

  async assignSeeker(sessionId, playerId) {
    return this.request(`/game/${sessionId}/assign-seeker`, {
      method: 'POST',
      body: JSON.stringify({ playerId })
    });
  }

  // Player endpoints
  async updateLocation(playerId, lat, lng, accuracy) {
    return this.request(`/player/${playerId}/location`, {
      method: 'POST',
      body: JSON.stringify({ lat, lng, accuracy })
    });
  }

  async getPlayer(playerId) {
    return this.request(`/player/${playerId}`);
  }

  async getPlayerStats(playerId) {
    return this.request(`/player/${playerId}/stats`);
  }

  // Mission endpoints
  async generateMissions(sessionId) {
    return this.request(`/mission/generate/${sessionId}`, {
      method: 'POST'
    });
  }

  async completeMission(missionId, verificationData = {}) {
    return this.request(`/mission/${missionId}/complete`, {
      method: 'POST',
      body: JSON.stringify({ verificationData })
    });
  }

  async getPlayerMissions(playerId) {
    return this.request(`/mission/player/${playerId}`);
  }
}

export default new ApiService();