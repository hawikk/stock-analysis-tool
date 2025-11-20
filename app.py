# ... (existing imports) ...
import os
from dotenv import load_dotenv
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

# Load environment variables
load_dotenv()

app = Flask(__name__)

# ... (existing cache config) ...
# Cache Configuration - Use FileSystemCache for persistence
cache = Cache(app, config={
    'CACHE_TYPE': 'FileSystemCache',
    'CACHE_DIR': 'flask_cache',
    'CACHE_DEFAULT_TIMEOUT': 3600, # 1 hour
    'CACHE_THRESHOLD': 500 # Maximum number of items
})

# ... (existing configuration) ...
# Configuration
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
NEWS_API_KEY = os.getenv("NEWS_API_KEY")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-5-mini-2025-08-07")

client = OpenAI(api_key=OPENAI_API_KEY)

@app.route('/')
def index():
    return render_template('index.html')

# ... (existing /api/info) ...
@app.route('/api/info', methods=['GET'])
@cache.cached(query_string=True)
def get_info():
    ticker_symbol = request.args.get('ticker')
    if not ticker_symbol:
        return jsonify({'error': 'No ticker provided'}), 400

    try:
        stock = yf.Ticker(ticker_symbol)
        info = stock.info
        
        # Get historical data for technicals
        hist = stock.history(period="1y")
        if hist.empty:
             return jsonify({'error': 'No historical data found'}), 404

        # Calculate Technicals (5 best)
        # 1. RSI
        rsi = RSIIndicator(close=hist["Close"], window=14)
        current_rsi = rsi.rsi().iloc[-1]

        # 2. MACD
        macd = MACD(close=hist["Close"])
        current_macd = macd.macd().iloc[-1]
        current_macd_signal = macd.macd_signal().iloc[-1]

        # 3. SMA 50
        sma50 = SMAIndicator(close=hist["Close"], window=50)
        current_sma50 = sma50.sma_indicator().iloc[-1]

        # 4. SMA 200
        sma200 = SMAIndicator(close=hist["Close"], window=200)
        current_sma200 = sma200.sma_indicator().iloc[-1]

        # 5. Bollinger Bands
        bb = BollingerBands(close=hist["Close"], window=20)
        current_bb_high = bb.bollinger_hband().iloc[-1]
        current_bb_low = bb.bollinger_lband().iloc[-1]

        # Extract website for logo fallback
        website = info.get('website', '')
        logo_url = ""
        if 'logo_url' in info and info['logo_url']:
             logo_url = info['logo_url']
        elif website:
            # Simple hack to get logo from clearbit
            domain = website.replace('https://', '').replace('http://', '').replace('www.', '').split('/')[0]
            logo_url = f"https://logo.clearbit.com/{domain}"

        company_info = {
            'name': info.get('longName', ticker_symbol),
            'sector': info.get('sector', 'N/A'),
            'industry': info.get('industry', 'N/A'),
            'summary': info.get('longBusinessSummary', 'N/A'),
            'currentPrice': info.get('currentPrice', 'N/A'),
            'marketCap': info.get('marketCap', 'N/A'),
            'peRatio': info.get('trailingPE', 'N/A'),
            'dividendYield': info.get('dividendYield', 'N/A'),
            'fiftyTwoWeekHigh': info.get('fiftyTwoWeekHigh', 'N/A'),
            'fiftyTwoWeekLow': info.get('fiftyTwoWeekLow', 'N/A'),
            'logo': logo_url
        }

        technicals = {
            'RSI (14)': round(current_rsi, 2),
            'MACD': round(current_macd, 2),
            'MACD Signal': round(current_macd_signal, 2),
            'SMA (50)': round(current_sma50, 2) if not np.isnan(current_sma50) else "N/A",
            'SMA (200)': round(current_sma200, 2) if not np.isnan(current_sma200) else "N/A",
            'Bollinger High': round(current_bb_high, 2),
            'Bollinger Low': round(current_bb_low, 2)
        }

        return jsonify({'info': company_info, 'technicals': technicals})

    except Exception as e:
        print(f"Error in info: {e}")
        return jsonify({'error': str(e)}), 500

