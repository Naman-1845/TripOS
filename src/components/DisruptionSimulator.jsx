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
    <div className="bg-slate-900 text-white rounded-2xl p-6 mb-8 shadow-xl border border-slate-800">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-brand-500/20 text-brand-400">
              <Sparkles className="w-4 h-4" />
            </span>
            <h3 className="font-extrabold text-sm uppercase tracking-wider text-slate-100">
              Interactive Disruption & Scenario Tester
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Test the Travel Recovery Engine against budget cuts, duration changes, and mountain weather disruptions.
          </p>
        </div>

        {isWeatherDisrupted && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
            <ShieldAlert className="w-3.5 h-3.5" /> Disruption Simulated
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Scenario A: Budget Cut */}
        <button
          onClick={onSimulateBudgetCut}
          disabled={isRecovering}
          className={`p-3.5 rounded-xl bg-slate-800/90 hover:bg-slate-800 border border-slate-700 hover:border-brand-500/50 text-left transition-all group ${
            isRecovering ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
          }`}
        >
          <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs mb-1">
            <ArrowDownCircle className="w-4 h-4 group-hover:translate-y-0.5 transition-transform" />
            <span>Scenario A: Budget Reduction</span>
          </div>
          <div className="text-xs font-semibold text-slate-200">
            Cut Budget to ₹16,000
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Triggers recovery to adapt hotel/transport to fit lower ₹16,000 budget.
          </p>
        </button>

        {/* Scenario B: Duration Reduction */}
        <button
          onClick={onSimulateDurationReduction}
          disabled={isRecovering}
          className={`p-3.5 rounded-xl bg-slate-800/90 hover:bg-slate-800 border border-slate-700 hover:border-amber-500/50 text-left transition-all group ${
            isRecovering ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
          }`}
        >
          <div className="flex items-center gap-2 text-amber-400 font-bold text-xs mb-1">
            <Clock className="w-4 h-4 group-hover:scale-110 transition-transform" />
            <span>Scenario B: Trip Compression</span>
          </div>
          <div className="text-xs font-semibold text-slate-200">
            Compress Trip to 3 Days
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Generates 3-day recovery proposal. Test rejecting it to verify original remains unchanged.
          </p>
        </button>

        {/* Scenario C: Weather Disruption */}
        <button
          onClick={isWeatherDisrupted ? onClearDisruptions : onSimulateWeatherDisruption}
          disabled={isRecovering}
          className={`p-3.5 rounded-xl border text-left transition-all group ${
            isRecovering ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
          } ${
            isWeatherDisrupted
              ? 'bg-emerald-950/40 border-emerald-500/50 hover:bg-emerald-950/60'
              : 'bg-slate-800/90 hover:bg-slate-800 border-slate-700 hover:border-rose-500/50'
          }`}
        >
          <div className="flex items-center gap-2 font-bold text-xs mb-1">
            <CloudSnow className={`w-4 h-4 ${isWeatherDisrupted ? 'text-emerald-400' : 'text-rose-400'}`} />
            <span className={isWeatherDisrupted ? 'text-emerald-400' : 'text-rose-400'}>
              {isWeatherDisrupted ? 'Restore Weather' : 'Scenario C: Blizzard Alert'}
            </span>
          </div>
          <div className="text-xs font-semibold text-slate-200">
            {isWeatherDisrupted ? 'Clear Weather Alert' : 'Simulate Snowstorm / Blizzard'}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            {isWeatherDisrupted
              ? 'Re-enable outdoor activities and re-evaluate schedule.'
              : 'Reroutes outdoor excursions to indoor cultural attractions.'}
          </p>
        </button>
      </div>
    </div>
  );
}

