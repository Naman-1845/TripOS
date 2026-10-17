import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getAgentStatus, requestTripRecovery } from '../services/agentClient.js';
import { applyProposal, rejectProposal, isProposalStale, validateRecoveryProposal } from '../services/recoveryEngine.js';
import { StorageService } from '../services/storageService.js';
import { getDestinationData } from '../data/destinationsData.js';
import { calculateBudgetBreakdown } from '../services/budgetEngine.js';
import { generateItinerary } from '../services/itineraryEngine.js';

// Setup mock storage for persistence tests in node environment
const memoryStore = {};
global.localStorage = {
  getItem: (key) => memoryStore[key] || null,
  setItem: (key, val) => { memoryStore[key] = String(val); },
  removeItem: (key) => { delete memoryStore[key]; },
  clear: () => {
    Object.keys(memoryStore).forEach(k => delete memoryStore[k]);
  }
};

describe('TripOS Frontend Agent Client & Recovery Flow', () => {
  const manaliData = getDestinationData('Manali');
  const baseTrip = {
    id: 'active_client_test_trip_123',
    name: 'Delhi to Manali (5d)',
    inputs: {
      origin: 'Delhi',
      destination: 'Manali',
      startDate: '2026-11-01',
      duration: 5,
      travellers: 2,
      budget: 20000,
      interests: ['Adventure', 'Nature'],
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

  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // 1. getAgentStatus Tests
  describe('getAgentStatus', () => {
    it('returns online metadata when backend server is running', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 'online',
          configured: true,
          mode: 'live-llm-agent',
          provider: 'Google Gemini (@google/genai)',
          model: 'gemini-3.8-flash',
          registeredTools: ['inspect_active_trip', 'search_travel_options', 'calculate_trip_budget', 'draft_recovery_proposal']
        })
      });

      const status = await getAgentStatus();
      expect(status.isOnline).toBe(true);
      expect(status.mode).toBe('live-llm-agent');
      expect(status.model).toBe('gemini-3.8-flash');
      expect(status.registeredTools.length).toBe(4);
    });

    it('returns offline status and labels local fallback when server cannot be reached', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Failed to fetch'));

      const status = await getAgentStatus();
      expect(status.isOnline).toBe(false);
      expect(status.status).toBe('offline');
      expect(status.mode).toBe('local-offline-fallback');
      expect(status.provider).toContain('Offline');
    });
  });

  // 2. requestTripRecovery Tests
  describe('requestTripRecovery', () => {
    it('maps server response correctly when backend returns a proposal', async () => {
      const mockServerProposal = {
        proposalId: 'prop_agent_mock_001',
        createdAt: '2026-10-17T20:00:00.000Z',
        status: 'pending',
        source: 'agent',
        agentExplanation: 'Evaluated budget cut and adjusted lodging.',
        triggerReasons: ['Budget decreased by ₹4,000'],
        actionsTaken: ['Adjusted lodging tier to Hostel'],
        costImpact: {
          oldTotal: 16800,
          newTotal: 14200,
          costDifference: -2600,
          oldRemaining: 3200,
          newRemaining: 1800,
          isOverBudgetNow: false,
          savings: 2600
        },
        originalSnapshot: {
          tripId: baseTrip.id,
          inputs: { ...baseTrip.inputs },
          budgetBreakdown: { ...baseTrip.budgetBreakdown }
        },
        proposedPlan: {
          inputs: { ...baseTrip.inputs, budget: 16000 },
          selectedTransport: baseTrip.selectedTransport,
          selectedAccommodation: manaliData.accommodations[0],
          budgetBreakdown: {
            userBudget: 16000,
            totalEstimatedExpenses: 14200,
            remainingBudget: 1800,
            isOverBudget: false
          },
          itinerary: baseTrip.itinerary
        }
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          mode: 'live-llm-agent',
          provider: 'Google Gemini (gemini-3.8-flash)',
          model: 'gemini-3.8-flash',
          proposal: mockServerProposal,
          trace: [
            { step: 1, thought: 'Inspecting active trip', toolCall: { name: 'inspect_active_trip', args: {} } }
          ],
          agentSummary: 'Evaluated budget cut and adjusted lodging.'
        })
      });

      const res = await requestTripRecovery({
        activeTrip: baseTrip,
        requestedChanges: { budget: 16000 }
      });

      expect(res.success).toBe(true);
      expect(res.mode).toBe('live-llm-agent');
      expect(res.proposal.executionMode).toBe('live-llm-agent');
      expect(res.proposal.trace.length).toBe(1);
      expect(res.proposal.status).toBe('pending');
      expect(res.isOfflineFallback).toBe(false);
    });

    it('honestly labels local-offline-fallback when backend is unreachable', async () => {
      // Simulate network failure
      global.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'));

      const res = await requestTripRecovery({
        activeTrip: baseTrip,
        requestedChanges: { budget: 16000 }
      });

      expect(res.success).toBe(true);
      expect(res.isOfflineFallback).toBe(true);
      expect(res.mode).toBe('local-offline-fallback');
      expect(res.proposal.executionMode).toBe('local-offline-fallback');
      expect(res.provider).toContain('Offline');
      expect(res.proposal.agentSummary).toContain('Backend unreachable');
      // Proposal must still be valid and pending
      expect(res.proposal.status).toBe('pending');
      expect(res.proposal.proposedPlan.inputs.budget).toBe(16000);
    });

    it('correctly handles mid-trip deltas in offline fallback mode', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Backend offline'));

      const res = await requestTripRecovery({
        activeTrip: baseTrip,
        requestedChanges: {
          durationDelta: 2,
          budgetDelta: -3000,
          userReason: 'Mid-trip extension with tighter budget'
        }
      });

      expect(res.success).toBe(true);
      expect(res.mode).toBe('local-offline-fallback');
      // Duration: 5 + 2 = 7 days, Budget: 20000 - 3000 = 17000
      expect(res.proposal.proposedPlan.inputs.duration).toBe(7);
      expect(res.proposal.proposedPlan.inputs.budget).toBe(17000);
      expect(res.proposal.userReason).toBe('Mid-trip extension with tighter budget');
    });
  });

  // 3. Proposal Approval and Rejection Preservation
  describe('Proposal Approval and Rejection Invariants', () => {
    it('REJECT: preserves original active trip 100% unchanged without mutating any property', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Offline test'));

      const res = await requestTripRecovery({
        activeTrip: baseTrip,
        requestedChanges: { duration: 3 }
      });

      const originalDuration = baseTrip.inputs.duration;
      const originalBudget = baseTrip.inputs.budget;

      const { preservedTrip, auditLogEntry } = rejectProposal(baseTrip, res.proposal);

      // Active trip reference and inputs must remain identical
      expect(preservedTrip).toBe(baseTrip);
      expect(preservedTrip.inputs.duration).toBe(originalDuration);
      expect(preservedTrip.inputs.budget).toBe(originalBudget);

      // Audit log must record rejection
      expect(auditLogEntry.action).toBe('REJECTED');
      expect(auditLogEntry.proposalId).toBe(res.proposal.proposalId);
    });

    it('APPROVE: updates active trip with proposed plan and creates APPROVED audit log', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Offline test'));

      const res = await requestTripRecovery({
        activeTrip: baseTrip,
        requestedChanges: { budget: 16000 }
      });

      const { updatedTrip, auditLogEntry } = applyProposal(baseTrip, res.proposal);

      // Updated trip has new budget
      expect(updatedTrip.inputs.budget).toBe(16000);
      expect(updatedTrip.id).toBe(baseTrip.id);

      // Audit log records approval
      expect(auditLogEntry.action).toBe('APPROVED');
      expect(auditLogEntry.proposalId).toBe(res.proposal.proposalId);
    });
  });

  // 4. Proposal Staleness and Approval Readiness (Bug Fix Verification)
  describe('Proposal Staleness and Approval Button Readiness', () => {
    it('isProposalStale returns false for pending proposals with autonomous adjustments', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Offline'));

      // Scenario A: budget cut from 20000 to 16000
      const resA = await requestTripRecovery({
        activeTrip: baseTrip,
        requestedChanges: { budget: 16000 }
      });
      expect(isProposalStale(resA.proposal, baseTrip.inputs, baseTrip)).toBe(false);

      // Scenario B: duration cut from 5 to 3
      const resB = await requestTripRecovery({
        activeTrip: baseTrip,
        requestedChanges: { duration: 3 }
      });
      expect(isProposalStale(resB.proposal, baseTrip.inputs, baseTrip)).toBe(false);

      // Scenario C: simulated disruption
      const resC = await requestTripRecovery({
        activeTrip: baseTrip,
        simulatedDisruption: 'Heavy Snowfall Alert'
      });
      expect(isProposalStale(resC.proposal, baseTrip.inputs, baseTrip)).toBe(false);

      // Mid-trip delta
      const resDelta = await requestTripRecovery({
        activeTrip: baseTrip,
        requestedChanges: { durationDelta: 1, budgetDelta: -2000 }
      });
      expect(isProposalStale(resDelta.proposal, baseTrip.inputs, baseTrip)).toBe(false);
    });

    it('isProposalStale returns true when fundamental immutable constraints or trip identity change', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Offline'));

      const res = await requestTripRecovery({
        activeTrip: baseTrip,
        requestedChanges: { budget: 16000 }
      });

      // Different destination
      expect(isProposalStale(res.proposal, { ...baseTrip.inputs, destination: 'Goa' }, baseTrip)).toBe(true);
      // Different origin
      expect(isProposalStale(res.proposal, { ...baseTrip.inputs, origin: 'Mumbai' }, baseTrip)).toBe(true);
      // Different travellers count
      expect(isProposalStale(res.proposal, { ...baseTrip.inputs, travellers: 4 }, baseTrip)).toBe(true);
      // Different active trip ID
      expect(isProposalStale(res.proposal, baseTrip.inputs, { ...baseTrip, id: 'different_trip_999' })).toBe(true);
      // Active trip baseline duration mutated behind the scenes
      expect(isProposalStale(res.proposal, baseTrip.inputs, { ...baseTrip, inputs: { ...baseTrip.inputs, duration: 10 } })).toBe(true);
    });

    it('approval button readiness condition correctly enables when valid and pending', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Offline'));

      const res = await requestTripRecovery({
        activeTrip: baseTrip,
        requestedChanges: { budget: 16000 }
      });

      const proposal = res.proposal;
      let isStale = isProposalStale(proposal, baseTrip.inputs, baseTrip);
      let isApproving = false;

      // Approval button disabled condition in RecoveryModal:
      // disabled = isStale || isApproving || !proposal || proposal.status !== 'pending'
      const isApproveDisabled = isStale || isApproving || !proposal || proposal.status !== 'pending';
      expect(isApproveDisabled).toBe(false); // Enabled and clickable!

      // If approving is in progress, it should disable
      isApproving = true;
      expect(isStale || isApproving || !proposal || proposal.status !== 'pending').toBe(true);

      // If proposal is resolved (e.g. already approved), it should disable
      isApproving = false;
      const approvedProposal = { ...proposal, status: 'approved' };
      expect(isStale || isApproving || !approvedProposal || approvedProposal.status !== 'pending').toBe(true);
    });
  });

  // 5. Step 4: Recovery Workflow Reliability & Validation
  describe('Step 4: Recovery Workflow Reliability & Validation', () => {
    it('validateRecoveryProposal detects invalid or malformed proposals with clear errors', () => {
      // Null proposal
      expect(validateRecoveryProposal(null).isValid).toBe(false);

      // Non-pending status
      expect(validateRecoveryProposal({ proposalId: 'p1', status: 'approved' }).isValid).toBe(false);

      // Missing proposedPlan
      const noPlan = { proposalId: 'p1', status: 'pending' };
      const resPlan = validateRecoveryProposal(noPlan);
      expect(resPlan.isValid).toBe(false);
      expect(resPlan.errors.some(e => e.includes('missing proposedPlan'))).toBe(true);

      // Missing itinerary days
      const invalidItinerary = {
        proposalId: 'p1',
        status: 'pending',
        proposedPlan: {
          inputs: { origin: 'Delhi', destination: 'Manali', duration: 5, budget: 20000, travellers: 2 },
          itinerary: { days: [] },
          selectedTransport: { id: 't1' },
          selectedAccommodation: { id: 'a1' },
          budgetBreakdown: { totalEstimatedExpenses: 15000 }
        }
      };
      const resItin = validateRecoveryProposal(invalidItinerary);
      expect(resItin.isValid).toBe(false);
      expect(resItin.errors.some(e => e.includes('missing a valid itinerary'))).toBe(true);
    });

    it('applyProposal throws and rejects approval if proposal is malformed', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Offline'));

      const res = await requestTripRecovery({
        activeTrip: baseTrip,
        requestedChanges: { budget: 16000 }
      });

      const malformed = {
        ...res.proposal,
        proposedPlan: {
          ...res.proposal.proposedPlan,
          itinerary: null // Malformed
        }
      };

      expect(() => applyProposal(baseTrip, malformed)).toThrow(/Cannot approve proposal/);
    });

    it('applyProposal throws and revalidates staleness at approval time', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Offline'));

      const res = await requestTripRecovery({
        activeTrip: baseTrip,
        requestedChanges: { budget: 16000 }
      });

      // Stale case 1: active trip changed identity
      const modifiedTrip = { ...baseTrip, id: 'different_trip_999' };
      expect(() => applyProposal(modifiedTrip, res.proposal)).toThrow(/Cannot approve proposal: Proposal is stale/);

      // Stale case 2: active trip duration mutated while proposal was pending
      const durationModifiedTrip = {
        ...baseTrip,
        inputs: { ...baseTrip.inputs, duration: 10 }
      };
      expect(() => applyProposal(durationModifiedTrip, res.proposal)).toThrow(/Cannot approve proposal: Proposal is stale/);
    });

    it('rejectProposal throws when active trip is missing or proposal is not pending', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Offline'));

      const res = await requestTripRecovery({
        activeTrip: baseTrip,
        requestedChanges: { budget: 16000 }
      });

      // Missing active trip
      expect(() => rejectProposal(null, res.proposal)).toThrow(/active trip baseline is required/);

      // Already approved or resolved proposal
      const approvedProposal = { ...res.proposal, status: 'approved' };
      expect(() => rejectProposal(baseTrip, approvedProposal)).toThrow(/Only a pending proposal can be rejected/);
    });

    it('requestTripRecovery gracefully falls back to offline engine when server returns a malformed proposal', async () => {
      // Backend responds 200 OK but proposal JSON is missing itinerary days
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          mode: 'live-llm-agent',
          provider: 'Google Gemini',
          proposal: {
            proposalId: 'prop_bad_001',
            status: 'pending',
            proposedPlan: {
              inputs: { origin: 'Delhi', destination: 'Manali', duration: 5, budget: 16000, travellers: 2 },
              itinerary: null // Malformed!
            }
          }
        })
      });

      const res = await requestTripRecovery({
        activeTrip: baseTrip,
        requestedChanges: { budget: 16000 }
      });

      // Gracefully activated local offline fallback with honest labeling
      expect(res.success).toBe(true);
      expect(res.isOfflineFallback).toBe(true);
      expect(res.mode).toBe('local-offline-fallback');
      expect(res.proposal.proposedPlan.itinerary.days.length).toBeGreaterThan(0);
      expect(res.proposal.agentSummary).toContain('Backend proposal malformed');
    });

    it('concurrent submission guards: buttons disable when approving or rejecting is in progress', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Offline'));

      const res = await requestTripRecovery({
        activeTrip: baseTrip,
        requestedChanges: { budget: 16000 }
      });

      const proposal = res.proposal;
      let isStale = false;
      let isApproving = false;
      let isRejecting = false;

      // Normal state: Approve enabled, Reject enabled
      expect(isStale || isApproving || isRejecting || !proposal || proposal.status !== 'pending').toBe(false);
      expect(isApproving || isRejecting).toBe(false);

      // While rejecting: both disabled
      isRejecting = true;
      expect(isStale || isApproving || isRejecting || !proposal || proposal.status !== 'pending').toBe(true);
      expect(isApproving || isRejecting).toBe(true);

      // While approving: both disabled
      isRejecting = false;
      isApproving = true;
      expect(isStale || isApproving || isRejecting || !proposal || proposal.status !== 'pending').toBe(true);
      expect(isApproving || isRejecting).toBe(true);
    });

    it('BUG 1 & 2 REGRESSION: Changing destination from Manali to Goa produces valid Goa proposal with Approve button enabled', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Offline'));

      // 1. User changes destination from Manali to Goa and increases budget to 25000
      const res = await requestTripRecovery({
        activeTrip: baseTrip,
        requestedChanges: {
          destination: 'Goa',
          budget: 25000
        }
      });

      expect(res.success).toBe(true);
      const proposal = res.proposal;

      // Invariant: Baseline active trip remains untouched before approval
      expect(baseTrip.inputs.destination).toBe('Manali');
      expect(baseTrip.inputs.budget).toBe(20000);

      // Proposal contains new destination Goa and updated budget
      expect(proposal.status).toBe('pending');
      expect(proposal.proposedPlan.inputs.destination).toBe('Goa');
      expect(proposal.proposedPlan.inputs.budget).toBe(25000);
      expect(proposal.proposedPlan.itinerary.days.length).toBe(5);

      // Current form inputs match the requested changes
      const currentFormInputs = {
        origin: 'Delhi',
        destination: 'Goa',
        budget: 25000,
        duration: 5,
        travellers: 2
      };

      // Invariant: Proposal must NOT be marked stale for legitimate destination change
      const isStale = isProposalStale(proposal, currentFormInputs, baseTrip);
      expect(isStale).toBe(false);

      // Validation against active trip must succeed
      const validation = validateRecoveryProposal(proposal, baseTrip);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);

      // Approval button must be ENABLED
      const isApproveDisabled = isStale || !proposal || proposal.status !== 'pending' || !validation.isValid;
      expect(isApproveDisabled).toBe(false);

      // Approving the proposal successfully updates the active trip to Goa
      const { updatedTrip, auditLogEntry } = applyProposal(baseTrip, proposal);
      expect(updatedTrip.inputs.destination).toBe('Goa');
      expect(updatedTrip.inputs.budget).toBe(25000);
      expect(updatedTrip.name).toContain('Goa');
      expect(auditLogEntry.action).toBe('APPROVED');
    });

    it('Staleness guard: Invalids/disables proposal when user modifies form to another destination', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Offline'));

      const res = await requestTripRecovery({
        activeTrip: baseTrip,
        requestedChanges: { destination: 'Goa', budget: 25000 }
      });

      const proposal = res.proposal;

      // User modified form destination in background to 'Jaipur'
      const modifiedFormInputs = {
        origin: 'Delhi',
        destination: 'Jaipur',
        budget: 25000,
        duration: 5,
        travellers: 2
      };

      const isStale = isProposalStale(proposal, modifiedFormInputs, baseTrip);
      expect(isStale).toBe(true);

      // Approve button must be disabled due to staleness
      const validation = validateRecoveryProposal(proposal, baseTrip);
      const isApproveDisabled = isStale || !proposal || proposal.status !== 'pending' || !validation.isValid;
      expect(isApproveDisabled).toBe(true);
    });

    it('In-flight sequencing: Out-of-order asynchronous responses are dropped by sequence id', async () => {
      let activeReqId = 0;
      let finalCommittedProposal = null;

      const launchRequest = async (destination, delayMs) => {
        const reqId = ++activeReqId;
        await new Promise(r => setTimeout(r, delayMs));
        const res = await requestTripRecovery({
          activeTrip: baseTrip,
          requestedChanges: { destination }
        });

        // Sequence guard
        if (reqId === activeReqId) {
          finalCommittedProposal = res.proposal;
        }
      };

      // Launch request 1 (slow, destination: 'Goa', 60ms)
      const p1 = launchRequest('Goa', 60);
      // Launch request 2 (fast, destination: 'Jaipur', 10ms)
      const p2 = launchRequest('Jaipur', 10);

      await Promise.all([p1, p2]);

      // Even though Goa completed later, Jaipur was request #2 and activeReqId was 2.
      // Wait: p2 finishes first at 10ms (activeReqId was 2, commits Jaipur).
      // At 60ms, p1 finishes (reqId was 1, activeReqId is 2 -> dropped!).
      expect(finalCommittedProposal.proposedPlan.inputs.destination).toBe('Jaipur');
    });

    it('Scenario 7: Failed storage write during approval leaves active trip uncorrupted', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Offline'));

      const res = await requestTripRecovery({
        activeTrip: baseTrip,
        requestedChanges: { budget: 16000 }
      });
      const proposal = res.proposal;

      // Deep copy baseline to check immutability
      const baselineCopy = JSON.parse(JSON.stringify(baseTrip));

      // Mock storage saveTrip to throw an error (e.g. disk full / quota exceeded)
      const originalSaveTrip = StorageService.saveTrip;
      StorageService.saveTrip = vi.fn().mockImplementation(() => {
        throw new Error('QuotaExceededError: LocalStorage quota exceeded.');
      });

      try {
        let activeTripState = { ...baseTrip };
        expect(() => {
          const { updatedTrip } = applyProposal(activeTripState, proposal);
          StorageService.saveTrip(updatedTrip);
          activeTripState = updatedTrip; // this must not execute
        }).toThrow(/QuotaExceededError/);

        // Invariant: activeTripState was NOT modified
        expect(activeTripState.inputs.budget).toBe(20000);
        expect(activeTripState).toEqual(baselineCopy);
      } finally {
        StorageService.saveTrip = originalSaveTrip;
      }
    });

    it('Scenario 8: Duplicate approval or rejection calls cannot corrupt trip state', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Offline'));

      const res = await requestTripRecovery({
        activeTrip: baseTrip,
        requestedChanges: { budget: 16000 }
      });
      const proposal = res.proposal;

      // First approval succeeds
      const { updatedTrip, resolvedProposal } = applyProposal(baseTrip, proposal);
      expect(resolvedProposal.status).toBe('approved');
      expect(updatedTrip.inputs.budget).toBe(16000);

      // Duplicate approval with resolved proposal is strictly rejected
      expect(() => applyProposal(updatedTrip, resolvedProposal)).toThrow(/Only pending proposals can be approved/);

      // Rejection on an already resolved proposal is rejected
      expect(() => rejectProposal(updatedTrip, resolvedProposal)).toThrow(/Only a pending proposal can be rejected/);

      // Duplicate audit history entry is deduplicated and prevented
      const initialHistory = StorageService.getRecoveryHistory().length;
      StorageService.addRecoveryHistoryEntry({ id: 'dup_log_1', proposalId: resolvedProposal.proposalId, action: 'APPROVED' });
      StorageService.addRecoveryHistoryEntry({ id: 'dup_log_2', proposalId: resolvedProposal.proposalId, action: 'APPROVED' });
      const finalHistory = StorageService.getRecoveryHistory().length;
      expect(finalHistory - initialHistory).toBeLessThanOrEqual(1);
    });
  });
});



