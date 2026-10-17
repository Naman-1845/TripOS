/**
 * Default demonstration scenarios as requested in the specification.
 * These serve as convenient defaults for testing and demoing, not hard-coded restrictions.
 */

export const DEMO_SCENARIOS = {
  scenarioA: {
    id: 'scenarioA',
    title: 'Scenario A: Delhi to Manali (Budget Recovery)',
    subtitle: '5 Days, 2 Travellers, ₹20,000 -> Recovery to ₹16,000',
    description: 'Generates complete itinerary for ₹20,000. Then trigger budget reduction to ₹16,000, inspect side-by-side proposal, and approve.',
    inputs: {
      origin: 'Delhi',
      destination: 'Manali',
      startDate: new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0],
      duration: 5,
      travellers: 2,
      budget: 20000,
      interests: ['Adventure', 'Nature', 'Culture'],
      transportPreference: 'Bus',
      accommodationPreference: 'Standard'
    },
    recoveryAction: {
      label: 'Simulate Budget Cut to ₹16,000',
      proposedChanges: {
        budget: 16000
      }
    }
  },

  scenarioB: {
    id: 'scenarioB',
    title: 'Scenario B: Trip Duration Compression (Rejection Test)',
    subtitle: '5 Days -> 3 Days Duration Reduction with Reject Action',
    description: 'Change duration from 5 to 3 days. Generate recovery proposal. Reject proposal and verify original 5-day trip stays completely intact.',
    inputs: {
      origin: 'Delhi',
      destination: 'Manali',
      startDate: new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0],
      duration: 5,
      travellers: 2,
      budget: 25000,
      interests: ['Nature', 'Relaxation', 'Culture'],
      transportPreference: 'Bus',
      accommodationPreference: 'Standard'
    },
    recoveryAction: {
      label: 'Simulate Trip Shortening (5d -> 3d)',
      proposedChanges: {
        duration: 3
      }
    }
  },

  scenarioC: {
    id: 'scenarioC',
    title: 'Scenario C: Outdoor Weather Disruption Recovery',
    subtitle: 'Adverse Mountain Weather -> Indoor Cultural Replacement',
    description: 'Simulates heavy snowfall / rainfall warning making outdoor activities unsuitable. Recovery suggests sheltered indoor alternatives.',
    inputs: {
      origin: 'Delhi',
      destination: 'Manali',
      startDate: new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0],
      duration: 4,
      travellers: 2,
      budget: 22000,
      interests: ['Adventure', 'Nature'],
      transportPreference: 'Bus',
      accommodationPreference: 'Standard'
    },
    recoveryAction: {
      label: 'Trigger Blizzard / Weather Disruption',
      proposedChanges: {
        simulatedDisruption: {
          outdoorUnsuitable: true,
          reason: 'Severe Mountain Blizzard & Avalanche Warning: High-altitude outdoor excursions suspended.'
        }
      }
    }
  },

  arbitraryDestination: {
    id: 'arbitraryDestination',
    title: 'Arbitrary Destination: Munnar High Hills',
    subtitle: 'Testing Uncached Arbitrary Destination Graceful Fallback',
    description: 'Tests arbitrary user-entered location with automated heuristic estimates and clear estimation disclaimers.',
    inputs: {
      origin: 'Kochi',
      destination: 'Munnar',
      startDate: new Date(Date.now() + 86400000 * 10).toISOString().split('T')[0],
      duration: 4,
      travellers: 3,
      budget: 28000,
      interests: ['Nature', 'Relaxation'],
      transportPreference: 'Cab',
      accommodationPreference: 'Standard'
    }
  }
};

