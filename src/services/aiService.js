/**
 * AI Service Adapter for TripOS
 * Safe client-side abstraction that interfaces with AI generation endpoints.
 * Enforces secret safety: credentials must NEVER be stored in client-side bundles.
 */

export const AIService = {
  /**
   * Checks if an AI backend endpoint / key is configured in the environment.
   * In a pure frontend app, we inspect Vite environment flags (e.g. VITE_AI_PROXY_URL).
   */
  isConfigured() {
    return Boolean(import.meta.env.VITE_AI_PROXY_URL);
  },

  /**
   * Returns AI engine metadata to be displayed transparently in the UI
   */
  getEngineMetadata() {
    const configured = this.isConfigured();
    return {
      isLiveAI: configured,
      mode: configured ? 'Live AI Enhanced (Connected via Backend Proxy)' : 'Deterministic Heuristic Fallback',
      provider: configured ? 'External AI Model via Secure Proxy' : 'TripOS Heuristic Travel Engine v1.0',
      safetyNotice: configured
        ? 'AI responses generated via server-side proxy; secrets remain safely off-browser.'
        : 'Running in offline deterministic mode. All calculations and recovery workflows respond accurately to your inputs.'
    };
  },

  /**
   * Request itinerary enhancement or custom recommendations
   * If not configured, gracefully delegates to the local rule engine without error.
   */
  async requestItineraryEnhancement(tripParams) {
    if (!this.isConfigured()) {
      return {
        success: true,
        source: 'deterministic-fallback',
        message: 'Generated using local deterministic travel heuristics.',
        metadata: this.getEngineMetadata()
      };
    }

    try {
      const response = await fetch(import.meta.env.VITE_AI_PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tripParams)
      });
      if (!response.ok) throw new Error(`AI proxy returned HTTP ${response.status}`);
      const data = await response.json();
      return {
        success: true,
        source: 'live-ai',
        data,
        metadata: this.getEngineMetadata()
      };
    } catch (err) {
      console.warn('[TripOS AI] Proxy request failed, falling back to local engine:', err);
      return {
        success: true,
        source: 'deterministic-fallback-on-error',
        message: 'AI proxy unavailable; fell back safely to deterministic rule engine.',
        metadata: this.getEngineMetadata()
      };
    }
  }
};

