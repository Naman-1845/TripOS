// Curated destination database with realistic estimates + dynamic generator for arbitrary locations

export const CURATED_DESTINATIONS = {
  manali: {
    name: 'Manali',
    state: 'Himachal Pradesh',
    country: 'India',
    tagline: 'High-altitude Himalayan resort town with snow peaks and pine valleys',
    bestTime: 'October to June',
    currency: 'INR (₹)',
    isSampleEstimate: true,
    transportOptions: [
      { id: 'bus-volvo', name: 'Overnight Volvo AC Semi-Sleeper Bus', type: 'Bus', costPerPerson: 1200, duration: '12-14 hrs', description: 'Scenic hill route via Chandigarh & Mandi' },
      { id: 'train-toy', name: 'Train to Chandigarh + Shared Cab', type: 'Train', costPerPerson: 1800, duration: '11 hrs', description: 'Shatabdi to Chandigarh then scenic road drive' },
      { id: 'cab-private', name: 'Private Dedicated SUV / Cab', type: 'Cab', flatCost: 9500, duration: '11 hrs', description: 'Direct doorstep pickup, ideal for groups' },
      { id: 'flight-bhuntar', name: 'Flight to Kullu-Bhuntar Airport (KUU)', type: 'Flight', costPerPerson: 6500, duration: '1.5 hrs flight + 1 hr cab', description: 'Quickest route, subject to mountain weather' }
    ],
    accommodations: [
      { id: 'acc-hostel', name: 'Zostel / Backpacker Riverside Hostel', type: 'Hostel', costPerNight: 750, rating: 4.6, amenities: ['Free WiFi', 'Community Cafe', 'Bonfire'] },
      { id: 'acc-standard', name: 'Snow Valley Himalayan Hotel', type: 'Standard', costPerNight: 2400, rating: 4.3, amenities: ['Mountain View Balcony', 'Breakfast', 'Heating'] },
      { id: 'acc-luxury', name: 'The Himalayan Luxury Castle & Resort', type: 'Luxury', costPerNight: 6800, rating: 4.8, amenities: ['Thermal Pool', 'Spa', 'Fine Dining', 'Fireplace'] }
    ],
    attractions: [
      { id: 'act-solang', name: 'Solang Valley Snow & Adventure Arena', category: 'Adventure', isOutdoor: true, costPerPerson: 1500, duration: 'Half Day', description: 'Zorbing, quad biking, paragliding and snow fields.' },
      { id: 'act-hadimba', name: 'Hadimba Wooden Temple & Dhungri Forest', category: 'Culture', isOutdoor: true, costPerPerson: 50, duration: '2 hours', description: 'Ancient 1553 pagoda temple nestled among towering deodars.' },
      { id: 'act-jogini', name: 'Jogini Waterfalls & Vashisht Village Trek', category: 'Nature', isOutdoor: true, costPerPerson: 200, duration: '3 hours', description: 'Gentle trek to cascading natural falls with valley views.' },
      { id: 'act-old-manali', name: 'Old Manali Bohemian Cafes & Live Music', category: 'Relaxation', isOutdoor: false, costPerPerson: 400, duration: 'Evening', description: 'Cozy indoor timber cafes, acoustic music, and riverside apple orchards.' },
      { id: 'act-monastery', name: 'Himalayan Nyin-Gma Buddhist Cultural Monastery', category: 'Culture', isOutdoor: false, costPerPerson: 50, duration: '2 hours', description: 'Peaceful prayer hall with indoor thangka art murals and serene courtyard.' },
      { id: 'act-naggar-castle', name: 'Naggar Castle & Roerich Heritage Art Gallery', category: 'Culture', isOutdoor: false, costPerPerson: 150, duration: '3 hours', description: 'Indoor heritage timber-stone castle exhibiting Himalayan oil paintings.' },
      { id: 'act-vashisht-springs', name: 'Vashisht Natural Sulphur Hot Springs', category: 'Relaxation', isOutdoor: false, costPerPerson: 100, duration: '2 hours', description: 'Enclosed sacred thermal mineral baths known for therapeutic warmth.' }
    ],
    restaurants: [
      { name: 'Cafe 1947', cuisine: 'Italian & Continental', avgCostPerPerson: 650, note: 'Riverside dining by the Manalsu river' },
      { name: 'Johnson’s Cafe & Bar', cuisine: 'Local Trout & Woodfired Pizza', avgCostPerPerson: 750, note: 'Legendary baked fresh Himalayan trout' },
      { name: 'Himalayan Dhaba (Mall Road)', cuisine: 'Authentic Himachali Dham & Siddu', avgCostPerPerson: 250, note: 'Steamed wheat cakes filled with walnut & poppy seeds' }
    ]
  },
  delhi: {
    name: 'Delhi',
    state: 'Delhi NCR',
    country: 'India',
    tagline: 'Historic Mughal capital and bustling modern metropolis',
    bestTime: 'October to March',
    currency: 'INR (₹)',
    isSampleEstimate: true,
    transportOptions: [
      { id: 'metro-delhi', name: 'Delhi Metro Express & City Network', type: 'Train', costPerPerson: 150, duration: 'Varies', description: 'Fast, air-conditioned metro' },
      { id: 'cab-ola-uber', name: 'App Cab / Local City Taxi', type: 'Cab', flatCost: 1500, duration: 'Full Day', description: 'Convenient AC rides across Delhi NCR' },
      { id: 'bus-dtc', name: 'DTC Low-Floor Electric City Bus', type: 'Bus', costPerPerson: 60, duration: 'Full Day', description: 'Budget local transit' },
      { id: 'flight-delhi', name: 'IGI International Airport Connection', type: 'Flight', costPerPerson: 4500, duration: '2 hrs', description: 'Major global transport hub' }
    ],
    accommodations: [
      { id: 'del-hostel', name: 'goStops Delhi / Zostel South Delhi', type: 'Hostel', costPerNight: 800, rating: 4.5, amenities: ['WiFi', 'Rooftop Lounge', 'Walking Tours'] },
      { id: 'del-standard', name: 'Bloomrooms @ Janpath / Connaught Place', type: 'Standard', costPerNight: 2800, rating: 4.4, amenities: ['Central AC', 'Breakfast Buffet', 'Workspace'] },
      { id: 'del-luxury', name: 'The Imperial / Taj Palace New Delhi', type: 'Luxury', costPerNight: 9500, rating: 4.9, amenities: ['Heritage Suites', 'Swimming Pool', 'Michelin-style Dining'] }
    ],
    attractions: [
      { id: 'del-qutub', name: 'Qutub Minar & Mehrauli Archaeological Complex', category: 'Culture', isOutdoor: true, costPerPerson: 50, duration: '2 hours', description: 'UNESCO World Heritage 73m brick minaret and sandstone pillars.' },
      { id: 'del-humayun', name: 'Humayun’s Tomb & Sunder Nursery Gardens', category: 'Nature', isOutdoor: true, costPerPerson: 80, duration: '3 hours', description: 'Persian-style Mughal garden tomb and sprawling botanical sanctuary.' },
      { id: 'del-museum', name: 'National Museum of India (Janpath)', category: 'Culture', isOutdoor: false, costPerPerson: 100, duration: '3 hours', description: 'World-renowned air-conditioned exhibits covering 5,000 years of civilization.' },
      { id: 'del-chandni', name: 'Chandni Chowk Old Delhi Street Food Walk', category: 'Food', isOutdoor: true, costPerPerson: 350, duration: 'Evening', description: 'Paranthe Wali Gali, spice markets, and jalebi shops.' },
      { id: 'del-crafts', name: 'National Crafts Museum & Indoor Artisan Pavilion', category: 'Culture', isOutdoor: false, costPerPerson: 60, duration: '2.5 hours', description: 'Indian handicraft history with sheltered courtyards and cafe Lota.' }
    ],
    restaurants: [
      { name: 'Karim’s (Jama Masjid)', cuisine: 'Mughlai & Kebabs', avgCostPerPerson: 500, note: 'Legendary mutton burra and seekh kebabs since 1913' },
      { name: 'Cafe Lota (Pragati Maidan)', cuisine: 'Contemporary Indian Regional', avgCostPerPerson: 700, note: 'Palak patta chaat and regional artisanal platters' },
      { name: 'Saravana Bhavan (CP)', cuisine: 'South Indian Vegetarian', avgCostPerPerson: 300, note: 'Authentic ghee roast dosas and filter coffee' }
    ]
  },
  goa: {
    name: 'Goa',
    state: 'Goa',
    country: 'India',
    tagline: 'Sun-drenched golden beaches, Portuguese heritage, and seafood',
    bestTime: 'November to February',
    currency: 'INR (₹)',
    isSampleEstimate: true,
    transportOptions: [
      { id: 'goa-train', name: 'Konkan Railway Express', type: 'Train', costPerPerson: 900, duration: 'Overnight', description: 'Scenic Western Ghats railway route' },
      { id: 'goa-bus', name: 'Interstate AC Sleeper Bus', type: 'Bus', costPerPerson: 1100, duration: '12 hrs', description: 'Comfortable sleeper coach' },
      { id: 'goa-scooter', name: 'Self-Drive Scooter / Car Rental', type: 'Cab', flatCost: 1800, duration: 'Daily', description: 'Freedom to explore North and South Goa' },
      { id: 'goa-flight', name: 'Direct Flight to Dabolim / Mopa (GOI/GOX)', type: 'Flight', costPerPerson: 5200, duration: '1-2 hrs', description: 'Direct flight from major metros' }
    ],
    accommodations: [
      { id: 'goa-hostel', name: 'The Hosteller / Woke Hostel Vagator', type: 'Hostel', costPerNight: 900, rating: 4.6, amenities: ['Pool', 'Co-working', 'Beach Shuttle'] },
      { id: 'goa-standard', name: 'Santana Beach Resort Candolim', type: 'Standard', costPerNight: 3200, rating: 4.4, amenities: ['Pool', 'Beach Access', 'Free Breakfast'] },
      { id: 'goa-luxury', name: 'Taj Fort Aguada Resort & Spa', type: 'Luxury', costPerNight: 11000, rating: 4.9, amenities: ['Cliffside Ocean View', 'Spa', 'Private Beach'] }
    ],
    attractions: [
      { id: 'goa-beach', name: 'Anjuna & Vagator Sunset Beach Crawl', category: 'Nature', isOutdoor: true, costPerPerson: 100, duration: 'Evening', description: 'Red cliff vistas, gentle sea breeze, and shoreline shacks.' },
      { id: 'goa-churches', name: 'Old Goa Basilica of Bom Jesus & Se Cathedral', category: 'Culture', isOutdoor: false, costPerPerson: 50, duration: '2 hours', description: 'UNESCO 16th-century Portuguese baroque architecture.' },
      { id: 'goa-scuba', name: 'Grande Island Scuba & Snorkel Excursion', category: 'Adventure', isOutdoor: true, costPerPerson: 2200, duration: 'Half Day', description: 'Coral reef diving and boat cruise.' },
      { id: 'goa-spice', name: 'Sahakari Indoor-Sheltered Spice Plantation Tour', category: 'Food', isOutdoor: false, costPerPerson: 500, duration: '3 hours', description: 'Covered herbal garden tour with authentic Goan buffet lunch.' }
    ],
    restaurants: [
      { name: 'Fisherman’s Wharf', cuisine: 'Goan Coastal & Seafood', avgCostPerPerson: 800, note: 'Kingfish recheado and prawn balchao by the water' },
      { name: 'Gunpowder (Assagao)', cuisine: 'South Indian Coastal Cuisine', avgCostPerPerson: 750, note: 'Pork ribs and appams in a leafy heritage courtyard' },
      { name: 'Vinayak Family Restaurant', cuisine: 'Local Goan Fish Thali', avgCostPerPerson: 300, note: 'Beloved budget-friendly local fresh catch' }
    ]
  },
  jaipur: {
    name: 'Jaipur',
    state: 'Rajasthan',
    country: 'India',
    tagline: 'The Pink City of grand Rajput palaces, forts, and bazaars',
    bestTime: 'October to March',
    currency: 'INR (₹)',
    isSampleEstimate: true,
    transportOptions: [
      { id: 'jpr-train', name: 'Vande Bharat / Shatabdi Express', type: 'Train', costPerPerson: 750, duration: '3.5 hrs', description: 'High-speed rail connectivity from Delhi' },
      { id: 'jpr-bus', name: 'RSRTC Volvo Super Deluxe', type: 'Bus', costPerPerson: 550, duration: '5 hrs', description: 'Frequent highway departures' },
      { id: 'jpr-cab', name: 'Private Sedan / Highway Cab', type: 'Cab', flatCost: 3500, duration: '4.5 hrs', description: 'Smooth journey on Delhi-Mumbai Expressway' },
      { id: 'jpr-flight', name: 'Direct Flight to Jaipur International (JAI)', type: 'Flight', costPerPerson: 3800, duration: '1 hr', description: 'Fast flight to Sanganer Airport' }
    ],
    accommodations: [
      { id: 'jpr-hostel', name: 'Moustache Hostel Jaipur', type: 'Hostel', costPerNight: 700, rating: 4.5, amenities: ['Rooftop Pool', 'Cafe', 'Puppet Shows'] },
      { id: 'jpr-standard', name: 'Alsisar Haveli Heritage Hotel', type: 'Standard', costPerNight: 2900, rating: 4.4, amenities: ['Heritage Courtyard', 'Pool', 'Breakfast'] },
      { id: 'jpr-luxury', name: 'Rambagh Palace / Jai Mahal Palace', type: 'Luxury', costPerNight: 12500, rating: 4.9, amenities: ['Royal Suites', 'Butler Service', 'Historic Gardens'] }
    ],
    attractions: [
      { id: 'jpr-amber', name: 'Amber Fort & Maota Lake Panorama', category: 'Culture', isOutdoor: true, costPerPerson: 100, duration: '3 hours', description: 'Magnificent hillside fortress with mirror palace (Sheesh Mahal).' },
      { id: 'jpr-citypalace', name: 'City Palace Museum & Chandra Mahal', category: 'Culture', isOutdoor: false, costPerPerson: 200, duration: '2.5 hours', description: 'Royal museum displaying textiles, armory, and Rajput court art.' },
      { id: 'jpr-nahargarh', name: 'Nahargarh Fort Sunset Viewpoint', category: 'Nature', isOutdoor: true, costPerPerson: 50, duration: '2 hours', description: 'Panoramic aerial view of the Pink City skyline.' },
      { id: 'jpr-jantar', name: 'Jantar Mantar Astronomical Observatory', category: 'Culture', isOutdoor: true, costPerPerson: 80, duration: '1.5 hours', description: 'World largest stone astronomical instruments.' }
    ],
    restaurants: [
      { name: '1135 AD (Amber Fort)', cuisine: 'Royal Rajasthani Fine Dining', avgCostPerPerson: 1200, note: 'Lal maas served in gilded silver palace halls' },
      { name: 'Laxmi Mishthan Bhandar (LMB)', cuisine: 'Rajasthani Thali & Sweets', avgCostPerPerson: 450, note: 'Famous Dal Baati Churma and Ghewar in Johari Bazaar' },
      { name: 'Tapri Central', cuisine: 'Modern Chai & Snacks', avgCostPerPerson: 250, note: 'Rooftop cafe overlooking Central Park' }
    ]
  }
};

