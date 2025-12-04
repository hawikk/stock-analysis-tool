import os
import sys
from dotenv import load_dotenv

# Load environment variables FIRST
load_dotenv()

# Ensure 'services' is findable
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(current_dir)

from flask import Flask, render_template, request, jsonify
from flask_caching import Cache
from flask_compress import Compress
import yfinance as yf
import requests
from openai import OpenAI
import pandas as pd
import numpy as np
from ta.momentum import RSIIndicator
from ta.trend import MACD, SMAIndicator
from ta.volatility import BollingerBands
from sklearn.linear_model import LinearRegression
import datetime
from textblob import TextBlob

# Import from helper
from massive_data import massive_service

app = Flask(__name__)

# Enable Compression
try:
    compress = Compress(app)
    app.config['COMPRESS_MIMETYPES'] = ['text/html', 'text/css', 'application/json', 'application/javascript']
    app.config['COMPRESS_LEVEL'] = 6
    app.config['COMPRESS_MIN_SIZE'] = 500
except:
    print("⚠️ Flask-Compress not available, running without compression")

# Cache Configuration - Optimized for FileSystem
cache = Cache(app, config={
    'CACHE_TYPE': 'FileSystemCache',
    'CACHE_DIR': 'flask_cache',
    'CACHE_DEFAULT_TIMEOUT': 3600, # 1 hour default
    'CACHE_THRESHOLD': 1000 # Increased threshold
})

# Configuration
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
NEWS_API_KEY = os.getenv("NEWS_API_KEY")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-5-mini-2025-08-07")
MASSIVE_API_KEY = os.getenv("MASSIVE_API_KEY")

# Initialize OpenAI Client properly
client = None
if OPENAI_API_KEY and OPENAI_API_KEY.strip():
    try:
        client = OpenAI(api_key=OPENAI_API_KEY)
        print("✅ OpenAI client initialized successfully")
    except Exception as e:
        print(f"⚠️ OpenAI client initialization failed: {e}")
        print("   AI features will be disabled")
        client = None

# --- ERROR HANDLING HELPER ---
def api_error(message, status_code=500, details=None):
    return jsonify({
        'error': 'API_ERROR',
        'message': message,
        'details': details
    }), status_code

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/favicon.ico')
def favicon():
    """Serve favicon or return 204 No Content to prevent 404 errors"""
    from flask import send_from_directory
    import os
    favicon_path = os.path.join(app.root_path, 'static', 'favicon.ico')
    if os.path.exists(favicon_path):
        return send_from_directory(os.path.join(app.root_path, 'static'), 'favicon.ico', mimetype='image/vnd.microsoft.icon')
    else:
        # Return 204 No Content instead of 404 to prevent error logs
        return '', 204

# --- CORE MARKET ENDPOINTS ---

@app.route('/api/market/status', methods=['GET'])
@cache.cached(timeout=300)
def get_market_status():
    """Returns status of major indices using YFinance batching"""
    indices = {
        'SPY': 'S&P 500',
        'QQQ': 'Nasdaq 100',
        'DIA': 'Dow Jones',
        'IWM': 'Russell 2000'
    }
    results = []
    try:
        # Optimized Batch Fetch
        tickers = list(indices.keys())
        data = yf.download(tickers, period="2d", group_by='ticker', progress=False, threads=True)

        for symbol, name in indices.items():
            try:
                if len(tickers) == 1:
                    df = data
                else:
                    if symbol not in data.columns.levels[0]:
                        continue
                    df = data[symbol]

                if len(df) >= 1:
                    price = df['Close'].iloc[-1]
                    prev_close = df['Close'].iloc[-2] if len(df) > 1 else df['Open'].iloc[-1]
                    change_pct = ((price - prev_close) / prev_close) * 100
                    results.append({
                        'ticker': symbol,
                        'name': name,
                        'price': round(float(price), 2),
                        'change_pct': round(float(change_pct), 2)
                    })
            except Exception as e:
                print(f"Index error {symbol}: {e}")
                continue

        return jsonify({'indices': results})
    except Exception as e:
        return api_error(str(e))

@app.route('/api/market/movers', methods=['GET'])
@cache.cached(timeout=3600)
def get_market_movers():
    """Returns top gainers/losers/active (Uses Massive - 1 Call)"""
    try:
        data = massive_service.get_market_movers()
        return jsonify(data)
    except Exception as e:
        return api_error(str(e))

@app.route('/api/news', methods=['GET'])
@cache.cached(query_string=True, timeout=600)
def get_stock_news():
    """Returns specific stock news"""
    ticker = request.args.get('ticker')
    if not ticker: return api_error("Ticker required", 400)

    try:
        t = yf.Ticker(ticker)
        news = t.news
        articles = []
        for n in news:
             c = n.get('content', n)
             articles.append({
                 'title': c.get('title'),
                 'source': c.get('provider', {}).get('displayName') if isinstance(c.get('provider'), dict) else c.get('publisher'),
                 'url': c.get('clickThroughUrl', {}).get('url') if isinstance(c.get('clickThroughUrl'), dict) else c.get('link'),
                 'publishedAt': c.get('pubDate'),
                 'image': c.get('thumbnail', {}).get('resolutions', [{}])[0].get('url') if isinstance(c.get('thumbnail'), dict) else None
             })
        return jsonify({'articles': articles})
    except Exception as e:
        return api_error(str(e))

@app.route('/api/market/news', methods=['GET'])
@cache.cached(timeout=600)
def get_market_news():
    """Returns general market news"""
    try:
        if NEWS_API_KEY:
            url = f'https://newsapi.org/v2/top-headlines?category=business&language=en&country=us&pageSize=10&apiKey={NEWS_API_KEY}'
            response = requests.get(url)
            news_data = response.json()
            
            articles = []
            if news_data.get('status') == 'ok':
                for article in news_data.get('articles', []):
                    if article.get('title') == '[Removed]': continue
                    articles.append({
                        'title': article.get('title'),
                        'source': article.get('source', {}).get('name'),
                        'url': article.get('url'),
                        'publishedAt': article.get('publishedAt'),
                        'image': article.get('urlToImage')
                    })
                return jsonify({'articles': articles})

        spy = yf.Ticker("SPY")
        news = spy.news
        articles = []
        for n in news:
             c = n.get('content', n)
             articles.append({
                 'title': c.get('title'),
                 'source': c.get('provider', {}).get('displayName') if isinstance(c.get('provider'), dict) else c.get('publisher'),
                 'url': c.get('clickThroughUrl', {}).get('url') if isinstance(c.get('clickThroughUrl'), dict) else c.get('link'),
                 'publishedAt': c.get('pubDate'),
                 'image': c.get('thumbnail', {}).get('resolutions', [{}])[0].get('url') if isinstance(c.get('thumbnail'), dict) else None
             })
        return jsonify({'articles': articles})

    except Exception as e:
        return api_error(str(e))