# ... (existing /api/history) ...
@app.route('/api/history', methods=['GET'])
@cache.cached(query_string=True)
def get_history():
    ticker_symbol = request.args.get('ticker')
    period = request.args.get('period', '1y')
    
    if not ticker_symbol:
        return jsonify({'error': 'No ticker provided'}), 400

    try:
        stock = yf.Ticker(ticker_symbol)
        hist = stock.history(period=period)
        
        if hist.empty:
             return jsonify({'error': 'No historical data found'}), 404
        
        # Convert timestamps to string
        dates = hist.index.strftime('%Y-%m-%d').tolist()
        prices = hist['Close'].tolist()
        opens = hist['Open'].tolist()
        highs = hist['High'].tolist()
        lows = hist['Low'].tolist()
        volumes = hist['Volume'].tolist()

        return jsonify({
            'dates': dates,
            'close': prices,
            'open': opens,
            'high': highs,
            'low': lows,
            'volume': volumes
        })
    except Exception as e:
        print(f"Error in history: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/dashboard_data', methods=['GET'])
@cache.cached(query_string=True)
def get_dashboard_data():
    ticker_symbol = request.args.get('ticker')
    if not ticker_symbol:
        return jsonify({'error': 'No ticker provided'}), 400

    try:
        stock = yf.Ticker(ticker_symbol)
        hist = stock.history(period="1y")

        if hist.empty:
             return jsonify({'error': 'No historical data found'}), 404

        # --- 1. Prepare Chart Data (OHLC + Volume) ---
        # Convert timestamps to string (YYYY-MM-DD) for Lightweight Charts
        hist.index = hist.index.strftime('%Y-%m-%d')

        ohlc_data = []
        volume_data = []

        for date, row in hist.iterrows():
            ohlc_data.append({
                'time': date,
                'open': row['Open'],
                'high': row['High'],
                'low': row['Low'],
                'close': row['Close']
            })
            # Color volume bars: Green if close > open, Red if close < open
            vol_color = 'rgba(38, 166, 154, 0.5)' if row['Close'] >= row['Open'] else 'rgba(239, 83, 80, 0.5)'
            volume_data.append({
                'time': date,
                'value': row['Volume'],
                'color': vol_color
            })

        # --- 2. Calculate Technicals (Historical Series) ---
        close_series = hist['Close']

        # SMA
        sma50_indicator = SMAIndicator(close=close_series, window=50)
        sma200_indicator = SMAIndicator(close=close_series, window=200)

        sma50 = sma50_indicator.sma_indicator()
        sma200 = sma200_indicator.sma_indicator()

        # Bollinger Bands
        bb_indicator = BollingerBands(close=close_series, window=20, window_dev=2)
        bb_upper = bb_indicator.bollinger_hband()
        bb_lower = bb_indicator.bollinger_lband()
        bb_mid = bb_indicator.bollinger_mavg() # Usually same as SMA20

        # RSI
        rsi_indicator = RSIIndicator(close=close_series, window=14)
        rsi = rsi_indicator.rsi()

        # MACD
        macd_indicator = MACD(close=close_series)
        macd_line = macd_indicator.macd()
        macd_signal = macd_indicator.macd_signal()
        macd_hist = macd_indicator.macd_diff()

        # Helper to format series for charts (drop NaNs for cleanliness or handle on frontend)
        # Lightweight Charts handles missing data by just not drawing, but we need consistent dates.
        # We will zip with dates.

        def format_series(series):
            data = []
            for date, value in series.items():
                if not np.isnan(value):
                    data.append({'time': date, 'value': value})
            return data

        sma50_data = format_series(sma50)
        sma200_data = format_series(sma200)
        bb_upper_data = format_series(bb_upper)
        bb_lower_data = format_series(bb_lower)
        bb_mid_data = format_series(bb_mid)
        rsi_data = format_series(rsi)

        macd_data = [] # Combine line and signal
        macd_hist_data = []

        # We iterate through the dataframe index to ensure alignment
        for date in hist.index:
            m_val = macd_line.get(date)
            s_val = macd_signal.get(date)
            h_val = macd_hist.get(date)

            if not np.isnan(m_val) and not np.isnan(s_val):
                # For MACD pane
                # Note: We'll separate these on frontend or send as custom object
                pass

        # Re-structure MACD for easier frontend consumption (separate series)
        macd_line_data = format_series(macd_line)
        macd_signal_data = format_series(macd_signal)

        # Histogram needs color
        macd_histogram_data = []
        for date, value in macd_hist.items():
            if not np.isnan(value):
                color = '#26a69a' if value >= 0 else '#ef5350' # Green/Red
                # Dim color if decreasing? Optional polish.
                macd_histogram_data.append({'time': date, 'value': value, 'color': color})


        # --- 3. Generate Chart Markers (Crosses & Squeezes) ---
        markers = []

        # A. Golden / Death Crosses
        # Find indices where 50 crosses 200
        # Align indices
        common_index = sma50.index.intersection(sma200.index)
        s50 = sma50.loc[common_index]
        s200 = sma200.loc[common_index]

        # We need at least 2 points
        if len(s50) > 1:
            # Check for crossovers
            # Golden Cross: 50 > 200 AND Prev_50 <= Prev_200
            golden = (s50 > s200) & (s50.shift(1) <= s200.shift(1))

            # Death Cross: 50 < 200 AND Prev_50 >= Prev_200
            death = (s50 < s200) & (s50.shift(1) >= s200.shift(1))

            for date, is_golden in golden.items():
                if is_golden:
                     markers.append({
                        'time': date,
                        'position': 'belowBar',
                        'color': '#FFD700', # Gold
                        'shape': 'arrowUp',
                        'text': 'Golden Cross',
                        'size': 2
                     })

            for date, is_death in death.items():
                if is_death:
                     markers.append({
                        'time': date,
                        'position': 'aboveBar',
                        'color': '#FF4500', # OrangeRed
                        'shape': 'arrowDown',
                        'text': 'Death Cross',
                        'size': 2
                     })

        # B. Volatility Squeeze
        # Bandwidth = (Upper - Lower) / Middle (or just Upper - Lower)
        # Standard squeeze logic: Bandwidth is within the lowest X percentile (e.g. 5%) of the last N periods (e.g. 6 months ~ 126 days)

        bb_width = (bb_upper - bb_lower)
        # We'll calculate squeeze based on the full loaded history (1y)
        # Threshold: 10th percentile of width
        if not bb_width.empty:
             threshold = bb_width.quantile(0.10)
             is_squeeze = bb_width < threshold

             for date, squeezed in is_squeeze.items():
                 if squeezed:
                     # We want to show a marker, but maybe not on every single candle if it's a long squeeze.
                     # But for now, simple dots below/above are fine.
                     # Let's put a small circle on the candle
                     markers.append({
                        'time': date,
                        'position': 'inBar', # or belowBar
                        'color': 'rgba(255, 255, 0, 0.5)',
                        'shape': 'circle',
                        'text': 'Squeeze',
                        'size': 0.5 # Small dot
                     })

        # Sort markers by time just in case
        markers.sort(key=lambda x: x['time'])


        # --- 4. Generate "The Verdict" ---
        current_price = close_series.iloc[-1]
        curr_sma50 = sma50.iloc[-1]
        curr_sma200 = sma200.iloc[-1]
        curr_rsi = rsi.iloc[-1]
        curr_macd = macd_hist.iloc[-1]

        score = 0
        reasons = []

        # 1. Trend (Price vs SMA200)
        if not np.isnan(curr_sma200):
            if current_price > curr_sma200:
                score += 2
                reasons.append("Price is in a long-term Uptrend (above SMA 200).")
            else:
                score -= 2
                reasons.append("Price is in a long-term Downtrend (below SMA 200).")

        # 2. Golden/Death Cross
        if not np.isnan(curr_sma50) and not np.isnan(curr_sma200):
            # Check if cross happened recently (last 5 days)
            recent_sma50 = sma50.iloc[-5:]
            recent_sma200 = sma200.iloc[-5:]

            # Simple check: is 50 > 200 now?
            if curr_sma50 > curr_sma200:
                score += 1
                reasons.append("Bullish: SMA 50 is above SMA 200.")
            else:
                score -= 1
                reasons.append("Bearish: SMA 50 is below SMA 200.")

        # 3. RSI
        if curr_rsi > 70:
            score -= 1
            reasons.append("RSI is Overbought (>70). Potential pullback.")
        elif curr_rsi < 30:
            score += 1
            reasons.append("RSI is Oversold (<30). Potential bounce.")
        else:
            reasons.append(f"RSI is Neutral ({round(curr_rsi, 2)}).")

        # 4. MACD Momentum
        if curr_macd > 0:
            score += 1
            reasons.append("MACD indicates positive momentum.")
        else:
            score -= 1
            reasons.append("MACD indicates negative momentum.")

        # Determine Signal Strength
        # Range approx -5 to +5
        if score >= 4:
            signal = "Strong Buy"
            signal_color = "green"
        elif score >= 1:
            signal = "Buy"
            signal_color = "#10b981" # Emerald
        elif score <= -4:
            signal = "Strong Sell"
            signal_color = "red"
        elif score <= -1:
            signal = "Sell"
            signal_color = "#ef4444" # Red
        else:
            signal = "Neutral"
            signal_color = "gray"

        verdict = {
            'signal': signal,
            'score': score,
            'color': signal_color,
            'reasons': reasons
        }

        # --- 5. Construct Response ---
        response_data = {
            'ohlc': ohlc_data,
            'volume': volume_data,
            'indicators': {
                'sma50': sma50_data,
                'sma200': sma200_data,
                'bb_upper': bb_upper_data,
                'bb_lower': bb_lower_data,
                'bb_mid': bb_mid_data,
                'rsi': rsi_data,
                'macd_line': macd_line_data,
                'macd_signal': macd_signal_data,
                'macd_hist': macd_histogram_data
            },
            'markers': markers,
            'verdict': verdict
        }

        return jsonify(response_data)

    except Exception as e:
        print(f"Dashboard Data Error: {e}")
        return jsonify({'error': str(e)}), 500

# ... (existing /api/search) ...
@app.route('/api/search', methods=['GET'])
def search_ticker():
    query = request.args.get('q')
    if not query:
        return jsonify({'results': []})
    
    try:
        # Use Yahoo Finance Autocomplete API
        url = f"https://query2.finance.yahoo.com/v1/finance/search?q={query}&quotesCount=5&newsCount=0"
        headers = {'User-Agent': 'Mozilla/5.0'}
        response = requests.get(url, headers=headers)
        data = response.json()
        
        results = []
        if 'quotes' in data:
            for quote in data['quotes']:
                results.append({
                    'symbol': quote.get('symbol'),
                    'shortname': quote.get('shortname', ''),
                    'longname': quote.get('longname', ''),
                    'exchDisp': quote.get('exchDisp', '')
                })
        
        return jsonify({'results': results})
    except Exception as e:
        print(f"Search error: {e}")
        return jsonify({'results': []})

# ... (existing /api/news) ...
@app.route('/api/news', methods=['GET'])
@cache.cached(query_string=True)
def get_news():
    ticker_symbol = request.args.get('ticker')
    if not ticker_symbol:
         return jsonify({'error': 'No ticker provided'}), 400

    try:
        # Use newsapi.org
        url = f'https://newsapi.org/v2/everything?q={ticker_symbol}&sortBy=publishedAt&language=en&pageSize=12&apiKey={NEWS_API_KEY}'
        response = requests.get(url)
        news_data = response.json()

        if news_data.get('status') != 'ok':
             return jsonify({'error': 'Failed to fetch news', 'details': news_data}), 500

        articles = []
        for article in news_data.get('articles', []):
            # Filter out biztoc.com
            source_name = article.get('source', {}).get('name', '').lower()
            if 'biztoc' in source_name or 'biztoc.com' in (article.get('url') or ''):
                continue

            # Calculate Sentiment
            title = article.get('title', '')
            blob = TextBlob(title)
            polarity = blob.sentiment.polarity
            
            if polarity > 0.1:
                sentiment = 'positive'
            elif polarity < -0.1:
                sentiment = 'negative'
            else:
                sentiment = 'neutral'

            articles.append({
                'title': article.get('title'),
                'description': article.get('description'),
                'url': article.get('url'),
                'image': article.get('urlToImage'),
                'source': article.get('source', {}).get('name'),
                'publishedAt': article.get('publishedAt'),
                'sentiment': sentiment
            })

        return jsonify({'articles': articles})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ... (existing /api/ai) ...
@app.route('/api/ai', methods=['GET'])
@cache.cached(query_string=True)
def get_ai_summary():
    ticker_symbol = request.args.get('ticker')
    if not ticker_symbol:
        return jsonify({'error': 'No ticker provided'}), 400
    
    print(f"Cache MISS for AI Summary: {ticker_symbol} - Calling OpenAI...") # Debug log

    try:
        prompt = f"Provide a comprehensive summary for the stock {ticker_symbol}. Include a breakdown of key strengths, risks, and a prediction for the future. Format the response using Markdown with headers (##), bold text (**text**), and bullet points."
        
        completion = client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[
                {"role": "system", "content": "You are a professional financial analyst. Provide concise, data-driven insights."},
                {"role": "user", "content": prompt}
            ]
        )

        content = completion.choices[0].message.content
        return jsonify({'summary': content})

    except Exception as e:
        print(f"AI Error: {e}")
        return jsonify({'error': str(e)}), 500

