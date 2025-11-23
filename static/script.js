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
    loadWatchlist(); // Load Watchlist from LocalStorage
    loadAlerts(); // Load Alerts from LocalStorage

    // Initialize clock
    setInterval(() => {
        const now = new Date();
        document.getElementById('clock').innerText = now.toISOString().split('T')[1].split('.')[0];
    }, 1000);

    // Run Alert Checks periodically (every 60s)
    setInterval(checkAlerts, 60000);
});

// View Navigation
document.querySelectorAll('[data-view]').forEach(btn => {
    btn.addEventListener('click', function() {
        // Buttons
        document.querySelectorAll('[data-view]').forEach(b => b.classList.remove('active'));
        this.classList.add('active');

        // Sections
        const viewName = this.getAttribute('data-view');
        const viewId = 'view' + viewName.charAt(0).toUpperCase() + viewName.slice(1);
        document.querySelectorAll('.view-section').forEach(el => el.classList.add('d-none'));

        const target = document.getElementById(viewId);
        if(target) {
            target.classList.remove('d-none');
            // Trigger data load based on view
            if (viewName === 'screener') loadTechScreener();
            if (viewName === 'heatmap') loadHeatmap();
            if (viewName === 'calendar') loadCalendar();
            if (viewName === 'earnings') loadEarnings();
            if (viewName === 'macro') loadMacro();
            if (viewName === 'social') loadSocial();
        } else {
            // Handle partial mapping for existing logic
            if(viewName === 'chart') document.getElementById('viewStock').classList.remove('d-none');
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
    if (!tbody) return;
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
                let typeClass = 'uw-put';
                let typeLabel = 'PUT';

                if (item.type === 'C') { typeClass = 'uw-call'; typeLabel = 'CALL'; }
                else if (item.type === 'EQ') { typeClass = 'bg-secondary text-white'; typeLabel = 'STOCK'; }

                const sentimentClass = item.sentiment === 'BULLISH' ? 'text-bull' : 'text-bear';
                const chgColor = item.change_pct >= 0 ? 'text-success' : 'text-danger';

                // OTM Format
                const otmColor = item.otm_status === 'OTM' ? 'text-muted' : 'text-white';

                tr.innerHTML = `
                    <td class="fw-bold text-white"><span class="d-flex align-items-center gap-2"><img src="https://logo.clearbit.com/${item.ticker}.com" style="width:16px;height:16px;border-radius:50%;" onerror="this.style.display='none'"> ${item.ticker}</span></td>
                    <td class="text-muted small">${item.contract}</td>
                    <td><span class="uw-tag ${typeClass}">${typeLabel}</span></td>
                    <td class="text-white">${item.dte === '-' ? '-' : item.dte + 'd'}</td>
                    <td class="text-end text-white">${item.strike > 0 ? item.strike.toFixed(2) : '-'}</td>
                    <td class="text-end text-muted">${item.stock_price > 0 ? item.stock_price.toFixed(2) : '-'}</td>
                    <td class="text-end ${otmColor}">${item.otm_pct > 0 ? item.otm_pct + '%' : '-'}</td>
                    <td class="text-end text-white">${item.price.toFixed(2)}</td>
                    <td class="text-end ${chgColor}">${item.change_pct > 0 ? '+' : ''}${item.change_pct.toFixed(1)}%</td>
                    <td class="text-end text-warning fw-bold">${formatNumber(item.vol)}</td>
                    <td class="text-end text-muted">${item.oi > 0 ? formatNumber(item.oi) : '-'}</td>
                    <td class="text-end text-white">$${formatNumber(item.premium)}</td>
                    <td class="text-end text-muted">${item.iv > 0 ? item.iv + '%' : '-'}</td>
                    <td class="text-center ${sentimentClass} fw-bold small">${item.sentiment}</td>
                `;
                tbody.appendChild(tr);
            });

            // Show notice if fallback
            if (data.data[0].type === 'EQ') {
                const notice = document.createElement('tr');
                notice.innerHTML = '<td colspan="14" class="text-center text-warning small py-1 bg-darker"><i class="fa-solid fa-triangle-exclamation me-2"></i>Options data restricted by API plan. Showing High-Volume Equity Flows.</td>';
                tbody.insertBefore(notice, tbody.firstChild);
            }
        } else {
            tbody.innerHTML = '<tr><td colspan="14" class="text-center text-muted py-4">No unusual activity found or API limit reached.</td></tr>';
        }
    })
    .catch(err => {
        console.error(err);
        if (tbody) tbody.innerHTML = '<tr><td colspan="14" class="text-center text-danger py-4">Error fetching data.</td></tr>';
    });
}