@app.route('/api/market/whale', methods=['GET'])
@cache.cached(timeout=300)
def get_whale_activity():
    """Returns unusual activity (Uses Massive - 2 Calls)"""
    try:
        data = massive_service.get_unusual_activity()
        return jsonify({'data': data})
    except Exception as e:
        return api_error(str(e))

@app.route('/api/market/calendar', methods=['GET'])
@cache.cached(timeout=3600)
def get_economic_calendar():
    """Returns major economic events (Logic-Based Generation)"""
    today = datetime.date.today()
    events = []

    def next_weekday(d, weekday):
        days_ahead = weekday - d.weekday()
        if days_ahead <= 0: days_ahead += 7
        return d + datetime.timedelta(days=days_ahead)

    next_thursday = next_weekday(today, 3)
    events.append({
        "date": next_thursday.strftime('%Y-%m-%d'),
        "time": "08:30 AM",
        "event": "Initial Jobless Claims",
        "impact": "Medium",
        "previous": "210K",
        "forecast": "215K"
    })

    next_cpi_month = today.month + 1 if today.month < 12 else 1
    next_cpi_year = today.year if today.month < 12 else today.year + 1
    if today.day <= 12:
        next_cpi_month = today.month
        next_cpi_year = today.year
    next_cpi = datetime.date(next_cpi_year, next_cpi_month, 12)
    while next_cpi.weekday() > 4: next_cpi += datetime.timedelta(days=1)

    events.append({
        "date": next_cpi.strftime('%Y-%m-%d'),
        "time": "08:30 AM",
        "event": "CPI Inflation Data",
        "impact": "High",
        "previous": "3.1%",
        "forecast": "3.0%"
    })

    next_nfp_month = today.month + 1 if today.month < 12 else 1
    next_nfp_year = today.year if today.month < 12 else today.year + 1
    d = datetime.date(next_nfp_year, next_nfp_month, 1)
    while d.weekday() != 4: d += datetime.timedelta(days=1)
    this_month_nfp = datetime.date(today.year, today.month, 1)
    while this_month_nfp.weekday() != 4: this_month_nfp += datetime.timedelta(days=1)
    target_nfp = this_month_nfp if this_month_nfp >= today else d

    events.append({
        "date": target_nfp.strftime('%Y-%m-%d'),
        "time": "08:30 AM",
        "event": "Non-Farm Payrolls",
        "impact": "High",
        "previous": "150K",
        "forecast": "170K"
    })

    events.append({
        "date": (today + datetime.timedelta(days=30)).strftime('%Y-%m-%d'),
        "time": "02:00 PM",
        "event": "FOMC Rate Decision",
        "impact": "High",
        "previous": "5.50%",
        "forecast": "5.50%"
    })

    events.sort(key=lambda x: x['date'])
    return jsonify({'events': events})

@app.route('/api/market/heatmap', methods=['GET'])
@cache.cached(timeout=600)
def get_sector_heatmap():
    """Returns sector performance based on ETFs"""
    sectors = {
        'XLK': 'Technology', 'XLE': 'Energy', 'XLF': 'Financials',
        'XLV': 'Healthcare', 'XLI': 'Industrials', 'XLB': 'Materials',
        'XLY': 'Consumer Disc', 'XLP': 'Cons Staples', 'XLU': 'Utilities',
        'XLRE': 'Real Estate', 'XLC': 'Communication'
    }
    results = []
    try:
        tickers = list(sectors.keys())
        data = yf.download(tickers, period="2d", group_by='ticker', progress=False, threads=True, auto_adjust=True)

        for symbol, name in sectors.items():
            try:
                # Handle both single and multi-ticker downloads
                if len(tickers) > 1:
                    if hasattr(data.columns, 'levels') and symbol in data.columns.levels[0]:
                        df = data[symbol]
                    else:
                        # Fallback: Try direct column access
                        df = data[[col for col in data.columns if col[0] == symbol]] if isinstance(data.columns, pd.MultiIndex) else data
                elif len(tickers) == 1:
                    df = data
                else: 
                    continue

                if df.empty: 
                    print(f"Heatmap: {symbol} - empty dataframe")
                    continue
                    
                df = df.dropna()
                if len(df) < 2: 
                    print(f"Heatmap: {symbol} - insufficient data ({len(df)} rows)")
                    continue

                # Calculate change
                close_col = df['Close'] if 'Close' in df.columns else df.iloc[:, 3]
                change = ((close_col.iloc[-1] - close_col.iloc[-2]) / close_col.iloc[-2]) * 100
                
                results.append({
                    'symbol': symbol,
                    'sector': name,
                    'change_pct': round(float(change), 2)
                })
                
            except Exception as sector_error:
                print(f"Heatmap error for {symbol}: {sector_error}")
                # Add with 0 change as fallback
                results.append({'symbol': symbol, 'sector': name, 'change_pct': 0.0})

        # Always return data, even if some sectors failed
        if len(results) == 0:
            print("Heatmap: No sectors loaded successfully")
            # Return empty sectors with 0 change
            for symbol, name in sectors.items():
                results.append({'symbol': symbol, 'sector': name, 'change_pct': 0.0})
        
        results.sort(key=lambda x: x['change_pct'], reverse=True)
        return jsonify({'sectors': results})
        
    except Exception as e:
        print(f"Heatmap critical error: {e}")
        return api_error(str(e))

