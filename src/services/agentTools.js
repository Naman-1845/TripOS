/**
 * Shared Agent Tools for TripOS
 * Exposes strictly typed, deterministic tools for the Travel Recovery Agent.
 *
 * Guarantees:
 * 1. Strict input validation (no zero/negative duration/budget/travellers).
 * 2. Deterministic price calculations via budgetEngine (LLM cannot invent prices).
 * 3. Catalog ID verification against destinationsData.
 * 4. Non-mutation of active trip during proposal drafting.
 * 5. Full compatibility with existing applyProposal and rejectProposal workflows.
 */

import { getDestinationData } from '../data/destinationsData.js';
import { calculateBudgetBreakdown } from './budgetEngine.js';
import { generateItinerary } from './itineraryEngine.js';

export const AGENT_TOOL_NAMES = [
  'inspect_active_trip',
  'search_travel_options',
  'calculate_trip_budget',
  'draft_recovery_proposal'
];

/**
 * Declarative Tool Definitions for LLM Function Calling (OpenAI / Gemini compatible schema)
 */
export const AGENT_TOOL_DEFINITIONS = [
  {
    name: 'inspect_active_trip',
    description: 'Inspects the current active trip, itinerary constraints, current accommodation/transport, expenses, and any active disruptions.',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'search_travel_options',
    description: 'Queries verified options (hotels, transport, attractions, dining) from the destination catalog, with optional indoor-only or category filters.',
    parameters: {
      type: 'object',
      properties: {
        destination: { type: 'string', description: 'Destination city name' },
        category: {
          type: 'string',
          enum: ['all', 'accommodations', 'transport', 'attractions', 'restaurants'],
          description: 'Filter by category. Defaults to all.'
        },
        indoorOnly: {
          type: 'boolean',
          description: 'When true, returns only sheltered/indoor attractions suitable during bad weather.'
        }
      },
      required: ['destination']
    }
  },
  {
    name: 'calculate_trip_budget',
    description: 'Executes pure deterministic budget calculations using verified catalog rates. The LLM must NEVER invent prices.',
    parameters: {
      type: 'object',
      properties: {
        destination: { type: 'string', description: 'Destination city name' },
        budget: { type: 'number', description: 'Target user budget in ₹ (must be > 0)' },
        duration: { type: 'number', description: 'Trip duration in days (must be >= 1)' },
        travellers: { type: 'number', description: 'Number of travellers (must be >= 1)' },
        selectedTransportId: { type: 'string', description: 'Verified transport ID from catalog' },
        selectedAccommodationId: { type: 'string', description: 'Verified accommodation ID from catalog' },
        activityIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional list of verified activity IDs to include in cost calculation'
        }
      },
      required: ['destination', 'budget', 'duration', 'travellers', 'selectedTransportId', 'selectedAccommodationId']
    }
  },
  {
    name: 'draft_recovery_proposal',
    description: 'Drafts an immutable recovery proposal comparing active trip to proposed modifications without mutating the active itinerary.',
    parameters: {
      type: 'object',
      properties: {
        newDuration: { type: 'number', description: 'Revised duration in days (must be >= 1)' },
        newBudget: { type: 'number', description: 'Revised budget in ₹ (must be > 0)' },
        selectedTransportId: { type: 'string', description: 'Verified transport ID from catalog' },
        selectedAccommodationId: { type: 'string', description: 'Verified accommodation ID from catalog' },
        actionsTaken: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of specific recovery actions taken'
        },
        agentExplanation: { type: 'string', description: 'Transparent explanation of why this plan was chosen' },
        userReason: { type: 'string', description: 'Optional reported user reason' },
        simulatedDisruption: {
          type: 'object',
          properties: {
            outdoorUnsuitable: { type: 'boolean' },
            reason: { type: 'string' }
          }
        }
      },
      required: ['newDuration', 'newBudget', 'actionsTaken', 'agentExplanation']
    }
  }
];

