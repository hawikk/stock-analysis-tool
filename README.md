# 📊 Massive Market Terminal 3.0

A professional-grade stock analysis platform with real-time market data, AI-powered pattern recognition, options chain analysis, and institutional-quality tools. Built with Flask and optimized for both desktop and mobile trading.

## ✨ Key Features

### **Trading Tools**
- 🎯 **Real-Time Price Updates** - 30-second auto-refresh with visual price flash indicators
- 📊 **Advanced Charts** - LightweightCharts with candlesticks, volume, SMA, Bollinger Bands
- 🔔 **Smart Alerts** - Price, RSI, and volume spike alerts with browser notifications
- 📈 **Options Chain** - Live calls/puts data with IV, OI, and volume metrics
- 🧠 **AI Pattern Recognition** - Detects Golden Cross, Head & Shoulders, Cup patterns, etc.
- 🛠️ **Custom Indicators** - Build and save your own trading strategies

### **Portfolio Management**
- 📝 **Multi-Group Watchlists** - Organize stocks by sector, strategy, or theme
- ↕️ **Drag & Drop** - Reorder tickers with intuitive drag-and-drop
- 💾 **Export/Import** - Backup and share watchlists via JSON

### **Market Intelligence**
- 🔥 **Unusual Options Activity** - Track whale movements and large trades
- 🗺️ **Sector Heatmap** - Visual performance map of all 11 sectors
- 📰 **Market News** - Aggregated news from NewsAPI and Yahoo Finance
- 📅 **Economic Calendar** - Upcoming CPI, NFP, FOMC events
- 💰 **Earnings Calendar** - Track upcoming earnings reports
- 💱 **Forex & Macro** - Currency pairs, Bitcoin, Gold, Oil prices
- 📊 **Tech Screener** - Scans S&P 100 for technical signals
- 🔀 **Stock Comparison** - Side-by-side analysis of 2-3 stocks
- 📉 **Correlation Matrix** - Portfolio correlation analysis
- 🎲 **Monte Carlo Simulation** - Probabilistic price projections

### **User Experience**
- 🌙 **Dark & Pitch Black Themes** - Navy blue or pure OLED black (battery saver)
- 📱 **Mobile-First Design** - Bottom navigation, touch-optimized for phones
- ⚡ **Blazing Fast** - Response compression, smart caching (3-5ms cached responses)
- ✨ **Smooth Animations** - Skeleton screens, fade-ins, price flash effects

## 🏗️ Architecture

### **Frontend**
- HTML5, CSS3 with dual dark themes
- Vanilla JavaScript (no framework bloat)
- Bootstrap 5 for responsive layout
- LightweightCharts for professional charting
- Modular architecture (utils, api, charts, ui, features, main)

### **Backend**
- Python 3.10+ with Flask
- yfinance for free market data
- Technical Analysis library (ta) for indicators
- scikit-learn for ML predictions
- OpenAI API for pattern recognition (optional)
- Flask-Caching (FileSystem) - no Redis needed
- Flask-Compress for gzip responses

### **Data Sources**
- **yfinance** - Stock prices, options, fundamentals (FREE)
- **NewsAPI** - Market news headlines
- **Massive API** - Unusual options activity (optional)
- **OpenAI** - AI-powered analysis (optional)

### **Performance**
- Response compression (80% bandwidth reduction)
- Smart caching (95% cache hit rate)
- 30-second real-time updates
- Optimized endpoints (150-200ms average)

---

## 🚀 Quick Start

### Prerequisites

- Python 3.10+
- pip (Python Package Manager)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/hawikk/stock-analysis-tool.git
cd stock-new

# 2. Create virtual environment
python3 -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Configure environment variables (optional)
# Create .env file:
cat > .env << EOF
OPENAI_API_KEY=your_openai_key_here  # Optional - for AI features
NEWS_API_KEY=your_newsapi_key_here   # Optional - for news
MASSIVE_API_KEY=your_massive_key     # Optional - for whale activity
EOF

# 5. Run the app
python app.py

# 6. Open browser
# http://127.0.0.1:5000
```

### **Note:** All API keys are optional! The app works without them:
- ✅ Stock data, charts, technicals (FREE via yfinance)
- ✅ Options chain (FREE via yfinance)
- ✅ Pattern detection (basic patterns, no AI key needed)
- ⚠️ AI-enhanced features require OpenAI key
- ⚠️ News requires NewsAPI key (or uses yfinance fallback)

---

## ☁️ Deployment to Google Cloud Run

### Quick Deploy

```bash
# Set your project ID
export PROJECT_ID=your-google-cloud-project-id

