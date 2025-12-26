# MOM'S COMING - PWA Frontend

🎮 Progressive Web App for Mom's Coming - Real-world GPS hide and seek game

## 🚀 Features

### Core Gameplay
- ✅ **Google Maps Satellite View** - GTA-style real-world map
- ✅ **Real-time GPS Tracking** - Browser Geolocation API (5-15m accuracy)
- ✅ **QR Code Sharing** - Share app + auto-join game
- ✅ **QR Code Scanning** - Scan to join games instantly
- ✅ **Socket.IO Real-time** - Live player updates
- ✅ **PWA Installation** - Add to home screen (iOS/Android)
- ✅ **Graffiti Theme** - Street art aesthetic

### Game Features
- Live player tracking on satellite map
- Mission system with point rewards
- Immunity spot claiming
- Boundary detection & alerts
- Violation notifications
- Real-time game state updates

## 📋 Prerequisites

- Node.js 16+
- Backend server running (see `moms-coming-game/`)
- Google Maps API key

## 🛠️ Installation

```bash
# 1. Install dependencies
npm install

# 2. Setup environment
cp .env.example .env

# Edit .env and add:
# - VITE_GOOGLE_MAPS_API_KEY=your_key_here
# - VITE_API_URL=http://localhost:3000 (your backend URL)

# 3. Start development server
npm run dev
```

App runs at: http://localhost:3001

## 🔑 Get Google Maps API Key

1. Go to: https://console.cloud.google.com
2. Create/select project
3. Enable APIs:
   - Maps JavaScript API
   - Geolocation API
4. Create API Key
5. Add to `.env`

## 📱 Testing on Mobile

### Option 1: Local Network
```bash
# Start dev server
npm run dev

# Get your local IP
# Linux/Mac: ifconfig | grep inet
# Windows: ipconfig

# On phone, open: http://YOUR_IP:3001
```

### Option 2: ngrok Tunnel
```bash
# Install ngrok
npm install -g ngrok

# Run dev server
npm run dev

# In another terminal
ngrok http 3001

# Use ngrok HTTPS URL on phone
```

## 🎮 How To Play

### Host a Game:
1. Open app → Enter name
2. Click "Create Game"
3. Click "Show QR Code"
4. Friends scan QR → auto-install app + join
5. When ready → "Setup Game"
6. Play!

### Join a Game:
1. Scan host's QR code
2. App installs automatically
3. Auto-joins game lobby
4. Wait for host to start

### QR Code Flow:
```
Host creates game
  ↓
Shows QR code with URL: https://app.com/?join=123456
  ↓
Player scans QR
  ↓
Opens browser → Loads PWA
  ↓
PWA detects ?join=123456 parameter
  ↓
Auto-fills join code
  ↓
Player enters name → joins game
```

## 📁 Project Structure

```
moms-coming-pwa/
├── src/
│   ├── components/
│   │   ├── QRScanner.jsx         # Camera QR scanner
│   │   └── QRCodeDisplay.jsx     # Show game QR
│   ├── screens/
│   │   ├── HomeScreen.jsx        # Create/join game
│   │   ├── LobbyScreen.jsx       # Player waiting room
│   │   └── GameMapScreen.jsx     # Main gameplay
│   ├── services/
│   │   ├── socketService.js      # WebSocket connection
│   │   ├── apiService.js         # HTTP requests
│   │   ├── qrCodeService.js      # QR generation/parsing
│   │   └── geolocationService.js # GPS tracking
│   ├── store/
│   │   └── gameStore.js          # Zustand state
│   ├── styles/
│   │   └── index.css             # Tailwind + custom
│   ├── App.jsx                   # Main router
│   └── main.jsx                  # Entry point
├── public/
│   ├── icon-192.png              # PWA icon
│   ├── icon-512.png              # PWA icon
│   └── apple-touch-icon.png      # iOS icon
├── index.html                    # HTML template
├── vite.config.js                # Vite + PWA config
└── tailwind.config.js            # Theme config
```

## 🎨 Customizing Theme

Edit `tailwind.config.js`:

```javascript
colors: {
  'concrete': '#2C2C2C',
  'asphalt': '#0A0A0A',
  'hot-pink': '#FF006E',     // Change to your color
  'electric-blue': '#00F5FF',
  'lime': '#CCFF00',
  'gold': '#FFD700',
  'danger': '#FF3838'
}
```

## 🔧 Environment Variables

```bash
# .env file
VITE_API_URL=http://localhost:3000          # Backend URL
VITE_GOOGLE_MAPS_API_KEY=AIza...            # Google Maps key
VITE_APP_URL=http://localhost:3001          # PWA URL (for QR codes)
```

