import React, { useState } from 'react';
import { X, Bookmark, History, Trash2, ArrowRight, CheckCircle2, XCircle, AlertCircle, Calendar, IndianRupee } from 'lucide-react';

export default function SavedTripsDrawer({
  isOpen,
  initialTab = 'saved',
  onClose,
  savedTrips = [],
  recoveryHistory = [],
  activeTripId,
  onLoadTrip,
  onDeleteTrip,
  onClearHistory
}) {
  const [tab, setTab] = useState(initialTab);

  // Sync tab if initialTab changes
  React.useEffect(() => {
    if (initialTab) setTab(initialTab);
  }, [initialTab]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex justify-end">
      <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-4 border-b border-indigo-100/80 flex items-center justify-between bg-slate-50/60">
          <div className="flex gap-2">
            <button
              onClick={() => setTab('saved')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer hover:scale-105 active:scale-95 ${
                tab === 'saved'
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-white bg-slate-100'
              }`}
            >
              <Bookmark className="w-3.5 h-3.5" />
              <span>Saved Trips ({savedTrips.length})</span>
            </button>

            <button
              onClick={() => setTab('history')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer hover:scale-105 active:scale-95 ${
                tab === 'history'
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-white bg-slate-100'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Recovery Audit ({recoveryHistory.length})</span>
            </button>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {tab === 'saved' ? (
            savedTrips.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Bookmark className="w-10 h-10 mx-auto mb-2 stroke-1 text-slate-300" />
                <p className="text-sm font-bold text-slate-600">No saved trips yet</p>
                <p className="text-xs text-slate-400 mt-1">
                  Trips you generate or modify are saved automatically to LocalStorage.
                </p>
              </div>
            ) : (
              savedTrips.map((trip) => {
                const isActive = trip.id === activeTripId;
                return (
                  <div
                    key={trip.id}
                    className={`p-4 rounded-2xl border transition-all duration-200 hover-lift shadow-2xs ${
                      isActive
                        ? 'border-indigo-400 bg-gradient-to-r from-indigo-50/80 to-purple-50/50 ring-2 ring-indigo-200'
                        : 'border-slate-200/90 bg-white hover:border-indigo-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-sm font-extrabold text-slate-900">{trip.name}</h4>
                          {isActive && (
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-600 text-white rounded-md shadow-2xs">
                              Active
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {trip.inputs?.travellers} travellers • {trip.inputs?.duration} days
                        </p>
                      </div>

                      <button
                        onClick={() => onDeleteTrip(trip.id)}
                        className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg transition-colors cursor-pointer hover:bg-rose-50"
                        title="Delete Trip"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
                      <div className="font-bold text-slate-800">
                        ₹{trip.inputs?.budget?.toLocaleString('en-IN')} Budget
                      </div>
                      {!isActive && (
                        <button
                          onClick={() => {
                            onLoadTrip(trip.id);
                            onClose();
                          }}
                          className="px-3 py-1 bg-brand-600 text-white font-bold text-xs rounded-lg hover:bg-brand-700 transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <span>Load Trip</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )
          ) : (
            recoveryHistory.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <History className="w-10 h-10 mx-auto mb-2 stroke-1" />
                <p className="text-sm font-semibold text-slate-600">Audit log empty</p>
                <p className="text-xs text-slate-400 mt-1">
                  Actions from the Travel Recovery Engine (Approved or Rejected proposals) will be recorded here.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex justify-between items-center pb-2">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Recent Recovery Events
                  </span>
                  <button
                    onClick={onClearHistory}
                    className="text-[11px] text-rose-600 hover:underline font-semibold cursor-pointer"
                  >
                    Clear Log
                  </button>
                </div>

                {recoveryHistory.map((entry) => {
                  const isApproved = entry.action === 'APPROVED';
                  return (
                    <div
                      key={entry.id}
                      className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 text-xs"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold text-[10px] ${
                          isApproved ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-800'
                        }`}>
                          {isApproved ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          {entry.action}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <div className="text-slate-800 font-semibold mb-1">
                        {entry.triggerReasons?.join('; ') || 'Optimization proposal'}
                      </div>

                      {entry.costImpact && (
                        <div className="text-[11px] text-slate-600 pt-1.5 border-t border-slate-200/70 flex justify-between">
                          <span>Financial impact:</span>
                          <span className={`font-bold ${entry.costImpact.difference < 0 ? 'text-emerald-700' : 'text-slate-700'}`}>
                            {entry.costImpact.difference < 0
                              ? `Saved ₹${Math.abs(entry.costImpact.difference).toLocaleString('en-IN')}`
                              : `+₹${entry.costImpact.difference?.toLocaleString('en-IN') || 0}`}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}