@app.route('/api/market/screener_tech', methods=['GET'])
@cache.cached(timeout=300)
def get_tech_screener():
    """Scans S&P 100 for signals"""
    tickers = [
        "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "TSLA", "META", "BRK-B", "V", "JNJ",
        "WMT", "JPM", "PG", "MA", "UNH", "DIS", "HD", "GME", "AMC", "AMD", "INTC",
        "NFLX", "PYPL", "KO", "PEP", "COST", "AVGO", "CSCO", "TMUS", "CMCSA"
    ]
    scan_results = []
    try:
        data = yf.download(tickers, period="6mo", interval="1d", progress=False, group_by='ticker', threads=True)

        for symbol in tickers:
            try:
                if symbol not in data.columns.levels[0]: continue
                df = data[symbol].dropna()
                if len(df) < 50: continue

                close = df['Close']
                price = close.iloc[-1]
                change = ((price - close.iloc[-2]) / close.iloc[-2]) * 100

                rsi = RSIIndicator(close=close, window=14).rsi().iloc[-1]
                sma50 = SMAIndicator(close=close, window=50).sma_indicator().iloc[-1]
                sma200 = SMAIndicator(close=close, window=200).sma_indicator().iloc[-1] if len(close) > 200 else 0

                vol_avg = df['Volume'].tail(20).mean()
                rel_vol = (df['Volume'].iloc[-1] / vol_avg) if vol_avg > 0 else 1.0

                setup = []
                if rsi < 30: setup.append("RSI Oversold")
                elif rsi > 70: setup.append("RSI Overbought")

                if sma200 > 0:
                    if sma50 > sma200: setup.append("Trend Up")
                    else: setup.append("Trend Down")

                if rel_vol > 1.5: setup.append("High Volume")

                scan_results.append({
                    'ticker': symbol,
                    'price': round(float(price), 2),
                    'change': round(float(change), 2),
                    'rsi': round(float(rsi), 1),
                    'rel_vol': round(float(rel_vol), 1),
                    'setups': ", ".join(setup)
                })
            except: continue

        return jsonify({'results': scan_results})
    except Exception as e:
        return api_error(str(e))

@app.route('/api/market/earnings', methods=['GET'])
@cache.cached(timeout=86400)
def get_earnings_calendar():
    tickers_list = ["NVDA", "TSLA", "AAPL", "AMD", "AMZN", "MSFT", "GOOGL", "META", "NFLX", "GME", "PLTR", "COIN"]
    earnings_list = []
    today = datetime.date.today()
    try:
        tickers = yf.Tickers(" ".join(tickers_list))
        for sym in tickers_list:
            try:
                t = tickers.tickers[sym]
                cal = t.calendar
                if cal and 'Earnings Date' in cal:
                    dates = cal['Earnings Date']
                    if dates:
                        dates = sorted(dates)
                        for d in dates:
                            if d >= today:
                                earnings_list.append({
                                    'ticker': sym,
                                    'name': sym,
                                    'date': d.strftime('%Y-%m-%d'),
                                    'time': 'N/A'
                                })
                                break
            except: continue

        earnings_list.sort(key=lambda x: x['date'])
        return jsonify({'earnings': earnings_list})
    except Exception as e:
        return api_error(str(e))

@app.route('/api/market/forex', methods=['GET'])
@cache.cached(timeout=1800, query_string=True)
def get_forex_data():
    default_pairs = {
        'EURUSD=X': 'EUR/USD', 'JPY=X': 'USD/JPY', 'GBPUSD=X': 'GBP/USD',
        'EURJPY=X': 'EUR/JPY', 'EURGBP=X': 'EUR/GBP'
    }
    custom = request.args.get('tickers')
    target_pairs = default_pairs
    if custom:
        target_pairs = {s.strip(): s.strip() for s in custom.split(',') if s.strip()}

    results = []
    try:
        tickers_str = " ".join(target_pairs.keys())
        data = yf.download(tickers_str, period="1mo", interval="1d", progress=False, group_by='ticker', threads=True)

        for symbol, name in target_pairs.items():
            try:
                if len(target_pairs) == 1: df = data
                elif symbol in data.columns.levels[0]: df = data[symbol]
                else: continue

                if df.empty: continue
                df = df.dropna()
                current = df['Close'].iloc[-1]
                start = df['Close'].iloc[0]
                change = ((current - start) / start) * 100

                results.append({
                    'ticker': symbol,
                    'name': name,
                    'price': round(float(current), 4),
                    'change_1mo': round(float(change), 2),
                    'sparkline': df['Close'].tolist()
                })
            except: continue
        return jsonify({'forex': results})
    except Exception as e:
        return api_error(str(e))

@app.route('/api/market/macro', methods=['GET'])
@cache.cached(timeout=300)
def get_macro_data():
    """Crypto & Macro"""
    tickers = {'BTC-USD': 'Bitcoin', 'GC=F': 'Gold', 'CL=F': 'Crude Oil', '^TNX': '10Y Yield'}
    results = []
    try:
        data = yf.download(list(tickers.keys()), period="2d", group_by='ticker', progress=False)
        for symbol, name in tickers.items():
            try:
                if symbol in data.columns.levels[0]:
                    df = data[symbol].dropna()
                    if len(df) < 2: continue
                    price = df['Close'].iloc[-1]
                    change = ((price - df['Close'].iloc[-2]) / df['Close'].iloc[-2]) * 100
                    results.append({'ticker': symbol, 'name': name, 'price': round(float(price), 2), 'change_pct': round(float(change), 2)})
            except: pass
        return jsonify({'data': results})
    except Exception as e:
        return api_error(str(e))

