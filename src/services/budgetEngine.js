/**
 * Budget Calculation Engine for TripOS
 * Performs genuine, transparent cost calculations and breakdown tracking.
 */

export const DAILY_FOOD_TIER = {
  Hostel: 400,
  Standard: 750,
  Luxury: 1500
};

export const MISC_PER_PERSON_PER_DAY = 200;

/**
 * Calculates genuine expense breakdown for a given configuration
 * @param {Object} params
 * @param {number} params.budget - User declared total budget
 * @param {number} params.travellers - Number of travellers (>= 1)
 * @param {number} params.duration - Duration in days (>= 1)
 * @param {Object} params.selectedTransport - Chosen transport option object
 * @param {Object} params.selectedAccommodation - Chosen accommodation option object
 * @param {Array} params.plannedActivities - Array of activities planned in itinerary
 * @returns {Object} Full breakdown with matching totals, remaining balance, and honest alerts
 */
export function calculateBudgetBreakdown({
  budget = 0,
  travellers = 1,
  duration = 1,
  selectedTransport,
  selectedAccommodation,
  plannedActivities = []
}) {
  const safeTravellers = Math.max(1, parseInt(travellers, 10) || 1);
  const safeDuration = Math.max(1, parseInt(duration, 10) || 1);
  const safeBudget = Math.max(0, parseInt(budget, 10) || 0);

  // 1. Transport Calculation (Round-trip)
  let transportTotal = 0;
  let transportBreakdownDescription = '';

  if (selectedTransport) {
    if (selectedTransport.flatCost) {
      // Cab or private vehicle flat rate (round trip / full trip vehicle hire)
      transportTotal = selectedTransport.flatCost;
      transportBreakdownDescription = `Flat vehicle rate: ₹${selectedTransport.flatCost.toLocaleString('en-IN')}`;
    } else if (selectedTransport.costPerPerson) {
      // Per person one-way * 2 (round-trip) * travellers
      const oneWayPerPerson = selectedTransport.costPerPerson;
      transportTotal = oneWayPerPerson * 2 * safeTravellers;
      transportBreakdownDescription = `₹${oneWayPerPerson.toLocaleString('en-IN')} x 2 ways x ${safeTravellers} traveller(s)`;
    }
  }

  // 2. Accommodation Calculation
  // Standard hotel nights = max(1, duration - 1)
  const nights = Math.max(1, safeDuration - 1);
  const roomsNeeded = Math.ceil(safeTravellers / 2);
  const costPerNight = selectedAccommodation?.costPerNight || 1200;
  const accommodationTotal = nights * roomsNeeded * costPerNight;
  const accommodationBreakdownDescription = `${nights} night(s) x ${roomsNeeded} room(s) @ ₹${costPerNight.toLocaleString('en-IN')}/night`;

  // 3. Food Calculation
  const tierKey = selectedAccommodation?.type || 'Standard';
  const foodRatePerDay = DAILY_FOOD_TIER[tierKey] || DAILY_FOOD_TIER.Standard;
  const foodTotal = safeDuration * safeTravellers * foodRatePerDay;
  const foodBreakdownDescription = `₹${foodRatePerDay}/day x ${safeDuration} day(s) x ${safeTravellers} traveller(s)`;

  // 4. Activities Calculation (Sum of planned activity tickets for all travellers)
  let activitiesPerPerson = 0;
  plannedActivities.forEach(act => {
    if (act && typeof act.costPerPerson === 'number') {
      activitiesPerPerson += act.costPerPerson;
    }
  });
  const activitiesTotal = activitiesPerPerson * safeTravellers;
  const activitiesBreakdownDescription = `₹${activitiesPerPerson.toLocaleString('en-IN')} activities total x ${safeTravellers} traveller(s)`;

  // 5. Other / Miscellaneous Local Transit & Emergency Buffer
  const otherTotal = MISC_PER_PERSON_PER_DAY * safeDuration * safeTravellers;
  const otherBreakdownDescription = `₹${MISC_PER_PERSON_PER_DAY}/day local buffer x ${safeDuration} day(s) x ${safeTravellers} traveller(s)`;

  // 6. Total Estimated Expenses
  const totalEstimatedExpenses = transportTotal + accommodationTotal + foodTotal + activitiesTotal + otherTotal;

  // 7. Remaining Budget & Honest Analysis
  const remainingBudget = safeBudget - totalEstimatedExpenses;
  const perPersonCost = Math.round(totalEstimatedExpenses / safeTravellers);
  const isOverBudget = totalEstimatedExpenses > safeBudget;
  const deficit = isOverBudget ? totalEstimatedExpenses - safeBudget : 0;
  const surplus = !isOverBudget ? remainingBudget : 0;
  const budgetUtilizationPercent = safeBudget > 0 ? Math.round((totalEstimatedExpenses / safeBudget) * 100) : 100;

  return {
    userBudget: safeBudget,
    travellers: safeTravellers,
    duration: safeDuration,
    nights,
    roomsNeeded,
    categories: {
      transport: {
        amount: transportTotal,
        description: transportBreakdownDescription,
        name: selectedTransport?.name || 'Transport'
      },
      accommodation: {
        amount: accommodationTotal,
        description: accommodationBreakdownDescription,
        name: selectedAccommodation?.name || 'Accommodation'
      },
      food: {
        amount: foodTotal,
        description: foodBreakdownDescription,
        tier: tierKey
      },
      activities: {
        amount: activitiesTotal,
        description: activitiesBreakdownDescription,
        count: plannedActivities.length
      },
      other: {
        amount: otherTotal,
        description: otherBreakdownDescription
      }
    },
    totalEstimatedExpenses,
    remainingBudget,
    perPersonCost,
    isOverBudget,
    deficit,
    surplus,
    budgetUtilizationPercent
  };
}

