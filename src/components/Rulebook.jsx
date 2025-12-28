import { useState } from 'react';

export default function Rulebook({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('overview');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-concrete rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-concrete border-b-2 border-electric-blue p-6 rounded-t-2xl">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-3xl font-graffiti text-hot-pink mb-1">
                📖 GAME RULES
              </h2>
              <p className="text-electric-blue text-sm font-condensed">
                How to play Mom's Coming
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-spray-white hover:text-hot-pink text-3xl"
            >
              ✕
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mt-4 overflow-x-auto">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-colors ${
                activeTab === 'overview'
                  ? 'bg-hot-pink text-white'
                  : 'bg-asphalt text-spray-white hover:bg-electric-blue hover:text-asphalt'
              }`}
            >
              📋 Overview
            </button>
            <button
              onClick={() => setActiveTab('setup')}
              className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-colors ${
                activeTab === 'setup'
                  ? 'bg-hot-pink text-white'
                  : 'bg-asphalt text-spray-white hover:bg-electric-blue hover:text-asphalt'
              }`}
            >
              🎮 Setup
            </button>
            <button
              onClick={() => setActiveTab('gameplay')}
              className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-colors ${
                activeTab === 'gameplay'
                  ? 'bg-hot-pink text-white'
                  : 'bg-asphalt text-spray-white hover:bg-electric-blue hover:text-asphalt'
              }`}
            >
              ⚡ Gameplay
            </button>
            <button
              onClick={() => setActiveTab('tips')}
              className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-colors ${
                activeTab === 'tips'
                  ? 'bg-hot-pink text-white'
                  : 'bg-asphalt text-spray-white hover:bg-electric-blue hover:text-asphalt'
              }`}
            >
              💡 Tips
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-4 text-spray-white">
              <div className="bg-asphalt p-4 rounded-lg border-l-4 border-hot-pink">
                <h3 className="text-xl font-graffiti text-hot-pink mb-2">
                  🎯 Game Objective
                </h3>
                <p className="text-sm leading-relaxed">
                  <strong>Hiders:</strong> Survive by staying hidden, completing missions, and avoiding the seeker within the game boundary.
                </p>
                <p className="text-sm leading-relaxed mt-2">
                  <strong>Seeker:</strong> Track down and tag all hiders using GPS before time runs out.
                </p>
              </div>

              <div className="bg-asphalt p-4 rounded-lg border-l-4 border-electric-blue">
                <h3 className="text-xl font-graffiti text-electric-blue mb-2">
                  👥 Players
                </h3>
                <p className="text-sm leading-relaxed">
                  • Minimum: 3 players (1 seeker, 2+ hiders)<br/>
                  • Maximum: Unlimited (but 4-10 works best)<br/>
                  • One player is designated as the <strong>seeker</strong>, all others are <strong>hiders</strong>
                </p>
              </div>

              <div className="bg-asphalt p-4 rounded-lg border-l-4 border-lime">
                <h3 className="text-xl font-graffiti text-lime mb-2">
                  🗺️ Real GPS Tracking
                </h3>
                <p className="text-sm leading-relaxed">
                  This isn't virtual - you're actually moving in the real world! Your phone's GPS tracks your location and shows it to other players in real-time.
                </p>
              </div>
            </div>
          )}

          {/* Setup Tab */}
          {activeTab === 'setup' && (
            <div className="space-y-4 text-spray-white">
              <div className="bg-asphalt p-4 rounded-lg">
                <h3 className="text-xl font-graffiti text-hot-pink mb-3">
                  📍 Step 1: Create Game
                </h3>
                <ol className="list-decimal list-inside space-y-2 text-sm ml-2">
                  <li>Host enters their name and clicks <strong>"Create Game"</strong></li>
                  <li>Game generates a unique 6-digit code</li>
                  <li>Host shares QR code or game code with friends</li>
                </ol>
              </div>

              <div className="bg-asphalt p-4 rounded-lg">
                <h3 className="text-xl font-graffiti text-electric-blue mb-3">
                  🎯 Step 2: Set Boundary
                </h3>
                <ol className="list-decimal list-inside space-y-2 text-sm ml-2">
                  <li>Host draws the game boundary on the map</li>
                  <li>This defines the play area (e.g., neighborhood, park, campus)</li>
                  <li>Players must stay within this boundary</li>
                  <li>Boundary shrinks over time to increase intensity!</li>
                </ol>
              </div>

              <div className="bg-asphalt p-4 rounded-lg">
                <h3 className="text-xl font-graffiti text-lime mb-3">
                  🛡️ Step 3: Set Immunity Spot (Optional)
                </h3>
                <p className="text-sm mb-2">
                  Host can place an immunity spot - a safe zone where hiders can't be tagged.
                </p>
                <ul className="list-disc list-inside space-y-1 text-sm ml-2">
                  <li>Costs points to activate</li>
                  <li>Drains points while occupied</li>
                  <li>Strategic use is key!</li>
                </ul>
              </div>

              <div className="bg-asphalt p-4 rounded-lg">
                <h3 className="text-xl font-graffiti text-gold mb-3">
                  👤 Step 4: Assign Seeker
                </h3>
                <p className="text-sm">
                  Host assigns one player as the seeker. All others become hiders. Choose wisely - the seeker needs to be fast and strategic!
                </p>
              </div>

              <div className="bg-asphalt p-4 rounded-lg">
                <h3 className="text-xl font-graffiti text-hot-pink mb-3">
                  🚀 Step 5: Start Game
                </h3>
                <p className="text-sm">
                  Once everyone is ready, host clicks <strong>"Start Game"</strong> and the chase begins! Hiders get a 30-second head start.
                </p>
              </div>
            </div>
          )}

          {/* Gameplay Tab */}
          {activeTab === 'gameplay' && (
            <div className="space-y-4 text-spray-white">
              <div className="bg-asphalt p-4 rounded-lg border-l-4 border-lime">
                <h3 className="text-xl font-graffiti text-lime mb-3">
                  🏃 For Hiders
                </h3>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-lime">•</span>
                    <span><strong>Stay Hidden:</strong> Move around within the boundary to avoid the seeker</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-lime">•</span>
                    <span><strong>Complete Missions:</strong> Earn points by completing challenges (e.g., reach a location, take a photo)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-lime">•</span>
                    <span><strong>Use Immunity:</strong> Spend points to activate safe zones</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-lime">•</span>
                    <span><strong>Monitor Map:</strong> Watch the seeker's location (shown in red)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-lime">•</span>
                    <span><strong>Stay in Bounds:</strong> Going outside = penalty or automatic catch</span>
                  </li>
                </ul>
              </div>

              <div className="bg-asphalt p-4 rounded-lg border-l-4 border-hot-pink">
                <h3 className="text-xl font-graffiti text-hot-pink mb-3">
                  👁️ For Seeker
                </h3>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-hot-pink">•</span>
                    <span><strong>Track Hiders:</strong> See all hiders' locations on the map</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-hot-pink">•</span>
                    <span><strong>Get Close:</strong> Move within tagging range (30 meters)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-hot-pink">•</span>
                    <span><strong>Tag to Catch:</strong> Tap the "Tag" button when close enough</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-hot-pink">•</span>
                    <span><strong>Strategy:</strong> Predict movements, cut them off, herd them toward boundaries</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-hot-pink">•</span>
                    <span><strong>Win Condition:</strong> Catch ALL hiders before time runs out</span>
                  </li>
                </ul>
              </div>

              <div className="bg-asphalt p-4 rounded-lg border-l-4 border-electric-blue">
                <h3 className="text-xl font-graffiti text-electric-blue mb-3">
                  ⚡ Game Mechanics
                </h3>
                <ul className="space-y-2 text-sm">
                  <li><strong>⏱️ Duration:</strong> Games last 30-60 minutes (set by host)</li>
                  <li><strong>📉 Shrinking Boundary:</strong> Play area gets smaller every 10 minutes</li>
                  <li><strong>🎯 Missions:</strong> Random challenges appear every 5 minutes</li>
                  <li><strong>💰 Points System:</strong> Earn by completing missions, surviving, helping teammates</li>
                  <li><strong>📱 Communication:</strong> Limited to final phase only (adds to tension!)</li>
                </ul>
              </div>

              <div className="bg-asphalt p-4 rounded-lg border-l-4 border-gold">
                <h3 className="text-xl font-graffiti text-gold mb-3">
                  🏆 Winning
                </h3>
                <p className="text-sm mb-2"><strong>Hiders win if:</strong></p>
                <ul className="list-disc list-inside space-y-1 text-sm ml-2 mb-3">
                  <li>Time runs out with at least 1 hider uncaught</li>
                  <li>Highest point total among survivors</li>
                </ul>
                <p className="text-sm mb-2"><strong>Seeker wins if:</strong></p>
                <ul className="list-disc list-inside space-y-1 text-sm ml-2">
                  <li>All hiders are tagged before time expires</li>
                </ul>
              </div>
            </div>
          )}

          {/* Tips Tab */}
          {activeTab === 'tips' && (
            <div className="space-y-4 text-spray-white">
              <div className="bg-asphalt p-4 rounded-lg border-l-4 border-lime">
                <h3 className="text-xl font-graffiti text-lime mb-3">
                  💡 Hider Pro Tips
                </h3>
                <ul className="space-y-2 text-sm">
                  <li>🏃 <strong>Keep moving!</strong> Standing still makes you an easy target</li>
                  <li>🗺️ <strong>Use terrain:</strong> Buildings, alleys, and obstacles block line of sight</li>
                  <li>⚡ <strong>Complete early missions:</strong> Build up points for immunity later</li>
                  <li>👥 <strong>Coordinate with other hiders:</strong> Split up or group strategically</li>
                  <li>⏰ <strong>Watch the clock:</strong> Play it safe in final minutes</li>
                  <li>📍 <strong>Know the boundary:</strong> Plan escape routes before you need them</li>
                  <li>🛡️ <strong>Save immunity:</strong> Don't waste it early - use when cornered</li>
                </ul>
              </div>

              <div className="bg-asphalt p-4 rounded-lg border-l-4 border-hot-pink">
                <h3 className="text-xl font-graffiti text-hot-pink mb-3">
                  🎯 Seeker Pro Tips
                </h3>
                <ul className="space-y-2 text-sm">
                  <li>👁️ <strong>Focus on one target:</strong> Chasing multiple = catching none</li>
                  <li>🔮 <strong>Predict movements:</strong> Where would YOU go? Cut them off!</li>
                  <li>🧭 <strong>Use the shrinking boundary:</strong> Herd hiders toward edges</li>
                  <li>⏱️ <strong>Manage your time:</strong> Prioritize closest/slowest hiders first</li>
                  <li>🏃‍♂️ <strong>Sprint strategically:</strong> Save energy for final chase</li>
                  <li>🚧 <strong>Create traps:</strong> Position yourself between hider and escape routes</li>
                  <li>📊 <strong>Check point totals:</strong> Target high-scoring hiders first</li>
                </ul>
              </div>

              <div className="bg-asphalt p-4 rounded-lg border-l-4 border-electric-blue">
                <h3 className="text-xl font-graffiti text-electric-blue mb-3">
                  ⚠️ Safety & Etiquette
                </h3>
                <ul className="space-y-2 text-sm">
                  <li>⚠️ <strong>Stay safe:</strong> Don't enter dangerous areas or private property</li>
                  <li>🚦 <strong>Follow laws:</strong> Obey traffic signals, stay on sidewalks</li>
                  <li>🔋 <strong>Charge phones:</strong> GPS drains battery fast - bring a power bank</li>
                  <li>☀️ <strong>Check weather:</strong> Bring water, sunscreen, appropriate clothing</li>
                  <li>📞 <strong>Emergency contact:</strong> Have a backup communication method</li>
                  <li>👥 <strong>Play fair:</strong> No cheating, no hiding your phone, no turning off GPS</li>
                  <li>🌙 <strong>Daylight games:</strong> Play during daytime for safety and visibility</li>
                </ul>
              </div>

              <div className="bg-asphalt p-4 rounded-lg border-l-4 border-gold">
                <h3 className="text-xl font-graffiti text-gold mb-3">
                  🎮 Game Variations
                </h3>
                <ul className="space-y-2 text-sm">
                  <li>🏙️ <strong>Urban Mode:</strong> Smaller area, more obstacles, faster pace</li>
                  <li>🌳 <strong>Park Mode:</strong> Larger area, longer duration, more stealth</li>
                  <li>🏫 <strong>Campus Mode:</strong> Use buildings, limited communication zones</li>
                  <li>🌃 <strong>Night Mode:</strong> Reduced visibility, high tension (be careful!)</li>
                  <li>⏱️ <strong>Speed Run:</strong> 15 minutes, small area, intense action</li>
                  <li>👥 <strong>Team Mode:</strong> Multiple seekers vs hiders</li>
                </ul>
              </div>
            </div>
          )}

          {/* Close Button */}
          <button
            onClick={onClose}
            className="w-full mt-6 btn-primary"
          >
            Got It! Let's Play 🎮
          </button>
        </div>
      </div>
    </div>
  );
}