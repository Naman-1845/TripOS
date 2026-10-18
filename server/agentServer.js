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
import { GoogleGenAI } from '@google/genai';

import {
  AGENT_TOOL_DEFINITIONS,
  AGENT_TOOL_NAMES,
  executeAgentTool,
  inspect_active_trip,
  search_travel_options,
  calculate_trip_budget,
  draft_recovery_proposal
} from '../src/services/agentTools.js';
import { calculateTripDeltas } from '../src/services/recoveryEngine.js';

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

const MAX_TOOL_ITERATIONS = 6;
const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';

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

  return {
    success: true,
    mode: 'deterministic-fallback',
    provider: 'TripOS Rule-Based Tool Runner',
    model: null,
    proposal,
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
  let finalProposal = null;

  // Format tools for Gemini Function Calling
  const functionDeclarations = AGENT_TOOL_DEFINITIONS.map(tool => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters
  }));

  const systemInstruction = `You are the TripOS Autonomous Travel Recovery Agent.
Your job is to inspect the user's active trip, analyze requested changes (duration change, budget change, or weather disruptions), query verified travel options using your tools, calculate exact costs (NEVER guess or fabricate prices; always use calculate_trip_budget), and finally call draft_recovery_proposal.
You have access to 4 tools:
1. inspect_active_trip
2. search_travel_options
3. calculate_trip_budget
4. draft_recovery_proposal

Rules:
- NEVER invent prices. Only calculate_trip_budget produces verified costs.
- You must call draft_recovery_proposal before finishing.
- Your proposals are recommendations only; the active trip will NOT be modified until the user approves.`;

  const userPrompt = `Active Trip Target: ${activeTrip.inputs.origin} to ${activeTrip.inputs.destination} (${activeTrip.inputs.duration}d, budget ₹${activeTrip.inputs.budget}).
Requested Changes: ${JSON.stringify(requestedChanges)}.
Active Disruption: ${JSON.stringify(simulatedDisruption || activeTrip.simulatedDisruption || null)}.
Please inspect the trip, search options, verify costs with calculate_trip_budget, and draft a recovery proposal.`;

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
        finalProposal = toolOutput;
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

    // If proposal was drafted, we can conclude
    if (finalProposal) {
      break;
    }
  }

  // If the LLM loop did not conclude with draft_recovery_proposal, invoke it deterministically
  if (!finalProposal) {
    const fallbackRun = await runDeterministicAgentLoop({ activeTrip, requestedChanges, simulatedDisruption });
    return {
      success: true,
      mode: 'live-llm-assisted-fallback',
      provider: `Google Gemini (${modelToUse})`,
      model: modelToUse,
      proposal: fallbackRun.proposal,
      trace: [...trace, ...fallbackRun.trace],
      agentSummary: 'Model explored options; final proposal consolidated via deterministic safety guard.'
    };
  }

  return {
    success: true,
    mode: 'live-llm-agent',
    provider: `Google Gemini (${modelToUse})`,
    model: modelToUse,
    proposal: finalProposal,
    trace,
    agentSummary: finalProposal.agentExplanation || 'Recovery proposal drafted via genuine Gemini tool calling.'
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

// Self-starting logic when run directly (e.g. "node server/agentServer.js")
const isDirectRun = process.argv[1] && process.argv[1].endsWith('agentServer.js') && !process.argv[1].includes('.test.');
if (isDirectRun && process.env.NODE_ENV !== 'test') {
  const port = process.env.AGENT_PORT || 3001;
  app.listen(port, () => {
    console.log(`[TripOS] Agent Server listening at http://localhost:${port}`);
    console.log(`[TripOS] Mode: ${process.env.GEMINI_API_KEY ? 'Live LLM Tool Calling' : 'Deterministic Tool Runner'}`);
  });
}
