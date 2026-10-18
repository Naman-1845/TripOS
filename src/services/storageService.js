/**
 * Storage Service for TripOS
 * Safely manages LocalStorage persistence for trips, active sessions, and recovery audit history.
 */

const STORAGE_KEYS = {
  SAVED_TRIPS: 'tripos_saved_trips_v1',
  ACTIVE_TRIP_ID: 'tripos_active_trip_id_v1',
  RECOVERY_HISTORY: 'tripos_recovery_history_v1',
  MIGRATION_CLEAN_DEMO_SEED: 'tripos_clean_demo_seed_v2'
};

/**
 * Safely parse JSON from storage
 */
function safeGet(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (err) {
    console.warn(`[TripOS Storage] Error reading key "${key}":`, err);
    return fallback;
  }
}

/**
 * Safely set JSON in storage
 */
function safeSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    console.error(`[TripOS Storage] Error writing key "${key}":`, err);
    return false;
  }
}

export const StorageService = {
  /**
   * Returns array of all saved trips
   */
  getSavedTrips() {
    const data = safeGet(STORAGE_KEYS.SAVED_TRIPS, []);
    return Array.isArray(data) ? data : [];
  },

  /**
   * Saves or updates a trip in the saved trips collection.
   * Ensures trips do not overwrite each other by checking trip.id.
   * Throws an error if storage persistence fails.
   */
  saveTrip(trip) {
    if (!trip || !trip.id || !trip.inputs) {
      throw new Error('Trip must have a valid unique ID and inputs to be saved.');
    }
    const trips = this.getSavedTrips();
    const existingIndex = trips.findIndex(t => t.id === trip.id);

    const tripToSave = {
      ...trip,
      savedAt: trip.savedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    let updatedList;
    if (existingIndex >= 0) {
      updatedList = [...trips];
      updatedList[existingIndex] = tripToSave;
    } else {
      updatedList = [tripToSave, ...trips];
    }

    const saved = safeSet(STORAGE_KEYS.SAVED_TRIPS, updatedList);
    if (!saved) {
      throw new Error('Failed to persist trip to browser storage.');
    }
    safeSet(STORAGE_KEYS.ACTIVE_TRIP_ID, trip.id);
    return tripToSave;
  },

  /**
   * Retrieves a single trip by ID
   */
  getTripById(id) {
    const trips = this.getSavedTrips();
    return trips.find(t => t.id === id) || null;
  },

  /**
   * Deletes a trip by ID
   */
  deleteTrip(id) {
    const trips = this.getSavedTrips();
    const filtered = trips.filter(t => t.id !== id);
    safeSet(STORAGE_KEYS.SAVED_TRIPS, filtered);

    const activeId = safeGet(STORAGE_KEYS.ACTIVE_TRIP_ID);
    if (activeId === id) {
      safeSet(STORAGE_KEYS.ACTIVE_TRIP_ID, filtered[0]?.id || null);
    }
    return filtered;
  },

  /**
   * Gets ID of the currently active trip
   */
  getActiveTripId() {
    return safeGet(STORAGE_KEYS.ACTIVE_TRIP_ID, null);
  },

  /**
   * Sets ID of the currently active trip
   */
  setActiveTripId(id) {
    safeSet(STORAGE_KEYS.ACTIVE_TRIP_ID, id);
  },

  /**
   * Returns full recovery audit log history
   */
  getRecoveryHistory() {
    const data = safeGet(STORAGE_KEYS.RECOVERY_HISTORY, []);
    return Array.isArray(data) ? data : [];
  },

  /**
   * Appends an entry to recovery history.
   * Prevents duplicate or contradictory audit entries for the same proposal.
   */
  addRecoveryHistoryEntry(entry) {
    if (!entry || !entry.id) return this.getRecoveryHistory();
    const history = this.getRecoveryHistory();

    // Check for existing log with same ID or same proposalId
    const existing = history.find(e =>
      e.id === entry.id || (e.proposalId && entry.proposalId && e.proposalId === entry.proposalId)
    );

    if (existing) {
      if (existing.action !== entry.action) {
        console.warn(`[TripOS Storage] Contradictory audit log for proposal ${entry.proposalId}: already ${existing.action}, attempted ${entry.action}. Ignored.`);
      }
      // Deduplicate: do not add duplicate entry
      return history;
    }

    const updated = [entry, ...history].slice(0, 50); // keep recent 50 logs
    const saved = safeSet(STORAGE_KEYS.RECOVERY_HISTORY, updated);
    if (!saved) {
      console.warn('[TripOS Storage] Failed to persist recovery history.');
    }
    return updated;
  },

  /**
   * Clears recovery history
   */
  clearRecoveryHistory() {
    safeSet(STORAGE_KEYS.RECOVERY_HISTORY, []);
  }
};

