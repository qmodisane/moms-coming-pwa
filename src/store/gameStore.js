import { create } from 'zustand';

export const useGameStore = create((set, get) => ({
  // Player info
  playerId: null,
  playerName: localStorage.getItem('playerName') || '',
  
  // Game session
  sessionId: null,
  sessionCode: null,
  gameStatus: 'idle', // idle, lobby, setup, active, ended
  
  // Player state
  playerRole: 'hider', // hider or seeker
  playerPoints: 0,
  playerViolations: 0,
  playerLocation: null,
  
  // Game data
  players: [],
  boundary: null,
  immunitySpot: null,
  activeMission: null,
  gameSettings: null,
  
  // Communication (end game)
  messagesRemaining: 3,
  communicationEnabled: false,
  messages: [],
  
  // UI state
  showQRScanner: false,
  showQRCode: false,
  isHost: false,
  
  // Actions
  setPlayerId: (id) => {
    set({ playerId: id });
  },
  
  setPlayerName: (name) => {
    localStorage.setItem('playerName', name);
    set({ playerName: name });
  },
  
  setSession: (sessionId, sessionCode, isHost = false) => 
    set({ sessionId, sessionCode, isHost, gameStatus: 'lobby' }),
  
  setGameStatus: (status) => set({ gameStatus: status }),
  
  setPlayerRole: (role) => set({ playerRole: role }),
  
  updatePlayerLocation: (location) => set({ playerLocation: location }),
  
  updatePlayerPoints: (points) => set({ playerPoints: points }),
  
  updatePlayerViolations: (violations) => set({ playerViolations: violations }),
  
  updatePlayers: (players) => set({ players }),
  
  updateBoundary: (boundary) => set({ boundary }),
  
  updateImmunitySpot: (spot) => set({ immunitySpot: spot }),
  
  setActiveMission: (mission) => set({ activeMission: mission }),
  
  setGameSettings: (settings) => set({ gameSettings: settings }),
  
  enableCommunication: () => set({ communicationEnabled: true }),
  
  sendMessage: (message) => {
    const remaining = get().messagesRemaining;
    if (remaining > 0) {
      set({ 
        messagesRemaining: remaining - 1,
        messages: [...get().messages, message]
      });
      return true;
    }
    return false;
  },
  
  addMessage: (message) => {
    set({ messages: [...get().messages, message] });
  },
  
  toggleQRScanner: () => set({ showQRScanner: !get().showQRScanner }),
  
  toggleQRCode: () => set({ showQRCode: !get().showQRCode }),
  
  resetGame: () => set({
    playerId: null,
    sessionId: null,
    sessionCode: null,
    gameStatus: 'idle',
    playerRole: 'hider',
    playerPoints: 0,
    playerViolations: 0,
    playerLocation: null,
    players: [],
    boundary: null,
    immunitySpot: null,
    activeMission: null,
    gameSettings: null,
    messagesRemaining: 3,
    communicationEnabled: false,
    messages: [],
    isHost: false,
    showQRScanner: false,
    showQRCode: false
  })
}));
