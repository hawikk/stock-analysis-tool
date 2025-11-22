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

# Cache Configuration
cache = Cache(app, config={
    'CACHE_TYPE': 'FileSystemCache',
    'CACHE_DIR': 'flask_cache',
    'CACHE_DEFAULT_TIMEOUT': 3600, # 1 hour
    'CACHE_THRESHOLD': 500
})

# Configuration
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
NEWS_API_KEY = os.getenv("NEWS_API_KEY")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-5-mini-2025-08-07")

client = OpenAI(api_key=OPENAI_API_KEY)

@app.route('/')
def index():
    return render_template('index.html')

# --- NEW MARKET ENDPOINTS ---

@app.route('/api/market/status', methods=['GET'])
@cache.cached(timeout=300) # Cache for 5 mins
def get_market_status():
    """Returns status of major indices"""
    try:
        data = massive_service.get_market_status()
        return jsonify({'indices': data})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/market/movers', methods=['GET'])
@cache.cached(timeout=3600) # Cache for 1 hour (since it's based on T-2 data mostly)
def get_market_movers():
    """Returns top gainers/losers/active"""
    try:
        data = massive_service.get_market_movers()
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/market/news', methods=['GET'])
@cache.cached(timeout=600)
def get_market_news():
    """Returns general market news"""
    try:
        articles = massive_service.get_market_news()
        if articles:
            return jsonify({'articles': articles})

        # Fallback to NewsAPI if Massive fails
        # We use top-headlines for general market news
        print("Massive News failed or empty, falling back to NewsAPI")
        url = f'https://newsapi.org/v2/top-headlines?category=business&language=en&country=us&pageSize=10&apiKey={NEWS_API_KEY}'
        response = requests.get(url)
        news_data = response.json()
        
        fallback_articles = []
        if news_data.get('status') == 'ok':
            for article in news_data.get('articles', []):
                if article.get('title') == '[Removed]': continue
                
                fallback_articles.append({
                    'title': article.get('title'),
                    'source': article.get('source', {}).get('name'),
                    'url': article.get('url'),
                    'publishedAt': article.get('publishedAt'),
                    'image': article.get('urlToImage')
                })
        
        return jsonify({'articles': fallback_articles})

    except Exception as e:
        print(f"Market News Error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/market/whale', methods=['GET'])
@cache.cached(timeout=300)
def get_whale_activity():
    """Returns unusual activity"""
    try:
        data = massive_service.get_unusual_activity()
        return jsonify({'data': data})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# --- EXISTING UPDATED ENDPOINTS ---

@app.route('/api/info', methods=['GET'])
@cache.cached(query_string=True)
def get_info():
    ticker_symbol = request.args.get('ticker')
    if not ticker_symbol:
        return jsonify({'error': 'No ticker provided'}), 400

    try:
        # 1. Get Reference Data from Massive (Fast & Reliable Metadata)
        company_info = massive_service.get_ticker_details(ticker_symbol)
        
        # 2. Get Price Data (Hybrid Approach)
        # Try to get real-time price from YFinance for accuracy, fall back to Massive Prev Close
        current_price = "N/A"
        try:
            # Fast fetch for price only
            stock = yf.Ticker(ticker_symbol)
            # Use fast_info if available (newer yfinance versions)
            if hasattr(stock, 'fast_info'):
                current_price = stock.fast_info['last_price']
            else:
                current_price = stock.info.get('currentPrice')
        except:
            # Fallback to Massive Prev Close
            prev = massive_service.get_previous_close(ticker_symbol)
            if prev:
                current_price = prev['close']

        # Update company_info with price
        company_info['currentPrice'] = round(current_price, 2) if isinstance(current_price, (int, float)) else current_price

        # 3. Technicals (Requires History) -> Use YFinance
        # We still need history for indicators.
        hist = stock.history(period="1y")

        technicals = {}
        if not hist.empty:
            # Calculate Technicals (Same as before)
            rsi = RSIIndicator(close=hist["Close"], window=14)
            current_rsi = rsi.rsi().iloc[-1]

            macd = MACD(close=hist["Close"])
            current_macd = macd.macd().iloc[-1]
            current_macd_signal = macd.macd_signal().iloc[-1]

            sma50 = SMAIndicator(close=hist["Close"], window=50)
            current_sma50 = sma50.sma_indicator().iloc[-1]

            sma200 = SMAIndicator(close=hist["Close"], window=200)
            current_sma200 = sma200.sma_indicator().iloc[-1]

            bb = BollingerBands(close=hist["Close"], window=20)
            current_bb_high = bb.bollinger_hband().iloc[-1]
            current_bb_low = bb.bollinger_lband().iloc[-1]

            technicals = {
                'RSI (14)': round(current_rsi, 2),
                'MACD': round(current_macd, 2),
                'MACD Signal': round(current_macd_signal, 2),
                'SMA (50)': round(current_sma50, 2) if not np.isnan(current_sma50) else "N/A",
                'SMA (200)': round(current_sma200, 2) if not np.isnan(current_sma200) else "N/A",
                'Bollinger High': round(current_bb_high, 2),
                'Bollinger Low': round(current_bb_low, 2)
            }

        # Fill missing fields in company_info if Massive didn't provide them
        # (Massive doesn't give PE Ratio or Dividend easily in reference endpoint, might need Fundamentals API)
        # For now, we'll leave them as N/A or try to fetch from yfinance info if we did a full fetch.
        # Note: We only did fast fetch. If we want PE, we need full info.
        if company_info.get('peRatio', 'N/A') == 'N/A':
             try:
                 # Only fetch full info if absolutely necessary, it's slow.
                 yf_info = stock.info
                 company_info['peRatio'] = yf_info.get('trailingPE', 'N/A')
                 company_info['dividendYield'] = yf_info.get('dividendYield', 'N/A')
                 # Format dividend yield to percentage if it exists
                 if company_info['dividendYield'] != 'N/A':
                     company_info['dividendYield'] = f"{company_info['dividendYield'] * 100:.2f}%"

                 if company_info.get('marketCap', 'N/A') == 'N/A':
                     company_info['marketCap'] = yf_info.get('marketCap', 'N/A')

                 if company_info.get('sector', 'N/A') == 'N/A':
                      company_info['sector'] = yf_info.get('sector', 'N/A')
             except Exception as e:
                 print(f"YFinance Info Fallback Error: {e}")

        return jsonify({'info': company_info, 'technicals': technicals})

    except Exception as e:
        print(f"Error in info: {e}")
        return jsonify({'error': str(e)}), 500

# ... (Keep existing /api/history as is, strictly yfinance) ...
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

# ... (Keep existing /api/dashboard_data as is) ...
@app.route('/api/dashboard_data', methods=['GET'])
@cache.cached(query_string=True)
def get_dashboard_data():
    # This function is huge, we keep it as is for now, it uses yfinance which is fine for charts.
    # Just ensuring it's imported correctly.
    return get_dashboard_data_impl()

# Extracted logic for cleaner file (optional, but I'll just paste the original code for safety)
# Actually I'll copy the original logic back to ensure no regression.
def get_dashboard_data_impl():
    ticker_symbol = request.args.get('ticker')
    period = request.args.get('period', '1y')

    if not ticker_symbol:
        return jsonify({'error': 'No ticker provided'}), 400

    # Map period to interval
    interval = "1d"
    if period == "1d":
        interval = "5m"
    elif period == "1w":
        interval = "15m"
    elif period == "1mo":
        interval = "60m"

    try:
        stock = yf.Ticker(ticker_symbol)
        hist = stock.history(period=period, interval=interval)

        if hist.empty:
             return jsonify({'error': 'No historical data found'}), 404

        # Format index based on interval
        if interval == "1d":
            hist.index = hist.index.strftime('%Y-%m-%d')
        else:
            hist.index = hist.index.strftime('%Y-%m-%d %H:%M')
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
            vol_color = 'rgba(38, 166, 154, 0.5)' if row['Close'] >= row['Open'] else 'rgba(239, 83, 80, 0.5)'
            volume_data.append({
                'time': date,
                'value': row['Volume'],
                'color': vol_color
            })

        close_series = hist['Close']
        sma50_indicator = SMAIndicator(close=close_series, window=50)
        sma200_indicator = SMAIndicator(close=close_series, window=200)
        sma50 = sma50_indicator.sma_indicator()
        sma200 = sma200_indicator.sma_indicator()
        bb_indicator = BollingerBands(close=close_series, window=20, window_dev=2)
        bb_upper = bb_indicator.bollinger_hband()
        bb_lower = bb_indicator.bollinger_lband()
        bb_mid = bb_indicator.bollinger_mavg()
        rsi_indicator = RSIIndicator(close=close_series, window=14)
        rsi = rsi_indicator.rsi()
        macd_indicator = MACD(close=close_series)
        macd_line = macd_indicator.macd()
        macd_signal = macd_indicator.macd_signal()
        macd_hist = macd_indicator.macd_diff()

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
        macd_line_data = format_series(macd_line)
        macd_signal_data = format_series(macd_signal)

        macd_histogram_data = []
        for date, value in macd_hist.items():
            if not np.isnan(value):
                color = '#26a69a' if value >= 0 else '#ef5350'
                macd_histogram_data.append({'time': date, 'value': value, 'color': color})

        markers = []
        common_index = sma50.index.intersection(sma200.index)
        s50 = sma50.loc[common_index]
        s200 = sma200.loc[common_index]

        if len(s50) > 1:
            golden = (s50 > s200) & (s50.shift(1) <= s200.shift(1))
            death = (s50 < s200) & (s50.shift(1) >= s200.shift(1))
            for date, is_golden in golden.items():
                if is_golden:
                     markers.append({'time': date, 'position': 'belowBar', 'color': '#FFD700', 'shape': 'arrowUp', 'text': 'Golden Cross', 'size': 2})
            for date, is_death in death.items():
                if is_death:
                     markers.append({'time': date, 'position': 'aboveBar', 'color': '#FF4500', 'shape': 'arrowDown', 'text': 'Death Cross', 'size': 2})

        bb_width = (bb_upper - bb_lower)
        if not bb_width.empty:
             threshold = bb_width.quantile(0.10)
             is_squeeze = bb_width < threshold
             for date, squeezed in is_squeeze.items():
                 if squeezed:
                     markers.append({'time': date, 'position': 'inBar', 'color': 'rgba(255, 255, 0, 0.5)', 'shape': 'circle', 'text': 'Squeeze', 'size': 0.5})
        markers.sort(key=lambda x: x['time'])

        current_price = close_series.iloc[-1]
        curr_sma50 = sma50.iloc[-1]
        curr_sma200 = sma200.iloc[-1]
        curr_rsi = rsi.iloc[-1]
        curr_macd = macd_hist.iloc[-1]
        score = 0
        reasons = []

        if not np.isnan(curr_sma200):
            if current_price > curr_sma200:
                score += 2
                reasons.append("Price is in a long-term Uptrend (above SMA 200).")
            else:
                score -= 2
                reasons.append("Price is in a long-term Downtrend (below SMA 200).")

        if not np.isnan(curr_sma50) and not np.isnan(curr_sma200):
            if curr_sma50 > curr_sma200:
                score += 1
                reasons.append("Bullish: SMA 50 is above SMA 200.")
            else:
                score -= 1
                reasons.append("Bearish: SMA 50 is below SMA 200.")

        if curr_rsi > 70:
            score -= 1
            reasons.append("RSI is Overbought (>70). Potential pullback.")
        elif curr_rsi < 30:
            score += 1
            reasons.append("RSI is Oversold (<30). Potential bounce.")
        else:
            reasons.append(f"RSI is Neutral ({round(curr_rsi, 2)}).")

        if curr_macd > 0:
            score += 1
            reasons.append("MACD indicates positive momentum.")
        else:
            score -= 1
            reasons.append("MACD indicates negative momentum.")

        if score >= 4:
            signal = "Strong Buy"
            signal_color = "green"
        elif score >= 1:
            signal = "Buy"
            signal_color = "#10b981"
        elif score <= -4:
            signal = "Strong Sell"
            signal_color = "red"
        elif score <= -1:
            signal = "Sell"
            signal_color = "#ef4444"
        else:
            signal = "Neutral"
            signal_color = "gray"

        verdict = {
            'signal': signal,
            'score': score,
            'color': signal_color,
            'reasons': reasons
        }

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


@app.route('/api/search', methods=['GET'])
def search_ticker():
    # Keep existing search
    query = request.args.get('q')
    if not query:
        return jsonify({'results': []})
    try:
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

@app.route('/api/news', methods=['GET'])
@cache.cached(query_string=True)
def get_news():
    ticker_symbol = request.args.get('ticker')
    # If ticker provided, use NewsAPI or Massive specific news
    # If no ticker, use NewsAPI general or Massive general

    if not ticker_symbol:
        return get_market_news() # Redirect to market news

    try:
        # Try Massive first for ticker news if available (Massive has ticker news)
        # If not, fallback to NewsAPI
        # Massive is better because it's financial specific.
        # However, Massive's free tier might rate limit.
        # Let's stick to NewsAPI for specific ticker for now unless it fails.

        url = f'https://newsapi.org/v2/everything?q={ticker_symbol}&sortBy=publishedAt&language=en&pageSize=12&apiKey={NEWS_API_KEY}'
        response = requests.get(url)
        news_data = response.json()

        if news_data.get('status') != 'ok':
             # Fallback to Massive?
             return jsonify({'error': 'Failed to fetch news', 'details': news_data}), 500

        articles = []
        for article in news_data.get('articles', []):
            source_name = article.get('source', {}).get('name', '').lower()
            if 'biztoc' in source_name or 'biztoc.com' in (article.get('url') or ''):
                continue

            title = article.get('title', '')
            blob = TextBlob(title)
            polarity = blob.sentiment.polarity
            if polarity > 0.1: sentiment = 'positive'
            elif polarity < -0.1: sentiment = 'negative'
            else: sentiment = 'neutral'

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

@app.route('/api/ai', methods=['GET'])
@cache.cached(query_string=True)
def get_ai_summary():
    ticker_symbol = request.args.get('ticker')
    if not ticker_symbol:
        return jsonify({'error': 'No ticker provided'}), 400
    
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

@app.route('/api/ml', methods=['GET'])
@cache.cached(query_string=True)
def get_ml_analysis():
    ticker_symbol = request.args.get('ticker')
    if not ticker_symbol:
        return jsonify({'error': 'No ticker provided'}), 400

    try:
        stock = yf.Ticker(ticker_symbol)
        hist = stock.history(period="2y")
        if hist.empty: return jsonify({'error': 'Not enough data for ML'}), 400
        
        hist['DateOrdinal'] = pd.to_datetime(hist.index).map(datetime.datetime.toordinal)
        X = hist[['DateOrdinal']].values
        y = hist['Close'].values
        X_recent = X[-60:]
        y_recent = y[-60:]
        dates_recent = hist.index[-60:].strftime('%Y-%m-%d').tolist()
        
        model = LinearRegression()
        model.fit(X_recent, y_recent)
        next_day_ordinal = X_recent[-1][0] + 1
        prediction = model.predict([[next_day_ordinal]])[0]
        current_price = y_recent[-1]
        slope = model.coef_[0]
        trend = "Upward" if slope > 0 else "Downward"
        regression_line = model.predict(X_recent).tolist()
        
        analysis = {
            'current_price': round(current_price, 2),
            'predicted_next_close': round(prediction, 2),
            'trend_60_days': trend,
            'slope': round(slope, 4),
            'model_score': round(model.score(X_recent, y_recent), 4),
            'message': f"Based on a linear regression of the last 60 days, the trend is {trend}. The model predicts a price of ${round(prediction, 2)} for the next trading day."
        }
        graph_data = {'dates': dates_recent, 'prices': y_recent.tolist(), 'regression': regression_line}
        return jsonify({'analysis': analysis, 'graph_data': graph_data})

    except Exception as e:
        print(f"ML Error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/chat', methods=['POST'])
def chat_bot():
    data = request.get_json()
    ticker_symbol = data.get('ticker')
    user_message = data.get('message')
    if not ticker_symbol or not user_message:
        return jsonify({'error': 'Missing ticker or message'}), 400

    try:
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