/**
 * Tool 1: inspect_active_trip
 * Reads the active trip and returns structured constraints without exposing private internals.
 */
export function inspect_active_trip({ activeTrip }) {
  if (!activeTrip || !activeTrip.inputs) {
    throw new Error('inspect_active_trip requires a valid active trip as baseline.');
  }

  const { inputs, selectedTransport, selectedAccommodation, budgetBreakdown, itinerary, simulatedDisruption } = activeTrip;

  return {
    tripId: activeTrip.id,
    origin: inputs.origin,
    destination: inputs.destination,
    startDate: inputs.startDate,
    duration: inputs.duration,
    travellers: inputs.travellers,
    declaredBudget: inputs.budget,
    interests: inputs.interests || [],
    currentTransport: {
      id: selectedTransport?.id || null,
      name: selectedTransport?.name || 'Standard Transport',
      type: selectedTransport?.type || inputs.transportPreference,
      costPerPerson: selectedTransport?.costPerPerson || null,
      flatCost: selectedTransport?.flatCost || null
    },
    currentAccommodation: {
      id: selectedAccommodation?.id || null,
      name: selectedAccommodation?.name || 'Standard Hotel',
      type: selectedAccommodation?.type || inputs.accommodationPreference,
      costPerNight: selectedAccommodation?.costPerNight || null
    },
    currentExpenses: budgetBreakdown?.totalEstimatedExpenses || 0,
    remainingBudget: budgetBreakdown?.remainingBudget || 0,
    isOverBudget: Boolean(budgetBreakdown?.isOverBudget),
    deficit: budgetBreakdown?.deficit || 0,
    simulatedDisruption: simulatedDisruption || null,
    itinerarySummary: {
      totalDays: itinerary?.days?.length || inputs.duration,
      plannedActivitiesCount: itinerary?.allPlannedActivities?.length || 0
    }
  };
}

/**
 * Tool 2: search_travel_options
 * Queries verified accommodations, transport, attractions, and dining from the destination catalog.
 */
export function search_travel_options({ destination, category = 'all', indoorOnly = false }) {
  if (!destination || typeof destination !== 'string' || !destination.trim()) {
    throw new Error('search_travel_options requires a valid non-empty destination string.');
  }

  const destData = getDestinationData(destination.trim());
  if (!destData) {
    throw new Error(`Unable to resolve destination catalog data for "${destination}".`);
  }

  const validCategories = ['all', 'accommodations', 'transport', 'attractions', 'restaurants'];
  if (!validCategories.includes(category)) {
    throw new Error(`Invalid category "${category}". Must be one of: ${validCategories.join(', ')}.`);
  }

  let attractions = destData.attractions || [];
  if (indoorOnly) {
    attractions = attractions.filter(a => !a.isOutdoor);
  }

  const result = {
    destination: destData.name,
    isCurated: destData.isCurated,
    dataSourceNotice: destData.dataSourceNotice,
    isSampleEstimate: true
  };

  if (category === 'all' || category === 'accommodations') {
    result.accommodations = (destData.accommodations || []).map(a => ({
      id: a.id,
      name: a.name,
      type: a.type,
      costPerNight: a.costPerNight,
      rating: a.rating,
      amenities: a.amenities
    }));
  }

  if (category === 'all' || category === 'transport') {
    result.transportOptions = (destData.transportOptions || []).map(t => ({
      id: t.id,
      name: t.name,
      type: t.type,
      costPerPerson: t.costPerPerson || null,
      flatCost: t.flatCost || null,
      duration: t.duration,
      description: t.description
    }));
  }

  if (category === 'all' || category === 'attractions') {
    result.attractions = attractions.map(a => ({
      id: a.id,
      name: a.name,
      category: a.category,
      isOutdoor: a.isOutdoor,
      costPerPerson: a.costPerPerson,
      duration: a.duration,
      description: a.description
    }));
  }

  if (category === 'all' || category === 'restaurants') {
    result.restaurants = destData.restaurants || [];
  }

  return result;
}

