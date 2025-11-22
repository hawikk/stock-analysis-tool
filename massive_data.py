import os
# Switch to 'massive' package to avoid conflict with 'polygon' geometry library
from massive import RESTClient
from datetime import date, timedelta, datetime
import requests
import re

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
             # Reduce limit to conserve bandwidth if needed, though 10 is small.
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
            # If rate limited (429), avoid noisy stack traces if possible or just return empty gracefully
            if "429" in str(e) or "Max retries exceeded" in str(e):
                # print("Massive Rate Limit Hit (News). Falling back to yfinance.")
                pass
            else:
                print(f"Massive News Error: {e}")
            return []

    def get_unusual_activity(self):
        """
        Returns real Unusual Options Activity by fetching Universal Snapshots
        for options, sorted by Volume.
        """
        if not self.client: return []
        try:
            # 1. Fetch top active options (High Volume)
            # Use 'option' type and sort by volume desc
            snapshots = self.client.list_universal_snapshots(
                type='option',
                limit=30, # Get enough to filter
                sort='volume',
                order='desc'
            )

            raw_options = []
            underlyings = set()
            today = date.today()

            for s in snapshots:
                # Basic validation
                if not hasattr(s, 'day') or not s.day.volume:
                    continue

                ticker = s.ticker
                details = self._parse_option_ticker(ticker)

                # Filter out crazy short dated if needed, or just keep all
                underlyings.add(details['underlying'])
                raw_options.append({
                    'snapshot': s,
                    'details': details
                })

            # 2. Fetch Underlying Prices (for OTM calc)
            # We use universal snapshot for stocks (ticker_any_of)
            stock_map = {}
            if underlyings:
                try:
                    # Convert set to list
                    u_list = list(underlyings)
                    # Split into chunks if > 250 (unlikely here with limit=30)
                    stock_snaps = self.client.list_universal_snapshots(
                        type='stocks',
                        ticker_any_of=u_list
                    )
                    for ss in stock_snaps:
                        stock_map[ss.ticker] = getattr(ss.day, 'close', 0)
                except Exception as ex:
                    print(f"Failed to fetch underlying prices: {ex}")

            # 3. Build Final Result List
            results = []
            for item in raw_options:
                s = item['snapshot']
                d = item['details']

                # Attributes
                vol = getattr(s.day, 'volume', 0)
                close = getattr(s.day, 'close', 0)
                open_p = getattr(s.day, 'open', 0)

                change_pct = 0
                if open_p and open_p > 0:
                    change_pct = ((close - open_p) / open_p) * 100

                oi = getattr(s, 'open_interest', 0)
                iv = getattr(s, 'implied_volatility', 0)
                if iv: iv = iv * 100

                # Greeks (if available in snapshot)
                # Usually in s.greeks dict/object

                # Premium = Vol * Close * 100
                premium = vol * close * 100

                # Underlying Price & OTM
                stock_price = stock_map.get(d['underlying'], 0)
                otm_pct = 0
                otm_status = ""

                if stock_price > 0:
                    if d['type'] == 'C':
                        if stock_price < d['strike']:
                            diff = d['strike'] - stock_price
                            otm_pct = (diff / stock_price) * 100
                            otm_status = "OTM"
                        else:
                             otm_status = "ITM"
                    elif d['type'] == 'P':
                        if stock_price > d['strike']:
                            diff = stock_price - d['strike']
                            otm_pct = (diff / stock_price) * 100
                            otm_status = "OTM"
                        else:
                             otm_status = "ITM"

                # DTE
                dte = (d['exp_date'] - today).days

                # OI Change (Not available in snapshot, need history. Set to N/A)
                oi_chg = 0

                # Sentiment (Crude approximation)
                sentiment = 'NEUTRAL'
                if d['type'] == 'C': sentiment = 'BULLISH'
                elif d['type'] == 'P': sentiment = 'BEARISH'

                results.append({
                    'ticker': d['underlying'],
                    'contract': d['contract_name'], # e.g. SPY 440 C
                    'dte': dte,
                    'stock_price': stock_price,
                    'strike': d['strike'],
                    'otm_pct': round(otm_pct, 1),
                    'otm_status': otm_status,
                    'price': close, # Last
                    'change_pct': round(change_pct, 1),
                    'vol': vol,
                    'oi': oi,
                    'oi_chg': 0, # Placeholder
                    'premium': premium,
                    'iv': round(iv, 2) if iv else 0,
                    'sentiment': sentiment,
                    'type': d['type']
                })

            return results

        except Exception as e:
            print(f"Unusual Error: {e}")
            return []

    def _parse_option_ticker(self, ticker):
        """
        Parses Polygon Option Ticker: O:SPY230915C00440000
        """
        try:
            clean = ticker.replace("O:", "")
            # Regex to parse: SYMBOL + 6DIGIT_DATE + C/P + 8DIGIT_PRICE
            match = re.match(r"([A-Z]+)(\d{6})([CP])(\d{8})", clean)
            if match:
                sym, date_str, type_, strike_str = match.groups()
                exp_date = datetime.strptime(date_str, "%y%m%d").date()
                strike = float(strike_str) / 1000.0

                # Pretty contract name
                c_name = f"{sym} ${strike} {type_}"

                return {
                    'underlying': sym,
                    'contract_name': c_name,
                    'exp_date': exp_date,
                    'type': type_,
                    'strike': strike
                }
        except Exception as e:
            # Fallback for non-standard or failed parse
            pass

        return {
            'underlying': ticker,
            'contract_name': ticker,
            'exp_date': date.today(),
            'type': '?',
            'strike': 0
        }

# Singleton instance
massive_service = MassiveService()
