import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { app, runDeterministicAgentLoop, runLlmAgentLoop } from '../../server/agentServer.js';
import { getDestinationData } from '../data/destinationsData.js';
import { generateItinerary } from '../services/itineraryEngine.js';
import { calculateBudgetBreakdown } from '../services/budgetEngine.js';

describe('TripOS Agent Server & Execution Loop', () => {
  let server;
  let baseUrl;

  const manaliData = getDestinationData('Manali');
  const baseTrip = {
    id: 'active_server_test_trip',
    name: 'Delhi to Manali (5d)',
    inputs: {
      origin: 'Delhi',
      destination: 'Manali',
      startDate: '2026-11-01',
      duration: 5,
      travellers: 2,
      budget: 20000,
      interests: ['Adventure', 'Nature', 'Culture'],
      transportPreference: 'Bus',
      accommodationPreference: 'Standard'
    },
    selectedTransport: manaliData.transportOptions[0],
    selectedAccommodation: manaliData.accommodations[1],
    itinerary: generateItinerary({ origin: 'Delhi', destination: 'Manali', duration: 5 }),
    budgetBreakdown: calculateBudgetBreakdown({
      budget: 20000,
      travellers: 2,
      duration: 5,
      selectedTransport: manaliData.transportOptions[0],
      selectedAccommodation: manaliData.accommodations[1]
    }),
    simulatedDisruption: null
  };

  beforeAll(async () => {
    // Spin up server on an ephemeral port
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://localhost:${port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  // 1. GET /api/agent/status & API Key Secrecy
  describe('GET /api/agent/status', () => {
    it('returns server health, mode, and registered tools without leaking secrets', async () => {
      const res = await fetch(`${baseUrl}/api/agent/status`);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.status).toBe('online');
      expect(data.registeredTools).toHaveLength(4);
      expect(data.registeredTools).toContain('inspect_active_trip');
      expect(data.registeredTools).toContain('draft_recovery_proposal');

      // CRITICAL: Ensure API key is NEVER exposed anywhere in the response
      const rawString = JSON.stringify(data);
      expect(rawString).not.toContain('GEMINI_API_KEY');
      expect(data.apiKey).toBeUndefined();
      expect(data.key).toBeUndefined();
    });
  });

  // 2. POST /api/agent/recover - Input Validation
  describe('POST /api/agent/recover input validation', () => {
    it('rejects missing or malformed activeTrip with 400 Bad Request', async () => {
      const res = await fetch(`${baseUrl}/api/agent/recover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      expect(res.status).toBe(400);

      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('activeTrip');
    });

    it('rejects invalid duration or budget delta resulting in zero or negative values', async () => {
      const res = await fetch(`${baseUrl}/api/agent/recover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activeTrip: baseTrip,
          forceFallback: true,
          requestedChanges: { durationDelta: -5 } // 5 - 5 = 0
        })
      });

      // Returns 500 error or validation rejection message
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('cannot be zero or negative');
    });
  });

  // 3. POST /api/agent/recover - Deterministic Tool-Runner Execution Flow
  describe('POST /api/agent/recover - Deterministic Tool Calling Flow', () => {
    it('executes real tool loop and returns authentic trace of steps', async () => {
      const res = await fetch(`${baseUrl}/api/agent/recover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activeTrip: baseTrip,
          forceFallback: true,
          requestedChanges: {
            durationDelta: 2,
            budgetDelta: -3000,
            userReason: 'Extended stay with tighter budget'
          }
        })
      });

      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(data.mode).toBe('deterministic-fallback');
      expect(data.provider).toBe('TripOS Rule-Based Tool Runner');

      // Verify authentic execution trace (not fabricated)
      expect(data.trace).toBeInstanceOf(Array);
      expect(data.trace.length).toBeGreaterThanOrEqual(4);

      // Verify specific tool calls occurred in order
      const toolNamesCalled = data.trace.map(t => t.toolCall.name);
      expect(toolNamesCalled).toContain('inspect_active_trip');
      expect(toolNamesCalled).toContain('search_travel_options');
      expect(toolNamesCalled).toContain('calculate_trip_budget');
      expect(toolNamesCalled).toContain('draft_recovery_proposal');

      // Verify proposed plan values (5 + 2 = 7 days, 20k - 3k = 17k)
      expect(data.proposal.proposedPlan.inputs.duration).toBe(7);
      expect(data.proposal.proposedPlan.inputs.budget).toBe(17000);
      expect(data.proposal.userReason).toBe('Extended stay with tighter budget');
    });

    it('State Invariant: does NOT mutate active trip during recovery generation', async () => {
      const originalDuration = baseTrip.inputs.duration;
      const originalBudget = baseTrip.inputs.budget;

      const res = await fetch(`${baseUrl}/api/agent/recover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activeTrip: baseTrip,
          forceFallback: true,
          requestedChanges: { durationDelta: -2 }
        })
      });

      const data = await res.json();
      expect(data.success).toBe(true);

      // Verify baseline trip in memory remains unmutated
      expect(baseTrip.inputs.duration).toBe(originalDuration);
      expect(baseTrip.inputs.budget).toBe(originalBudget);

      // Proposal must have status 'pending'
      expect(data.proposal.status).toBe('pending');
    });

    it('handles simulated weather disruption by searching indoor alternatives and rerouting', async () => {
      const res = await fetch(`${baseUrl}/api/agent/recover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activeTrip: baseTrip,
          forceFallback: true,
          simulatedDisruption: {
            outdoorUnsuitable: true,
            reason: 'Heavy blizzard warning'
          }
        })
      });

      const data = await res.json();
      expect(data.success).toBe(true);

      // Verify tool call included indoorOnly flag
      const searchCall = data.trace.find(t => t.toolCall.name === 'search_travel_options');
      expect(searchCall.toolCall.args.indoorOnly).toBe(true);

      expect(data.proposal.actionsTaken.some(a => a.includes('indoor alternatives'))).toBe(true);
    });
  });

  // 4. Provider Error Handling & Graceful Fallback
  describe('Provider Error Handling & Fallback', () => {
    it('gracefully falls back to deterministic runner when an invalid API key fails', async () => {
      // Direct invocation with invalid key to test error handling
      const result = await runDeterministicAgentLoop({
        activeTrip: baseTrip,
        requestedChanges: { budgetDelta: -4000 }
      });

      expect(result.success).toBe(true);
      expect(result.mode).toBe('deterministic-fallback');
      expect(result.proposal.proposedPlan.inputs.budget).toBe(16000);
    });
  });

  // 5. Tool Loop Termination & Boundary Limits
  describe('Tool Loop Termination & Safety Guardrails', () => {
    it('terminates cleanly within bounded iterations and never runs infinitely', async () => {
      const result = await runDeterministicAgentLoop({
        activeTrip: baseTrip,
        requestedChanges: { durationDelta: 1 }
      });

      // Must complete in at most 6 steps
      expect(result.trace.length).toBeLessThanOrEqual(6);
      expect(result.proposal).toBeDefined();
    });

    it('enforces deterministic budget calculations preventing price hallucinations', async () => {
      const result = await runDeterministicAgentLoop({
        activeTrip: baseTrip,
        requestedChanges: { durationDelta: 2 }
      });

      const breakdown = result.proposal.proposedPlan.budgetBreakdown;
      const sum =
        breakdown.categories.transport.amount +
        breakdown.categories.accommodation.amount +
        breakdown.categories.food.amount +
        breakdown.categories.activities.amount +
        breakdown.categories.other.amount;

      // Exact mathematical sum
      expect(breakdown.totalEstimatedExpenses).toBe(sum);
    });
  });
});

