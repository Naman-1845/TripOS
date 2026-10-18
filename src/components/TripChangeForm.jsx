import React, { useState } from 'react';
import { Sliders, Calendar, IndianRupee, MessageSquare, AlertCircle, Sparkles, ArrowRight, RotateCcw } from 'lucide-react';
import { calculateTripDeltas } from '../services/recoveryEngine.js';

export default function TripChangeForm({
  activeTrip,
  onSubmitChanges,
  isRecovering = false
}) {
  const [durationDeltaInput, setDurationDeltaInput] = useState('');
  const [budgetDeltaInput, setBudgetDeltaInput] = useState('');
  const [reasonInput, setReasonInput] = useState('');

  if (!activeTrip || !activeTrip.inputs) return null;

  const originalDuration = activeTrip.inputs.duration;
  const originalBudget = activeTrip.inputs.budget;

  // Parse and calculate deltas
  const durationDelta = durationDeltaInput === '' ? 0 : (parseInt(durationDeltaInput, 10) || 0);
  const budgetDelta = budgetDeltaInput === '' ? 0 : (parseInt(budgetDeltaInput, 10) || 0);

  const deltaCalc = calculateTripDeltas(activeTrip.inputs, {
    durationDelta,
    budgetDelta
  });

  const hasAnyChange = durationDelta !== 0 || budgetDelta !== 0;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!hasAnyChange || !deltaCalc.isValid) return;

    onSubmitChanges({
      durationDelta,
      budgetDelta,
      userReason: reasonInput.trim(),
      resultingDuration: deltaCalc.resultingDuration,
      resultingBudget: deltaCalc.resultingBudget
    });
  };

  const setExampleA = () => {
    setDurationDeltaInput('+2');
    setBudgetDeltaInput('');
    setReasonInput('Trip extended: Extra vacation days added');
  };

  const setExampleB = () => {
    setDurationDeltaInput('-2');
    setBudgetDeltaInput('');
    setReasonInput('Trip shortened: Work commitment requires early return');
  };

  const setExampleC = () => {
    setDurationDeltaInput('');
    setBudgetDeltaInput('-4000');
    setReasonInput('Budget reduction: Reallocating funds to emergency buffer');
  };

  const setExampleD = () => {
    setDurationDeltaInput('+2');
    setBudgetDeltaInput('-3000');
    setReasonInput('Stay extended by 2 days while tightening overall budget');
  };

  const handleReset = () => {
    setDurationDeltaInput('');
    setBudgetDeltaInput('');
    setReasonInput('');
  };

  return (
    <div className="travel-glass-card rounded-3xl p-6 sm:p-8 mb-8 relative overflow-hidden transition-all duration-300">
      {/* Decorative gradient top accent line */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />

      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-5 border-b border-indigo-100/60">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/25 shrink-0">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-slate-900 tracking-tight">
                Update Trip Due to Mid-Trip Changes
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200">
                Mid-Trip Mode
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Report real-world changes that occurred during your trip (duration or budget deltas) to generate a revised recovery plan.
            </p>
          </div>
        </div>

        {/* Current Active Trip Baseline Summary */}
        <div className="flex items-center gap-2 bg-white/90 px-3.5 py-2 rounded-2xl border border-slate-200/80 text-xs shrink-0 shadow-2xs self-start sm:self-auto">
          <span className="text-slate-500 font-semibold">Active:</span>
          <span className="font-extrabold text-slate-800">{activeTrip.inputs.destination}</span>
          <span className="text-slate-300">•</span>
          <span className="font-extrabold text-indigo-700">{originalDuration} Days</span>
          <span className="text-slate-300">•</span>
          <span className="font-extrabold text-emerald-700">₹{originalBudget.toLocaleString('en-IN')}</span>
        </div>
      </div>

      {/* Specification Examples Quick Chips */}
      <div className="mb-6 p-3.5 bg-gradient-to-r from-indigo-50/70 to-purple-50/50 rounded-2xl border border-indigo-100/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs shadow-2xs">
        <span className="font-extrabold text-indigo-950 text-[11px] uppercase tracking-wider">
          Quick Preset Scenarios:
        </span>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={setExampleA}
            className="px-3 py-1 bg-white hover:bg-indigo-50 text-indigo-800 font-bold rounded-xl border border-indigo-200 transition-all cursor-pointer text-[11px] hover:scale-105 active:scale-95 shadow-2xs"
            title="Duration change = +2 days (5d -> 7d)"
          >
            Example A: +2 Days
          </button>
          <button
            type="button"
            onClick={setExampleB}
            className="px-3 py-1 bg-white hover:bg-indigo-50 text-indigo-800 font-bold rounded-xl border border-indigo-200 transition-all cursor-pointer text-[11px] hover:scale-105 active:scale-95 shadow-2xs"
            title="Duration change = -2 days (5d -> 3d)"
          >
            Example B: -2 Days
          </button>
          <button
            type="button"
            onClick={setExampleC}
            className="px-3 py-1 bg-white hover:bg-indigo-50 text-indigo-800 font-bold rounded-xl border border-indigo-200 transition-all cursor-pointer text-[11px] hover:scale-105 active:scale-95 shadow-2xs"
            title="Budget change = -₹4,000 (₹20k -> ₹16k)"
          >
            Example C: -₹4,000 Budget
          </button>
          <button
            type="button"
            onClick={setExampleD}
            className="px-3 py-1 bg-white hover:bg-indigo-50 text-indigo-800 font-bold rounded-xl border border-indigo-200 transition-all cursor-pointer text-[11px] hover:scale-105 active:scale-95 shadow-2xs"
            title="Duration change = +2 days AND Budget change = -₹3,000"
          >
            Example D: +2d & -₹3,000
          </button>
          {hasAnyChange && (
            <button
              type="button"
              onClick={handleReset}
              className="px-2.5 py-1 text-slate-500 hover:text-rose-600 font-bold rounded-xl text-[11px] flex items-center gap-1 transition-all cursor-pointer ml-1 hover:bg-rose-50"
            >
              <RotateCcw className="w-3 h-3" /> Reset
            </button>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* A. Duration Change Input */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wide">
                <Calendar className="w-4 h-4 text-indigo-600" />
                Duration Change (Days)
              </label>
              <span className="text-[10px] text-slate-400 font-medium">
                Positive: extend • Negative: shorten
              </span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="number"
                step="1"
                value={durationDeltaInput}
                onChange={(e) => setDurationDeltaInput(e.target.value)}
                placeholder="e.g. +2 or -2"
                className={`w-full px-3 py-2 text-sm font-semibold rounded-xl border bg-white ${
                  deltaCalc.errors.duration ? 'border-rose-400 ring-2 ring-rose-100' : 'border-slate-300'
                } focus:outline-hidden focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100`}
              />

              {/* Quick Delta Buttons */}
              <div className="flex items-center gap-1 shrink-0">
                {[-2, -1, 1, 2].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setDurationDeltaInput(String(num))}
                    className={`px-2 py-1.5 text-xs font-bold rounded-lg border transition-colors cursor-pointer ${
                      durationDelta === num
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700'
                    }`}
                  >
                    {num > 0 ? `+${num}` : num}d
                  </button>
                ))}
              </div>
            </div>

            {/* Duration Live Preview */}
            <div className="mt-2.5 pt-2 border-t border-slate-200/80 flex items-center justify-between text-xs">
              <span className="text-slate-500">
                Original: <strong className="text-slate-700">{originalDuration} Days</strong>
              </span>
              <div className="flex items-center gap-1 font-bold">
                <ArrowRight className="w-3 h-3 text-slate-400" />
                <span className={durationDelta !== 0 ? (deltaCalc.errors.duration ? 'text-rose-600' : 'text-indigo-700') : 'text-slate-500'}>
                  Resulting: {deltaCalc.resultingDuration} Days {durationDelta !== 0 && `(${durationDelta > 0 ? `+${durationDelta}` : durationDelta}d)`}
                </span>
              </div>
            </div>

            {deltaCalc.errors.duration && (
              <p className="text-xs text-rose-600 mt-1.5 flex items-center gap-1 font-medium">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {deltaCalc.errors.duration}
              </p>
            )}
          </div>

          {/* B. Budget Change Input */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wide">
                <IndianRupee className="w-4 h-4 text-emerald-600" />
                Budget Change (Amount in ₹)
              </label>
              <span className="text-[10px] text-slate-400 font-medium">
                Positive: increase • Negative: decrease
              </span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="number"
                step="500"
                value={budgetDeltaInput}
                onChange={(e) => setBudgetDeltaInput(e.target.value)}
                placeholder="e.g. -4000 or +5000"
                className={`w-full px-3 py-2 text-sm font-semibold rounded-xl border bg-white ${
                  deltaCalc.errors.budget ? 'border-rose-400 ring-2 ring-rose-100' : 'border-slate-300'
                } focus:outline-hidden focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100`}
              />

              {/* Quick Delta Buttons */}
              <div className="flex items-center gap-1 shrink-0">
                {[-4000, -2000, 2000, 5000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setBudgetDeltaInput(String(amt))}
                    className={`px-1.5 py-1.5 text-[11px] font-bold rounded-lg border transition-colors cursor-pointer ${
                      budgetDelta === amt
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700'
                    }`}
                  >
                    {amt > 0 ? `+₹${amt / 1000}k` : `-₹${Math.abs(amt) / 1000}k`}
                  </button>
                ))}
              </div>
            </div>

            {/* Budget Live Preview */}
            <div className="mt-2.5 pt-2 border-t border-slate-200/80 flex items-center justify-between text-xs">
              <span className="text-slate-500">
                Original: <strong className="text-slate-700">₹{originalBudget.toLocaleString('en-IN')}</strong>
              </span>
              <div className="flex items-center gap-1 font-bold">
                <ArrowRight className="w-3 h-3 text-slate-400" />
                <span className={budgetDelta !== 0 ? (deltaCalc.errors.budget ? 'text-rose-600' : 'text-emerald-700') : 'text-slate-500'}>
                  Resulting: ₹{deltaCalc.resultingBudget.toLocaleString('en-IN')} {budgetDelta !== 0 && `(${budgetDelta > 0 ? `+₹${budgetDelta.toLocaleString('en-IN')}` : `-₹${Math.abs(budgetDelta).toLocaleString('en-IN')}`})`}
                </span>
              </div>
            </div>

            {deltaCalc.errors.budget && (
              <p className="text-xs text-rose-600 mt-1.5 flex items-center gap-1 font-medium">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {deltaCalc.errors.budget}
              </p>
            )}
          </div>
        </div>

        {/* D. Optional Reason Input */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <MessageSquare className="w-4 h-4 text-slate-400" />
            Reason for Change (Optional)
          </label>
          <input
            type="text"
            value={reasonInput}
            onChange={(e) => setReasonInput(e.target.value)}
            placeholder="e.g. Flight rescheduled, decided to stay longer, medical emergency, spent extra on shopping"
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />
        </div>

        {/* Submit Actions */}
        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            {!hasAnyChange ? (
              <span>Specify a duration change, budget change, or both to evaluate a recovery proposal.</span>
            ) : deltaCalc.isValid ? (
              <span className="text-indigo-900 font-semibold">
                Will evaluate proposal for <strong>{deltaCalc.resultingDuration} days</strong> and a budget of <strong>₹{deltaCalc.resultingBudget.toLocaleString('en-IN')}</strong>.
              </span>
            ) : (
              <span className="text-rose-600 font-medium">
                Please correct invalid values before submitting. Resulting duration and budget cannot be zero or negative.
              </span>
            )}
          </div>

          <button
            type="submit"
            disabled={!hasAnyChange || !deltaCalc.isValid || isRecovering}
            className={`w-full sm:w-auto px-6 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 ${
              !hasAnyChange || !deltaCalc.isValid || isRecovering
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/20 cursor-pointer'
            }`}
          >
            <Sparkles className={`w-4 h-4 ${isRecovering ? 'animate-spin' : ''}`} />
            <span>{isRecovering ? 'Evaluating with Agent...' : 'Generate Recovery Proposal'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}

