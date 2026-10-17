import { describe, it, expect } from 'vitest';
import {
  generateRecoveryProposal,
  applyProposal,
  rejectProposal,
  isProposalStale,
  calculateTripDeltas,
  generateRecoveryProposalFromDeltas
} from '../services/recoveryEngine.js';
import { generateItinerary } from '../services/itineraryEngine.js';
import { calculateBudgetBreakdown } from '../services/budgetEngine.js';
import { getDestinationData } from '../data/destinationsData.js';
import { StorageService } from '../services/storageService.js';

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

describe('Travel Recovery Engine', () => {
  const destData = getDestinationData('Manali');
  const baseInputs = {
    origin: 'Delhi',
    destination: 'Manali',
    startDate: '2026-11-01',
    duration: 5,
    travellers: 2,
    budget: 20000,
    interests: ['Adventure', 'Nature', 'Culture'],
    transportPreference: 'Bus',
    accommodationPreference: 'Standard'
  };

  const initialItinerary = generateItinerary(baseInputs);
  const initialTransport = destData.transportOptions[0]; // Bus
  const initialAccommodation = destData.accommodations[1]; // Standard

  const initialBudget = calculateBudgetBreakdown({
    budget: baseInputs.budget,
    travellers: baseInputs.travellers,
    duration: baseInputs.duration,
    selectedTransport: initialTransport,
    selectedAccommodation: initialAccommodation,
    plannedActivities: initialItinerary.allPlannedActivities
  });

  const baseActiveTrip = {
    id: 'trip_test_1',
    name: 'Delhi to Manali (5d)',
    inputs: baseInputs,
    selectedTransport: initialTransport,
    selectedAccommodation: initialAccommodation,
    itinerary: initialItinerary,
    budgetBreakdown: initialBudget,
    simulatedDisruption: null
  };

  it('Scenario A: Responds to decreased budget by generating proposal without modifying active trip', () => {
    // Reduce budget from 20,000 to 16,000
    const proposal = generateRecoveryProposal(baseActiveTrip, { budget: 16000 });

    // Invariant 1: Active trip MUST remain unchanged
    expect(baseActiveTrip.inputs.budget).toBe(20000);
    expect(baseActiveTrip.budgetBreakdown.userBudget).toBe(20000);

    // Proposal properties
    expect(proposal.status).toBe('pending');
    expect(proposal.triggerReasons.some(r => r.includes('Budget decreased'))).toBe(true);
    expect(proposal.proposedPlan.inputs.budget).toBe(16000);
    expect(proposal.costImpact.oldTotal).toBe(baseActiveTrip.budgetBreakdown.totalEstimatedExpenses);

    // Apply proposal
    const { updatedTrip, auditLogEntry, resolvedProposal } = applyProposal(baseActiveTrip, proposal);
    expect(resolvedProposal.status).toBe('approved');
    expect(updatedTrip.inputs.budget).toBe(16000);
    expect(auditLogEntry.action).toBe('APPROVED');
  });

  it('Scenario B: Handles duration reduction and preserves active trip upon rejection', () => {
    // Shorten from 5 days to 3 days
    const proposal = generateRecoveryProposal(baseActiveTrip, { duration: 3 });

    expect(proposal.triggerReasons.some(r => r.includes('Trip shortened'))).toBe(true);
    expect(proposal.proposedPlan.inputs.duration).toBe(3);
    expect(proposal.proposedPlan.itinerary.days.length).toBe(3);

    // Reject proposal
    const { preservedTrip, auditLogEntry, resolvedProposal } = rejectProposal(baseActiveTrip, proposal);

    expect(resolvedProposal.status).toBe('rejected');
    expect(preservedTrip.inputs.duration).toBe(5);
    expect(preservedTrip.itinerary.days.length).toBe(5);
    expect(auditLogEntry.action).toBe('REJECTED');
  });

  it('Scenario C: Replaces outdoor activities upon simulated adverse weather disruption', () => {
    const proposal = generateRecoveryProposal(baseActiveTrip, {
      simulatedDisruption: {
        outdoorUnsuitable: true,
        reason: 'Heavy blizzard warning'
      }
    });

    expect(proposal.triggerReasons.some(r => r.includes('Adverse condition detected'))).toBe(true);
    expect(proposal.actionsTaken.some(a => a.includes('Substituted outdoor excursions'))).toBe(true);
    expect(proposal.proposedPlan.simulatedDisruption.outdoorUnsuitable).toBe(true);
  });

  it('Handles multiple simultaneous changes correctly', () => {
    const proposal = generateRecoveryProposal(baseActiveTrip, {
      budget: 15000,
      duration: 3,
      accommodationPreference: 'Hostel',
      interests: ['Food', 'Relaxation']
    });

    expect(proposal.triggerReasons.length).toBeGreaterThanOrEqual(3);
    expect(proposal.proposedPlan.inputs.duration).toBe(3);
    expect(proposal.proposedPlan.inputs.accommodationPreference).toBe('Hostel');
    expect(proposal.status).toBe('pending');
  });

  it('Detects stale proposals when active form inputs diverge', () => {
    const proposal = generateRecoveryProposal(baseActiveTrip, { budget: 16000 });
    expect(proposal.status).toBe('pending');

    // If form inputs match proposal, not stale
    expect(isProposalStale(proposal, proposal.proposedPlan.inputs)).toBe(false);

    // If user subsequently changed travellers in form
    const divergentForm = { ...proposal.proposedPlan.inputs, travellers: 4 };
    expect(isProposalStale(proposal, divergentForm)).toBe(true);
  });

  it('Handles repeated recovery requests safely without data corruption', () => {
    let currentTrip = baseActiveTrip;

    // First cycle: cut budget to 18,000 and approve
    const p1 = generateRecoveryProposal(currentTrip, { budget: 18000 });
    const res1 = applyProposal(currentTrip, p1);
    currentTrip = res1.updatedTrip;
    expect(currentTrip.inputs.budget).toBe(18000);

    // Second cycle: shorten duration to 4 and approve
    const p2 = generateRecoveryProposal(currentTrip, { duration: 4 });
    const res2 = applyProposal(currentTrip, p2);
    currentTrip = res2.updatedTrip;
    expect(currentTrip.inputs.duration).toBe(4);

    // Third cycle: cut budget to 14,000 and reject
    const p3 = generateRecoveryProposal(currentTrip, { budget: 14000 });
    const res3 = rejectProposal(currentTrip, p3);
    currentTrip = res3.preservedTrip;
    expect(currentTrip.inputs.budget).toBe(18000);
    expect(currentTrip.inputs.duration).toBe(4);
  });
});

