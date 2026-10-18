import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  app,
  runDeterministicAgentLoop,
  runLlmAgentLoop,
  resetQuotaCooldown,
  setQuotaCooldown
} from '../../server/agentServer.js';
import {
  AGENT_TOOL_NAMES,
  AGENT_TOOL_DEFINITIONS,
  executeAgentTool,
  verify_proposal
} from '../services/agentTools.js';
import {
  parseIntentDeterministic,
  parseCurrencyAmount
} from '../services/intentParser.js';
import {
  generateCandidateProposals,
  validateRecoveryProposal
} from '../services/recoveryEngine.js';
import { getDestinationData } from '../data/destinationsData.js';
import { generateItinerary } from '../services/itineraryEngine.js';
import { calculateBudgetBreakdown } from '../services/budgetEngine.js';

describe('TripOS Hackathon Features & Agent Multi-Candidate Suite', () => {
  let server;
  let baseUrl;

  const manaliData = getDestinationData('Manali');
  const baseTrip = {
    id: 'hackathon_test_trip_01',
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

  // =========================================================================
  // 1. FEATURE 1: DETERMINISTIC INTENT PARSER UNIT TESTS
  // =========================================================================
  describe('Feature 1: Deterministic Intent Parser', () => {
    it('parses currency numbers with "k", "thousand", "lakh", and "₹"', () => {
      expect(parseCurrencyAmount('4', 'k')).toBe(4000);
      expect(parseCurrencyAmount('4000')).toBe(4000);
      expect(parseCurrencyAmount('2.5', 'k')).toBe(2500);
      expect(parseCurrencyAmount('10', 'thousand')).toBe(10000);
      expect(parseCurrencyAmount('1.5', 'lakh')).toBe(150000);
    });

    it('extracts budget reduction from "cut my budget by 4k"', () => {
      const res = parseIntentDeterministic('cut my budget by 4k', baseTrip);
      expect(res.budgetDelta).toBe(-4000);
      expect(res.goal).toBe('cheaper');
      expect(res.confidence).toBeGreaterThanOrEqual(0.85);
    });

    it('extracts duration addition from "add a day" or "+1 day"', () => {
      const res1 = parseIntentDeterministic('add a day', baseTrip);
      expect(res1.durationDelta).toBe(1);

      const res2 = parseIntentDeterministic('extend trip by 2 more days', baseTrip);
      expect(res2.durationDelta).toBe(2);
    });

    it('extracts duration reduction from "shorten by 2 days"', () => {
      const res = parseIntentDeterministic('shorten by 2 days', baseTrip);
      expect(res.durationDelta).toBe(-2);
    });

    it('extracts traveller count from "we are 3 people now" or "group of 4"', () => {
      const res1 = parseIntentDeterministic("we're 3 people now", baseTrip);
      expect(res1.travellers).toBe(3);

      const res2 = parseIntentDeterministic('group of 4 friends travelling', baseTrip);
      expect(res2.travellers).toBe(4);

      const res3 = parseIntentDeterministic('travelling solo', baseTrip);
      expect(res3.travellers).toBe(1);
    });

    it('detects adverse weather keywords (rain, snow, blizzard, storm, landslide)', () => {
      const resRain = parseIntentDeterministic("it's raining and stormy", baseTrip);
      expect(resRain.simulatedDisruption).toBeDefined();
      expect(resRain.simulatedDisruption.outdoorUnsuitable).toBe(true);
      expect(resRain.simulatedDisruption.reason).toContain('rain');
      expect(resRain.goal).toBe('indoor');

      const resBlizzard = parseIntentDeterministic('heavy blizzard and snow alert', baseTrip);
      expect(resBlizzard.simulatedDisruption.outdoorUnsuitable).toBe(true);
      expect(resBlizzard.simulatedDisruption.reason).toContain('blizzard');
    });

    it('extracts multi-parameter combination command: "cut my budget by 4k, add a day, and it\'s raining"', () => {
      const res = parseIntentDeterministic("cut my budget by 4k, add a day, and it's raining", baseTrip);
      expect(res.budgetDelta).toBe(-4000);
      expect(res.durationDelta).toBe(1);
      expect(res.simulatedDisruption.outdoorUnsuitable).toBe(true);
      expect(res.confidence).toBeGreaterThanOrEqual(0.85);
      expect(res.needsClarification).toBeUndefined();
    });

    it('detects destination switch: "switch destination to Goa, 4 days with Luxury stay"', () => {
      const res = parseIntentDeterministic('switch destination to Goa, 4 days with Luxury stay', baseTrip);
      expect(res.destination).toBe('Goa');
      expect(res.duration).toBe(4);
      expect(res.accommodationPreference).toBe('Luxury');
    });

    it('handles empty or unrecognized input with low confidence and clarification request', () => {
      const emptyRes = parseIntentDeterministic('', baseTrip);
      expect(emptyRes.confidence).toBe(0);
      expect(emptyRes.needsClarification).toBeDefined();

      const gibberishRes = parseIntentDeterministic('hello completely unrelated query', baseTrip);
      expect(gibberishRes.confidence).toBeLessThan(0.5);
      expect(gibberishRes.needsClarification).toBeDefined();
    });

    it('validates against baseline and asks clarification if resulting duration < 1 or budget <= 0', () => {
      // 5-day trip, cutting 6 days -> resulting duration is -1
      const invalidDuration = parseIntentDeterministic('shorten by 6 days', baseTrip);
      expect(invalidDuration.needsClarification).toContain('duration must be at least 1 day');

      // ₹20k budget, cutting 25k -> resulting budget is -5000
      const invalidBudget = parseIntentDeterministic('cut my budget by 25k', baseTrip);
      expect(invalidBudget.needsClarification.toLowerCase()).toContain('budget must be greater than ₹0');
    });
  });

  // =========================================================================
  // 2. FEATURE 1: POST /api/agent/parse-intent ENDPOINT TESTS
  // =========================================================================
  describe('Feature 1: POST /api/agent/parse-intent endpoint', () => {
    it('validates input and rejects missing text or activeTrip with 400', async () => {
      const res1 = await fetch(`${baseUrl}/api/agent/parse-intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      expect(res1.status).toBe(400);

      const res2 = await fetch(`${baseUrl}/api/agent/parse-intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'a'.repeat(501), activeTrip: baseTrip })
      });
      expect(res2.status).toBe(400);
      const data2 = await res2.json();
      expect(data2.error).toContain('500 characters');
    });

    it('parses natural language command in deterministic fallback mode', async () => {
      const res = await fetch(`${baseUrl}/api/agent/parse-intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: "cut my budget by 4k, add a day, and it's raining",
          activeTrip: baseTrip,
          forceFallback: true
        })
      });

      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(data.mode).toBe('deterministic-fallback');
      expect(data.provider).toContain('Rule-Based');
      expect(data.intent.budgetDelta).toBe(-4000);
      expect(data.intent.durationDelta).toBe(1);
      expect(data.intent.simulatedDisruption.outdoorUnsuitable).toBe(true);
    });

    it('intercepts Gemini quota 429 during parse-intent and falls back safely', async () => {
      const mockQuotaClient = {
        models: {
          generateContent: async () => {
            const err = new Error('RESOURCE_EXHAUSTED: quota limit exceeded');
            err.status = 429;
            throw err;
          }
        }
      };

      app.locals.aiClient = mockQuotaClient;

      const res = await fetch(`${baseUrl}/api/agent/parse-intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: 'cut my budget by 2k',
          activeTrip: baseTrip
        })
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.mode).toBe('deterministic-fallback-on-error');
      expect(data.intent.budgetDelta).toBe(-2000);
    });
  });

  // =========================================================================
  // 3. FEATURE 2: 5TH TOOL verify_proposal TESTS
  // =========================================================================
  describe('Feature 2: verify_proposal agent tool', () => {
    it('is registered in AGENT_TOOL_NAMES and AGENT_TOOL_DEFINITIONS', () => {
      expect(AGENT_TOOL_NAMES).toContain('verify_proposal');
      const def = AGENT_TOOL_DEFINITIONS.find(t => t.name === 'verify_proposal');
      expect(def).toBeDefined();
      expect(def.parameters.required).toContain('destination');
      expect(def.parameters.required).toContain('selectedTransportId');
      expect(def.parameters.required).toContain('selectedAccommodationId');
    });

    it('returns verified: true for valid parameters within budget', () => {
      const result = verify_proposal({
        destination: 'Manali',
        duration: 5,
        budget: 20000,
        selectedTransportId: manaliData.transportOptions[0].id,
        selectedAccommodationId: manaliData.accommodations[0].id,
        totalEstimatedExpenses: 15000,
        simulatedDisruption: null
      });

      expect(result.verified).toBe(true);
      expect(result.checks.catalogResolved).toBe(true);
      expect(result.checks.transportValid).toBe(true);
      expect(result.checks.accommodationValid).toBe(true);
      expect(result.checks.durationValid).toBe(true);
      expect(result.checks.withinBudget).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it('detects invalid transport and accommodation IDs from catalog', () => {
      const result = verify_proposal({
        destination: 'Manali',
        duration: 5,
        budget: 20000,
        selectedTransportId: 'non_existent_flight_xyz',
        selectedAccommodationId: 'fake_hotel_123',
        totalEstimatedExpenses: 15000
      });

      expect(result.verified).toBe(false);
      expect(result.checks.transportValid).toBe(false);
      expect(result.checks.accommodationValid).toBe(false);
      expect(result.warnings.some(w => w.includes('non_existent_flight_xyz'))).toBe(true);
      expect(result.warnings.some(w => w.includes('fake_hotel_123'))).toBe(true);
    });

    it('detects over-budget expenses and includes warning with deficit amount', () => {
      const result = verify_proposal({
        destination: 'Manali',
        duration: 5,
        budget: 15000,
        selectedTransportId: manaliData.transportOptions[0].id,
        selectedAccommodationId: manaliData.accommodations[0].id,
        totalEstimatedExpenses: 18500
      });

      expect(result.checks.withinBudget).toBe(false);
      expect(result.warnings.some(w => w.includes('exceed target budget'))).toBe(true);
      expect(result.warnings.some(w => w.includes('3500'))).toBe(true);
    });

    it('can be dispatched via executeAgentTool', () => {
      const result = executeAgentTool('verify_proposal', {
        destination: 'Manali',
        duration: 5,
        budget: 20000,
        selectedTransportId: manaliData.transportOptions[0].id,
        selectedAccommodationId: manaliData.accommodations[0].id,
        totalEstimatedExpenses: 12000
      });
      expect(result.verified).toBe(true);
    });
  });

  // =========================================================================
  // 4. FEATURE 2: MULTI-CANDIDATE PROPOSALS & STRATEGIES
  // =========================================================================
  describe('Feature 2: Multi-Candidate Strategy Generation', () => {
    it('generateCandidateProposals returns at least 2 distinct candidate strategies', () => {
      const result = generateCandidateProposals(baseTrip, {
        budgetDelta: -3000
      });

      expect(result.candidates).toBeInstanceOf(Array);
      expect(result.candidates.length).toBeGreaterThanOrEqual(2);

      const strategies = result.candidates.map(c => c.strategy);
      // Contains distinct strategy names
      expect(strategies).toContain('Budget Saver');

      // Exactly one candidate is marked recommended
      const recommendedCount = result.candidates.filter(c => c.recommended).length;
      expect(recommendedCount).toBe(1);

      // Proposal property is backward-compatible and matches the recommended candidate
      expect(result.proposal).toBeDefined();
      const recommended = result.candidates.find(c => c.recommended);
      expect(result.proposal.proposalId).toBe(recommended.proposal.proposalId);
    });

    it('each candidate strategy has defined trade-offs and cost impact', () => {
      const result = generateCandidateProposals(baseTrip, {
        durationDelta: -1
      });

      result.candidates.forEach(cand => {
        expect(cand.strategy).toBeDefined();
        expect(cand.tradeoffs).toBeInstanceOf(Array);
        expect(cand.tradeoffs.length).toBeGreaterThanOrEqual(1);
        expect(cand.proposal).toBeDefined();
        expect(typeof cand.costDifference).toBe('number');
      });
    });

    it('recommends Comfort/Indoor-Safe strategy when simulated disruption is active', () => {
      const result = generateCandidateProposals(baseTrip, {
        simulatedDisruption: { outdoorUnsuitable: true, reason: 'Heavy rainfall' }
      });

      const recommended = result.candidates.find(c => c.recommended);
      expect(recommended.strategy).toBe('Comfort/Indoor-Safe');
    });

    it('runDeterministicAgentLoop includes candidates array in return payload', async () => {
      const result = await runDeterministicAgentLoop({
        activeTrip: baseTrip,
        requestedChanges: { durationDelta: -1 }
      });

      expect(result.success).toBe(true);
      expect(result.candidates).toBeInstanceOf(Array);
      expect(result.candidates.length).toBeGreaterThanOrEqual(2);
      expect(result.proposal).toBeDefined();

      // Verify trace includes step 5 (verify_proposal)
      const verifyStep = result.trace.find(t => t.toolCall.name === 'verify_proposal');
      expect(verifyStep).toBeDefined();
      expect(verifyStep.observation.checks).toBeDefined();
    });

    it('POST /api/agent/recover returns candidates array along with backward-compatible proposal', async () => {
      const res = await fetch(`${baseUrl}/api/agent/recover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activeTrip: baseTrip,
          forceFallback: true,
          requestedChanges: { budgetDelta: -4000 }
        })
      });

      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(data.proposal).toBeDefined();
      expect(data.candidates).toBeInstanceOf(Array);
      expect(data.candidates.length).toBeGreaterThanOrEqual(2);

      // Validate each candidate proposal
      data.candidates.forEach(c => {
        const val = validateRecoveryProposal(c.proposal, baseTrip);
        expect(val.isValid).toBe(true);
      });
    });
  });

  // =========================================================================
  // 5. FEATURE 2: MOCKED LLM MULTI-PROPOSAL COLLECTION
  // =========================================================================
  describe('Feature 2: LLM Loop collecting multiple draft_recovery_proposal calls', () => {
    it('collects multiple drafted proposals into candidates without terminating prematurely', async () => {
      const mockCandidateTurn1 = {
        content: {
          role: 'model',
          parts: [
            { text: 'Inspecting active trip and searching options.' },
            {
              functionCall: {
                name: 'inspect_active_trip',
                args: {},
                id: 'call_inspect_1'
              }
            }
          ]
        }
      };

      const mockCandidateTurn2 = {
        content: {
          role: 'model',
          parts: [
            { text: 'Drafting Strategy 1: Budget Saver' },
            {
              functionCall: {
                name: 'draft_recovery_proposal',
                args: {
                  newDuration: 5,
                  newBudget: 17000,
                  selectedTransportId: manaliData.transportOptions[0].id,
                  selectedAccommodationId: manaliData.accommodations[0].id, // Hostel
                  strategy: 'Budget Saver',
                  tradeoffs: ['Lowest total cost', 'Hostel accommodation'],
                  actionsTaken: ['Selected budget transport and hostel lodging'],
                  agentExplanation: 'Formulated Budget Saver candidate.'
                },
                id: 'call_draft_budget_saver'
              }
            },
            {
              functionCall: {
                name: 'draft_recovery_proposal',
                args: {
                  newDuration: 5,
                  newBudget: 22000,
                  selectedTransportId: manaliData.transportOptions[1]?.id || manaliData.transportOptions[0].id,
                  selectedAccommodationId: manaliData.accommodations[1].id, // Standard
                  strategy: 'Comfort/Indoor-Safe',
                  tradeoffs: ['Enhanced comfort', 'Standard private room'],
                  actionsTaken: ['Selected standard hotel lodging'],
                  agentExplanation: 'Formulated Comfort candidate.'
                },
                id: 'call_draft_comfort'
              }
            }
          ]
        }
      };

      let turnCount = 0;
      const mockAiClient = {
        models: {
          generateContent: async () => {
            turnCount++;
            if (turnCount === 1) {
              return {
                candidates: [mockCandidateTurn1],
                functionCalls: [mockCandidateTurn1.content.parts[1].functionCall]
              };
            }
            return {
              candidates: [mockCandidateTurn2],
              functionCalls: [
                mockCandidateTurn2.content.parts[1].functionCall,
                mockCandidateTurn2.content.parts[2].functionCall
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
      expect(result.proposal).toBeDefined();
      expect(result.candidates).toBeInstanceOf(Array);
      expect(result.candidates.length).toBe(2);

      const strategies = result.candidates.map(c => c.strategy);
      expect(strategies).toContain('Budget Saver');
      expect(strategies).toContain('Comfort/Indoor-Safe');

      // Exactly 1 recommended candidate
      const rec = result.candidates.filter(c => c.recommended);
      expect(rec.length).toBe(1);
    });
  });
});
