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

  // Calculate target duration and budget
  let targetDuration = activeTrip.inputs.duration;
  let targetBudget = activeTrip.inputs.budget;
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
    ? 'Adverse conditions active: querying sheltered/indoor attractions and lodging alternatives.'
    : 'Querying destination catalog for suitable transport and accommodation alternatives.';
  const searchResult = search_travel_options({
    destination: activeTrip.inputs.destination,
    category: 'all',
    indoorOnly: isDisrupted
  });
  trace.push({
    step: step++,
    thought: searchThought,
    toolCall: {
      name: 'search_travel_options',
      args: { destination: activeTrip.inputs.destination, category: 'all', indoorOnly: isDisrupted }
    },
    observation: {
      destination: searchResult.destination,
      accommodationsCount: searchResult.accommodations?.length || 0,
      transportCount: searchResult.transportOptions?.length || 0,
      attractionsCount: searchResult.attractions?.length || 0
    }
  });

  // Step 3: Candidate selection & budget calculation
  let chosenTransport = activeTrip.selectedTransport || searchResult.transportOptions?.[0];
  let chosenAccommodation = activeTrip.selectedAccommodation || searchResult.accommodations?.[0];
  const actionsTaken = [];

  // Initial calculation
  let budgetResult = calculate_trip_budget({
    destination: activeTrip.inputs.destination,
    budget: targetBudget,
    duration: targetDuration,
    travellers: activeTrip.inputs.travellers,
    selectedTransportId: chosenTransport.id,
    selectedAccommodationId: chosenAccommodation.id
  });

  trace.push({
    step: step++,
    thought: 'Calculating verified expenses for candidate configuration using deterministic budget engine.',
    toolCall: {
      name: 'calculate_trip_budget',
      args: {
        destination: activeTrip.inputs.destination,
        budget: targetBudget,
        duration: targetDuration,
        travellers: activeTrip.inputs.travellers,
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
        destination: activeTrip.inputs.destination,
        budget: targetBudget,
        duration: targetDuration,
        travellers: activeTrip.inputs.travellers,
        selectedTransportId: chosenTransport.id,
        selectedAccommodationId: chosenAccommodation.id
      });

      trace.push({
        step: step++,
        thought: 'Budget deficit detected: recalculated expenses after switching to budget accommodation.',
        toolCall: {
          name: 'calculate_trip_budget',
          args: {
            destination: activeTrip.inputs.destination,
            budget: targetBudget,
            duration: targetDuration,
            travellers: activeTrip.inputs.travellers,
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
  if (targetDuration !== activeTrip.inputs.duration) {
    actionsTaken.push(`Adjusted duration from ${activeTrip.inputs.duration} to ${targetDuration} days.`);
  }
  if (targetBudget !== activeTrip.inputs.budget) {
    actionsTaken.push(`Recalculated expenses for updated budget of ₹${targetBudget.toLocaleString('en-IN')}.`);
  }
  if (isDisrupted) {
    actionsTaken.push(`Replaced outdoor activities with verified indoor alternatives due to: "${finalDisruption.reason}".`);
  }
  if (actionsTaken.length === 0) {
    actionsTaken.push('Verified itinerary against active constraints and confirmed feasibility.');
  }

  // Step 4: Draft recovery proposal
  const explanation = `Autonomous recovery evaluated candidate adjustments for ${activeTrip.inputs.destination}. Total verified cost is ₹${budgetResult.totalEstimatedExpenses.toLocaleString('en-IN')} against ₹${targetBudget.toLocaleString('en-IN')} budget.`;

  const proposal = draft_recovery_proposal({
    activeTrip,
    newDuration: targetDuration,
    newBudget: targetBudget,
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

    const response = await ai.models.generateContent({
      model: modelToUse,
      contents,
      config: {
        systemInstruction,
        tools: [{ functionDeclarations }]
      }
    });

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
// HTTP Endpoints
// -------------------------------------------------------------------------

/**
 * GET /api/agent/status
 * Returns health, execution mode, and provider. Never leaks API keys.
 */
app.get('/api/agent/status', (req, res) => {
  const hasKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim());

  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    configured: hasKey,
    mode: hasKey ? 'live-llm-agent' : 'deterministic-fallback',
    provider: hasKey ? 'Google Gemini (@google/genai)' : 'TripOS Rule-Based Tool Runner',
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
 * POST /api/agent/recover
 * Receives trip recovery request, runs genuine tool loop or deterministic fallback.
 */
app.post('/api/agent/recover', async (req, res) => {
  try {
    const { activeTrip, requestedChanges = {}, simulatedDisruption = null } = req.body || {};

    if (!activeTrip || !activeTrip.inputs || !activeTrip.id) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request: "activeTrip" with valid inputs and ID is required.'
      });
    }

    const forceFallback = Boolean(req.body && req.body.forceFallback);
    const apiKey = !forceFallback && process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : null;

    // Mode A: Live LLM Agent with Tool Calling (when API key is provided)
    if (apiKey) {
      try {
        const agentResult = await runLlmAgentLoop({
          activeTrip,
          requestedChanges,
          simulatedDisruption,
          apiKey,
          modelName: process.env.GEMINI_MODEL
        });
        return res.json(agentResult);
      } catch (err) {
        // Safe logging: never print or expose the API key
        console.warn('[TripOS Agent Server] Live LLM execution failed, falling back to deterministic runner:', err.message);

        const fallbackResult = await runDeterministicAgentLoop({
          activeTrip,
          requestedChanges,
          simulatedDisruption
        });

        return res.json({
          ...fallbackResult,
          mode: 'deterministic-fallback-on-error',
          notice: 'Live LLM provider encountered an error; safely executed deterministic tool runner.'
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
    console.error('[TripOS Agent Server] Recovery request error:', err.message);
    return res.status(500).json({
      success: false,
      error: err.message || 'Internal agent recovery error'
    });
  }
});

// Self-starting logic when run directly (e.g. "node server/agentServer.js")
const isDirectRun = process.argv[1] && (process.argv[1].endsWith('agentServer.js') || process.argv[1].includes('agentServer'));
if (isDirectRun && process.env.NODE_ENV !== 'test') {
  const port = process.env.AGENT_PORT || 3001;
  app.listen(port, () => {
    console.log(`[TripOS] Agent Server listening at http://localhost:${port}`);
    console.log(`[TripOS] Mode: ${process.env.GEMINI_API_KEY ? 'Live LLM Tool Calling' : 'Deterministic Tool Runner'}`);
  });
}
