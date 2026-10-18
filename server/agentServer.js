/**
 * TripOS Autonomous Travel Recovery Agent Server
 *
 * Implements:
 * 1. POST /api/agent/recover - Genuine LLM Tool-Calling Loop using @google/genai with honest deterministic fallback.
 * 2. GET /api/agent/status - Server health, execution mode, and provider metadata without leaking secrets.
 * 3. Strict safety limits: max tool iterations, input validation, request size limits, CORS, zero API key exposure.
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { GoogleGenAI } from '@google/genai';

import {
  AGENT_TOOL_DEFINITIONS,
  AGENT_TOOL_NAMES,
  executeAgentTool,
  inspect_active_trip,
  search_travel_options,
  calculate_trip_budget,
  draft_recovery_proposal,
  verify_proposal
} from '../src/services/agentTools.js';
import { calculateTripDeltas, generateCandidateProposals } from '../src/services/recoveryEngine.js';
import { parseIntentDeterministic } from '../src/services/intentParser.js';
import { getDestinationData, registerCustomCatalog, getCachedCatalog, CURATED_DESTINATIONS } from '../src/data/destinationsData.js';
import { buildRouteTransportOptions, calculateRouteDistanceKm } from '../src/services/distanceService.js';

// Load server-side environment variables (.env is git-ignored)
dotenv.config();

export const app = express();

// Security & safety middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000'],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '1mb' }));

// Basic rate limiting: 10 requests/min per IP on agent endpoints (relaxed in test environment)
const agentRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 1000 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many requests to agent endpoints. Please wait a minute before trying again.'
  }
});
app.use('/api/agent/', agentRateLimiter);

const MAX_TOOL_ITERATIONS = 10;
const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

/**
 * Deterministic Fallback Agent Runner
 * Executes the exact same 4 agent tools in a deterministic sequence when no API key is configured.
 * Does NOT pretend to be real LLM reasoning.
 */
