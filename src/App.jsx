import React, { useState, useEffect, useRef } from 'react';
import Navbar from './components/Navbar.jsx';
import TripPlannerForm from './components/TripPlannerForm.jsx';
import BudgetManager from './components/BudgetManager.jsx';
import ItineraryView from './components/ItineraryView.jsx';
import Recommendations from './components/Recommendations.jsx';
import RecoveryModal from './components/RecoveryModal.jsx';
import DisruptionSimulator from './components/DisruptionSimulator.jsx';
import SavedTripsDrawer from './components/SavedTripsDrawer.jsx';
import TripChangeForm from './components/TripChangeForm.jsx';
import NaturalLanguageCommandBar from './components/NaturalLanguageCommandBar.jsx';
import TravelHeroHeader from './components/TravelHeroHeader.jsx';

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
import { getAgentStatus, requestTripRecovery } from './services/agentClient.js';
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

  // 5. Agent Backend Status & Recovery State
  const [agentStatus, setAgentStatus] = useState(null);
  const [isRecovering, setIsRecovering] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const recoveryRequestIdRef = useRef(0);

  const showToast = (text, type = 'info') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // On initial mount: load saved trips, history, active trip, and agent status
  useEffect(() => {
    // Fetch live agent backend status
    getAgentStatus().then(status => {
      setAgentStatus(status);
    }).catch(() => {
      setAgentStatus({ isOnline: false, mode: 'local-offline-fallback' });
    });

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
      simulatedDisruption: disruption,
      hotel: accommodation
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

  // Recovery Engine: Evaluate changes when active trip exists via Agent Server
  const handleTriggerRecovery = async (overrides = {}) => {
    if (!activeTrip) {
      createAndActivateTrip(formData);
      return;
    }

    const currentReqId = ++recoveryRequestIdRef.current;
    setIsRecovering(true);

    try {
      // Determine target inputs by combining activeTrip baseline, current form state, and overrides
      const targetDestination = (overrides.destination !== undefined ? overrides.destination : formData.destination) || activeTrip.inputs.destination;
      const targetOrigin = (overrides.origin !== undefined ? overrides.origin : formData.origin) || activeTrip.inputs.origin;
      const targetBudget = (overrides.budget !== undefined ? overrides.budget : formData.budget) ?? activeTrip.inputs.budget;
      const targetDuration = (overrides.duration !== undefined ? overrides.duration : formData.duration) ?? activeTrip.inputs.duration;
      const targetTravellers = (overrides.travellers !== undefined ? overrides.travellers : formData.travellers) ?? activeTrip.inputs.travellers;
      const targetTransport = (overrides.transportPreference !== undefined ? overrides.transportPreference : formData.transportPreference) || activeTrip.inputs.transportPreference;
      const targetAccommodation = (overrides.accommodationPreference !== undefined ? overrides.accommodationPreference : formData.accommodationPreference) || activeTrip.inputs.accommodationPreference;
      const targetInterests = (overrides.interests !== undefined ? overrides.interests : formData.interests) || activeTrip.inputs.interests;

      const simulatedDisruption = overrides.simulatedDisruption !== undefined
        ? overrides.simulatedDisruption
        : (activeTrip.simulatedDisruption || null);

      const requestedChanges = {};
      if (targetDestination !== activeTrip.inputs.destination) requestedChanges.destination = targetDestination;
      if (targetOrigin !== activeTrip.inputs.origin) requestedChanges.origin = targetOrigin;
      if (targetBudget !== activeTrip.inputs.budget) requestedChanges.budget = targetBudget;
      if (targetDuration !== activeTrip.inputs.duration) requestedChanges.duration = targetDuration;
      if (targetTravellers !== activeTrip.inputs.travellers) requestedChanges.travellers = targetTravellers;
      if (targetTransport !== activeTrip.inputs.transportPreference) requestedChanges.transportPreference = targetTransport;
      if (targetAccommodation !== activeTrip.inputs.accommodationPreference) requestedChanges.accommodationPreference = targetAccommodation;
      if (targetInterests) requestedChanges.interests = targetInterests;
      if (overrides.budgetDelta !== undefined) requestedChanges.budgetDelta = overrides.budgetDelta;
      if (overrides.durationDelta !== undefined) requestedChanges.durationDelta = overrides.durationDelta;
      if (overrides.userReason) requestedChanges.userReason = overrides.userReason;

      // Keep form inputs synchronized with the recovery parameters being evaluated
      setFormData(prev => ({
        ...prev,
        destination: targetDestination,
        origin: targetOrigin,
        budget: targetBudget,
        duration: targetDuration,
        travellers: targetTravellers,
        transportPreference: targetTransport,
        accommodationPreference: targetAccommodation,
        interests: targetInterests
      }));

      const recoveryResult = await requestTripRecovery({
        activeTrip,
        requestedChanges,
        simulatedDisruption
      });

      // Guard: Ignore response if a newer recovery request was already launched
      if (currentReqId !== recoveryRequestIdRef.current) {
        return;
      }

      setPendingProposal({
        ...recoveryResult.proposal,
        candidates: recoveryResult.candidates || []
      });

      // Transparent notification of engine source
      if (recoveryResult.mode === 'live-llm-agent') {
        showToast(`Recovery proposal drafted by Google Gemini (${recoveryResult.model || 'gemini-2.5-flash'})!`, 'success');
      } else if (recoveryResult.mode === 'deterministic-fallback') {
        showToast('Recovery proposals evaluated via server deterministic tool runner.', 'info');
      } else if (recoveryResult.mode === 'deterministic-fallback-on-error') {
        showToast('Gemini API encountered an error; safely executed server deterministic fallback.', 'info');
      } else {
        showToast('Backend offline; recovery proposal generated via local heuristic engine.', 'info');
      }
    } catch (err) {
      console.error('[TripOS] Recovery generation error:', err);
      showToast(`Recovery failed: ${err.message}`, 'error');
    } finally {
      setIsRecovering(false);
    }
  };

  // Handle mid-trip changes submitted from TripChangeForm ("Update Trip Due to Changes")
  const handleApplyTripChanges = async ({ durationDelta, budgetDelta, userReason, resultingDuration, resultingBudget }) => {
    if (!activeTrip) return;

    const currentReqId = ++recoveryRequestIdRef.current;
    setIsRecovering(true);

    try {
      if (resultingDuration) setFormData(prev => ({ ...prev, duration: resultingDuration }));
      if (resultingBudget) setFormData(prev => ({ ...prev, budget: resultingBudget }));

      const recoveryResult = await requestTripRecovery({
        activeTrip,
        requestedChanges: {
          durationDelta,
          budgetDelta,
          duration: resultingDuration,
          budget: resultingBudget,
          userReason: userReason || undefined
        }
      });

      // Guard against out-of-order responses
      if (currentReqId !== recoveryRequestIdRef.current) {
        return;
      }

      setPendingProposal({
        ...recoveryResult.proposal,
        candidates: recoveryResult.candidates || []
      });

      if (recoveryResult.mode === 'live-llm-agent') {
        showToast(`Recovery proposal drafted by Google Gemini (${recoveryResult.model || 'gemini-2.5-flash'})!`, 'success');
      } else if (recoveryResult.mode === 'deterministic-fallback') {
        showToast('Recovery proposals evaluated via server deterministic tool runner.', 'info');
      } else {
        showToast('Recovery proposal generated via local heuristic engine.', 'info');
      }
    } catch (err) {
      console.error('[TripOS] Mid-trip delta recovery error:', err);
      showToast(`Recovery failed: ${err.message}`, 'error');
    } finally {
      setIsRecovering(false);
    }
  };

  // Proposal Action: APPROVE
  const handleApproveProposal = async (selectedProposal = null) => {
    const proposalToApprove = selectedProposal || pendingProposal;
    if (!proposalToApprove || !activeTrip || isApproving || isRejecting) return;

    setIsApproving(true);
    try {
      const { updatedTrip, auditLogEntry } = applyProposal(activeTrip, proposalToApprove);

      // Save updated trip and log entry
      StorageService.saveTrip(updatedTrip);
      StorageService.addRecoveryHistoryEntry(auditLogEntry);

      setActiveTrip(updatedTrip);
      setFormData(updatedTrip.inputs);
      setSavedTrips(StorageService.getSavedTrips());
      setRecoveryHistory(StorageService.getRecoveryHistory());
      setPendingProposal(null);

      showToast(`Proposal approved (${proposalToApprove.strategy || 'Recommended'})! Active itinerary & budget updated.`, 'success');
    } catch (err) {
      console.error('[TripOS] Proposal approval error:', err);
      showToast(`Failed to apply proposal: ${err.message}`, 'error');
    } finally {
      setIsApproving(false);
    }
  };

  // Proposal Action: REJECT
  const handleRejectProposal = () => {
    if (!pendingProposal || !activeTrip || isApproving || isRejecting) return;

    setIsRejecting(true);
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
      console.error('[TripOS] Proposal rejection error:', err);
      showToast(`Failed to reject proposal: ${err.message}`, 'error');
    } finally {
      setIsRejecting(false);
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
    <div className="min-h-screen travel-atmosphere text-slate-800 flex flex-col font-sans">
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
        agentStatus={agentStatus}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Prominent Travel Hero Header */}
        <TravelHeroHeader
          activeTrip={activeTrip}
          destinationDetails={activeTrip?.itinerary?.destinationDetails || getDestinationData(formData.destination)}
          onQuickDestinationSelect={(dest) => {
            setFormData(prev => ({ ...prev, destination: dest }));
          }}
        />

        {/* Live Recovery Agent In-Progress Banner */}
        {isRecovering && (
          <div className="mb-6 p-4 rounded-2xl bg-indigo-900 text-white shadow-xl flex items-center justify-between animate-pulse border border-indigo-700">
            <div className="flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-indigo-300 animate-spin" />
              <div>
                <h4 className="text-sm font-bold">Autonomous Recovery Agent Active</h4>
                <p className="text-xs text-indigo-200 mt-0.5">
                  Evaluating catalog options, calculating verified budgets, and drafting an immutable proposal...
                </p>
              </div>
            </div>
            <span className="px-3 py-1 bg-indigo-800 text-indigo-200 text-xs font-semibold rounded-full border border-indigo-600">
              Processing Tools...
            </span>
          </div>
        )}

        {/* Interactive Disruption & Demonstration Scenarios Bar */}
        <DisruptionSimulator
          activeTrip={activeTrip}
          isRecovering={isRecovering}
          onSimulateBudgetCut={() => {
            handleTriggerRecovery({ budget: 16000 });
          }}
          onSimulateDurationReduction={() => {
            handleTriggerRecovery({ duration: 3 });
          }}
          onSimulateWeatherDisruption={() => {
            const disruption = {
              outdoorUnsuitable: true,
              leadTimeHours: 6,
              reason: 'Simulated Weather Disruption (Not a Live Weather Report): High-altitude mountain blizzard & avalanche alert.',
              advanceNotice: 'Advisory notification issued 6 hours before disruption onset. Outdoor activities pre-emptively rerouted.'
            };
            handleTriggerRecovery({ simulatedDisruption: disruption });
            showToast('🚨 Early Weather Advisory: Notification issued 6 hours before disruption onset. Pre-emptively rerouted!', 'info');
          }}
          onClearDisruptions={() => {
            handleTriggerRecovery({ simulatedDisruption: null });
          }}
        />

        {/* Feature 1: Natural-Language Trip Command Bar */}
        {activeTrip && (
          <NaturalLanguageCommandBar
            activeTrip={activeTrip}
            isRecovering={isRecovering}
            onRunRecovery={(overrides) => handleTriggerRecovery(overrides)}
          />
        )}

        {/* Feature: Update Trip Due to Changes (Mid-trip deltas) */}
        {activeTrip && (
          <TripChangeForm
            activeTrip={activeTrip}
            isRecovering={isRecovering}
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
                  reason: 'Simulated Weather Disruption (Not a Live Weather Report): Adverse rainfall & road closure alert.'
                }
              });
            }}
          />
        )}

        {/* Destination Information & Recommendations Directory */}
        {activeTrip?.itinerary?.destinationDetails && (
          <Recommendations
            destinationDetails={activeTrip.itinerary.destinationDetails}
            origin={activeTrip.inputs?.origin || 'Delhi'}
            onSelectTransport={handleSelectTransportPref}
            onSelectAccommodation={handleSelectAccommodationPref}
          />
        )}
      </main>

      {/* Phase 4: Travel Recovery Engine Modal (Side-by-Side Comparison & Multi-Candidate Strategy Selection) */}
      {pendingProposal && (
        <RecoveryModal
          proposal={pendingProposal}
          candidates={pendingProposal.candidates || []}
          activeTrip={activeTrip}
          isStale={isProposalStale(pendingProposal, formData, activeTrip)}
          isApproving={isApproving}
          isRejecting={isRejecting}
          onApprove={handleApproveProposal}
          onReject={handleRejectProposal}
          onRegenerate={handleRegenerateProposal}
          onClose={() => {
            if (isApproving || isRejecting) return;
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
      <footer className="bg-white/70 backdrop-blur-md border-t border-indigo-100/80 py-8 text-center text-xs text-slate-500 relative">
        <div className="max-w-7xl mx-auto px-4 flex flex-col items-center gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-gradient-to-r from-indigo-500 to-pink-500" />
            <p className="font-bold text-slate-800 tracking-tight">TripOS — Autonomous AI Travel Planner & Disruption Engine</p>
          </div>
          <p className="text-slate-400 max-w-xl">
            Mathematical budget verification, multi-portal price comparisons, multi-modal day routes, 6-hour advance disruption warnings, and autonomous Gemini recovery.
          </p>
        </div>
      </footer>
    </div>
  );
}
