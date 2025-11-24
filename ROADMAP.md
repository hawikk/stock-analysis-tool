# Massive Market Terminal 2.0 Roadmap

## 1. Optimization of Existing Functions (The Core)

### Technical Indicators Efficiency
- **Current State:** Uses `ta` library on pandas DataFrames.
- **Optimization:**
  - Ensure calculations are performed on vectorized numpy arrays where possible.
  - Compute indicators only when necessary (lazy loading) or cache the results of heavy calculations (like MACD/Bollinger on long histories).
  - Use `yfinance` batch download for multi-ticker endpoints (Screener, Heatmap) to reduce HTTP overhead.

### Caching Strategy
- **Requirement:** No Redis.
- **Solution:** Optimize `Flask-Caching` with `FileSystemCache`.
  - **Key Strategy:** Use specific cache keys based on query parameters (ticker, period).
  - **TTL Tuning:** Set aggressive TTL (1h+) for static data (Earnings, History) and short TTL (1-5m) for Price/Quote data.
  - **Browser Caching:** Implement `ETag` or `Cache-Control` headers for static assets to reduce server load.

### Error Handling
- **Strategy:** Implement a global Error Handler wrapper.
  - Catch `yfinance` exceptions (EmptyDataError) specifically.
  - Return standardized JSON error objects: `{ "error": "TYPE", "message": "...", "details": ... }`.
  - Fail gracefully in the UI (e.g., show "Data Unavailable" sparklines instead of breaking the page).

## 2. New Advanced Features (The Expansion)

### Killer Feature 1: Portfolio Correlation Matrix
- **Description:** A tool to analyze how assets in a watchlist move in relation to each other.
- **Value:** Helps retail investors understand diversification and risk.
- **Implementation:**
  - **Backend:** `/api/tools/correlation` endpoint. Fetches 1-year daily returns for selected tickers and computes `df.corr()`.
  - **Frontend:** A Heatmap Grid visualization where Green = +1.0 (Correlated) and Red = -1.0 (Inverse).

### Killer Feature 2: Monte Carlo Price Simulation
- **Description:** Probabilistic projection of future stock prices based on historical volatility.
- **Value:** "What if" analysis for setting realistic targets or stop-losses.
- **Implementation:**
  - **Backend:** `/api/tools/monte_carlo`. Uses Geometric Brownian Motion (GBM) model. Returns percentiles (10th, 50th, 90th).
  - **Frontend:** A chart overlay showing 50-100 potential future paths.

### Killer Feature 3: AI-Powered Market Sentiment
- **Description:** Beyond simple headline sentiment. Aggregates the last 20 news items and uses LLM (OpenAI) to generate a cohesive "Bullish/Bearish" narrative.
- **Value:** Saves time reading news; provides synthesized context.
- **Implementation:**
  - **Backend:** Enhance `/api/ai` to accept a context mode ("sentiment").
  - **Frontend:** A "Sentiment Gauge" and a text summary block.

### Watchlist Alert System
- **Architecture:** Client-Side Polling (Serverless approach).
- **Logic:**
  - User sets alerts: "SPY > 450". Saved in `localStorage`.
  - App polls `/api/market/quotes?tickers=...` every 60 seconds.
  - JS logic checks conditions.
  - **Notification:** Browser Notifications API (`Notification.requestPermission`) and UI Toasts.

## 3. UI/UX Enhancements

### Interactive Charts
- **Upgrade:** Move beyond static `Lightweight Charts` configs.
- **Features:**
  - **Toggleable Indicators:** Checkboxes to show/hide SMA, Bollinger Bands, Volume without API re-fetch.
  - **Dynamic Resizing:** Better handling of window resize events.
  - **Visual Overlays:** Buy/Sell signal markers directly on the chart.

### Modular Dashboard
- **Concept:** "Widget" based architecture.
- **Implementation:**
  - Use CSS Grid/Flexbox to create a responsive masonry-like layout.
  - Allow collapsing/expanding of widgets (News, Whale Activity, Sector Map).
  - Persist view preferences (e.g., "Hide Crypto Section") in `localStorage`.