export async function runDeterministicAgentLoop({ activeTrip, requestedChanges = {}, simulatedDisruption = null }) {
  const trace = [];
  let step = 1;

  // Step 1: Inspect active trip
  const inspectThought = 'Inspecting active trip parameters, current constraints, and schedule.';
  const inspectResult = inspect_active_trip({ activeTrip });
  trace.push({
    step: step++,
    thought: inspectThought,
    toolCall: { name: 'inspect_active_trip', args: {} },
    observation: inspectResult
  });

  // Calculate target duration, budget, destination, origin, travellers
  let targetDuration = activeTrip.inputs.duration;
  let targetBudget = activeTrip.inputs.budget;
  let targetDestination = (requestedChanges.destination && String(requestedChanges.destination).trim()) || activeTrip.inputs.destination;
  let targetOrigin = (requestedChanges.origin && String(requestedChanges.origin).trim()) || activeTrip.inputs.origin;
  let targetTravellers = (requestedChanges.travellers !== undefined && parseInt(requestedChanges.travellers, 10) >= 1)
    ? parseInt(requestedChanges.travellers, 10)
    : activeTrip.inputs.travellers;
  let userReason = requestedChanges.userReason || null;

  if (requestedChanges.durationDelta !== undefined || requestedChanges.budgetDelta !== undefined) {
    const deltaCalc = calculateTripDeltas(activeTrip.inputs, {
      durationDelta: requestedChanges.durationDelta,
      budgetDelta: requestedChanges.budgetDelta
    });
    if (!deltaCalc.isValid) {
      throw new Error(Object.values(deltaCalc.errors).join(' '));
    }
    targetDuration = deltaCalc.resultingDuration;
    targetBudget = deltaCalc.resultingBudget;
  } else {
    if (requestedChanges.duration !== undefined) {
      const d = parseInt(requestedChanges.duration, 10);
      if (d < 1) throw new Error('Duration must be at least 1 day.');
      targetDuration = d;
    }
    if (requestedChanges.budget !== undefined) {
      const b = parseInt(requestedChanges.budget, 10);
      if (b <= 0) throw new Error('Budget must be greater than ₹0.');
      targetBudget = b;
    }
  }

  const finalDisruption = simulatedDisruption !== null && simulatedDisruption !== undefined
    ? simulatedDisruption
    : (requestedChanges.simulatedDisruption || activeTrip.simulatedDisruption || null);

  const isDisrupted = Boolean(finalDisruption?.outdoorUnsuitable);

  // Step 2: Search travel options
  const searchThought = isDisrupted
    ? `Adverse conditions active: querying sheltered/indoor attractions and lodging alternatives for ${targetDestination}.`
    : `Querying destination catalog for suitable transport and accommodation alternatives in ${targetDestination}.`;
  const searchResult = search_travel_options({
    destination: targetDestination,
    category: 'all',
    indoorOnly: isDisrupted
  });
  trace.push({
    step: step++,
    thought: searchThought,
    toolCall: {
      name: 'search_travel_options',
      args: { destination: targetDestination, category: 'all', indoorOnly: isDisrupted }
    },
    observation: {
      destination: searchResult.destination,
      accommodationsCount: searchResult.accommodations?.length || 0,
      transportCount: searchResult.transportOptions?.length || 0,
      attractionsCount: searchResult.attractions?.length || 0
    }
  });

  // Step 3: Candidate selection & budget calculation
  let chosenTransport = null;
  if (requestedChanges.transportPreference && searchResult.transportOptions?.length) {
    chosenTransport = searchResult.transportOptions.find(t => t.type.toLowerCase() === requestedChanges.transportPreference.toLowerCase());
  }
  if (!chosenTransport) {
    chosenTransport = (targetDestination === activeTrip.inputs.destination ? activeTrip.selectedTransport : null) || searchResult.transportOptions?.[0];
  }

  let chosenAccommodation = null;
  if (requestedChanges.accommodationPreference && searchResult.accommodations?.length) {
    chosenAccommodation = searchResult.accommodations.find(a => a.type.toLowerCase() === requestedChanges.accommodationPreference.toLowerCase());
  }
  if (!chosenAccommodation) {
    chosenAccommodation = (targetDestination === activeTrip.inputs.destination ? activeTrip.selectedAccommodation : null) || searchResult.accommodations?.[0];
  }
  const actionsTaken = [];

  // Initial calculation
  let budgetResult = calculate_trip_budget({
    destination: targetDestination,
    budget: targetBudget,
    duration: targetDuration,
    travellers: targetTravellers,
    selectedTransportId: chosenTransport.id,
    selectedAccommodationId: chosenAccommodation.id
  });

  trace.push({
    step: step++,
    thought: 'Calculating verified expenses for candidate configuration using deterministic budget engine.',
    toolCall: {
      name: 'calculate_trip_budget',
      args: {
        destination: targetDestination,
        budget: targetBudget,
        duration: targetDuration,
        travellers: targetTravellers,
        selectedTransportId: chosenTransport.id,
        selectedAccommodationId: chosenAccommodation.id
      }
    },
    observation: {
      totalEstimatedExpenses: budgetResult.totalEstimatedExpenses,
      remainingBudget: budgetResult.remainingBudget,
      isOverBudget: budgetResult.isOverBudget
    }
  });

  // If over budget, explore budget-saving alternatives
  if (budgetResult.isOverBudget && searchResult.accommodations?.length > 1) {
    const hostelOrBudget = searchResult.accommodations.find(a => a.type === 'Hostel') || searchResult.accommodations[0];
    if (hostelOrBudget && hostelOrBudget.id !== chosenAccommodation.id) {
      chosenAccommodation = hostelOrBudget;
      actionsTaken.push(`Adjusted lodging tier to ${hostelOrBudget.name} to optimize budget.`);

      budgetResult = calculate_trip_budget({
        destination: targetDestination,
        budget: targetBudget,
        duration: targetDuration,
        travellers: targetTravellers,
        selectedTransportId: chosenTransport.id,
        selectedAccommodationId: chosenAccommodation.id
      });

      trace.push({
        step: step++,
        thought: 'Budget deficit detected: recalculated expenses after switching to budget accommodation.',
        toolCall: {
          name: 'calculate_trip_budget',
          args: {
            destination: targetDestination,
            budget: targetBudget,
            duration: targetDuration,
            travellers: targetTravellers,
            selectedTransportId: chosenTransport.id,
            selectedAccommodationId: chosenAccommodation.id
          }
        },
        observation: {
          totalEstimatedExpenses: budgetResult.totalEstimatedExpenses,
          isOverBudget: budgetResult.isOverBudget,
          savingsAchieved: true
        }
      });
    }
  }

  // Document actions taken
  if (targetDestination !== activeTrip.inputs.destination) {
    actionsTaken.push(`Changed destination from ${activeTrip.inputs.destination} to ${targetDestination}.`);
  }
  if (targetDuration !== activeTrip.inputs.duration) {
    actionsTaken.push(`Adjusted duration from ${activeTrip.inputs.duration} to ${targetDuration} days.`);
  }
  if (targetBudget !== activeTrip.inputs.budget) {
    actionsTaken.push(`Recalculated expenses for updated budget of ₹${targetBudget.toLocaleString('en-IN')}.`);
  }
  if (budgetResult.isOverBudget) {
    actionsTaken.push(`Note: Total verified expenses of ₹${budgetResult.totalEstimatedExpenses.toLocaleString('en-IN')} exceed the reduced budget of ₹${targetBudget.toLocaleString('en-IN')} by ₹${budgetResult.deficit.toLocaleString('en-IN')}. Consider shortening trip duration.`);
  }
  if (isDisrupted) {
    actionsTaken.push(`Replaced outdoor activities with verified indoor alternatives due to: "${finalDisruption.reason}".`);
  }
  if (actionsTaken.length === 0) {
    actionsTaken.push('Verified itinerary against active constraints and confirmed feasibility.');
  }

  // Step 4: Draft recovery proposal
  const explanation = budgetResult.isOverBudget
    ? `Autonomous recovery evaluated candidate adjustments for ${targetDestination}. Total verified cost is ₹${budgetResult.totalEstimatedExpenses.toLocaleString('en-IN')}, exceeding the target ₹${targetBudget.toLocaleString('en-IN')} budget by ₹${budgetResult.deficit.toLocaleString('en-IN')}. Consider reducing duration to fit the budget.`
    : `Autonomous recovery evaluated candidate adjustments for ${targetDestination}. Total verified cost is ₹${budgetResult.totalEstimatedExpenses.toLocaleString('en-IN')} against ₹${targetBudget.toLocaleString('en-IN')} budget.`;

  const proposal = draft_recovery_proposal({
    activeTrip,
    newDuration: targetDuration,
    newBudget: targetBudget,
    newDestination: targetDestination,
    newOrigin: targetOrigin,
    newTravellers: targetTravellers,
    selectedTransportId: chosenTransport.id,
    selectedAccommodationId: chosenAccommodation.id,
    actionsTaken,
    agentExplanation: explanation,
    userReason,
    simulatedDisruption: finalDisruption
  });

  trace.push({
    step: step++,
    thought: 'Drafted immutable recovery proposal for user review. Active itinerary remains unmutated.',
    toolCall: {
      name: 'draft_recovery_proposal',
      args: {
        newDuration: targetDuration,
        newBudget: targetBudget,
        selectedTransportId: chosenTransport.id,
        selectedAccommodationId: chosenAccommodation.id,
        actionsTaken
      }
    },
    observation: {
      proposalId: proposal.proposalId,
      status: proposal.status,
      costDifference: proposal.costImpact.costDifference
    }
  });

  // Step 5: Verify candidate parameters deterministically
  const verifyResult = verify_proposal({
    destination: targetDestination,
    duration: targetDuration,
    budget: targetBudget,
    selectedTransportId: chosenTransport.id,
    selectedAccommodationId: chosenAccommodation.id,
    totalEstimatedExpenses: budgetResult.totalEstimatedExpenses,
    simulatedDisruption: finalDisruption
  });

  trace.push({
    step: step++,
    thought: 'Deterministically verified proposal parameters against catalog rates, minimum duration, and weather rules.',
    toolCall: {
      name: 'verify_proposal',
      args: {
        destination: targetDestination,
        duration: targetDuration,
        budget: targetBudget,
        selectedTransportId: chosenTransport.id,
        selectedAccommodationId: chosenAccommodation.id,
        totalEstimatedExpenses: budgetResult.totalEstimatedExpenses
      }
    },
    observation: verifyResult
  });

  // Generate 2-3 candidate strategies
  const candidateResult = generateCandidateProposals(activeTrip, {
    ...requestedChanges,
    destination: targetDestination,
    origin: targetOrigin,
    duration: targetDuration,
    budget: targetBudget,
    travellers: targetTravellers,
    simulatedDisruption: finalDisruption,
    userReason
  });

  // Determine primary strategy label
  const primaryStrategy = isDisrupted
    ? 'Comfort/Indoor-Safe'
    : (budgetResult.isOverBudget ? 'Budget Saver' : 'Time Saver / Fastest');
  proposal.strategy = primaryStrategy;
  proposal.tradeoffs = primaryStrategy === 'Budget Saver'
    ? ['Lowest verified expenses', 'Economy accommodation', 'High transit efficiency']
    : (primaryStrategy === 'Comfort/Indoor-Safe'
      ? [isDisrupted ? '100% sheltered indoor attractions' : 'High comfort lodging', 'Protected from disruptions', 'Higher budget allocation']
      : ['Fastest transit option', 'More destination hours', 'Standard lodging']);

  // Ensure candidate list has unique strategies and marks proposal recommended
  const candidates = candidateResult.candidates.map(c => {
    if (c.proposal.proposedPlan.selectedTransport?.id === chosenTransport.id &&
        c.proposal.proposedPlan.selectedAccommodation?.id === chosenAccommodation.id) {
      return {
        ...c,
        proposal,
        recommended: true
      };
    }
    return c;
  });

  if (!candidates.some(c => c.recommended)) {
    candidates[0].recommended = true;
  }

  return {
    success: true,
    mode: 'deterministic-fallback',
    provider: 'TripOS Rule-Based Tool Runner',
    model: null,
    proposal,
    candidates,
    trace,
    agentSummary: explanation
  };
}

