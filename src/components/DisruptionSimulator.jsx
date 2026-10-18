import React from 'react';
import { CloudSnow, ArrowDownCircle, Clock, ShieldAlert, Sparkles, CheckCircle2 } from 'lucide-react';

export default function DisruptionSimulator({
  activeTrip,
  onSimulateBudgetCut,
  onSimulateDurationReduction,
  onSimulateWeatherDisruption,
  onClearDisruptions,
  isRecovering = false
}) {
  if (!activeTrip) return null;

  const isWeatherDisrupted = Boolean(activeTrip.simulatedDisruption?.outdoorUnsuitable);

  return (
    <div className="rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-7 mb-8 shadow-xl border border-indigo-800/40 relative overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-indigo-800/40">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              <Sparkles className="w-4 h-4" />
            </span>
            <h3 className="font-extrabold text-sm uppercase tracking-wider text-slate-100">
              Interactive Disruption & Scenario Lab
            </h3>
          </div>
          <p className="text-xs text-slate-300 mt-1 font-medium">
            Test the Autonomous Travel Recovery Engine against budget cuts, shorter durations, and mountain weather warnings.
          </p>
        </div>

        {isWeatherDisrupted && (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-extrabold bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-xs animate-pulse">
            <ShieldAlert className="w-3.5 h-3.5" /> Disruption Simulated
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Scenario A: Budget Cut */}
        <button
          onClick={onSimulateBudgetCut}
          disabled={isRecovering}
          className={`p-4 rounded-2xl bg-slate-800/80 hover:bg-slate-800 border border-indigo-700/40 hover:border-indigo-400 hover:-translate-y-1 hover:shadow-lg hover:shadow-indigo-500/20 text-left transition-all group cursor-pointer ${
            isRecovering ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          <div className="flex items-center gap-2 text-indigo-300 font-extrabold text-xs mb-1">
            <ArrowDownCircle className="w-4 h-4 group-hover:translate-y-0.5 transition-transform text-indigo-400" />
            <span>Scenario A: Budget Reduction</span>
          </div>
          <div className="text-sm font-bold text-white group-hover:text-indigo-200 transition-colors">
            Cut Budget to ₹16,000
          </div>
          <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
            Autonomous engine swaps stays/transit to fit the reduced ₹16,000 budget.
          </p>
        </button>

        {/* Scenario B: Duration Reduction */}
        <button
          onClick={onSimulateDurationReduction}
          disabled={isRecovering}
          className={`p-4 rounded-2xl bg-slate-800/80 hover:bg-slate-800 border border-amber-700/40 hover:border-amber-400 hover:-translate-y-1 hover:shadow-lg hover:shadow-amber-500/20 text-left transition-all group cursor-pointer ${
            isRecovering ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          <div className="flex items-center gap-2 text-amber-300 font-extrabold text-xs mb-1">
            <Clock className="w-4 h-4 group-hover:rotate-12 transition-transform text-amber-400" />
            <span>Scenario B: Trip Compression</span>
          </div>
          <div className="text-sm font-bold text-white group-hover:text-amber-200 transition-colors">
            Compress Trip to 3 Days
          </div>
          <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
            Re-optimizes schedule. Test rejecting it to verify original remains unchanged.
          </p>
        </button>

        {/* Scenario C: Weather Disruption with 6h Advance Notification */}
        <button
          onClick={isWeatherDisrupted ? onClearDisruptions : onSimulateWeatherDisruption}
          disabled={isRecovering}
          className={`p-4 rounded-2xl border text-left transition-all group cursor-pointer hover:-translate-y-1 hover:shadow-lg ${
            isRecovering ? 'opacity-50 cursor-not-allowed' : ''
          } ${
            isWeatherDisrupted
              ? 'bg-emerald-950/40 border-emerald-500/60 hover:bg-emerald-950/60 hover:shadow-emerald-500/20'
              : 'bg-slate-800/80 hover:bg-slate-800 border-rose-700/40 hover:border-rose-400 hover:shadow-rose-500/20'
          }`}
        >
          <div className="flex items-center gap-2 font-extrabold text-xs mb-1">
            <CloudSnow className={`w-4 h-4 ${isWeatherDisrupted ? 'text-emerald-400' : 'text-rose-400'}`} />
            <span className={isWeatherDisrupted ? 'text-emerald-300' : 'text-rose-300'}>
              {isWeatherDisrupted ? 'Restore Weather' : 'Scenario C: 6h Advance Warning'}
            </span>
          </div>
          <div className="text-sm font-bold text-white group-hover:text-rose-200 transition-colors">
            {isWeatherDisrupted ? 'Clear Weather Alert' : 'Simulate Mountain Blizzard'}
          </div>
          <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
            {isWeatherDisrupted
              ? 'Re-enable outdoor activities and re-evaluate original schedule.'
              : 'Issues 6h advance notice and pre-emptively reroutes outdoor excursions to indoor venues.'}
          </p>
        </button>
      </div>
    </div>
  );
}

