import { describe, it, expect } from 'vitest';
import { calculateDailyTransitRoutes, generateItinerary } from '../services/itineraryEngine.js';
import { generateRecoveryProposal } from '../services/recoveryEngine.js';
import {
  compareHotelPrices,
  compareTransportPrices,
  executeBookingRedirect,
  generateHotelRedirectUrl,
  generateTransportRedirectUrl,
  HOTEL_BOOKING_PLATFORMS,
  TRANSPORT_BOOKING_PLATFORMS,
  KNOWN_HOTEL_DEEP_LINKS
} from '../services/bookingComparisonService.js';
import { getDestinationData } from '../data/destinationsData.js';
import { draft_recovery_proposal } from '../services/agentTools.js';

describe('New Features Test Suite: Daily Routes, 6h Weather Notification, Exact Booking Redirects', () => {
  const manaliData = getDestinationData('Manali');
  const baseTrip = {
    id: 'test_base_trip_features',
    name: 'Delhi to Manali (5d)',
    inputs: {
      origin: 'Delhi',
      destination: 'Manali',
      startDate: '2026-11-01',
      duration: 5,
      travellers: 2,
      budget: 20000,
      interests: ['Adventure', 'Nature', 'Culture'],
      transportPreference: 'Bus',
      accommodationPreference: 'Standard'
    },
    selectedTransport: manaliData.transportOptions[0],
    selectedAccommodation: manaliData.accommodations[1],
    itinerary: generateItinerary({ origin: 'Delhi', destination: 'Manali', duration: 5 }),
    budgetBreakdown: { totalEstimatedExpenses: 14000, remainingBudget: 6000 },
    simulatedDisruption: null
  };

  // -------------------------------------------------------------------------
  // 1. Route & Vehicle Options from Hotel to Visit Points for Each Day
  // -------------------------------------------------------------------------
  describe('Functionality 1: Daily Routes with Vehicle Options from Hotel to Locations', () => {
    it('calculates transit legs from hotel to visit points and back to hotel', () => {
      const routes = calculateDailyTransitRoutes({
        hotelName: 'Snow Valley Himalayan Hotel',
        destination: 'Manali',
        dayNumber: 1,
        morningLocation: 'Solang Valley Arena',
        afternoonLocation: 'Hadimba Wooden Temple',
        eveningLocation: 'Old Manali Bohemian Cafes'
      });

      expect(routes).toBeInstanceOf(Array);
      expect(routes.length).toBe(4);

      // Verify origin and destination points of each leg
      expect(routes[0].from).toBe('Snow Valley Himalayan Hotel');
      expect(routes[0].to).toBe('Solang Valley Arena');
      expect(routes[1].from).toBe('Solang Valley Arena');
      expect(routes[1].to).toBe('Hadimba Wooden Temple');
      expect(routes[2].from).toBe('Hadimba Wooden Temple');
      expect(routes[2].to).toBe('Old Manali Bohemian Cafes');
      expect(routes[3].to).toBe('Snow Valley Himalayan Hotel');
    });

    it('returns diverse vehicle options with duration, distance, fare, and route summaries', () => {
      const routes = calculateDailyTransitRoutes({
        hotelName: 'Snow Valley Himalayan Hotel',
        destination: 'Manali',
        dayNumber: 2,
        morningLocation: 'Jogini Waterfalls',
        afternoonLocation: 'Roerich Heritage Gallery',
        eveningLocation: 'Mall Road Square'
      });

      const leg1 = routes[0];
      expect(leg1.vehicleOptions.length).toBeGreaterThanOrEqual(4);

      const vehicleNames = leg1.vehicleOptions.map(v => v.vehicleType);
      expect(vehicleNames.some(v => v.includes('Cab') || v.includes('Taxi'))).toBe(true);
      expect(vehicleNames.some(v => v.includes('Auto') || v.includes('Tuk-Tuk') || v.includes('Jeep'))).toBe(true);
      expect(vehicleNames.some(v => v.includes('Shuttle') || v.includes('Bus'))).toBe(true);
      expect(vehicleNames.some(v => v.includes('Scooter') || v.includes('Two-Wheeler'))).toBe(true);

      // Each vehicle option has complete cost, duration, and route summary
      for (const veh of leg1.vehicleOptions) {
        expect(typeof veh.duration).toBe('string');
        expect(typeof veh.distanceKm).toBe('number');
        expect(typeof veh.estimatedFare).toBe('number');
        expect(veh.routeSummary).toBeDefined();
        expect(veh.routeSummary.length).toBeGreaterThan(5);
      }
    });

    it('integrates dailyTransitRoutes into each generated day in generateItinerary', () => {
      const itinerary = generateItinerary({
        origin: 'Delhi',
        destination: 'Manali',
        duration: 3,
        hotel: manaliData.accommodations[1]
      });

      expect(itinerary.days.length).toBe(3);
      for (const day of itinerary.days) {
        expect(day.dailyTransitRoutes).toBeDefined();
        expect(day.dailyTransitRoutes.length).toBe(4);
        expect(day.dailyTransitRoutes[0].from).toBe(manaliData.accommodations[1].name);
        expect(day.dailyTransitRoutes[0].vehicleOptions.length).toBeGreaterThanOrEqual(4);
      }
    });
  });

  // -------------------------------------------------------------------------
  // 2. 6-Hour Advance Weather Disruption Notification Tests
  // -------------------------------------------------------------------------
  describe('Functionality 2: 6-Hour Advance Weather Disruption Warning Verification', () => {
    it('verifies that weather disruption warning is issued 6 hours prior (leadTimeHours === 6)', () => {
      const itinerary = generateItinerary({
        origin: 'Delhi',
        destination: 'Manali',
        duration: 3,
        simulatedDisruption: {
          outdoorUnsuitable: true,
          reason: 'Severe blizzard & avalanche risk in upper Solang'
        }
      });

      expect(itinerary.simulatedDisruption).toBeDefined();
      expect(itinerary.simulatedDisruption.outdoorUnsuitable).toBe(true);
      // Strictly verify 6 hours advance lead time
      expect(itinerary.simulatedDisruption.leadTimeHours).toBe(6);
      expect(itinerary.simulatedDisruption.warningStatus).toBe('6H_ADVANCE_ALERT');
      expect(itinerary.simulatedDisruption.advanceNotice).toContain('6 hours before disruption onset');
    });

    it('verifies outdoor activities are pre-emptively rerouted 6 hours prior to disruption onset', () => {
      const itinerary = generateItinerary({
        origin: 'Delhi',
        destination: 'Manali',
        duration: 3,
        simulatedDisruption: {
          outdoorUnsuitable: true,
          reason: 'Torrential mountain rain and landslide warning'
        }
      });

      // Find an outdoor attraction in Day 1 or Day 2
      let checkedAnUnsuitableActivity = false;
      for (const day of itinerary.days) {
        for (const slot of ['morning', 'afternoon', 'evening']) {
          const act = day[slot];
          if (act.isOutdoor) {
            // Must have been flagged as unsuitable with 6 hours lead time
            expect(act.isUnsuitable).toBe(true);
            expect(act.leadTimeHours).toBe(6);
            expect(act.advanceNotice).toContain('6 hours before disruption onset');
            expect(act.unsuitabilityReason).toContain('6 hours in advance');

            // Must have a valid sheltered/indoor replacement
            expect(act.replacementActivity).toBeDefined();
            expect(act.replacementActivity.isOutdoor).toBe(false);
            expect(act.replacementActivity.leadTimeHours).toBe(6);
            expect(act.replacementActivity.reason).toContain('6-hour advance warning');
            checkedAnUnsuitableActivity = true;
          }
        }
      }

      expect(checkedAnUnsuitableActivity).toBe(true);
    });

    it('verifies sheltered/indoor activities are preserved without unsuitable flags', () => {
      const itinerary = generateItinerary({
        origin: 'Delhi',
        destination: 'Manali',
        duration: 3,
        simulatedDisruption: {
          outdoorUnsuitable: true,
          reason: 'Cold snap & blizzard warning'
        }
      });

      // Check indoor activities
      for (const day of itinerary.days) {
        for (const slot of ['morning', 'afternoon', 'evening']) {
          const act = day[slot];
          if (!act.isOutdoor) {
            expect(act.isUnsuitable).toBeFalsy();
            expect(act.replacementActivity).toBeUndefined();
          }
        }
      }
    });

    it('surfaces 6-hour advance alert in recovery proposal triggers, actionsTaken, and plan', () => {
      const proposal = generateRecoveryProposal(baseTrip, {
        simulatedDisruption: {
          outdoorUnsuitable: true,
          reason: 'Adverse weather warning'
        }
      });

      // Proposal must explicitly record the 6h advance notice
      expect(proposal.triggerReasons.some(r => r.includes('6h advance notice'))).toBe(true);
      expect(proposal.actionsTaken.some(a => a.includes('6 hours in advance'))).toBe(true);

      // Proposed itinerary must carry 6-hour advance metadata
      const proposedDisruption = proposal.proposedPlan.itinerary.simulatedDisruption;
      expect(proposedDisruption.leadTimeHours).toBe(6);
      expect(proposedDisruption.warningStatus).toBe('6H_ADVANCE_ALERT');
    });

    it('preserves 6-hour advance warning when generated via deterministic agentTools draft_recovery_proposal', () => {
      const proposal = draft_recovery_proposal({
        activeTrip: baseTrip,
        newDuration: 5,
        newBudget: 20000,
        selectedTransportId: manaliData.transportOptions[0].id,
        selectedAccommodationId: manaliData.accommodations[1].id,
        actionsTaken: ['Pre-emptively rerouted outdoor venues due to 6h advance blizzard alert.'],
        agentExplanation: 'Evaluated safe indoor venues 6 hours in advance of snowfall.',
        simulatedDisruption: {
          outdoorUnsuitable: true,
          reason: 'Himalayan blizzard alert'
        }
      });

      expect(proposal.proposedPlan.itinerary.simulatedDisruption.leadTimeHours).toBe(6);
      expect(proposal.proposedPlan.itinerary.simulatedDisruption.warningStatus).toBe('6H_ADVANCE_ALERT');
    });
  });

  // -------------------------------------------------------------------------
  // 3. Multi-Website Price Comparison & Exact Redirect Deep-Linking Tests
  // -------------------------------------------------------------------------
  describe('Functionality 3: Multi-Website Price Comparison & Exact Redirect Deep-Linking', () => {
    it('compares hotel prices across multiple booking platforms and identifies cheapest', () => {
      const hotel = manaliData.accommodations[1]; // Standard hotel ₹2400
      const comparison = compareHotelPrices(hotel, 'Manali', 'cheapest');

      expect(comparison.hotelName).toBe(hotel.name);
      expect(comparison.providers.length).toBe(HOTEL_BOOKING_PLATFORMS.length);
      expect(comparison.cheapestProvider).toBeDefined();

      const platformNames = comparison.providers.map(p => p.platformName);
      expect(platformNames).toContain('Agoda');
      expect(platformNames).toContain('Booking.com');
      expect(platformNames).toContain('MakeMyTrip');
      expect(platformNames).toContain('Google Hotels (Official)');

      // Verify sorted by cheapest price
      const prices = comparison.providers.map(p => p.totalPrice);
      for (let i = 0; i < prices.length - 1; i++) {
        expect(prices[i]).toBeLessThanOrEqual(prices[i + 1]);
      }
      expect(comparison.cheapestProvider.totalPrice).toBe(prices[0]);
    });

    it('generates exact hotel deep links on Booking.com without generic homepage or 404', () => {
      // Known curated hotel
      const knownHotel = manaliData.accommodations[1]; // Snow Valley
      const bookingUrlKnown = generateHotelRedirectUrl('booking', knownHotel, 'Manali');

      // Must direct-link to exact property page
      expect(bookingUrlKnown).toContain('booking.com/hotel/in/snow-valley-resorts.html');
      expect(bookingUrlKnown).not.toContain('/search?q='); // No broken search endpoint

      // Unknown dynamic hotel
      const unknownHotel = { id: 'custom-hotel-99', name: 'Pine Hill Vista Residency' };
      const bookingUrlDynamic = generateHotelRedirectUrl('booking', unknownHotel, 'Manali');

      // Must use valid searchresults.html with property name (never index page or 404)
      expect(bookingUrlDynamic).toContain('booking.com/searchresults.html?ss=');
      expect(bookingUrlDynamic).toContain('Pine%20Hill%20Vista%20Residency');
      expect(bookingUrlDynamic).not.toContain('/search?q=');
    });

    it('generates exact hotel deep links on Agoda without 404 or generic index page', () => {
      const knownHotel = manaliData.accommodations[1];
      const agodaUrl = generateHotelRedirectUrl('agoda', knownHotel, 'Manali');
      expect(agodaUrl).toContain('agoda.com/snow-valley-resorts/hotel/manali-in.html');

      const customHotel = { id: 'cust-1', name: 'Mountain Dew Lodge' };
      const customAgodaUrl = generateHotelRedirectUrl('agoda', customHotel, 'Manali');
      expect(customAgodaUrl).toContain('agoda.com/en-in/search?text=');
      expect(customAgodaUrl).toContain('Mountain%20Dew%20Lodge');
    });

    it('generates exact hotel search query on MakeMyTrip targeting specific property', () => {
      const hotel = manaliData.accommodations[1];
      const mmtUrl = generateHotelRedirectUrl('makemytrip', hotel, 'Manali');

      expect(mmtUrl).toContain('makemytrip.com/hotels/hotel-listing/');
      expect(mmtUrl).toContain('city=Manali');
      expect(mmtUrl).toContain('searchText=Snow%20Valley%20Himalayan%20Hotel');
      expect(mmtUrl).not.toContain('/search?q='); // Does not use broken naive search
    });

    it('prevents MakeMyTrip All Properties Filtered Out error for arbitrary destination hotels (e.g. Mussoorie)', () => {
      const arbitraryDestData = getDestinationData('Mussoorie');
      const hostel = arbitraryDestData.accommodations[0]; // "Travelers Hostel & Dorms in Mussoorie"
      const mmtUrl = generateHotelRedirectUrl('makemytrip', hostel, 'Mussoorie');

      // Must direct to the city hotels directory, not passing the fictional hotel name to searchText
      expect(mmtUrl).toBe('https://www.makemytrip.com/hotels/hotels-in-mussoorie.html');
      expect(mmtUrl).not.toContain('searchText=Travelers%20Hostel');

      // Google Hotels should query category in city
      const googleUrl = generateHotelRedirectUrl('google_hotels', hostel, 'Mussoorie');
      expect(googleUrl).toContain('google.com/travel/hotels?q=');
      expect(googleUrl).toContain('Hostel');
      expect(googleUrl).toContain('Mussoorie');
    });

    it('generates direct Google Hotels property card link with rate comparison across vendors', () => {
      const hotel = manaliData.accommodations[1];
      const googleUrl = generateHotelRedirectUrl('google_hotels', hotel, 'Manali');

      expect(googleUrl).toContain('google.com/travel/hotels?q=');
      expect(googleUrl).toContain('Snow%20Valley%20Himalayan%20Hotel');
      expect(googleUrl).toContain('Manali');
    });

    it('verifies all hotel providers carry exactHotelTargeted and deepLinkType flags', () => {
      const hotel = manaliData.accommodations[1];
      const comparison = compareHotelPrices(hotel, 'Manali', 'cheapest');

      for (const prov of comparison.providers) {
        expect(prov.exactHotelTargeted).toBe(true);
        expect(['direct_property_page', 'property_search_landing']).toContain(prov.deepLinkType);
        // Verify URL contains protocol and domain
        expect(prov.redirectUrl.startsWith('https://')).toBe(true);
        // Verify no broken naive search query
        expect(prov.redirectUrl).not.toContain('/search?q=');
      }
    });

    it('compares transport prices and verifies valid platform redirect URLs without 404s', () => {
      const busTransport = manaliData.transportOptions[0]; // Bus
      const comparison = compareTransportPrices(busTransport, 'Manali', 'cheapest', 'Delhi');

      expect(comparison.transportName).toBe(busTransport.name);
      expect(comparison.providers.length).toBe(TRANSPORT_BOOKING_PLATFORMS.Bus.length);

      // Verify no provider contains broken /booking?route= which caused 404
      for (const prov of comparison.providers) {
        expect(prov.redirectUrl).not.toContain('/booking?route=');
        expect(prov.redirectUrl.startsWith('https://')).toBe(true);
      }

      // Check redBus valid path
      const redBus = comparison.providers.find(p => p.platformId === 'redbus');
      expect(redBus.redirectUrl).toBe('https://www.redbus.in/bus-tickets/delhi-to-manali');

      // Check MakeMyTrip Bus valid path
      const mmtBus = comparison.providers.find(p => p.platformId === 'makemytrip_bus');
      expect(mmtBus.redirectUrl).toBe('https://www.makemytrip.com/bus-tickets/delhi-manali-bus-tickets.html');

      // Check AbhiBus valid path
      const abhiBus = comparison.providers.find(p => p.platformId === 'abhibus');
      expect(abhiBus.redirectUrl).toBe('https://www.abhibus.com/buses/delhi-to-manali');

      // Check ZingBus valid path on served corridor
      const zingBus = comparison.providers.find(p => p.platformId === 'zingbus');
      expect(zingBus.redirectUrl).toBe('https://www.zingbus.com/bus-tickets/delhi-to-manali-bus-ticket-booking');
    });

    it('prevents ZingBus 404 error on unsupported routes (e.g. Delhi to Mussoorie) by falling back to official portal', () => {
      const busTransport = { name: 'Regional Bus', type: 'Bus' };
      const comparison = compareTransportPrices(busTransport, 'Mussoorie', 'cheapest', 'Delhi');
      const zingBus = comparison.providers.find(p => p.platformId === 'zingbus');

      // Must safely fallback to portal home instead of generating a 404 route URL
      expect(zingBus.redirectUrl).toBe('https://www.zingbus.com/');
    });

    it('verifies train, cab, and flight redirect URLs avoid 404 endpoints', () => {
      // Train
      const train = manaliData.transportOptions[1];
      const trainComp = compareTransportPrices(train, 'Manali', 'cheapest', 'Delhi');
      const irctc = trainComp.providers.find(p => p.platformId === 'irctc');
      expect(irctc.redirectUrl).toBe('https://www.irctc.co.in/nget/train-search');

      const confirmTkt = trainComp.providers.find(p => p.platformId === 'confirmtkt');
      expect(confirmTkt.redirectUrl).toContain('confirmtkt.com/rbooking/trains?from=Delhi&to=Manali');

      // Flights
      const flight = manaliData.transportOptions[3];
      const flightComp = compareTransportPrices(flight, 'Manali', 'cheapest', 'Delhi');
      const gFlights = flightComp.providers.find(p => p.platformId === 'google_flights');

      // Must be a valid google.com/travel/flights URL with query parameters, avoiding www.google.com/travel/flights domain bug
      expect(gFlights.redirectUrl).toContain('https://www.google.com/travel/flights?q=Flights%20from%20Delhi%20to%20Manali');
      expect(gFlights.redirectUrl).not.toContain('/booking?route=');
    });

    it('respects freeCancellation priority for hotel booking comparisons', () => {
      const hotel = manaliData.accommodations[0];
      const comparison = compareHotelPrices(hotel, 'Manali', 'freeCancellation');

      // First provider must offer free cancellation
      expect(comparison.providers[0].freeCancellation).toBe(true);
    });

    it('executeBookingRedirect safely prepares and executes redirect to cheaper provider', () => {
      const hotel = manaliData.accommodations[1];
      const comparison = compareHotelPrices(hotel, 'Manali', 'cheapest');
      const cheapest = comparison.cheapestProvider;

      let callbackCalled = false;
      const result = executeBookingRedirect(cheapest, () => {
        callbackCalled = true;
      });

      expect(callbackCalled).toBe(true);
      expect(result.success).toBe(true);
      expect(result.redirectedTo).toBe(cheapest.platformName);
      expect(result.url).toBe(cheapest.redirectUrl);
      expect(result.url).not.toContain('/search?q=');
    });
  });
});
