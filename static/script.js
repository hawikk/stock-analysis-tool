let chartInstance = null;
let chartSeries = [];

// Dark Mode Logic
const themeToggleBtn = document.getElementById('themeToggle');
const body = document.body;
const icon = themeToggleBtn.querySelector('i');

// Init Theme
if (!localStorage.getItem('theme')) {
    localStorage.setItem('theme', 'dark');
}
if (localStorage.getItem('theme') === 'light') {
    body.setAttribute('data-theme', 'light');
    icon.classList.remove('fa-sun');
    icon.classList.add('fa-moon');
}

themeToggleBtn.addEventListener('click', () => {
    const isDark = !body.getAttribute('data-theme') || body.getAttribute('data-theme') === 'dark';
    if (isDark) {
        body.setAttribute('data-theme', 'light');
        localStorage.setItem('theme', 'light');
        icon.classList.remove('fa-sun');
        icon.classList.add('fa-moon');
    } else {
        body.removeAttribute('data-theme');
        localStorage.setItem('theme', 'dark');
        icon.classList.remove('fa-moon');
        icon.classList.add('fa-sun');
    }
});

// Initialize Data
document.addEventListener('DOMContentLoaded', () => {
    loadMarketStatus();
    loadWhaleActivity(); // New Main Feature
    loadMarketNews();
    loadScreenerData(); // Restore Screener Data

    // Initialize clock
    setInterval(() => {
        const now = new Date();
        document.getElementById('clock').innerText = now.toISOString().split('T')[1].split('.')[0];
    }, 1000);
});

// View Navigation
document.querySelectorAll('[data-view]').forEach(btn => {
    btn.addEventListener('click', function() {
        // Buttons
        document.querySelectorAll('[data-view]').forEach(b => b.classList.remove('active'));
        this.classList.add('active');

        // Sections
        const viewId = 'view' + this.getAttribute('data-view').charAt(0).toUpperCase() + this.getAttribute('data-view').slice(1);
        document.querySelectorAll('.view-section').forEach(el => el.classList.add('d-none'));

        const target = document.getElementById(viewId);
        if(target) {
            target.classList.remove('d-none');
        } else {
            // Handle partial mapping
            if(this.getAttribute('data-view') === 'chart') document.getElementById('viewStock').classList.remove('d-none');
            else document.getElementById('viewDashboard').classList.remove('d-none');
        }
    });
});

// --- MARKET DASHBOARD FUNCTIONS ---

function loadMarketStatus() {
    fetch('/api/market/status')
    .then(res => res.json())
    .then(data => {
        const bar = document.getElementById('marketTickerBar');
        bar.innerHTML = '';

        if(data.indices) {
            data.indices.forEach(idx => {
                const color = idx.change_pct >= 0 ? 'text-success' : 'text-danger';
                const arrow = idx.change_pct >= 0 ? '▲' : '▼';

                const div = document.createElement('div');
                div.className = 'd-flex align-items-center gap-2 px-3 py-1 bg-darker border border-secondary rounded font-monospace small text-nowrap';
                div.innerHTML = `
                    <span class="fw-bold text-white">${idx.ticker}</span>
                    <span class="${color}">${idx.price.toFixed(2)}</span>
                    <span class="${color} small">${arrow} ${Math.abs(idx.change_pct).toFixed(2)}%</span>
                `;
                bar.appendChild(div);
            });
        }
    })
    .catch(console.error);
}