/**
 * Genuine LLM Agent Runner using Google GenAI SDK (@google/genai)
 * Executes true function calling: the LLM calls registered tools and inspects real outputs.
 */
export async function runLlmAgentLoop({ activeTrip, requestedChanges = {}, simulatedDisruption = null, apiKey, modelName, aiClient = null }) {
  if (getQuotaCooldownStatus().isQuotaExceeded) {
    const quotaErr = new Error('RESOURCE_EXHAUSTED: Gemini API quota is currently in cooldown.');
    quotaErr.status = 429;
    quotaErr.code = 'RESOURCE_EXHAUSTED';
    throw quotaErr;
  }

  const modelToUse = modelName || process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
  const ai = aiClient || new GoogleGenAI({ apiKey });

  const trace = [];
  let step = 1;
  const draftedProposals = [];

  // Format tools for Gemini Function Calling
  const functionDeclarations = AGENT_TOOL_DEFINITIONS.map(tool => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters
  }));

  const systemInstruction = `You are the TripOS Autonomous Travel Recovery Agent.
Your job is to inspect the user's active trip, analyze requested changes (duration change, budget change, destination change, or weather disruptions), query verified travel options using search_travel_options, calculate exact costs (NEVER guess or fabricate prices; always use calculate_trip_budget), verify candidate parameters with verify_proposal, and draft recovery proposals.

Strategies to explore:
You should explore up to 3 distinct recovery strategies:
1. "Budget Saver": cheapest verified options (e.g. Bus/Train + Hostel) with maximum cost savings.
2. "Time Saver / Fastest": fastest verified transit options (e.g. Flight or Cab) minimizing transit time.
3. "Comfort/Indoor-Safe": premium lodging / comfortable transport, and for adverse weather disruptions, strictly indoor/sheltered attractions.

Rules:
- NEVER invent prices. Only calculate_trip_budget produces verified costs.
- You can call draft_recovery_proposal once per distinct strategy (up to 3 proposals total).
- Pass 'strategy' (e.g. "Budget Saver", "Time Saver / Fastest", or "Comfort/Indoor-Safe") and 'tradeoffs' (array of pros and cons) into draft_recovery_proposal.
- Before completing, call verify_proposal to confirm your proposal constraints.
- Your proposals are recommendations only; the active trip will NOT be modified until the user approves.`;

  const userPrompt = `Active Trip Target: ${activeTrip.inputs.origin} to ${activeTrip.inputs.destination} (${activeTrip.inputs.duration}d, budget ₹${activeTrip.inputs.budget}).
Requested Changes: ${JSON.stringify(requestedChanges)}.
Active Disruption: ${JSON.stringify(simulatedDisruption || activeTrip.simulatedDisruption || null)}.
Please inspect the trip, explore alternative strategy options, verify costs with calculate_trip_budget and verify_proposal, and draft candidate recovery proposals.`;

  const contents = [
    { role: 'user', parts: [{ text: userPrompt }] }
  ];

  let iterations = 0;

  while (iterations < MAX_TOOL_ITERATIONS) {
    iterations++;

    let response;
    try {
      response = await ai.models.generateContent({
        model: modelToUse,
        contents,
        config: {
          systemInstruction,
          tools: [{ functionDeclarations }]
        }
      });
    } catch (err) {
      if (isGeminiQuotaExceededError(err)) {
        setQuotaCooldown();
      }
      throw err;
    }

    const candidate = response.candidates?.[0];
    if (!candidate) break;

    const parts = candidate.content?.parts || [];
    const functionCalls = response.functionCalls || parts.filter(p => p.functionCall).map(p => p.functionCall);

    // If model returned text thoughts
    const textParts = parts.filter(p => p.text).map(p => p.text).join(' ');

    // If no function call requested, model is done
    if (!functionCalls || functionCalls.length === 0) {
      break;
    }

    // Preserve the complete original candidate.content as one model turn
    const modelContent = candidate.content || { role: 'model', parts };
    contents.push(modelContent);

    const functionResponseParts = [];

    // Execute each requested tool call
    for (const call of functionCalls) {
      if (!AGENT_TOOL_NAMES.includes(call.name)) {
        throw new Error(`Model attempted unauthorized tool execution: "${call.name}".`);
      }

      // Execute actual deterministic tool
      let toolOutput;
      try {
        toolOutput = executeAgentTool(call.name, call.args || {}, { activeTrip });
      } catch (err) {
        toolOutput = { error: err.message };
      }

      trace.push({
        step: step++,
        thought: textParts || `Executing tool "${call.name}" based on model decision.`,
        toolCall: {
          name: call.name,
          args: call.args || {}
        },
        observation: toolOutput
      });

      if (call.name === 'draft_recovery_proposal' && !toolOutput.error) {
        draftedProposals.push(toolOutput);
      }

      functionResponseParts.push({
        functionResponse: {
          name: call.name,
          response: { output: toolOutput },
          ...(call.id ? { id: call.id } : {})
        }
      });
    }

    // Collect all functionResponse parts into ONE user turn
    contents.push({
      role: 'user',
      parts: functionResponseParts
    });

    // If 3 proposals have been drafted, conclude loop
    if (draftedProposals.length >= 3) {
      break;
    }
  }

  // If the LLM loop did not conclude with draft_recovery_proposal, invoke it deterministically
  if (draftedProposals.length === 0) {
    const fallbackRun = await runDeterministicAgentLoop({ activeTrip, requestedChanges, simulatedDisruption });
    return {
      success: true,
      mode: 'live-llm-assisted-fallback',
      provider: `Google Gemini (${modelToUse})`,
      model: modelToUse,
      proposal: fallbackRun.proposal,
      candidates: fallbackRun.candidates,
      trace: [...trace, ...fallbackRun.trace],
      agentSummary: 'Model explored options; final proposal consolidated via deterministic safety guard.'
    };
  }

  // Deduplicate candidate proposals
  const uniqueProposals = [];
  const seen = new Set();
  for (const p of draftedProposals) {
    const key = `${p.proposedPlan.selectedTransport?.id}_${p.proposedPlan.selectedAccommodation?.id}_${p.proposedPlan.inputs.duration}_${p.proposedPlan.inputs.budget}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueProposals.push(p);
    }
  }

  const isDisrupted = Boolean((simulatedDisruption || activeTrip.simulatedDisruption)?.outdoorUnsuitable);
  let recommended = uniqueProposals[0];
  if (isDisrupted) {
    recommended = uniqueProposals.find(p => p.strategy?.includes('Comfort') || p.strategy?.includes('Indoor')) || uniqueProposals[0];
  } else if (
    (requestedChanges.budgetDelta !== undefined && requestedChanges.budgetDelta < 0) ||
    (requestedChanges.budget !== undefined && requestedChanges.budget < activeTrip.inputs.budget)
  ) {
    recommended = uniqueProposals.find(p => p.strategy?.includes('Budget')) || uniqueProposals[0];
  }

  const candidates = uniqueProposals.map(p => ({
    strategy: p.strategy || 'Alternative Plan',
    proposal: p,
    tradeoffs: Array.isArray(p.tradeoffs) ? p.tradeoffs : [],
    costDifference: p.costImpact?.costDifference ?? 0,
    recommended: p.proposalId === recommended.proposalId
  }));

  return {
    success: true,
    mode: 'live-llm-agent',
    provider: `Google Gemini (${modelToUse})`,
    model: modelToUse,
    proposal: recommended,
    candidates,
    trace,
    agentSummary: recommended.agentExplanation || 'Recovery proposal drafted via genuine Gemini tool calling.'
  };
}

// -------------------------------------------------------------------------
// Quota & Error Management
// -------------------------------------------------------------------------

let quotaExceededUntil = 0;
const DEFAULT_QUOTA_COOLDOWN_MS = 60 * 1000; // 60-second cooldown

/**
 * Strips API keys, bearer tokens, and secrets from logs and error strings.
 */
export function sanitizeSecrets(text) {
  if (!text) return '';
  let str = typeof text === 'string' ? text : String(text);
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim()) {
    str = str.split(process.env.GEMINI_API_KEY.trim()).join('[REDACTED_API_KEY]');
  }
  return str
    .replace(/AIza[0-9A-Za-z\-_]{30,45}/g, '[REDACTED_API_KEY]')
    .replace(/(?:key|apiKey|token|secret|authorization)=(?!\[REDACTED)([^\s&"'`]+)/gi, 'key=REDACTED')
    .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer REDACTED');
}

