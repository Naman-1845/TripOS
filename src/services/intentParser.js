/**
 * TripOS Natural Language Intent Parser
 *
 * Deterministic rule-based and regex engine that extracts structured trip change intents
 * from natural language input (e.g. "cut my budget by 4k, add a day, and it's raining").
 *
 * Guarantees:
 * - Parses budget numbers (k, thousand, lakh, ₹, INR)
 * - Parses duration changes ("add a day", "2 more days", "shorten by 2 days", "3 days")
 * - Parses traveller counts ("we're 3 people now", "solo", "couple", "group of 4")
 * - Detects adverse weather keywords ("rain", "snow", "blizzard", "storm", "landslide")
 * - Detects destination changes against verified catalog cities
 * - Detects transport and accommodation preference cues
 * - Validates resulting duration >= 1 and budget > 0 against active trip baseline
 * - Never computes prices; only extracts intent and deltas
 */

import { calculateTripDeltas } from './recoveryEngine.js';

export const KNOWN_DESTINATIONS = [
  'Manali',
  'Goa',
  'Munnar',
  'Shimla',
  'Jaipur',
  'Rishikesh',
  'Udaipur',
  'Ooty',
  'Ladakh',
  'Kerala'
];

/**
 * Parses numeric currency values like "4k", "4000", "4 thousand", "₹4,000", "2.5k"
 */
export function parseCurrencyAmount(numStr, unitStr = '') {
  if (!numStr) return null;
  const cleaned = String(numStr).replace(/,/g, '').trim();
  let val = parseFloat(cleaned);
  if (isNaN(val)) return null;

  const unit = String(unitStr || '').toLowerCase().trim();
  if (unit.startsWith('k') || unit.includes('thousand')) {
    val *= 1000;
  } else if (unit.includes('lakh') || unit.includes('lac')) {
    val *= 100000;
  }
  return Math.round(val);
}

/**
 * Deterministic parser for natural language trip commands.
 * Used as server deterministic fallback, quota cooldown handler, and offline client fallback.
 *
 * @param {string} text - Natural language user command (max 500 chars)
 * @param {Object} [activeTrip] - Current active trip baseline
 * @returns {Object} Structured intent extraction result
 */
