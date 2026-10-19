export type Region = "Americas" | "Europe" | "Asia-Pacific" | "Middle East & Africa";

export type WorldIndex = {
  symbol: string;
  name: string;
  country: string;
  /** ISO 3166-1 numeric code, matches world-atlas feature ids. */
  iso: string;
  flag: string;
  region: Region;
  exchange: string;
  lat: number;
  lng: number;
  /** Primary index used to colour the country on the globe. */
  primary?: boolean;
};

export const WORLD_INDICES: WorldIndex[] = [
  { symbol: "^GSPC", name: "S&P 500", country: "United States", iso: "840", flag: "🇺🇸", region: "Americas", exchange: "NYSE", lat: 40.71, lng: -74.01, primary: true },
  { symbol: "^IXIC", name: "Nasdaq Composite", country: "United States", iso: "840", flag: "🇺🇸", region: "Americas", exchange: "NASDAQ", lat: 40.76, lng: -73.99 },
  { symbol: "^DJI", name: "Dow Jones", country: "United States", iso: "840", flag: "🇺🇸", region: "Americas", exchange: "NYSE", lat: 40.71, lng: -74.01 },
  { symbol: "^RUT", name: "Russell 2000", country: "United States", iso: "840", flag: "🇺🇸", region: "Americas", exchange: "NYSE", lat: 40.71, lng: -74.01 },
  { symbol: "^GSPTSE", name: "S&P/TSX", country: "Canada", iso: "124", flag: "🇨🇦", region: "Americas", exchange: "TSX", lat: 43.65, lng: -79.38, primary: true },
  { symbol: "^MXX", name: "IPC Mexico", country: "Mexico", iso: "484", flag: "🇲🇽", region: "Americas", exchange: "BMV", lat: 19.43, lng: -99.13, primary: true },
  { symbol: "^BVSP", name: "Ibovespa", country: "Brazil", iso: "076", flag: "🇧🇷", region: "Americas", exchange: "B3", lat: -23.55, lng: -46.63, primary: true },
  { symbol: "^MERV", name: "Merval", country: "Argentina", iso: "032", flag: "🇦🇷", region: "Americas", exchange: "BYMA", lat: -34.6, lng: -58.38, primary: true },

  { symbol: "^STOXX50E", name: "Euro Stoxx 50", country: "Eurozone", iso: "", flag: "🇪🇺", region: "Europe", exchange: "XETRA", lat: 50.11, lng: 8.68 },
  { symbol: "^FTSE", name: "FTSE 100", country: "United Kingdom", iso: "826", flag: "🇬🇧", region: "Europe", exchange: "LSE", lat: 51.51, lng: -0.09, primary: true },
  { symbol: "^GDAXI", name: "DAX", country: "Germany", iso: "276", flag: "🇩🇪", region: "Europe", exchange: "XETRA", lat: 50.11, lng: 8.68, primary: true },
  { symbol: "^FCHI", name: "CAC 40", country: "France", iso: "250", flag: "🇫🇷", region: "Europe", exchange: "EPA", lat: 48.87, lng: 2.34, primary: true },
  { symbol: "^IBEX", name: "IBEX 35", country: "Spain", iso: "724", flag: "🇪🇸", region: "Europe", exchange: "BME", lat: 40.42, lng: -3.7, primary: true },
  { symbol: "FTSEMIB.MI", name: "FTSE MIB", country: "Italy", iso: "380", flag: "🇮🇹", region: "Europe", exchange: "BIT", lat: 45.46, lng: 9.19, primary: true },
  { symbol: "^AEX", name: "AEX", country: "Netherlands", iso: "528", flag: "🇳🇱", region: "Europe", exchange: "AMS", lat: 52.37, lng: 4.89, primary: true },
  { symbol: "^SSMI", name: "SMI", country: "Switzerland", iso: "756", flag: "🇨🇭", region: "Europe", exchange: "SIX", lat: 47.37, lng: 8.54, primary: true },
  { symbol: "^BFX", name: "BEL 20", country: "Belgium", iso: "056", flag: "🇧🇪", region: "Europe", exchange: "EBR", lat: 50.85, lng: 4.35, primary: true },
  { symbol: "PSI20.LS", name: "PSI", country: "Portugal", iso: "620", flag: "🇵🇹", region: "Europe", exchange: "ELI", lat: 38.72, lng: -9.14, primary: true },
  { symbol: "^ISEQ", name: "ISEQ All Share", country: "Ireland", iso: "372", flag: "🇮🇪", region: "Europe", exchange: "ISE", lat: 53.35, lng: -6.26, primary: true },
  { symbol: "^ATX", name: "ATX", country: "Austria", iso: "040", flag: "🇦🇹", region: "Europe", exchange: "WBAG", lat: 48.21, lng: 16.37, primary: true },
  { symbol: "^OMX", name: "OMX Stockholm 30", country: "Sweden", iso: "752", flag: "🇸🇪", region: "Europe", exchange: "STO", lat: 59.33, lng: 18.07, primary: true },
  { symbol: "OSEBX.OL", name: "Oslo Børs", country: "Norway", iso: "578", flag: "🇳🇴", region: "Europe", exchange: "OSL", lat: 59.91, lng: 10.75, primary: true },
  { symbol: "^OMXC25", name: "OMX Copenhagen 25", country: "Denmark", iso: "208", flag: "🇩🇰", region: "Europe", exchange: "CPH", lat: 55.68, lng: 12.57, primary: true },
  { symbol: "^OMXH25", name: "OMX Helsinki 25", country: "Finland", iso: "246", flag: "🇫🇮", region: "Europe", exchange: "HEL", lat: 60.17, lng: 24.94, primary: true },
  { symbol: "WIG20.WA", name: "WIG20", country: "Poland", iso: "616", flag: "🇵🇱", region: "Europe", exchange: "WSE", lat: 52.23, lng: 21.01, primary: true },
  { symbol: "GD.AT", name: "Athens General", country: "Greece", iso: "300", flag: "🇬🇷", region: "Europe", exchange: "ATH", lat: 37.98, lng: 23.73, primary: true },
  { symbol: "XU100.IS", name: "BIST 100", country: "Turkey", iso: "792", flag: "🇹🇷", region: "Europe", exchange: "BIST", lat: 41.01, lng: 28.98, primary: true },

  { symbol: "^N225", name: "Nikkei 225", country: "Japan", iso: "392", flag: "🇯🇵", region: "Asia-Pacific", exchange: "TSE", lat: 35.68, lng: 139.77, primary: true },
  { symbol: "000001.SS", name: "Shanghai Composite", country: "China", iso: "156", flag: "🇨🇳", region: "Asia-Pacific", exchange: "SSE", lat: 31.23, lng: 121.47, primary: true },
  { symbol: "^HSI", name: "Hang Seng", country: "Hong Kong", iso: "344", flag: "🇭🇰", region: "Asia-Pacific", exchange: "HKEX", lat: 22.28, lng: 114.16, primary: true },
  { symbol: "^KS11", name: "KOSPI", country: "South Korea", iso: "410", flag: "🇰🇷", region: "Asia-Pacific", exchange: "KRX", lat: 37.57, lng: 126.98, primary: true },
  { symbol: "^TWII", name: "TAIEX", country: "Taiwan", iso: "158", flag: "🇹🇼", region: "Asia-Pacific", exchange: "TWSE", lat: 25.03, lng: 121.56, primary: true },
  { symbol: "^NSEI", name: "Nifty 50", country: "India", iso: "356", flag: "🇮🇳", region: "Asia-Pacific", exchange: "NSE", lat: 19.06, lng: 72.84, primary: true },
  { symbol: "^BSESN", name: "Sensex", country: "India", iso: "356", flag: "🇮🇳", region: "Asia-Pacific", exchange: "BSE", lat: 18.93, lng: 72.83 },
  { symbol: "^AXJO", name: "ASX 200", country: "Australia", iso: "036", flag: "🇦🇺", region: "Asia-Pacific", exchange: "ASX", lat: -33.87, lng: 151.21, primary: true },
  { symbol: "^NZ50", name: "NZX 50", country: "New Zealand", iso: "554", flag: "🇳🇿", region: "Asia-Pacific", exchange: "NZX", lat: -41.29, lng: 174.78, primary: true },
  { symbol: "^STI", name: "Straits Times", country: "Singapore", iso: "702", flag: "🇸🇬", region: "Asia-Pacific", exchange: "SGX", lat: 1.28, lng: 103.85, primary: true },
  { symbol: "^JKSE", name: "IDX Composite", country: "Indonesia", iso: "360", flag: "🇮🇩", region: "Asia-Pacific", exchange: "IDX", lat: -6.2, lng: 106.82, primary: true },
  { symbol: "^KLSE", name: "FTSE Bursa KLCI", country: "Malaysia", iso: "458", flag: "🇲🇾", region: "Asia-Pacific", exchange: "BURSA", lat: 3.14, lng: 101.69, primary: true },
  { symbol: "^SET.BK", name: "SET Index", country: "Thailand", iso: "764", flag: "🇹🇭", region: "Asia-Pacific", exchange: "SET", lat: 13.75, lng: 100.5, primary: true },
  { symbol: "PSEI.PS", name: "PSEi", country: "Philippines", iso: "608", flag: "🇵🇭", region: "Asia-Pacific", exchange: "PSE", lat: 14.55, lng: 121.02, primary: true },
  { symbol: "^VNINDEX.VN", name: "VN-Index", country: "Vietnam", iso: "704", flag: "🇻🇳", region: "Asia-Pacific", exchange: "HOSE", lat: 10.78, lng: 106.7, primary: true },

  { symbol: "^TA125.TA", name: "TA-125", country: "Israel", iso: "376", flag: "🇮🇱", region: "Middle East & Africa", exchange: "TASE", lat: 32.07, lng: 34.79, primary: true },
  { symbol: "^TASI.SR", name: "Tadawul All Share", country: "Saudi Arabia", iso: "682", flag: "🇸🇦", region: "Middle East & Africa", exchange: "TADAWUL", lat: 24.71, lng: 46.68, primary: true },
  { symbol: "DFMGI.AE", name: "DFM General", country: "United Arab Emirates", iso: "784", flag: "🇦🇪", region: "Middle East & Africa", exchange: "DFM", lat: 25.2, lng: 55.27, primary: true },
  { symbol: "^CASE30", name: "EGX 30", country: "Egypt", iso: "818", flag: "🇪🇬", region: "Middle East & Africa", exchange: "EGX", lat: 30.04, lng: 31.24, primary: true },
  { symbol: "^J203.JO", name: "JSE All Share", country: "South Africa", iso: "710", flag: "🇿🇦", region: "Middle East & Africa", exchange: "JSE", lat: -26.2, lng: 28.05, primary: true },
];

