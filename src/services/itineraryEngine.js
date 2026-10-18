/**
 * Itinerary Generation Engine for TripOS
 * Deterministic, interest-aware, and responsive to simulated conditions and weather alerts.
 */

import { getDestinationData } from '../data/destinationsData.js';

/**
 * Calculates multi-modal transit route options (different ways to get to a location)
 * with vehicle options from the hotel to different visit points/locations for each particular day.
 *
 * @param {Object} params
 * @param {string} params.hotelName - Base hotel / accommodation
 * @param {string} params.destination - Destination city
 * @param {number} params.dayNumber - Day of the trip
 * @param {string} params.morningLocation - Morning visit spot
 * @param {string} params.afternoonLocation - Afternoon visit spot
 * @param {string} params.eveningLocation - Evening visit spot
 * @returns {Array<Object>} List of transit legs with vehicle options, durations, distances, fares, and routes
 */
export function calculateDailyTransitRoutes({
  hotelName = 'Central Hotel / Resort',
  destination = 'Manali',
  dayNumber = 1,
  morningLocation = 'Morning Sightseeing Arena',
  afternoonLocation = 'Afternoon Cultural Point',
  eveningLocation = 'Evening Promenade'
}) {
  const legs = [
    {
      legId: `leg-${dayNumber}-1`,
      from: hotelName,
      to: morningLocation,
      legTitle: `Leg 1: Hotel ➔ ${morningLocation}`,
      approxDistanceKm: Math.round(((dayNumber * 2.3 + 3.1) % 8 + 2.5) * 10) / 10
    },
    {
      legId: `leg-${dayNumber}-2`,
      from: morningLocation,
      to: afternoonLocation,
      legTitle: `Leg 2: ${morningLocation} ➔ ${afternoonLocation}`,
      approxDistanceKm: Math.round(((dayNumber * 1.7 + 1.8) % 6 + 1.6) * 10) / 10
    },
    {
      legId: `leg-${dayNumber}-3`,
      from: afternoonLocation,
      to: eveningLocation,
      legTitle: `Leg 3: ${afternoonLocation} ➔ ${eveningLocation}`,
      approxDistanceKm: Math.round(((dayNumber * 1.4 + 2.2) % 5 + 1.2) * 10) / 10
    },
    {
      legId: `leg-${dayNumber}-4`,
      from: eveningLocation,
      to: hotelName,
      legTitle: `Leg 4: ${eveningLocation} ➔ Return to Hotel`,
      approxDistanceKm: Math.round(((dayNumber * 2.1 + 2.5) % 7 + 2.2) * 10) / 10
    }
  ];

  return legs.map((leg) => {
    const dist = leg.approxDistanceKm;

    const vehicleOptions = [
      {
        vehicleType: 'Private Cab / Taxi',
        duration: `${Math.max(10, Math.round(dist * 2.8))} mins`,
        distanceKm: dist,
        estimatedFare: Math.round((dist * 35 + 120) / 10) * 10,
        fareLabel: `₹${Math.round((dist * 35 + 120) / 10) * 10}`,
        routeSummary: `Via ${destination} Arterial Way & Direct Access Lane`,
        availability: 'On-demand doorstep pickup',
        isRecommended: dist >= 4.5
      },
      {
        vehicleType: 'Auto-Rickshaw / Tuk-Tuk / Shared Jeep',
        duration: `${Math.max(12, Math.round(dist * 3.6))} mins`,
        distanceKm: dist,
        estimatedFare: Math.round((dist * 18 + 40) / 10) * 10,
        fareLabel: `₹${Math.round((dist * 18 + 40) / 10) * 10}`,
        routeSummary: `Via Old Town Bypass & Local Market Connectors`,
        availability: 'Frequent at taxi/auto stands',
        isRecommended: dist > 1.8 && dist < 4.5
      },
      {
        vehicleType: 'Public Transit / Local City Shuttle',
        duration: `${Math.max(18, Math.round(dist * 4.5))} mins`,
        distanceKm: dist,
        estimatedFare: Math.max(15, Math.round(dist * 5)),
        fareLabel: `₹${Math.max(15, Math.round(dist * 5))} / person`,
        routeSummary: `Via Main Transit Corridor & Designated Bus Stops`,
        availability: 'Departs every 15-20 minutes',
        isRecommended: false
      },
      {
        vehicleType: 'Rental Two-Wheeler / Scooter',
        duration: `${Math.max(8, Math.round(dist * 2.4))} mins`,
        distanceKm: dist,
        estimatedFare: Math.round((dist * 12 + 60) / 10) * 10,
        fareLabel: `₹${Math.round((dist * 12 + 60) / 10) * 10} (Prorated Fuel)`,
        routeSummary: `Via Scenic Ridgeline Way`,
        availability: 'Self-drive rental',
        isRecommended: false
      }
    ];

    if (dist <= 2.5) {
      vehicleOptions.unshift({
        vehicleType: 'Walking / Scenic Pedestrian Trail',
        duration: `${Math.round(dist * 14)} mins`,
        distanceKm: dist,
        estimatedFare: 0,
        fareLabel: 'Free (0 ₹)',
        routeSummary: `Pedestrian walking path & local town lane`,
        availability: 'Always open',
        isRecommended: dist <= 1.8
      });
    }

    return {
      ...leg,
      recommendedVehicle: vehicleOptions.find(v => v.isRecommended)?.vehicleType || vehicleOptions[0].vehicleType,
      vehicleOptions
    };
  });
}

