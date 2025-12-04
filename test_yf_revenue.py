import yfinance as yf
import pandas as pd

def test_revenue():
    ticker = "NVDA"
    print(f"Fetching data for {ticker}...")
    stock = yf.Ticker(ticker)

    # 1. Check earnings_dates columns
    try:
        print("\n--- Earnings Dates ---")
        ed = stock.earnings_dates
        if ed is not None:
            print(ed.head())
            print("Columns:", ed.columns)
    except Exception as e:
        print("earnings_dates error:", e)

    # 2. Check earnings history (sometimes different)
    try:
        print("\n--- Earnings History ---")
        # Note: 'earnings_history' property might not exist on Ticker object in recent yfinance, it's usually 'earnings'
        # But 'earnings' gives annual/quarterly dataframe
        print(stock.quarterly_earnings)
    except Exception as e:
        print("quarterly_earnings error:", e)

    # 3. Check for specific revenue estimates
    # yfinance 'analysis' or 'earnings_history' method?
    # Some versions have get_earnings_history()

    try:
        print("\n--- Calendar ---")
        print(stock.calendar)
    except Exception as e:
        print("calendar error:", e)

if __name__ == "__main__":
    test_revenue()