/**
 * Gracefully generates estimates for any arbitrary destination not in our curated dataset.
 * Labeled clearly as automated heuristic estimates.
 */
export function getDestinationData(rawDestinationName) {
  if (!rawDestinationName) return null;
  const key = rawDestinationName.trim().toLowerCase();

  if (CURATED_DESTINATIONS[key]) {
    return {
      ...CURATED_DESTINATIONS[key],
      isCurated: true,
      dataSourceNotice: 'Curated sample travel dataset (Realistic estimates)'
    };
  }

  const cleanName = rawDestinationName.trim();
  const titleCaseName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);

  // Return a graceful, realistic model for arbitrary user-entered locations
  return {
    name: titleCaseName,
    state: 'Regional Province',
    country: 'Travel Destination',
    tagline: `Custom exploration of ${titleCaseName} tailored to your itinerary`,
    bestTime: 'Spring & Autumn (Recommended)',
    currency: 'INR (₹)',
    isSampleEstimate: true,
    isCurated: false,
    dataSourceNotice: 'Heuristic travel estimate (Arbitrary destination fallback - not cached)',
    transportOptions: [
      { id: `bus-${cleanName}`, name: `Regional Express / Sleeper Bus to ${titleCaseName}`, type: 'Bus', costPerPerson: 1000, duration: 'Estimated 8-10 hrs', description: 'Standard regional intercity highway connection' },
      { id: `train-${cleanName}`, name: `Express Train to Nearest Railhead (${titleCaseName})`, type: 'Train', costPerPerson: 1200, duration: 'Estimated 7-9 hrs', description: 'Reserved train transit' },
      { id: `cab-${cleanName}`, name: `Dedicated Private Cab / Outstation Taxi`, type: 'Cab', flatCost: 6500, duration: 'Flexible', description: 'Door-to-door private road vehicle' },
      { id: `flight-${cleanName}`, name: `Connecting Domestic Flight to Nearest Airport`, type: 'Flight', costPerPerson: 5500, duration: 'Estimated 2 hrs', description: 'Aerial connection' }
    ],
    accommodations: [
      { id: `acc-hostel-${cleanName}`, name: `Travelers Hostel & Dorms in ${titleCaseName}`, type: 'Hostel', costPerNight: 800, rating: 4.2, amenities: ['Free WiFi', 'Locker', 'Shared Lounge'] },
      { id: `acc-std-${cleanName}`, name: `Comfort Grand Hotel ${titleCaseName}`, type: 'Standard', costPerNight: 2600, rating: 4.3, amenities: ['Attached Bathroom', 'Breakfast', 'Room Service'] },
      { id: `acc-lux-${cleanName}`, name: `Premium Boutique Resort ${titleCaseName}`, type: 'Luxury', costPerNight: 7200, rating: 4.7, amenities: ['Pool', 'Spa', 'Fine Dining', 'Scenic View'] }
    ],
    attractions: [
      { id: `act-high-${cleanName}`, name: `${titleCaseName} Central Landmark & Heritage Walk`, category: 'Culture', isOutdoor: true, costPerPerson: 150, duration: '2.5 hours', description: `Historic center and architectural highlights of ${titleCaseName}.` },
      { id: `act-view-${cleanName}`, name: `${titleCaseName} Valley / Scenic Panoramic Viewpoint`, category: 'Nature', isOutdoor: true, costPerPerson: 100, duration: '3 hours', description: `Picturesque scenic overview of the surrounding landscape.` },
      { id: `act-museum-${cleanName}`, name: `${titleCaseName} Regional Cultural Arts Museum`, category: 'Culture', isOutdoor: false, costPerPerson: 120, duration: '2 hours', description: `Indoor sheltered exhibits detailing the traditions and history of ${titleCaseName}.` },
      { id: `act-market-${cleanName}`, name: `Old Town Local Bazaar & Artisan Emporium`, category: 'Shopping', isOutdoor: false, costPerPerson: 200, duration: 'Evening', description: `Sheltered market arcades offering regional handicrafts and souvenirs.` },
      { id: `act-adventure-${cleanName}`, name: `Regional Countryside Trek & Nature Trail`, category: 'Adventure', isOutdoor: true, costPerPerson: 350, duration: 'Half Day', description: `Outdoor trail exploring the natural flora and topography.` }
    ],
    restaurants: [
      { name: `Traditional Flavors of ${titleCaseName}`, cuisine: 'Regional Speciality', avgCostPerPerson: 400, note: `Popular authentic hometown dishes` },
      { name: `The Garden Terrace ${titleCaseName}`, cuisine: 'Multi-Cuisine & Cafe', avgCostPerPerson: 650, note: `Comfortable indoor dining with local staples` },
      { name: `Heritage Royal Kitchen`, cuisine: 'Fine Regional Dining', avgCostPerPerson: 900, note: `Traditional delicacies and desserts` }
    ]
  };
}

