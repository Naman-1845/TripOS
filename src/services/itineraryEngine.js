/**
 * Itinerary Generation Engine for TripOS
 * Deterministic, interest-aware, and responsive to simulated conditions and weather alerts.
 */

import { getDestinationData } from '../data/destinationsData.js';

/**
 * Generates an itinerary for the given inputs
 * @param {Object} params
 * @param {string} params.origin
 * @param {string} params.destination
 * @param {string} params.startDate
 * @param {number} params.duration
 * @param {Array<string>} params.interests
 * @param {Object} params.simulatedDisruption - e.g. { outdoorUnsuitable: boolean, reason: string }
 * @returns {Object} Complete itinerary object with daily breakdown and planned activities
 */
export function generateItinerary({
  origin = 'Delhi',
  destination = 'Manali',
  startDate = new Date().toISOString().split('T')[0],
  duration = 5,
  interests = ['Adventure', 'Nature', 'Culture'],
  simulatedDisruption = null
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

    // Handle simulated disruption (Scenario C: Outdoor activities unsuitable)
    const checkDisruption = (act, timeOfDay) => {
      if (simulatedDisruption?.outdoorUnsuitable && act.isOutdoor) {
        const replacementPool = indoorPool.length > 0 ? indoorPool : fallbackIndoors;
        const replacementIndex = (dayNum + (timeOfDay === 'morning' ? 0 : 1)) % replacementPool.length;
        const replacement = replacementPool[replacementIndex];

        return {
          ...act,
          isUnsuitable: true,
          unsuitabilityReason: simulatedDisruption.reason || 'Outdoor conditions unsafe (weather / disruption alert)',
          replacementActivity: {
            ...replacement,
            replacementNotice: `Suggested safe indoor replacement for ${act.name}`
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

    days.push({
      dayNumber: dayNum,
      dateFormatted,
      title: dayTitle,
      theme: dayTheme,
      morning: morningAct,
      afternoon: afternoonAct,
      evening: eveningAct,
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
    simulatedDisruption,
    days,
    allPlannedActivities,
    generatedAt: new Date().toISOString()
  };
}