/**
 * Tool 3: calculate_trip_budget
 * Uses deterministic budget engine. Verifies catalog IDs and uses strictly verified prices.
 */
export function calculate_trip_budget({
  destination,
  budget,
  duration,
  travellers,
  selectedTransportId,
  selectedAccommodationId,
  activityIds = []
}) {
  // 1. Strict Input Validation
  if (!destination || typeof destination !== 'string' || !destination.trim()) {
    throw new Error('calculate_trip_budget: destination must be a non-empty string.');
  }

  const safeBudget = parseInt(budget, 10);
  if (isNaN(safeBudget) || safeBudget <= 0) {
    throw new Error(`calculate_trip_budget: budget must be a positive number greater than 0. Received: ${budget}`);
  }

  const safeDuration = parseInt(duration, 10);
  if (isNaN(safeDuration) || safeDuration < 1) {
    throw new Error(`calculate_trip_budget: duration must be an integer >= 1. Received: ${duration}`);
  }

  const safeTravellers = parseInt(travellers, 10);
  if (isNaN(safeTravellers) || safeTravellers < 1) {
    throw new Error(`calculate_trip_budget: travellers must be an integer >= 1. Received: ${travellers}`);
  }

  // 2. Catalog Lookup & ID Verification
  const destData = getDestinationData(destination.trim());
  if (!destData) {
    throw new Error(`calculate_trip_budget: destination "${destination}" could not be resolved.`);
  }

  const transport = destData.transportOptions?.find(t => t.id === selectedTransportId);
  if (!transport) {
    const validTransportIds = (destData.transportOptions || []).map(t => t.id).join(', ');
    throw new Error(`calculate_trip_budget: invalid transport ID "${selectedTransportId}". Available: [${validTransportIds}]`);
  }

  const accommodation = destData.accommodations?.find(a => a.id === selectedAccommodationId);
  if (!accommodation) {
    const validAccIds = (destData.accommodations || []).map(a => a.id).join(', ');
    throw new Error(`calculate_trip_budget: invalid accommodation ID "${selectedAccommodationId}". Available: [${validAccIds}]`);
  }

  // 3. Resolve Activities if provided
  let plannedActivities = [];
  if (Array.isArray(activityIds) && activityIds.length > 0) {
    const availableActs = destData.attractions || [];
    for (const actId of activityIds) {
      const found = availableActs.find(a => a.id === actId);
      if (!found) {
        throw new Error(`calculate_trip_budget: invalid activity ID "${actId}".`);
      }
      plannedActivities.push(found);
    }
  }

  // 4. Calculate via deterministic budget engine
  const breakdown = calculateBudgetBreakdown({
    budget: safeBudget,
    travellers: safeTravellers,
    duration: safeDuration,
    selectedTransport: transport,
    selectedAccommodation: accommodation,
    plannedActivities
  });

  return {
    verifiedBy: 'TripOS Deterministic Budget Engine',
    destination: destData.name,
    userBudget: breakdown.userBudget,
    duration: breakdown.duration,
    travellers: breakdown.travellers,
    nights: breakdown.nights,
    roomsNeeded: breakdown.roomsNeeded,
    selectedTransport: {
      id: transport.id,
      name: transport.name,
      type: transport.type,
      costAmount: breakdown.categories.transport.amount
    },
    selectedAccommodation: {
      id: accommodation.id,
      name: accommodation.name,
      type: accommodation.type,
      costAmount: breakdown.categories.accommodation.amount
    },
    categories: breakdown.categories,
    totalEstimatedExpenses: breakdown.totalEstimatedExpenses,
    remainingBudget: breakdown.remainingBudget,
    perPersonCost: breakdown.perPersonCost,
    isOverBudget: breakdown.isOverBudget,
    deficit: breakdown.deficit,
    surplus: breakdown.surplus,
    budgetUtilizationPercent: breakdown.budgetUtilizationPercent
  };
}