@app.route('/api/market/social', methods=['GET'])
@cache.cached(timeout=600)
def get_social_sentiment():
    """Tracks trending/hype tickers sentiment (Simulated via Price Action)"""
    tickers = ["GME", "AMC", "TSLA", "NVDA", "PLTR", "COIN", "MSTR"]
    results = []
    try:
        # Batch download for efficiency
        data = yf.download(tickers, period="2d", group_by='ticker', progress=False, threads=True)

        for t in tickers:
            try:
                if t in data.columns.levels[0]:
                    df = data[t].dropna()
                elif len(tickers) == 1:
                    df = data
                else: continue

                if len(df) < 2: continue

                # Calculate intraday or 1d change
                # Approximating sentiment based on recent momentum
                close = df['Close'].iloc[-1]
                open_p = df['Open'].iloc[-1]

                # If we have 2 days, use prev close for better calc
                prev_close = df['Close'].iloc[-2]

                change = ((close - prev_close) / prev_close) * 100

                sentiment_score = 50 + change * 2
                sentiment_score = max(0, min(100, sentiment_score))

                status = "Neutral"
                if sentiment_score > 65: status = "Bullish Hype"
                elif sentiment_score < 35: status = "Bearish FUD"

                results.append({
                    'ticker': t,
                    'sentiment_score': round(sentiment_score, 0),
                    'status': status,
                    'mentions': int(abs(change) * 150) + 500
                })
            except Exception as ex:
                print(f"Social error {t}: {ex}")
                continue

        return jsonify({'social': results})
    except Exception as e:
        return api_error(str(e))

# --- NEW 2.0 FEATURES ---

@app.route('/api/tools/correlation', methods=['POST'])
@cache.cached(timeout=3600, make_cache_key=lambda: request.get_data().decode('utf-8'))
def get_correlation_matrix():
    """Calculates correlation matrix for a list of tickers"""
    data_req = request.get_json()
    tickers = data_req.get('tickers', [])
    if not tickers or len(tickers) < 2:
        return api_error("At least 2 tickers required")

    try:
        # Fetch 1y data
        data = yf.download(tickers, period="1y", interval="1d", progress=False, group_by='ticker', threads=True)

        # Extract Closes
        closes = pd.DataFrame()
        for t in tickers:
            try:
                if t in data.columns.levels[0]:
                    closes[t] = data[t]['Close']
            except: pass

        if closes.empty: return api_error("No data found")

        # Calculate Returns & Correlation
        returns = closes.pct_change().dropna()
        corr_matrix = returns.corr()

        # Format for Heatmap (x, y, value)
        matrix_data = []
        labels = corr_matrix.columns.tolist()

        for i, row in enumerate(labels):
            for j, col in enumerate(labels):
                val = corr_matrix.loc[row, col]
                matrix_data.append({
                    'x': row,
                    'y': col,
                    'value': round(float(val), 2)
                })

        return jsonify({'labels': labels, 'matrix': matrix_data})
    except Exception as e:
        return api_error(str(e))

@app.route('/api/tools/monte_carlo', methods=['GET'])
@cache.cached(timeout=600, query_string=True)
def get_monte_carlo():
    """Runs Monte Carlo Simulation for a ticker"""
    ticker = request.args.get('ticker')
    days = int(request.args.get('days', 30))
    sims = int(request.args.get('sims', 50))

    if not ticker: return api_error("Ticker required")

    try:
        stock = yf.Ticker(ticker)
        hist = stock.history(period="1y")
        if hist.empty: return api_error("No history")

        # Calculate returns, drift, vol
        log_returns = np.log(1 + hist['Close'].pct_change())
        u = log_returns.mean()
        var = log_returns.var()
        drift = u - (0.5 * var)
        stdev = log_returns.std()

        # Simulation
        days_array = range(days)
        paths = []
        last_price = hist['Close'].iloc[-1]

        for i in range(sims):
            daily_returns = np.exp(drift + stdev * np.random.normal(0, 1, days))
            price_path = [last_price]
            for r in daily_returns:
                price_path.append(price_path[-1] * r)
            paths.append(price_path)

        # Prepare for chart (Multi-series)
        formatted_paths = []
        for i, path in enumerate(paths):
            formatted_paths.append({
                'id': i,
                'data': [{'time': (datetime.date.today() + datetime.timedelta(days=d)).strftime('%Y-%m-%d'), 'value': round(p, 2)} for d, p in enumerate(path)]
            })

        return jsonify({
            'ticker': ticker,
            'last_price': round(last_price, 2),
            'simulations': formatted_paths
        })
    except Exception as e:
        return api_error(str(e))

@app.route('/api/market/sentiment_analysis', methods=['GET'])
@cache.cached(timeout=1800)
def get_ai_sentiment_summary():
    """Aggregates market news and generates AI summary"""
    if not client: return api_error("AI Service Unavailable", 503)

    try:
        # 1. Fetch Top Market News
        news_url = f'https://newsapi.org/v2/top-headlines?category=business&language=en&country=us&pageSize=15&apiKey={NEWS_API_KEY}'
        resp = requests.get(news_url).json()
        headlines = [a['title'] for a in resp.get('articles', [])]

        # 2. Fetch Index Performance
        status_resp = get_market_status()
        indices = status_resp.get_json().get('indices', [])
        market_context = ", ".join([f"{i['ticker']} {i['change_pct']}%" for i in indices])

        prompt = f"""
        Analyze the following market context and news headlines.
        Market: {market_context}.
        Headlines: {"; ".join(headlines)}.

        Provide a concise "Market Sentiment Report" with:
        1. Sentiment Score (0-100, where 0=Extreme Fear, 100=Extreme Greed).
        2. Key Narrative (What is driving the market?).
        3. Bullish/Bearish Verdict.

        Return JSON format: {{ "score": 50, "narrative": "...", "verdict": "..." }}
        """

        completion = client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"}
        )

        return completion.choices[0].message.content

    except Exception as e:
        return api_error(str(e))

# --- STOCK DETAILS (Restore dashboard_data) ---