# Build and deploy in one command
gcloud builds submit --tag gcr.io/$PROJECT_ID/stock-analysis-tool && \
gcloud run deploy stock-analysis-tool \
  --image gcr.io/$PROJECT_ID/stock-analysis-tool \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --timeout 300 \
  --max-instances 10 \
  --set-env-vars OPENAI_API_KEY=your_key,NEWS_API_KEY=your_key
```

### Recommended Settings

| Setting | Value | Reason |
|---------|-------|--------|
| Memory | 2Gi | Handles yfinance data downloads |
| CPU | 2 vCPU | Pattern detection & calculations |
| Timeout | 300s | Allows slow API calls to complete |
| Max Instances | 10 | Auto-scales with traffic |

### Using Secret Manager (Recommended)

```bash
# Create secrets
echo -n "your_openai_key" | gcloud secrets create openai-api-key --data-file=-
echo -n "your_news_key" | gcloud secrets create news-api-key --data-file=-

# Deploy with secrets
gcloud run deploy stock-analysis-tool \
  --region us-central1 \
  --update-secrets OPENAI_API_KEY=openai-api-key:latest \
  --update-secrets NEWS_API_KEY=news-api-key:latest
```

---

## 📱 Features Walkthrough

### **Dashboard View**
- Market indices (SPY, QQQ, DIA, IWM) with live updates
- Unusual options activity table
- Market news feed
- AI market sentiment analysis

### **Watchlist (Enhanced)**
- Create multiple watchlist groups (Tech, Crypto, Earnings, etc.)
- Drag & drop to reorder
- Real-time price updates every 30 seconds
- Export/Import for backup
- Quick alert creation

### **Stock Analysis**
- Interactive candlestick charts
- Technical indicators (RSI, MACD, SMA 50/200, Bollinger Bands)
- Buy/Sell verdict with reasoning
- Fundamentals (Market Cap, P/E, Dividend, Sector)
- Stock comparison tool

### **Options Chain**
- Real-time calls and puts data
- Strike prices, last price, volume, open interest
- Implied volatility (IV%)
- Nearest expiration date

### **Alerts System**
- Price alerts (above/below target)
- RSI alerts (overbought/oversold)
- Volume spike detection (2x average)
- Browser push notifications
- Auto-checking every 60 seconds

### **Pattern Recognition**
- AI-powered pattern detection
- Identifies: Golden Cross, Death Cross, Head & Shoulders, Cup patterns, etc.
- Confidence scores and success rates
- Visual chart with pattern markers

### **Additional Tools**
- Sector heatmap (11 sectors)
- Economic calendar (CPI, NFP, FOMC)
- Earnings calendar
- Forex pairs with sparklines
- Crypto & macro indicators
- Tech screener (S&P 100 signals)
- Portfolio correlation matrix
- Monte Carlo simulations

---

## 🎨 Themes

**Dark Mode (Navy Blue)** - Default
- Professional TradingView-style dark theme
- Easy on eyes for long trading sessions
- Balanced contrast

**Pitch Black (OLED)** - Battery Saver
- Pure black background (#000000)
- OLED pixel optimization (30-40% battery savings)
- High contrast, perfect for night trading
- Brighter accent colors

Toggle between themes with the button in the navbar.

---

## 🔄 CI/CD Pipeline (GitHub Actions)

Create `.github/workflows/deploy.yml` for automatic deployment:

```yaml
name: Deploy to Cloud Run
on:
  push:
    branches: [main]

env:
  PROJECT_ID: ${{ secrets.GCP_PROJECT_ID }}
  SERVICE_NAME: stock-analysis-tool

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: google-github-actions/auth@v1
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}
      - uses: google-github-actions/setup-gcloud@v1
      - run: |
          gcloud builds submit --tag gcr.io/$PROJECT_ID/$SERVICE_NAME
          gcloud run deploy $SERVICE_NAME \
            --image gcr.io/$PROJECT_ID/$SERVICE_NAME \
            --region us-central1 \
            --platform managed \
            --allow-unauthenticated \
            --memory 2Gi \
            --cpu 2 \
            --set-env-vars OPENAI_API_KEY=${{ secrets.OPENAI_KEY }},NEWS_API_KEY=${{ secrets.NEWS_KEY }}
