import React, { useState } from 'react';
import {
  Sparkles,
  Check,
  X,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  ShieldCheck,
  RefreshCw,
  Layers,
  ChevronRight,
  Info
} from 'lucide-react';
import { validateRecoveryProposal } from '../services/recoveryEngine.js';

export default function RecoveryModal({
  proposal,
  candidates = [],
  activeTrip = null,
  isStale = false,
  isApproving = false,
  isRejecting = false,
  onApprove,
  onReject,
  onRegenerate,
  onClose
}) {
  if (!proposal) return null;

  // Resolve candidate strategies list
  const rawCandidates = candidates.length > 0
    ? candidates
    : (proposal.candidates && proposal.candidates.length > 0 ? proposal.candidates : []);

  const candidateList = rawCandidates.length > 0
    ? rawCandidates
    : [{
        strategy: proposal.strategy || 'Recommended Plan',
        proposal,
        tradeoffs: proposal.tradeoffs || [],
        costDifference: proposal.costImpact?.costDifference ?? 0,
        recommended: true
      }];

  // Initial selection defaults to recommended candidate or index 0
  const initialIdx = candidateList.findIndex(c => c.recommended);
  const [selectedIdx, setSelectedIdx] = useState(initialIdx >= 0 ? initialIdx : 0);

  const activeCandidate = candidateList[selectedIdx] || candidateList[0];
  const currentProposal = activeCandidate.proposal || proposal;

  const validation = validateRecoveryProposal(currentProposal, activeTrip);

  const disableReasons = [];
  if (!currentProposal) disableReasons.push('proposal is missing');
  if (currentProposal && currentProposal.status !== 'pending') disableReasons.push(`proposal status is "${currentProposal.status}" (expected "pending")`);
  if (!validation.isValid) disableReasons.push(`validation failed: ${validation.errors.join('; ')}`);
  if (isStale) disableReasons.push('proposal is stale');
  if (isApproving) disableReasons.push('approval in progress');
  if (isRejecting) disableReasons.push('rejection in progress');

  const isApproveDisabled = disableReasons.length > 0;

  // Safe diagnostics (never logs API keys or sensitive secrets)
  console.log('[TripOS RecoveryModal Diagnostics]', {
    activeTripDestination: activeTrip?.inputs?.destination ?? currentProposal?.originalSnapshot?.inputs?.destination ?? 'N/A',
    activeTripBudget: activeTrip?.inputs?.budget ?? currentProposal?.originalSnapshot?.inputs?.budget ?? 'N/A',
    proposalProposedDestination: currentProposal?.proposedPlan?.inputs?.destination ?? 'N/A',
    proposalProposedBudget: currentProposal?.proposedPlan?.inputs?.budget ?? 'N/A',
    proposalStatus: currentProposal?.status ?? 'N/A',
    proposalId: currentProposal?.proposalId ?? 'N/A',
    selectedStrategy: activeCandidate?.strategy ?? 'N/A',
    totalCandidates: candidateList.length,
    isStale: Boolean(isStale),
    isApproving: Boolean(isApproving),
    isRejecting: Boolean(isRejecting),
    validateRecoveryProposalResult: validation,
    exactDisableReason: isApproveDisabled ? disableReasons.join(' | ') : 'none (button enabled)'
  });

  const {
    triggerReasons = [],
    actionsTaken = [],
    costImpact,
    originalSnapshot,
    proposedPlan
  } = currentProposal;

  const oldTotal = costImpact?.oldTotal || 0;
  const newTotal = costImpact?.newTotal || 0;
  const diff = costImpact?.costDifference || 0;
  const isSaving = diff < 0;

  const activeTradeoffs = activeCandidate.tradeoffs?.length > 0
    ? activeCandidate.tradeoffs
    : (currentProposal.tradeoffs || []);

  const handleApproveCurrent = () => {
    if (onApprove) {
      onApprove(currentProposal);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-500 via-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30 shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-black tracking-tight">Autonomous Travel Recovery Engine</h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-gradient-to-r from-indigo-400 to-purple-400 text-slate-950 uppercase shadow-2xs">
                  {candidateList.length > 1 ? `${candidateList.length} Candidate Strategies Available` : 'Proposed Solution'}
                </span>

                {currentProposal.executionMode === 'live-llm-agent' ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    <ShieldCheck className="w-3 h-3 text-emerald-400" />
                    Google Gemini ({currentProposal.model || 'gemini-2.5-flash'})
                  </span>
                ) : currentProposal.executionMode === 'deterministic-fallback' ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40">
                    <Sparkles className="w-3 h-3 text-blue-400" />
                    Server Tool Runner (Deterministic)
                  </span>
                ) : currentProposal.executionMode === 'deterministic-fallback-on-error' ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    <AlertTriangle className="w-3 h-3 text-amber-400" />
                    Server Fallback (Provider Error Handled)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    Offline Heuristic Fallback (Local Engine)
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Compare multi-candidate recovery strategies and inspect side-by-side impact before approving.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isApproving || isRejecting}
            className={`p-2 rounded-lg transition-colors ${
              isApproving || isRejecting
                ? 'text-slate-600 cursor-not-allowed'
                : 'text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stale Warning Banner if inputs diverged */}
        {isStale && (
          <div className="p-3 bg-amber-500 text-slate-950 flex items-center justify-between px-6 text-xs font-semibold">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                Proposal is out of date because trip inputs were modified in the background.
              </span>
            </div>
            <button
              onClick={onRegenerate}
              className="px-3 py-1 bg-slate-950 text-white rounded-md text-xs font-bold hover:bg-slate-800 flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" /> Regenerate Proposal
            </button>
          </div>
        )}

        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Feature 2: Multi-Candidate Strategy Selection Cards */}
          {candidateList.length > 1 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-brand-600" />
                  Select Recovery Strategy ({candidateList.length} Options Formulated)
                </span>
                <span className="text-[11px] text-slate-400">
                  Click a candidate plan to preview trade-offs and full details
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {candidateList.map((cand, idx) => {
                  const isSelected = idx === selectedIdx;
                  const candDiff = cand.proposal?.costImpact?.costDifference ?? cand.costDifference ?? 0;
                  const candSaving = candDiff < 0;
                  const totalCost = cand.proposal?.costImpact?.newTotal ?? cand.proposal?.proposedPlan?.budgetBreakdown?.totalEstimatedExpenses ?? 0;

                  return (
                    <div
                      key={idx}
                      onClick={() => setSelectedIdx(idx)}
                      className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer relative flex flex-col justify-between ${
                        isSelected
                          ? 'border-brand-600 bg-brand-50/50 shadow-md ring-2 ring-brand-500/20 scale-[1.01]'
                          : 'border-slate-200 bg-slate-50 hover:border-brand-300 hover:bg-white'
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-1 mb-1.5">
                          <h4 className="text-xs font-black text-slate-900 tracking-tight flex items-center gap-1.5">
                            {cand.strategy === 'Budget Saver' ? '💰' : cand.strategy?.includes('Fast') ? '⚡' : '🛡️'}
                            {cand.strategy}
                          </h4>

                          {cand.recommended && (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-gradient-to-r from-emerald-500 to-teal-500 text-white uppercase shadow-2xs">
                              Recommended
                            </span>
                          )}
                        </div>

                        <div className="flex items-baseline justify-between mb-2">
                          <span className="text-base font-extrabold text-slate-900">
                            ₹{totalCost.toLocaleString('en-IN')}
                          </span>
                          <span className={`text-[11px] font-bold ${candSaving ? 'text-emerald-700' : 'text-slate-600'}`}>
                            {candSaving ? `Saves ₹${Math.abs(candDiff).toLocaleString('en-IN')}` : `+₹${candDiff.toLocaleString('en-IN')}`}
                          </span>
                        </div>

                        {/* Trade-off bullets */}
                        {cand.tradeoffs && cand.tradeoffs.length > 0 && (
                          <ul className="text-[10px] text-slate-600 space-y-1 mb-2">
                            {cand.tradeoffs.slice(0, 2).map((to, i) => (
                              <li key={i} className="flex items-start gap-1">
                                <span className="text-brand-500 font-bold">•</span>
                                <span>{to}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between text-[11px] font-semibold">
                        <span className="text-slate-500">
                          {cand.proposal?.proposedPlan?.inputs?.duration}d · {cand.proposal?.proposedPlan?.inputs?.transportPreference} · {cand.proposal?.proposedPlan?.inputs?.accommodationPreference}
                        </span>
                        <span className={`text-[10px] font-bold ${isSelected ? 'text-brand-700 font-black' : 'text-slate-400'}`}>
                          {isSelected ? 'Selected ✓' : 'View →'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Agent Summary & Explanation */}
          {(currentProposal.agentSummary || currentProposal.agentExplanation) && (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-700">
              <span className="font-bold text-slate-900 block mb-1 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-brand-600" />
                Strategy Rationale ({activeCandidate.strategy}):
              </span>
              <p>{currentProposal.agentSummary || currentProposal.agentExplanation}</p>
            </div>
          )}

          {/* Strategy Trade-offs Banner */}
          {activeTradeoffs.length > 0 && (
            <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200">
              <h4 className="text-xs font-bold text-indigo-950 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Info className="w-4 h-4 text-indigo-600" />
                Evaluated Trade-offs ({activeCandidate.strategy})
              </h4>
              <ul className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {activeTradeoffs.map((item, i) => (
                  <li key={i} className="text-xs text-indigo-900 flex items-start gap-1.5 bg-white/70 p-2 rounded-xl border border-indigo-100">
                    <span className="text-indigo-500 font-bold">⚖️</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Section 1: Engine Diagnostics (Triggers & Actions) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Why was recovery triggered? */}
            <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200">
              <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                Triggering Disruption & Input Events
              </h4>
              <ul className="space-y-1.5">
                {triggerReasons.map((reason, i) => (
                  <li key={i} className="text-xs text-amber-800 flex items-start gap-2">
                    <span className="text-amber-500 font-bold">•</span>
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* What autonomous actions did the engine take? */}
            <div className="p-4 rounded-2xl bg-brand-50/70 border border-brand-200">
              <h4 className="text-xs font-bold text-brand-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-brand-600" />
                Autonomous Engine Resolution
              </h4>
              <ul className="space-y-1.5">
                {actionsTaken.map((act, i) => (
                  <li key={i} className="text-xs text-brand-900 flex items-start gap-2">
                    <span className="text-brand-600 font-bold">✓</span>
                    <span>{act}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Authentic Agent Execution Trace Timeline */}
          {currentProposal.trace && currentProposal.trace.length > 0 && (
            <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 text-white">
              <details className="group" open>
                <summary className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center justify-between cursor-pointer list-none">
                  <span className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-brand-400" />
                    Authentic Agent Tool Execution Trace ({currentProposal.trace.length} Steps)
                  </span>
                  <span className="text-[11px] text-brand-400 font-semibold group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <div className="mt-4 space-y-3 pt-2 border-t border-slate-800 text-xs">
                  {currentProposal.trace.map((t, idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/60 font-mono text-[11px]">
                      <div className="flex items-center justify-between text-brand-300 font-bold mb-1.5">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-full bg-brand-500/20 text-brand-300 flex items-center justify-center text-[10px] font-bold">
                            {t.step || idx + 1}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-slate-950 text-brand-300 text-[11px] border border-brand-500/30">
                            {t.toolCall?.name}
                          </span>
                        </span>
                      </div>
                      <p className="text-slate-200 font-sans text-xs mb-2 pl-6">{t.thought}</p>
                      {t.toolCall?.args && Object.keys(t.toolCall.args).length > 0 && (
                        <div className="text-[10px] text-slate-400 bg-slate-950/70 p-2 rounded mb-1.5 ml-6">
                          <strong className="text-slate-300">Arguments:</strong> {JSON.stringify(t.toolCall.args)}
                        </div>
                      )}
                      {t.observation && (
                        <div className="text-[10px] text-slate-300 bg-slate-950/90 p-2 rounded ml-6 border-l-2 border-brand-500">
                          <strong className="text-brand-300">Observation:</strong> {JSON.stringify(t.observation)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </details>
            </div>
          )}

          {/* Section 2: Side-by-Side Comparison Grid */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Side-by-Side Plan Comparison
              </h4>
              <span className="text-xs font-bold text-brand-700">
                Evaluating: {activeCandidate.strategy}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left Column: Active Original Plan */}
              <div className="p-5 rounded-2xl border-2 border-slate-200 bg-slate-50/60 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Active Plan (Baseline)
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-200 text-slate-700">
                      Current
                    </span>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-200/60">
                      <span className="text-slate-500">Destination:</span>
                      <span className="font-bold text-slate-800">{originalSnapshot.inputs.origin} → {originalSnapshot.inputs.destination}</span>
                    </div>

                    <div className="flex justify-between py-1 border-b border-slate-200/60">
                      <span className="text-slate-500">Duration:</span>
                      <span className="font-bold text-slate-800">{originalSnapshot.inputs.duration} Days</span>
                    </div>

                    <div className="flex justify-between py-1 border-b border-slate-200/60">
                      <span className="text-slate-500">Transport:</span>
                      <span className="font-bold text-slate-800">{originalSnapshot.inputs.transportPreference} ({originalSnapshot.selectedTransport?.name})</span>
                    </div>

                    <div className="flex justify-between py-1 border-b border-slate-200/60">
                      <span className="text-slate-500">Accommodation:</span>
                      <span className="font-bold text-slate-800">{originalSnapshot.inputs.accommodationPreference} ({originalSnapshot.selectedAccommodation?.name})</span>
                    </div>

                    <div className="flex justify-between py-1 border-b border-slate-200/60">
                      <span className="text-slate-500">Declared Budget:</span>
                      <span className="font-bold text-slate-800">₹{originalSnapshot.budgetBreakdown.userBudget.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-200">
                  <div className="text-xs text-slate-500">Total Calculated Cost</div>
                  <div className="text-xl font-extrabold text-slate-800">
                    ₹{oldTotal.toLocaleString('en-IN')}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {originalSnapshot.budgetBreakdown.isOverBudget ? (
                      <span className="text-rose-600 font-bold">Deficit: -₹{originalSnapshot.budgetBreakdown.deficit.toLocaleString('en-IN')}</span>
                    ) : (
                      <span className="text-emerald-600 font-bold">Remaining: ₹{originalSnapshot.budgetBreakdown.remainingBudget.toLocaleString('en-IN')}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: Proposed Plan */}
              <div className="p-5 rounded-2xl border-2 border-brand-500 bg-brand-50/20 shadow-md shadow-brand-500/5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-3 mb-4 border-b border-brand-200">
                    <span className="text-xs font-bold uppercase tracking-wider text-brand-700">
                      Proposed Plan ({activeCandidate.strategy})
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-brand-500 text-white">
                      {activeCandidate.recommended ? 'Recommended Pick' : 'Alternative Strategy'}
                    </span>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div className="flex justify-between py-1 border-b border-brand-100">
                      <span className="text-slate-500">Destination:</span>
                      <span className="font-bold text-slate-800">{proposedPlan.inputs.origin} → {proposedPlan.inputs.destination}</span>
                    </div>

                    <div className="flex justify-between py-1 border-b border-brand-100">
                      <span className="text-slate-500">Duration:</span>
                      <span className={`font-bold ${proposedPlan.inputs.duration !== originalSnapshot.inputs.duration ? 'text-brand-700 bg-brand-100 px-1 rounded' : 'text-slate-800'}`}>
                        {proposedPlan.inputs.duration} Days
                      </span>
                    </div>

                    <div className="flex justify-between py-1 border-b border-brand-100">
                      <span className="text-slate-500">Transport:</span>
                      <span className={`font-bold ${proposedPlan.inputs.transportPreference !== originalSnapshot.inputs.transportPreference ? 'text-brand-700 bg-brand-100 px-1 rounded' : 'text-slate-800'}`}>
                        {proposedPlan.inputs.transportPreference} ({proposedPlan.selectedTransport?.name})
                      </span>
                    </div>

                    <div className="flex justify-between py-1 border-b border-brand-100">
                      <span className="text-slate-500">Accommodation:</span>
                      <span className={`font-bold ${proposedPlan.inputs.accommodationPreference !== originalSnapshot.inputs.accommodationPreference ? 'text-brand-700 bg-brand-100 px-1 rounded' : 'text-slate-800'}`}>
                        {proposedPlan.inputs.accommodationPreference} ({proposedPlan.selectedAccommodation?.name})
                      </span>
                    </div>

                    <div className="flex justify-between py-1 border-b border-brand-100">
                      <span className="text-slate-500">Declared Budget:</span>
                      <span className={`font-bold ${proposedPlan.inputs.budget !== originalSnapshot.inputs.budget ? 'text-brand-700 bg-brand-100 px-1 rounded' : 'text-slate-800'}`}>
                        ₹{proposedPlan.budgetBreakdown.userBudget.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-brand-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-slate-500">New Calculated Cost</div>
                      <div className="text-xl font-extrabold text-brand-700">
                        ₹{newTotal.toLocaleString('en-IN')}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold ${
                        isSaving ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-800'
                      }`}>
                        {isSaving ? <TrendingDown className="w-3.5 h-3.5" /> : <TrendingUp className="w-3.5 h-3.5" />}
                        <span>{isSaving ? `Saves ₹${Math.abs(diff).toLocaleString('en-IN')}` : `+₹${diff.toLocaleString('en-IN')}`}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-500 mt-1">
                    {proposedPlan.budgetBreakdown.isOverBudget ? (
                      <span className="text-rose-600 font-bold">Deficit: -₹{proposedPlan.budgetBreakdown.deficit.toLocaleString('en-IN')}</span>
                    ) : (
                      <span className="text-emerald-600 font-bold">Remaining: ₹{proposedPlan.budgetBreakdown.remainingBudget.toLocaleString('en-IN')}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Decision Bar (Approve vs Reject) */}
        <div className="p-6 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-slate-500">
            <strong>Critical Invariant:</strong> Rejecting preserves your original itinerary 100% untouched. Approving applies the selected strategy ({activeCandidate.strategy}).
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={onReject}
              disabled={isApproving || isRejecting}
              className={`w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-300 font-bold text-xs transition-all flex items-center justify-center gap-1.5 ${
                isApproving || isRejecting
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900 cursor-pointer hover:scale-105 active:scale-95 shadow-2xs'
              }`}
            >
              <X className="w-4 h-4 text-slate-500" />
              <span>{isRejecting ? 'Rejecting...' : 'Reject Proposal (Keep Original)'}</span>
            </button>

            <button
              onClick={handleApproveCurrent}
              disabled={isApproveDisabled}
              className={`w-full sm:w-auto px-6 py-2.5 rounded-xl text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5 ${
                isApproveDisabled
                  ? 'bg-slate-400 cursor-not-allowed opacity-60'
                  : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-600/25 cursor-pointer hover:scale-105 active:scale-95 hover:shadow-lg'
              }`}
            >
              <Check className="w-4 h-4" />
              <span>{isApproving ? 'Applying Proposal...' : `Approve & Apply (${activeCandidate.strategy})`}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