@app.route('/api/dashboard_data', methods=['GET'])
@cache.cached(query_string=True)
def get_dashboard_data():
    """
    Consolidated endpoint for Chart + Verdict Data.
    Replaces get_history and includes Verdict logic.
    """
    ticker_symbol = request.args.get('ticker')
    period = request.args.get('period', '1y')

    if not ticker_symbol:
        return api_error('No ticker provided', 400)

    # Map frontend period to yfinance period & interval
    yf_period = period
    interval = "1d"

    if period == "1d":
        yf_period = "1d"
        interval = "2m"
    elif period == "1w":
        yf_period = "5d"
        interval = "15m"
    elif period == "1mo":
        yf_period = "1mo"
        interval = "60m"

    try:
        stock = yf.Ticker(ticker_symbol)
        hist = stock.history(period=yf_period, interval=interval)

        if hist.empty:
             return api_error('No historical data found', 404)

        # Fix timezone for lightweight charts if necessary
        # Usually strftime works fine.

        ohlc_data = []
        volume_data = []

        for date, row in hist.iterrows():
            # Format time consistently based on interval
            time_str = date.strftime('%Y-%m-%d %H:%M') if interval != "1d" else date.strftime('%Y-%m-%d')

            ohlc_data.append({
                'time': time_str,
                'open': row['Open'],
                'high': row['High'],
                'low': row['Low'],
                'close': row['Close']
            })
            vol_color = 'rgba(38, 166, 154, 0.5)' if row['Close'] >= row['Open'] else 'rgba(239, 83, 80, 0.5)'
            volume_data.append({
                'time': time_str,
                'value': row['Volume'],
                'color': vol_color
            })

        # Calculate Indicators (on Close series)
        close_series = hist['Close']

        sma50_data = []
        bb_upper_data = []
        bb_lower_data = []

        # Helper function for consistent time formatting
        def format_indicator_time(timestamp):
            return timestamp.strftime('%Y-%m-%d %H:%M') if interval != "1d" else timestamp.strftime('%Y-%m-%d')

        # Only calc if enough data
        if len(close_series) >= 20:
            bb = BollingerBands(close=close_series, window=20, window_dev=2)
            bb_upper = bb.bollinger_hband()
            bb_lower = bb.bollinger_lband()

            bb_upper_data = [{'time': format_indicator_time(k), 'value': v} for k, v in bb_upper.items() if not np.isnan(v)]
            bb_lower_data = [{'time': format_indicator_time(k), 'value': v} for k, v in bb_lower.items() if not np.isnan(v)]

        if len(close_series) >= 50:
            sma50 = SMAIndicator(close=close_series, window=50).sma_indicator()
            sma50_data = [{'time': format_indicator_time(k), 'value': v} for k, v in sma50.items() if not np.isnan(v)]

        # --- VERDICT LOGIC ---
        score = 0
        reasons = []

        # Simple Tech Check
        current_price = close_series.iloc[-1]

        # SMA 200
        sma200_val = 0
        if len(close_series) >= 200:
            sma200 = SMAIndicator(close=close_series, window=200).sma_indicator()
            sma200_val = sma200.iloc[-1]
            if not np.isnan(sma200_val):
                if current_price > sma200_val:
                    score += 2
                    reasons.append("Price > SMA 200 (Long-term Uptrend)")
                else:
                    score -= 2
                    reasons.append("Price < SMA 200 (Long-term Downtrend)")

        # RSI
        rsi_val = RSIIndicator(close=close_series, window=14).rsi().iloc[-1]
        if rsi_val > 70:
            score -= 1
            reasons.append(f"RSI Overbought ({round(rsi_val,1)})")
        elif rsi_val < 30:
            score += 1
            reasons.append(f"RSI Oversold ({round(rsi_val,1)})")
        else:
            reasons.append(f"RSI Neutral ({round(rsi_val,1)})")

        # MACD
        macd = MACD(close=close_series)
        macd_diff = macd.macd_diff().iloc[-1]
        if macd_diff > 0:
            score += 1
            reasons.append("MACD Momentum Positive")
        else:
            score -= 1
            reasons.append("MACD Momentum Negative")

        # Verdict String
        if score >= 3:
            signal = "Strong Buy"
            signal_color = "#00b894" # Green
        elif score >= 1:
            signal = "Buy"
            signal_color = "#55efc4"
        elif score <= -3:
            signal = "Strong Sell"
            signal_color = "#d63031" # Red
        elif score <= -1:
            signal = "Sell"
            signal_color = "#ff7675"
        else:
            signal = "Neutral"
            signal_color = "#b2bec3"

        verdict = {
            'signal': signal,
            'score': score,
            'color': signal_color,
            'reasons': reasons
        }

        # Markers (Golden Cross and Death Cross Detection)
        markers = []
        
        if len(close_series) >= 200 and len(sma50_data) > 0:
            # Calculate SMA 200 for cross detection
            sma50_series = SMAIndicator(close=close_series, window=50).sma_indicator()
            sma200_series = SMAIndicator(close=close_series, window=200).sma_indicator()
            
            # Find crossover points
            for i in range(1, len(sma50_series)):
                if pd.isna(sma50_series.iloc[i]) or pd.isna(sma200_series.iloc[i]):
                    continue
                if pd.isna(sma50_series.iloc[i-1]) or pd.isna(sma200_series.iloc[i-1]):
                    continue
                    
                sma50_current = sma50_series.iloc[i]
                sma50_prev = sma50_series.iloc[i-1]
                sma200_current = sma200_series.iloc[i]
                sma200_prev = sma200_series.iloc[i-1]
                
                # Golden Cross: SMA 50 crosses ABOVE SMA 200
                if sma50_prev <= sma200_prev and sma50_current > sma200_current:
                    marker_time = format_indicator_time(sma50_series.index[i])
                    markers.append({
                        'time': marker_time,
                        'position': 'belowBar',
                        'color': '#00b894',  # Green
                        'shape': 'arrowUp',
                        'text': 'Golden Cross',
                        'size': 2
                    })
                
                # Death Cross: SMA 50 crosses BELOW SMA 200
                elif sma50_prev >= sma200_prev and sma50_current < sma200_current:
                    marker_time = format_indicator_time(sma50_series.index[i])
                    markers.append({
                        'time': marker_time,
                        'position': 'aboveBar',
                        'color': '#ff4757',  # Red
                        'shape': 'arrowDown',
                        'text': 'Death Cross',
                        'size': 2
                    })

        response_data = {
            'ohlc': ohlc_data,
            'volume': volume_data,
            'indicators': {
                'sma50': sma50_data,
                'bb_upper': bb_upper_data,
                'bb_lower': bb_lower_data
            },
            'markers': markers,
            'verdict': verdict
        }
        return jsonify(response_data)

    except Exception as e:
        print(f"Dashboard Data Error: {e}")
        return api_error(str(e))