describe('Feature: Update Trip Due to Changes', () => {
  const baseTrip = {
    id: 'active_trip_changes_1',
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
    selectedTransport: { id: 'bus-1', name: 'Volvo Bus', type: 'Bus', costPerPerson: 1200 },
    selectedAccommodation: { id: 'acc-1', name: 'Standard Hotel', type: 'Standard', costPerNight: 2400 },
    itinerary: generateItinerary({ origin: 'Delhi', destination: 'Manali', duration: 5 }),
    budgetBreakdown: calculateBudgetBreakdown({
      budget: 20000,
      travellers: 2,
      duration: 5,
      selectedTransport: { id: 'bus-1', name: 'Volvo Bus', type: 'Bus', costPerPerson: 1200 },
      selectedAccommodation: { id: 'acc-1', name: 'Standard Hotel', type: 'Standard', costPerNight: 2400 }
    })
  };

  it('A. Duration-only change (Example A: 5d + 2d = 7d)', () => {
    const calc = calculateTripDeltas(baseTrip.inputs, { durationDelta: 2 });
    expect(calc.isValid).toBe(true);
    expect(calc.resultingDuration).toBe(7);
    expect(calc.resultingBudget).toBe(20000);

    const proposal = generateRecoveryProposalFromDeltas(baseTrip, { durationDelta: 2 });
    expect(proposal.proposedPlan.inputs.duration).toBe(7);
    expect(proposal.proposedPlan.itinerary.days.length).toBe(7);
    expect(proposal.triggerReasons.some(r => r.includes('Trip lengthened by 2 day(s)'))).toBe(true);
    // Baseline remains untouched
    expect(baseTrip.inputs.duration).toBe(5);
  });

  it('A. Duration-only change (Example B: 5d - 2d = 3d)', () => {
    const calc = calculateTripDeltas(baseTrip.inputs, { durationDelta: -2 });
    expect(calc.isValid).toBe(true);
    expect(calc.resultingDuration).toBe(3);
    expect(calc.resultingBudget).toBe(20000);

    const proposal = generateRecoveryProposalFromDeltas(baseTrip, { durationDelta: -2 });
    expect(proposal.proposedPlan.inputs.duration).toBe(3);
    expect(proposal.proposedPlan.itinerary.days.length).toBe(3);
    expect(proposal.triggerReasons.some(r => r.includes('Trip shortened by 2 day(s)'))).toBe(true);
  });

  it('B. Budget-only change (Example C: ₹20,000 - ₹4,000 = ₹16,000)', () => {
    const calc = calculateTripDeltas(baseTrip.inputs, { budgetDelta: -4000 });
    expect(calc.isValid).toBe(true);
    expect(calc.resultingDuration).toBe(5);
    expect(calc.resultingBudget).toBe(16000);

    const proposal = generateRecoveryProposalFromDeltas(baseTrip, { budgetDelta: -4000 });
    expect(proposal.proposedPlan.inputs.budget).toBe(16000);
    expect(proposal.triggerReasons.some(r => r.includes('Budget decreased by ₹4,000'))).toBe(true);
  });

  it('B. Budget-only change (Positive: ₹20,000 + ₹5,000 = ₹25,000)', () => {
    const calc = calculateTripDeltas(baseTrip.inputs, { budgetDelta: 5000 });
    expect(calc.isValid).toBe(true);
    expect(calc.resultingDuration).toBe(5);
    expect(calc.resultingBudget).toBe(25000);

    const proposal = generateRecoveryProposalFromDeltas(baseTrip, { budgetDelta: 5000 });
    expect(proposal.proposedPlan.inputs.budget).toBe(25000);
    expect(proposal.triggerReasons.some(r => r.includes('Budget increased by ₹5,000'))).toBe(true);
  });

  it('C & D. Simultaneous changes with optional reason (Example D: +2d and -₹3,000)', () => {
    const userReason = 'Extended stay with tighter budget buffer';
    const calc = calculateTripDeltas(baseTrip.inputs, { durationDelta: 2, budgetDelta: -3000 });
    expect(calc.isValid).toBe(true);
    expect(calc.resultingDuration).toBe(7);
    expect(calc.resultingBudget).toBe(17000);

    const proposal = generateRecoveryProposalFromDeltas(baseTrip, {
      durationDelta: 2,
      budgetDelta: -3000,
      userReason
    });

    expect(proposal.proposedPlan.inputs.duration).toBe(7);
    expect(proposal.proposedPlan.inputs.budget).toBe(17000);
    expect(proposal.proposedPlan.itinerary.days.length).toBe(7);
    expect(proposal.userReason).toBe(userReason);
    expect(proposal.triggerReasons.some(r => r.includes(userReason))).toBe(true);
    expect(proposal.triggerReasons.some(r => r.includes('Trip lengthened by 2 day(s)'))).toBe(true);
    expect(proposal.triggerReasons.some(r => r.includes('Budget decreased by ₹3,000'))).toBe(true);
  });

  it('Prevents invalid values and boundary cases (zero/negative duration or budget)', () => {
    // 1. Resulting duration <= 0 (e.g. 5d - 5d = 0d)
    const invalidDurationZero = calculateTripDeltas(baseTrip.inputs, { durationDelta: -5 });
    expect(invalidDurationZero.isValid).toBe(false);
    expect(invalidDurationZero.errors.duration).toBeDefined();

    // 2. Resulting duration negative (e.g. 5d - 6d = -1d)
    const invalidDurationNeg = calculateTripDeltas(baseTrip.inputs, { durationDelta: -6 });
    expect(invalidDurationNeg.isValid).toBe(false);
    expect(invalidDurationNeg.errors.duration).toBeDefined();

    // 3. Resulting budget <= 0 (e.g. ₹20,000 - ₹20,000 = ₹0)
    const invalidBudgetZero = calculateTripDeltas(baseTrip.inputs, { budgetDelta: -20000 });
    expect(invalidBudgetZero.isValid).toBe(false);
    expect(invalidBudgetZero.errors.budget).toBeDefined();

    // 4. Resulting budget negative
    const invalidBudgetNeg = calculateTripDeltas(baseTrip.inputs, { budgetDelta: -25000 });
    expect(invalidBudgetNeg.isValid).toBe(false);
    expect(invalidBudgetNeg.errors.budget).toBeDefined();

    // 5. No changes at all (0 and 0)
    const noChange = calculateTripDeltas(baseTrip.inputs, { durationDelta: 0, budgetDelta: 0 });
    expect(noChange.isValid).toBe(false);
    expect(noChange.errors.general).toBeDefined();

    // generateRecoveryProposalFromDeltas throws on invalid inputs
    expect(() => generateRecoveryProposalFromDeltas(baseTrip, { durationDelta: -5 })).toThrow();
  });

  it('State Invariant: Generating proposal does not mutate the active itinerary', () => {
    const initialDuration = baseTrip.inputs.duration;
    const initialBudget = baseTrip.inputs.budget;
    const initialDaysCount = baseTrip.itinerary.days.length;

    const proposal = generateRecoveryProposalFromDeltas(baseTrip, { durationDelta: 2, budgetDelta: -4000 });

    expect(baseTrip.inputs.duration).toBe(initialDuration);
    expect(baseTrip.inputs.budget).toBe(initialBudget);
    expect(baseTrip.itinerary.days.length).toBe(initialDaysCount);
    expect(proposal.status).toBe('pending');
  });

  it('Approval and rejection behavior preserves or updates active trip correctly', () => {
    const proposal = generateRecoveryProposalFromDeltas(baseTrip, { durationDelta: 2, budgetDelta: -3000 });

    // Reject preserves active trip
    const rejectRes = rejectProposal(baseTrip, proposal);
    expect(rejectRes.preservedTrip.inputs.duration).toBe(5);
    expect(rejectRes.auditLogEntry.action).toBe('REJECTED');

    // Approve updates active trip
    const approveRes = applyProposal(baseTrip, proposal);
    expect(approveRes.updatedTrip.inputs.duration).toBe(7);
    expect(approveRes.updatedTrip.inputs.budget).toBe(17000);
    expect(approveRes.updatedTrip.itinerary.days.length).toBe(7);
    expect(approveRes.auditLogEntry.action).toBe('APPROVED');
  });

  it('Stale detection prevents outdated proposals from being applied', () => {
    const proposal = generateRecoveryProposalFromDeltas(baseTrip, { durationDelta: 2, budgetDelta: -3000 });
    expect(isProposalStale(proposal, proposal.proposedPlan.inputs, baseTrip)).toBe(false);

    // If active trip changed its duration
    const modifiedActiveTrip = {
      ...baseTrip,
      inputs: { ...baseTrip.inputs, duration: 8 }
    };
    expect(isProposalStale(proposal, proposal.proposedPlan.inputs, modifiedActiveTrip)).toBe(true);
  });

  it('Persistence and trip isolation: multiple trips remain isolated', () => {
    localStorage.clear();

    const tripA = { id: 'trip_isolation_A', name: 'Trip A', inputs: { budget: 20000, duration: 5 } };
    const tripB = { id: 'trip_isolation_B', name: 'Trip B', inputs: { budget: 30000, duration: 4 } };

    StorageService.saveTrip(tripA);
    StorageService.saveTrip(tripB);

    // Update trip A with proposal
    const updatedTripA = { ...tripA, inputs: { budget: 16000, duration: 5 } };
    StorageService.saveTrip(updatedTripA);

    // Verify trip B remains completely unaffected
    const retrievedB = StorageService.getTripById('trip_isolation_B');
    expect(retrievedB.inputs.budget).toBe(30000);
    expect(retrievedB.inputs.duration).toBe(4);

    // Verify trip A updated correctly
    const retrievedA = StorageService.getTripById('trip_isolation_A');
    expect(retrievedA.inputs.budget).toBe(16000);
  });
});