/**
 * Detects whether an error from Gemini API is a quota-exceeded / rate-limit error (HTTP 429 RESOURCE_EXHAUSTED).
 * Inspects status codes, error codes, response structures, and standard Gemini error message patterns.
 */
export function isGeminiQuotaExceededError(err) {
  if (!err) return false;

  // 1. Direct status or code property (429 or 'RESOURCE_EXHAUSTED')
  if (
    err.status === 429 ||
    err.statusCode === 429 ||
    err.code === 429 ||
    err.httpStatus === 429 ||
    err.status === '429' ||
    err.statusCode === '429' ||
    err.code === '429'
  ) {
    return true;
  }

  const statusStr = String(err.status || err.code || err.statusCode || '').toUpperCase();
  if (statusStr === 'RESOURCE_EXHAUSTED' || statusStr.includes('RESOURCE_EXHAUSTED')) {
    return true;
  }

  // 2. HTTP response object (fetch / axios / genai response)
  if (err.response && typeof err.response === 'object') {
    if (
      err.response.status === 429 ||
      err.response.statusCode === 429 ||
      err.response.status === '429' ||
      err.response.statusCode === '429'
    ) {
      return true;
    }
    const respStatusText = String(err.response.statusText || '').toUpperCase();
    if (respStatusText.includes('TOO MANY REQUESTS') || respStatusText.includes('RESOURCE_EXHAUSTED')) {
      return true;
    }
    if (err.response.data && typeof err.response.data === 'object') {
      if (isGeminiQuotaExceededError(err.response.data)) return true;
    }
  }

  // 3. Google API errorDetails array (ErrorInfo with RATE_LIMIT_EXHAUSTED or QUOTA_EXCEEDED)
  if (Array.isArray(err.errorDetails)) {
    for (const detail of err.errorDetails) {
      if (typeof detail === 'object' && detail !== null) {
        const reason = String(detail.reason || detail.metadata?.quota_limit || '').toUpperCase();
        if (
          reason.includes('RESOURCE_EXHAUSTED') ||
          reason.includes('RATE_LIMIT') ||
          reason.includes('QUOTA')
        ) {
          return true;
        }
      }
    }
  }

  // 4. Nested error objects (e.g. GoogleGenAI / gRPC / Axios responses)
  if (err.error && typeof err.error === 'object') {
    if (isGeminiQuotaExceededError(err.error)) return true;
  }

  // 5. Error message strings or details
  const msg = (String(err.message || '') + ' ' + String(err.details || '') + ' ' + String(err)).toUpperCase();
  if (
    msg.includes('429') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('RESOURCE EXHAUSTED') ||
    msg.includes('QUOTA') ||
    msg.includes('RATE LIMIT') ||
    msg.includes('RATE_LIMIT') ||
    msg.includes('TOO MANY REQUESTS')
  ) {
    return true;
  }

  // 6. Cause property (Node.js 18+ Error.cause)
  if (err.cause && typeof err.cause === 'object') {
    if (isGeminiQuotaExceededError(err.cause)) return true;
  }

  return false;
}

export function setQuotaCooldown(ms = DEFAULT_QUOTA_COOLDOWN_MS) {
  const duration = typeof ms === 'number' && ms > 0 ? ms : DEFAULT_QUOTA_COOLDOWN_MS;
  quotaExceededUntil = Date.now() + duration;
}