@app.route('/api/info', methods=['GET'])
@cache.cached(query_string=True, timeout=1800)  # 30 min cache
def get_info():
    ticker = request.args.get('ticker')
    if not ticker: return api_error("Ticker missing", 400)
    try:
        # Get base info from Massive (name, sector, marketcap)
        info = massive_service.get_ticker_details(ticker)
        technicals = {}
        
        # Get additional data from yfinance (P/E, Dividend, Price)
        try:
            t = yf.Ticker(ticker)
            yf_info = t.info  # Get full info dict from yfinance
            
            # Get current price (fast)
            if hasattr(t, 'fast_info'):
                price = t.fast_info.get('last_price', 'N/A')
            else:
                hist = t.history(period="1d")
                price = hist['Close'].iloc[-1] if not hist.empty else 'N/A'

            info['currentPrice'] = round(price, 2) if isinstance(price, (int, float)) else price

            # Get P/E Ratio from yfinance (FREE!)
            if yf_info and isinstance(yf_info, dict):
                # Try multiple fields (different tickers use different keys)
                pe_ratio = yf_info.get('trailingPE') or yf_info.get('forwardPE') or 'N/A'
                if pe_ratio != 'N/A' and pe_ratio is not None:
                    info['peRatio'] = round(pe_ratio, 2)
                else:
                    info['peRatio'] = 'N/A'
                
                # Get Dividend Yield from yfinance
                div_yield = yf_info.get('dividendYield') or yf_info.get('trailingAnnualDividendYield')
                if div_yield and div_yield != 'N/A':
                    info['dividendYield'] = f"{round(div_yield * 100, 2)}%"  # Convert to percentage
                else:
                    info['dividendYield'] = 'N/A'
                
                # Also get sector if Massive didn't provide it
                if info.get('sector') == 'N/A':
                    info['sector'] = yf_info.get('sector', 'N/A')

            # Techs (OPTIMIZED - use only 60 days instead of 6mo)
            hist = t.history(period="60d")
            if not hist.empty and len(hist) >= 14:
                try:
                    rsi = RSIIndicator(close=hist["Close"], window=14).rsi().iloc[-1]
                    if not pd.isna(rsi):
                        technicals['RSI (14)'] = round(rsi, 2)
                except:
                    pass
        except Exception as e:
            print(f"Info API error for {ticker}: {e}")
            # Ensure fields exist even on error
            if 'peRatio' not in info:
                info['peRatio'] = 'N/A'
            if 'dividendYield' not in info:
                info['dividendYield'] = 'N/A'

        return jsonify({'info': info, 'technicals': technicals})
    except Exception as e:
        return api_error(str(e))

@app.route('/api/search', methods=['GET'])
def search_ticker():
    query = request.args.get('q')
    if not query: return jsonify({'results': []})
    try:
        url = f"https://query2.finance.yahoo.com/v1/finance/search?q={query}&quotesCount=5"
        headers = {'User-Agent': 'Mozilla/5.0'}
        r = requests.get(url, headers=headers).json()
        results = [{'symbol': q.get('symbol'), 'shortname': q.get('shortname', '')} for q in r.get('quotes', [])]
        return jsonify({'results': results})
    except: return jsonify({'results': []})

@app.route('/api/ai', methods=['GET'])
@cache.cached(query_string=True)
def get_ai_summary():
    ticker = request.args.get('ticker')
    if not client: return api_error("AI disabled", 503)
    try:
        prompt = f"Summary for stock {ticker}. Include strengths, risks, prediction. Markdown format."
        completion = client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[{"role": "user", "content": prompt}]
        )
        return jsonify({'summary': completion.choices[0].message.content})
    except Exception as e: return api_error(str(e))