# ... (existing /api/ml) ...
@app.route('/api/ml', methods=['GET'])
@cache.cached(query_string=True)
def get_ml_analysis():
    ticker_symbol = request.args.get('ticker')
    if not ticker_symbol:
        return jsonify({'error': 'No ticker provided'}), 400

    try:
        stock = yf.Ticker(ticker_symbol)
        hist = stock.history(period="2y")
        
        if hist.empty:
            return jsonify({'error': 'Not enough data for ML'}), 400
        
        # Prepare data for Linear Regression (Predicting Next Day Close)
        hist['DateOrdinal'] = pd.to_datetime(hist.index).map(datetime.datetime.toordinal)
        
        # Simple Model: Use Date to predict Close (Trend Analysis)
        X = hist[['DateOrdinal']].values
        y = hist['Close'].values
        
        # Train on last 60 days for recent trend
        X_recent = X[-60:]
        y_recent = y[-60:]
        dates_recent = hist.index[-60:].strftime('%Y-%m-%d').tolist()
        
        model = LinearRegression()
        model.fit(X_recent, y_recent)
        
        # Predict next day
        next_day_ordinal = X_recent[-1][0] + 1
        prediction = model.predict([[next_day_ordinal]])[0]
        
        current_price = y_recent[-1]
        slope = model.coef_[0]
        
        trend = "Upward" if slope > 0 else "Downward"

        # Generate regression line points for the graph
        regression_line = model.predict(X_recent).tolist()
        
        analysis = {
            'current_price': round(current_price, 2),
            'predicted_next_close': round(prediction, 2),
            'trend_60_days': trend,
            'slope': round(slope, 4),
            'model_score': round(model.score(X_recent, y_recent), 4),
            'message': f"Based on a linear regression of the last 60 days, the trend is {trend}. The model predicts a price of ${round(prediction, 2)} for the next trading day."
        }
        
        graph_data = {
            'dates': dates_recent,
            'prices': y_recent.tolist(),
            'regression': regression_line
        }
        
        return jsonify({'analysis': analysis, 'graph_data': graph_data})

    except Exception as e:
        print(f"ML Error: {e}")
        return jsonify({'error': str(e)}), 500

# NEW: Chat Endpoint
@app.route('/api/chat', methods=['POST'])
def chat_bot():
    data = request.get_json()
    ticker_symbol = data.get('ticker')
    user_message = data.get('message')
    
    if not ticker_symbol or not user_message:
        return jsonify({'error': 'Missing ticker or message'}), 400

    try:
        # Create a context-aware prompt
        system_prompt = f"""You are a specialized financial assistant. 
        You are currently discussing the stock with ticker symbol: {ticker_symbol}. 
        Your answers must be relevant to this specific stock or general financial concepts related to it. 
        If the user asks about something completely unrelated (like cooking or sports), politely steer them back to {ticker_symbol} or financial topics.
        Keep your answers concise and professional."""

        completion = client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message}
            ]
        )

        bot_reply = completion.choices[0].message.content
        return jsonify({'reply': bot_reply})

    except Exception as e:
        print(f"Chat Error: {e}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
