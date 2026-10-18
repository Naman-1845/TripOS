/**
 * Travel Recovery Engine for TripOS
 * Autonomous re-planning, multi-variable diffing, conflict resolution,
 * and immutable proposal state management.
 */

import { getDestinationData } from '../data/destinationsData.js';
import { calculateBudgetBreakdown } from './budgetEngine.js';
import { generateItinerary } from './itineraryEngine.js';

/**
 * Generates an alternative recovery proposal comparing active trip to proposed modifications.
 * Does NOT mutate the active trip.
 *
 * @param {Object} activeTrip - The current immutable active trip
 * @param {Object} proposedChanges - The changed fields (budget, duration, interests, transport, accommodation, disruption)
 * @returns {Object} Complete proposal with triggers, actions taken, side-by-side diffs, and financial delta
 */
export function generateRecoveryProposal(activeTrip, proposedChanges = {}) {
  if (!activeTrip || !activeTrip.inputs) {
    throw new Error('Recovery Engine requires a valid active trip as baseline.');
  }

  const prev = activeTrip.inputs;
  const next = {
    origin: proposedChanges.origin !== undefined ? proposedChanges.origin : prev.origin,
    destination: proposedChanges.destination !== undefined ? proposedChanges.destination : prev.destination,
    startDate: proposedChanges.startDate !== undefined ? proposedChanges.startDate : prev.startDate,
    duration: proposedChanges.duration !== undefined ? Math.max(1, parseInt(proposedChanges.duration, 10)) : prev.duration,
    travellers: proposedChanges.travellers !== undefined ? Math.max(1, parseInt(proposedChanges.travellers, 10)) : prev.travellers,
    budget: proposedChanges.budget !== undefined ? Math.max(0, parseInt(proposedChanges.budget, 10)) : prev.budget,
    interests: proposedChanges.interests !== undefined ? [...proposedChanges.interests] : [...prev.interests],
    transportPreference: proposedChanges.transportPreference !== undefined ? proposedChanges.transportPreference : prev.transportPreference,
    accommodationPreference: proposedChanges.accommodationPreference !== undefined ? proposedChanges.accommodationPreference : prev.accommodationPreference,
    simulatedDisruption: proposedChanges.simulatedDisruption !== undefined ? proposedChanges.simulatedDisruption : (activeTrip.simulatedDisruption || null)
  };

  const destData = getDestinationData(next.destination);
  const triggerReasons = [];
  const actionsTaken = [];

  // Capture user-specified reason for the change if provided
  if (proposedChanges.userReason && String(proposedChanges.userReason).trim()) {
    triggerReasons.push(`Reported change reason: "${String(proposedChanges.userReason).trim()}"`);
  }

  // Detect Destination & Origin Delta
  if (next.destination !== prev.destination) {
    triggerReasons.push(`Destination changed from ${prev.destination} to ${next.destination}`);
    actionsTaken.push(`Selected verified travel and stay options catalog for ${next.destination}.`);
  }
  if (next.origin !== prev.origin) {
    triggerReasons.push(`Origin city changed from ${prev.origin} to ${next.origin}`);
  }

  // 1. Detect Budget Delta
  const budgetDelta = next.budget - prev.budget;
  if (budgetDelta < 0) {
    triggerReasons.push(`Budget decreased by ₹${Math.abs(budgetDelta).toLocaleString('en-IN')} (from ₹${prev.budget.toLocaleString('en-IN')} to ₹${next.budget.toLocaleString('en-IN')})`);
  } else if (budgetDelta > 0) {
    triggerReasons.push(`Budget increased by ₹${budgetDelta.toLocaleString('en-IN')} (from ₹${prev.budget.toLocaleString('en-IN')} to ₹${next.budget.toLocaleString('en-IN')})`);
  }

  // 2. Detect Duration Delta
  const durationDelta = next.duration - prev.duration;
  if (durationDelta < 0) {
    triggerReasons.push(`Trip shortened by ${Math.abs(durationDelta)} day(s) (from ${prev.duration}d to ${next.duration}d)`);
  } else if (durationDelta > 0) {
    triggerReasons.push(`Trip lengthened by ${durationDelta} day(s) (from ${prev.duration}d to ${next.duration}d)`);
  }

  // 3. Detect Travellers Delta
  if (next.travellers !== prev.travellers) {
    triggerReasons.push(`Traveller count changed from ${prev.travellers} to ${next.travellers} person(s)`);
  }

  // 4. Detect Accommodation Preference Delta
  if (next.accommodationPreference !== prev.accommodationPreference) {
    triggerReasons.push(`Accommodation preference changed from ${prev.accommodationPreference} to ${next.accommodationPreference}`);
  }

  // 5. Detect Transport Preference Delta
  if (next.transportPreference !== prev.transportPreference) {
    triggerReasons.push(`Transport preference changed from ${prev.transportPreference} to ${next.transportPreference}`);
  }

  // 6. Detect Interests Delta
  const addedInterests = next.interests.filter(i => !prev.interests.includes(i));
  const removedInterests = prev.interests.filter(i => !next.interests.includes(i));
  if (addedInterests.length > 0 || removedInterests.length > 0) {
    const diffText = [];
    if (addedInterests.length) diffText.push(`added [${addedInterests.join(', ')}]`);
    if (removedInterests.length) diffText.push(`removed [${removedInterests.join(', ')}]`);
    triggerReasons.push(`Travel interests updated: ${diffText.join(' and ')}`);
  }

  // 7. Detect Weather / Outdoor Disruption Delta
  const disruptionActive = Boolean(next.simulatedDisruption?.outdoorUnsuitable);
  const wasDisrupted = Boolean(activeTrip.simulatedDisruption?.outdoorUnsuitable);
  if (disruptionActive && !wasDisrupted) {
    triggerReasons.push(`Adverse condition detected: "${next.simulatedDisruption.reason || 'Outdoor activities unsuitable'}" (Early notification 6h advance notice before disruption onset)`);
  } else if (!disruptionActive && wasDisrupted) {
    triggerReasons.push(`Adverse condition cleared: Outdoor activities restored`);
  }

  // If no change was detected
  if (triggerReasons.length === 0) {
    triggerReasons.push('General optimization check requested');
  }

  // Smart Optimization Logic to fit budget constraints
  let finalAccPref = next.accommodationPreference;
  let finalTransPref = next.transportPreference;

  // Find corresponding transport and accommodation options
  const getTransportOption = (pref) => {
    return destData?.transportOptions?.find(t => t.type.toLowerCase() === pref.toLowerCase())
      || destData?.transportOptions?.[0];
  };

  const getAccommodationOption = (pref) => {
    return destData?.accommodations?.find(a => a.type.toLowerCase() === pref.toLowerCase())
      || destData?.accommodations?.[0];
  };

  let chosenTransport = getTransportOption(finalTransPref);
  let chosenAccommodation = getAccommodationOption(finalAccPref);

  // Generate initial test itinerary
  let tentativeItinerary = generateItinerary({
    origin: next.origin,
    destination: next.destination,
    startDate: next.startDate,
    duration: next.duration,
    interests: next.interests,
    simulatedDisruption: next.simulatedDisruption
  });

  // Calculate preliminary budget
  let tentativeBudget = calculateBudgetBreakdown({
    budget: next.budget,
    travellers: next.travellers,
    duration: next.duration,
    selectedTransport: chosenTransport,
    selectedAccommodation: chosenAccommodation,
    plannedActivities: tentativeItinerary.allPlannedActivities
  });

  // If over budget due to budget cut or cost hike, autonomous recovery kicks in
  if (tentativeBudget.isOverBudget) {
    // Strategy A: Downgrade accommodation tier first (e.g. Luxury -> Standard -> Hostel)
    if (finalAccPref === 'Luxury') {
      finalAccPref = 'Standard';
      chosenAccommodation = getAccommodationOption('Standard');
      actionsTaken.push(`Adjusted accommodation tier from Luxury to Standard to reduce room expenses.`);
    } else if (finalAccPref === 'Standard') {
      finalAccPref = 'Hostel';
      chosenAccommodation = getAccommodationOption('Hostel');
      actionsTaken.push(`Switched accommodation from Standard to Backpacker/Hostel to maximize savings.`);
    }

    // Recheck
    tentativeBudget = calculateBudgetBreakdown({
      budget: next.budget,
      travellers: next.travellers,
      duration: next.duration,
      selectedTransport: chosenTransport,
      selectedAccommodation: chosenAccommodation,
      plannedActivities: tentativeItinerary.allPlannedActivities
    });

    // Strategy B: If still over budget, downgrade transport tier (e.g. Cab/Flight -> Bus/Train)
    if (tentativeBudget.isOverBudget) {
      if (finalTransPref === 'Flight' || finalTransPref === 'Cab') {
        const fallbackMode = destData?.transportOptions?.find(t => t.type === 'Bus') ? 'Bus' : 'Train';
        finalTransPref = fallbackMode;
        chosenTransport = getTransportOption(fallbackMode);
        actionsTaken.push(`Switched transport from high-tariff mode to high-efficiency ${fallbackMode} travel.`);
      }
    }
  }

  // Handle Duration adjustments
  if (durationDelta < 0) {
    actionsTaken.push(`Streamlined itinerary from ${prev.duration} days to ${next.duration} days, keeping priority highlights.`);
  } else if (durationDelta > 0) {
    actionsTaken.push(`Expanded itinerary with ${durationDelta} additional curated exploration day(s).`);
  }

  // Handle Disruption replacements
  if (disruptionActive) {
    actionsTaken.push(`Substituted outdoor excursions with sheltered cultural monasteries, indoor art museums, and thermal springs (Pre-emptively notified 6 hours in advance).`);
  }

  if (actionsTaken.length === 0) {
    actionsTaken.push(`Recalculated daily expense breakdown and synchronized activity schedules.`);
  }

  // Final proposed plan generation
  const proposedItinerary = generateItinerary({
    origin: next.origin,
    destination: next.destination,
    startDate: next.startDate,
    duration: next.duration,
    interests: next.interests,
    simulatedDisruption: next.simulatedDisruption,
    hotel: chosenAccommodation
  });

  const proposedBudgetBreakdown = calculateBudgetBreakdown({
    budget: next.budget,
    travellers: next.travellers,
    duration: next.duration,
    selectedTransport: chosenTransport,
    selectedAccommodation: chosenAccommodation,
    plannedActivities: proposedItinerary.allPlannedActivities
  });

  const oldTotal = activeTrip.budgetBreakdown?.totalEstimatedExpenses || 0;
  const costDifference = proposedBudgetBreakdown.totalEstimatedExpenses - oldTotal;

  if (proposedBudgetBreakdown.isOverBudget) {
    actionsTaken.push(`Note: Total expenses of ₹${proposedBudgetBreakdown.totalEstimatedExpenses.toLocaleString('en-IN')} exceed the reduced budget of ₹${next.budget.toLocaleString('en-IN')} by ₹${proposedBudgetBreakdown.deficit.toLocaleString('en-IN')}. Consider shortening trip duration.`);
  }

  const agentExplanation = proposedBudgetBreakdown.isOverBudget
    ? `Recovery evaluated candidate adjustments for ${next.destination}. Total verified expenses are ₹${proposedBudgetBreakdown.totalEstimatedExpenses.toLocaleString('en-IN')}, exceeding the target ₹${next.budget.toLocaleString('en-IN')} budget by ₹${proposedBudgetBreakdown.deficit.toLocaleString('en-IN')}. Consider reducing duration to fit within budget.`
    : `Recovery evaluated candidate adjustments for ${next.destination}. Total verified cost is ₹${proposedBudgetBreakdown.totalEstimatedExpenses.toLocaleString('en-IN')} against ₹${next.budget.toLocaleString('en-IN')} budget.`;

  return {
    proposalId: `prop_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    createdAt: new Date().toISOString(),
    status: 'pending', // 'pending' | 'approved' | 'rejected' | 'stale'
    userReason: proposedChanges.userReason ? String(proposedChanges.userReason).trim() : null,
    agentExplanation,
    agentSummary: agentExplanation,
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
        ...next,
        accommodationPreference: finalAccPref,
        transportPreference: finalTransPref
      },
      selectedTransport: chosenTransport,
      selectedAccommodation: chosenAccommodation,
      budgetBreakdown: proposedBudgetBreakdown,
      itinerary: proposedItinerary,
      simulatedDisruption: next.simulatedDisruption
    }
  };
}

/**
 * Validates and calculates resulting values from mid-trip deltas
 * @param {Object} baseline - { duration: number, budget: number }
 * @param {Object} deltas - { durationDelta: number, budgetDelta: number }
 * @returns {Object} { isValid: boolean, errors: Object, resultingDuration: number, resultingBudget: number }
 */
export function calculateTripDeltas(baseline, deltas = {}) {
  const origDuration = parseInt(baseline?.duration, 10) || 1;
  const origBudget = parseInt(baseline?.budget, 10) || 0;

  const durationDelta = deltas.durationDelta !== undefined && deltas.durationDelta !== '' && deltas.durationDelta !== null
    ? parseInt(deltas.durationDelta, 10) || 0
    : 0;

  const budgetDelta = deltas.budgetDelta !== undefined && deltas.budgetDelta !== '' && deltas.budgetDelta !== null
    ? parseInt(deltas.budgetDelta, 10) || 0
    : 0;

  const resultingDuration = origDuration + durationDelta;
  const resultingBudget = origBudget + budgetDelta;

  const errors = {};

  if (durationDelta === 0 && budgetDelta === 0) {
    errors.general = 'Please provide a duration change, a budget change, or both.';
  }

  if (resultingDuration < 1) {
    errors.duration = `Resulting duration (${resultingDuration}d) cannot be zero or negative. Minimum is 1 day.`;
  }

  if (resultingBudget <= 0) {
    errors.budget = `Resulting budget (₹${resultingBudget}) cannot be zero or negative. Must be greater than ₹0.`;
  }

  const isValid = Object.keys(errors).length === 0;

  return {
    isValid,
    errors,
    originalDuration: origDuration,
    originalBudget: origBudget,
    durationDelta,
    budgetDelta,
    resultingDuration,
    resultingBudget
  };
}

/**
 * Convenient wrapper to generate a recovery proposal directly from mid-trip deltas
 */
export function generateRecoveryProposalFromDeltas(activeTrip, { durationDelta, budgetDelta, userReason } = {}) {
  if (!activeTrip || !activeTrip.inputs) {
    throw new Error('Active trip is required to evaluate trip deltas.');
  }

  const calc = calculateTripDeltas(activeTrip.inputs, { durationDelta, budgetDelta });
  if (!calc.isValid) {
    const msg = Object.values(calc.errors).join(' ');
    throw new Error(msg);
  }

  return generateRecoveryProposal(activeTrip, {
    duration: calc.resultingDuration,
    budget: calc.resultingBudget,
    userReason: userReason ? String(userReason).trim() : undefined
  });
}

/**
 * Checks if a pending proposal has become stale due to subsequent input changes
 */
export function isProposalStale(proposal, currentFormInputs = null, currentActiveTrip = null) {
  if (!proposal || proposal.status !== 'pending' || !proposal.proposedPlan?.inputs) return false;

  // Check if active trip changed identity or baseline inputs
  if (currentActiveTrip && proposal.originalSnapshot?.tripId) {
    if (currentActiveTrip.id !== proposal.originalSnapshot.tripId) return true;
    if (proposal.originalSnapshot.inputs) {
      if (
        currentActiveTrip.inputs.duration !== proposal.originalSnapshot.inputs.duration ||
        currentActiveTrip.inputs.budget !== proposal.originalSnapshot.inputs.budget ||
        currentActiveTrip.inputs.destination !== proposal.originalSnapshot.inputs.destination ||
        currentActiveTrip.inputs.origin !== proposal.originalSnapshot.inputs.origin
      ) {
        return true;
      }
    }
  }

  if (!currentFormInputs) return false;
  const pInputs = proposal.proposedPlan.inputs;

  // Fundamental trip constraints: origin, destination, travellers count.
  // Recovery proposals adapt accommodation, transport, schedule, and budget,
  // but core trip identity (cities and travellers count) must remain consistent.
  if (currentFormInputs.origin && pInputs.origin !== currentFormInputs.origin) return true;
  if (currentFormInputs.destination && pInputs.destination !== currentFormInputs.destination) return true;
  if (currentFormInputs.travellers && parseInt(currentFormInputs.travellers, 10) !== pInputs.travellers) return true;

  return false;
}

/**
 * Validates the structure and consistency of a recovery proposal
 * @param {Object} proposal - Candidate recovery proposal
 * @param {Object} [activeTrip] - Current active trip to check continuity against
 * @param {Object} [currentFormInputs] - Optional current form inputs to verify synchronization
 * @returns {{ isValid: boolean, errors: string[] }}
 */
export function validateRecoveryProposal(proposal, activeTrip = null, currentFormInputs = null) {
  const errors = [];

  if (!proposal || typeof proposal !== 'object') {
    return { isValid: false, errors: ['Proposal must be a valid non-null object.'] };
  }

  if (!proposal.proposalId || typeof proposal.proposalId !== 'string') {
    errors.push('Proposal is missing a valid proposalId string.');
  }

  if (proposal.status !== 'pending') {
    errors.push(`Proposal status is "${proposal.status}". Only pending proposals can be approved or evaluated.`);
  }

  const proposedPlan = proposal.proposedPlan;
  if (!proposedPlan || typeof proposedPlan !== 'object') {
    errors.push('Proposal is missing proposedPlan object.');
  } else {
    // Validate inputs
    const inputs = proposedPlan.inputs;
    if (!inputs || typeof inputs !== 'object') {
      errors.push('Proposal proposedPlan is missing inputs.');
    } else {
      if (!inputs.origin || typeof inputs.origin !== 'string') errors.push('Proposal proposedPlan inputs missing origin.');
      if (!inputs.destination || typeof inputs.destination !== 'string') errors.push('Proposal proposedPlan inputs missing destination.');
      if (!inputs.duration || parseInt(inputs.duration, 10) < 1) errors.push('Proposal proposedPlan inputs duration must be at least 1.');
      if (inputs.budget === undefined || Number(inputs.budget) <= 0) errors.push('Proposal proposedPlan inputs budget must be greater than 0.');
      if (!inputs.travellers || parseInt(inputs.travellers, 10) < 1) errors.push('Proposal proposedPlan inputs travellers must be at least 1.');
    }

    // Validate itinerary with daily schedules
    const itinerary = proposedPlan.itinerary;
    if (!itinerary || !Array.isArray(itinerary.days) || itinerary.days.length === 0) {
      errors.push('Proposal proposedPlan is missing a valid itinerary with daily schedules.');
    }

    // Validate selected transport & accommodation
    if (!proposedPlan.selectedTransport || !proposedPlan.selectedTransport.id) {
      errors.push('Proposal proposedPlan is missing selectedTransport.');
    }
    if (!proposedPlan.selectedAccommodation || !proposedPlan.selectedAccommodation.id) {
      errors.push('Proposal proposedPlan is missing selectedAccommodation.');
    }

    // Validate budgetBreakdown with total estimated expenses
    if (!proposedPlan.budgetBreakdown || typeof proposedPlan.budgetBreakdown.totalEstimatedExpenses !== 'number') {
      errors.push('Proposal proposedPlan is missing budgetBreakdown with totalEstimatedExpenses.');
    }
  }

  // Revalidate active trip continuity and staleness if activeTrip provided
  if (activeTrip) {
    if (!activeTrip.id || !activeTrip.inputs) {
      errors.push('Active trip baseline is invalid or missing required inputs.');
    } else if (isProposalStale(proposal, currentFormInputs, activeTrip)) {
      errors.push('Proposal is stale: active trip baseline or constraints have changed since proposal generation.');
    }
  } else if (currentFormInputs && isProposalStale(proposal, currentFormInputs, null)) {
    errors.push('Proposal is stale: form inputs have changed since proposal generation.');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Executes proposal approval: generates a new active trip and recovery audit log.
 * Revalidates the proposal at approval time to prevent approving stale or invalid proposals.
 * Pure function: returns a new trip and log entry without side effects.
 */
export function applyProposal(activeTrip, proposal) {
  if (!activeTrip || !activeTrip.id || !activeTrip.inputs) {
    throw new Error('Cannot approve proposal: active trip baseline is required.');
  }

  const validation = validateRecoveryProposal(proposal, activeTrip);
  if (!validation.isValid) {
    throw new Error(`Cannot approve proposal: ${validation.errors.join(' ')}`);
  }

  const approvedProposal = {
    ...proposal,
    status: 'approved',
    resolvedAt: new Date().toISOString()
  };

  const updatedActiveTrip = {
    id: activeTrip.id,
    name: `${proposal.proposedPlan.inputs.origin} to ${proposal.proposedPlan.inputs.destination} (${proposal.proposedPlan.inputs.duration}d)`,
    updatedAt: new Date().toISOString(),
    inputs: { ...proposal.proposedPlan.inputs },
    selectedTransport: { ...proposal.proposedPlan.selectedTransport },
    selectedAccommodation: { ...proposal.proposedPlan.selectedAccommodation },
    itinerary: { ...proposal.proposedPlan.itinerary },
    budgetBreakdown: { ...proposal.proposedPlan.budgetBreakdown },
    simulatedDisruption: proposal.proposedPlan.simulatedDisruption || null
  };

  const costDifference = proposal.costImpact?.costDifference ?? 0;

  const auditLogEntry = {
    id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    proposalId: proposal.proposalId,
    timestamp: new Date().toISOString(),
    action: 'APPROVED',
    triggerReasons: Array.isArray(proposal.triggerReasons) ? [...proposal.triggerReasons] : [],
    userReason: proposal.userReason || null,
    actionsTaken: Array.isArray(proposal.actionsTaken) ? [...proposal.actionsTaken] : [],
    costImpact: proposal.costImpact ? {
      ...proposal.costImpact,
      difference: costDifference
    } : null
  };

  return {
    updatedTrip: updatedActiveTrip,
    auditLogEntry,
    resolvedProposal: approvedProposal
  };
}

/**
 * Executes proposal rejection: preserves the active trip intact and records rejection in audit log.
 * Pure function.
 */
export function rejectProposal(activeTrip, proposal) {
  if (!activeTrip || !activeTrip.id) {
    throw new Error('Cannot reject proposal: active trip baseline is required.');
  }

  if (!proposal || proposal.status !== 'pending') {
    throw new Error('Only a pending proposal can be rejected.');
  }

  const rejectedProposal = {
    ...proposal,
    status: 'rejected',
    resolvedAt: new Date().toISOString()
  };

  const costDifference = proposal.costImpact?.costDifference ?? 0;

  const auditLogEntry = {
    id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    proposalId: proposal.proposalId,
    timestamp: new Date().toISOString(),
    action: 'REJECTED',
    triggerReasons: Array.isArray(proposal.triggerReasons) ? [...proposal.triggerReasons] : [],
    userReason: proposal.userReason || null,
    costImpact: proposal.costImpact ? {
      ...proposal.costImpact,
      difference: costDifference
    } : null,
    note: 'User declined proposed changes. Active itinerary preserved intact.'
  };

  return {
    preservedTrip: activeTrip,
    auditLogEntry,
    resolvedProposal: rejectedProposal
  };
}

