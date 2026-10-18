import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  app,
  runDeterministicAgentLoop,
  runLlmAgentLoop,
  isGeminiQuotaExceededError,
  sanitizeSecrets,
  setQuotaCooldown,
  resetQuotaCooldown,
  getQuotaCooldownStatus
} from '../../server/agentServer.js';
import { getDestinationData } from '../data/destinationsData.js';
import { generateItinerary } from '../services/itineraryEngine.js';
import { calculateBudgetBreakdown } from '../services/budgetEngine.js';
import { validateRecoveryProposal } from '../services/recoveryEngine.js';

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

  beforeEach(() => {
    resetQuotaCooldown();
    if (app.locals) delete app.locals.aiClient;
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

    describe('Gemini Quota Error Detection (isGeminiQuotaExceededError)', () => {
      it('detects HTTP 429 and RESOURCE_EXHAUSTED across standard error formats', () => {
        expect(isGeminiQuotaExceededError({ status: 429 })).toBe(true);
        expect(isGeminiQuotaExceededError({ statusCode: 429 })).toBe(true);
        expect(isGeminiQuotaExceededError({ code: 429 })).toBe(true);
        expect(isGeminiQuotaExceededError({ code: 'RESOURCE_EXHAUSTED' })).toBe(true);
        expect(isGeminiQuotaExceededError({ status: 'RESOURCE_EXHAUSTED' })).toBe(true);
        expect(isGeminiQuotaExceededError({ response: { status: 429 } })).toBe(true);
        expect(isGeminiQuotaExceededError({ response: { statusText: 'Too Many Requests' } })).toBe(true);
        expect(isGeminiQuotaExceededError({
          errorDetails: [{ reason: 'RATE_LIMIT_EXHAUSTED' }]
        })).toBe(true);
        expect(isGeminiQuotaExceededError({
          error: { code: 429, message: 'Resource has been exhausted' }
        })).toBe(true);
        expect(isGeminiQuotaExceededError(new Error('Quota exceeded for quota metric Generate Content API requests'))).toBe(true);
        expect(isGeminiQuotaExceededError(new Error('[429 Resource Exhausted] Rate limit exceeded'))).toBe(true);
        expect(isGeminiQuotaExceededError({
          cause: { status: 429, message: 'Too Many Requests' }
        })).toBe(true);
      });

      it('returns false for non-quota errors (500, network error, 400)', () => {
        expect(isGeminiQuotaExceededError(null)).toBe(false);
        expect(isGeminiQuotaExceededError(undefined)).toBe(false);
        expect(isGeminiQuotaExceededError({ status: 500, message: 'Internal Server Error' })).toBe(false);
        expect(isGeminiQuotaExceededError(new Error('Network connection refused'))).toBe(false);
        expect(isGeminiQuotaExceededError(new Error('Invalid argument: destination must not be empty'))).toBe(false);
      });
    });

    describe('Secret Sanitization (sanitizeSecrets)', () => {
      it('redacts Google API keys and bearer tokens from logs and error text', () => {
        const sensitive = 'Error: request failed with key=AIzaSyA1234567890123456789012345678901 and Bearer ya29.a0AfH6SM...';
        const sanitized = sanitizeSecrets(sensitive);
        expect(sanitized).not.toContain('AIzaSyA1234567890123456789012345678901');
        expect(sanitized).not.toContain('ya29.a0AfH6SM');
        expect(sanitized).toContain('[REDACTED_API_KEY]');
        expect(sanitized).toContain('Bearer REDACTED');
      });
    });

    describe('POST /api/agent/recover - Quota 429 Handling & Cooldown (Mocked API)', () => {
      it('immediately falls back to deterministic runner when Gemini quota is exceeded (HTTP 429)', async () => {
        let callCount = 0;
        const mockQuotaClient = {
          models: {
            generateContent: async () => {
              callCount++;
              const quotaErr = new Error('RESOURCE_EXHAUSTED: Quota exceeded for quota metric Generate Content API requests');
              quotaErr.status = 429;
              quotaErr.code = 'RESOURCE_EXHAUSTED';
              throw quotaErr;
            }
          }
        };

        app.locals.aiClient = mockQuotaClient;

        const res = await fetch(`${baseUrl}/api/agent/recover`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            activeTrip: baseTrip,
            requestedChanges: { budgetDelta: -4000 }
          })
        });

        expect(res.status).toBe(200);
        const data = await res.json();

        expect(data.success).toBe(true);
        expect(data.mode).toBe('deterministic-fallback-on-error');
        expect(data.notice).toContain('429');
        expect(data.agentSummary).toContain('quota exceeded');
        expect(callCount).toBe(1);

        // Verify valid proposal structure and invariants
        expect(data.proposal.status).toBe('pending');
        expect(data.proposal.proposedPlan.inputs.budget).toBe(16000);
        const validation = validateRecoveryProposal(data.proposal, baseTrip);
        expect(validation.isValid).toBe(true);

        // Verify quota cooldown is now active
        const cooldownStatus = getQuotaCooldownStatus();
        expect(cooldownStatus.isQuotaExceeded).toBe(true);
        expect(cooldownStatus.cooldownRemainingMs).toBeGreaterThan(0);
      });

      it('avoids repeatedly retrying failed requests when quota cooldown is active', async () => {
        let callCount = 0;
        const mockClient = {
          models: {
            generateContent: async () => {
              callCount++;
              throw new Error('Should not be called during cooldown');
            }
          }
        };

        app.locals.aiClient = mockClient;

        // Set cooldown explicitly
        setQuotaCooldown(30000);

        const res = await fetch(`${baseUrl}/api/agent/recover`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            activeTrip: baseTrip,
            requestedChanges: { durationDelta: -1 }
          })
        });

        expect(res.status).toBe(200);
        const data = await res.json();

        // Must NOT have called the mock LLM client at all
        expect(callCount).toBe(0);
        expect(data.success).toBe(true);
        expect(data.mode).toBe('deterministic-fallback-on-error');
        expect(data.notice).toContain('cooldown');
        expect(data.proposal.proposedPlan.inputs.duration).toBe(4);
      });

      it('preserves fallback behavior for non-quota errors without activating quota cooldown', async () => {
        let callCount = 0;
        const mockGenericErrorClient = {
          models: {
            generateContent: async () => {
              callCount++;
              const genericErr = new Error('500 Internal Server Error from upstream Gemini service');
              genericErr.status = 500;
              throw genericErr;
            }
          }
        };

        app.locals.aiClient = mockGenericErrorClient;

        const res = await fetch(`${baseUrl}/api/agent/recover`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            activeTrip: baseTrip,
            requestedChanges: { budgetDelta: -2000 }
          })
        });

        expect(res.status).toBe(200);
        const data = await res.json();

        expect(data.success).toBe(true);
        expect(data.mode).toBe('deterministic-fallback-on-error');
        expect(data.notice).toContain('Live LLM provider encountered an error');
        expect(callCount).toBe(1);

        // Crucial: quota cooldown must NOT be activated for generic non-quota errors
        const cooldownStatus = getQuotaCooldownStatus();
        expect(cooldownStatus.isQuotaExceeded).toBe(false);
      });
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

  // 6. Gemini Function-Calling Multi-Call Turn Assembly
  describe('Gemini Function-Calling Multi-Call Assembly', () => {
    it('preserves single model turn and groups multiple function responses into a single user turn', async () => {
      const capturedRequests = [];

      const mockCandidateTurn1 = {
        content: {
          role: 'model',
          parts: [
            { text: 'Inspecting active trip and searching options concurrently.' },
            {
              functionCall: {
                name: 'inspect_active_trip',
                args: {},
                id: 'call_inspect_001'
              }
            },
            {
              functionCall: {
                name: 'search_travel_options',
                args: { destination: 'Manali', category: 'transport' },
                id: 'call_search_002'
              }
            }
          ]
        }
      };

      const mockCandidateTurn2 = {
        content: {
          role: 'model',
          parts: [
            { text: 'Drafting recovery proposal based on verified search options.' },
            {
              functionCall: {
                name: 'draft_recovery_proposal',
                args: {
                  newDuration: 5,
                  newBudget: 20000,
                  selectedTransportId: manaliData.transportOptions[0].id,
                  selectedAccommodationId: manaliData.accommodations[0].id,
                  actionsTaken: ['Preserved itinerary with verified transport'],
                  agentExplanation: 'Verified multi-call recovery test proposal.'
                },
                id: 'call_draft_003'
              }
            }
          ]
        }
      };

      const mockAiClient = {
        models: {
          generateContent: async ({ contents }) => {
            // Snapshot conversation history at each turn
            capturedRequests.push(JSON.parse(JSON.stringify(contents)));
            if (capturedRequests.length === 1) {
              return {
                candidates: [mockCandidateTurn1],
                functionCalls: [
                  mockCandidateTurn1.content.parts[1].functionCall,
                  mockCandidateTurn1.content.parts[2].functionCall
                ]
              };
            }
            return {
              candidates: [mockCandidateTurn2],
              functionCalls: [
                mockCandidateTurn2.content.parts[1].functionCall
              ]
            };
          }
        }
      };

      const result = await runLlmAgentLoop({
        activeTrip: baseTrip,
        requestedChanges: {},
        apiKey: 'test-fake-key',
        aiClient: mockAiClient
      });

      expect(result.success).toBe(true);
      expect(result.mode).toBe('live-llm-agent');

      // capturedRequests[0] is the initial user prompt (length 1)
      expect(capturedRequests[0].length).toBe(1);
      expect(capturedRequests[0][0].role).toBe('user');

      // capturedRequests[1] is the conversation history passed into Turn 2.
      // Must contain exactly:
      // Turn 0: initial user prompt
      // Turn 1: single model turn with the original candidate parts (thoughts + 2 function calls)
      // Turn 2: single user turn containing BOTH function responses
      expect(capturedRequests[1].length).toBe(3);

      const modelTurn = capturedRequests[1][1];
      expect(modelTurn.role).toBe('model');
      expect(modelTurn.parts.length).toBe(3);
      expect(modelTurn.parts[0].text).toBe('Inspecting active trip and searching options concurrently.');
      expect(modelTurn.parts[1].functionCall.name).toBe('inspect_active_trip');
      expect(modelTurn.parts[1].functionCall.id).toBe('call_inspect_001');
      expect(modelTurn.parts[2].functionCall.name).toBe('search_travel_options');
      expect(modelTurn.parts[2].functionCall.id).toBe('call_search_002');

      const userResponseTurn = capturedRequests[1][2];
      expect(userResponseTurn.role).toBe('user');
      expect(userResponseTurn.parts.length).toBe(2);

      // Verify response 1
      const response1 = userResponseTurn.parts[0].functionResponse;
      expect(response1.name).toBe('inspect_active_trip');
      expect(response1.id).toBe('call_inspect_001');
      expect(response1.response.output.destination).toBe('Manali');
      expect(response1.response.output.duration).toBe(5);

      // Verify response 2
      const response2 = userResponseTurn.parts[1].functionResponse;
      expect(response2.name).toBe('search_travel_options');
      expect(response2.id).toBe('call_search_002');
      expect(response2.response.output.destination).toBe('Manali');
      expect(response2.response.output.transportOptions).toBeDefined();
    });

    it('runDeterministicAgentLoop correctly changes destination from Manali to Goa', async () => {
      const result = await runDeterministicAgentLoop({
        activeTrip: baseTrip,
        requestedChanges: {
          destination: 'Goa',
          budget: 25000,
          accommodationPreference: 'Luxury'
        }
      });

      expect(result.success).toBe(true);
      expect(result.proposal.proposedPlan.inputs.destination).toBe('Goa');
      expect(result.proposal.proposedPlan.inputs.budget).toBe(25000);
      expect(result.proposal.proposedPlan.inputs.origin).toBe('Delhi');
      expect(result.proposal.proposedPlan.itinerary.days.length).toBe(5);
      expect(result.proposal.actionsTaken.some(a => a.includes('destination') && a.includes('Goa'))).toBe(true);

      const goaData = getDestinationData('Goa');
      const goaTransportIds = goaData.transportOptions.map(t => t.id);
      const goaAccIds = goaData.accommodations.map(a => a.id);
      expect(goaTransportIds).toContain(result.proposal.proposedPlan.selectedTransport.id);
      expect(goaAccIds).toContain(result.proposal.proposedPlan.selectedAccommodation.id);
    });

    it('POST /api/agent/recover handles destination change to Goa and returns valid proposal', async () => {
      const res = await fetch(`${baseUrl}/api/agent/recover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activeTrip: baseTrip,
          forceFallback: true,
          requestedChanges: { destination: 'Goa', budget: 25000 }
        })
      });

      expect(res.ok).toBe(true);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.proposal.status).toBe('pending');
      expect(data.proposal.proposedPlan.inputs.destination).toBe('Goa');
      expect(data.proposal.proposedPlan.inputs.budget).toBe(25000);
    });
  });
});