export const HEADLINE_INDICES = ["^GSPC", "^IXIC", "^DJI", "^RUT", "^VIX", "^STOXX50E", "^GDAXI", "^IBEX", "^N225", "^HSI"];

export type Session = { open: string; close: string };

export type Exchange = {
  id: string;
  name: string;
  city: string;
  flag: string;
  timeZone: string;
  sessions: Session[];
  /** JS Date#getDay values (0 = Sunday) the exchange trades on. */
  days: number[];
  lat: number;
  lng: number;
  indexSymbol?: string;
};

const MON_FRI = [1, 2, 3, 4, 5];
const SUN_THU = [0, 1, 2, 3, 4];

export const EXCHANGES: Exchange[] = [
  { id: "NYSE", name: "NYSE / Nasdaq", city: "New York", flag: "🇺🇸", timeZone: "America/New_York", sessions: [{ open: "09:30", close: "16:00" }], days: MON_FRI, lat: 40.71, lng: -74.01, indexSymbol: "^GSPC" },
  { id: "TSX", name: "Toronto SE", city: "Toronto", flag: "🇨🇦", timeZone: "America/Toronto", sessions: [{ open: "09:30", close: "16:00" }], days: MON_FRI, lat: 43.65, lng: -79.38, indexSymbol: "^GSPTSE" },
  { id: "BMV", name: "Bolsa Mexicana", city: "Mexico City", flag: "🇲🇽", timeZone: "America/Mexico_City", sessions: [{ open: "08:30", close: "15:00" }], days: MON_FRI, lat: 19.43, lng: -99.13, indexSymbol: "^MXX" },
  { id: "B3", name: "B3", city: "São Paulo", flag: "🇧🇷", timeZone: "America/Sao_Paulo", sessions: [{ open: "10:00", close: "17:00" }], days: MON_FRI, lat: -23.55, lng: -46.63, indexSymbol: "^BVSP" },
  { id: "LSE", name: "London SE", city: "London", flag: "🇬🇧", timeZone: "Europe/London", sessions: [{ open: "08:00", close: "16:30" }], days: MON_FRI, lat: 51.51, lng: -0.09, indexSymbol: "^FTSE" },
  { id: "XETRA", name: "Xetra", city: "Frankfurt", flag: "🇩🇪", timeZone: "Europe/Berlin", sessions: [{ open: "09:00", close: "17:30" }], days: MON_FRI, lat: 50.11, lng: 8.68, indexSymbol: "^GDAXI" },
  { id: "EURONEXT", name: "Euronext", city: "Paris", flag: "🇫🇷", timeZone: "Europe/Paris", sessions: [{ open: "09:00", close: "17:30" }], days: MON_FRI, lat: 48.87, lng: 2.34, indexSymbol: "^FCHI" },
  { id: "BME", name: "Bolsa de Madrid", city: "Madrid", flag: "🇪🇸", timeZone: "Europe/Madrid", sessions: [{ open: "09:00", close: "17:30" }], days: MON_FRI, lat: 40.42, lng: -3.7, indexSymbol: "^IBEX" },
  { id: "SIX", name: "SIX Swiss", city: "Zurich", flag: "🇨🇭", timeZone: "Europe/Zurich", sessions: [{ open: "09:00", close: "17:30" }], days: MON_FRI, lat: 47.37, lng: 8.54, indexSymbol: "^SSMI" },
  { id: "BIST", name: "Borsa Istanbul", city: "Istanbul", flag: "🇹🇷", timeZone: "Europe/Istanbul", sessions: [{ open: "10:00", close: "18:00" }], days: MON_FRI, lat: 41.01, lng: 28.98, indexSymbol: "XU100.IS" },
  { id: "JSE", name: "Johannesburg SE", city: "Johannesburg", flag: "🇿🇦", timeZone: "Africa/Johannesburg", sessions: [{ open: "09:00", close: "17:00" }], days: MON_FRI, lat: -26.2, lng: 28.05, indexSymbol: "^J203.JO" },
  { id: "TASE", name: "Tel Aviv SE", city: "Tel Aviv", flag: "🇮🇱", timeZone: "Asia/Jerusalem", sessions: [{ open: "10:00", close: "17:25" }], days: MON_FRI, lat: 32.07, lng: 34.79, indexSymbol: "^TA125.TA" },
  { id: "TADAWUL", name: "Tadawul", city: "Riyadh", flag: "🇸🇦", timeZone: "Asia/Riyadh", sessions: [{ open: "10:00", close: "15:00" }], days: SUN_THU, lat: 24.71, lng: 46.68, indexSymbol: "^TASI.SR" },
  { id: "DFM", name: "Dubai FM", city: "Dubai", flag: "🇦🇪", timeZone: "Asia/Dubai", sessions: [{ open: "10:00", close: "15:00" }], days: MON_FRI, lat: 25.2, lng: 55.27, indexSymbol: "DFMGI.AE" },
  { id: "NSE", name: "NSE / BSE", city: "Mumbai", flag: "🇮🇳", timeZone: "Asia/Kolkata", sessions: [{ open: "09:15", close: "15:30" }], days: MON_FRI, lat: 19.06, lng: 72.84, indexSymbol: "^NSEI" },
  { id: "SGX", name: "Singapore Exchange", city: "Singapore", flag: "🇸🇬", timeZone: "Asia/Singapore", sessions: [{ open: "09:00", close: "12:00" }, { open: "13:00", close: "17:00" }], days: MON_FRI, lat: 1.28, lng: 103.85, indexSymbol: "^STI" },
  { id: "SSE", name: "Shanghai SE", city: "Shanghai", flag: "🇨🇳", timeZone: "Asia/Shanghai", sessions: [{ open: "09:30", close: "11:30" }, { open: "13:00", close: "15:00" }], days: MON_FRI, lat: 31.23, lng: 121.47, indexSymbol: "000001.SS" },
  { id: "HKEX", name: "HKEX", city: "Hong Kong", flag: "🇭🇰", timeZone: "Asia/Hong_Kong", sessions: [{ open: "09:30", close: "12:00" }, { open: "13:00", close: "16:00" }], days: MON_FRI, lat: 22.28, lng: 114.16, indexSymbol: "^HSI" },
  { id: "TWSE", name: "Taiwan SE", city: "Taipei", flag: "🇹🇼", timeZone: "Asia/Taipei", sessions: [{ open: "09:00", close: "13:30" }], days: MON_FRI, lat: 25.03, lng: 121.56, indexSymbol: "^TWII" },
  { id: "KRX", name: "Korea Exchange", city: "Seoul", flag: "🇰🇷", timeZone: "Asia/Seoul", sessions: [{ open: "09:00", close: "15:30" }], days: MON_FRI, lat: 37.57, lng: 126.98, indexSymbol: "^KS11" },
  { id: "TSE", name: "Tokyo SE", city: "Tokyo", flag: "🇯🇵", timeZone: "Asia/Tokyo", sessions: [{ open: "09:00", close: "11:30" }, { open: "12:30", close: "15:30" }], days: MON_FRI, lat: 35.68, lng: 139.77, indexSymbol: "^N225" },
  { id: "ASX", name: "ASX", city: "Sydney", flag: "🇦🇺", timeZone: "Australia/Sydney", sessions: [{ open: "10:00", close: "16:00" }], days: MON_FRI, lat: -33.87, lng: 151.21, indexSymbol: "^AXJO" },
  { id: "NZX", name: "NZX", city: "Wellington", flag: "🇳🇿", timeZone: "Pacific/Auckland", sessions: [{ open: "10:00", close: "16:45" }], days: MON_FRI, lat: -41.29, lng: 174.78, indexSymbol: "^NZ50" },
];

