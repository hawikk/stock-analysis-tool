import requests
import json
import sys

BASE_URL = "http://127.0.0.1:5000"

def test_endpoint(name, url, method='GET', data=None):
    print(f"--- Testing {name} ---")
    try:
        if method == 'GET':
            r = requests.get(url)
        else:
            r = requests.post(url, json=data)

        print(f"Status: {r.status_code}")
        if r.status_code == 200:
            try:
                js = r.json()
                # Print a summary
                if 'ohlc' in js:
                    print(f"OHLC Data Points: {len(js['ohlc'])}")
                    if len(js['ohlc']) > 0:
                        print(f"Sample: {js['ohlc'][0]}")
                elif 'matrix' in js:
                    print(f"Matrix Points: {len(js['matrix'])}")
                elif 'social' in js:
                    print(f"Social Items: {len(js['social'])}")
                else:
                    print(str(js)[:200])
            except:
                print("Response is not JSON")
                print(r.text[:200])
        else:
            print(f"Error Body: {r.text}")

    except Exception as e:
        print(f"Request Failed: {e}")
    print("\n")

# 1. Chart Data (Dashboard)
test_endpoint("Dashboard Data (SPY)", f"{BASE_URL}/api/dashboard_data?ticker=SPY&period=1y")

# 2. Correlation
test_endpoint("Correlation", f"{BASE_URL}/api/tools/correlation", 'POST', {'tickers': ['AAPL', 'MSFT', 'GOOG']})

# 3. Social
test_endpoint("Social", f"{BASE_URL}/api/market/social")

# 4. Watchlist (uses dashboard_data with 1d)
test_endpoint("Watchlist Item (NVDA 1d)", f"{BASE_URL}/api/dashboard_data?ticker=NVDA&period=1d")
