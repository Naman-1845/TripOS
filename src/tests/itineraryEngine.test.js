import { describe, it, expect } from 'vitest';
import { generateItinerary } from '../services/itineraryEngine.js';

describe('Itinerary Generation Engine', () => {
  it('generates the exact requested number of days', () => {
    const itinerary3 = generateItinerary({ origin: 'Delhi', destination: 'Manali', duration: 3 });
    expect(itinerary3.days.length).toBe(3);
    expect(itinerary3.days[0].dayNumber).toBe(1);
    expect(itinerary3.days[2].dayNumber).toBe(3);

    const itinerary7 = generateItinerary({ origin: 'Delhi', destination: 'Manali', duration: 7 });
    expect(itinerary7.days.length).toBe(7);
  });

  it('handles arbitrary uncached destinations gracefully with heuristic labels', () => {
    const arbitrary = generateItinerary({
      origin: 'Kochi',
      destination: 'Munnar',
      duration: 4
    });

    expect(arbitrary.destination).toBe('Munnar');
    expect(arbitrary.days.length).toBe(4);
    expect(arbitrary.destinationDetails.isCurated).toBe(false);
    expect(arbitrary.destinationDetails.dataSourceNotice).toContain('Arbitrary destination fallback');
    expect(arbitrary.days[0].morning).toBeDefined();
    expect(arbitrary.days[0].meals.lunch).toBeDefined();
  });

  it('responds to adverse weather / simulated disruption by substituting outdoor activities', () => {
    const disruption = {
      outdoorUnsuitable: true,
      reason: 'Blizzard and road icing warning'
    };

    const disruptedPlan = generateItinerary({
      origin: 'Delhi',
      destination: 'Manali',
      duration: 3,
      simulatedDisruption: disruption
    });

    // Check that any originally outdoor morning/afternoon activity is flagged unsuitable and has indoor replacement
    const firstDayMorning = disruptedPlan.days[0].morning;
    if (firstDayMorning.isOutdoor) {
      expect(firstDayMorning.isUnsuitable).toBe(true);
      expect(firstDayMorning.unsuitabilityReason).toContain('Blizzard');
      expect(firstDayMorning.replacementActivity).toBeDefined();
      expect(firstDayMorning.replacementActivity.isOutdoor).toBe(false);
    }

    // Verify all active planned activities are safely marked
    disruptedPlan.days.forEach(day => {
      if (day.morning.isUnsuitable) {
        expect(day.morning.replacementActivity).toBeDefined();
      }
    });
  });
});

