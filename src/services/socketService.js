import { io } from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
    this.connected = false;
  }

  connect(serverUrl = 'http://localhost:3000') {
    if (this.socket?.connected) {
      return this.socket;
    }

    this.socket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      reconnectionDelay: 1000,
      reconnection: true,
      reconnectionAttempts: 10
    });

    this.socket.on('connect', () => {
      console.log('✓ Connected to game server');
      this.connected = true;
    });

    this.socket.on('disconnect', () => {
      console.log('✗ Disconnected from server');
      this.connected = false;
    });

    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
    }
  }

  // Game actions
  joinGame(sessionId, playerId, playerName) {
    this.socket?.emit('game:join', { sessionId, playerId, playerName });
  }

  updateLocation(sessionId, playerId, location) {
    this.socket?.emit('location:update', { sessionId, playerId, location });
  }

  claimImmunity(sessionId, playerId) {
    this.socket?.emit('immunity:claim', { sessionId, playerId });
  }

  completeMission(missionId, verificationData) {
    this.socket?.emit('mission:complete', { missionId, verificationData });
  }

  tagPlayer(sessionId, targetId) {
    this.socket?.emit('player:tag', { sessionId, targetId });
  }

  sendMessage(sessionId, message, toPlayerId = null, isBroadcast = true) {
    this.socket?.emit('message:send', { 
      sessionId, 
      message, 
      toPlayerId, 
      isBroadcast 
    });
  }

  transferPoints(sessionId, toPlayerId, amount) {
    this.socket?.emit('points:transfer', { sessionId, toPlayerId, amount });
  }

  // Event listeners
  onGameJoined(callback) {
    this.socket?.on('game:joined', callback);
  }

  onGameState(callback) {
    this.socket?.on('game:state', callback);
  }

  onPlayerJoined(callback) {
    this.socket?.on('player:joined', callback);
  }

  onPlayerLeft(callback) {
    this.socket?.on('player:left', callback);
  }

  onMissionAssigned(callback) {
    this.socket?.on('missions:assigned', callback);
  }

  onMissionCompleted(callback) {
    this.socket?.on('mission:completed', callback);
  }

  onMissionFailed(callback) {
    this.socket?.on('mission:failed', callback);
  }

  onViolation(callback) {
    this.socket?.on('violation:out_of_bounds', callback);
  }

  onBoundaryShrinking(callback) {
    this.socket?.on('boundary:shrinking', callback);
  }

  onBoundaryShrunk(callback) {
    this.socket?.on('boundary:shrunk', callback);
  }

  onChaosMode(callback) {
    this.socket?.on('chaos:mode_activated', callback);
  }

  onCommunicationEnabled(callback) {
    this.socket?.on('communication:enabled', callback);
  }

  onMessageReceived(callback) {
    this.socket?.on('message:received', callback);
  }

  onPointsTransferred(callback) {
    this.socket?.on('points:transferred', callback);
  }

  onPlayerTagged(callback) {
    this.socket?.on('player:tagged', callback);
  }

  onGameEnded(callback) {
    this.socket?.on('game:ended', callback);
  }

  onImmunityClaimed(callback) {
    this.socket?.on('immunity:claimed', callback);
  }

  onImmunityEjected(callback) {
    this.socket?.on('immunity:ejected', callback);
  }

  onError(callback) {
    this.socket?.on('error', callback);
  }
}

export default new SocketService();