@app.route('/api/stock/deep_dive', methods=['GET'])
@cache.cached(query_string=True, timeout=3600)
def get_deep_dive_analysis():
    """Fetches last 5 earnings, price reaction, and AI analysis"""
    ticker = request.args.get('ticker')
    if not ticker: return api_error("Ticker required", 400)

    try:
        stock = yf.Ticker(ticker)

        # 1. Fetch Earnings Dates
        earnings_dates = stock.earnings_dates
        if earnings_dates is None or earnings_dates.empty:
             return api_error("No earnings data available", 404)

        # Fetch Financials for Revenue
        try:
            financials = stock.quarterly_income_stmt
            # Ensure index is datetime
            if financials is not None and not financials.empty:
                financials.columns = pd.to_datetime(financials.columns)
        except:
            financials = None

        # Filter for PAST earnings only
        now = pd.Timestamp.now().tz_localize(earnings_dates.index.dtype.tz) if earnings_dates.index.tz else pd.Timestamp.now()
        past_earnings = earnings_dates[earnings_dates.index < now].head(5)

        # 2. Fetch Price History (1y buffer to cover lookbacks)
        # We need enough history to find dates around these earnings
        hist = stock.history(period="2y") # Safer 2y

        earnings_data = []

        for date_idx, row in past_earnings.iterrows():
            # Convert index to date object for comparison
            e_date = date_idx.date()

            # Match Revenue (Find closest quarter end BEFORE earnings date)
            rev_actual = 0
            if financials is not None:
                try:
                    # Filter columns before e_date
                    valid_dates = [d for d in financials.columns if d.date() < e_date]
                    if valid_dates:
                        # Get max date (closest to e_date)
                        closest = max(valid_dates)
                        # Check if within reasonable window (e.g. 90 days)
                        if (e_date - closest.date()).days < 100:
                            rev = financials.loc['Total Revenue', closest]
                            rev_actual = float(rev)
                except Exception as rev_e:
                    print(f"Revenue match error: {rev_e}")

            # Find nearest trading day in history
            # If e_date in history, great. If not (weekend/after hours), take next.

            # Logic: Reaction is usually measured from "Day Before Close" to "Day After Close"
            # or "Day Of Close" (if AM) vs "Day After".
            # Simplified: Change from T-1 Close to T+1 Close (2 day move).

            # Find T-1 (Pre-Earnings)
            # Find T+1 (Post-Earnings)

            try:
                # Localize e_date to match hist index if needed, but usually just date comparison works if we strip time
                # History index is DatetimeIndex.

                # Get the integer location of the earnings date in history
                # We use 'asof' logic or similar
                # Let's find the closest date in history <= e_date

                # Ensure hist index is naive or we handle TZ
                hist_dates = hist.index.date

                # Find index of e_date or nearest previous
                idx_loc = -1
                for i, d in enumerate(hist_dates):
                    if d == e_date:
                        idx_loc = i
                        break
                    if d > e_date: # We went past it, so previous was it (or it was weekend)
                        idx_loc = i - 1
                        break

                if idx_loc == -1: idx_loc = len(hist) - 1 # Should not happen if within 2y

                # Now calculate move
                # We want 1 day before earnings vs 1 day after earnings
                # Check bounds
                if idx_loc > 0 and idx_loc < len(hist) - 1:
                    pre_price = hist['Close'].iloc[idx_loc - 1]
                    post_price = hist['Close'].iloc[idx_loc + 1]

                    move_pct = ((post_price - pre_price) / pre_price) * 100
                else:
                    move_pct = 0.0

                # Actual / Estimate
                est = row['EPS Estimate'] if 'EPS Estimate' in row else None
                act = row['Reported EPS'] if 'Reported EPS' in row else None

                surprise = 0
                if est and act and not pd.isna(est) and not pd.isna(act):
                     surprise = ((act - est) / abs(est)) * 100 if est != 0 else 0

                earnings_data.append({
                    'date': e_date.strftime('%Y-%m-%d'),
                    'estimate': round(est, 2) if est and not pd.isna(est) else None,
                    'actual': round(act, 2) if act and not pd.isna(act) else None,
                    'revenue': rev_actual,
                    'surprise': round(surprise, 2) if surprise else 0,
                    'price_reaction': round(move_pct, 2)
                })

            except Exception as inner_e:
                print(f"Error processing earnings date {e_date}: {inner_e}")
                continue

        # 3. AI Analysis
        ai_analysis = {}
        if client:
            # Construct prompt
            earnings_summary = "\n".join([f"Date: {e['date']}, Actual: {e['actual']}, Est: {e['estimate']}, Reaction: {e['price_reaction']}%" for e in earnings_data])

            prompt = f"""
            Analyze {ticker} based on its last 5 earnings results:
            {earnings_summary}

            Also consider general market knowledge about {ticker}.

            Provide a response in JSON format with these keys:
            - bull_case: (String) Top 3 bull arguments.
            - bear_case: (String) Top 3 bear arguments.
            - risks: (String) Key risks.
            - opportunities: (String) Key opportunities.

            Keep it concise and professional.
            """

            try:
                completion = client.chat.completions.create(
                    model=OPENAI_MODEL,
                    messages=[{"role": "user", "content": prompt}],
                    response_format={"type": "json_object"}
                )
                import json
                ai_analysis = json.loads(completion.choices[0].message.content)
            except Exception as ai_e:
                print(f"AI Error: {ai_e}")
                ai_analysis = {
                    'bull_case': "AI Analysis Unavailable",
                    'bear_case': "AI Analysis Unavailable",
                    'risks': "AI Analysis Unavailable",
                    'opportunities': "AI Analysis Unavailable"
                }
        else:
             ai_analysis = {
                'bull_case': "AI Configuration Missing",
                'bear_case': "AI Configuration Missing",
                'risks': "AI Configuration Missing",
                'opportunities': "AI Configuration Missing"
            }

        return jsonify({
            'ticker': ticker,
            'earnings': earnings_data,
            'ai_analysis': ai_analysis
        })

    except Exception as e:
        return api_error(str(e))

# --- OPTIONS CHAIN ---
@app.route('/api/options/chain', methods=['GET'])
@cache.cached(query_string=True, timeout=1800)
def get_options_chain():
    """Returns options chain for a given ticker"""
    ticker = request.args.get('ticker')
    if not ticker: return api_error("Ticker required", 400)
    
    try:
        stock = yf.Ticker(ticker)
        
        # Get current price
        hist = stock.history(period="1d")
        if hist.empty: return api_error("No price data", 404)
        current_price = float(hist['Close'].iloc[-1])
        
        # Get options dates
        expirations = stock.options
        if not expirations or len(expirations) == 0:
            return api_error("No options available", 404)
        
        # Get nearest expiration
        exp_date = expirations[0]
        opt_chain = stock.option_chain(exp_date)
        
        # Format calls and puts
        calls = []
        puts = []
        
        if hasattr(opt_chain, 'calls') and not opt_chain.calls.empty:
            for _, row in opt_chain.calls.iterrows():
                calls.append({
                    'strike': float(row['strike']),
                    'lastPrice': float(row['lastPrice']) if pd.notna(row['lastPrice']) else None,
                    'volume': int(row['volume']) if pd.notna(row['volume']) else 0,
                    'openInterest': int(row['openInterest']) if pd.notna(row['openInterest']) else 0,
                    'impliedVolatility': float(row['impliedVolatility']) if pd.notna(row['impliedVolatility']) else None
                })
        
        if hasattr(opt_chain, 'puts') and not opt_chain.puts.empty:
            for _, row in opt_chain.puts.iterrows():
                puts.append({
                    'strike': float(row['strike']),
                    'lastPrice': float(row['lastPrice']) if pd.notna(row['lastPrice']) else None,
                    'volume': int(row['volume']) if pd.notna(row['volume']) else 0,
                    'openInterest': int(row['openInterest']) if pd.notna(row['openInterest']) else 0,
                    'impliedVolatility': float(row['impliedVolatility']) if pd.notna(row['impliedVolatility']) else None
                })
        
        return jsonify({
            'ticker': ticker,
            'current_price': round(current_price, 2),
            'expiry': exp_date,
            'calls': calls,
            'puts': puts
        })
    except Exception as e:
        return api_error(str(e))

