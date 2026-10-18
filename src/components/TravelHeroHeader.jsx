import React from 'react';
import {
  Compass,
  MapPin,
  Calendar,
  Users,
  IndianRupee,
  Plane,
  Sparkles,
  CloudSnow,
  ShieldCheck,
  Navigation,
  Sun,
  Flame,
  ArrowRight
} from 'lucide-react';

export default function TravelHeroHeader({
  activeTrip,
  destinationDetails,
  onQuickDestinationSelect
}) {
  const isTripActive = Boolean(activeTrip && activeTrip.inputs);
  const destination = activeTrip?.inputs?.destination || 'Manali';
  const origin = activeTrip?.inputs?.origin || 'Delhi';
  const duration = activeTrip?.inputs?.duration || 5;
  const travellers = activeTrip?.inputs?.travellers || 2;
  const budget = activeTrip?.inputs?.budget || 20000;
  const remainingBudget = activeTrip?.budgetBreakdown?.remainingBudget;
  const isWeatherDisrupted = Boolean(activeTrip?.simulatedDisruption?.outdoorUnsuitable);

  const curatedHighlights = [
    { name: 'Manali', state: 'Himachal', emoji: '🏔️', tagline: 'Snow peaks & pine valleys', color: 'from-blue-500 to-indigo-600' },
    { name: 'Goa', state: 'Goa', emoji: '🏖️', tagline: 'Golden sunsets & coastal breeze', color: 'from-amber-500 to-rose-500' },
    { name: 'Jaipur', state: 'Rajasthan', emoji: '🏰', tagline: 'Royal palaces & Rajput forts', color: 'from-rose-500 to-purple-600' },
    { name: 'Mussoorie', state: 'Uttarakhand', emoji: '🌲', tagline: 'Misty hills & colonial trails', color: 'from-teal-500 to-emerald-600' },
    { name: 'Delhi', state: 'NCR', emoji: '🏛️', tagline: 'Mughal heritage & cuisine', color: 'from-indigo-500 to-blue-600' },
    { name: 'Munnar', state: 'Kerala', emoji: '🌴', tagline: 'Rolling emerald tea hills', color: 'from-emerald-500 to-teal-600' }
  ];

  return (
    <div className="relative mb-8 overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-6 sm:p-8 text-white shadow-2xl border border-indigo-800/40">
      {/* Dreamy Ambient Glowing Background Orbs */}
      <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-indigo-500/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-rose-500/20 blur-3xl" />
      <div className="pointer-events-none absolute top-1/2 left-1/3 h-56 w-56 -translate-y-1/2 rounded-full bg-cyan-500/15 blur-2xl" />

      {/* Decorative Subtle Grid Pattern */}
      <div className="pointer-events-none absolute inset-0 opacity-10 travel-dot-grid" />

      <div className="relative z-10">
        {/* Top Feature Pill */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold bg-white/10 text-indigo-200 border border-white/15 backdrop-blur-md shadow-xs">
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Autonomous Travel OS • Multi-Modal Transit & Rate Comparison</span>
          </div>

          {isWeatherDisrupted && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-xs animate-pulse">
              <CloudSnow className="w-3.5 h-3.5 text-rose-400" />
              <span>Weather Advisory Active: 6h Advance Notice</span>
            </div>
          )}
        </div>

        {/* Main Header Title & Tagline */}
        <div className="max-w-3xl">
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white mb-2 leading-tight">
            {isTripActive ? (
              <>
                Expedition to{' '}
                <span className="bg-gradient-to-r from-amber-300 via-rose-300 to-indigo-200 bg-clip-text text-transparent">
                  {destinationDetails?.name || destination}
                </span>
                {destinationDetails?.state && (
                  <span className="text-lg sm:text-2xl font-semibold text-slate-300 ml-2">
                    ({destinationDetails.state})
                  </span>
                )}
              </>
            ) : (
              <>
                Where Will Your Wanderlust Take You?{' '}
                <span className="bg-gradient-to-r from-amber-300 via-rose-300 to-cyan-300 bg-clip-text text-transparent">
                  Explore with TripOS
                </span>
              </>
            )}
          </h1>

          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-medium">
            {isTripActive ? (
              destinationDetails?.tagline ||
              'High-altitude resort haven with dramatic snow vistas, lush pine forests, and cultural heritage trails.'
            ) : (
              'Plan personalized day-by-day itineraries with multi-modal vehicle routes, live OTA stay comparisons, and autonomous self-healing recovery.'
            )}
          </p>
        </div>

        {/* Active Trip Highlights Banner Strip */}
        {isTripActive ? (
          <div className="mt-6 pt-5 border-t border-white/10 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {/* Route */}
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md hover:bg-white/10 transition-all">
              <div className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Plane className="w-3 h-3" /> Route Corridor
              </div>
              <div className="text-xs font-black text-white truncate">
                {origin} ➔ {destination}
              </div>
            </div>

            {/* Duration */}
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md hover:bg-white/10 transition-all">
              <div className="text-[10px] font-bold text-amber-300 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Trip Duration
              </div>
              <div className="text-xs font-black text-white">
                {duration} Curated Days
              </div>
            </div>

            {/* Travelers */}
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md hover:bg-white/10 transition-all">
              <div className="text-[10px] font-bold text-cyan-300 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Users className="w-3 h-3" /> Explorers
              </div>
              <div className="text-xs font-black text-white">
                {travellers} Traveler{travellers > 1 ? 's' : ''}
              </div>
            </div>

            {/* Budget */}
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md hover:bg-white/10 transition-all">
              <div className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider mb-1 flex items-center gap-1">
                <IndianRupee className="w-3 h-3" /> Total Budget
              </div>
              <div className="text-xs font-black text-white">
                ₹{budget.toLocaleString('en-IN')}
              </div>
            </div>

            {/* Stay Mode */}
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md hover:bg-white/10 transition-all">
              <div className="text-[10px] font-bold text-rose-300 uppercase tracking-wider mb-1 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> Selected Stay
              </div>
              <div className="text-xs font-black text-white truncate" title={activeTrip.selectedAccommodation?.name}>
                {activeTrip.selectedAccommodation?.name || `${activeTrip.inputs.accommodationPreference} Stay`}
              </div>
            </div>

            {/* Best Season */}
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md hover:bg-white/10 transition-all">
              <div className="text-[10px] font-bold text-purple-300 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Sun className="w-3 h-3" /> Ideal Season
              </div>
              <div className="text-xs font-black text-white truncate">
                {destinationDetails?.bestTime || 'Oct to Jun'}
              </div>
            </div>
          </div>
        ) : (
          /* Quick Inspiration Cards When No Trip Loaded Yet */
          <div className="mt-6 pt-5 border-t border-white/10">
            <div className="text-xs font-bold text-indigo-300 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              <span>Trending Destinations (Click to Plan Instantly)</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {curatedHighlights.map((dest) => (
                <button
                  key={dest.name}
                  type="button"
                  onClick={() => onQuickDestinationSelect && onQuickDestinationSelect(dest.name)}
                  className="p-2.5 rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 hover:border-white/30 backdrop-blur-md text-left transition-all hover:-translate-y-1 hover:shadow-lg cursor-pointer group"
                >
                  <div className="text-base mb-0.5 group-hover:scale-110 transition-transform">
                    {dest.emoji}
                  </div>
                  <div className="text-xs font-bold text-white group-hover:text-amber-200 transition-colors">
                    {dest.name}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">
                    {dest.state}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