function loadMarketNews() {
    fetch('/api/market/news')
    .then(res => res.json())
    .then(data => {
        const grid = document.getElementById('marketNewsGrid');
        if(!grid) return;
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

// --- NEW FEATURES IMPLEMENTATION ---

function loadTechScreener() {
    const tbody = document.getElementById('screenerTableBody');
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4"><div class="spinner-border spinner-border-sm"></div> Scanning S&P 100...</td></tr>';

    fetch('/api/market/screener_tech')
    .then(res => res.json())
    .then(data => {
        tbody.innerHTML = '';
        if (data.results && data.results.length > 0) {
            data.results.forEach(item => {
                const tr = document.createElement('tr');
                tr.style.cursor = 'pointer';
                tr.addEventListener('click', () => loadStock(item.ticker));

                const chgColor = item.change >= 0 ? 'text-success' : 'text-danger';
                // Highlight RSI
                let rsiClass = 'text-white';
                if(item.rsi < 30) rsiClass = 'text-success fw-bold'; // Oversold
                if(item.rsi > 70) rsiClass = 'text-danger fw-bold'; // Overbought

                tr.innerHTML = `
                    <td class="fw-bold text-white">${item.ticker}</td>
                    <td class="text-end text-white">${item.price.toFixed(2)}</td>
                    <td class="text-end ${chgColor}">${item.change > 0 ? '+' : ''}${item.change.toFixed(2)}%</td>
                    <td class="text-end ${rsiClass}">${item.rsi}</td>
                    <td class="text-end text-white">${item.rel_vol}x</td>
                    <td class="small text-warning">${item.setups}</td>
                `;
                tbody.appendChild(tr);
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">No signals found matching criteria.</td></tr>';
        }
    });
}

function loadHeatmap() {
    const grid = document.getElementById('heatmapGrid');
    grid.innerHTML = '<div class="col-12 text-center text-muted py-5"><div class="spinner-border spinner-border-sm"></div> Loading Heatmap...</div>';

    fetch('/api/market/heatmap')
    .then(res => res.json())
    .then(data => {
        grid.innerHTML = '';
        if (data.sectors) {
            data.sectors.forEach(sec => {
                const div = document.createElement('div');
                div.className = 'col-md-4 col-lg-3';

                // Color Scale
                let bg = 'rgba(108, 117, 125, 0.2)'; // Neutral
                if (sec.change_pct > 0) bg = `rgba(0, 184, 148, ${Math.min(0.8, sec.change_pct / 2)})`;
                if (sec.change_pct < 0) bg = `rgba(255, 71, 87, ${Math.min(0.8, Math.abs(sec.change_pct) / 2)})`;

                div.innerHTML = `
                    <div class="p-3 text-center rounded border border-secondary h-100 d-flex flex-column justify-content-center" style="background: ${bg}; min-height: 100px;">
                        <div class="fw-bold text-white h5 mb-0">${sec.sector}</div>
                        <div class="small text-white-50 mb-2">${sec.symbol}</div>
                        <div class="fw-bold text-white h4 mb-0">${sec.change_pct > 0 ? '+' : ''}${sec.change_pct.toFixed(2)}%</div>
                    </div>
                `;
                grid.appendChild(div);
            });
        }
    });
}

function loadCalendar() {
    const tbody = document.getElementById('calendarBody');
    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">Loading Calendar...</td></tr>';

    fetch('/api/market/calendar')
    .then(res => res.json())
    .then(data => {
        tbody.innerHTML = '';
        if(data.events) {
            data.events.forEach(e => {
                const tr = document.createElement('tr');
                let impactColor = 'text-muted';
                if(e.impact === 'High') impactColor = 'text-danger fw-bold';
                if(e.impact === 'Medium') impactColor = 'text-warning';

                tr.innerHTML = `
                    <td class="text-white">${e.time}</td>
                    <td class="text-white">${e.event}</td>
                    <td class="${impactColor}">${e.impact}</td>
                    <td class="text-muted">${e.previous}</td>
                    <td class="text-info">${e.forecast}</td>
                `;
                tbody.appendChild(tr);
            });
        }
    });
}

function loadEarnings() {
    const tbody = document.getElementById('earningsBody');
    tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-4">Loading Earnings...</td></tr>';

    fetch('/api/market/earnings')
    .then(res => res.json())
    .then(data => {
        tbody.innerHTML = '';
        if(data.earnings) {
            data.earnings.forEach(e => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td class="text-white fw-bold">${e.ticker}</td>
                    <td class="text-muted">${e.name}</td>
                    <td class="text-white">${e.date}</td>
                    <td class="text-warning">${e.time}</td>
                `;
                tbody.appendChild(tr);
            });
        }
    });
}

function loadMacro() {
    const grid = document.getElementById('macroGrid');
    grid.innerHTML = '<div class="col-12 text-center text-muted">Loading Macro Data...</div>';

    fetch('/api/market/macro')
    .then(res => res.json())
    .then(data => {
        grid.innerHTML = '';
        if(data.data) {
            data.data.forEach(item => {
                const div = document.createElement('div');
                div.className = 'col-md-3';
                const chgColor = item.change_pct >= 0 ? 'text-success' : 'text-danger';

                div.innerHTML = `
                    <div class="card bg-darker border-secondary h-100">
                        <div class="card-body text-center">
                            <div class="text-muted small text-uppercase mb-1">${item.name}</div>
                            <div class="h4 text-white fw-bold mb-0">${formatNumber(item.price)}</div>
                            <div class="${chgColor} small">${item.change_pct > 0 ? '+' : ''}${item.change_pct.toFixed(2)}%</div>
                        </div>
                    </div>
                `;
                grid.appendChild(div);
            });
        }
    });
}

function loadSocial() {
    const grid = document.getElementById('socialGrid');
    grid.innerHTML = '<div class="col-12 text-center text-muted">Loading Social Sentiment...</div>';

    fetch('/api/market/social')
    .then(res => res.json())
    .then(data => {
        grid.innerHTML = '';
        if(data.social) {
            data.social.forEach(item => {
                const div = document.createElement('div');
                div.className = 'col-md-3';

                let statusColor = 'text-muted';
                if(item.status.includes('Bullish')) statusColor = 'text-success';
                if(item.status.includes('Bearish')) statusColor = 'text-danger';

                div.innerHTML = `
                    <div class="card bg-darker border-secondary h-100">
                        <div class="card-body text-center">
                            <h5 class="text-white fw-bold mb-1">${item.ticker}</h5>
                            <div class="progress bg-dark mb-2" style="height: 6px;">
                                <div class="progress-bar ${item.sentiment_score > 50 ? 'bg-success' : 'bg-danger'}" role="progressbar" style="width: ${item.sentiment_score}%"></div>
                            </div>
                            <div class="${statusColor} fw-bold small mb-1">${item.status}</div>
                            <div class="text-muted x-small"><i class="fa-brands fa-reddit-alien me-1"></i> ${item.mentions} Mentions</div>
                        </div>
                    </div>
                `;
                div.style.cursor = 'pointer';
                div.addEventListener('click', () => loadStock(item.ticker));
                grid.appendChild(div);
            });
        }
    });
}

// --- WATCHLIST (LOCAL STORAGE) ---

function loadWatchlist() {
    const watchlist = JSON.parse(localStorage.getItem('watchlist') || '[]');
    const tbody = document.getElementById('watchlistBody');
    if(!tbody) return;
    tbody.innerHTML = '';

    if(watchlist.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-4">Watchlist is empty. Add a ticker above.</td></tr>';
        return;
    }

    // Fetch current prices for watchlist items (One by one or batch if endpoint supported)
    // For now, we reuse the /api/info or just display static if lazy, but let's try to be dynamic
    // We will make a quick fetch for each (not efficient but works for small lists)

    watchlist.forEach(ticker => {
        // Creating a row skeleton first
        const tr = document.createElement('tr');
        tr.id = `wl-${ticker}`;
        tr.innerHTML = `
            <td class="fw-bold text-white">${ticker}</td>
            <td class="text-end text-muted">...</td>
            <td class="text-end text-muted">...</td>
            <td class="text-end"><button class="btn btn-sm btn-outline-danger py-0" onclick="removeFromWatchlist('${ticker}')"><i class="fa-solid fa-trash"></i></button></td>
        `;
        tbody.appendChild(tr);

        // Fetch Data
        fetch(`/api/info?ticker=${ticker}`)
        .then(res => res.json())
        .then(data => {
            if(data.info && data.technicals) {
                // We need change pct, which might be in dashboard_data or calc here if we had prev close
                // Let's use macro endpoint style logic or just fetch dashboard data for 1d
                 fetch(`/api/dashboard_data?ticker=${ticker}&period=1d`)
                 .then(r => r.json())
                 .then(d => {
                     if(d.ohlc && d.ohlc.length > 0) {
                         const close = d.ohlc[d.ohlc.length-1].close;
                         const open = d.ohlc[0].open;
                         const change = ((close - open) / open) * 100;

                         const row = document.getElementById(`wl-${ticker}`);
                         if(row) {
                             const chgColor = change >= 0 ? 'text-success' : 'text-danger';
                             row.innerHTML = `
                                <td class="fw-bold text-white cursor-pointer" onclick="loadStock('${ticker}')">${ticker}</td>
                                <td class="text-end text-white">${close.toFixed(2)}</td>
                                <td class="text-end ${chgColor}">${change > 0 ? '+' : ''}${change.toFixed(2)}%</td>
                                <td class="text-end"><button class="btn btn-sm btn-outline-danger py-0" onclick="removeFromWatchlist('${ticker}')"><i class="fa-solid fa-trash"></i></button></td>
                             `;
                         }
                     }
                 });
            }
        });
    });
}

function addToWatchlist() {
    const input = document.getElementById('watchlistInput');
    const ticker = input.value.toUpperCase().trim();
    if(!ticker) return;

    const watchlist = JSON.parse(localStorage.getItem('watchlist') || '[]');
    if(!watchlist.includes(ticker)) {
        watchlist.push(ticker);
        localStorage.setItem('watchlist', JSON.stringify(watchlist));
        loadWatchlist();
    }
    input.value = '';
}

function removeFromWatchlist(ticker) {
    let watchlist = JSON.parse(localStorage.getItem('watchlist') || '[]');
    watchlist = watchlist.filter(t => t !== ticker);
    localStorage.setItem('watchlist', JSON.stringify(watchlist));
    loadWatchlist();
}

// --- ALERTS (LOCAL STORAGE) ---

function loadAlerts() {
    const alerts = JSON.parse(localStorage.getItem('alerts') || '[]');
    const tbody = document.getElementById('alertsBody');
    if(!tbody) return;
    tbody.innerHTML = '';

    if(alerts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">No alerts set.</td></tr>';
        return;
    }

    alerts.forEach((alert, index) => {
        const tr = document.createElement('tr');
        const statusColor = alert.triggered ? 'text-danger fw-bold' : 'text-muted';
        const statusText = alert.triggered ? 'TRIGGERED' : 'ACTIVE';

        tr.innerHTML = `
            <td class="text-white fw-bold">${alert.ticker}</td>
            <td class="text-info">${alert.condition === 'gt' ? '>' : '<'}</td>
            <td class="text-white">${alert.target}</td>
            <td class="text-muted" id="alert-curr-${index}">...</td>
            <td class="${statusColor}">${statusText}</td>
            <td><button class="btn btn-sm btn-outline-danger py-0" onclick="removeAlert(${index})"><i class="fa-solid fa-trash"></i></button></td>
        `;
        tbody.appendChild(tr);
    });
}

function addAlert() {
    const ticker = document.getElementById('alertTicker').value.toUpperCase().trim();
    const condition = document.getElementById('alertCondition').value;
    const price = parseFloat(document.getElementById('alertPrice').value);

    if(!ticker || !price) return;

    const alerts = JSON.parse(localStorage.getItem('alerts') || '[]');
    alerts.push({
        ticker: ticker,
        condition: condition,
        target: price,
        triggered: false
    });
    localStorage.setItem('alerts', JSON.stringify(alerts));

    document.getElementById('alertTicker').value = '';
    document.getElementById('alertPrice').value = '';
    loadAlerts();
}

function removeAlert(index) {
    const alerts = JSON.parse(localStorage.getItem('alerts') || '[]');
    alerts.splice(index, 1);
    localStorage.setItem('alerts', JSON.stringify(alerts));
    loadAlerts();
}

function checkAlerts() {
    const alerts = JSON.parse(localStorage.getItem('alerts') || '[]');
    if(alerts.length === 0) return;

    // For each active alert, check price
    // Note: This is client-side polling. In prod, this should be backend/websocket.
    alerts.forEach((alert, index) => {
        if(alert.triggered) return; // Skip triggered

        fetch(`/api/info?ticker=${alert.ticker}`)
        .then(res => res.json())
        .then(data => {
            if(data.info && data.info.currentPrice) {
                const price = data.info.currentPrice;
                const cell = document.getElementById(`alert-curr-${index}`);
                if(cell) cell.innerText = price;

                let trigger = false;
                if(alert.condition === 'gt' && price > alert.target) trigger = true;
                if(alert.condition === 'lt' && price < alert.target) trigger = true;

                if(trigger) {
                    alert.triggered = true;
                    localStorage.setItem('alerts', JSON.stringify(alerts));
                    loadAlerts();
                    // Browser Notification (Optional)
                    alert(`PRICE ALERT: ${alert.ticker} is ${price} (${alert.condition === 'gt' ? 'Above' : 'Below'} ${alert.target})`);
                }
            }
        });
    });
}


// --- SEARCH & STOCK VIEW (EXISTING) ---

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

// --- STOCK DETAILS LOGIC (EXISTING) ---

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
