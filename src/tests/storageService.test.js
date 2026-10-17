import { describe, it, expect, beforeEach } from 'vitest';
import { StorageService } from '../services/storageService.js';

// Ensure in-memory localStorage mock for node environment
const memoryStore = {};
global.localStorage = {
  getItem: (key) => memoryStore[key] || null,
  setItem: (key, val) => { memoryStore[key] = String(val); },
  removeItem: (key) => { delete memoryStore[key]; },
  clear: () => {
    Object.keys(memoryStore).forEach(k => delete memoryStore[k]);
  }
};

describe('Storage Service Persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('saves and retrieves trips without accidental overwriting', () => {
    const trip1 = { id: 'trip_1', name: 'Delhi to Manali', inputs: { budget: 20000 } };
    const trip2 = { id: 'trip_2', name: 'Mumbai to Goa', inputs: { budget: 35000 } };

    StorageService.saveTrip(trip1);
    StorageService.saveTrip(trip2);

    const saved = StorageService.getSavedTrips();
    expect(saved.length).toBe(2);

    const fetched1 = StorageService.getTripById('trip_1');
    const fetched2 = StorageService.getTripById('trip_2');

    expect(fetched1.name).toBe('Delhi to Manali');
    expect(fetched2.name).toBe('Mumbai to Goa');
  });

  it('updates an existing trip by ID without duplicating it', () => {
    const trip1 = { id: 'trip_1', name: 'Initial Trip', inputs: { budget: 20000 } };
    StorageService.saveTrip(trip1);

    const updatedTrip1 = { id: 'trip_1', name: 'Updated Trip Name', inputs: { budget: 16000 } };
    StorageService.saveTrip(updatedTrip1);

    const saved = StorageService.getSavedTrips();
    expect(saved.length).toBe(1);
    expect(saved[0].name).toBe('Updated Trip Name');
    expect(saved[0].inputs.budget).toBe(16000);
  });

  it('stores and tracks recovery audit history log', () => {
    const log1 = { id: 'log_1', action: 'APPROVED', costImpact: { difference: -4000 } };
    const log2 = { id: 'log_2', action: 'REJECTED', note: 'Preserved original' };

    StorageService.addRecoveryHistoryEntry(log1);
    StorageService.addRecoveryHistoryEntry(log2);

    const history = StorageService.getRecoveryHistory();
    expect(history.length).toBe(2);
    expect(history[0].id).toBe('log_2'); // Most recent first
    expect(history[1].id).toBe('log_1');
  });
});