For production:
```bash
VITE_API_URL=https://api.yourserver.com
VITE_APP_URL=https://yourapp.com
```

## 📦 Building for Production

```bash
# Build optimized production bundle
npm run build

# Preview production build locally
npm run preview
```

Output in `dist/` folder.

## 🌐 Deployment

### Option 1: Netlify (Recommended for PWA)
```bash
# Install Netlify CLI
npm install -g netlify-cli

# Build
npm run build

# Deploy
netlify deploy --prod --dir=dist
```

### Option 2: Vercel
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod
```

### Option 3: GitHub Pages
```bash
# Install gh-pages
npm install -D gh-pages

# Add to package.json scripts:
"deploy": "gh-pages -d dist"

# Build and deploy
npm run build
npm run deploy
```

## 📱 PWA Installation

### Android:
1. Open app in Chrome
2. Tap menu (⋮)
3. "Add to Home Screen"
4. Icon appears on home screen

### iOS:
1. Open app in Safari
2. Tap Share button
3. "Add to Home Screen"
4. Icon appears on home screen

## 🧪 Testing

### Test GPS Tracking:
```javascript
// In browser console
navigator.geolocation.getCurrentPosition(
  pos => console.log(pos.coords),
  err => console.error(err),
  { enableHighAccuracy: true }
);
```

### Test Socket Connection:
- Open browser DevTools → Network tab
- Filter: WS (WebSocket)
- Should see connection to backend

### Test QR Code:
1. Create game → Get QR code
2. Use phone to scan QR
3. Should open app with game code filled

## 🐛 Troubleshooting

### GPS Not Working:
- **Browser permission**: Allow location access
- **HTTPS required**: iOS Safari requires HTTPS for geolocation
- **Indoor accuracy**: GPS weak indoors, use WiFi positioning

### QR Scanner Not Working:
- **Camera permission**: Allow camera access
- **HTTPS required**: Camera API requires HTTPS (except localhost)
- **iOS Safari**: May need additional permissions

### Map Not Loading:
- **API Key**: Check Google Maps API key is valid
- **API Enabled**: Maps JavaScript API must be enabled
- **Billing**: Google requires billing enabled (free tier available)

### Socket Connection Failed:
- **Backend running**: Make sure backend server is running
- **CORS**: Backend must allow frontend origin
- **Firewall**: Check firewall allows WebSocket connections

## 🚀 Performance Tips

### Reduce Data Usage:
```javascript
// In geolocationService.js
// Increase maximumAge for less frequent updates
{ enableHighAccuracy: true, maximumAge: 3000 }
```

### Battery Optimization:
```javascript
// Reduce GPS polling in lobby
if (gameStatus === 'lobby') {
  options.maximumAge = 10000; // 10 sec updates
}
```

### Map Performance:
```javascript
// Reduce marker count
// Only show nearby players (<100m)
```

## 🔐 Security Notes

- Never commit `.env` file
- Keep API keys secret
- Use environment variables for all sensitive data
- Enable API key restrictions in Google Cloud
- HTTPS in production (required for geolocation)

## 📊 PWA Features

✅ **Installable** - Add to home screen
✅ **Offline-ready** - Service worker caches assets
✅ **Fast** - Vite optimized build
✅ **Responsive** - Works on all screen sizes
✅ **Native feel** - Fullscreen, no browser UI

## 🔄 Updates

PWA updates automatically when you:
1. Build new version
2. Deploy to server
3. User refreshes app

Service worker caches are auto-updated.

## 🎯 Next Steps

- [ ] Add boundary drawing screen
- [ ] Add end-game communication UI
- [ ] Add statistics page
- [ ] Add game replay
- [ ] Add sound effects
- [ ] Add haptic feedback
- [ ] Improve offline support

## 📝 License

MIT License - See LICENSE file

## 🆘 Support

Issues? Check:
1. Backend is running
2. Environment variables are set
3. Google Maps API key is valid
4. Browser console for errors

## 🎮 Game Flow

```
1. Home Screen
   ↓ Create/Join
2. Lobby Screen
   ↓ Setup Game
3. Boundary Drawing (TODO)
   ↓ Start Game
4. Game Map Screen
   ↓ Game Ends
5. Results Screen (TODO)
```

---

**Built with:**
- React 18
- Vite 5
- Google Maps JavaScript API
- Socket.IO Client
- Tailwind CSS
- Zustand (State)

**Created by Q**
**December 2024**

🇿🇦 Made in South Africa
