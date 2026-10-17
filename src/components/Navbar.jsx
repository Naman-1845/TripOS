import React from 'react';
import { Compass, Sparkles, History, Bookmark, RotateCcw, AlertTriangle, ShieldCheck } from 'lucide-react';
import { AIService } from '../services/aiService.js';

export default function Navbar({
  onSelectScenario,
  onOpenSavedTrips,
  onOpenHistory,
  onResetTrip,
  savedTripsCount = 0,
  historyCount = 0,
  agentStatus = null
}) {
  const aiMeta = AIService.getEngineMetadata();

  // Determine honest display status
  let pillStyle = 'bg-amber-50 border-amber-200 text-amber-800';
  let pillText = 'Offline (Local Heuristic Engine)';
  let pillTitle = 'Agent backend offline. Running client-side deterministic recovery.';
  let isLive = false;

  if (agentStatus?.isOnline) {
    if (agentStatus.mode === 'live-llm-agent') {
      pillStyle = 'bg-emerald-50 border-emerald-200 text-emerald-800';
      pillText = `Live Gemini Agent (${agentStatus.model || 'gemini-3.8-flash'})`;
      pillTitle = 'Google Gemini live function calling enabled. Secrets secured server-side.';
      isLive = true;
    } else {
      pillStyle = 'bg-blue-50 border-blue-200 text-blue-800';
      pillText = 'Server Tool Runner (Deterministic)';
      pillTitle = 'Backend connected. Running deterministic tool runner (no API key configured).';
    }
  } else if (!agentStatus) {
    isLive = aiMeta.isLiveAI;
    pillStyle = isLive ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800';
    pillText = aiMeta.mode;
    pillTitle = aiMeta.safetyNotice;
  }

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center text-white shadow-md shadow-brand-500/20">
              <Compass className="w-6 h-6 animate-spin-slow" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-xl tracking-tight text-slate-900">Trip<span className="text-brand-600">OS</span></span>
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-brand-50 text-brand-700 rounded-full border border-brand-200">
                  MVP v1.0
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">AI Travel Planner & Autonomous Recovery Engine</p>
            </div>
          </div>

          {/* AI / Agent Status Metadata Pill */}
          <div className="hidden md:flex items-center">
            <div
              className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border ${pillStyle}`}
              title={pillTitle}
            >
              {isLive ? (
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-brand-600" />
              )}
              <span>{pillText}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenSavedTrips}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
              title="Saved Trips"
            >
              <Bookmark className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Saved</span>
              {savedTripsCount > 0 && (
                <span className="ml-0.5 px-1.5 py-0.2 bg-brand-600 text-white rounded-full text-[10px]">
                  {savedTripsCount}
                </span>
              )}
            </button>

            <button
              onClick={onOpenHistory}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
              title="Recovery Audit Log"
            >
              <History className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Recovery Log</span>
              {historyCount > 0 && (
                <span className="ml-0.5 px-1.5 py-0.2 bg-slate-800 text-white rounded-full text-[10px]">
                  {historyCount}
                </span>
              )}
            </button>

            <button
              onClick={onResetTrip}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
              title="Reset to New Trip"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Reset</span>
            </button>
          </div>
        </div>

        {/* Quick Scenario Preset Pills */}
        <div className="py-2 border-t border-slate-100 flex items-center gap-2 overflow-x-auto text-xs no-scrollbar">
          <span className="font-semibold text-slate-400 uppercase tracking-wider text-[10px] shrink-0">
            Quick Scenarios:
          </span>
          <button
            onClick={() => onSelectScenario('scenarioA')}
            className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium rounded-md shrink-0 transition-colors border border-indigo-200 cursor-pointer"
          >
            Scenario A (Delhi-Manali ₹20k)
          </button>
          <button
            onClick={() => onSelectScenario('scenarioB')}
            className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 font-medium rounded-md shrink-0 transition-colors border border-amber-200 cursor-pointer"
          >
            Scenario B (5d → 3d Reject Test)
          </button>
          <button
            onClick={() => onSelectScenario('scenarioC')}
            className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-medium rounded-md shrink-0 transition-colors border border-rose-200 cursor-pointer"
          >
            Scenario C (Weather Disruption)
          </button>
          <button
            onClick={() => onSelectScenario('arbitraryDestination')}
            className="px-2.5 py-1 bg-teal-50 hover:bg-teal-100 text-teal-700 font-medium rounded-md shrink-0 transition-colors border border-teal-200 cursor-pointer"
          >
            Arbitrary Location (Munnar)
          </button>
        </div>
      </div>
    </header>
  );
}

