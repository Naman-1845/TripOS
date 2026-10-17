import { describe, it, expect } from 'vitest';
import { calculateBudgetBreakdown, DAILY_FOOD_TIER, MISC_PER_PERSON_PER_DAY } from '../services/budgetEngine.js';

describe('Budget Calculation Engine', () => {
  const sampleTransportBus = { id: 'bus-1', name: 'Volvo Bus', type: 'Bus', costPerPerson: 1200 };
  const sampleTransportCab = { id: 'cab-1', name: 'Private Cab', type: 'Cab', flatCost: 9000 };
  const sampleAccommodation = { id: 'acc-1', name: 'Hotel Snow', type: 'Standard', costPerNight: 2400 };

  it('calculates transparent breakdown where sum of all categories matches total exactly', () => {
    const plannedActivities = [
      { name: 'Sightseeing', costPerPerson: 200 },
      { name: 'Museum', costPerPerson: 100 }
    ];

    const result = calculateBudgetBreakdown({
      budget: 25000,
      travellers: 2,
      duration: 5,
      selectedTransport: sampleTransportBus,
      selectedAccommodation: sampleAccommodation,
      plannedActivities
    });

    const sumCategories =
      result.categories.transport.amount +
      result.categories.accommodation.amount +
      result.categories.food.amount +
      result.categories.activities.amount +
      result.categories.other.amount;

    expect(result.totalEstimatedExpenses).toBe(sumCategories);
    expect(result.remainingBudget).toBe(result.userBudget - result.totalEstimatedExpenses);
    expect(result.perPersonCost).toBe(Math.round(result.totalEstimatedExpenses / 2));
  });

  it('correctly handles flat-cost transport (cab) vs per-person transport (bus)', () => {
    // Cab is flat cost
    const cabResult = calculateBudgetBreakdown({
      budget: 30000,
      travellers: 3,
      duration: 4,
      selectedTransport: sampleTransportCab,
      selectedAccommodation: sampleAccommodation
    });
    expect(cabResult.categories.transport.amount).toBe(9000);

    // Bus is 1200 * 2 (round-trip) * 3 travellers = 7200
    const busResult = calculateBudgetBreakdown({
      budget: 30000,
      travellers: 3,
      duration: 4,
      selectedTransport: sampleTransportBus,
      selectedAccommodation: sampleAccommodation
    });
    expect(busResult.categories.transport.amount).toBe(1200 * 2 * 3);
  });

  it('correctly computes rooms needed (2 people per room ceiling)', () => {
    // 3 travellers = 2 rooms
    const result3 = calculateBudgetBreakdown({
      budget: 20000,
      travellers: 3,
      duration: 3,
      selectedAccommodation: sampleAccommodation
    });
    expect(result3.roomsNeeded).toBe(2);

    // 4 travellers = 2 rooms
    const result4 = calculateBudgetBreakdown({
      budget: 20000,
      travellers: 4,
      duration: 3,
      selectedAccommodation: sampleAccommodation
    });
    expect(result4.roomsNeeded).toBe(2);

    // 5 travellers = 3 rooms
    const result5 = calculateBudgetBreakdown({
      budget: 20000,
      travellers: 5,
      duration: 3,
      selectedAccommodation: sampleAccommodation
    });
    expect(result5.roomsNeeded).toBe(3);
  });

  it('honestly detects and flags insufficient budgets without false claims', () => {
    const result = calculateBudgetBreakdown({
      budget: 5000, // Very low budget
      travellers: 2,
      duration: 5,
      selectedTransport: sampleTransportBus,
      selectedAccommodation: sampleAccommodation
    });

    expect(result.isOverBudget).toBe(true);
    expect(result.deficit).toBeGreaterThan(0);
    expect(result.deficit).toBe(result.totalEstimatedExpenses - 5000);
    expect(result.remainingBudget).toBeLessThan(0);
    expect(result.surplus).toBe(0);
  });

  it('handles boundary cases: 1 traveller, 1 day, 0 budget gracefully', () => {
    const result = calculateBudgetBreakdown({
      budget: 0,
      travellers: 1,
      duration: 1,
      selectedTransport: sampleTransportBus,
      selectedAccommodation: sampleAccommodation
    });

    expect(result.travellers).toBe(1);
    expect(result.duration).toBe(1);
    expect(result.nights).toBe(1); // At least 1 night base
    expect(result.isOverBudget).toBe(true);
    expect(result.userBudget).toBe(0);
  });
});

