import { describe, it, expect } from 'vitest';
import {
  inspect_active_trip,
  search_travel_options,
  calculate_trip_budget,
  draft_recovery_proposal,
  executeAgentTool,
  AGENT_TOOL_NAMES,
  AGENT_TOOL_DEFINITIONS
} from '../services/agentTools.js';
import { generateItinerary } from '../services/itineraryEngine.js';
import { calculateBudgetBreakdown } from '../services/budgetEngine.js';
import { getDestinationData } from '../data/destinationsData.js';
import { applyProposal, rejectProposal } from '../services/recoveryEngine.js';

describe('Shared Agent Tools Suite', () => {
  const manaliData = getDestinationData('Manali');
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

  const initialTransport = manaliData.transportOptions[0]; // 'bus-volvo'
  const initialAccommodation = manaliData.accommodations[1]; // 'acc-standard'
  const initialItinerary = generateItinerary(baseInputs);
  const initialBudget = calculateBudgetBreakdown({
    budget: baseInputs.budget,
    travellers: baseInputs.travellers,
    duration: baseInputs.duration,
    selectedTransport: initialTransport,
    selectedAccommodation: initialAccommodation,
    plannedActivities: initialItinerary.allPlannedActivities
  });

  const sampleActiveTrip = {
    id: 'active_trip_agent_test',
    name: 'Delhi to Manali (5d)',
    inputs: { ...baseInputs },
    selectedTransport: { ...initialTransport },
    selectedAccommodation: { ...initialAccommodation },
    itinerary: initialItinerary,
    budgetBreakdown: initialBudget,
    simulatedDisruption: null
  };

  // 1. Tool Definitions Export
  it('exposes valid declarative definitions for all 5 tools', () => {
    expect(AGENT_TOOL_NAMES).toHaveLength(5);
    expect(AGENT_TOOL_DEFINITIONS).toHaveLength(5);
    expect(AGENT_TOOL_NAMES).toContain('verify_proposal');
    AGENT_TOOL_NAMES.forEach(name => {
      const def = AGENT_TOOL_DEFINITIONS.find(d => d.name === name);
      expect(def).toBeDefined();
      expect(def.parameters).toBeDefined();
      expect(def.parameters.type).toBe('object');
    });
  });

  // 2. Tool 1: inspect_active_trip
  describe('Tool 1: inspect_active_trip', () => {
    it('successfully extracts trip parameters and constraints from active trip', () => {
      const result = inspect_active_trip({ activeTrip: sampleActiveTrip });
      expect(result.tripId).toBe('active_trip_agent_test');
      expect(result.origin).toBe('Delhi');
      expect(result.destination).toBe('Manali');
      expect(result.duration).toBe(5);
      expect(result.travellers).toBe(2);
      expect(result.declaredBudget).toBe(20000);
      expect(result.currentTransport.name).toBe(initialTransport.name);
      expect(result.currentAccommodation.name).toBe(initialAccommodation.name);
      expect(result.isOverBudget).toBe(initialBudget.isOverBudget);
      expect(result.itinerarySummary.totalDays).toBe(5);
    });

    it('rejects missing or invalid active trip baseline', () => {
      expect(() => inspect_active_trip({})).toThrow(/requires a valid active trip/);
      expect(() => inspect_active_trip({ activeTrip: null })).toThrow(/requires a valid active trip/);
      expect(() => inspect_active_trip({ activeTrip: { id: 'x' } })).toThrow(/requires a valid active trip/);
    });
  });

  // 3. Tool 2: search_travel_options
  describe('Tool 2: search_travel_options', () => {
    it('successfully retrieves verified catalog options for a curated destination', () => {
      const result = search_travel_options({ destination: 'Manali', category: 'all' });
      expect(result.destination).toBe('Manali');
      expect(result.isCurated).toBe(true);
      expect(result.accommodations.length).toBeGreaterThan(0);
      expect(result.transportOptions.length).toBeGreaterThan(0);
      expect(result.attractions.length).toBeGreaterThan(0);
      expect(result.restaurants.length).toBeGreaterThan(0);
    });

    it('filters by category correctly', () => {
      const accOnly = search_travel_options({ destination: 'Manali', category: 'accommodations' });
      expect(accOnly.accommodations).toBeDefined();
      expect(accOnly.transportOptions).toBeUndefined();

      const transOnly = search_travel_options({ destination: 'Manali', category: 'transport' });
      expect(transOnly.transportOptions).toBeDefined();
      expect(transOnly.accommodations).toBeUndefined();
    });

    it('filters indoor-only attractions when indoorOnly is true', () => {
      const indoorResult = search_travel_options({ destination: 'Manali', category: 'attractions', indoorOnly: true });
      expect(indoorResult.attractions.length).toBeGreaterThan(0);
      indoorResult.attractions.forEach(act => {
        expect(act.isOutdoor).toBe(false);
      });
    });

    it('handles arbitrary destinations gracefully with heuristic estimates', () => {
      const result = search_travel_options({ destination: 'Shillong' });
      expect(result.destination).toBe('Shillong');
      expect(result.isCurated).toBe(false);
      expect(result.dataSourceNotice).toContain('Arbitrary destination');
      expect(result.accommodations.length).toBeGreaterThan(0);
    });

    it('rejects invalid or missing destination arguments', () => {
      expect(() => search_travel_options({ destination: '' })).toThrow(/valid non-empty destination/);
      expect(() => search_travel_options({ destination: null })).toThrow(/valid non-empty destination/);
      expect(() => search_travel_options({ destination: 'Manali', category: 'invalid-cat' })).toThrow(/Invalid category/);
    });
  });

  // 4. Tool 3: calculate_trip_budget
  describe('Tool 3: calculate_trip_budget', () => {
    it('calculates deterministic costs using verified catalog rates', () => {
      const result = calculate_trip_budget({
        destination: 'Manali',
        budget: 20000,
        duration: 5,
        travellers: 2,
        selectedTransportId: 'bus-volvo',
        selectedAccommodationId: 'acc-standard'
      });

      expect(result.verifiedBy).toContain('TripOS Deterministic Budget Engine');
      expect(result.selectedTransport.name).toBe('Overnight Volvo AC Semi-Sleeper Bus');
      expect(result.selectedAccommodation.name).toBe('Snow Valley Himalayan Hotel');

      // Strict math sum guarantee
      const sum =
        result.categories.transport.amount +
        result.categories.accommodation.amount +
        result.categories.food.amount +
        result.categories.activities.amount +
        result.categories.other.amount;

      expect(result.totalEstimatedExpenses).toBe(sum);
      expect(result.remainingBudget).toBe(20000 - sum);
      expect(result.perPersonCost).toBe(Math.round(sum / 2));
    });

    it('honestly reports deficits for over-budget candidates without false claims', () => {
      // Extremely low budget of ₹5,000 for 5 days luxury
      const result = calculate_trip_budget({
        destination: 'Manali',
        budget: 5000,
        duration: 5,
        travellers: 2,
        selectedTransportId: 'flight-bhuntar',
        selectedAccommodationId: 'acc-luxury'
      });

      expect(result.isOverBudget).toBe(true);
      expect(result.deficit).toBeGreaterThan(0);
      expect(result.deficit).toBe(result.totalEstimatedExpenses - 5000);
      expect(result.surplus).toBe(0);
    });

    it('rejects invalid transport, accommodation, or activity IDs', () => {
      // Invalid transport ID
      expect(() => calculate_trip_budget({
        destination: 'Manali',
        budget: 20000,
        duration: 5,
        travellers: 2,
        selectedTransportId: 'fake-helicopter-id',
        selectedAccommodationId: 'acc-standard'
      })).toThrow(/invalid transport ID/);

      // Invalid accommodation ID
      expect(() => calculate_trip_budget({
        destination: 'Manali',
        budget: 20000,
        duration: 5,
        travellers: 2,
        selectedTransportId: 'bus-volvo',
        selectedAccommodationId: 'fake-penthouse-id'
      })).toThrow(/invalid accommodation ID/);

      // Invalid activity ID
      expect(() => calculate_trip_budget({
        destination: 'Manali',
        budget: 20000,
        duration: 5,
        travellers: 2,
        selectedTransportId: 'bus-volvo',
        selectedAccommodationId: 'acc-standard',
        activityIds: ['invalid-act-999']
      })).toThrow(/invalid activity ID/);
    });

    it('rejects invalid inputs: zero/negative duration, travellers, or budget', () => {
      expect(() => calculate_trip_budget({
        destination: 'Manali',
        budget: -500,
        duration: 5,
        travellers: 2,
        selectedTransportId: 'bus-volvo',
        selectedAccommodationId: 'acc-standard'
      })).toThrow(/budget must be a positive number/);

      expect(() => calculate_trip_budget({
        destination: 'Manali',
        budget: 20000,
        duration: 0,
        travellers: 2,
        selectedTransportId: 'bus-volvo',
        selectedAccommodationId: 'acc-standard'
      })).toThrow(/duration must be an integer >= 1/);

      expect(() => calculate_trip_budget({
        destination: 'Manali',
        budget: 20000,
        duration: 5,
        travellers: -1,
        selectedTransportId: 'bus-volvo',
        selectedAccommodationId: 'acc-standard'
      })).toThrow(/travellers must be an integer >= 1/);
    });
  });

  // 5. Tool 4: draft_recovery_proposal & Workflow Integration
  describe('Tool 4: draft_recovery_proposal', () => {
    it('drafts a complete pending proposal without mutating the active trip', () => {
      const originalDuration = sampleActiveTrip.inputs.duration;
      const originalBudget = sampleActiveTrip.inputs.budget;
      const originalDaysCount = sampleActiveTrip.itinerary.days.length;

      const proposal = draft_recovery_proposal({
        activeTrip: sampleActiveTrip,
        newDuration: 7,
        newBudget: 18000,
        selectedTransportId: 'bus-volvo',
        selectedAccommodationId: 'acc-hostel',
        actionsTaken: ['Switched accommodation to Hostel', 'Extended duration by 2 days'],
        agentExplanation: 'Extended your stay while switching to hostel lodging to stay within ₹18,000.',
        userReason: 'Traveller requested stay extension'
      });

      // Invariant 1: activeTrip must NOT be mutated
      expect(sampleActiveTrip.inputs.duration).toBe(originalDuration);
      expect(sampleActiveTrip.inputs.budget).toBe(originalBudget);
      expect(sampleActiveTrip.itinerary.days.length).toBe(originalDaysCount);

      // Proposal checks
      expect(proposal.status).toBe('pending');
      expect(proposal.source).toBe('agent');
      expect(proposal.proposedPlan.inputs.duration).toBe(7);
      expect(proposal.proposedPlan.inputs.budget).toBe(18000);
      expect(proposal.proposedPlan.itinerary.days.length).toBe(7);
      expect(proposal.userReason).toBe('Traveller requested stay extension');
      expect(proposal.triggerReasons.some(r => r.includes('Trip lengthened by 2 day(s)'))).toBe(true);
      expect(proposal.triggerReasons.some(r => r.includes('Budget decreased by ₹2,000'))).toBe(true);
    });

    it('rejects invalid arguments (duration <= 0, budget <= 0, empty actionsTaken, empty explanation)', () => {
      expect(() => draft_recovery_proposal({
        activeTrip: sampleActiveTrip,
        newDuration: 0,
        newBudget: 20000,
        actionsTaken: ['Action'],
        agentExplanation: 'Explanation'
      })).toThrow(/newDuration must be an integer >= 1/);

      expect(() => draft_recovery_proposal({
        activeTrip: sampleActiveTrip,
        newDuration: 5,
        newBudget: -100,
        actionsTaken: ['Action'],
        agentExplanation: 'Explanation'
      })).toThrow(/newBudget must be a number > 0/);

      expect(() => draft_recovery_proposal({
        activeTrip: sampleActiveTrip,
        newDuration: 5,
        newBudget: 20000,
        actionsTaken: [],
        agentExplanation: 'Explanation'
      })).toThrow(/actionsTaken must be a non-empty array/);

      expect(() => draft_recovery_proposal({
        activeTrip: sampleActiveTrip,
        newDuration: 5,
        newBudget: 20000,
        actionsTaken: ['Action'],
        agentExplanation: ''
      })).toThrow(/agentExplanation must be a non-empty string/);
    });

    it('works seamlessly with existing applyProposal and rejectProposal workflows', () => {
      const proposal = draft_recovery_proposal({
        activeTrip: sampleActiveTrip,
        newDuration: 3,
        newBudget: 15000,
        selectedTransportId: 'bus-volvo',
        selectedAccommodationId: 'acc-hostel',
        actionsTaken: ['Reduced duration to 3 days', 'Switched accommodation to Hostel'],
        agentExplanation: 'Optimized for tight budget by reducing trip duration.'
      });

      // 1. Reject preserves active trip
      const rejectResult = rejectProposal(sampleActiveTrip, proposal);
      expect(rejectResult.resolvedProposal.status).toBe('rejected');
      expect(rejectResult.preservedTrip.inputs.duration).toBe(5);
      expect(rejectResult.preservedTrip.inputs.budget).toBe(20000);
      expect(rejectResult.auditLogEntry.action).toBe('REJECTED');

      // 2. Approve updates active trip
      const approveResult = applyProposal(sampleActiveTrip, proposal);
      expect(approveResult.resolvedProposal.status).toBe('approved');
      expect(approveResult.updatedTrip.inputs.duration).toBe(3);
      expect(approveResult.updatedTrip.inputs.budget).toBe(15000);
      expect(approveResult.updatedTrip.itinerary.days.length).toBe(3);
      expect(approveResult.auditLogEntry.action).toBe('APPROVED');
    });
  });

  // 6. Universal Tool Dispatcher
  describe('executeAgentTool dispatcher', () => {
    it('routes calls dynamically to target tool by name', () => {
      const inspected = executeAgentTool('inspect_active_trip', {}, { activeTrip: sampleActiveTrip });
      expect(inspected.origin).toBe('Delhi');

      const searched = executeAgentTool('search_travel_options', { destination: 'Manali', category: 'transport' });
      expect(searched.transportOptions.length).toBeGreaterThan(0);

      const budgeted = executeAgentTool('calculate_trip_budget', {
        destination: 'Manali',
        budget: 20000,
        duration: 5,
        travellers: 2,
        selectedTransportId: 'bus-volvo',
        selectedAccommodationId: 'acc-standard'
      });
      expect(budgeted.totalEstimatedExpenses).toBeGreaterThan(0);
    });

    it('throws on unknown tool name', () => {
      expect(() => executeAgentTool('hallucinated_tool_name')).toThrow(/Unknown agent tool/);
    });
  });
});

