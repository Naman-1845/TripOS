import React, { useState } from 'react';
import { Calendar, Clock, MapPin, AlertTriangle, ShieldCheck, Sun, Moon, Coffee, Info, ChevronDown, ChevronUp, Navigation, Car, Bike, Footprints, Bus, ArrowRight } from 'lucide-react';

export default function ItineraryView({
  itinerary,
  onSimulateDisruption
}) {
  const [expandedDay, setExpandedDay] = useState(1);

  if (!itinerary || !itinerary.days) return null;

  const { destination, destinationDetails, days, simulatedDisruption } = itinerary;

  return (
    <div className="travel-glass-card rounded-3xl p-6 sm:p-8 mb-8 relative overflow-hidden transition-all duration-300">
      {/* Decorative gradient top accent line */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-500" />

      {/* Destination Hero Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 mb-6 border-b border-indigo-100/60">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-2xl font-black text-slate-900 tracking-tight">{destination}</span>
            {destinationDetails?.state && (
              <span className="text-xs px-3 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold border border-slate-200">
                {destinationDetails.state}, {destinationDetails.country}
              </span>
            )}
            <span className="text-xs px-3 py-0.5 rounded-full bg-gradient-to-r from-blue-50 to-indigo-50 text-indigo-700 font-extrabold border border-indigo-200 shadow-2xs">
              {days.length} Days Planned Journey
            </span>
          </div>
          <p className="text-xs text-slate-500">
            {destinationDetails?.tagline || `Custom planned journey to ${destination}`}
          </p>
        </div>

        {/* Data Source Notice */}
        <div className="text-right">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/80 border border-slate-200/80 text-slate-600 text-[11px] font-semibold shadow-2xs">
            <Info className="w-3.5 h-3.5 text-indigo-500" />
            <span>{destinationDetails?.dataSourceNotice || 'Sample travel estimates'}</span>
          </div>
          {destinationDetails?.bestTime && (
            <div className="text-[11px] text-slate-400 mt-1">
              Best season: {destinationDetails.bestTime}
            </div>
          )}
        </div>
      </div>

      {/* Disruption Alert if active in current itinerary with 6h advance notice */}
      {simulatedDisruption?.outdoorUnsuitable && (
        <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border-2 border-amber-500/30 text-amber-950 flex items-start gap-3.5 shadow-2xs backdrop-blur-xs">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/20 flex items-center justify-center shrink-0 text-amber-700 shadow-xs">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="text-xs flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="font-extrabold text-amber-950 text-sm">
                Early Weather Disruption Alert (6-Hour Advance Notice)
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-200 text-amber-950 border border-amber-300 shadow-2xs">
                Issued 6h Prior to Onset
              </span>
            </div>
            <div className="text-amber-900/90 font-medium mb-2 leading-relaxed">
              {simulatedDisruption.reason}
            </div>
            <div className="p-2.5 rounded-xl bg-white/90 border border-amber-200/80 text-amber-950 text-[11px] font-bold flex items-center gap-2 shadow-2xs">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                TripOS pre-emptively rerouted all affected outdoor excursions to safe, sheltered indoor alternatives 6 hours in advance.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Day by Day List */}
      <div className="space-y-4">
        {days.map((day) => {
          const isExpanded = expandedDay === day.dayNumber;

          return (
            <div
              key={day.dayNumber}
              className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                isExpanded
                  ? 'border-indigo-400/80 ring-2 ring-indigo-100 bg-white shadow-md'
                  : 'border-slate-200/90 bg-white/70 hover:bg-white hover:border-indigo-200 hover:-translate-y-0.5 shadow-2xs'
              }`}
            >
              {/* Day Accordion Header */}
              <button
                type="button"
                onClick={() => setExpandedDay(isExpanded ? null : day.dayNumber)}
                className="w-full p-4 sm:p-5 flex items-center justify-between text-left cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center font-black text-sm shadow-md shadow-indigo-500/20 shrink-0">
                    D{day.dayNumber}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-indigo-600 uppercase tracking-wider">
                      {day.dateFormatted} • {day.theme}
                    </div>
                    <h3 className="text-sm sm:text-base font-extrabold text-slate-900 mt-0.5">
                      {day.title}
                    </h3>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {day.morning?.isUnsuitable && (
                    <span className="hidden sm:inline-block px-2.5 py-1 rounded-lg text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                      Weather Rerouted
                    </span>
                  )}
                  <div className={`p-1.5 rounded-xl transition-all ${isExpanded ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5" />
                    ) : (
                      <ChevronDown className="w-5 h-5" />
                    )}
                  </div>
                </div>
              </button>

              {/* Day Expanded Details */}
              {isExpanded && (
                <div className="p-4 pt-0 border-t border-slate-100 mt-2 space-y-4">
                  {/* Activity Blocks */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3">
                    {/* Morning */}
                    <ActivityCard
                      slot="Morning"
                      icon={Coffee}
                      activity={day.morning}
                    />

                    {/* Afternoon */}
                    <ActivityCard
                      slot="Afternoon"
                      icon={Sun}
                      activity={day.afternoon}
                    />

                    {/* Evening */}
                    <ActivityCard
                      slot="Evening"
                      icon={Moon}
                      activity={day.evening}
                    />
                  </div>

                  {/* Meals */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-700">Lunch Suggestion:</span>
                      <span className="text-slate-600 font-medium">{day.meals.lunch.name}</span>
                      <span className="text-[10px] text-slate-400 font-normal">({day.meals.lunch.cuisine})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-700">Dinner Suggestion:</span>
                      <span className="text-slate-600 font-medium">{day.meals.dinner.name}</span>
                      <span className="text-[10px] text-slate-400 font-normal">({day.meals.dinner.cuisine})</span>
                    </div>
                  </div>

                  {/* Transit Routes & Vehicle Options for Each Leg */}
                  {day.dailyTransitRoutes && day.dailyTransitRoutes.length > 0 && (
                    <DailyTransitRouteSection
                      routes={day.dailyTransitRoutes}
                      dayNumber={day.dayNumber}
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ActivityCard({ slot, icon: Icon, activity }) {
  if (!activity) return null;

  const isDisrupted = activity.isUnsuitable;
  const displayAct = isDisrupted ? activity.replacementActivity : activity;

  return (
    <div className={`p-4 rounded-2xl border text-xs flex flex-col justify-between hover-lift transition-all duration-200 shadow-2xs ${
      isDisrupted
        ? 'border-amber-300/80 bg-gradient-to-b from-amber-50/60 to-white/90'
        : 'border-slate-200/80 bg-gradient-to-b from-slate-50/30 to-white hover:border-indigo-200'
    }`}>
      <div>
        <div className="flex items-center justify-between mb-2 text-slate-400">
          <div className="flex items-center gap-1.5 font-bold text-[11px] text-indigo-700 uppercase tracking-wider">
            <Icon className="w-3.5 h-3.5 text-indigo-600" />
            <span>{slot}</span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-md bg-white border border-slate-200/80 text-slate-600 font-bold shadow-2xs">
            {displayAct.duration || '2 hrs'}
          </span>
        </div>

        {/* If disrupted warning tag */}
        {isDisrupted && (
          <div className="mb-2.5 p-2 bg-amber-100/80 border border-amber-300/80 rounded-xl text-[11px] text-amber-950 shadow-2xs">
            <div className="font-extrabold flex items-center gap-1 text-amber-900">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
              <span>Original Disrupted: {activity.name}</span>
            </div>
            <div className="text-[10px] text-amber-900/90 mt-0.5 leading-relaxed">{activity.unsuitabilityReason}</div>
          </div>
        )}

        <h4 className="font-extrabold text-slate-900 mb-1 text-sm leading-snug">
          {displayAct.name}
        </h4>
        <p className="text-slate-500 text-[11px] leading-relaxed mb-3">
          {displayAct.description}
        </p>
      </div>

      <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
        <span className="px-2.5 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 font-bold border border-indigo-100">
          {displayAct.category}
        </span>
        <span className="font-black text-slate-900">
          {displayAct.costPerPerson > 0 ? `₹${displayAct.costPerPerson.toLocaleString('en-IN')}/p` : 'Free'}
        </span>
      </div>
    </div>
  );
}

function DailyTransitRouteSection({ routes = [], dayNumber = 1 }) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedLegIndex, setSelectedLegIndex] = useState(0);

  if (!routes || routes.length === 0) return null;

  const currentLeg = routes[selectedLegIndex] || routes[0];

  const getVehicleIcon = (type = '') => {
    const t = type.toLowerCase();
    if (t.includes('cab') || t.includes('taxi')) return Car;
    if (t.includes('scooter') || t.includes('two-wheeler')) return Bike;
    if (t.includes('walk') || t.includes('pedestrian')) return Footprints;
    return Bus;
  };

  return (
    <div className="mt-4 rounded-2xl border border-indigo-200/80 bg-gradient-to-br from-indigo-50/50 via-sky-50/30 to-white p-4 sm:p-5 shadow-2xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-sky-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-indigo-500/20">
            <Navigation className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-wide">
                Day {dayNumber} Routes & Vehicle Options
              </h4>
              <span className="px-2 py-0.2 rounded-full text-[10px] font-extrabold bg-indigo-100 text-indigo-800 border border-indigo-200">
                {routes.length} Legs Available
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Multi-modal routes & vehicle comparisons from hotel to all scheduled visit points.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="text-xs font-bold text-indigo-700 hover:text-indigo-900 bg-white border border-indigo-200 px-3.5 py-1.5 rounded-xl shadow-2xs hover:bg-indigo-50/80 transition-all flex items-center gap-1.5 self-start sm:self-auto cursor-pointer hover:scale-105 active:scale-95"
        >
          <span>{isOpen ? 'Hide Route Comparisons' : 'Explore Vehicle Options'}</span>
          {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {isOpen && (
        <div className="mt-4 pt-3 border-t border-indigo-100 space-y-3">
          {/* Leg Selector Tabs */}
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {routes.map((leg, idx) => {
              const isSelected = idx === selectedLegIndex;
              const legShortLabels = ['Hotel ➔ Morning', 'Morning ➔ Afternoon', 'Afternoon ➔ Evening', 'Evening ➔ Return to Hotel'];
              const subLabel = legShortLabels[idx] || `Step ${idx + 1}`;
              return (
                <button
                  key={leg.legId || idx}
                  type="button"
                  onClick={() => setSelectedLegIndex(idx)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all flex items-center gap-1.5 cursor-pointer hover:scale-105 active:scale-95 ${
                    isSelected
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span className="font-extrabold">Leg {idx + 1}:</span>
                  <span>{subLabel}</span>
                  <span className={`text-[10px] ${isSelected ? 'text-indigo-200' : 'text-slate-400'}`}>
                    ({leg.approxDistanceKm} km)
                  </span>
                </button>
              );
            })}
          </div>

          {/* Active Leg Detail Banner */}
          <div className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                <MapPin className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span>{currentLeg.legTitle}</span>
              </div>
              <span className="text-[11px] font-semibold text-slate-500">
                Est. Distance: <strong className="text-slate-800">{currentLeg.approxDistanceKm} km</strong>
              </span>
            </div>

            <div className="text-[11px] font-semibold text-slate-500 mb-2">
              Available vehicle options & transit alternatives for this journey segment:
            </div>

            {/* Vehicle Options Grid for this leg */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-1">
              {currentLeg.vehicleOptions?.map((veh, i) => {
                const Icon = getVehicleIcon(veh.vehicleType);
                return (
                  <div
                    key={i}
                    className={`p-3 rounded-xl border text-xs flex flex-col justify-between hover-lift transition-all ${
                      veh.isRecommended
                        ? 'border-emerald-300 bg-gradient-to-b from-emerald-50/60 to-white/90 ring-1 ring-emerald-400/30 shadow-2xs'
                        : 'border-slate-200/90 bg-white hover:border-indigo-200 shadow-2xs'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1.5 font-bold text-slate-800">
                          <Icon className={`w-3.5 h-3.5 ${veh.isRecommended ? 'text-emerald-600' : 'text-slate-600'}`} />
                          <span>{veh.vehicleType}</span>
                        </div>
                        {veh.isRecommended && (
                          <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            Recommended
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mb-2">
                        {veh.routeSummary}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                      <span className="text-slate-600 font-semibold">
                        ⏱ {veh.duration}
                      </span>
                      <span className="font-black text-slate-900">
                        {veh.fareLabel}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