export type Instrument = { symbol: string; name: string; group?: string; unit?: string };

export const FX_PAIRS: Instrument[] = [
  { symbol: "DX-Y.NYB", name: "US Dollar Index", group: "Index" },
  { symbol: "EURUSD=X", name: "EUR/USD", group: "Majors" },
  { symbol: "USDJPY=X", name: "USD/JPY", group: "Majors" },
  { symbol: "GBPUSD=X", name: "GBP/USD", group: "Majors" },
  { symbol: "USDCHF=X", name: "USD/CHF", group: "Majors" },
  { symbol: "AUDUSD=X", name: "AUD/USD", group: "Majors" },
  { symbol: "USDCAD=X", name: "USD/CAD", group: "Majors" },
  { symbol: "NZDUSD=X", name: "NZD/USD", group: "Majors" },
  { symbol: "EURGBP=X", name: "EUR/GBP", group: "Crosses" },
  { symbol: "EURJPY=X", name: "EUR/JPY", group: "Crosses" },
  { symbol: "EURCHF=X", name: "EUR/CHF", group: "Crosses" },
  { symbol: "USDCNY=X", name: "USD/CNY", group: "EM" },
  { symbol: "USDINR=X", name: "USD/INR", group: "EM" },
  { symbol: "USDMXN=X", name: "USD/MXN", group: "EM" },
  { symbol: "USDBRL=X", name: "USD/BRL", group: "EM" },
  { symbol: "USDKRW=X", name: "USD/KRW", group: "EM" },
  { symbol: "USDTRY=X", name: "USD/TRY", group: "EM" },
];

