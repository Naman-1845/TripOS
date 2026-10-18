# TripOS - Autonomous AI Travel Operating System & Recovery Engine

TripOS is a full-featured, AI-powered travel operating system and autonomous recovery platform built with **React 18, Vite, Tailwind CSS, Express, and Google Gemini 2.5 Flash**.

TripOS solves a major real-world travel problem: when unforeseen disruptions hit—mountain blizzards, budget cuts, cancelled transport, or group size changes—travelers are stranded manually rebuilding complex itineraries. TripOS provides an **Autonomous Agentic Recovery Loop** governed by **5 deterministic safety tools** that re-plans trips while mathematically guaranteeing budget integrity, weather safety, and human-in-the-loop approval.

---

## 🌟 Showcase Features for Presentations & Judges

### 1. Natural-Language Trip Commands (Conversational AI Command Bar)
Located prominently at the top of the travel workspace, users can type natural language instructions:
- *"cut my budget by 4k, add a day, and it's raining"*
- *"make it cheaper, we're 3 people now"*
- *"switch destination to Goa, 4 days with Luxury stay"*

**Key Capabilities:**
- **Structured Intent Extraction**: Parses budget deltas (`-₹4,000`), duration deltas (`+1 day`), traveler counts (`3`), simulated weather alerts (`rain`, `snow`, `blizzard`), destination changes, and accommodation tiers.
- **Hybrid AI + Regex Fallback**: Uses Gemini 2.5 Flash structured output schema when available and falls back instantly to a comprehensive deterministic parser if offline or quota-limited.
- **Live Interpretation Preview**: Displays extracted parameter chips, confidence rating, active execution badge (`live-llm-agent`, `deterministic-fallback`, or `local-offline-fallback`), and clarification alerts.
- **One-Click Agent Trigger**: "Run Recovery Agent" button directly launches autonomous evaluation.

### 2. Multi-Candidate Recovery Plans with Trade-offs
Rather than forcing a single rigid itinerary, the recovery engine generates **2–3 distinct candidate strategies** for the user:
- **Budget Saver**: Aggressive cost reduction (switches to Hostels/Homestays, optimizes activities, maximizes savings).
- **Time Saver / Balanced**: Preserves preferred travel pace, balances transport efficiency and budget constraints.
- **Comfort / Indoor Safe**: Prioritizes higher-tier comfort and safely swaps outdoor excursions for curated indoor/cultural alternatives during adverse weather alerts.

**Key Capabilities:**
- **Strategy Cards**: Side-by-side selection showing title, description, total estimated cost, savings delta, trade-off pros and cons, and an agent **Recommended** badge.
- **Interactive Switching**: Clicking any candidate card immediately updates the proposed day-by-day comparison in the modal before approval.
- **Agent Verification**: Every candidate is evaluated by the deterministic `verify_proposal` tool before being presented to the user.

---

## 🛠 Deterministic Agent Tools (Safe Architecture)

The autonomous loop is strictly bounded by 5 tools. The LLM **never invents prices or hallucinates numbers**; all financial calculations are performed by deterministic deterministic tools:

1. **`inspect_active_trip`**: Reads the active trip state, traveler count, current budget, and day-by-day itinerary.
2. **`search_travel_options`**: Deterministic travel catalog providing verified accommodation rates, transport modes, and destination activities.
3. **`calculate_trip_budget`**: Strict mathematical budget calculator enforcing accurate pricing per person, lodging, transport, and daily allowances.
4. **`draft_recovery_proposal`**: Formulates a complete day-by-day recovery proposal with explicit deltas, strategy tags, and trade-off summaries.
5. **`verify_proposal`**: Verifies feasibility, budget compliance, duration bounds, traveler safety (weather restrictions), and itinerary continuity.

---

## 🛡 Honest Execution Modes & Failure Resilience

TripOS is built with zero-failure resilience for live demonstrations:

| Mode | Trigger Condition | Behavior |
| :--- | :--- | :--- |
| **`live-llm-agent`** | Backend online + valid `GEMINI_API_KEY` | Gemini 2.5 Flash autonomously invokes tools, analyzes disruptions, drafts multiple candidate plans, and verifies them. |
| **`deterministic-fallback`** | Backend online + no API key configured | Server-side deterministic runner executes the 5-tool sequence with realistic, verified itineraries and trade-offs. |
| **`deterministic-fallback-on-error`** | Gemini HTTP 429 (quota exhaustion) or timeout | Automatically enters a cooldown period, avoids crashing, and delivers a deterministic proposal with clear status badges. |
| **`local-offline-fallback`** | Backend Express server stopped or unreachable | The frontend client-side recovery engine executes locally in the browser with full state preservation. |

- **Security**: The Gemini API key is stored strictly on the Express backend (`.env`) and is never leaked or bundled into the browser bundle.
- **Rate Limiting**: Protected with `express-rate-limit` (10 requests/min per IP) on all `/api/agent/*` routes.
- **Human-in-the-Loop**: Active trip state is **100% immutable** until the user explicitly clicks "Approve & Apply Proposal". Rejection leaves the original trip completely untouched.

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher recommended)
- npm