export function resetQuotaCooldown() {
  quotaExceededUntil = 0;
}

export function getQuotaCooldownStatus() {
  const isCooldown = Date.now() < quotaExceededUntil;
  return {
    isQuotaExceeded: isCooldown,
    cooldownRemainingMs: isCooldown ? Math.max(0, quotaExceededUntil - Date.now()) : 0,
    quotaExceededUntil
  };
}

// -------------------------------------------------------------------------
// HTTP Endpoints & Handlers
// -------------------------------------------------------------------------

/**
 * GET /api/agent/status
 * Returns health, execution mode, and provider. Never leaks API keys.
 */
app.get('/api/agent/status', (req, res) => {
  const hasKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim());
  const quotaStatus = getQuotaCooldownStatus();

  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    configured: hasKey,
    quotaExceeded: quotaStatus.isQuotaExceeded,
    mode: (hasKey && !quotaStatus.isQuotaExceeded) ? 'live-llm-agent' : 'deterministic-fallback',
    provider: (hasKey && !quotaStatus.isQuotaExceeded)
      ? 'Google Gemini (@google/genai)'
      : (quotaStatus.isQuotaExceeded ? 'TripOS Rule-Based Tool Runner (Quota Cooldown)' : 'TripOS Rule-Based Tool Runner'),
    model: hasKey ? (process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL) : null,
    registeredTools: AGENT_TOOL_NAMES,
    safetyLimits: {
      maxToolIterations: MAX_TOOL_ITERATIONS,
      budgetValidation: 'Deterministic budgetEngine enforcement',
      activeTripMutation: 'Forbidden (immutable proposals only)'
    }
  });
});

/**
 * Core Request Handler for POST /api/agent/recover
 * Receives trip recovery request, runs genuine tool loop or deterministic fallback.
 * Gracefully intercepts Gemini HTTP 429 quota errors and immediately uses the deterministic runner.
 */
export async function handleRecoverRequest(req, res) {
  try {
    const { activeTrip, requestedChanges = {}, simulatedDisruption = null } = req.body || {};

    if (!activeTrip || !activeTrip.inputs || !activeTrip.id) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request: "activeTrip" with valid inputs and ID is required.'
      });
    }

    const forceFallback = Boolean(req.body && req.body.forceFallback);
    const customAiClient = req.app?.locals?.aiClient || req.body?.mockAiClient || null;
    const apiKey = !forceFallback && (customAiClient || (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim()))
      ? (process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : 'mock-key')
      : null;

    const isQuotaInCooldown = Date.now() < quotaExceededUntil;

    // If quota cooldown is active, immediately bypass live LLM without retrying
    if (apiKey && isQuotaInCooldown) {
      const fallbackResult = await runDeterministicAgentLoop({
        activeTrip,
        requestedChanges,
        simulatedDisruption
      });

      return res.json({
        ...fallbackResult,
        mode: 'deterministic-fallback-on-error',
        notice: 'Gemini API quota currently in cooldown (HTTP 429); executed deterministic tool runner directly without retrying.',
        agentSummary: 'Gemini free-tier quota exceeded; recovery plan safely formulated using verified deterministic rules.'
      });
    }

    // Mode A: Live LLM Agent with Tool Calling (when API key is configured and not in quota cooldown)
    if (apiKey) {
      try {
        const agentResult = await runLlmAgentLoop({
          activeTrip,
          requestedChanges,
          simulatedDisruption,
          apiKey,
          modelName: process.env.GEMINI_MODEL,
          aiClient: customAiClient
        });
        return res.json(agentResult);
      } catch (err) {
        const isQuota = isGeminiQuotaExceededError(err);

        if (isQuota) {
          // Enter quota cooldown to prevent subsequent requests from repeatedly hitting 429
          setQuotaCooldown();
          console.warn('[TripOS Agent Server] Gemini API quota exceeded (HTTP 429 RESOURCE_EXHAUSTED). Entering cooldown, immediately using deterministic runner.');
        } else {
          // Safe logging for other failures: never print or expose API keys
          const safeMessage = sanitizeSecrets(err.message || 'Unknown error');
          console.warn('[TripOS Agent Server] Live LLM execution failed, falling back to deterministic runner:', safeMessage);
        }

        const fallbackResult = await runDeterministicAgentLoop({
          activeTrip,
          requestedChanges,
          simulatedDisruption
        });

        return res.json({
          ...fallbackResult,
          mode: 'deterministic-fallback-on-error',
          notice: isQuota
            ? 'Gemini API quota exceeded (HTTP 429); safely executed deterministic tool runner.'
            : 'Live LLM provider encountered an error; safely executed deterministic tool runner.',
          agentSummary: isQuota
            ? 'Gemini free-tier quota exceeded; recovery plan safely formulated using verified deterministic rules.'
            : fallbackResult.agentSummary
        });
      }
    }

    // Mode B: Deterministic Fallback Agent (when no API key is configured)
    const fallbackResult = await runDeterministicAgentLoop({
      activeTrip,
      requestedChanges,
      simulatedDisruption
    });

    return res.json(fallbackResult);
  } catch (err) {
    // Safe error logging: ensure no keys leaked
    const safeError = sanitizeSecrets(err.message || 'Internal agent recovery error');
    console.error('[TripOS Agent Server] Recovery request error:', safeError);
    return res.status(500).json({
      success: false,
      error: safeError
    });
  }
}

/**
 * POST /api/agent/recover
 */
app.post('/api/agent/recover', handleRecoverRequest);

/**
 * Core Request Handler for POST /api/agent/parse-intent
 * Extracts structured travel parameters from natural language input.
 * Supports Gemini structured extraction with honest deterministic fallback on error or cooldown.
 */
