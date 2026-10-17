import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar.jsx';
import TripPlannerForm from './components/TripPlannerForm.jsx';
import BudgetManager from './components/BudgetManager.jsx';
import ItineraryView from './components/ItineraryView.jsx';
import Recommendations from './components/Recommendations.jsx';
import RecoveryModal from './components/RecoveryModal.jsx';
import DisruptionSimulator from './components/DisruptionSimulator.jsx';
import SavedTripsDrawer from './components/SavedTripsDrawer.jsx';
import TripChangeForm from './components/TripChangeForm.jsx';

import { DEMO_SCENARIOS } from './data/defaultScenarios.js';
import { getDestinationData } from './data/destinationsData.js';
import { calculateBudgetBreakdown } from './services/budgetEngine.js';
import { generateItinerary } from './services/itineraryEngine.js';
import {
  generateRecoveryProposal,
  applyProposal,
  rejectProposal,
  isProposalStale
} from './services/recoveryEngine.js';
import { StorageService } from './services/storageService.js';
import { Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';

export default function App() {
  // 1. Core Form State (initialized to Scenario A by default)
  const [formData, setFormData] = useState(DEMO_SCENARIOS.scenarioA.inputs);

  // 2. Active Trip State
  const [activeTrip, setActiveTrip] = useState(null);

  // 3. Recovery Engine State
  const [pendingProposal, setPendingProposal] = useState(null);

  // 4. Persistence & UI State
  const [savedTrips, setSavedTrips] = useState([]);
  const [recoveryHistory, setRecoveryHistory] = useState([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState('saved');
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (text, type = 'info') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // On initial mount: load saved trips, history, and active trip
  useEffect(() => {
    const trips = StorageService.getSavedTrips();
    const history = StorageService.getRecoveryHistory();
    setSavedTrips(trips);
    setRecoveryHistory(history);

    const activeId = StorageService.getActiveTripId();
    if (activeId) {
      const found = trips.find(t => t.id === activeId);
      if (found) {
        setActiveTrip(found);
        setFormData(found.inputs);
        return;
      }
    }

    // Default initialization: generate Scenario A initial active trip automatically
    createAndActivateTrip(DEMO_SCENARIOS.scenarioA.inputs, false);
  }, []);

  // Pure trip generation helper
  const buildTripObject = (inputs, disruption = null) => {
    const destData = getDestinationData(inputs.destination);

    const transport = destData?.transportOptions?.find(
      t => t.type.toLowerCase() === inputs.transportPreference?.toLowerCase()
    ) || destData?.transportOptions?.[0];

    const accommodation = destData?.accommodations?.find(
      a => a.type.toLowerCase() === inputs.accommodationPreference?.toLowerCase()
    ) || destData?.accommodations?.[0];

    const itinerary = generateItinerary({
      origin: inputs.origin,
      destination: inputs.destination,
      startDate: inputs.startDate,
      duration: inputs.duration,
      interests: inputs.interests,
      simulatedDisruption: disruption
    });

    const budgetBreakdown = calculateBudgetBreakdown({
      budget: inputs.budget,
      travellers: inputs.travellers,
      duration: inputs.duration,
      selectedTransport: transport,
      selectedAccommodation: accommodation,
      plannedActivities: itinerary.allPlannedActivities
    });

    return {
      id: `trip_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: `${inputs.origin} to ${inputs.destination} (${inputs.duration}d)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      inputs: { ...inputs },
      selectedTransport: transport,
      selectedAccommodation: accommodation,
      itinerary,
      budgetBreakdown,
      simulatedDisruption: disruption
    };
  };

  // Creates and sets active trip
  const createAndActivateTrip = (inputs, notify = true) => {
    const newTrip = buildTripObject(inputs, null);
    setActiveTrip(newTrip);
    setFormData(inputs);
    setPendingProposal(null);

    // Save to storage
    StorageService.saveTrip(newTrip);
    setSavedTrips(StorageService.getSavedTrips());

    if (notify) {
      showToast(`Generated comprehensive travel plan for ${inputs.destination}!`, 'success');
    }
  };

  // Handle Form Submit (When user clicks Generate / Update)
  const handleFormSubmit = () => {
    createAndActivateTrip(formData);
  };

  // Recovery Engine: Evaluate changes when active trip exists
  const handleTriggerRecovery = (overrides = {}) => {
    if (!activeTrip) {
      createAndActivateTrip(formData);
      return;
    }

    const proposedInputs = {
      ...formData,
      ...overrides
    };

    const proposal = generateRecoveryProposal(activeTrip, proposedInputs);
    setPendingProposal(proposal);
  };

  // Handle mid-trip changes submitted from TripChangeForm ("Update Trip Due to Changes")
  const handleApplyTripChanges = ({ durationDelta, budgetDelta, userReason, resultingDuration, resultingBudget }) => {
    if (!activeTrip) return;

    // Generate proposal from updated duration and budget
    const proposal = generateRecoveryProposal(activeTrip, {
      duration: resultingDuration,
      budget: resultingBudget,
      userReason: userReason || undefined
    });

    // Update formData to match proposed inputs so preview and stale checks remain synchronized
    setFormData(prev => ({
      ...prev,
      duration: resultingDuration,
      budget: resultingBudget
    }));

    setPendingProposal(proposal);
  };

  // Proposal Action: APPROVE
  const handleApproveProposal = () => {
    if (!pendingProposal || !activeTrip) return;

    try {
      const { updatedTrip, auditLogEntry } = applyProposal(activeTrip, pendingProposal);

      // Save updated trip and log entry
      StorageService.saveTrip(updatedTrip);
      StorageService.addRecoveryHistoryEntry(auditLogEntry);

      setActiveTrip(updatedTrip);
      setFormData(updatedTrip.inputs);
      setSavedTrips(StorageService.getSavedTrips());
      setRecoveryHistory(StorageService.getRecoveryHistory());
      setPendingProposal(null);

      showToast('Proposal approved! Active itinerary & budget updated.', 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to apply proposal.', 'error');
    }
  };

  // Proposal Action: REJECT
  const handleRejectProposal = () => {
    if (!pendingProposal || !activeTrip) return;

    try {
      const { preservedTrip, auditLogEntry } = rejectProposal(activeTrip, pendingProposal);

      // Record rejection in history
      StorageService.addRecoveryHistoryEntry(auditLogEntry);

      // Invariant: Preserves original active trip completely untouched
      setActiveTrip(preservedTrip);
      // Revert form data back to active trip inputs
      setFormData(preservedTrip.inputs);
      setRecoveryHistory(StorageService.getRecoveryHistory());
      setPendingProposal(null);

      showToast('Proposal rejected. Original active itinerary remains 100% unchanged.', 'info');
    } catch (err) {
      console.error(err);
      showToast('Failed to reject proposal.', 'error');
    }
  };

  // Regeneration if proposal went stale
  const handleRegenerateProposal = () => {
    handleTriggerRecovery();
  };

  // Preset Scenario Loaders
  const handleSelectScenario = (scenarioKey) => {
    const sc = DEMO_SCENARIOS[scenarioKey];
    if (!sc) return;

    createAndActivateTrip(sc.inputs);
    showToast(`Loaded ${sc.title}`, 'info');
  };

  // Reset Trip
  const handleResetTrip = () => {
    createAndActivateTrip(DEMO_SCENARIOS.scenarioA.inputs);
    showToast('Reset to default itinerary setup.', 'info');
  };

  // Drawer Actions
  const handleLoadTrip = (tripId) => {
    const trip = StorageService.getTripById(tripId);
    if (trip) {
      StorageService.setActiveTripId(trip.id);
      setActiveTrip(trip);
      setFormData(trip.inputs);
      showToast(`Loaded trip: ${trip.name}`, 'success');
    }
  };

  const handleDeleteTrip = (tripId) => {
    const remaining = StorageService.deleteTrip(tripId);
    setSavedTrips(remaining);
    if (activeTrip?.id === tripId) {
      if (remaining.length > 0) {
        setActiveTrip(remaining[0]);
        setFormData(remaining[0].inputs);
      } else {
        createAndActivateTrip(DEMO_SCENARIOS.scenarioA.inputs, false);
      }
    }
    showToast('Trip deleted from storage.', 'info');
  };

  const handleClearHistory = () => {
    StorageService.clearRecoveryHistory();
    setRecoveryHistory([]);
    showToast('Recovery audit log cleared.', 'info');
  };

  // Direct selectors from directory recommendations
  const handleSelectTransportPref = (type) => {
    setFormData(prev => ({ ...prev, transportPreference: type }));
    if (activeTrip) {
      handleTriggerRecovery({ transportPreference: type });
    }
  };

  const handleSelectAccommodationPref = (type) => {
    setFormData(prev => ({ ...prev, accommodationPreference: type }));
    if (activeTrip) {
      handleTriggerRecovery({ accommodationPreference: type });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div className={`px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-bold border ${
            toastMessage.type === 'success'
              ? 'bg-emerald-900 text-white border-emerald-700'
              : toastMessage.type === 'error'
              ? 'bg-rose-900 text-white border-rose-700'
              : 'bg-slate-900 text-white border-slate-700'
          }`}>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}

      {/* Navigation Header */}
      <Navbar
        onSelectScenario={handleSelectScenario}
        onOpenSavedTrips={() => {
          setDrawerTab('saved');
          setIsDrawerOpen(true);
        }}
        onOpenHistory={() => {
          setDrawerTab('history');
          setIsDrawerOpen(true);
        }}
        onResetTrip={handleResetTrip}
        savedTripsCount={savedTrips.length}
        historyCount={recoveryHistory.length}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Interactive Disruption & Demonstration Scenarios Bar */}
        <DisruptionSimulator
          activeTrip={activeTrip}
          onSimulateBudgetCut={() => {
            setFormData(prev => ({ ...prev, budget: 16000 }));
            handleTriggerRecovery({ budget: 16000 });
          }}
          onSimulateDurationReduction={() => {
            setFormData(prev => ({ ...prev, duration: 3 }));
            handleTriggerRecovery({ duration: 3 });
          }}
          onSimulateWeatherDisruption={() => {
            const disruption = {
              outdoorUnsuitable: true,
              reason: 'Severe Mountain Blizzard & Avalanche Warning: High-altitude outdoor excursions suspended.'
            };
            handleTriggerRecovery({ simulatedDisruption: disruption });
          }}
          onClearDisruptions={() => {
            handleTriggerRecovery({ simulatedDisruption: null });
          }}
        />

        {/* Feature: Update Trip Due to Changes (Mid-trip deltas) */}
        {activeTrip && (
          <TripChangeForm
            activeTrip={activeTrip}
            onSubmitChanges={handleApplyTripChanges}
          />
        )}

        {/* Phase 2: Trip Parameters & Planner Form */}
        <TripPlannerForm
          formData={formData}
          setFormData={setFormData}
          onSubmit={handleFormSubmit}
          hasActiveTrip={Boolean(activeTrip)}
          onTriggerRecovery={() => handleTriggerRecovery()}
        />

        {/* Phase 3: Budget Manager */}
        {activeTrip?.budgetBreakdown && (
          <BudgetManager
            budgetBreakdown={activeTrip.budgetBreakdown}
            onTriggerRecovery={() => handleTriggerRecovery()}
          />
        )}

        {/* Phase 2: Itinerary Day-by-Day View */}
        {activeTrip?.itinerary && (
          <ItineraryView
            itinerary={activeTrip.itinerary}
            onSimulateDisruption={() => {
              handleTriggerRecovery({
                simulatedDisruption: {
                  outdoorUnsuitable: true,
                  reason: 'Simulated adverse rainfall & road closure'
                }
              });
            }}
          />
        )}

        {/* Destination Information & Recommendations Directory */}
        {activeTrip?.itinerary?.destinationDetails && (
          <Recommendations
            destinationDetails={activeTrip.itinerary.destinationDetails}
            onSelectTransport={handleSelectTransportPref}
            onSelectAccommodation={handleSelectAccommodationPref}
          />
        )}
      </main>

      {/* Phase 4: Travel Recovery Engine Modal (Side-by-Side Comparison) */}
      {pendingProposal && (
        <RecoveryModal
          proposal={pendingProposal}
          isStale={isProposalStale(pendingProposal, formData, activeTrip)}
          onApprove={handleApproveProposal}
          onReject={handleRejectProposal}
          onRegenerate={handleRegenerateProposal}
          onClose={() => {
            setPendingProposal(null);
            if (activeTrip) setFormData(activeTrip.inputs);
          }}
        />
      )}

      {/* Phase 7: Saved Trips & Recovery Audit Log Drawer */}
      <SavedTripsDrawer
        isOpen={isDrawerOpen}
        initialTab={drawerTab}
        onClose={() => setIsDrawerOpen(false)}
        savedTrips={savedTrips}
        recoveryHistory={recoveryHistory}
        activeTripId={activeTrip?.id}
        onLoadTrip={handleLoadTrip}
        onDeleteTrip={handleDeleteTrip}
        onClearHistory={handleClearHistory}
      />

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4">
          <p className="font-semibold text-slate-700">TripOS Functional Travel MVP</p>
          <p className="mt-1 text-slate-400">
            Transparent travel planning with mathematical accuracy and autonomous disruption recovery.
          </p>
        </div>
      </footer>
    </div>
  );
}
