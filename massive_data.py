import os
# Switch to 'massive' package to avoid conflict with 'polygon' geometry library
from massive import RESTClient
from datetime import date, timedelta
import requests

class MassiveService:
    def __init__(self):
        self.api_key = os.getenv("MASSIVE_API_KEY")

        if not self.api_key:
            print("Warning: MASSIVE_API_KEY not found. Some features may fail.")
            self.client = None
        else:
            self.client = RESTClient(self.api_key)

    def _get_last_trading_day(self):
        """Returns the last likely trading day (weekday) relative to today."""
        # Start 2 days ago to be safe for free tier delay
        d = date.today() - timedelta(days=2)
        # While weekend (5=Sat, 6=Sun), go back
        while d.weekday() >= 5:
            d -= timedelta(days=1)
        return d.strftime('%Y-%m-%d')

    def get_ticker_details(self, ticker):
        """
        Fetches reference details (name, market cap, description, logo)
        """
        if not self.client: return {}
        try:
            details = self.client.get_ticker_details(ticker)
            # Normalize data
            logo_url = ""
            if hasattr(details, 'branding') and details.branding:
                if hasattr(details.branding, 'logo_url') and details.branding.logo_url:
                     logo_url = f"{details.branding.logo_url}?apiKey={self.api_key}"
                elif hasattr(details.branding, 'icon_url') and details.branding.icon_url:
                     logo_url = f"{details.branding.icon_url}?apiKey={self.api_key}"

            return {
                'name': getattr(details, 'name', ticker),
                'sector': getattr(details, 'sic_description', 'N/A'),
                'industry': getattr(details, 'sic_description', 'N/A'),
                'summary': getattr(details, 'description', 'No description available.'),
                'marketCap': getattr(details, 'market_cap', 'N/A'),
                'website': getattr(details, 'homepage_url', ''),
                'logo': logo_url,
                'list_date': getattr(details, 'list_date', 'N/A')
            }
        except Exception as e:
            print(f"Massive Ticker Details Error: {e}")
            # Return safe defaults to avoid 'undefined'
            return {
                'name': ticker,
                'sector': 'N/A',
                'industry': 'N/A',
                'summary': 'N/A',
                'marketCap': 'N/A',
                'logo': ''
            }

    def get_previous_close(self, ticker):
        """
        Fetches the previous close data (Open, High, Low, Close, Volume)
        """
        if not self.client: return None
        try:
            aggs = self.client.get_previous_close_agg(ticker)
            if aggs and len(aggs) > 0:
                agg = aggs[0]
                return {
                    'close': agg.close,
                    'open': agg.open,
                    'high': agg.high,
                    'low': agg.low,
                    'volume': agg.volume,
                    'date': agg.timestamp
                }
        except Exception as e:
            print(f"Massive Prev Close Error: {e}")
        return None

    def get_market_movers(self):
        """
        Fetches grouped daily bars for 2 days ago (safest for free tier)
        and calculates Top Gainers/Losers/Active.
        """
        if not self.client: return {'gainers': [], 'losers': [], 'active': []}
        try:
            target_date = self._get_last_trading_day()

            aggs = self.client.get_grouped_daily_aggs(target_date)

            data = []
            for a in aggs:
                if a.open and a.close and a.volume:
                    change_pct = ((a.close - a.open) / a.open) * 100
                    data.append({
                        'ticker': a.ticker,
                        'price': a.close,
                        'change_pct': change_pct,
                        'volume': a.volume
                    })

            # Sort by gainers
            gainers = sorted(data, key=lambda x: x['change_pct'], reverse=True)[:10]
            losers = sorted(data, key=lambda x: x['change_pct'])[:10]
            active = sorted(data, key=lambda x: x['volume'], reverse=True)[:10]

            return {
                'gainers': gainers,
                'losers': losers,
                'active': active,
                'date': target_date
            }

        except Exception as e:
            print(f"Massive Market Movers Error: {e}")
            return {'gainers': [], 'losers': [], 'active': []}

    def get_market_status(self):
        """
        Fetches status of major indices.
        """
        indices = {
            'SPY': 'S&P 500 ETF',
            'QQQ': 'Nasdaq 100 ETF',
            'DIA': 'Dow Jones ETF',
            'IWM': 'Russell 2000 ETF'
        }

        results = []
        for ticker, name in indices.items():
            data = self.get_previous_close(ticker)
            if data:
                change = ((data['close'] - data['open']) / data['open']) * 100
                results.append({
                    'ticker': ticker,
                    'name': name,
                    'price': data['close'],
                    'change_pct': change
                })
        return results

    def get_market_news(self):
        """
        Fetches general market news
        """
        if not self.client: return []
        try:
             news = self.client.list_ticker_news(limit=10)
             articles = []
             for n in news:
                 articles.append({
                     'title': n.title,
                     'source': n.author if n.author else n.publisher.name,
                     'url': n.article_url,
                     'publishedAt': n.published_utc,
                     'image': n.image_url
                 })
             return articles
        except Exception as e:
            print(f"Massive News Error: {e}")
            return []

    def get_unusual_activity(self):
        """
        Returns a mock list of unusual activity since Real-Time Options is expensive.
        We'll use High Volume stocks as a proxy for now.
        """
        # In a real paid version, we would query options contracts:
        # self.client.list_options_contracts(...)
        # For now, we reuse movers logic but filter for EXTREME volume
        try:
            movers = self.get_market_movers()
            # Filter for active
            active = movers.get('active', [])
            unusual = []
            for a in active[:5]:
                unusual.append({
                    'ticker': a['ticker'],
                    'type': 'HIGH VOL',
                    'detail': f"Vol: {a['volume']:,}",
                    'sentiment': 'BULLISH' if a['change_pct'] > 0 else 'BEARISH'
                })
            return unusual
        except Exception as e:
            print(f"Unusual Error: {e}")
            return []

# Singleton instance
massive_service = MassiveService()