export async function handleParseIntentRequest(req, res) {
  try {
    const { text, activeTrip } = req.body || {};

    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request: "text" string (max 500 characters) is required.'
      });
    }

    if (text.length > 500) {
      return res.status(400).json({
        success: false,
        error: 'Input text exceeds 500 characters limit.'
      });
    }

    if (!activeTrip || !activeTrip.inputs || !activeTrip.id) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request: "activeTrip" with valid inputs and ID is required.'
      });
    }

    const forceFallback = Boolean(req.body && req.body.forceFallback);
    const customAiClient = req.app?.locals?.aiClient || req.body?.mockAiClient || null;
    const apiKey = !forceFallback && (customAiClient || (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim()))
      ? (process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : 'mock-key')
      : null;

    const isQuotaInCooldown = getQuotaCooldownStatus().isQuotaExceeded;

    // Mode A: Quota cooldown, forceFallback, or no API key -> Deterministic Fallback
    if (forceFallback || !apiKey || isQuotaInCooldown) {
      const intent = parseIntentDeterministic(text, activeTrip);
      return res.json({
        success: true,
        mode: isQuotaInCooldown ? 'deterministic-fallback-on-error' : 'deterministic-fallback',
        provider: isQuotaInCooldown ? 'TripOS Rule-Based Intent Parser (Quota Cooldown)' : 'TripOS Rule-Based Intent Parser',
        intent
      });
    }

    // Mode B: Live LLM Structured Intent Extraction
    const modelToUse = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
    const ai = customAiClient || new GoogleGenAI({ apiKey });

    try {
      const systemInstruction = `You are the TripOS Natural Language Travel Intent Parser.
Extract structured trip changes from the user's natural language request.
Active Trip Baseline:
- Origin: ${activeTrip.inputs.origin}
- Destination: ${activeTrip.inputs.destination}
- Duration: ${activeTrip.inputs.duration} days
- Budget: ₹${activeTrip.inputs.budget}
- Travellers: ${activeTrip.inputs.travellers}
- Transport: ${activeTrip.inputs.transportPreference}
- Accommodation: ${activeTrip.inputs.accommodationPreference}

User Command: "${text.slice(0, 500)}"

Rules:
1. NEVER compute or calculate final trip prices. Only extract delta or target values requested by the user.
2. "4k" means 4000 INR. "a day" means 1 day.
3. If user says "cut/reduce budget by X", set budgetDelta to -X. If "increase budget by X", set budgetDelta to +X.
4. If user says "add a day", durationDelta is +1. If "shorten by 2 days", durationDelta is -2.
5. If user mentions bad weather (rain, blizzard, snow, storm, landslide), set simulatedDisruption with outdoorUnsuitable: true and reason.
6. Provide confidence between 0.0 and 1.0. If the request is unclear or contradictory, set needsClarification with a friendly question for the user.
7. Return pure JSON matching the requested schema.`;

      const response = await ai.models.generateContent({
        model: modelToUse,
        contents: [
          { role: 'user', parts: [{ text: systemInstruction }] }
        ],
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'object',
            properties: {
              durationDelta: { type: 'number' },
              budgetDelta: { type: 'number' },
              duration: { type: 'number' },
              budget: { type: 'number' },
              travellers: { type: 'number' },
              destination: { type: 'string' },
              origin: { type: 'string' },
              transportPreference: { type: 'string' },
              accommodationPreference: { type: 'string' },
              interests: { type: 'array', items: { type: 'string' } },
              simulatedDisruption: {
                type: 'object',
                properties: {
                  outdoorUnsuitable: { type: 'boolean' },
                  reason: { type: 'string' }
                }
              },
              userReason: { type: 'string' },
              goal: { type: 'string', enum: ['cheaper', 'faster', 'indoor', 'balanced'] },
              confidence: { type: 'number' },
              needsClarification: { type: 'string' }
            },
            required: ['confidence']
          }
        }
      });

      const candidateText = response.candidates?.[0]?.content?.parts?.[0]?.text || response.text;
      let parsedJson = null;
      try {
        parsedJson = JSON.parse(candidateText);
      } catch (jsonErr) {
        parsedJson = parseIntentDeterministic(text, activeTrip);
      }

      // Validate output with calculateTripDeltas rules
      const origDuration = parseInt(activeTrip.inputs.duration, 10) || 1;
      const origBudget = parseInt(activeTrip.inputs.budget, 10) || 0;

      let resDuration = origDuration;
      if (parsedJson.durationDelta !== undefined) resDuration += parsedJson.durationDelta;
      else if (parsedJson.duration !== undefined) resDuration = parsedJson.duration;

      let resBudget = origBudget;
      if (parsedJson.budgetDelta !== undefined) resBudget += parsedJson.budgetDelta;
      else if (parsedJson.budget !== undefined) resBudget = parsedJson.budget;

      if (resDuration < 1) {
        parsedJson.confidence = 0.3;
        parsedJson.needsClarification = `Trip duration would become ${resDuration} day(s). Resulting duration must be at least 1 day.`;
      } else if (resBudget <= 0) {
        parsedJson.confidence = 0.3;
        parsedJson.needsClarification = `Trip budget would become ₹${resBudget}. Resulting budget must be greater than ₹0.`;
      }

      return res.json({
        success: true,
        mode: 'live-llm-agent',
        provider: `Google Gemini (${modelToUse})`,
        intent: {
          ...parsedJson,
          userReason: parsedJson.userReason || text.trim()
        }
      });
    } catch (err) {
      const isQuota = isGeminiQuotaExceededError(err);
      if (isQuota) {
        setQuotaCooldown();
        console.warn('[TripOS Agent Server] Gemini API quota exceeded (HTTP 429) during intent parsing. Entering cooldown, falling back to deterministic parser.');
      } else {
        const safeMsg = sanitizeSecrets(err.message || 'Unknown error');
        console.warn('[TripOS Agent Server] Gemini intent parsing failed, falling back to deterministic parser:', safeMsg);
      }

      const intent = parseIntentDeterministic(text, activeTrip);
      return res.json({
        success: true,
        mode: isQuota ? 'deterministic-fallback-on-error' : 'deterministic-fallback',
        provider: isQuota ? 'TripOS Rule-Based Intent Parser (Quota Cooldown)' : 'TripOS Rule-Based Intent Parser',
        intent
      });
    }
  } catch (err) {
    const safeError = sanitizeSecrets(err.message || 'Internal intent parsing error');
    console.error('[TripOS Agent Server] Intent parse error:', safeError);
    return res.status(500).json({
      success: false,
      error: safeError
    });
  }
}

/**
 * POST /api/agent/parse-intent
 */
app.post('/api/agent/parse-intent', handleParseIntentRequest);

/**
 * Validates and clamps an AI-generated catalog structure.
 * Rejects nonsense and returns null if fatal schema violations occur.
 */
