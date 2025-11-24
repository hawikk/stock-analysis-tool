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
if OPENAI_API_KEY:
    client = OpenAI(api_key=OPENAI_API_KEY)
else:
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
        # 'group_by=ticker' ensures we get a MultiIndex or dict-like structure we can iterate comfortably
        data = yf.download(tickers, period="2d", group_by='ticker', progress=False, threads=True)

        for symbol, name in indices.items():
            try:
                # Handle DataFrame structure depending on single/multi result
                if len(tickers) == 1:
                    df = data
                else:
                    # Check if symbol is in top level columns
                    if symbol not in data.columns.levels[0]:
                        continue
                    df = data[symbol]

                if len(df) >= 1:
                    price = df['Close'].iloc[-1]
                    prev_close = df['Close'].iloc[-2] if len(df) > 1 else df['Open'].iloc[-1]

                    # If data is super fresh (intraday), Open might be today's open.
                    # Ideally we want previous day close.
                    # yf.download(period='2d') gives yesterday and today (if market open).

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

        # Fallback to SPY news
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

    # Jobless Claims (Thurs)
    next_thursday = next_weekday(today, 3)
    events.append({
        "date": next_thursday.strftime('%Y-%m-%d'),
        "time": "08:30 AM",
        "event": "Initial Jobless Claims",
        "impact": "Medium",
        "previous": "210K",
        "forecast": "215K"
    })

    # CPI (Approx 12th)
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

    # NFP (First Friday)
    next_nfp_month = today.month + 1 if today.month < 12 else 1
    next_nfp_year = today.year if today.month < 12 else today.year + 1
    d = datetime.date(next_nfp_year, next_nfp_month, 1)
    while d.weekday() != 4: d += datetime.timedelta(days=1)

    # Check if this month's NFP passed
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

    # FOMC
    next_fomc = next_weekday(today, 2) # Random Wed placeholder for logic
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
        data = yf.download(tickers, period="2d", group_by='ticker', progress=False, threads=True)

        for symbol, name in sectors.items():
            try:
                if len(tickers) > 1 and symbol in data.columns.levels[0]:
                    df = data[symbol]
                elif len(tickers) == 1:
                    df = data
                else: continue

                if df.empty: continue

                # Check for NaNs
                df = df.dropna()
                if len(df) < 2: continue

                change = ((df['Close'].iloc[-1] - df['Close'].iloc[-2]) / df['Close'].iloc[-2]) * 100
                results.append({
                    'symbol': symbol,
                    'sector': name,
                    'change_pct': round(float(change), 2)
                })
            except:
                results.append({'symbol': symbol, 'sector': name, 'change_pct': 0.0})

        results.sort(key=lambda x: x['change_pct'], reverse=True)
        return jsonify({'sectors': results})
    except Exception as e:
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

                # Indicators
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
    """Live Earnings Scan"""
    tickers_list = ["NVDA", "TSLA", "AAPL", "AMD", "AMZN", "MSFT", "GOOGL", "META", "NFLX", "GME", "PLTR", "COIN"]
    earnings_list = []
    today = datetime.date.today()
    try:
        tickers = yf.Tickers(" ".join(tickers_list))
        for sym in tickers_list:
            try:
                # yfinance calendar access
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

# --- NEW 2.0 FEATURES ---

@app.route('/api/tools/correlation', methods=['POST'])
@cache.cached(timeout=3600, make_cache_key=lambda: request.get_data())
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

# --- STOCK DETAILS (Existing) ---

@app.route('/api/info', methods=['GET'])
@cache.cached(query_string=True)
def get_info():
    ticker = request.args.get('ticker')
    if not ticker: return api_error("Ticker missing", 400)
    try:
        info = massive_service.get_ticker_details(ticker)
        # Add price
        try:
            t = yf.Ticker(ticker)
            hist = t.history(period="1y")
            if not hist.empty:
                info['currentPrice'] = round(hist['Close'].iloc[-1], 2)

                # Techs
                rsi = RSIIndicator(close=hist["Close"], window=14).rsi().iloc[-1]
                macd = MACD(close=hist["Close"]).macd().iloc[-1]
                sma50 = SMAIndicator(close=hist["Close"], window=50).sma_indicator().iloc[-1]

                technicals = {
                    'RSI (14)': round(rsi, 2),
                    'MACD': round(macd, 2),
                    'SMA (50)': round(sma50, 2)
                }
            else: technicals = {}
        except: technicals = {}

        return jsonify({'info': info, 'technicals': technicals})
    except Exception as e:
        return api_error(str(e))

@app.route('/api/history', methods=['GET'])
@cache.cached(query_string=True)
def get_history():
    ticker = request.args.get('ticker')
    if not ticker: return api_error("Ticker missing", 400)
    try:
        # Optimized period mapping
        period = request.args.get('period', '1y')
        # Map period to interval
        interval = "1d"
        if period == "1d": interval = "2m"
        elif period == "5d": interval = "15m"
        elif period == "1mo": interval = "60m"
        
        t = yf.Ticker(ticker)
        hist = t.history(period=period, interval=interval)

        if hist.empty: return api_error("No data", 404)

        # Prepare for lightweight charts
        ohlc = []
        volume = []
        
        for date, row in hist.iterrows():
            time_str = date.strftime('%Y-%m-%d %H:%M') if interval != "1d" else date.strftime('%Y-%m-%d')
            # Handle timestamps for chart
            # Lightweight charts prefers YYYY-MM-DD for daily, timestamp for intraday

            ohlc.append({
                'time': time_str,
                'open': row['Open'], 'high': row['High'], 'low': row['Low'], 'close': row['Close']
            })
            volume.append({
                'time': time_str, 'value': row['Volume'],
                'color': 'rgba(38, 166, 154, 0.5)' if row['Close'] >= row['Open'] else 'rgba(239, 83, 80, 0.5)'
            })

        # Indicators for Chart
        close = hist['Close']
        indicators = {}
        if len(close) > 20:
            bb = BollingerBands(close=close, window=20)
            indicators['bb_upper'] = [{'time': k.strftime('%Y-%m-%d'), 'value': v} for k, v in bb.bollinger_hband().items() if not np.isnan(v)]
            indicators['bb_lower'] = [{'time': k.strftime('%Y-%m-%d'), 'value': v} for k, v in bb.bollinger_lband().items() if not np.isnan(v)]

        if len(close) > 50:
            sma = SMAIndicator(close=close, window=50).sma_indicator()
            indicators['sma50'] = [{'time': k.strftime('%Y-%m-%d'), 'value': v} for k, v in sma.items() if not np.isnan(v)]

        return jsonify({'ohlc': ohlc, 'volume': volume, 'indicators': indicators})

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
    """Existing AI summary"""
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

@app.route('/api/chat', methods=['POST'])
def chat_bot():
    if not client: return api_error("Chat disabled", 503)
    data = request.get_json()
    try:
        completion = client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[
                {"role": "system", "content": f"Financial assistant for {data.get('ticker')}."},
                {"role": "user", "content": data.get('message')}
            ]
        )
        return jsonify({'reply': completion.choices[0].message.content})
    except Exception as e: return api_error(str(e))

if __name__ == '__main__':
    app.run(debug=True, port=5000)
