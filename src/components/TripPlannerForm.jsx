import React, { useState } from 'react';
import { MapPin, Calendar, Users, IndianRupee, Sparkles, AlertCircle, Heart, Hotel, Bus, Plane, Car, Train } from 'lucide-react';

const INTEREST_OPTIONS = [
  'Adventure',
  'Nature',
  'Culture',
  'Food',
  'Relaxation',
  'Shopping'
];

const POPULAR_DESTINATIONS = ['Manali', 'Delhi', 'Goa', 'Jaipur', 'Munnar', 'Leh'];

export default function TripPlannerForm({
  formData,
  setFormData,
  onSubmit,
  hasActiveTrip = false,
  onTriggerRecovery
}) {
  const [errors, setErrors] = useState({});

  const validate = () => {
    const errs = {};
    if (!formData.origin?.trim()) errs.origin = 'Origin city is required';
    if (!formData.destination?.trim()) errs.destination = 'Destination is required';
    if (!formData.duration || formData.duration < 1) errs.duration = 'Duration must be at least 1 day';
    if (!formData.travellers || formData.travellers < 1) errs.travellers = 'Travellers must be at least 1';
    if (!formData.budget || formData.budget < 1000) errs.budget = 'Minimum budget of ₹1,000 required';
    if (!formData.interests || formData.interests.length === 0) errs.interests = 'Select at least one interest';

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validate()) {
      onSubmit();
    }
  };

  const handleRecoveryClick = () => {
    if (validate()) {
      onTriggerRecovery();
    }
  };

  const toggleInterest = (interest) => {
    const current = formData.interests || [];
    let updated;
    if (current.includes(interest)) {
      updated = current.filter(i => i !== interest);
    } else {
      updated = [...current, interest];
    }
    setFormData({ ...formData, interests: updated });
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 mb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6 pb-4 border-b border-slate-100">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-brand-600" />
            <span>Trip Parameters & Preferences</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure locations, budget, and travel preferences.
          </p>
        </div>
        {hasActiveTrip && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            Active Trip Loaded
          </span>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Row 1: Origin & Destination */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Origin City
            </label>
            <div className="relative">
              <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={formData.origin || ''}
                onChange={(e) => setFormData({ ...formData, origin: e.target.value })}
                placeholder="e.g. Delhi, Mumbai, Bengaluru"
                className={`w-full pl-9 pr-3 py-2 text-sm rounded-xl border ${
                  errors.origin ? 'border-rose-300 ring-2 ring-rose-100' : 'border-slate-200'
                } focus:outline-hidden focus:border-brand-500 focus:ring-2 focus:ring-brand-100`}
              />
            </div>
            {errors.origin && <p className="text-xs text-rose-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {errors.origin}</p>}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Destination (Curated or Any City)
            </label>
            <div className="relative">
              <MapPin className="w-4 h-4 text-brand-500 absolute left-3 top-3" />
              <input
                type="text"
                value={formData.destination || ''}
                onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                placeholder="e.g. Manali, Goa, Jaipur, or any location"
                className={`w-full pl-9 pr-3 py-2 text-sm rounded-xl border ${
                  errors.destination ? 'border-rose-300 ring-2 ring-rose-100' : 'border-slate-200'
                } focus:outline-hidden focus:border-brand-500 focus:ring-2 focus:ring-brand-100`}
              />
            </div>
            {errors.destination && <p className="text-xs text-rose-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {errors.destination}</p>}

            {/* Quick destination chips */}
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              <span className="text-[10px] text-slate-400 font-medium">Suggestions:</span>
              {POPULAR_DESTINATIONS.map((dest) => (
                <button
                  key={dest}
                  type="button"
                  onClick={() => setFormData({ ...formData, destination: dest })}
                  className={`text-[11px] px-2 py-0.5 rounded-md border transition-colors cursor-pointer ${
                    formData.destination?.toLowerCase() === dest.toLowerCase()
                      ? 'bg-brand-50 border-brand-300 text-brand-700 font-semibold'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {dest}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Row 2: Dates, Duration, Travellers, Budget */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Start Date
            </label>
            <div className="relative">
              <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="date"
                value={formData.startDate || ''}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-hidden focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Duration (Days)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="30"
                value={formData.duration || 1}
                onChange={(e) => setFormData({ ...formData, duration: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                className={`w-full px-3 py-2 text-sm rounded-xl border ${
                  errors.duration ? 'border-rose-300' : 'border-slate-200'
                } focus:outline-hidden focus:border-brand-500`}
              />
              <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">
                {formData.duration > 1 ? `${formData.duration - 1} Nights` : 'Day Trip'}
              </span>
            </div>
            {errors.duration && <p className="text-xs text-rose-500 mt-1">{errors.duration}</p>}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Travellers
            </label>
            <div className="relative">
              <Users className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="number"
                min="1"
                max="20"
                value={formData.travellers || 1}
                onChange={(e) => setFormData({ ...formData, travellers: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                className={`w-full pl-9 pr-3 py-2 text-sm rounded-xl border ${
                  errors.travellers ? 'border-rose-300' : 'border-slate-200'
                } focus:outline-hidden focus:border-brand-500`}
              />
            </div>
            {errors.travellers && <p className="text-xs text-rose-500 mt-1">{errors.travellers}</p>}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Total Budget (₹)
            </label>
            <div className="relative">
              <IndianRupee className="w-4 h-4 text-emerald-600 absolute left-3 top-3" />
              <input
                type="number"
                step="500"
                min="1000"
                value={formData.budget || ''}
                onChange={(e) => setFormData({ ...formData, budget: parseInt(e.target.value, 10) || 0 })}
                placeholder="20000"
                className={`w-full pl-9 pr-3 py-2 text-sm font-semibold rounded-xl border ${
                  errors.budget ? 'border-rose-300 ring-2 ring-rose-100' : 'border-slate-200'
                } focus:outline-hidden focus:border-brand-500 focus:ring-2 focus:ring-brand-100 text-slate-900`}
              />
            </div>
            {errors.budget && <p className="text-xs text-rose-500 mt-1">{errors.budget}</p>}
          </div>
        </div>

        {/* Row 3: Preferences (Transport & Accommodation) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Hotel className="w-4 h-4 text-slate-400" /> Accommodation Preference
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { key: 'Hostel', label: 'Hostel / Budget', desc: 'Dorm & Shared' },
                { key: 'Standard', label: 'Standard Hotel', desc: 'Comfort & AC' },
                { key: 'Luxury', label: 'Luxury Resort', desc: 'Premium & Spa' }
              ].map(opt => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setFormData({ ...formData, accommodationPreference: opt.key })}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    formData.accommodationPreference === opt.key
                      ? 'border-brand-500 bg-brand-50/70 ring-2 ring-brand-100'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className={`text-xs font-bold ${formData.accommodationPreference === opt.key ? 'text-brand-700' : 'text-slate-800'}`}>
                    {opt.label}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Bus className="w-4 h-4 text-slate-400" /> Transport Preference
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { key: 'Bus', icon: Bus, label: 'Bus' },
                { key: 'Train', icon: Train, label: 'Train' },
                { key: 'Cab', icon: Car, label: 'Cab' },
                { key: 'Flight', icon: Plane, label: 'Flight' }
              ].map(opt => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setFormData({ ...formData, transportPreference: opt.key })}
                    className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                      formData.transportPreference === opt.key
                        ? 'border-brand-500 bg-brand-50/70 ring-2 ring-brand-100'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <Icon className={`w-4 h-4 mx-auto mb-1 ${formData.transportPreference === opt.key ? 'text-brand-600' : 'text-slate-500'}`} />
                    <div className={`text-xs font-bold ${formData.transportPreference === opt.key ? 'text-brand-700' : 'text-slate-700'}`}>
                      {opt.label}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Row 4: Interests Tags */}
        <div className="pt-2 border-t border-slate-100">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Heart className="w-4 h-4 text-slate-400" /> Interests & Activities
          </label>
          <div className="flex flex-wrap gap-2">
            {INTEREST_OPTIONS.map((interest) => {
              const selected = formData.interests?.includes(interest);
              return (
                <button
                  key={interest}
                  type="button"
                  onClick={() => toggleInterest(interest)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                    selected
                      ? 'bg-slate-900 border-slate-900 text-white shadow-xs'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {interest}
                </button>
              );
            })}
          </div>
          {errors.interests && <p className="text-xs text-rose-500 mt-1.5">{errors.interests}</p>}
        </div>

        {/* Submit Actions */}
        <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            {hasActiveTrip ? (
              <span>Modifying inputs will trigger the <strong>Travel Recovery Engine</strong> with a side-by-side comparison.</span>
            ) : (
              <span>Enter your parameters and click generate to build a complete itinerary and expense audit.</span>
            )}
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            {hasActiveTrip ? (
              <button
                type="button"
                onClick={handleRecoveryClick}
                className="w-full sm:w-auto px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm rounded-xl shadow-md shadow-brand-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>Evaluate Recovery Proposal</span>
              </button>
            ) : (
              <button
                type="submit"
                className="w-full sm:w-auto px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm rounded-xl shadow-md shadow-brand-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>Generate Travel Plan</span>
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}