export function validateAndClampCatalog(raw, origin, destination) {
  if (!raw || typeof raw !== 'object') return null;

  const destClean = destination.trim();
  const name = typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : destClean;

  // 1. Accommodations validation
  if (!Array.isArray(raw.accommodations) || raw.accommodations.length === 0) {
    return null;
  }

  const validAccommodations = [];
  const seenAccIds = new Set();
  for (const acc of raw.accommodations) {
    if (!acc || typeof acc !== 'object') continue;
    const type = ['Hostel', 'Standard', 'Luxury'].includes(acc.type) ? acc.type : 'Standard';
    const rawCost = parseInt(acc.costPerNight, 10);
    if (isNaN(rawCost) || rawCost <= 0) continue;
    const costPerNight = Math.max(300, Math.min(50000, rawCost));
    const rating = Math.max(1.0, Math.min(5.0, parseFloat(acc.rating) || 4.2));
    const id = acc.id && !seenAccIds.has(acc.id)
      ? String(acc.id)
      : `acc-${type.toLowerCase()}-${destClean.toLowerCase()}-${seenAccIds.size + 1}`;
    seenAccIds.add(id);

    validAccommodations.push({
      id,
      name: String(acc.name || `${name} ${type} Hotel`),
      type,
      costPerNight,
      rating: Math.round(rating * 10) / 10,
      amenities: Array.isArray(acc.amenities) && acc.amenities.length > 0
        ? acc.amenities.map(String)
        : ['WiFi', 'Air Conditioning', 'Room Service']
    });
  }

  if (validAccommodations.length === 0) return null;

  // 2. Transport Options validation
  const distanceKm = calculateRouteDistanceKm(origin, destination);
  let transportOptions = [];

  if (Array.isArray(raw.transportOptions) && raw.transportOptions.length > 0) {
    const seenTransIds = new Set();
    for (const t of raw.transportOptions) {
      if (!t || typeof t !== 'object') continue;
      const type = ['Bus', 'Train', 'Cab', 'Flight'].includes(t.type) ? t.type : 'Bus';
      const isFlat = Boolean(t.flatCost) || type === 'Cab';
      const costPerPerson = !isFlat ? Math.max(100, parseInt(t.costPerPerson, 10) || 1000) : null;
      const flatCost = isFlat ? Math.max(1000, parseInt(t.flatCost, 10) || 5000) : null;
      const id = t.id && !seenTransIds.has(t.id)
        ? String(t.id)
        : `trans-${type.toLowerCase()}-${destClean.toLowerCase()}-${seenTransIds.size + 1}`;
      seenTransIds.add(id);

      transportOptions.push({
        id,
        name: String(t.name || `${type} to ${name}`),
        type,
        costPerPerson,
        flatCost,
        duration: String(t.duration || 'Estimated route time'),
        description: String(t.description || `${type} service from ${origin} to ${destination}`)
      });
    }
  }

  if (transportOptions.length === 0) {
    transportOptions = buildRouteTransportOptions(origin, destination);
  }

  // 3. Attractions validation (require at least 1 indoor and 1 outdoor)
  if (!Array.isArray(raw.attractions) || raw.attractions.length < 2) {
    return null;
  }

  const validAttractions = [];
  const seenAttIds = new Set();
  let hasOutdoor = false;
  let hasIndoor = false;

  for (const att of raw.attractions) {
    if (!att || typeof att !== 'object' || !att.name) continue;
    const isOutdoor = Boolean(att.isOutdoor);
    if (isOutdoor) hasOutdoor = true;
    else hasIndoor = true;

    const id = att.id && !seenAttIds.has(att.id)
      ? String(att.id)
      : `act-${destClean.toLowerCase()}-${seenAttIds.size + 1}`;
    seenAttIds.add(id);

    validAttractions.push({
      id,
      name: String(att.name),
      category: String(att.category || (isOutdoor ? 'Nature' : 'Culture')),
      isOutdoor,
      costPerPerson: Math.max(0, parseInt(att.costPerPerson, 10) || 0),
      duration: String(att.duration || '2-3 hours'),
      description: String(att.description || `Explore ${att.name} in ${name}`)
    });
  }

  // Ensure at least one indoor attraction exists for weather disruption resilience
  if (!hasIndoor) {
    validAttractions.push({
      id: `act-${destClean.toLowerCase()}-indoor-cultural`,
      name: `${name} Regional Heritage Museum & Cultural Center`,
      category: 'Culture',
      isOutdoor: false,
      costPerPerson: 100,
      duration: '2 hours',
      description: `Indoor sheltered cultural exhibits and heritage displays in ${name}.`
    });
  }

  // 4. Restaurants validation
  const restaurants = Array.isArray(raw.restaurants) && raw.restaurants.length > 0
    ? raw.restaurants.map(r => ({
        name: String(r.name || `Local Dining in ${name}`),
        cuisine: String(r.cuisine || 'Regional Cuisine'),
        avgCostPerPerson: Math.max(150, parseInt(r.avgCostPerPerson, 10) || 450),
        note: String(r.note || 'Popular local spot')
      }))
    : [
        { name: `Traditional Tastes of ${name}`, cuisine: 'Regional Speciality', avgCostPerPerson: 350, note: 'Beloved local eatery' },
        { name: `${name} Central Cafe`, cuisine: 'Multi-Cuisine & Snacks', avgCostPerPerson: 550, note: 'Comfortable indoor cafe' }
      ];

  return {
    name,
    state: String(raw.state || 'Regional Destination'),
    country: String(raw.country || 'India'),
    tagline: String(raw.tagline || `Explore the beauty and culture of ${name}`),
    bestTime: String(raw.bestTime || 'October to April'),
    currency: 'INR (₹)',
    transportOptions,
    accommodations: validAccommodations,
    attractions: validAttractions,
    restaurants
  };
}

/**
 * POST /api/agent/generate-catalog
 * Endpoint generating or retrieving catalog for destination & origin.
 */
