import yfinance as yf

def test_financials():
    ticker = "NVDA"
    stock = yf.Ticker(ticker)

    print("\n--- Quarterly Income Stmt ---")
    try:
        qis = stock.quarterly_income_stmt
        print(qis.loc['Total Revenue'])
    except Exception as e:
        print(e)

if __name__ == "__main__":
    test_financials()
