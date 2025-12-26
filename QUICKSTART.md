# ⚡ PWA QUICK START

Get the Mom's Coming PWA running in 5 minutes!

## Prerequisites Check

- ✅ Backend server running (see `moms-coming-game/`)
- ✅ Node.js 16+ installed
- ✅ Google Maps API key ready

## 3-Step Setup

### 1. Install
```bash
cd moms-coming-pwa
npm install
```

### 2. Configure
```bash
# Copy environment template
cp .env.example .env

# Edit .env
nano .env  # or code .env
```

Add your keys:
```bash
VITE_API_URL=http://localhost:3000
VITE_GOOGLE_MAPS_API_KEY=your_key_here
VITE_APP_URL=http://localhost:3001
```

### 3. Run
```bash
npm run dev
```

Open: http://localhost:3001

## ✅ Test It Works

1. **Create Game**
   - Enter name → "Create Game"
   - Should get 6-digit code

2. **Show QR Code**
   - Click "Show QR Code"
   - QR displays with game code

3. **Test on Phone** (optional)
   - Get your local IP: `ipconfig` / `ifconfig`
   - On phone: `http://YOUR_IP:3001`
   - Scan QR → auto-joins

## 🎯 First Game Test

### Setup:
1. Open 2 browser tabs
2. Tab 1: Create game (Host)
3. Tab 2: Join with code (Player)
4. Host clicks "Setup Game"
5. Both should see map

## 📱 Mobile Testing

### Quick Method (Same WiFi):
```bash
# 1. Start dev server
npm run dev

# 2. Find your IP
ipconfig  # Windows
ifconfig  # Mac/Linux

# 3. On phone browser
http://192.168.X.X:3001
```

### Production Method (ngrok):
```bash
# Install ngrok
npm install -g ngrok

# Start app
npm run dev

# New terminal
ngrok http 3001

# Use HTTPS URL on phone
```

## 🚨 Common Issues

**"Map not loading"**
→ Check Google Maps API key in `.env`

**"Can't connect to server"**
→ Make sure backend is running on port 3000

**"GPS not working"**
→ Browser needs location permission

**"QR scanner not opening"**
→ Camera permission required (HTTPS on production)

## 🎮 How To Use QR Feature

### As Host:
1. Create game
2. Click "Show QR Code"
3. Friends scan with phone camera
4. They get app + auto-join

### As Player:
1. Open camera app
2. Point at host's QR code
3. Tap notification
4. App opens with code filled
5. Enter name → join

## 🔧 Environment Variables

```bash
# Backend API
VITE_API_URL=http://localhost:3000

# Google Maps
VITE_GOOGLE_MAPS_API_KEY=AIza...

# PWA URL (for QR codes)
VITE_APP_URL=http://localhost:3001
```

## 📦 Build Production

```bash
# Build
npm run build

# Test build
npm run preview

# Deploy to Netlify
netlify deploy --prod --dir=dist
```

## ✨ Features Working

- ✅ Create/Join games
- ✅ QR code generation
- ✅ QR code scanning  
- ✅ Real-time player list
- ✅ Google Maps satellite view
- ✅ GPS tracking
- ✅ Socket.IO connection
- ✅ PWA installation
- ✅ Graffiti theme

## 🎯 Next: Full Game

To play complete game:
1. Need 2+ players
2. Host sets boundary
3. Game starts
4. Complete missions
5. Track on map

## 📚 Full Docs

See `README.md` for:
- Complete feature list
- Detailed setup
- Deployment guides
- Troubleshooting
- API reference

---

**Ready in 5 minutes!** 🚀

Questions? Check README.md or backend docs.
