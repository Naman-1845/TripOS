import React from 'react';
import { IndianRupee, AlertTriangle, CheckCircle, Bus, Hotel, Utensils, Compass, ShieldAlert, Sparkles, TrendingUp } from 'lucide-react';

export default function BudgetManager({
  budgetBreakdown,
  onTriggerRecovery
}) {
  if (!budgetBreakdown) return null;

  const {
    userBudget,
    travellers,
    duration,
    categories,
    totalEstimatedExpenses,
    remainingBudget,
    perPersonCost,
    isOverBudget,
    deficit,
    surplus,
    budgetUtilizationPercent
  } = budgetBreakdown;

  return (
    <div className="travel-glass-card rounded-3xl p-6 sm:p-8 mb-8 relative overflow-hidden transition-all duration-300">
      {/* Decorative gradient top accent line */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-500" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-6 border-b border-indigo-100/60">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 via-teal-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-emerald-500/25 shrink-0">
            <IndianRupee className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight">
              Budget & Financial Expense Audit
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Transparent itemized breakdown with strict sum verification across all categories.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold px-3 py-1 bg-white/90 text-slate-700 rounded-xl border border-slate-200/80 shadow-2xs">
            {travellers} Traveller(s) • {duration} Day(s)
          </span>
          <span className="text-xs font-black px-3 py-1 bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-700 rounded-xl border border-indigo-200/80 shadow-2xs">
            ₹{perPersonCost.toLocaleString('en-IN')} / person
          </span>
        </div>
      </div>

      {/* Honest Budget Status Alert Banner */}
      {isOverBudget ? (
        <div className="mb-6 p-4 rounded-2xl bg-rose-500/10 border-2 border-rose-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4 backdrop-blur-xs">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-500/20 text-rose-600 flex items-center justify-center shrink-0 mt-0.5">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-extrabold text-rose-950">
                Budget Deficit Detected: Exceeds Declared Limit by ₹{deficit.toLocaleString('en-IN')}
              </h4>
              <p className="text-xs text-rose-900/90 mt-0.5 leading-relaxed">
                TripOS never hides deficits. Calculated total of ₹{totalEstimatedExpenses.toLocaleString('en-IN')} exceeds your declared ₹{userBudget.toLocaleString('en-IN')} budget.
              </p>
            </div>
          </div>
          {onTriggerRecovery && (
            <button
              onClick={onTriggerRecovery}
              className="px-4 py-2.5 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-bold text-xs rounded-xl shadow-md shadow-rose-500/25 transition-all shrink-0 flex items-center gap-2 cursor-pointer hover:scale-105 active:scale-95"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Auto-Recover Budget</span>
            </button>
          )}
        </div>
      ) : (
        <div className="mb-6 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3 backdrop-blur-xs">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-extrabold text-emerald-950">
              Trip Fits Within Declared Budget
            </h4>
            <p className="text-xs text-emerald-900/90 mt-0.5">
              Surplus of ₹{surplus.toLocaleString('en-IN')} safely reserved for spontaneous local activities or emergency contingency.
            </p>
          </div>
        </div>
      )}

      {/* Primary Financial Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="p-4 rounded-2xl bg-white/90 border border-slate-200/90 shadow-2xs hover-lift cursor-pointer">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total User Budget</div>
          <div className="text-2xl font-black text-slate-900 mt-1">
            ₹{userBudget.toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Allocated limit</div>
        </div>

        <div className="p-4 rounded-2xl bg-white/90 border border-slate-200/90 shadow-2xs hover-lift cursor-pointer">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Calculated Expenses</div>
          <div className={`text-2xl font-black mt-1 ${isOverBudget ? 'text-rose-600' : 'text-slate-900'}`}>
            ₹{totalEstimatedExpenses.toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Sum of 5 expense categories</div>
        </div>

        <div className={`p-4 rounded-2xl border shadow-2xs hover-lift cursor-pointer ${
          isOverBudget ? 'bg-gradient-to-br from-rose-50 to-red-50/60 border-rose-300' : 'bg-gradient-to-br from-emerald-50 to-teal-50/60 border-emerald-300'
        }`}>
          <div className={`text-[11px] font-bold uppercase tracking-wider ${isOverBudget ? 'text-rose-600' : 'text-emerald-700'}`}>
            {isOverBudget ? 'Deficit (Over Budget)' : 'Remaining Balance'}
          </div>
          <div className={`text-2xl font-black mt-1 ${isOverBudget ? 'text-rose-700' : 'text-emerald-700'}`}>
            {isOverBudget ? `-₹${deficit.toLocaleString('en-IN')}` : `₹${remainingBudget.toLocaleString('en-IN')}`}
          </div>
          <div className={`text-[11px] mt-1 font-semibold ${isOverBudget ? 'text-rose-600' : 'text-emerald-600'}`}>
            {budgetUtilizationPercent}% utilization
          </div>
        </div>
      </div>

      {/* Progress Utilization Bar */}
      <div className="mb-6">
        <div className="flex justify-between text-xs font-bold text-slate-600 mb-2">
          <span>Budget Utilization Gauge</span>
          <span className={isOverBudget ? 'text-rose-600 font-extrabold' : 'text-slate-700 font-extrabold'}>
            {budgetUtilizationPercent}%
          </span>
        </div>
        <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden p-0.5">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isOverBudget
                ? 'bg-gradient-to-r from-rose-500 to-red-600 shadow-sm shadow-rose-500/40'
                : budgetUtilizationPercent > 85
                ? 'bg-gradient-to-r from-amber-400 to-amber-500 shadow-sm shadow-amber-500/40'
                : 'bg-gradient-to-r from-emerald-500 to-teal-500 shadow-sm shadow-emerald-500/40'
            }`}
            style={{ width: `${Math.min(100, budgetUtilizationPercent)}%` }}
          />
        </div>
      </div>

      {/* Itemized Honest Breakdown Cards */}
      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
        Itemized Breakdown (Strict Sum Verification)
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Transport */}
        <div className="p-3.5 rounded-2xl border border-blue-200/80 bg-gradient-to-b from-blue-50/50 to-white/90 shadow-2xs hover-lift cursor-pointer transition-all">
          <div className="flex items-center gap-2 mb-2 text-slate-700">
            <div className="p-1.5 bg-blue-100/80 text-blue-700 rounded-xl">
              <Bus className="w-4 h-4" />
            </div>
            <span className="text-xs font-extrabold text-blue-900">Transport</span>
          </div>
          <div className="text-base font-black text-slate-900">
            ₹{categories.transport.amount.toLocaleString('en-IN')}
          </div>
          <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
            {categories.transport.description}
          </p>
        </div>

        {/* Accommodation */}
        <div className="p-3.5 rounded-2xl border border-purple-200/80 bg-gradient-to-b from-purple-50/50 to-white/90 shadow-2xs hover-lift cursor-pointer transition-all">
          <div className="flex items-center gap-2 mb-2 text-slate-700">
            <div className="p-1.5 bg-purple-100/80 text-purple-700 rounded-xl">
              <Hotel className="w-4 h-4" />
            </div>
            <span className="text-xs font-extrabold text-purple-900">Accommodation</span>
          </div>
          <div className="text-base font-black text-slate-900">
            ₹{categories.accommodation.amount.toLocaleString('en-IN')}
          </div>
          <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
            {categories.accommodation.description}
          </p>
        </div>

        {/* Food */}
        <div className="p-3.5 rounded-2xl border border-amber-200/80 bg-gradient-to-b from-amber-50/50 to-white/90 shadow-2xs hover-lift cursor-pointer transition-all">
          <div className="flex items-center gap-2 mb-2 text-slate-700">
            <div className="p-1.5 bg-amber-100/80 text-amber-700 rounded-xl">
              <Utensils className="w-4 h-4" />
            </div>
            <span className="text-xs font-extrabold text-amber-900">Food & Meals</span>
          </div>
          <div className="text-base font-black text-slate-900">
            ₹{categories.food.amount.toLocaleString('en-IN')}
          </div>
          <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
            {categories.food.description}
          </p>
        </div>

        {/* Activities */}
        <div className="p-3.5 rounded-2xl border border-emerald-200/80 bg-gradient-to-b from-emerald-50/50 to-white/90 shadow-2xs hover-lift cursor-pointer transition-all">
          <div className="flex items-center gap-2 mb-2 text-slate-700">
            <div className="p-1.5 bg-emerald-100/80 text-emerald-700 rounded-xl">
              <Compass className="w-4 h-4" />
            </div>
            <span className="text-xs font-extrabold text-emerald-900">Activities</span>
          </div>
          <div className="text-base font-black text-slate-900">
            ₹{categories.activities.amount.toLocaleString('en-IN')}
          </div>
          <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
            {categories.activities.description}
          </p>
        </div>

        {/* Other / Buffer */}
        <div className="p-3.5 rounded-2xl border border-indigo-200/80 bg-gradient-to-b from-indigo-50/50 to-white/90 shadow-2xs hover-lift cursor-pointer transition-all">
          <div className="flex items-center gap-2 mb-2 text-slate-700">
            <div className="p-1.5 bg-indigo-100/80 text-indigo-700 rounded-xl">
              <TrendingUp className="w-4 h-4" />
            </div>
            <span className="text-xs font-extrabold text-indigo-900">Local Buffer</span>
          </div>
          <div className="text-base font-black text-slate-900">
            ₹{categories.other.amount.toLocaleString('en-IN')}
          </div>
          <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
            {categories.other.description}
          </p>
        </div>
      </div>
    </div>
  );
}