function loadWhaleActivity() {
    const tbody = document.getElementById('whaleTableBody');
    tbody.innerHTML = '<tr><td colspan="14" class="text-center text-muted py-4"><div class="spinner-border spinner-border-sm"></div> Fetching Unusual Flow...</td></tr>';

    fetch('/api/market/whale')
    .then(res => res.json())
    .then(data => {
        tbody.innerHTML = '';
        if(data.data && data.data.length > 0) {
            data.data.forEach(item => {
                const tr = document.createElement('tr');
                tr.style.cursor = 'pointer';
                tr.addEventListener('click', () => loadStock(item.ticker));

                // Colors
                const typeClass = item.type === 'C' ? 'uw-call' : 'uw-put';
                const typeLabel = item.type === 'C' ? 'CALL' : 'PUT';
                const sentimentClass = item.sentiment === 'BULLISH' ? 'text-bull' : 'text-bear';
                const chgColor = item.change_pct >= 0 ? 'text-success' : 'text-danger';

                // OTM Format
                const otmColor = item.otm_status === 'OTM' ? 'text-muted' : 'text-white';

                tr.innerHTML = `
                    <td class="fw-bold text-white"><span class="d-flex align-items-center gap-2"><img src="https://logo.clearbit.com/${item.ticker}.com" style="width:16px;height:16px;border-radius:50%;" onerror="this.style.display='none'"> ${item.ticker}</span></td>
                    <td class="text-muted small">${item.contract}</td>
                    <td><span class="uw-tag ${typeClass}">${typeLabel}</span></td>
                    <td class="text-white">${item.dte}d</td>
                    <td class="text-end text-white">${item.strike.toFixed(2)}</td>
                    <td class="text-end text-muted">${item.stock_price > 0 ? item.stock_price.toFixed(2) : '-'}</td>
                    <td class="text-end ${otmColor}">${item.otm_pct}%</td>
                    <td class="text-end text-white">${item.price.toFixed(2)}</td>
                    <td class="text-end ${chgColor}">${item.change_pct > 0 ? '+' : ''}${item.change_pct.toFixed(1)}%</td>
                    <td class="text-end text-warning fw-bold">${formatNumber(item.vol)}</td>
                    <td class="text-end text-muted">${formatNumber(item.oi)}</td>
                    <td class="text-end text-white">$${formatNumber(item.premium)}</td>
                    <td class="text-end text-muted">${item.iv}%</td>
                    <td class="text-center ${sentimentClass} fw-bold small">${item.sentiment}</td>
                `;
                tbody.appendChild(tr);
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="14" class="text-center text-muted py-4">No unusual activity found or API limit reached.</td></tr>';
        }
    })
    .catch(err => {
        console.error(err);
        tbody.innerHTML = '<tr><td colspan="14" class="text-center text-danger py-4">Error fetching data.</td></tr>';
    });
}

// Restore Screener Logic (using the same /api/market/movers endpoint)
function loadScreenerData() {
    fetch('/api/market/movers')
    .then(res => res.json())
    .then(data => {
        if (data.gainers) populateScreener(data.gainers);
    })
    .catch(console.error);
}

// Reuse existing populateScreener function
function populateScreener(data) {
    const container = document.getElementById('screenerTableBody');
    if (!container) return;
    container.innerHTML = '';

    // Filter logic (e.g. > 2% change)
    const filtered = data.filter(d => Math.abs(d.change_pct) > 2);

    filtered.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="text-white fw-bold">${item.ticker}</td>
            <td class="text-end text-muted">${item.price.toFixed(2)}</td>
            <td class="text-end ${item.change_pct > 0 ? 'text-success' : 'text-danger'}">${item.change_pct > 0 ? '+' : ''}${item.change_pct.toFixed(2)}%</td>
            <td class="text-end text-white">${formatNumber(item.volume)}</td>
        `;
        tr.addEventListener('click', () => loadStock(item.ticker));
        tr.style.cursor = 'pointer';
        container.appendChild(tr);
    });
}

function loadMarketNews() {
    fetch('/api/market/news')
    .then(res => res.json())
    .then(data => {
        const grid = document.getElementById('marketNewsGrid');
        grid.innerHTML = '';
        if(data.articles) {
            data.articles.forEach(a => {
                const div = document.createElement('div');
                div.className = 'col-md-6 col-lg-4';
                div.innerHTML = `
                    <a href="${a.url}" target="_blank" class="text-decoration-none">
                        <div class="d-flex gap-3 align-items-start p-2 bg-darker border border-secondary hover-bg h-100 rounded">
                            <div style="width: 4px; height: 100%; background: #2962ff; border-radius: 2px;"></div>
                            <div class="overflow-hidden">
                                <div class="text-white small fw-bold mb-1">${a.title}</div>
                                <div class="text-muted x-small d-flex justify-content-between">
                                    <span>${a.source}</span>
                                    <span>${new Date(a.publishedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                </div>
                            </div>
                        </div>
                    </a>
                `;
                grid.appendChild(div);
            });
        }
    })
    .catch(console.error);
}


// --- SEARCH & STOCK VIEW ---

const tickerInput = document.getElementById('tickerInput');
const suggestionsBox = document.getElementById('suggestionsBox');
let debounceTimer;

tickerInput.addEventListener('input', function() {
    const query = this.value;
    clearTimeout(debounceTimer);
    if (query.length < 1) { suggestionsBox.classList.add('d-none'); return; }

    debounceTimer = setTimeout(() => {
        fetch(`/api/search?q=${query}`)
            .then(res => res.json())
            .then(data => {
                suggestionsBox.innerHTML = '';
                if (data.results && data.results.length > 0) {
                    suggestionsBox.classList.remove('d-none');
                    data.results.forEach(item => {
                        const div = document.createElement('div');
                        div.classList.add('suggestion-item');
                        div.innerHTML = `<span class="fw-bold text-white">${item.symbol}</span> <span class="text-muted small ms-2">${item.shortname}</span>`;
                        div.addEventListener('click', () => {
                            tickerInput.value = item.symbol;
                            suggestionsBox.classList.add('d-none');
                            loadStock(item.symbol);
                        });
                        suggestionsBox.appendChild(div);
                    });
                } else { suggestionsBox.classList.add('d-none'); }
            });
    }, 300);
});

document.addEventListener('click', (e) => {
    if (e.target !== tickerInput && e.target !== suggestionsBox) suggestionsBox.classList.add('d-none');
});

// --- STOCK DETAILS LOGIC ---

// State for current ticker and period
let currentTicker = null;
let currentPeriod = "1y";

// Event Listeners for Time Range Buttons
document.querySelectorAll('.time-range-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        document.querySelectorAll('.time-range-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        currentPeriod = this.getAttribute('data-range');
        if (currentTicker) {
            fetchHistory(currentTicker);
        }
    });
});

function loadStock(ticker) {
    // Switch view
    document.querySelector('[data-view="chart"]').click();

    currentTicker = ticker;
    // Update Header
    document.getElementById('stockSymbol').innerText = ticker;
    document.getElementById('stockName').innerText = "Loading...";
    document.getElementById('currentPrice').innerText = "---";
    document.getElementById('priceChange').innerText = "";

    // Fetch Data
    fetchInfo(ticker);
    fetchHistory(ticker);
    fetchAI(ticker);
    fetchStockNews(ticker);
}

function fetchInfo(ticker) {
    fetch(`/api/info?ticker=${ticker}`)
    .then(res => res.json())
    .then(data => {
        if(data.error) return;
        const info = data.info || {};
        
        // Helper for safe display
        const safe = (val) => (val === undefined || val === null || val === 'undefined') ? 'N/A' : val;

        document.getElementById('stockName').innerText = safe(info.name) === 'N/A' ? ticker : info.name;
        document.getElementById('currentPrice').innerText = `$${safe(info.currentPrice)}`;

        // Render Fundamentals with safe access
        const grid = document.getElementById('fundamentalsGrid');
        grid.innerHTML = `
             <div class="d-flex justify-content-between border-bottom border-secondary py-2"><span>MKT CAP</span> <span class="text-white font-monospace">${formatNumber(info.marketCap)}</span></div>
             <div class="d-flex justify-content-between border-bottom border-secondary py-2"><span>P/E</span> <span class="text-white font-monospace">${safe(info.peRatio)}</span></div>
             <div class="d-flex justify-content-between border-bottom border-secondary py-2"><span>DIV</span> <span class="text-white font-monospace">${safe(info.dividendYield)}</span></div>
             <div class="d-flex justify-content-between border-bottom border-secondary py-2"><span>SECTOR</span> <span class="text-white text-truncate font-monospace" style="max-width: 100px;">${safe(info.sector)}</span></div>
        `;
    });
}

function fetchHistory(ticker) {
    fetch(`/api/dashboard_data?ticker=${ticker}&period=${currentPeriod}`)
    .then(res => res.json())
    .then(data => {
        renderStockChart(data);
        renderVerdict(data.verdict);
    });
}

function renderStockChart(data) {
    const container = document.getElementById('chartContainer');
    container.innerHTML = '';

    const isDark = !document.body.getAttribute('data-theme') || document.body.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#ecedee' : '#131722';
    const gridColor = isDark ? '#2a2e39' : '#e0e3eb';

    // Detect if data is intraday (contains time)
    const isIntraday = currentPeriod === '1d' || currentPeriod === '1w';

    chartInstance = LightweightCharts.createChart(container, {
        layout: {
            background: { type: 'solid', color: 'transparent' },
            textColor: textColor,
        },
        grid: {
            vertLines: { color: gridColor },
            horzLines: { color: gridColor }
        },
        width: container.clientWidth,
        height: container.clientHeight,
        timeScale: {
            borderColor: gridColor,
            timeVisible: isIntraday,
            secondsVisible: false
        },
        rightPriceScale: { borderColor: gridColor }
    });

    const candleSeries = chartInstance.addCandlestickSeries({
        upColor: '#00b894', downColor: '#ff4757', borderVisible: false, wickUpColor: '#00b894', wickDownColor: '#ff4757'
    });

    // Process data for lightweight charts (needs timestamps for intraday)
    const processedOHLC = data.ohlc.map(d => {
        // If intraday, time is likely YYYY-MM-DD HH:MM. Lightweight charts needs unix timestamp for intraday.
        if (d.time.includes(' ')) {
             return { ...d, time: new Date(d.time).getTime() / 1000 };
        }
        return d;
    });
    candleSeries.setData(processedOHLC);

    // SMA 50
    const sma50 = chartInstance.addLineSeries({ color: '#fbc531', lineWidth: 1 });
    // Same processing for indicators
    const processedSMA = data.indicators.sma50.map(d => {
         if (d.time.includes(' ')) {
             return { ...d, time: new Date(d.time).getTime() / 1000 };
        }
        return d;
    });
    sma50.setData(processedSMA);

    // Markers
    if(data.markers) candleSeries.setMarkers(data.markers);

    new ResizeObserver(() => {
        if (container.clientWidth > 0 && container.clientHeight > 0) {
            chartInstance.resize(container.clientWidth, container.clientHeight);
            chartInstance.timeScale().fitContent();
        }
    }).observe(container);

    // Force immediate resize
    setTimeout(() => {
        chartInstance.resize(container.clientWidth, container.clientHeight);
        chartInstance.timeScale().fitContent();
    }, 100);
}

// --- FEATURE: COMPARISON (Basic Implementation) ---
// This function would be triggered by a UI element we add later
function addComparison(ticker, color='#00ffff') {
    if(!chartInstance) return;

    fetch(`/api/dashboard_data?ticker=${ticker}`)
    .then(res => res.json())
    .then(data => {
        const lineSeries = chartInstance.addLineSeries({
            color: color,
            lineWidth: 2,
            priceScaleId: 'left' // Separate scale for comparison
        });
        // Convert OHLC to Line data (Close price)
        const lineData = data.ohlc.map(d => ({ time: d.time, value: d.close }));
        lineSeries.setData(lineData);
    });
}


function renderVerdict(verdict) {
    document.getElementById('verdictSignal').innerText = verdict.signal;
    document.getElementById('verdictSignal').style.color = verdict.color;

    // Update Progress Bar
    const bar = document.getElementById('verdictBar');
    // Map score -5 to 5 to 0% to 100%
    const pct = ((verdict.score + 5) / 10) * 100;
    bar.style.width = `${pct}%`;
    bar.style.backgroundColor = verdict.color;

    const ul = document.getElementById('verdictReasons');
    ul.innerHTML = '';
    verdict.reasons.forEach(r => {
        const li = document.createElement('li');
        li.innerHTML = `> ${r}`;
        ul.appendChild(li);
    });
}

function fetchAI(ticker) {
    document.getElementById('aiContent').innerHTML = '<div class="spinner-border spinner-border-sm" role="status"></div> analyzing...';
    fetch(`/api/ai?ticker=${ticker}`)
    .then(res => res.json())
    .then(data => {
        document.getElementById('aiContent').innerHTML = marked.parse(data.summary);
    });
}

function fetchStockNews(ticker) {
    fetch(`/api/news?ticker=${ticker}`)
    .then(res => res.json())
    .then(data => {
        const list = document.getElementById('newsList');
        list.innerHTML = '';
        if(data.articles) {
            data.articles.slice(0, 5).forEach(a => {
                const item = document.createElement('a');
                item.href = a.url;
                item.className = 'list-group-item list-group-item-action bg-transparent text-white border-secondary small';
                item.target = "_blank";
                item.innerHTML = `
                    <div class="fw-bold">${a.title}</div>
                    <div class="text-muted x-small">${a.source}</div>
                `;
                list.appendChild(item);
            });
        }
    });
}


function formatNumber(num) {
    if (!num || num === 'N/A') return 'N/A';
    if (num >= 1.0e+12) return (num / 1.0e+12).toFixed(2) + "T";
    if (num >= 1.0e+9) return (num / 1.0e+9).toFixed(2) + "B";
    if (num >= 1.0e+6) return (num / 1.0e+6).toFixed(2) + "M";
    if (num >= 1.0e+3) return (num / 1.0e+3).toFixed(1) + "k";
    return num.toFixed(2);
}