### 1. Installation
Clone the repository and install dependencies in the project root:
```bash
npm install
```

### 2. Environment Configuration (Optional)
To enable live Gemini AI integration, create a `.env` file in the project root:
```env
PORT=3001
GEMINI_API_KEY=your_gemini_api_key_here
```
*(If omitted, TripOS seamlessly runs in high-fidelity deterministic fallback mode).*

### 3. Run Development Servers
TripOS consists of a Vite frontend and an Express agent server:

**Terminal 1 — Agent Backend Server:**
```bash
npm run server
```
*Listens on `http://localhost:3001` (Health check: `http://localhost:3001/api/agent/status`).*

**Terminal 2 — Frontend App:**
```bash
npm run dev
```
*Vite dev server starts on `http://localhost:5173`.*

---

## 🧪 Automated Testing

TripOS has a comprehensive automated Vitest suite containing **147 tests** across 10 test files:

```bash
npm test
```

### Test Coverage Highlights:
- **`hackathonFeatures.test.js`**: Intent parser entity extraction, multi-candidate proposal generation, candidate selection, and tool verification.
- **`geminiQuota.node.test.js`**: HTTP 429 quota exhaustion handling, cooldown activation, and fallback stability.
- **`agentTools.test.js` & `agentServer.test.js`**: Verification of all 5 deterministic agent tools and Express endpoints.
- **`recoveryEngine.test.js`**: Proposal validation, delta math, staleness detection, and rejection invariants.
- **`budgetCalculator.test.js` & `budgetValidation.test.js`**: Strict numerical pricing integrity and edge-case guards.

To build for production:
```bash
npm run build
```

---

## 🎬 3 Judge Demonstration Scripts

Use these 3 scripts to showcase TripOS to hackathon or college judges:

### Demo 1: Triple Disruption via Natural Language
*Demonstrates natural-language parsing, multi-constraint resolution, and multi-candidate trade-offs.*

1. Open `http://localhost:5173`. TripOS defaults to **Delhi to Manali, 2 Travellers, 5 Days, ₹20,000 Budget**.
2. In the top **Natural-Language Command Bar**, click the quick chip or type:
   > `"cut my budget by 4k, add a day, and it's raining"`
3. **Point out to judges**:
   - The live preview instantly parses: `-₹4,000 Budget`, `+1 Day`, `Weather: rain`.
   - The confidence badge indicates accurate extraction without manual form filling.
4. Click **"Run Recovery Agent"**.
5. When the **Recovery Evaluation Modal** opens:
   - Show the **Step-by-Step Agent Execution Trace** showing all 5 tools executing (`inspect_active_trip` → `search_travel_options` → `calculate_trip_budget` → `draft_recovery_proposal` → `verify_proposal`).
   - Show the **Candidate Proposal Cards** (e.g. *Budget Saver* vs *Comfort / Indoor Safe*).
   - Point out that outdoor activities (Solang Valley paragliding) were replaced with indoor cultural sites due to rain.
   - Switch between candidates to show dynamic price and itinerary updates.
6. Click **"Approve & Apply Proposal"** and show the updated itinerary and budget in the main dashboard.

### Demo 2: Group Size Expansion & Fast Re-budgeting
*Demonstrates parameter restructuring and strict price recalculation.*

1. In the Natural-Language Command Bar, type:
   > `"make it cheaper, we're 3 people now"`
2. **Point out to judges**:
   - The parser extracts: `Travellers: 3`, `Budget: -₹2,000`, `Accommodation: budget`.
3. Click **"Run Recovery Agent"**.
4. Highlight that the agent recalculates per-person lodging, transport, and activity totals through the deterministic `calculate_trip_budget` tool rather than guessing numbers.
5. Click **"Reject Proposal (Keep Original)"**.
6. **Point out to judges**:
   - The active trip remains **100% untouched** (original 2 travelers, original budget).
   - The rejection is permanently recorded in the Recovery Audit Log for human-in-the-loop safety.

### Demo 3: Destination Pivot to Goa with Strategy Selection
*Demonstrates location migration, catalog lookup, and trade-off comparison.*

1. In the Natural-Language Command Bar, type:
   > `"switch destination to Goa, 4 days with Luxury stay"`
2. Click **"Run Recovery Agent"**.
3. **Point out to judges**:
   - The proposal completely switches from Himalayan mountain activities to coastal Goa activities (Calangute Beach, Fort Aguada, Dudhsagar Waterfalls).
   - The modal displays multiple candidates comparing a high-end Luxury plan against a Balanced alternative.
   - The `verify_proposal` tool confirms all 4 days have valid transport and lodging before user approval.
4. Click **"Approve & Apply Proposal"**. Verify the new destination, live budget breakdown, and persistent state.

---

## 📄 License
MIT License. Built for travel safety and autonomous agent reliability.
