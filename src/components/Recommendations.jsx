import React, { useState } from 'react';
import {
  Hotel,
  Bus,
  Utensils,
  Compass,
  Star,
  ExternalLink,
  ShieldCheck,
  Info,
  Tag,
  ArrowRight,
  X,
  CheckCircle,
  Sparkles,
  SlidersHorizontal
} from 'lucide-react';
import {
  compareHotelPrices,
  compareTransportPrices,
  executeBookingRedirect
} from '../services/bookingComparisonService.js';

export default function Recommendations({
  destinationDetails,
  origin = 'Delhi',
  onSelectTransport,
  onSelectAccommodation
}) {
  const [activeTab, setActiveTab] = useState('hotels');
  const [activeComparison, setActiveComparison] = useState(null); // { type: 'hotel'|'transport', item }
  const [comparisonPriority, setComparisonPriority] = useState('cheapest'); // 'cheapest' | 'freeCancellation' | 'rating'
  const [redirectFeedback, setRedirectFeedback] = useState(null);

  if (!destinationDetails) return null;

  const { transportOptions = [], accommodations = [], restaurants = [], attractions = [] } = destinationDetails;
  const destinationName = destinationDetails.name || 'Manali';

  // Compute active comparison data if modal is open
  const comparisonData = activeComparison
    ? activeComparison.type === 'hotel'
      ? compareHotelPrices(activeComparison.item, destinationName, comparisonPriority)
      : compareTransportPrices(activeComparison.item, destinationName, comparisonPriority, origin)
    : null;

  const handleTriggerRedirect = (provider) => {
    setRedirectFeedback(`Redirecting to ${provider.platformName} (${provider.domain})...`);
    executeBookingRedirect(provider);
    setTimeout(() => {
      setRedirectFeedback(null);
    }, 3500);
  };

  return (
    <div className="travel-glass-card rounded-3xl p-6 sm:p-8 mb-8 relative overflow-hidden transition-all duration-300">
      {/* Decorative gradient top accent line */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-rose-500 to-indigo-500" />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-6 border-b border-indigo-100/60">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 via-rose-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-rose-500/25 shrink-0">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight">
              Destination Directory & Live Rate Comparison
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Compare rates across booking platforms, check vehicle routes, local food, and landmarks.
            </p>
          </div>
        </div>

        {/* Clear estimate disclaimer badge */}
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1 bg-amber-50 text-amber-800 rounded-full text-xs font-bold border border-amber-200 shrink-0 shadow-2xs self-start sm:self-auto">
          <Info className="w-3.5 h-3.5 text-amber-600" />
          <span>Rates are sample estimates, not live availability</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-indigo-100/60 mb-6 gap-2 overflow-x-auto text-xs font-bold pb-2">
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
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer hover:scale-105 active:scale-95 ${
                isActive
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/20'
                  : 'bg-white/80 border border-slate-200/80 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
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
            <div key={acc.id} className="p-5 rounded-2xl border border-slate-200/90 bg-white/90 flex flex-col justify-between hover-lift shadow-2xs transition-all">
              <div>
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="px-2.5 py-0.5 rounded-lg font-bold bg-purple-50 text-purple-700 border border-purple-200 text-[10px]">
                    {acc.type} Tier
                  </span>
                  <div className="flex items-center gap-1 font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200/60">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    <span>{acc.rating || '4.5'}</span>
                  </div>
                </div>
                <h4 className="font-extrabold text-base text-slate-900 mb-1">{acc.name}</h4>
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  {acc.amenities?.map((am, i) => (
                    <span key={i} className="text-[10px] font-medium px-2 py-0.5 bg-slate-50 border border-slate-200/80 rounded-md text-slate-600">
                      {am}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-5 pt-3.5 border-t border-slate-100">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-[11px] text-slate-400 font-medium">Est. price/night</div>
                    <div className="text-lg font-black text-slate-900">
                      ₹{acc.costPerNight.toLocaleString('en-IN')}
                    </div>
                  </div>
                  {onSelectAccommodation && (
                    <button
                      onClick={() => onSelectAccommodation(acc.type)}
                      className="text-xs font-bold px-3 py-1.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 transition-all cursor-pointer shadow-2xs hover:scale-105 active:scale-95"
                    >
                      Select Tier
                    </button>
                  )}
                </div>

                {/* Compare Websites Button */}
                <button
                  type="button"
                  onClick={() => {
                    setActiveComparison({ type: 'hotel', item: acc });
                    setComparisonPriority('cheapest');
                  }}
                  className="w-full py-2 px-3 rounded-xl text-xs font-extrabold text-indigo-700 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 hover:from-indigo-100 hover:to-purple-100 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs hover:scale-[1.02] active:scale-98"
                >
                  <Tag className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Compare Sites & Find Cheapest</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 2. Transport */}
      {activeTab === 'transport' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {transportOptions.map((tr) => (
            <div key={tr.id} className="p-5 rounded-2xl border border-slate-200/90 bg-white/90 flex flex-col justify-between hover-lift shadow-2xs transition-all">
              <div>
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="px-2.5 py-0.5 rounded-lg font-bold bg-blue-50 text-blue-700 border border-blue-200 text-[10px]">
                    {tr.type}
                  </span>
                  <span className="text-xs text-slate-500 font-bold bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200/60">
                    ⏱ {tr.duration}
                  </span>
                </div>
                <h4 className="font-extrabold text-base text-slate-900 mb-1">{tr.name}</h4>
                <p className="text-xs text-slate-500 leading-relaxed">{tr.description}</p>
              </div>

              <div className="mt-5 pt-3.5 border-t border-slate-100">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-[11px] text-slate-400 font-medium">Estimated Tariff</div>
                    <div className="text-lg font-black text-slate-900">
                      {tr.flatCost
                        ? `₹${tr.flatCost.toLocaleString('en-IN')} (Flat vehicle)`
                        : `₹${tr.costPerPerson.toLocaleString('en-IN')} / person (one-way)`}
                    </div>
                  </div>
                  {onSelectTransport && (
                    <button
                      onClick={() => onSelectTransport(tr.type)}
                      className="text-xs font-bold px-3 py-1.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 transition-all cursor-pointer shadow-2xs hover:scale-105 active:scale-95"
                    >
                      Select Mode
                    </button>
                  )}
                </div>

                {/* Compare Websites Button */}
                <button
                  type="button"
                  onClick={() => {
                    setActiveComparison({ type: 'transport', item: tr });
                    setComparisonPriority('cheapest');
                  }}
                  className="w-full py-2 px-3 rounded-xl text-xs font-extrabold text-blue-700 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 hover:from-blue-100 hover:to-indigo-100 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs hover:scale-[1.02] active:scale-98"
                >
                  <Tag className="w-3.5 h-3.5 text-blue-600" />
                  <span>Compare Booking Portals</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 3. Food */}
      {activeTab === 'food' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {restaurants.map((rest, i) => (
            <div key={i} className="p-5 rounded-2xl border border-amber-200/80 bg-gradient-to-b from-amber-50/40 to-white/90 shadow-2xs hover-lift transition-all">
              <span className="text-[10px] px-2.5 py-0.5 rounded-lg font-extrabold bg-amber-100 text-amber-800 border border-amber-200">
                {rest.cuisine}
              </span>
              <h4 className="font-extrabold text-base text-slate-900 mt-2.5 mb-1">{rest.name}</h4>
              <p className="text-xs text-slate-500 mb-3 leading-relaxed">{rest.note}</p>
              <div className="text-xs text-slate-700 font-extrabold pt-2.5 border-t border-amber-100">
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
            <div key={att.id} className="p-5 rounded-2xl border border-indigo-200/80 bg-gradient-to-b from-indigo-50/30 to-white/90 shadow-2xs hover-lift transition-all">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] px-2.5 py-0.5 rounded-lg font-bold bg-slate-100 text-slate-700 border border-slate-200/80">
                  {att.category}
                </span>
                <span className={`text-[10px] px-2.5 py-0.5 rounded-lg font-extrabold ${
                  att.isOutdoor ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                }`}>
                  {att.isOutdoor ? 'Outdoor Activity' : 'Indoor / Sheltered'}
                </span>
              </div>
              <h4 className="font-extrabold text-base text-slate-900 mb-1">{att.name}</h4>
              <p className="text-xs text-slate-500 mb-3 leading-relaxed">{att.description}</p>
              <div className="text-xs text-slate-600 font-semibold flex justify-between pt-2.5 border-t border-indigo-100/80">
                <span>⏱ Duration: {att.duration}</span>
                <span className="text-indigo-700 font-black">
                  {att.costPerPerson > 0 ? `₹${att.costPerPerson.toLocaleString('en-IN')}/person` : 'Free entry'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Multi-Website Price Comparison Modal / Overlay */}
      {comparisonData && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-brand-400 text-slate-950 uppercase">
                    Live Rate Comparison
                  </span>
                  <span className="text-xs text-slate-400">
                    {comparisonData.destination}
                  </span>
                </div>
                <h3 className="text-base font-bold text-white">
                  {comparisonData.hotelName || comparisonData.transportName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveComparison(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Redirect Feedback Notice */}
            {redirectFeedback && (
              <div className="p-3 bg-emerald-50 text-emerald-900 border-b border-emerald-200 flex items-center gap-2 text-xs font-bold animate-pulse">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span>{redirectFeedback}</span>
              </div>
            )}

            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Priorities Selector */}
              <div>
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-2">
                  <div className="flex items-center gap-1.5">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-brand-600" />
                    <span>Prioritize Results By:</span>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    Cheapest provider automatically highlighted
                  </span>
                </div>

                <div className="flex gap-2">
                  {[
                    { key: 'cheapest', label: 'Cheapest Price (Default)' },
                    ...(activeComparison.type === 'hotel'
                      ? [{ key: 'freeCancellation', label: 'Free Cancellation First' }]
                      : []),
                    { key: 'rating', label: 'Top Rated Platform' }
                  ].map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => setComparisonPriority(p.key)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        comparisonPriority === p.key
                          ? 'bg-brand-600 text-white shadow-2xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Provider Comparison List */}
              <div className="space-y-2">
                {comparisonData.providers.map((prov) => {
                  const isCheapest = prov.platformId === comparisonData.cheapestProvider.platformId;
                  const price = prov.totalPrice || prov.fare;

                  return (
                    <div
                      key={prov.platformId}
                      className={`p-3 rounded-xl border flex items-center justify-between transition-colors ${
                        isCheapest
                          ? 'bg-emerald-50/60 border-emerald-300 ring-1 ring-emerald-400/30'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-extrabold text-sm text-slate-900">
                            {prov.platformName}
                          </span>
                          {isCheapest && (
                            <span className="px-2 py-0.2 rounded-full text-[10px] font-extrabold bg-emerald-500 text-white shadow-2xs">
                              Cheapest Price ⭐
                            </span>
                          )}
                          {prov.deepLinkType === 'direct_property_page' && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Direct Property 🎯
                            </span>
                          )}
                          {prov.freeCancellation && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-blue-50 text-blue-700">
                              Free Cancel
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-2">
                          <span>{prov.domain}</span>
                          <span>•</span>
                          <span className="flex items-center gap-0.5 text-amber-600 font-semibold">
                            ★ {prov.vendorRating}
                          </span>
                          {prov.perk && (
                            <>
                              <span>•</span>
                              <span className="text-slate-600 font-medium">{prov.perk}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="text-base font-extrabold text-slate-900">
                            ₹{price.toLocaleString('en-IN')}
                          </div>
                          {prov.discountTag && (
                            <div className="text-[10px] font-bold text-emerald-700">
                              {prov.discountTag}
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleTriggerRedirect(prov)}
                          className={`text-xs font-bold px-3 py-2 rounded-lg flex items-center gap-1 transition-all cursor-pointer ${
                            isCheapest
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                          }`}
                        >
                          <span>Redirect</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Summary and Auto-Redirect to Cheapest Button */}
              <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-xs text-slate-500">
                  Best deal on <strong className="text-slate-800">{comparisonData.cheapestProvider.platformName}</strong>:{' '}
                  <strong className="text-emerald-700 text-sm">
                    ₹{(comparisonData.cheapestProvider.totalPrice || comparisonData.cheapestProvider.fare).toLocaleString('en-IN')}
                  </strong>
                  {comparisonData.maxSavings > 0 && (
                    <span className="ml-1.5 text-emerald-600 font-bold">
                      (Saves up to ₹{comparisonData.maxSavings.toLocaleString('en-IN')})
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleTriggerRedirect(comparisonData.cheapestProvider)}
                  className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-brand-600 text-white text-xs font-extrabold flex items-center justify-center gap-2 shadow-md transition-colors cursor-pointer"
                >
                  <span>Redirect to Cheapest ({comparisonData.cheapestProvider.platformName})</span>
                  <ExternalLink className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
