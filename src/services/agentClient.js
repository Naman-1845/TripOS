/**
 * TripOS Agent Client Service
 *
 * Interfaces with the Node.js Agent Server (GET /api/agent/status, POST /api/agent/recover).
 * Strictly guarantees honest mode reporting:
 * - 'live-llm-agent': Gemini Function Calling active on server
 * - 'deterministic-fallback': Server tool runner active (no API key)
 * - 'deterministic-fallback-on-error': Server tool runner active (Gemini error intercepted)
 * - 'local-offline-fallback': Server unreachable, client-side heuristic engine used
 */

import { generateRecoveryProposal, calculateTripDeltas, validateRecoveryProposal } from './recoveryEngine.js';

const getBaseUrl = () => {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_AGENT_API_URL) {
    return import.meta.env.VITE_AGENT_API_URL;
  }
  return 'http://localhost:3001';
};

/**
 * Checks server health and AI engine mode.
 */
export async function getAgentStatus() {
  const baseUrl = getBaseUrl();
  let timeoutId;
  try {
    const controller = new AbortController();
    timeoutId = setTimeout(() => controller.abort(), 2500);

    const res = await fetch(`${baseUrl}/api/agent/status`, {
      signal: controller.signal
    });

    if (!res.ok) {
      throw new Error(`Server returned HTTP ${res.status}`);
    }

    const data = await res.json();
    return {
      isOnline: true,
      status: data.status || 'online',
      configured: Boolean(data.configured),
      mode: data.mode || 'deterministic-fallback',
      provider: data.provider || 'TripOS Rule-Based Tool Runner',
      model: data.model || null,
      registeredTools: data.registeredTools || []
    };
  } catch (err) {
    return {
      isOnline: false,
      status: 'offline',
      configured: false,
      mode: 'local-offline-fallback',
      provider: 'TripOS Client Heuristic Engine (Offline)',
      model: null,
      registeredTools: []
    };
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

/**
 * Requests autonomous recovery from the agent server.
 * If server is offline or errors, seamlessly falls back to local deterministic recovery engine
 * and labels the mode honestly.
 */
export async function requestTripRecovery({
  activeTrip,
  requestedChanges = {},
  simulatedDisruption = null,
  forceFallback = false
}) {
  if (!activeTrip || !activeTrip.inputs || !activeTrip.id) {
    throw new Error('requestTripRecovery requires an active trip baseline.');
  }

  const baseUrl = getBaseUrl();

  let timeoutId;
  try {
    const controller = new AbortController();
    timeoutId = setTimeout(() => controller.abort(), 12000);

    const res = await fetch(`${baseUrl}/api/agent/recover`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        activeTrip,
        requestedChanges,
        simulatedDisruption,
        forceFallback
      }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const errorBody = await res.json().catch(() => ({}));
      throw new Error(errorBody.error || `Server responded with HTTP ${res.status}`);
    }

    const data = await res.json();

    if (!data.success || !data.proposal) {
      throw new Error(data.error || 'Server did not return a valid recovery proposal.');
    }

    const validation = validateRecoveryProposal(data.proposal);
    if (!validation.isValid) {
      throw new Error(`Server returned a malformed recovery proposal: ${validation.errors.join(' ')}`);
    }

    // Attach authentic server metadata to proposal
    const proposal = {
      ...data.proposal,
      executionMode: data.mode,
      provider: data.provider,
      model: data.model,
      trace: data.trace || [],
      agentSummary: data.agentSummary || data.proposal.agentExplanation
    };

    return {
      success: true,
      proposal,
      mode: data.mode,
      provider: data.provider,
      model: data.model,
      trace: data.trace || [],
      agentSummary: data.agentSummary || data.proposal.agentExplanation,
      isOfflineFallback: false
    };
  } catch (err) {
    console.warn('[TripOS Agent Client] Backend unavailable or failed. Activating local deterministic recovery fallback:', err.message);

    // Resolve target inputs from requestedChanges
    let targetDuration = activeTrip.inputs.duration;
    let targetBudget = activeTrip.inputs.budget;
    const targetDestination = (requestedChanges.destination && String(requestedChanges.destination).trim()) || activeTrip.inputs.destination;
    const targetOrigin = (requestedChanges.origin && String(requestedChanges.origin).trim()) || activeTrip.inputs.origin;
    const targetTravellers = (requestedChanges.travellers !== undefined && parseInt(requestedChanges.travellers, 10) >= 1)
      ? parseInt(requestedChanges.travellers, 10)
      : activeTrip.inputs.travellers;
    const userReason = requestedChanges.userReason;

    if (requestedChanges.durationDelta !== undefined || requestedChanges.budgetDelta !== undefined) {
      const deltas = calculateTripDeltas(activeTrip.inputs, {
        durationDelta: requestedChanges.durationDelta,
        budgetDelta: requestedChanges.budgetDelta
      });
      if (deltas.isValid) {
        targetDuration = deltas.resultingDuration;
        targetBudget = deltas.resultingBudget;
      }
    } else {
      if (requestedChanges.duration !== undefined) {
        const d = parseInt(requestedChanges.duration, 10);
        if (d >= 1) targetDuration = d;
      }
      if (requestedChanges.budget !== undefined) {
        const b = parseInt(requestedChanges.budget, 10);
        if (b > 0) targetBudget = b;
      }
    }

    const finalDisruption = simulatedDisruption !== null && simulatedDisruption !== undefined
      ? simulatedDisruption
      : (requestedChanges.simulatedDisruption || activeTrip.simulatedDisruption || null);

    const localProposal = generateRecoveryProposal(activeTrip, {
      destination: targetDestination,
      origin: targetOrigin,
      travellers: targetTravellers,
      duration: targetDuration,
      budget: targetBudget,
      userReason,
      simulatedDisruption: finalDisruption,
      ...(requestedChanges.transportPreference ? { transportPreference: requestedChanges.transportPreference } : {}),
      ...(requestedChanges.accommodationPreference ? { accommodationPreference: requestedChanges.accommodationPreference } : {})
    });

    const proposal = {
      ...localProposal,
      executionMode: 'local-offline-fallback',
      provider: 'TripOS Client Heuristic Engine (Offline)',
      model: null,
      trace: [],
      agentSummary: err.message?.includes('malformed')
        ? 'Backend proposal malformed: proposal generated via client-side deterministic recovery engine.'
        : 'Backend unreachable: proposal generated via client-side deterministic recovery engine.'
    };

    return {
      success: true,
      proposal,
      mode: 'local-offline-fallback',
      provider: 'TripOS Client Heuristic Engine (Offline)',
      model: null,
      trace: [],
      agentSummary: proposal.agentSummary,
      isOfflineFallback: true
    };
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

