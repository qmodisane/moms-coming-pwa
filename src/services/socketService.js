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

  // Join game session
  joinGame(sessionId, playerId, playerName) {
    this.socket?.emit('game:join', {
      sessionId,
      playerId,
      playerName
    });
  }

  // Update location
  updateLocation(sessionId, playerId, location) {
    this.socket?.emit('location:update', {
      sessionId,
      playerId,
      location
    });
  }

  // Claim immunity
  claimImmunity(sessionId, playerId) {
    this.socket?.emit('immunity:claim', {
      sessionId,
      playerId
    });
  }

  // Send message
  sendMessage(sessionId, toPlayerId, message, isBroadcast = false) {
    this.socket?.emit('message:send', {
      sessionId,
      toPlayerId,
      message,
      isBroadcast
    });
  }

  // Tag player
  tagPlayer(sessionId, targetId) {
    this.socket?.emit('player:tag', {
      sessionId,
      targetId
    });
  }

  // Event listeners
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

  onGameEnded(callback) {
    this.socket?.on('game:ended', callback);
  }

  onError(callback) {
    this.socket?.on('error', callback);
  }
}

export default new SocketService();