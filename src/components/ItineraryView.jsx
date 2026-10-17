import React, { useState } from 'react';
import { Calendar, Clock, MapPin, AlertTriangle, ShieldCheck, Sun, Moon, Coffee, Info, ChevronDown, ChevronUp } from 'lucide-react';

export default function ItineraryView({
  itinerary,
  onSimulateDisruption
}) {
  const [expandedDay, setExpandedDay] = useState(1);

  if (!itinerary || !itinerary.days) return null;

  const { destination, destinationDetails, days, simulatedDisruption } = itinerary;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 mb-8">
      {/* Destination Hero Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 mb-6 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-xl font-black text-slate-900">{destination}</span>
            {destinationDetails?.state && (
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold">
                {destinationDetails.state}, {destinationDetails.country}
              </span>
            )}
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium border border-blue-200">
              {days.length} Days Itinerary
            </span>
          </div>
          <p className="text-xs text-slate-600">
            {destinationDetails?.tagline || `Custom planned journey to ${destination}`}
          </p>
        </div>

        {/* Data Source Notice */}
        <div className="text-right">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-50 border border-slate-200 text-slate-600 text-[11px] font-medium">
            <Info className="w-3.5 h-3.5 text-slate-400" />
            <span>{destinationDetails?.dataSourceNotice || 'Sample travel estimates'}</span>
          </div>
          {destinationDetails?.bestTime && (
            <div className="text-[11px] text-slate-400 mt-1">
              Best season: {destinationDetails.bestTime}
            </div>
          )}
        </div>
      </div>

      {/* Disruption Alert if active in current itinerary */}
      {simulatedDisruption?.outdoorUnsuitable && (
        <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs">
            <div className="font-bold text-amber-900 mb-0.5">
              Simulated Disruption Scenario (Demo Mode — Not a Live Weather Report)
            </div>
            <div>{simulatedDisruption.reason}</div>
            <div className="text-amber-700 mt-1 font-medium">
              TripOS has substituted affected outdoor activities with verified indoor alternatives.
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
              className={`rounded-xl border transition-all ${
                isExpanded ? 'border-brand-300 ring-2 ring-brand-50 bg-white' : 'border-slate-200 bg-slate-50/50 hover:bg-white'
              }`}
            >
              {/* Day Accordion Header */}
              <button
                type="button"
                onClick={() => setExpandedDay(isExpanded ? null : day.dayNumber)}
                className="w-full p-4 flex items-center justify-between text-left cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-brand-50 border border-brand-200 flex items-center justify-center text-brand-700 font-extrabold text-sm shrink-0">
                    D{day.dayNumber}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-brand-600">
                      {day.dateFormatted} • {day.theme}
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 mt-0.5">
                      {day.title}
                    </h3>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {day.morning?.isUnsuitable && (
                    <span className="hidden sm:inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                      Weather Rerouted
                    </span>
                  )}
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-slate-400" />
                  )}
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
    <div className={`p-3 rounded-xl border text-xs flex flex-col justify-between ${
      isDisrupted
        ? 'border-amber-300 bg-amber-50/40'
        : 'border-slate-200 bg-white'
    }`}>
      <div>
        <div className="flex items-center justify-between mb-1.5 text-slate-400">
          <div className="flex items-center gap-1.5 font-bold text-[11px] text-slate-600 uppercase tracking-wide">
            <Icon className="w-3.5 h-3.5 text-brand-600" />
            <span>{slot}</span>
          </div>
          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 font-semibold">
            {displayAct.duration || '2 hrs'}
          </span>
        </div>

        {/* If disrupted warning tag */}
        {isDisrupted && (
          <div className="mb-2 p-1.5 bg-amber-100/70 border border-amber-200 rounded text-[11px] text-amber-900">
            <div className="font-bold flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-amber-700" />
              <span>Original Disrupted: {activity.name}</span>
            </div>
            <div className="text-[10px] text-amber-800 mt-0.5">{activity.unsuitabilityReason}</div>
          </div>
        )}

        <h4 className="font-bold text-slate-900 mb-1 text-sm leading-snug">
          {displayAct.name}
        </h4>
        <p className="text-slate-500 text-[11px] leading-relaxed mb-3">
          {displayAct.description}
        </p>
      </div>

      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
          {displayAct.category}
        </span>
        <span className="font-bold text-slate-800">
          {displayAct.costPerPerson > 0 ? `₹${displayAct.costPerPerson.toLocaleString('en-IN')}/p` : 'Free'}
        </span>
      </div>
    </div>
  );
}