# --- PATTERN RECOGNITION ---
@app.route('/api/patterns/detect', methods=['GET'])
@cache.cached(query_string=True, timeout=3600)
def detect_patterns():
    """Detects chart patterns using technical analysis"""
    ticker = request.args.get('ticker')
    if not ticker: return api_error("Ticker required", 400)
    
    try:
        stock = yf.Ticker(ticker)
        hist = stock.history(period="6mo", interval="1d")
        
        if hist.empty or len(hist) < 50:
            return api_error("Insufficient data", 404)
        
        patterns = []
        close = hist['Close']
        high = hist['High']
        low = hist['Low']
        
        # Pattern 1: Golden Cross (SMA 50 crosses above SMA 200)
        if len(close) >= 200:
            sma50 = SMAIndicator(close=close, window=50).sma_indicator()
            sma200 = SMAIndicator(close=close, window=200).sma_indicator()
            
            if len(sma50) > 1 and len(sma200) > 1:
                if sma50.iloc[-2] <= sma200.iloc[-2] and sma50.iloc[-1] > sma200.iloc[-1]:
                    patterns.append({
                        'name': 'Golden Cross',
                        'signal': 'bullish',
                        'confidence': 85,
                        'description': 'SMA 50 crossed above SMA 200 - Strong bullish signal',
                        'success_rate': '65%'
                    })
                elif sma50.iloc[-2] >= sma200.iloc[-2] and sma50.iloc[-1] < sma200.iloc[-1]:
                    patterns.append({
                        'name': 'Death Cross',
                        'signal': 'bearish',
                        'confidence': 82,
                        'description': 'SMA 50 crossed below SMA 200 - Strong bearish signal',
                        'success_rate': '62%'
                    })
        
        # Pattern 2: RSI Divergence
        rsi = RSIIndicator(close=close, window=14).rsi()
        if len(rsi) > 20:
            # Bullish divergence: Price making lower lows, RSI making higher lows
            recent_close = close.tail(20)
            recent_rsi = rsi.tail(20)
            
            close_min_idx = recent_close.idxmin()
            rsi_min_idx = recent_rsi.idxmin()
            
            if close_min_idx < rsi_min_idx and recent_close.iloc[-1] < recent_close.iloc[0]:
                patterns.append({
                    'name': 'Bullish RSI Divergence',
                    'signal': 'bullish',
                    'confidence': 72,
                    'description': 'Price making lower lows while RSI shows strength',
                    'success_rate': '58%'
                })
        
        # Pattern 3: Bollinger Band Squeeze
        if len(close) >= 20:
            bb = BollingerBands(close=close, window=20, window_dev=2)
            bb_width = (bb.bollinger_hband() - bb.bollinger_lband()) / bb.bollinger_mavg()
            
            if len(bb_width) > 20:
                avg_width = bb_width.tail(100).mean()
                current_width = bb_width.iloc[-1]
                
                if current_width < avg_width * 0.5:
                    patterns.append({
                        'name': 'Bollinger Band Squeeze',
                        'signal': 'neutral',
                        'confidence': 68,
                        'description': 'Volatility compression - Big move likely ahead',
                        'success_rate': '55%'
                    })
        
        # Pattern 4: Cup and Handle (Simplified)
        if len(close) >= 60:
            window = close.tail(60)
            mid_point = len(window) // 2
            
            left_side = window.iloc[:mid_point]
            right_side = window.iloc[mid_point:]
            
            # Check for cup shape
            if left_side.iloc[0] > left_side.min() and right_side.iloc[-1] > right_side.min():
                if abs(left_side.iloc[0] - right_side.iloc[-1]) / left_side.iloc[0] < 0.1:
                    patterns.append({
                        'name': 'Cup Pattern',
                        'signal': 'bullish',
                        'confidence': 70,
                        'description': 'Potential cup formation - Watch for handle breakout',
                        'success_rate': '60%'
                    })
        
        # Pattern 5: Head and Shoulders (Basic detection)
        if len(high) >= 30:
            window = high.tail(30).reset_index(drop=True)
            
            # Find 3 peaks
            peaks = []
            for i in range(1, len(window) - 1):
                if window[i] > window[i-1] and window[i] > window[i+1]:
                    peaks.append((i, window[i]))
            
            if len(peaks) >= 3:
                # Check if middle peak is highest (head) and sides are similar (shoulders)
                peaks = sorted(peaks, key=lambda x: x[1], reverse=True)
                head = peaks[0]
                shoulders = peaks[1:3]
                
                if abs(shoulders[0][1] - shoulders[1][1]) / shoulders[0][1] < 0.15:
                    patterns.append({
                        'name': 'Head and Shoulders',
                        'signal': 'bearish',
                        'confidence': 75,
                        'description': 'Classic reversal pattern detected',
                        'success_rate': '64%'
                    })
        
        # Sort by confidence
        patterns.sort(key=lambda x: x['confidence'], reverse=True)
        
        return jsonify({
            'ticker': ticker,
            'patterns': patterns,
            'analyzed_period': '6 months'
        })
        
    except Exception as e:
        return api_error(str(e))

# --- REAL-TIME PRICE UPDATES ---
@app.route('/api/realtime/prices', methods=['POST'])
def get_realtime_prices():
    """Batch fetch current prices for multiple tickers"""
    data = request.get_json()
    tickers = data.get('tickers', [])
    
    if not tickers or len(tickers) == 0:
        return api_error("No tickers provided", 400)
    
    try:
        results = {}
        data = yf.download(tickers, period="1d", interval="1m", progress=False, threads=True)
        
        for ticker in tickers:
            try:
                if len(tickers) == 1:
                    df = data
                elif ticker in data.columns.levels[0]:
                    df = data[ticker]
                else:
                    continue
                
                if not df.empty:
                    close = df['Close'].dropna()
                    if len(close) > 0:
                        current = float(close.iloc[-1])
                        prev = float(close.iloc[0]) if len(close) > 1 else current
                        change = ((current - prev) / prev) * 100
                        
                        results[ticker] = {
                            'price': round(current, 2),
                            'change': round(change, 2),
                            'timestamp': datetime.datetime.now().isoformat()
                        }
            except:
                continue
        
        return jsonify(results)
    except Exception as e:
        return api_error(str(e))

if __name__ == '__main__':
    app.run(debug=True, port=5000)