export const COMMODITIES: Instrument[] = [
  { symbol: "CL=F", name: "WTI Crude", group: "Energy", unit: "$/bbl" },
  { symbol: "BZ=F", name: "Brent Crude", group: "Energy", unit: "$/bbl" },
  { symbol: "NG=F", name: "Natural Gas", group: "Energy", unit: "$/MMBtu" },
  { symbol: "RB=F", name: "Gasoline", group: "Energy", unit: "$/gal" },
  { symbol: "GC=F", name: "Gold", group: "Metals", unit: "$/oz" },
  { symbol: "SI=F", name: "Silver", group: "Metals", unit: "$/oz" },
  { symbol: "PL=F", name: "Platinum", group: "Metals", unit: "$/oz" },
  { symbol: "PA=F", name: "Palladium", group: "Metals", unit: "$/oz" },
  { symbol: "HG=F", name: "Copper", group: "Metals", unit: "$/lb" },
  { symbol: "ZC=F", name: "Corn", group: "Agriculture", unit: "¢/bu" },
  { symbol: "ZW=F", name: "Wheat", group: "Agriculture", unit: "¢/bu" },
  { symbol: "ZS=F", name: "Soybeans", group: "Agriculture", unit: "¢/bu" },
  { symbol: "KC=F", name: "Coffee", group: "Agriculture", unit: "¢/lb" },
  { symbol: "CC=F", name: "Cocoa", group: "Agriculture", unit: "$/t" },
  { symbol: "SB=F", name: "Sugar", group: "Agriculture", unit: "¢/lb" },
  { symbol: "LE=F", name: "Live Cattle", group: "Agriculture", unit: "¢/lb" },
];

