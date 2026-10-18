import React, { useState } from 'react';
import {
  Sparkles,
  Send,
  CloudRain,
  DollarSign,
  Calendar,
  Users,
  MapPin,
  HelpCircle,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Zap
} from 'lucide-react';
import { parseTripIntent } from '../services/agentClient.js';

export default function NaturalLanguageCommandBar({
  activeTrip,
  isRecovering = false,
  onRunRecovery
}) {
  const [commandText, setCommandText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [parsedResult, setParsedResult] = useState(null);
  const [parseError, setParseError] = useState(null);

  const EXAMPLE_CHIPS = [
    'Cut my budget by 4k, add a day, and it\'s raining',
    'Make it cheaper, we\'re 3 people now',
    'Switch destination to Goa, 4 days with Luxury stay'
  ];

  const handleParse = async (textToParse = commandText) => {
    const text = String(textToParse || '').trim();
    if (!text || !activeTrip) return;

    setIsParsing(true);
    setParseError(null);

    try {
      const res = await parseTripIntent({
        text,
        activeTrip
      });

      if (res.success && res.intent) {
        setParsedResult({
          intent: res.intent,
          mode: res.mode,
          provider: res.provider
        });
      } else {
        setParseError('Unable to extract intent from your command.');
      }
    } catch (err) {
      setParseError(err.message || 'Intent extraction failed.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleChipClick = (example) => {
    setCommandText(example);
    handleParse(example);
  };

  const handleClear = () => {
    setCommandText('');
    setParsedResult(null);
    setParseError(null);
  };

  const handleExecuteRecovery = () => {
    if (!parsedResult?.intent || !onRunRecovery) return;
    const { intent } = parsedResult;

    // Convert intent to recovery overrides
    const overrides = {
      userReason: intent.userReason || commandText
    };

    if (intent.budgetDelta !== undefined) overrides.budgetDelta = intent.budgetDelta;
    if (intent.durationDelta !== undefined) overrides.durationDelta = intent.durationDelta;
    if (intent.budget !== undefined) overrides.budget = intent.budget;
    if (intent.duration !== undefined) overrides.duration = intent.duration;
    if (intent.travellers !== undefined) overrides.travellers = intent.travellers;
    if (intent.destination) overrides.destination = intent.destination;
    if (intent.origin) overrides.origin = intent.origin;
    if (intent.transportPreference) overrides.transportPreference = intent.transportPreference;
    if (intent.accommodationPreference) overrides.accommodationPreference = intent.accommodationPreference;
    if (intent.interests) overrides.interests = intent.interests;
    if (intent.simulatedDisruption) overrides.simulatedDisruption = intent.simulatedDisruption;

    onRunRecovery(overrides);
  };

  const intent = parsedResult?.intent;
  const hasIntentSignals = intent && (
    intent.budgetDelta !== undefined ||
    intent.durationDelta !== undefined ||
    intent.budget !== undefined ||
    intent.duration !== undefined ||
    intent.travellers !== undefined ||
    intent.destination ||
    intent.simulatedDisruption ||
    intent.transportPreference ||
    intent.accommodationPreference
  );

  return (
    <div className="mb-6 bg-gradient-to-br from-indigo-950 via-slate-900 to-purple-950 text-white rounded-3xl p-5 shadow-2xl border border-indigo-700/50 backdrop-blur-md relative overflow-hidden">
      {/* Decorative background glow */}
      <div className="absolute top-0 right-0 w-72 h-72 bg-brand-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
      <div className="absolute bottom-0 left-0 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 relative z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-brand-500 to-purple-500 flex items-center justify-center text-white shadow-md shadow-brand-500/30">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-sm sm:text-base tracking-tight text-white">
                Natural-Language Agent Command Bar
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-gradient-to-r from-emerald-400 to-teal-400 text-slate-950 uppercase shadow-2xs">
                Feature 1
              </span>
            </div>
            <p className="text-xs text-indigo-200">
              Speak or type what to change — the agent extracts parameters and formulates recovery proposals.
            </p>
          </div>
        </div>

        {parsedResult && (
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
              parsedResult.mode === 'live-llm-agent'
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : parsedResult.mode === 'deterministic-fallback'
                ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
            }`}>
              <Zap className="w-3 h-3" />
              {parsedResult.mode === 'live-llm-agent'
                ? 'Live Gemini Intent Parser'
                : parsedResult.mode === 'deterministic-fallback'
                ? 'Deterministic Rule Parser'
                : 'Offline Fallback Parser'}
              {intent?.confidence && ` (${Math.round(intent.confidence * 100)}%)`}
            </span>

            <button
              onClick={handleClear}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              title="Clear command"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Input bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleParse();
        }}
        className="relative z-10"
      >
        <div className="flex items-center gap-2 bg-slate-950/70 rounded-2xl p-2 border border-indigo-500/40 focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-500/30 transition-all shadow-inner">
          <input
            type="text"
            value={commandText}
            onChange={(e) => setCommandText(e.target.value)}
            maxLength={500}
            placeholder="e.g. cut my budget by 4k, add a day, and it's raining..."
            disabled={isParsing || isRecovering}
            className="flex-1 bg-transparent px-3 py-2 text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-hidden disabled:opacity-50"
          />

          <button
            type="submit"
            disabled={!commandText.trim() || isParsing || isRecovering}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-brand-500 via-indigo-600 to-purple-600 text-white font-bold text-xs shadow-md shadow-brand-500/25 hover:from-brand-400 hover:to-purple-500 hover:shadow-lg transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shrink-0"
          >
            {isParsing ? (
              <>
                <Sparkles className="w-3.5 h-3.5 animate-spin text-indigo-200" />
                <span>Parsing...</span>
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>Extract Intent</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Clickable Quick Example Chips */}
      <div className="mt-3 flex items-center gap-1.5 flex-wrap text-xs text-indigo-300 relative z-10">
        <span className="text-[11px] text-slate-400 font-semibold mr-1">Try examples:</span>
        {EXAMPLE_CHIPS.map((chip, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleChipClick(chip)}
            disabled={isParsing || isRecovering}
            className="px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 border border-indigo-400/20 hover:border-brand-400/50 text-[11px] text-indigo-200 transition-all cursor-pointer hover:scale-[1.02] active:scale-95"
          >
            "{chip}"
          </button>
        ))}
      </div>

      {/* Error state */}
      {parseError && (
        <div className="mt-3 p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{parseError}</span>
        </div>
      )}

      {/* Clarification state */}
      {intent?.needsClarification && (
        <div className="mt-4 p-3.5 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-200 text-xs flex items-start gap-2.5">
          <HelpCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-amber-100 block mb-0.5">Agent asks for clarification:</span>
            <p>{intent.needsClarification}</p>
          </div>
        </div>
      )}

      {/* Structured Intent Display & Run Recovery Button */}
      {hasIntentSignals && !intent.needsClarification && (
        <div className="mt-4 p-4 rounded-2xl bg-slate-950/80 border border-indigo-400/30 relative z-10 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-[10px] uppercase tracking-wider font-extrabold text-indigo-300 block mb-1.5">
                Parsed Parameters
              </span>

              <div className="flex flex-wrap items-center gap-1.5">
                {intent.budgetDelta !== undefined && (
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border ${
                    intent.budgetDelta < 0
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                  }`}>
                    <DollarSign className="w-3.5 h-3.5" />
                    {intent.budgetDelta < 0
                      ? `Budget −₹${Math.abs(intent.budgetDelta).toLocaleString('en-IN')}`
                      : `Budget +₹${intent.budgetDelta.toLocaleString('en-IN')}`}
                  </span>
                )}

                {intent.budget !== undefined && intent.budgetDelta === undefined && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                    <DollarSign className="w-3.5 h-3.5" />
                    Target Budget: ₹{intent.budget.toLocaleString('en-IN')}
                  </span>
                )}

                {intent.durationDelta !== undefined && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">
                    <Calendar className="w-3.5 h-3.5" />
                    {intent.durationDelta > 0
                      ? `Duration +${intent.durationDelta} day(s)`
                      : `Duration ${intent.durationDelta} day(s)`}
                  </span>
                )}

                {intent.duration !== undefined && intent.durationDelta === undefined && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">
                    <Calendar className="w-3.5 h-3.5" />
                    Duration: {intent.duration} Days
                  </span>
                )}

                {intent.travellers !== undefined && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40">
                    <Users className="w-3.5 h-3.5" />
                    {intent.travellers} Person{intent.travellers > 1 ? 's' : ''}
                  </span>
                )}

                {intent.destination && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-teal-500/20 text-teal-300 border border-teal-500/40">
                    <MapPin className="w-3.5 h-3.5" />
                    Destination: {intent.destination}
                  </span>
                )}

                {intent.simulatedDisruption?.outdoorUnsuitable && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    <CloudRain className="w-3.5 h-3.5" />
                    Weather Disruption (Indoor-Safe)
                  </span>
                )}

                {intent.transportPreference && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700">
                    Transport: {intent.transportPreference}
                  </span>
                )}

                {intent.accommodationPreference && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700">
                    Lodging: {intent.accommodationPreference}
                  </span>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={handleExecuteRecovery}
              disabled={isRecovering}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-600 to-indigo-600 hover:from-emerald-400 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 hover:scale-[1.03] active:scale-95 cursor-pointer shrink-0"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-200" />
              <span>{isRecovering ? 'Agent Formulating...' : 'Run Recovery Agent'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

