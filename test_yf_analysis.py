import yfinance as yf

def test_analysis():
    ticker = "NVDA"
    stock = yf.Ticker(ticker)

    print("\n--- Analysis ---")
    try:
        # Note: Analysis dataframe usually has index like 'Revenue Estimate', 'Earnings Estimate'
        # and columns like 'Current Qtr', 'Next Qtr', 'Current Year', 'Next Year'
        # It's forward looking.
        print(stock.analysis)
    except Exception as e:
        print(e)

if __name__ == "__main__":
    test_analysis()