export const CRYPTO_FALLBACK: Instrument[] = [
  { symbol: "BTC-USD", name: "Bitcoin" },
  { symbol: "ETH-USD", name: "Ethereum" },
  { symbol: "SOL-USD", name: "Solana" },
  { symbol: "XRP-USD", name: "XRP" },
  { symbol: "BNB-USD", name: "BNB" },
  { symbol: "DOGE-USD", name: "Dogecoin" },
  { symbol: "ADA-USD", name: "Cardano" },
];

export const RATES_QUICK: Instrument[] = [
  { symbol: "^IRX", name: "US 3M" },
  { symbol: "^FVX", name: "US 5Y" },
  { symbol: "^TNX", name: "US 10Y" },
  { symbol: "^TYX", name: "US 30Y" },
  { symbol: "^VIX", name: "VIX" },
  { symbol: "^MOVE", name: "MOVE" },
];

export const SECTOR_ETFS: Instrument[] = [
  { symbol: "XLK", name: "Technology" },
  { symbol: "XLC", name: "Communication" },
  { symbol: "XLY", name: "Consumer Disc." },
  { symbol: "XLP", name: "Consumer Staples" },
  { symbol: "XLF", name: "Financials" },
  { symbol: "XLV", name: "Health Care" },
  { symbol: "XLI", name: "Industrials" },
  { symbol: "XLE", name: "Energy" },
  { symbol: "XLU", name: "Utilities" },
  { symbol: "XLRE", name: "Real Estate" },
  { symbol: "XLB", name: "Materials" },
];

