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
    <header className="bg-white/85 backdrop-blur-xl border-b border-indigo-100/80 sticky top-0 z-40 shadow-xs transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-brand-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-md shadow-brand-500/25 hover:rotate-6 transition-transform cursor-pointer">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-xl tracking-tight text-slate-900">
                  Trip<span className="bg-gradient-to-r from-brand-600 via-purple-600 to-pink-500 bg-clip-text text-transparent">OS</span>
                </span>
                <span className="px-2 py-0.5 text-[10px] font-extrabold bg-gradient-to-r from-brand-50 to-purple-50 text-brand-700 rounded-full border border-brand-200/80 shadow-2xs">
                  AI Travel Suite
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium hidden sm:block">AI Travel Planner & Autonomous Recovery Engine</p>
            </div>
          </div>

          {/* AI / Agent Status Metadata Pill */}
          <div className="hidden md:flex items-center">
            <div
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold border shadow-2xs transition-all hover:scale-[1.02] cursor-default ${pillStyle}`}
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
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-white/80 hover:bg-white border border-slate-200/80 hover:border-brand-300 hover:text-brand-700 hover:shadow-xs transition-all cursor-pointer hover:scale-[1.02] active:scale-95"
              title="Saved Trips"
            >
              <Bookmark className="w-3.5 h-3.5 text-brand-600" />
              <span className="hidden sm:inline">Saved</span>
              {savedTripsCount > 0 && (
                <span className="ml-0.5 px-1.5 py-0.2 bg-gradient-to-r from-brand-600 to-purple-600 text-white rounded-full text-[10px] font-bold">
                  {savedTripsCount}
                </span>
              )}
            </button>

            <button
              onClick={onOpenHistory}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-white/80 hover:bg-white border border-slate-200/80 hover:border-brand-300 hover:text-brand-700 hover:shadow-xs transition-all cursor-pointer hover:scale-[1.02] active:scale-95"
              title="Recovery Audit Log"
            >
              <History className="w-3.5 h-3.5 text-purple-600" />
              <span className="hidden sm:inline">Recovery Log</span>
              {historyCount > 0 && (
                <span className="ml-0.5 px-1.5 py-0.2 bg-slate-800 text-white rounded-full text-[10px] font-bold">
                  {historyCount}
                </span>
              )}
            </button>

            <button
              onClick={onResetTrip}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-500 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-all cursor-pointer hover:scale-[1.02] active:scale-95"
              title="Reset to New Trip"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Reset</span>
            </button>
          </div>
        </div>

        {/* Quick Scenario Preset Pills */}
        <div className="py-2.5 border-t border-indigo-50/80 flex items-center gap-2 overflow-x-auto text-xs no-scrollbar">
          <span className="font-extrabold text-slate-400 uppercase tracking-wider text-[10px] shrink-0">
            Quick Scenarios:
          </span>
          <button
            onClick={() => onSelectScenario('scenarioA')}
            className="px-3 py-1 bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 text-indigo-700 font-bold rounded-full shrink-0 transition-all border border-indigo-200/90 shadow-2xs hover:scale-[1.03] active:scale-95 cursor-pointer"
          >
            🏔️ Scenario A (Delhi-Manali ₹20k)
          </button>
          <button
            onClick={() => onSelectScenario('scenarioB')}
            className="px-3 py-1 bg-gradient-to-r from-amber-50 to-orange-50 hover:from-amber-100 hover:to-orange-100 text-amber-800 font-bold rounded-full shrink-0 transition-all border border-amber-200/90 shadow-2xs hover:scale-[1.03] active:scale-95 cursor-pointer"
          >
            ⏱️ Scenario B (5d → 3d Reject Test)
          </button>
          <button
            onClick={() => onSelectScenario('scenarioC')}
            className="px-3 py-1 bg-gradient-to-r from-rose-50 to-pink-50 hover:from-rose-100 hover:to-pink-100 text-rose-700 font-bold rounded-full shrink-0 transition-all border border-rose-200/90 shadow-2xs hover:scale-[1.03] active:scale-95 cursor-pointer"
          >
            ❄️ Scenario C (6h Weather Disruption)
          </button>
          <button
            onClick={() => onSelectScenario('arbitraryDestination')}
            className="px-3 py-1 bg-gradient-to-r from-teal-50 to-emerald-50 hover:from-teal-100 hover:to-emerald-100 text-teal-700 font-bold rounded-full shrink-0 transition-all border border-teal-200/90 shadow-2xs hover:scale-[1.03] active:scale-95 cursor-pointer"
          >
            🌴 Arbitrary Destination (Munnar)
          </button>
        </div>
      </div>
    </header>
  );
}

