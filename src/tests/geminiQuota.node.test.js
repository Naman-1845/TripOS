import { test, describe, beforeEach, expect } from 'vitest';
import assert from 'node:assert/strict';

import {
  isGeminiQuotaExceededError,
  sanitizeSecrets,
  setQuotaCooldown,
  resetQuotaCooldown,
  getQuotaCooldownStatus,
  handleRecoverRequest,
  runDeterministicAgentLoop
} from '../../server/agentServer.js';
import { getDestinationData } from '../data/destinationsData.js';
import { generateItinerary } from '../services/itineraryEngine.js';
import { calculateBudgetBreakdown } from '../services/budgetEngine.js';
import { validateRecoveryProposal } from '../services/recoveryEngine.js';

describe('TripOS Gemini Quota & Error Handling (Node Native Test Suite)', () => {
  const manaliData = getDestinationData('Manali');
  const baseTrip = {
    id: 'node_test_trip_001',
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

  beforeEach(() => {
    resetQuotaCooldown();
  });

  describe('Requirement 1: Detect Gemini HTTP 429 RESOURCE_EXHAUSTED errors', () => {
    test('detects HTTP 429 in status and statusCode as numbers and strings', () => {
      assert.equal(isGeminiQuotaExceededError({ status: 429 }), true);
      assert.equal(isGeminiQuotaExceededError({ statusCode: 429 }), true);
      assert.equal(isGeminiQuotaExceededError({ code: 429 }), true);
      assert.equal(isGeminiQuotaExceededError({ httpStatus: 429 }), true);
      assert.equal(isGeminiQuotaExceededError({ status: '429' }), true);
      assert.equal(isGeminiQuotaExceededError({ statusCode: '429' }), true);
      assert.equal(isGeminiQuotaExceededError({ code: '429' }), true);
    });

    test('detects RESOURCE_EXHAUSTED code and status strings', () => {
      assert.equal(isGeminiQuotaExceededError({ code: 'RESOURCE_EXHAUSTED' }), true);
      assert.equal(isGeminiQuotaExceededError({ status: 'RESOURCE_EXHAUSTED' }), true);
      assert.equal(isGeminiQuotaExceededError({ code: 'resource_exhausted' }), true);
    });

    test('detects HTTP response objects with 429 or Too Many Requests', () => {
      assert.equal(isGeminiQuotaExceededError({ response: { status: 429 } }), true);
      assert.equal(isGeminiQuotaExceededError({ response: { statusText: 'Too Many Requests' } }), true);
      assert.equal(isGeminiQuotaExceededError({
        response: { data: { error: { message: 'Quota exceeded for project' } } }
      }), true);
    });

    test('detects Google Cloud errorDetails array with RATE_LIMIT_EXHAUSTED or QUOTA', () => {
      assert.equal(isGeminiQuotaExceededError({
        errorDetails: [{ reason: 'RATE_LIMIT_EXHAUSTED' }]
      }), true);
      assert.equal(isGeminiQuotaExceededError({
        errorDetails: [{ metadata: { quota_limit: 'RESOURCE_EXHAUSTED' } }]
      }), true);
    });

    test('detects nested error objects from GoogleGenAI SDK', () => {
      assert.equal(isGeminiQuotaExceededError({
        error: { code: 429, message: 'Resource has been exhausted' }
      }), true);
      assert.equal(isGeminiQuotaExceededError({
        error: { status: 'RESOURCE_EXHAUSTED' }
      }), true);
    });

    test('detects quota exceeded phrases in error messages', () => {
      assert.equal(isGeminiQuotaExceededError(new Error('RESOURCE_EXHAUSTED: Quota exceeded for quota metric Generate Content API requests')), true);
      assert.equal(isGeminiQuotaExceededError(new Error('[429 Resource Exhausted] Rate limit exceeded')), true);
      assert.equal(isGeminiQuotaExceededError(new Error('You have exceeded your current quota, please check your plan and billing details.')), true);
    });

    test('detects quota error wrapped in cause property', () => {
      const wrappedErr = new Error('Client execution failed', {
        cause: { status: 429, message: 'Too Many Requests' }
      });
      assert.equal(isGeminiQuotaExceededError(wrappedErr), true);
    });

    test('returns false for null, undefined, and non-quota errors', () => {
      assert.equal(isGeminiQuotaExceededError(null), false);
      assert.equal(isGeminiQuotaExceededError(undefined), false);
      assert.equal(isGeminiQuotaExceededError({ status: 500, message: 'Internal Server Error' }), false);
      assert.equal(isGeminiQuotaExceededError(new Error('Connection timed out')), false);
      assert.equal(isGeminiQuotaExceededError(new Error('Invalid destination provided')), false);
    });
  });

  describe('Requirement 5: Keep API keys and secrets out of logs', () => {
    test('sanitizeSecrets removes Google API keys, key parameters, and bearer tokens', () => {
      const dirty = 'Request failed: https://generativelanguage.googleapis.com/v1beta/models?key=AIzaSyA1234567890123456789012345678901 with Bearer ya29.testToken123456';
      const clean = sanitizeSecrets(dirty);

      assert.equal(clean.includes('AIzaSyA1234567890123456789012345678901'), false);
      assert.equal(clean.includes('ya29.testToken123456'), false);
      assert.equal(clean.includes('[REDACTED_API_KEY]'), true);
      assert.equal(clean.includes('Bearer REDACTED'), true);
    });
  });

  describe('Requirement 2, 3, 4, 6: Quota cooldown & immediate deterministic runner execution', () => {
    function createMockRes() {
      let statusCode = 200;
      let jsonPayload = null;
      return {
        status(code) {
          statusCode = code;
          return this;
        },
        json(data) {
          jsonPayload = data;
          return this;
        },
        getStatusCode: () => statusCode,
        getData: () => jsonPayload
      };
    }

    test('immediately uses deterministic recovery runner when Gemini quota is exceeded (HTTP 429)', async () => {
      let llmCalls = 0;
      const mockAiClient = {
        models: {
          generateContent: async () => {
            llmCalls++;
            const err = new Error('RESOURCE_EXHAUSTED: Quota exceeded for quota metric Generate Content API requests');
            err.status = 429;
            err.code = 'RESOURCE_EXHAUSTED';
            throw err;
          }
        }
      };

      const req = {
        body: {
          activeTrip: baseTrip,
          requestedChanges: { budgetDelta: -4000 }
        },
        app: {
          locals: { aiClient: mockAiClient }
        }
      };
      const res = createMockRes();

      await handleRecoverRequest(req, res);

      assert.equal(res.getStatusCode(), 200);
      const data = res.getData();

      assert.equal(data.success, true);
      assert.equal(data.mode, 'deterministic-fallback-on-error');
      assert.equal(data.notice.includes('429'), true);
      assert.equal(data.agentSummary.includes('quota exceeded'), true);
      assert.equal(llmCalls, 1);

      // Verify proposal validity and non-mutation
      assert.ok(data.proposal);
      assert.equal(data.proposal.status, 'pending');
      assert.equal(data.proposal.proposedPlan.inputs.budget, 16000);
      assert.equal(baseTrip.inputs.budget, 20000); // active trip preserved

      const validation = validateRecoveryProposal(data.proposal, baseTrip);
      assert.equal(validation.isValid, true);

      // Verify quota cooldown is active
      const cooldown = getQuotaCooldownStatus();
      assert.equal(cooldown.isQuotaExceeded, true);
      assert.ok(cooldown.cooldownRemainingMs > 0);
    });

    test('avoids repeatedly retrying failed requests when quota cooldown is active', async () => {
      let llmCalls = 0;
      const mockAiClient = {
        models: {
          generateContent: async () => {
            llmCalls++;
            throw new Error('Should NEVER be called during active cooldown');
          }
        }
      };

      // Explicitly set cooldown active
      setQuotaCooldown(30000);

      const req = {
        body: {
          activeTrip: baseTrip,
          requestedChanges: { durationDelta: -1 }
        },
        app: {
          locals: { aiClient: mockAiClient }
        }
      };
      const res = createMockRes();

      await handleRecoverRequest(req, res);

      assert.equal(res.getStatusCode(), 200);
      const data = res.getData();

      // Crucial: LLM was NOT invoked at all
      assert.equal(llmCalls, 0);
      assert.equal(data.success, true);
      assert.equal(data.mode, 'deterministic-fallback-on-error');
      assert.equal(data.notice.includes('cooldown'), true);
      assert.equal(data.proposal.proposedPlan.inputs.duration, 4);

      const validation = validateRecoveryProposal(data.proposal, baseTrip);
      assert.equal(validation.isValid, true);
    });

    test('preserves fallback behavior for other non-quota failures without activating quota cooldown', async () => {
      let llmCalls = 0;
      const mockAiClient = {
        models: {
          generateContent: async () => {
            llmCalls++;
            const err = new Error('500 Internal Server Error from upstream Gemini backend');
            err.status = 500;
            throw err;
          }
        }
      };

      const req = {
        body: {
          activeTrip: baseTrip,
          requestedChanges: { budgetDelta: -2000 }
        },
        app: {
          locals: { aiClient: mockAiClient }
        }
      };
      const res = createMockRes();

      await handleRecoverRequest(req, res);

      assert.equal(res.getStatusCode(), 200);
      const data = res.getData();

      assert.equal(data.success, true);
      assert.equal(data.mode, 'deterministic-fallback-on-error');
      assert.equal(data.notice.includes('Live LLM provider encountered an error'), true);
      assert.equal(llmCalls, 1);

      // Quota cooldown must NOT be activated for 500 errors
      const cooldown = getQuotaCooldownStatus();
      assert.equal(cooldown.isQuotaExceeded, false);
    });
  });
});