export const THEME_ETFS: Instrument[] = [
  { symbol: "SMH", name: "Semiconductors" },
  { symbol: "IGV", name: "Software" },
  { symbol: "XBI", name: "Biotech" },
  { symbol: "KRE", name: "Regional Banks" },
  { symbol: "ITB", name: "Homebuilders" },
  { symbol: "XME", name: "Metals & Mining" },
  { symbol: "TAN", name: "Solar" },
  { symbol: "URA", name: "Uranium" },
  { symbol: "ARKK", name: "Innovation" },
  { symbol: "GDX", name: "Gold Miners" },
];

export const HEATMAP_UNIVERSE: Record<string, string[]> = {
  Technology: ["AAPL", "MSFT", "NVDA", "AVGO", "ORCL", "CRM", "AMD", "ADBE", "CSCO", "ACN", "IBM", "QCOM", "TXN", "INTU", "NOW", "AMAT", "MU", "LRCX", "ADI", "KLAC", "PANW", "ANET", "INTC", "CRWD", "SNPS", "PLTR", "APH"],
  Communication: ["GOOGL", "META", "NFLX", "TMUS", "DIS", "VZ", "T", "CMCSA"],
  "Consumer Disc.": ["AMZN", "TSLA", "HD", "MCD", "BKNG", "LOW", "TJX", "SBUX", "NKE", "ABNB", "CMG", "ORLY"],
  "Consumer Staples": ["WMT", "COST", "PG", "KO", "PEP", "PM", "MDLZ", "MO", "CL"],
  Financials: ["BRK-B", "JPM", "V", "MA", "BAC", "WFC", "GS", "MS", "AXP", "SCHW", "BLK", "C", "SPGI", "PGR", "CB", "COF", "BX"],
  "Health Care": ["LLY", "UNH", "JNJ", "ABBV", "MRK", "TMO", "ABT", "ISRG", "AMGN", "DHR", "PFE", "BSX", "SYK", "GILD", "VRTX", "MDT"],
  Industrials: ["GE", "CAT", "RTX", "UBER", "HON", "UNP", "BA", "LMT", "DE", "ETN", "ADP", "UPS", "PH", "WM", "GEV"],
  Energy: ["XOM", "CVX", "COP", "EOG", "SLB", "WMB", "MPC", "PSX", "KMI"],
  Utilities: ["NEE", "SO", "DUK", "CEG", "AEP", "SRE", "VST"],
  "Real Estate": ["PLD", "AMT", "EQIX", "WELL", "SPG", "O", "PSA"],
  Materials: ["LIN", "SHW", "APD", "ECL", "FCX", "NEM"],
};

