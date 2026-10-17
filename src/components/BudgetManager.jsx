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
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 mb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 mb-6 border-b border-slate-100">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <IndianRupee className="w-5 h-5 text-emerald-600" />
            <span>Budget & Expense Manager</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Transparent breakdown with strict mathematical verification across all categories.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg">
            {travellers} Traveller(s) • {duration} Day(s)
          </span>
          <span className="text-xs font-bold px-2.5 py-1 bg-brand-50 text-brand-700 rounded-lg border border-brand-200">
            ₹{perPersonCost.toLocaleString('en-IN')} / person
          </span>
        </div>
      </div>

      {/* Honest Budget Status Alert Banner */}
      {isOverBudget ? (
        <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-rose-900">
                Budget Deficit Detected: Exceeds Declared Limit by ₹{deficit.toLocaleString('en-IN')}
              </h4>
              <p className="text-xs text-rose-700 mt-0.5">
                TripOS does not conceal deficits. The calculated total of ₹{totalEstimatedExpenses.toLocaleString('en-IN')} exceeds your ₹{userBudget.toLocaleString('en-IN')} budget.
              </p>
            </div>
          </div>
          {onTriggerRecovery && (
            <button
              onClick={onTriggerRecovery}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Auto-Recover Budget</span>
            </button>
          )}
        </div>
      ) : (
        <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
          <div>
            <h4 className="text-sm font-bold text-emerald-900">
              Trip Fits Within Declared Budget
            </h4>
            <p className="text-xs text-emerald-700 mt-0.5">
              Surplus of ₹{surplus.toLocaleString('en-IN')} remaining for spontaneous activities or emergencies.
            </p>
          </div>
        </div>
      )}

      {/* Primary Financial Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total User Budget</div>
          <div className="text-2xl font-black text-slate-900 mt-1">
            ₹{userBudget.toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Allocated limit</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Calculated Expenses</div>
          <div className={`text-2xl font-black mt-1 ${isOverBudget ? 'text-rose-600' : 'text-slate-900'}`}>
            ₹{totalEstimatedExpenses.toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Sum of 5 expense categories</div>
        </div>

        <div className={`p-4 rounded-xl border ${isOverBudget ? 'bg-rose-50 border-rose-200' : 'bg-emerald-50 border-emerald-200'}`}>
          <div className={`text-xs font-semibold uppercase tracking-wider ${isOverBudget ? 'text-rose-600' : 'text-emerald-700'}`}>
            {isOverBudget ? 'Deficit (Over Budget)' : 'Remaining Balance'}
          </div>
          <div className={`text-2xl font-black mt-1 ${isOverBudget ? 'text-rose-700' : 'text-emerald-700'}`}>
            {isOverBudget ? `-₹${deficit.toLocaleString('en-IN')}` : `₹${remainingBudget.toLocaleString('en-IN')}`}
          </div>
          <div className={`text-[11px] mt-1 ${isOverBudget ? 'text-rose-600' : 'text-emerald-600'}`}>
            {isOverBudget ? `${budgetUtilizationPercent}% utilization` : `${budgetUtilizationPercent}% utilization`}
          </div>
        </div>
      </div>

      {/* Progress Utilization Bar */}
      <div className="mb-6">
        <div className="flex justify-between text-xs font-semibold text-slate-600 mb-1.5">
          <span>Budget Utilization</span>
          <span className={isOverBudget ? 'text-rose-600 font-bold' : 'text-slate-700'}>
            {budgetUtilizationPercent}%
          </span>
        </div>
        <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isOverBudget ? 'bg-rose-500' : budgetUtilizationPercent > 85 ? 'bg-amber-500' : 'bg-emerald-500'
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
        <div className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-colors">
          <div className="flex items-center gap-2 mb-2 text-slate-700">
            <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
              <Bus className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold">Transport</span>
          </div>
          <div className="text-base font-extrabold text-slate-900">
            ₹{categories.transport.amount.toLocaleString('en-IN')}
          </div>
          <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
            {categories.transport.description}
          </p>
        </div>

        {/* Accommodation */}
        <div className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-colors">
          <div className="flex items-center gap-2 mb-2 text-slate-700">
            <div className="p-1.5 bg-purple-50 text-purple-600 rounded-lg">
              <Hotel className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold">Accommodation</span>
          </div>
          <div className="text-base font-extrabold text-slate-900">
            ₹{categories.accommodation.amount.toLocaleString('en-IN')}
          </div>
          <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
            {categories.accommodation.description}
          </p>
        </div>

        {/* Food */}
        <div className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-colors">
          <div className="flex items-center gap-2 mb-2 text-slate-700">
            <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
              <Utensils className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold">Food & Meals</span>
          </div>
          <div className="text-base font-extrabold text-slate-900">
            ₹{categories.food.amount.toLocaleString('en-IN')}
          </div>
          <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
            {categories.food.description}
          </p>
        </div>

        {/* Activities */}
        <div className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-colors">
          <div className="flex items-center gap-2 mb-2 text-slate-700">
            <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <Compass className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold">Activities</span>
          </div>
          <div className="text-base font-extrabold text-slate-900">
            ₹{categories.activities.amount.toLocaleString('en-IN')}
          </div>
          <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
            {categories.activities.description}
          </p>
        </div>

        {/* Other / Buffer */}
        <div className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-colors">
          <div className="flex items-center gap-2 mb-2 text-slate-700">
            <div className="p-1.5 bg-slate-100 text-slate-600 rounded-lg">
              <TrendingUp className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold">Local Buffer</span>
          </div>
          <div className="text-base font-extrabold text-slate-900">
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