export function parseIntentDeterministic(text, activeTrip = null) {
  if (!text || typeof text !== 'string' || !text.trim()) {
    return {
      confidence: 0,
      goal: 'balanced',
      needsClarification: 'Please provide a trip change command (e.g., "cut my budget by 4k, add a day, and it\'s raining").'
    };
  }

  const raw = text.slice(0, 500).trim();
  const lower = raw.toLowerCase();

  let durationDelta;
  let budgetDelta;
  let duration;
  let budget;
  let travellers;
  let destination;
  let origin;
  let transportPreference;
  let accommodationPreference;
  let simulatedDisruption;
  let goal = 'balanced';
  let matchedSignals = 0;

  // 1. Weather & Disruption detection
  // rain, raining, blizzard, snow, storm, landslide, torrential, downpour, freezing
  const weatherPattern = /\b(rain|raining|downpour|snow|snowing|blizzard|storm|stormy|landslide|thunderstorm|weather advisory|heavy rain|freezing)\b/i;
  const weatherMatch = lower.match(weatherPattern);
  if (weatherMatch) {
    const term = weatherMatch[1];
    simulatedDisruption = {
      outdoorUnsuitable: true,
      reason: `Adverse weather condition (${term}) identified from command: "${raw}". Outdoor activities should be adjusted.`
    };
    goal = 'indoor';
    matchedSignals++;
  }

  // 2. Budget Changes
  // 2a. Budget reduction: cut/reduce/decrease/save/less/drop by 4k / 4000
  const budgetCutPattern = /(?:cut|reduce|decrease|drop|lower|save|less|slash|tighter)\s*(?:my\s*)?(?:total\s*)?(?:trip\s*)?(?:budget\s*)?(?:by\s*)?(?:₹|rs\.?|inr\s*)?(\d+(?:\.\d+)?)\s*(k|thousand|lakh)?/i;
  // 2b. Budget increase: increase/add/raise/boost budget by 5k
  const budgetAddPattern = /(?:increase|add|raise|boost|extra|more|expand)\s*(?:to\s*)?(?:my\s*)?(?:total\s*)?(?:trip\s*)?(?:budget\s*)?(?:by\s*)?(?:₹|rs\.?|inr\s*)?(\d+(?:\.\d+)?)\s*(k|thousand|lakh)?/i;
  // 2c. Absolute target budget: "budget 15000", "budget of ₹20k", "set budget to 18000"
  const budgetTargetPattern = /(?:set\s*)?budget\s*(?:of|to|is|=|:)\s*(?:₹|rs\.?|inr\s*)?(\d+(?:\.\d+)?)\s*(k|thousand|lakh)?/i;
  // 2d. Cheaper intent without explicit amount: "make it cheaper", "budget saver"
  const cheaperGenericPattern = /\b(make it cheaper|cheaper|tight budget|tighter budget|low cost|save money|budget saver|economy)\b/i;

  const budgetCutMatch = lower.match(budgetCutPattern);
  const budgetAddMatch = lower.match(budgetAddPattern);
  const budgetTargetMatch = lower.match(budgetTargetPattern);

  if (budgetCutMatch && budgetCutMatch[1]) {
    const parsedAmt = parseCurrencyAmount(budgetCutMatch[1], budgetCutMatch[2]);
    if (parsedAmt && parsedAmt > 0) {
      budgetDelta = -parsedAmt;
      goal = 'cheaper';
      matchedSignals++;
    }
  } else if (budgetAddMatch && budgetAddMatch[1] && !lower.match(/(?:add|extra)\s+(\d+)?\s*(?:more\s*)?day/i)) {
    const parsedAmt = parseCurrencyAmount(budgetAddMatch[1], budgetAddMatch[2]);
    if (parsedAmt && parsedAmt > 0) {
      budgetDelta = parsedAmt;
      matchedSignals++;
    }
  } else if (budgetTargetMatch && budgetTargetMatch[1]) {
    const parsedAmt = parseCurrencyAmount(budgetTargetMatch[1], budgetTargetMatch[2]);
    if (parsedAmt && parsedAmt > 0) {
      budget = parsedAmt;
      matchedSignals++;
    }
  } else if (cheaperGenericPattern.test(lower)) {
    goal = 'cheaper';
    if (activeTrip?.inputs?.budget) {
      budgetDelta = -Math.min(4000, Math.max(1000, Math.round(activeTrip.inputs.budget * 0.15)));
    } else {
      budgetDelta = -3000;
    }
    matchedSignals++;
  }

  // 3. Duration Changes
  // 3a. Add duration: "add a day", "add 1 day", "2 more days", "+1 day", "extend trip by 2 more days", "extend by 2 days"
  const addDayPattern = /(?:add|extend|increase|longer|extra)\s*(?:the\s*)?(?:trip\s*)?(?:by\s*)?(?:a|an|one|(\d+))\s*(?:more\s*)?days?|(?:\+\s*(\d+)\s*days?)|(?:(\d+)\s*more\s*days?)/i;
  // 3b. Cut duration: "cut a day", "shorten by 2 days", "reduce by 1 day", "fewer days"
  const cutDayPattern = /(?:cut|shorten|reduce|decrease|fewer|less)\s*(?:the\s*)?(?:trip\s*)?(?:by\s*)?(?:a|an|one|(\d+))\s*days?|(?:\-\s*(\d+)\s*days?)/i;
  // 3c. Absolute duration: "make it 3 days", "3-day trip", "duration 4 days", "for 3 days", "4 days"
  const targetDayPattern = /(?:for|make it|trip of|duration\s*(?:of|is|to)?)\s*(\d+)\s*days?|(?:^|[,\s])(\d+)\s*days?\b/i;

  const addDayMatch = lower.match(addDayPattern);
  const cutDayMatch = lower.match(cutDayPattern);
  const targetDayMatch = lower.match(targetDayPattern);

  if (addDayMatch) {
    const days = parseInt(addDayMatch[1] || addDayMatch[2] || addDayMatch[3], 10) || 1;
    durationDelta = days;
    matchedSignals++;
  } else if (cutDayMatch) {
    const days = parseInt(cutDayMatch[1] || cutDayMatch[2], 10) || 1;
    durationDelta = -days;
    matchedSignals++;
  } else if (targetDayMatch && (targetDayMatch[1] || targetDayMatch[2])) {
    duration = parseInt(targetDayMatch[1] || targetDayMatch[2], 10);
    matchedSignals++;
  }

  // 4. Traveller Count Changes
  // "we're 3 people now", "3 people", "3 travellers", "group of 4", "solo", "couple"
  const travPattern = /(?:we(?:'re| are)\s*)?(\d+)\s*(?:people|persons|travellers|travelers|friends|adults)|(?:group of\s*(\d+))|\bsolo\b|\bcouple\b/i;
  const travMatch = lower.match(travPattern);
  if (travMatch) {
    if (travMatch[1]) {
      travellers = parseInt(travMatch[1], 10);
      matchedSignals++;
    } else if (travMatch[2]) {
      travellers = parseInt(travMatch[2], 10);
      matchedSignals++;
    } else if (lower.includes('solo')) {
      travellers = 1;
      matchedSignals++;
    } else if (lower.includes('couple')) {
      travellers = 2;
      matchedSignals++;
    }
  }

  // 5. Destination Changes
  for (const dest of KNOWN_DESTINATIONS) {
    const destRegex = new RegExp(`\\b(?:to|in|visit|switch to|change to|head to|head over to)\\s+${dest}\\b|\\bdestination(?:\\s+is|\\s+to|:)?\\s+${dest}\\b|\\b${dest}\\b`, 'i');
    if (destRegex.test(lower)) {
      if (!activeTrip || activeTrip.inputs.destination.toLowerCase() !== dest.toLowerCase()) {
        destination = dest;
        matchedSignals++;
        break;
      }
    }
  }

  // 6. Transport Preferences
  // flight, fly, bus, train, cab, taxi
  if (/\b(flight|fly|flying|plane|air)\b/i.test(lower)) {
    transportPreference = 'Flight';
    goal = 'faster';
    matchedSignals++;
  } else if (/\b(bus|coach)\b/i.test(lower)) {
    transportPreference = 'Bus';
    matchedSignals++;
  } else if (/\b(train|railway|rail)\b/i.test(lower)) {
    transportPreference = 'Train';
    matchedSignals++;
  } else if (/\b(cab|taxi|private car|drive)\b/i.test(lower)) {
    transportPreference = 'Cab';
    matchedSignals++;
  }

  // 7. Accommodation Preferences
  // luxury, resort, 5-star, hostel, backpacker, standard, hotel
  if (/\b(luxury|5-star|five star|resort|premium)\b/i.test(lower)) {
    accommodationPreference = 'Luxury';
    matchedSignals++;
  } else if (/\b(hostel|backpacker|dorm|dormitory)\b/i.test(lower)) {
    accommodationPreference = 'Hostel';
    goal = 'cheaper';
    matchedSignals++;
  } else if (/\b(standard|hotel|guesthouse)\b/i.test(lower)) {
    accommodationPreference = 'Standard';
    matchedSignals++;
  }

  // Determine confidence & clarification
  let confidence = 0.9;
  let needsClarification;

  if (matchedSignals === 0) {
    confidence = 0.2;
    needsClarification = "I couldn't identify specific changes from your command. Try typing: 'cut my budget by 4k, add a day, and it's raining'.";
  } else if (matchedSignals === 1 && !budgetDelta && !durationDelta && !simulatedDisruption && !destination) {
    confidence = 0.7;
  }

  // 8. Validate resulting duration and budget against activeTrip if provided
  if (activeTrip && activeTrip.inputs) {
    const origDuration = parseInt(activeTrip.inputs.duration, 10) || 1;
    const origBudget = parseInt(activeTrip.inputs.budget, 10) || 0;

    let resDuration = origDuration;
    if (durationDelta !== undefined) resDuration += durationDelta;
    else if (duration !== undefined) resDuration = duration;

    let resBudget = origBudget;
    if (budgetDelta !== undefined) resBudget += budgetDelta;
    else if (budget !== undefined) resBudget = budget;

    if (resDuration < 1) {
      confidence = 0.3;
      needsClarification = `Trip duration would become ${resDuration} day(s). Resulting duration must be at least 1 day.`;
    } else if (resBudget <= 0) {
      confidence = 0.3;
      needsClarification = `Trip budget would become ₹${resBudget}. Resulting budget must be greater than ₹0.`;
    }
  }

  return {
    durationDelta,
    budgetDelta,
    duration,
    budget,
    travellers,
    destination,
    origin,
    transportPreference,
    accommodationPreference,
    simulatedDisruption,
    userReason: raw,
    goal,
    confidence,
    needsClarification
  };
}