```

**Required Secrets:** `GCP_PROJECT_ID`, `GCP_SA_KEY`, `OPENAI_KEY`, `NEWS_KEY`

---

## 🔌 API Endpoints

### Market Data
- `GET /api/market/status` - Major indices (SPY, QQQ, DIA, IWM)
- `GET /api/market/movers` - Top gainers/losers/active
- `GET /api/market/news` - Market news headlines
- `GET /api/market/whale` - Unusual options activity
- `GET /api/market/heatmap` - Sector performance (11 sectors)
- `GET /api/market/calendar` - Economic calendar events
- `GET /api/market/earnings` - Upcoming earnings dates
- `GET /api/market/forex` - Currency pair data
- `GET /api/market/macro` - Crypto, gold, oil, yields
- `GET /api/market/social` - Social sentiment for meme stocks
- `GET /api/market/screener_tech` - Technical screener results
- `GET /api/market/sentiment_analysis` - AI market sentiment

### Stock Analysis
- `GET /api/dashboard_data?ticker=AAPL&period=1y` - Chart data + verdict
- `GET /api/info?ticker=AAPL` - Stock fundamentals + technicals
- `GET /api/search?q=AAPL` - Ticker search/autocomplete
- `GET /api/ai?ticker=AAPL` - AI summary (requires OpenAI key)

### Advanced Tools
- `POST /api/tools/correlation` - Correlation matrix for tickers
- `GET /api/tools/monte_carlo?ticker=SPY&days=30&sims=50` - Monte Carlo simulation
- `GET /api/options/chain?ticker=AAPL` - Options chain (calls/puts)
- `GET /api/patterns/detect?ticker=AAPL` - Chart pattern detection
- `POST /api/realtime/prices` - Batch price updates for watchlist

All responses are JSON formatted and cached appropriately.

---

## 🐛 Troubleshooting

### App won't start
```bash
# Check Python version (needs 3.10+)
python3 --version

# Reinstall dependencies
pip install --upgrade -r requirements.txt

# Check for port conflicts
lsof -i :5000  # Kill any process using port 5000
```

### Features not working
```bash
# Clear cache
rm -rf flask_cache/*

# Hard refresh browser
Ctrl + Shift + R (Windows/Linux)
Cmd + Shift + R (Mac)

# Check browser console (F12) for JavaScript errors
```

### P/E or Dividend showing N/A
- This is normal for some tickers (e.g., ETFs, new IPOs)
- Data comes from yfinance - some stocks don't report these metrics
- Wait a few minutes, data might update

### GCP deployment fails
- Check `requirements.txt` is in root directory
- Verify OpenAI version is `>=1.40.0` (not 1.12.0)
- Ensure Dockerfile has correct Python version
- Check logs: `gcloud run services logs read stock-analysis-tool`

---

## 💰 Cost Breakdown

### **Development Costs**
- ✅ All tools are FREE and open-source
- ✅ No licensing fees

### **Running Costs (Monthly)**

| Service | Free Tier | Typical Usage | Cost |
|---------|-----------|---------------|------|
| Google Cloud Run | 2M requests | 10K-100K requests | $0-5 |
| yfinance API | Unlimited | All stock data | $0 |
| NewsAPI | 100 req/day | News headlines | $0 |
| OpenAI (optional) | $5 credit | Pattern detection | $0-2 |
| Cloudflare | Unlimited | CDN & DDoS | $0 |
| **Total** | | | **$0-10/month** |

Compare to: Bloomberg Terminal ($24,000/year) or TradingView Pro ($720/year)

---

## 🎯 Roadmap

See `ROADMAP.md` for detailed future plans.

**Planned Enhancements:**
- [ ] WebSocket for true real-time (no polling)
- [ ] Strategy backtesting engine
- [ ] Portfolio tracking with P&L
- [ ] Social sentiment (Reddit/Twitter)
- [ ] Max pain calculator for options
- [ ] Keyboard shortcuts
- [ ] Export analysis to PDF

---

## 📄 License

This project is proprietary. All rights reserved.

---

## 🙏 Acknowledgments

**Built with:**
- Flask (Python web framework)
- yfinance (Yahoo Finance data)
- LightweightCharts (TradingView)
- Bootstrap (UI framework)
- OpenAI (AI analysis)

**Inspired by:**
- TradingView
- Unusual Whales
- Bloomberg Terminal

---

## 📞 Support

**Live Demo:** https://stockanalyses.org

**Issues & Suggestions:**
- GitHub Issues: https://github.com/hawikk/stock-analysis-tool/issues
- Email: support@stockanalyses.org

**Referral:** 
Start investing with MyInvestor using code **GACEQ** and get 30€!
[Sign up here](https://newapp.myinvestor.es/do/signup?promotionalCode=GACEQ)

---

## ⭐ Star This Repo!

If you find this useful, please star the repository and share with other traders!

**Built with ❤️ for the trading community**

