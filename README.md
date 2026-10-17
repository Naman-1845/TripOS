# TripOS - AI Travel Operating System & Autonomous Recovery Engine

TripOS is a functional, AI-powered travel planning and recovery system built with React, Vite, and Tailwind CSS. It delivers mathematical budget integrity, customizable day-by-day itineraries, and an **Autonomous Travel Recovery Engine** that dynamically re-plans trips when budgets drop, durations change, or adverse mountain weather disrupts outdoor excursions.

---

## 🛠 Tech Stack

- **Framework**: React 18 (Pure JavaScript / JSX)
- **Bundler & Dev Server**: Vite
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Persistence**: LocalStorage (safe wrapper with error protection)
- **Test Suite**: Vitest (17 automated behavior tests)

---

## 🚀 How to Run Locally

In your VS Code terminal (inside `c:\Users\Naman\OneDrive\Documents\TripOS`):

### 1. Start the Development Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### 2. Run Automated Test Suite
```bash
npm test
```
Runs 27 behavior tests covering budget math, duration adjustments, mid-trip delta calculations, recovery state invariants, approval/rejection, and persistence.

### 3. Build for Production
```bash
npm run build
```

---

## 🔄 Update Trip Due to Changes (Mid-Trip Deltas)
Located prominently right below the disruption bar, this section allows reporting changes that occurred later in a real trip:
- **Duration Change**: Positive values extend trip days (+1, +2), negative values shorten trip days (-1, -2).
- **Budget Change**: Positive values increase budget (+₹5,000), negative values decrease budget (-₹4,000).
- **Optional Reason**: Explains why the change occurred (e.g., flight rescheduled, extended vacation).
- **One-Click Quick Specification Examples**:
  - **Example A**: +2 Days (Extends 5d to 7d).
  - **Example B**: -2 Days (Shortens 5d to 3d).
  - **Example C**: -₹4,000 Budget (Reduces ₹20,000 to ₹16,000).
  - **Example D**: +2 Days and -₹3,000 Budget (Combined simultaneous changes).
- **Validation**: Prevents resulting duration or resulting budget from becoming zero or negative with live error feedback.

---

## 📋 Demonstration Scenarios & How to Verify

### Scenario A: Delhi to Manali (Budget Reduction Recovery)
1. By default, TripOS loads: **Delhi to Manali, 2 Travellers, 5 Days, ₹20,000 Budget**.
2. Click **"Scenario A: Budget Reduction"** in the top disruption bar (or manually change budget to `₹16,000` and click *Evaluate Recovery Proposal*).
3. The **Autonomous Recovery Engine Modal** opens showing a side-by-side comparison:
   - Identifies trigger: *Budget decreased by ₹4,000*.
   - Engine automatically adjusts accommodation/transport to achieve budget compliance.
   - Highlights exact cost savings.
4. Click **"Approve & Apply Proposal"**.
5. Verify that the active itinerary and budget manager update immediately to the new plan and the action is saved in the **Recovery Log**.

### Scenario B: Duration Compression (Rejection Invariant Test)
1. Start with a 5-day trip.
2. Click **"Scenario B: Trip Compression"** (or change duration from 5 to 3 days).
3. The Recovery Modal opens with a side-by-side comparison showing the compressed 3-day itinerary.
4. Click **"Reject Proposal (Keep Original)"**.
5. **Verify**: The active itinerary remains **100% untouched** (still 5 days), the form resets to 5 days, and the rejection event is audited in the Recovery Log.

### Scenario C: Adverse Weather Disruption
1. In the top disruption bar, click **"Scenario C: Blizzard Alert"**.
2. The engine detects that outdoor activities (e.g., Solang Valley skiing/paragliding) are unsafe.
3. It reroutes the itinerary to safe indoor cultural alternatives (e.g., Himalayan Nyin-Gma Monastery & Roerich Gallery) and recalculates expenses.
4. Click **"Clear Weather Alert"** to restore normal conditions.

### Scenario D: Arbitrary Destination Test
1. Click **"Arbitrary Location (Munnar)"** or enter any custom destination (e.g. *Paris*, *Tokyo*, *Shillong*).
2. TripOS automatically activates its graceful heuristic model with explicit estimation labels rather than failing or showing unrelated recommendations.

---

## 🔒 Secret Safety & AI Mode
- **Client-Side Safe**: No API keys are bundled or exposed in client JavaScript.
- **Deterministic Heuristic Engine**: Runs offline reliably without requiring external API keys.
- **Backend Ready**: Connects to `VITE_AI_PROXY_URL` via server proxy when credentials are provided.