export async function handleGenerateCatalogRequest(req, res, customAiClient = null) {
  try {
    const { origin, destination } = req.body || {};

    if (!destination || typeof destination !== 'string' || !destination.trim()) {
      return res.status(400).json({
        success: false,
        error: 'destination is required and must be a non-empty string.'
      });
    }

    if (!origin || typeof origin !== 'string' || !origin.trim()) {
      return res.status(400).json({
        success: false,
        error: 'origin is required and must be a non-empty string.'
      });
    }

    const cleanOrigin = origin.trim();
    const cleanDest = destination.trim();
    const destKey = cleanDest.toLowerCase();

    // 1. Curated destination check
    if (CURATED_DESTINATIONS[destKey]) {
      const curated = getDestinationData(cleanDest, cleanOrigin);
      return res.json({
        success: true,
        mode: 'curated',
        catalog: curated
      });
    }

    // 2. Server in-memory cache check
    const cached = getCachedCatalog(cleanOrigin, cleanDest);
    if (cached) {
      return res.json({
        success: true,
        mode: cached.source === 'gemini-ai' ? 'live-llm-agent' : 'deterministic-fallback',
        catalog: cached
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    const canUseLiveLlm = Boolean(apiKey && !isQuotaInCooldown());

    const runRuleBasedFallback = (mode, isQuota = false) => {
      const fallbackCatalog = getDestinationData(cleanDest, cleanOrigin);
      registerCustomCatalog(cleanOrigin, cleanDest, fallbackCatalog);
      return res.json({
        success: true,
        mode,
        catalog: fallbackCatalog
      });
    };

    if (!canUseLiveLlm) {
      return runRuleBasedFallback('deterministic-fallback');
    }

    // 3. Live LLM Generation via Gemini 2.5 Flash
    const modelToUse = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
    const ai = customAiClient || new GoogleGenAI({ apiKey });

    try {
      const prompt = `You are the TripOS Travel Catalog Generator.
Generate a realistic, destination-specific travel catalog for travel from "${cleanOrigin}" to "${cleanDest}".

Provide:
1. transportOptions: realistic modes (Bus, Train, Cab, Flight) connecting ${cleanOrigin} to ${cleanDest}.
   Each must have unique id, name, type (Bus/Train/Cab/Flight), costPerPerson (or flatCost for Cab), duration, description.
2. accommodations: 3 tiers (Hostel, Standard, Luxury) with real-sounding local hotel/resort names appropriate for ${cleanDest}.
   Each with id, name, type (Hostel/Standard/Luxury), costPerNight (Hostel: 500-1200, Standard: 2000-4500, Luxury: 6000-18000), rating (4.0-5.0), amenities.
3. attractions: at least 4 top sights in ${cleanDest}. At least one MUST be indoor (isOutdoor: false) for bad weather, and at least one outdoor (isOutdoor: true).
   Each with id, name, category (Culture, Nature, Adventure, Relaxation, Food, Shopping), isOutdoor (boolean), costPerPerson, duration, description.
4. restaurants: at least 3 local dining spots with cuisine, avgCostPerPerson, note.
5. metadata: name, state, country, tagline, bestTime, currency ("INR (₹)").

Return pure JSON matching the schema.`;

      const response = await ai.models.generateContent({
        model: modelToUse,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              state: { type: 'string' },
              country: { type: 'string' },
              tagline: { type: 'string' },
              bestTime: { type: 'string' },
              currency: { type: 'string' },
              transportOptions: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    name: { type: 'string' },
                    type: { type: 'string', enum: ['Bus', 'Train', 'Cab', 'Flight'] },
                    costPerPerson: { type: 'number' },
                    flatCost: { type: 'number' },
                    duration: { type: 'string' },
                    description: { type: 'string' }
                  },
                  required: ['id', 'name', 'type', 'duration']
                }
              },
              accommodations: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    name: { type: 'string' },
                    type: { type: 'string', enum: ['Hostel', 'Standard', 'Luxury'] },
                    costPerNight: { type: 'number' },
                    rating: { type: 'number' },
                    amenities: { type: 'array', items: { type: 'string' } }
                  },
                  required: ['id', 'name', 'type', 'costPerNight', 'rating']
                }
              },
              attractions: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    name: { type: 'string' },
                    category: { type: 'string' },
                    isOutdoor: { type: 'boolean' },
                    costPerPerson: { type: 'number' },
                    duration: { type: 'string' },
                    description: { type: 'string' }
                  },
                  required: ['id', 'name', 'isOutdoor', 'costPerPerson']
                }
              },
              restaurants: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    cuisine: { type: 'string' },
                    avgCostPerPerson: { type: 'number' },
                    note: { type: 'string' }
                  },
                  required: ['name', 'cuisine', 'avgCostPerPerson']
                }
              }
            },
            required: ['name', 'transportOptions', 'accommodations', 'attractions']
          }
        }
      });

      const candidateText = response.candidates?.[0]?.content?.parts?.[0]?.text || response.text;
      let rawCatalog = null;
      try {
        rawCatalog = JSON.parse(candidateText);
      } catch (e) {
        console.warn('[TripOS Agent Server] Could not parse Gemini catalog JSON:', e.message);
        return runRuleBasedFallback('deterministic-fallback');
      }

      const validatedCatalog = validateAndClampCatalog(rawCatalog, cleanOrigin, cleanDest);
      if (!validatedCatalog) {
        console.warn('[TripOS Agent Server] Gemini catalog failed validation, falling back to rule-based.');
        return runRuleBasedFallback('deterministic-fallback');
      }

      validatedCatalog.isCurated = false;
      validatedCatalog.isSampleEstimate = true;
      validatedCatalog.dataSourceNotice = 'AI-estimated catalog (Gemini) — not verified live prices';
      validatedCatalog.source = 'gemini-ai';

      registerCustomCatalog(cleanOrigin, cleanDest, validatedCatalog);

      return res.json({
        success: true,
        mode: 'live-llm-agent',
        provider: `Google Gemini (${modelToUse})`,
        catalog: validatedCatalog
      });
    } catch (err) {
      const isQuota = isGeminiQuotaExceededError(err);
      if (isQuota) {
        setQuotaCooldown();
        console.warn('[TripOS Agent Server] Gemini API quota exceeded (HTTP 429) during catalog generation. Entering cooldown, falling back to rule-based.');
      } else {
        const safeMsg = sanitizeSecrets(err.message || 'Unknown error');
        console.warn('[TripOS Agent Server] Gemini catalog generation failed, falling back to rule-based:', safeMsg);
      }
      return runRuleBasedFallback(isQuota ? 'deterministic-fallback-on-error' : 'deterministic-fallback', isQuota);
    }
  } catch (err) {
    const safeError = sanitizeSecrets(err.message || 'Internal catalog generation error');
    console.error('[TripOS Agent Server] Catalog generation error:', safeError);
    return res.status(500).json({
      success: false,
      error: safeError
    });
  }
}

/**
 * POST /api/agent/generate-catalog
 */
app.post('/api/agent/generate-catalog', handleGenerateCatalogRequest);

// Self-starting logic when run directly (e.g. "node server/agentServer.js")
const isDirectRun = process.argv[1] && process.argv[1].endsWith('agentServer.js') && !process.argv[1].includes('.test.');
if (isDirectRun && process.env.NODE_ENV !== 'test') {
  const port = process.env.AGENT_PORT || 3001;
  app.listen(port, () => {
    console.log(`[TripOS] Agent Server listening at http://localhost:${port}`);
    console.log(`[TripOS] Mode: ${process.env.GEMINI_API_KEY ? 'Live LLM Tool Calling' : 'Deterministic Tool Runner'}`);
  });
}