/**
 * Generates an itinerary for the given inputs
 * @param {Object} params
 * @param {string} params.origin
 * @param {string} params.destination
 * @param {string} params.startDate
 * @param {number} params.duration
 * @param {Array<string>} params.interests
 * @param {Object} params.simulatedDisruption - e.g. { outdoorUnsuitable: boolean, reason: string }
 * @param {Object} [params.hotel] - Selected accommodation details
 * @returns {Object} Complete itinerary object with daily breakdown and planned activities
 */
export function generateItinerary({
  origin = 'Delhi',
  destination = 'Manali',
  startDate = new Date().toISOString().split('T')[0],
  duration = 5,
  interests = ['Adventure', 'Nature', 'Culture'],
  simulatedDisruption = null,
  hotel = null
}) {
  const destData = getDestinationData(destination);
  const safeDuration = Math.max(1, parseInt(duration, 10) || 1);
  const startObj = new Date(startDate || Date.now());

  const availableAttractions = destData?.attractions || [];
  const restaurants = destData?.restaurants || [];

  // Filter or prioritize based on interests
  const scoredAttractions = availableAttractions.map(att => {
    let score = 1;
    if (interests.includes(att.category)) score += 3;
    return { ...att, score };
  }).sort((a, b) => b.score - a.score);

  // Pool of outdoor and indoor activities for substitution
  const indoorPool = availableAttractions.filter(a => !a.isOutdoor);
  const fallbackIndoors = [
    { id: 'sub-art-craft', name: 'Regional Heritage Craft Emporium & Artisan Workshop', category: 'Culture', isOutdoor: false, costPerPerson: 100, duration: '2 hours', description: 'Sheltered cultural interaction with local craftspeople and textile weavers.' },
    { id: 'sub-cafe-leisure', name: 'Artisanal Cafe Lounging & Board Games Session', category: 'Relaxation', isOutdoor: false, costPerPerson: 250, duration: 'Evening', description: 'Cozy heated indoor lounge with hot beverages and mountain views.' },
    { id: 'sub-culinary', name: 'Indoor Local Food & Spice Tasting Experience', category: 'Food', isOutdoor: false, costPerPerson: 350, duration: '2.5 hours', description: 'Interactive culinary workshop and tasting menu protected from elements.' }
  ];

  const days = [];
  const allPlannedActivities = [];

  // Enriched weather disruption metadata including 6-hour advance warning
  const effectiveDisruption = simulatedDisruption?.outdoorUnsuitable
    ? {
        ...simulatedDisruption,
        leadTimeHours: 6,
        advanceNotice: 'Advisory notification issued 6 hours before disruption onset. Activities pre-emptively rerouted to sheltered venues.',
        warningStatus: '6H_ADVANCE_ALERT'
      }
    : simulatedDisruption;

  for (let dayNum = 1; dayNum <= safeDuration; dayNum++) {
    const currentDayDate = new Date(startObj);
    currentDayDate.setDate(startObj.getDate() + (dayNum - 1));
    const dateFormatted = currentDayDate.toLocaleDateString('en-IN', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });

    let dayTitle = '';
    let dayTheme = '';

    if (dayNum === 1) {
      dayTitle = `Arrival & Settling into ${destData?.name || destination}`;
      dayTheme = 'Arrival, Check-in & Orientation';
    } else if (dayNum === safeDuration && safeDuration > 1) {
      dayTitle = `Final Souvenirs & Departure from ${destData?.name || destination}`;
      dayTheme = 'Packing, Souvenirs & Journey Home';
    } else {
      const interestTag = interests[(dayNum - 2) % interests.length] || 'Exploration';
      dayTitle = `${destData?.name || destination} Deep Dive: ${interestTag}`;
      dayTheme = `${interestTag} & Scenic Discovery`;
    }

    // Pick activity for morning
    const morningIndex = ((dayNum - 1) * 2) % Math.max(1, scoredAttractions.length);
    let morningAct = scoredAttractions[morningIndex] || availableAttractions[0] || fallbackIndoors[0];

    // Pick activity for afternoon
    const afternoonIndex = ((dayNum - 1) * 2 + 1) % Math.max(1, scoredAttractions.length);
    let afternoonAct = scoredAttractions[afternoonIndex] || availableAttractions[1] || fallbackIndoors[1];

    // Pick activity for evening
    let eveningAct = {
      id: `eve-${dayNum}`,
      name: dayNum === safeDuration ? 'Farewell Promenade & Packing' : `Evening Twilight Walk & ${destData?.name || 'Local'} Square`,
      category: 'Relaxation',
      isOutdoor: dayNum % 2 === 0,
      costPerPerson: 0,
      duration: '1.5 hours',
      description: 'Relaxed unhurried stroll taking in the ambience and sunset.'
    };

    // Handle simulated disruption (Scenario C: Outdoor activities unsuitable, notified 6 hours in advance)
    const checkDisruption = (act, timeOfDay) => {
      if (effectiveDisruption?.outdoorUnsuitable && act.isOutdoor) {
        const replacementPool = indoorPool.length > 0 ? indoorPool : fallbackIndoors;
        const replacementIndex = (dayNum + (timeOfDay === 'morning' ? 0 : 1)) % replacementPool.length;
        const replacement = replacementPool[replacementIndex];

        return {
          ...act,
          isUnsuitable: true,
          leadTimeHours: 6,
          advanceNotice: 'Advisory notification sent 6 hours before disruption onset. Activities pre-emptively rerouted to verified sheltered venues.',
          unsuitabilityReason: `${effectiveDisruption.reason || 'Outdoor conditions unsafe (weather / disruption alert)'} (Notified 6 hours in advance)`,
          replacementActivity: {
            ...replacement,
            leadTimeHours: 6,
            reason: `Pre-emptively rerouted (6-hour advance warning): Safe indoor alternative for ${act.name}`,
            replacementNotice: `Pre-emptively rerouted (6h advance notice): Safe indoor alternative for ${act.name}`
          }
        };
      }
      return { ...act, isUnsuitable: false };
    };

    morningAct = checkDisruption(morningAct, 'morning');
    afternoonAct = checkDisruption(afternoonAct, 'afternoon');
    eveningAct = checkDisruption(eveningAct, 'evening');

    // Register active planned activity (use replacement if active is unsuitable)
    const activeMorning = morningAct.isUnsuitable ? morningAct.replacementActivity : morningAct;
    const activeAfternoon = afternoonAct.isUnsuitable ? afternoonAct.replacementActivity : afternoonAct;
    const activeEvening = eveningAct.isUnsuitable ? eveningAct.replacementActivity : eveningAct;

    allPlannedActivities.push(activeMorning, activeAfternoon, activeEvening);

    // Pick dining recommendations for this day
    const lunchSpot = restaurants[(dayNum - 1) % Math.max(1, restaurants.length)] || {
      name: `Local Traditional Dhaba (${destData?.name || destination})`,
      cuisine: 'Local Flavors',
      avgCostPerPerson: 300,
      note: 'Freshly prepared seasonal dishes'
    };
    const dinnerSpot = restaurants[dayNum % Math.max(1, restaurants.length)] || {
      name: `Boutique Evening Bistro (${destData?.name || destination})`,
      cuisine: 'Multi-Cuisine',
      avgCostPerPerson: 500,
      note: 'Cozy dinner environment'
    };

    // Calculate transit routes and vehicle options for this particular day
    const baseHotelName = (hotel && hotel.name) || destData?.accommodations?.[1]?.name || `${destData?.name || destination} Hotel`;
    const dailyTransitRoutes = calculateDailyTransitRoutes({
      hotelName: baseHotelName,
      destination: destData?.name || destination,
      dayNumber: dayNum,
      morningLocation: activeMorning.name,
      afternoonLocation: activeAfternoon.name,
      eveningLocation: activeEvening.name
    });

    days.push({
      dayNumber: dayNum,
      dateFormatted,
      title: dayTitle,
      theme: dayTheme,
      morning: morningAct,
      afternoon: afternoonAct,
      evening: eveningAct,
      dailyTransitRoutes,
      meals: {
        lunch: lunchSpot,
        dinner: dinnerSpot
      }
    });
  }

  return {
    origin,
    destination: destData?.name || destination,
    destinationDetails: destData,
    startDate,
    duration: safeDuration,
    interests,
    simulatedDisruption: effectiveDisruption,
    days,
    allPlannedActivities,
    generatedAt: new Date().toISOString()
  };
}

