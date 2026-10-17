import React, { useState } from 'react';
import { Hotel, Bus, Utensils, Compass, Star, ExternalLink, ShieldCheck, Info } from 'lucide-react';

export default function Recommendations({ destinationDetails, onSelectTransport, onSelectAccommodation }) {
  const [activeTab, setActiveTab] = useState('hotels');

  if (!destinationDetails) return null;

  const { transportOptions = [], accommodations = [], restaurants = [], attractions = [] } = destinationDetails;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 mb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 mb-6 border-b border-slate-100">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Compass className="w-5 h-5 text-brand-600" />
            <span>Destination Options & Local Directory</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Compare accommodation, transport routes, dining, and landmarks.
          </p>
        </div>

        {/* Clear estimate disclaimer badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-800 rounded-full text-xs font-medium border border-amber-200 shrink-0">
          <Info className="w-3.5 h-3.5 text-amber-600" />
          <span>Rates are sample estimates, not live availability</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 mb-6 gap-2 overflow-x-auto text-xs font-bold">
        {[
          { key: 'hotels', label: 'Hotels & Stays', icon: Hotel, count: accommodations.length },
          { key: 'transport', label: 'Transport Modes', icon: Bus, count: transportOptions.length },
          { key: 'food', label: 'Food & Cuisine', icon: Utensils, count: restaurants.length },
          { key: 'attractions', label: 'Sightseeing & POIs', icon: Compass, count: attractions.length }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 pb-3 px-3 transition-colors border-b-2 cursor-pointer ${
                isActive
                  ? 'border-brand-600 text-brand-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${isActive ? 'bg-brand-100 text-brand-800' : 'bg-slate-100 text-slate-600'}`}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      {/* 1. Hotels */}
      {activeTab === 'hotels' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {accommodations.map((acc) => (
            <div key={acc.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between hover:border-slate-300 transition-colors">
              <div>
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="px-2 py-0.5 rounded-md font-bold bg-purple-50 text-purple-700 border border-purple-200 text-[10px]">
                    {acc.type} Tier
                  </span>
                  <div className="flex items-center gap-1 font-bold text-amber-600">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    <span>{acc.rating || '4.5'}</span>
                  </div>
                </div>
                <h4 className="font-bold text-sm text-slate-900 mb-1">{acc.name}</h4>
                <div className="flex flex-wrap gap-1 mt-2">
                  {acc.amenities?.map((am, i) => (
                    <span key={i} className="text-[10px] px-2 py-0.5 bg-white border border-slate-200 rounded text-slate-600">
                      {am}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-400">Est. price/night</div>
                  <div className="text-base font-extrabold text-slate-900">
                    ₹{acc.costPerNight.toLocaleString('en-IN')}
                  </div>
                </div>
                {onSelectAccommodation && (
                  <button
                    onClick={() => onSelectAccommodation(acc.type)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer"
                  >
                    Select
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 2. Transport */}
      {activeTab === 'transport' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {transportOptions.map((tr) => (
            <div key={tr.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between hover:border-slate-300 transition-colors">
              <div>
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="px-2 py-0.5 rounded-md font-bold bg-blue-50 text-blue-700 border border-blue-200 text-[10px]">
                    {tr.type}
                  </span>
                  <span className="text-xs text-slate-500 font-medium">
                    Duration: {tr.duration}
                  </span>
                </div>
                <h4 className="font-bold text-sm text-slate-900 mb-1">{tr.name}</h4>
                <p className="text-xs text-slate-500">{tr.description}</p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-400">Estimated Tariff</div>
                  <div className="text-base font-extrabold text-slate-900">
                    {tr.flatCost
                      ? `₹${tr.flatCost.toLocaleString('en-IN')} (Flat vehicle)`
                      : `₹${tr.costPerPerson.toLocaleString('en-IN')} / person (one-way)`}
                  </div>
                </div>
                {onSelectTransport && (
                  <button
                    onClick={() => onSelectTransport(tr.type)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer"
                  >
                    Select
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 3. Food */}
      {activeTab === 'food' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {restaurants.map((rest, i) => (
            <div key={i} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
              <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-amber-50 text-amber-700 border border-amber-200">
                {rest.cuisine}
              </span>
              <h4 className="font-bold text-sm text-slate-900 mt-2 mb-1">{rest.name}</h4>
              <p className="text-xs text-slate-500 mb-3">{rest.note}</p>
              <div className="text-xs text-slate-600 font-semibold pt-2 border-t border-slate-200">
                Avg: ₹{rest.avgCostPerPerson.toLocaleString('en-IN')} / person
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 4. Attractions */}
      {activeTab === 'attractions' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {attractions.map((att) => (
            <div key={att.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-slate-100 text-slate-700">
                  {att.category}
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                  att.isOutdoor ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                }`}>
                  {att.isOutdoor ? 'Outdoor Activity' : 'Indoor / Sheltered'}
                </span>
              </div>
              <h4 className="font-bold text-sm text-slate-900 mb-1">{att.name}</h4>
              <p className="text-xs text-slate-500 mb-3">{att.description}</p>
              <div className="text-xs text-slate-600 font-semibold flex justify-between pt-2 border-t border-slate-200">
                <span>Duration: {att.duration}</span>
                <span className="text-brand-700 font-bold">
                  {att.costPerPerson > 0 ? `₹${att.costPerPerson.toLocaleString('en-IN')}/person` : 'Free entry'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