export const GLOBAL_BONDS: { symbol: string; country: string; flag: string }[] = [
  { symbol: "US10Y", country: "United States", flag: "🇺🇸" },
  { symbol: "DE10Y-DE", country: "Germany", flag: "🇩🇪" },
  { symbol: "GB10Y-GB", country: "United Kingdom", flag: "🇬🇧" },
  { symbol: "FR10Y-FR", country: "France", flag: "🇫🇷" },
  { symbol: "IT10Y-IT", country: "Italy", flag: "🇮🇹" },
  { symbol: "ES10Y-ES", country: "Spain", flag: "🇪🇸" },
  { symbol: "CH10Y-CH", country: "Switzerland", flag: "🇨🇭" },
  { symbol: "JP10Y-JP", country: "Japan", flag: "🇯🇵" },
  { symbol: "CN10Y-CN", country: "China", flag: "🇨🇳" },
  { symbol: "KR10Y-KR", country: "South Korea", flag: "🇰🇷" },
  { symbol: "IN10Y-IN", country: "India", flag: "🇮🇳" },
  { symbol: "AU10Y-AU", country: "Australia", flag: "🇦🇺" },
  { symbol: "CA10Y-CA", country: "Canada", flag: "🇨🇦" },
  { symbol: "MX10Y-MX", country: "Mexico", flag: "🇲🇽" },
  { symbol: "BR10Y-BR", country: "Brazil", flag: "🇧🇷" },
  { symbol: "ZA10Y-ZA", country: "South Africa", flag: "🇿🇦" },
];

export const DEFAULT_WATCHLISTS: { id: string; name: string; symbols: string[] }[] = [
  { id: "core", name: "Core", symbols: ["AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "META", "TSLA", "ASML", "SAN.MC", "ITX.MC"] },
  { id: "macro", name: "ETFs & Macro", symbols: ["SPY", "QQQ", "VWCE.DE", "GLD", "TLT", "BTC-USD", "EURUSD=X"] },
];
