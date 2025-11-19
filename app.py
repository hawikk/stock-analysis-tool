import os
from dotenv import load_dotenv
import json
from flask import Flask, render_template, request, jsonify
from flask_caching import Cache
import yfinance as yf
import requests
from openai import OpenAI
import pandas as pd
import numpy as np
from ta.momentum import RSIIndicator, StochasticOscillator
from ta.trend import MACD, SMAIndicator
from ta.volatility import BollingerBands, AverageTrueRange
from sklearn.linear_model import LinearRegression
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
import datetime

# Load environment variables
load_dotenv()

app = Flask(__name__)

# Cache Configuration - Use FileSystemCache for persistence
cache = Cache(app, config={
    'CACHE_TYPE': 'FileSystemCache',
    'CACHE_DIR': 'flask_cache',
    'CACHE_DEFAULT_TIMEOUT': 3600, # 1 hour
    'CACHE_THRESHOLD': 500 # Maximum number of items
})

# Configuration
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
NEWS_API_KEY = os.getenv("NEWS_API_KEY")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-5-mini-2025-08-07")

client = OpenAI(api_key=OPENAI_API_KEY)

@app.route('/')
def index():
    return render_template('index.html')

def get_company_info(stock, ticker_symbol):
    info = stock.info
    logo_url = f"https://logo.clearbit.com/{info.get('website', '').split('//')[-1].split('/')[0]}" if info.get('website') else info.get('logo_url', '')
    return {
        'name': info.get('longName', ticker_symbol),
        'logo': logo_url,
        'sector': info.get('sector', 'N/A'),
        'industry': info.get('industry', 'N/A'),
        'summary': info.get('longBusinessSummary', 'N/A'),
        'currentPrice': info.get('currentPrice', 'N/A'),
        'marketCap': info.get('marketCap', 'N/A'),
        'peRatio': info.get('trailingPE', 'N/A'),
        'dividendYield': info.get('dividendYield', 'N/A'),
        'fiftyTwoWeekHigh': info.get('fiftyTwoWeekHigh', 'N/A'),
        'fiftyTwoWeekLow': info.get('fiftyTwoWeekLow', 'N/A')
    }

def get_technical_indicators(hist):
    # RSI
    rsi = RSIIndicator(close=hist["Close"], window=14).rsi().iloc[-1]
    # MACD
    macd = MACD(close=hist["Close"])
    macd_val = macd.macd().iloc[-1]
    macd_signal = macd.macd_signal().iloc[-1]
    # SMAs
    sma50 = SMAIndicator(close=hist["Close"], window=50).sma_indicator().iloc[-1]
    sma200 = SMAIndicator(close=hist["Close"], window=200).sma_indicator().iloc[-1]
    # Bollinger Bands
    bb = BollingerBands(close=hist["Close"], window=20)
    bb_high = bb.bollinger_hband().iloc[-1]
    bb_low = bb.bollinger_lband().iloc[-1]
    # ATR
    atr = AverageTrueRange(high=hist["High"], low=hist["Low"], close=hist["Close"], window=14).average_true_range().iloc[-1]
    # Stochastic Oscillator
    stoch = StochasticOscillator(high=hist["High"], low=hist["Low"], close=hist["Close"], window=14, smooth_window=3)
    stoch_k = stoch.stoch().iloc[-1]
    stoch_d = stoch.stoch_signal().iloc[-1]

    return {
        'RSI (14)': round(rsi, 2),
        'MACD': round(macd_val, 2),
        'MACD Signal': round(macd_signal, 2),
        'SMA (50)': round(sma50, 2) if not np.isnan(sma50) else "N/A",
        'SMA (200)': round(sma200, 2) if not np.isnan(sma200) else "N/A",
        'Bollinger High': round(bb_high, 2),
        'Bollinger Low': round(bb_low, 2),
        'ATR (14)': round(atr, 2),
        'Stochastic %K': round(stoch_k, 2),
        'Stochastic %D': round(stoch_d, 2)
    }

@app.route('/api/info', methods=['GET'])
@cache.cached(query_string=True)
def get_info():
    ticker_symbol = request.args.get('ticker')
    if not ticker_symbol:
        return jsonify({'error': 'No ticker provided'}), 400

    try:
        stock = yf.Ticker(ticker_symbol)
        hist = stock.history(period="1y")
        if hist.empty:
            return jsonify({'error': 'No historical data found'}), 404

        company_info = get_company_info(stock, ticker_symbol)
        technicals = get_technical_indicators(hist)

        return jsonify({'info': company_info, 'technicals': technicals})

    except Exception as e:
        print(f"Error in info: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/news', methods=['GET'])
@cache.cached(query_string=True)
def get_news():
    ticker_symbol = request.args.get('ticker')
    if not ticker_symbol:
        return jsonify({'error': 'No ticker provided'}), 400

    try:
        url = f'https://newsapi.org/v2/everything?q={ticker_symbol}&sortBy=publishedAt&language=en&pageSize=12&apiKey={NEWS_API_KEY}'
        response = requests.get(url)
        news_data = response.json()

        if news_data.get('status') != 'ok':
            return jsonify({'error': 'Failed to fetch news', 'details': news_data}), 500

        articles = []
        analyzer = SentimentIntensityAnalyzer()
        for article in news_data.get('articles', []):
            text_to_analyze = (article.get('title') or '') + " " + (article.get('description') or '')
            sentiment = analyzer.polarity_scores(text_to_analyze)

            articles.append({
                'title': article.get('title'),
                'description': article.get('description'),
                'url': article.get('url'),
                'image': article.get('urlToImage'),
                'source': article.get('source', {}).get('name'),
                'publishedAt': article.get('publishedAt'),
                'sentiment': sentiment['compound']
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

        hist.reset_index(inplace=True)
        hist['Date'] = hist['Date'].dt.strftime('%Y-%m-%d')
        
        return jsonify(hist.to_dict(orient='records'))

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/search', methods=['GET'])
def search_tickers():
    query = request.args.get('q', '')
    if not query:
        return jsonify([])

    try:
        with open('tickers.json', 'r') as f:
            tickers = json.load(f)

        matches = [t for t in tickers if query.lower() in t['symbol'].lower() or query.lower() in t['name'].lower()]
        return jsonify(matches)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    app.run(debug=True, port=5000)