/**
 * Tool 4: draft_recovery_proposal
 * Packages a verified candidate plan into an immutable proposal for user evaluation.
 * Invariant: Does NOT mutate activeTrip.
 */
export function draft_recovery_proposal({
  activeTrip,
  newDuration,
  newBudget,
  selectedTransportId,
  selectedAccommodationId,
  actionsTaken = [],
  agentExplanation,
  userReason,
  simulatedDisruption
}) {
  if (!activeTrip || !activeTrip.inputs) {
    throw new Error('draft_recovery_proposal: requires a valid active trip baseline.');
  }

  const safeDuration = parseInt(newDuration, 10);
  if (isNaN(safeDuration) || safeDuration < 1) {
    throw new Error(`draft_recovery_proposal: newDuration must be an integer >= 1. Received: ${newDuration}`);
  }

  const safeBudget = parseInt(newBudget, 10);
  if (isNaN(safeBudget) || safeBudget <= 0) {
    throw new Error(`draft_recovery_proposal: newBudget must be a number > 0. Received: ${newBudget}`);
  }

  if (!Array.isArray(actionsTaken) || actionsTaken.length === 0) {
    throw new Error('draft_recovery_proposal: actionsTaken must be a non-empty array of strings.');
  }

  if (!agentExplanation || typeof agentExplanation !== 'string' || !agentExplanation.trim()) {
    throw new Error('draft_recovery_proposal: agentExplanation must be a non-empty string.');
  }

  const destData = getDestinationData(activeTrip.inputs.destination);

  // Resolve verified transport
  const chosenTransport = selectedTransportId
    ? destData?.transportOptions?.find(t => t.id === selectedTransportId)
    : activeTrip.selectedTransport || destData?.transportOptions?.[0];

  if (!chosenTransport) {
    throw new Error(`draft_recovery_proposal: could not resolve transport with ID "${selectedTransportId}".`);
  }

  // Resolve verified accommodation
  const chosenAccommodation = selectedAccommodationId
    ? destData?.accommodations?.find(a => a.id === selectedAccommodationId)
    : activeTrip.selectedAccommodation || destData?.accommodations?.[0];

  if (!chosenAccommodation) {
    throw new Error(`draft_recovery_proposal: could not resolve accommodation with ID "${selectedAccommodationId}".`);
  }

  const finalDisruption = simulatedDisruption !== undefined
    ? simulatedDisruption
    : (activeTrip.simulatedDisruption || null);

  // Generate verified proposed itinerary
  const proposedItinerary = generateItinerary({
    origin: activeTrip.inputs.origin,
    destination: activeTrip.inputs.destination,
    startDate: activeTrip.inputs.startDate,
    duration: safeDuration,
    interests: activeTrip.inputs.interests,
    simulatedDisruption: finalDisruption
  });

  // Calculate verified proposed budget
  const proposedBudgetBreakdown = calculateBudgetBreakdown({
    budget: safeBudget,
    travellers: activeTrip.inputs.travellers,
    duration: safeDuration,
    selectedTransport: chosenTransport,
    selectedAccommodation: chosenAccommodation,
    plannedActivities: proposedItinerary.allPlannedActivities
  });

  const costDifference = proposedBudgetBreakdown.totalEstimatedExpenses - activeTrip.budgetBreakdown.totalEstimatedExpenses;

  // Construct trigger reasons
  const triggerReasons = [];
  if (userReason && String(userReason).trim()) {
    triggerReasons.push(`Reported change reason: "${String(userReason).trim()}"`);
  }

  const durationDelta = safeDuration - activeTrip.inputs.duration;
  if (durationDelta < 0) {
    triggerReasons.push(`Trip shortened by ${Math.abs(durationDelta)} day(s) (from ${activeTrip.inputs.duration}d to ${safeDuration}d)`);
  } else if (durationDelta > 0) {
    triggerReasons.push(`Trip lengthened by ${durationDelta} day(s) (from ${activeTrip.inputs.duration}d to ${safeDuration}d)`);
  }

  const budgetDelta = safeBudget - activeTrip.inputs.budget;
  if (budgetDelta < 0) {
    triggerReasons.push(`Budget decreased by ₹${Math.abs(budgetDelta).toLocaleString('en-IN')} (from ₹${activeTrip.inputs.budget.toLocaleString('en-IN')} to ₹${safeBudget.toLocaleString('en-IN')})`);
  } else if (budgetDelta > 0) {
    triggerReasons.push(`Budget increased by ₹${budgetDelta.toLocaleString('en-IN')} (from ₹${activeTrip.inputs.budget.toLocaleString('en-IN')} to ₹${safeBudget.toLocaleString('en-IN')})`);
  }

  if (finalDisruption?.outdoorUnsuitable && !activeTrip.simulatedDisruption?.outdoorUnsuitable) {
    triggerReasons.push(`Adverse condition detected: "${finalDisruption.reason || 'Outdoor activities unsuitable'}"`);
  }

  if (triggerReasons.length === 0) {
    triggerReasons.push('Agent recovery optimization requested');
  }

  return {
    proposalId: `prop_agent_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    createdAt: new Date().toISOString(),
    status: 'pending', // Invariant: must be pending until explicit user action
    source: 'agent',
    agentExplanation: agentExplanation.trim(),
    userReason: userReason ? String(userReason).trim() : null,
    triggerReasons,
    actionsTaken,
    costImpact: {
      oldTotal: activeTrip.budgetBreakdown.totalEstimatedExpenses,
      newTotal: proposedBudgetBreakdown.totalEstimatedExpenses,
      costDifference,
      oldRemaining: activeTrip.budgetBreakdown.remainingBudget,
      newRemaining: proposedBudgetBreakdown.remainingBudget,
      isOverBudgetNow: proposedBudgetBreakdown.isOverBudget,
      savings: costDifference < 0 ? Math.abs(costDifference) : 0
    },
    originalSnapshot: {
      tripId: activeTrip.id,
      inputs: { ...activeTrip.inputs },
      selectedTransport: { ...activeTrip.selectedTransport },
      selectedAccommodation: { ...activeTrip.selectedAccommodation },
      budgetBreakdown: { ...activeTrip.budgetBreakdown },
      itineraryDaysCount: activeTrip.itinerary?.days?.length || activeTrip.inputs.duration
    },
    proposedPlan: {
      inputs: {
        ...activeTrip.inputs,
        duration: safeDuration,
        budget: safeBudget,
        accommodationPreference: chosenAccommodation.type,
        transportPreference: chosenTransport.type
      },
      selectedTransport: chosenTransport,
      selectedAccommodation: chosenAccommodation,
      budgetBreakdown: proposedBudgetBreakdown,
      itinerary: proposedItinerary,
      simulatedDisruption: finalDisruption
    }
  };
}

/**
 * Universal Tool Dispatcher: executes tool by name with arguments and context
 */
export function executeAgentTool(toolName, args = {}, context = {}) {
  switch (toolName) {
    case 'inspect_active_trip':
      return inspect_active_trip({ activeTrip: context.activeTrip || args.activeTrip });
    case 'search_travel_options':
      return search_travel_options(args);
    case 'calculate_trip_budget':
      return calculate_trip_budget(args);
    case 'draft_recovery_proposal':
      return draft_recovery_proposal({ ...args, activeTrip: context.activeTrip || args.activeTrip });
    default:
      throw new Error(`Unknown agent tool: "${toolName}". Available tools: [${AGENT_TOOL_NAMES.join(', ')}]`);
  }
}

