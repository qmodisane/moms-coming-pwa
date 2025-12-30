import { io } from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
    this.connected = false;
  }

  connect(url) {
    if (this.socket) return;

    this.socket = io(url, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    this.socket.on('connect', () => {
      console.log('🔌 Connected to server');
      this.connected = true;
    });

    this.socket.on('disconnect', () => {
      console.log('🔌 Disconnected from server');
      this.connected = false;
    });

    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
    }
  }

  // Emit events
  joinGame(sessionId, playerId, playerName) {
    this.socket?.emit('game:join', { sessionId, playerId, playerName });
  }

  updateLocation(sessionId, playerId, location) {
    this.socket?.emit('location:update', { sessionId, playerId, location });
  }

  claimImmunity(sessionId, playerId) {
    this.socket?.emit('immunity:claim', { sessionId, playerId });
  }

  sendMessage(sessionId, toPlayerId, message, isBroadcast = false) {
    this.socket?.emit('message:send', { sessionId, toPlayerId, message, isBroadcast });
  }

  tagPlayer(sessionId, targetId) {
    this.socket?.emit('player:tag', { sessionId, targetId });
  }

  completeMission(missionId, verificationData) {
    this.socket?.emit('mission:complete', { missionId, verificationData });
  }

  transferPoints(sessionId, toPlayerId, amount) {
    this.socket?.emit('points:transfer', { sessionId, toPlayerId, amount });
  }

  // Listen to events
  onGameJoined(callback) {
    this.socket?.on('game:joined', callback);
  }

  onGameStarted(callback) {
    this.socket?.on('game:started', callback);
  }

  onSeekerAssigned(callback) {
    this.socket?.on('seeker:assigned', callback);
  }

  onBoundarySet(callback) {
    this.socket?.on('boundary:set', callback);
  }

  onImmunityPlaced(callback) {
    this.socket?.on('immunity:placed', callback);
  }

  onPlayerJoined(callback) {
    this.socket?.on('player:joined', callback);
  }

  onPlayerLeft(callback) {
    this.socket?.on('player:left', callback);
  }

  onPlayerTagged(callback) {
    this.socket?.on('player:tagged', callback);
  }

  onGameState(callback) {
    this.socket?.on('game:state', callback);
  }

  onBoundaryShrinking(callback) {
    this.socket?.on('boundary:shrinking', callback);
  }

  onBoundaryShrunk(callback) {
    this.socket?.on('boundary:shrunk', callback);
  }

  onViolation(callback) {
    this.socket?.on('violation', callback);
  }

  onMessageReceived(callback) {
    this.socket?.on('message:received', callback);
  }

  onImmunityClaimed(callback) {
    this.socket?.on('immunity:claimed', callback);
  }

  onPointsTransferred(callback) {
    this.socket?.on('points:transferred', callback);
  }

  onMissionCompleted(callback) {
    this.socket?.on('mission:completed', callback);
  }

  onGameEnded(callback) {
    this.socket?.on('game:ended', callback);
  }

  onError(callback) {
    this.socket?.on('error', callback);
  }
}

export default new SocketService();