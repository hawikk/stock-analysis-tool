// static/js/main.js

const App = {
    state: {
        currentTicker: null,
        currentPeriod: "1y",
        intervals: []
    },

    init: () => {
        // Init UI Components
        UI.setupNavigation();
        UI.setupSearch();
        Utils.initReferralBanner();

        // Load Initial Data
        App.loadMarketStatus();
        App.loadWhaleActivity();
        App.loadMarketNews();
        App.loadWatchlist();
        App.loadAlerts();
        App.loadSentiment();

        // Auto Refresh
        App.startPolling();

        // Listeners for Chart Time Range
        document.querySelectorAll('.time-range-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                document.querySelectorAll('.time-range-btn').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                App.state.currentPeriod = this.getAttribute('data-range');
                if (App.state.currentTicker) {
                    App.fetchHistory(App.state.currentTicker);
                }
            });
        });
    },

    startPolling: () => {
        // Clear existing
        App.state.intervals.forEach(clearInterval);
        App.state.intervals = [];

        // Market Status & Whale (every 60s)
        App.state.intervals.push(setInterval(App.loadMarketStatus, 60000));
        App.state.intervals.push(setInterval(App.loadWhaleActivity, 60000));
        App.state.intervals.push(setInterval(App.checkAlerts, 60000));
    },

    // --- Data Fetchers ---

    loadMarketStatus: () => API.fetch('/api/market/status').then(UI.renderMarketStatus).catch(e => console.error(e)),

    loadWhaleActivity: () => {
        const tbody = document.getElementById('whaleTableBody');
        if (!tbody.hasChildNodes() || tbody.innerHTML.includes('Loading')) {
             tbody.innerHTML = '<tr><td colspan="14" class="text-center text-muted py-4"><div class="spinner-border spinner-border-sm"></div> Fetching Unusual Flow...</td></tr>';
        }
        API.fetch('/api/market/whale').then(UI.renderWhaleActivity).catch(() => API.handleError('whaleTableBody', 'Failed to load Options Flow', App.loadWhaleActivity));
    },

    loadMarketNews: () => API.fetch('/api/market/news').then(UI.renderNews).catch(console.error),

    loadSentiment: () => API.fetchSentimentSummary().then(UI.renderSentimentSummary).catch(e => console.error("Sentiment Fail", e)),

    // View Switching Logic
    loadViewData: (viewName) => {
        if (viewName === 'screener') App.loadTechScreener();
        if (viewName === 'heatmap') App.loadHeatmap();
        if (viewName === 'calendar') App.loadCalendar();
        if (viewName === 'earnings') App.loadEarnings();
        if (viewName === 'forex') App.loadForex();
        if (viewName === 'macro_social') { App.loadMacro(); App.loadSocial(); }
        if (viewName === 'correlation') App.loadCorrelation();
        // Monte Carlo handles its own trigger
    },

    // --- 2.0 Feature Logic ---

    loadCorrelation: () => {
        const container = document.getElementById('correlationContainer');
        const watchlist = Utils.storage.get('watchlist', []);

        if (watchlist.length < 2) {
            container.innerHTML = '<div class="alert alert-warning text-center">Add at least 2 tickers to your Watchlist to calculate correlation.</div>';
            return;
        }

        container.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-primary"></div><div class="mt-2 text-muted">Crunching 1-Year Correlation Matrix...</div></div>';

        API.fetchCorrelation(watchlist)
           .then(data => {
               if (data.error) throw new Error(data.message);
               Charts.renderHeatmap('correlationContainer', data);
           })
           .catch(err => {
               container.innerHTML = `<div class="alert alert-danger text-center">Correlation Error: ${err.message}</div>`;
           });
    },

    loadMonteCarlo: () => {
        const ticker = document.getElementById('mcTicker').value.toUpperCase() || 'SPY';
        const container = document.getElementById('mcChartContainer');
        container.innerHTML = ''; // Clear previous

        // Show loading overlay
        const loader = document.createElement('div');
        loader.className = 'position-absolute top-50 start-50 translate-middle text-center';
        loader.innerHTML = '<div class="spinner-border text-info"></div><div class="text-white mt-2 small">Running 50 Simulations...</div>';
        container.appendChild(loader);

        API.fetchMonteCarlo(ticker)
           .then(data => {
               container.innerHTML = ''; // Clear loader
               Charts.renderMonteCarlo('mcChartContainer', data);
           })
           .catch(err => {
               container.innerHTML = `<div class="text-danger text-center pt-5">Simulation Failed: ${err.message}</div>`;
           });
    },

    // --- Core Logic ---

    loadStock: (ticker) => {
        const chartBtn = document.querySelector('[data-view="chart"]');
        if(chartBtn) chartBtn.click();

        App.state.currentTicker = ticker;
        document.getElementById('stockSymbol').innerText = ticker;
        document.getElementById('stockName').innerText = "Loading...";
        document.getElementById('currentPrice').innerText = "---";

        // Update Chart Title or Comparison Input
        document.getElementById('compareInput').value = '';

        App.fetchInfo(ticker);
        App.fetchHistory(ticker);
        App.fetchAI(ticker);
        App.fetchStockNews(ticker);
    },

    fetchInfo: (ticker) => {
        API.fetch(`/api/info?ticker=${ticker}`)
        .then(data => {
            if(data.error) return;
            const info = data.info || {};
            const safe = (val) => (val === undefined || val === null || val === 'undefined' || val === 'N/A') ? 'N/A' : val;

            document.getElementById('stockName').innerText = safe(info.name) === 'N/A' ? ticker : info.name;
            document.getElementById('currentPrice').innerText = safe(info.currentPrice) !== 'N/A' ? `$${info.currentPrice}` : '---';

            const grid = document.getElementById('fundamentalsGrid');
            // Improvement: add spacing and alignment for legibility
            grid.innerHTML = `
                 <div class="d-flex justify-content-between border-bottom border-secondary py-2"><span class="text-muted">MKT CAP</span> <span class="text-white font-monospace fw-bold">${Utils.formatNumber(info.marketCap)}</span></div>
                 <div class="d-flex justify-content-between border-bottom border-secondary py-2"><span class="text-muted">P/E</span> <span class="text-white font-monospace fw-bold">${safe(info.peRatio)}</span></div>
                 <div class="d-flex justify-content-between border-bottom border-secondary py-2"><span class="text-muted">DIV</span> <span class="text-white font-monospace fw-bold">${safe(info.dividendYield)}</span></div>
                 <div class="d-flex justify-content-between border-bottom border-secondary py-2"><span class="text-muted">SECTOR</span> <span class="text-white text-truncate font-monospace fw-bold" style="max-width: 120px;">${safe(info.sector)}</span></div>
                 <div class="d-flex justify-content-between border-bottom border-secondary py-2"><span class="text-muted">RSI (14)</span> <span class="text-info font-monospace fw-bold">${safe(data.technicals['RSI (14)'])}</span></div>
            `;
        });
    },

    fetchHistory: (ticker) => {
        API.fetch(`/api/dashboard_data?ticker=${ticker}&period=${App.state.currentPeriod}`)
        .then(data => {
            Charts.renderStockChart('chartContainer', data, App.state.currentPeriod);
            App.renderVerdict(data.verdict);
        })
        .catch(() => API.handleError('chartContainer', 'Chart Data Unavailable', () => App.fetchHistory(ticker)));
    },

    renderVerdict: (verdict) => {
        document.getElementById('verdictSignal').innerText = verdict.signal;
        document.getElementById('verdictSignal').style.color = verdict.color;
        const bar = document.getElementById('verdictBar');
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
    },

    fetchAI: (ticker) => {
        const container = document.getElementById('aiContent');
        container.innerHTML = '<div class="spinner-border spinner-border-sm" role="status"></div> Analyzing...';
        API.fetch(`/api/ai?ticker=${ticker}`).then(data => container.innerHTML = marked.parse(data.summary))
        .catch(() => container.innerHTML = '<span class="text-danger">AI Analysis failed.</span>');
    },

    fetchStockNews: (ticker) => {
        API.fetch(`/api/news?ticker=${ticker}`).then(data => {
            const list = document.getElementById('newsList');
            list.innerHTML = '';
            if(data.articles) {
                data.articles.slice(0, 5).forEach(a => {
                    const item = document.createElement('a');
                    item.href = a.url;
                    item.className = 'list-group-item list-group-item-action bg-transparent text-white border-secondary small';
                    item.target = "_blank";
                    item.innerHTML = `<div class="fw-bold text-truncate">${Utils.escapeHtml(a.title)}</div><div class="text-muted x-small">${Utils.escapeHtml(a.source)}</div>`;
                    list.appendChild(item);
                });
            }
        });
    },

    // --- Other Views (Screener, Heatmap, Calendar etc.) ---
    loadTechScreener: () => {
        const tbody = document.getElementById('screenerTableBody');
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4"><div class="spinner-border spinner-border-sm"></div> Scanning S&P 100...</td></tr>';
        API.fetch('/api/market/screener_tech').then(data => {
            tbody.innerHTML = '';
            if (data.results && data.results.length > 0) {
                data.results.forEach(item => {
                    const tr = document.createElement('tr');
                    tr.style.cursor = 'pointer';
                    tr.addEventListener('click', () => App.loadStock(item.ticker));
                    const chgColor = item.change >= 0 ? 'text-success' : 'text-danger';
                    let rsiClass = item.rsi < 30 ? 'text-success fw-bold' : (item.rsi > 70 ? 'text-danger fw-bold' : 'text-white');
                    tr.innerHTML = `<td class="fw-bold text-white">${item.ticker}</td><td class="text-end text-white">${item.price.toFixed(2)}</td><td class="text-end ${chgColor}">${item.change > 0 ? '+' : ''}${item.change.toFixed(2)}%</td><td class="text-end ${rsiClass}">${item.rsi}</td><td class="text-end text-white">${item.rel_vol}x</td><td class="small text-warning">${item.setups}</td>`;
                    tbody.appendChild(tr);
                });
            } else tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">No signals found.</td></tr>';
        });
    },

    loadHeatmap: () => {
        const grid = document.getElementById('heatmapGrid');
        grid.innerHTML = '<div class="col-12 text-center text-muted py-5"><div class="spinner-border spinner-border-sm"></div> Loading Heatmap...</div>';
        API.fetch('/api/market/heatmap').then(data => {
            grid.innerHTML = '';
            if (data.sectors) {
                data.sectors.forEach(sec => {
                    const div = document.createElement('div');
                    div.className = 'col-md-4 col-lg-3';
                    let bg = sec.change_pct > 0 ? `rgba(0, 184, 148, ${Math.min(0.8, sec.change_pct / 2)})` : `rgba(255, 71, 87, ${Math.min(0.8, Math.abs(sec.change_pct) / 2)})`;
                    div.innerHTML = `<div class="p-3 text-center rounded border border-secondary h-100 d-flex flex-column justify-content-center" style="background: ${bg}; min-height: 100px;"><div class="fw-bold text-white h5 mb-0">${sec.sector}</div><div class="small text-white-50 mb-2">${sec.symbol}</div><div class="fw-bold text-white h4 mb-0">${sec.change_pct > 0 ? '+' : ''}${sec.change_pct.toFixed(2)}%</div></div>`;
                    grid.appendChild(div);
                });
            }
        });
    },

    loadCalendar: () => {
        const tbody = document.getElementById('calendarBody');
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">Loading Calendar...</td></tr>';
        API.fetch('/api/market/calendar').then(data => {
            tbody.innerHTML = '';
            if(data.events) data.events.forEach(e => {
                const tr = document.createElement('tr');
                let impactColor = e.impact === 'High' ? 'text-danger fw-bold' : (e.impact === 'Medium' ? 'text-warning' : 'text-muted');
                tr.innerHTML = `<td class="text-white fw-bold">${new Date(e.date).toLocaleDateString()}</td><td class="text-muted">${e.time}</td><td class="text-white">${e.event}</td><td class="${impactColor}">${e.impact}</td><td class="text-muted">${e.previous}</td><td class="text-info">${e.forecast}</td>`;
                tbody.appendChild(tr);
            });
        });
    },

    loadEarnings: () => {
         const tbody = document.getElementById('earningsBody');
         tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-4">Loading Earnings...</td></tr>';
         API.fetch('/api/market/earnings').then(data => {
             tbody.innerHTML = '';
             if(data.earnings) data.earnings.forEach(e => {
                 const tr = document.createElement('tr');
                 tr.innerHTML = `<td class="text-white fw-bold">${e.ticker}</td><td class="text-muted">${e.name}</td><td class="text-white">${e.date}</td><td class="text-warning">${e.time}</td>`;
                 tbody.appendChild(tr);
             });
         });
    },

    loadForex: () => {
        const tbody = document.getElementById('forexBody');
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-4">Loading Forex Data...</td></tr>';
        let pairs = Utils.storage.get('forexList');
        let url = '/api/market/forex';
        if (pairs && pairs.length > 0) url += '?tickers=' + encodeURIComponent(pairs.join(','));
        API.fetch(url).then(data => {
            tbody.innerHTML = '';
            if(data.forex) data.forex.forEach(item => {
                const tr = document.createElement('tr');
                tr.style.cursor = 'pointer';
                tr.onclick = () => App.loadStock(item.ticker);
                const chgColor = item.change_1mo >= 0 ? 'text-success' : 'text-danger';
                const canvasId = `spark-${item.ticker.replace(/[=^]/g,'')}`;
                tr.innerHTML = `<td class="fw-bold text-white">${item.name} <span class="text-muted x-small">(${item.ticker})</span></td><td class="text-end text-white">${item.price}</td><td class="text-end ${chgColor}">${item.change_1mo > 0 ? '+' : ''}${item.change_1mo}%</td><td class="text-end p-1" style="height: 40px;"><div id="${canvasId}" style="width: 100%; height: 100%;"></div></td>`;
                tbody.appendChild(tr);
                setTimeout(() => Charts.renderSparkline(canvasId, item.sparkline, item.change_1mo), 100);
            });
        });
    },

    addForexPair: () => {
        const input = document.getElementById('forexInput');
        const query = input.value.trim();
        if(!query) return;
        API.fetch(`/api/search?q=${query}`).then(data => {
            if(data.results && data.results.length > 0) {
                const ticker = data.results[0].symbol;
                let pairs = Utils.storage.get('forexList', []);
                if (pairs.length === 0) pairs = ['EURUSD=X', 'JPY=X', 'GBPUSD=X', 'EURJPY=X', 'EURGBP=X', 'EURCHF=X'];
                if(!pairs.includes(ticker)) {
                    pairs.push(ticker);
                    Utils.storage.set('forexList', pairs);
                    App.loadForex();
                    input.value = '';
                } else alert('Pair already in list.');
            } else alert('Currency pair not found. Try format "EUR/JPY"');
        });
    },

    loadMacro: () => {
        const grid = document.getElementById('macroGrid');
        grid.innerHTML = '<div class="col-12 text-center text-muted">Loading Macro Data...</div>';
        API.fetch('/api/market/macro').then(data => {
            grid.innerHTML = '';
            if(data.data) data.data.forEach(item => {
                const div = document.createElement('div');
                div.className = 'col-md-3';
                const chgColor = item.change_pct >= 0 ? 'text-success' : 'text-danger';
                div.innerHTML = `<div class="card bg-darker border-secondary h-100"><div class="card-body text-center"><div class="text-muted small text-uppercase mb-1">${item.name}</div><div class="h4 text-white fw-bold mb-0">${Utils.formatNumber(item.price)}</div><div class="${chgColor} small">${item.change_pct > 0 ? '+' : ''}${item.change_pct.toFixed(2)}%</div></div></div>`;
                grid.appendChild(div);
            });
        });
    },

    loadSocial: () => {
        const grid = document.getElementById('socialGrid');
        grid.innerHTML = '<div class="col-12 text-center text-muted">Loading Social Sentiment...</div>';
        API.fetch('/api/market/social').then(data => {
            grid.innerHTML = '';
            if(data.social) data.social.forEach(item => {
                const div = document.createElement('div');
                div.className = 'col-md-3';
                let statusColor = item.status.includes('Bullish') ? 'text-success' : (item.status.includes('Bearish') ? 'text-danger' : 'text-muted');
                div.innerHTML = `<div class="card bg-darker border-secondary h-100" style="cursor:pointer;" onclick="App.loadStock('${item.ticker}')"><div class="card-body text-center"><h5 class="text-white fw-bold mb-1">${item.ticker}</h5><div class="progress bg-dark mb-2" style="height: 6px;"><div class="progress-bar ${item.sentiment_score > 50 ? 'bg-success' : 'bg-danger'}" role="progressbar" style="width: ${item.sentiment_score}%"></div></div><div class="${statusColor} fw-bold small mb-1">${item.status}</div><div class="text-muted x-small"><i class="fa-brands fa-reddit-alien me-1"></i> ${item.mentions} Mentions</div></div></div>`;
                grid.appendChild(div);
            });
        });
    },

    // --- Watchlist & Alerts (Existing Logic Maintained) ---

    loadWatchlist: () => {
        const watchlist = Utils.storage.get('watchlist', []);
        const tbody = document.getElementById('watchlistBody');
        if(!tbody) return;
        tbody.innerHTML = '';
        if(watchlist.length === 0) { tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-4">Watchlist is empty.</td></tr>'; return; }

        watchlist.forEach(ticker => {
            const tr = document.createElement('tr');
            tr.id = `wl-${ticker}`;
            tr.innerHTML = `<td class="fw-bold text-white">${ticker}</td><td class="text-end text-muted">...</td><td class="text-end text-muted">...</td><td class="text-end"><button class="btn btn-sm btn-outline-danger py-0" onclick="App.removeFromWatchlist('${ticker}')"><i class="fa-solid fa-trash"></i></button></td>`;
            tbody.appendChild(tr);

            // Fetch live price for watchlist (optimized 1d)
            API.fetch(`/api/dashboard_data?ticker=${ticker}&period=1d`).then(d => {
                 if(d.ohlc && d.ohlc.length > 0) {
                     const close = d.ohlc[d.ohlc.length-1].close;
                     const open = d.ohlc[0].open;
                     const change = ((close - open) / open) * 100;
                     const row = document.getElementById(`wl-${ticker}`);
                     if(row) {
                         const chgColor = change >= 0 ? 'text-success' : 'text-danger';
                         row.innerHTML = `<td class="fw-bold text-white cursor-pointer" onclick="App.loadStock('${ticker}')">${ticker}</td><td class="text-end text-white">${close.toFixed(2)}</td><td class="text-end ${chgColor}">${change > 0 ? '+' : ''}${change.toFixed(2)}%</td><td class="text-end"><button class="btn btn-sm btn-outline-danger py-0" onclick="App.removeFromWatchlist('${ticker}')"><i class="fa-solid fa-trash"></i></button></td>`;
                     }
                 }
            });
        });
    },

    addToWatchlist: () => {
        const input = document.getElementById('watchlistInput');
        const ticker = input.value.toUpperCase().trim();
        if(!ticker) return;
        const watchlist = Utils.storage.get('watchlist', []);
        if(!watchlist.includes(ticker)) {
            watchlist.push(ticker);
            Utils.storage.set('watchlist', watchlist);
            App.loadWatchlist();
        }
        input.value = '';
    },
    removeFromWatchlist: (ticker) => {
        let watchlist = Utils.storage.get('watchlist', []);
        watchlist = watchlist.filter(t => t !== ticker);
        Utils.storage.set('watchlist', watchlist);
        App.loadWatchlist();
    },

    loadAlerts: () => {
        const alerts = Utils.storage.get('alerts', []);
        const tbody = document.getElementById('alertsBody');
        if(!tbody) return;
        tbody.innerHTML = '';
        if(alerts.length === 0) { tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">No alerts set.</td></tr>'; return; }
        alerts.forEach((alert, index) => {
            const tr = document.createElement('tr');
            const statusColor = alert.triggered ? 'text-danger fw-bold' : 'text-muted';
            const statusText = alert.triggered ? 'TRIGGERED' : 'ACTIVE';
            tr.innerHTML = `<td class="text-white fw-bold">${alert.ticker}</td><td class="text-info">${alert.condition === 'gt' ? '>' : '<'}</td><td class="text-white">${alert.target}</td><td class="text-muted" id="alert-curr-${index}">...</td><td class="${statusColor}">${statusText}</td><td><button class="btn btn-sm btn-outline-danger py-0" onclick="App.removeAlert(${index})"><i class="fa-solid fa-trash"></i></button></td>`;
            tbody.appendChild(tr);
        });
    },
    addAlert: () => {
        const ticker = document.getElementById('alertTicker').value.toUpperCase().trim();
        const condition = document.getElementById('alertCondition').value;
        const price = parseFloat(document.getElementById('alertPrice').value);
        if(!ticker || !price) return;
        const alerts = Utils.storage.get('alerts', []);
        alerts.push({ ticker: ticker, condition: condition, target: price, triggered: false });
        Utils.storage.set('alerts', alerts);
        document.getElementById('alertTicker').value = '';
        document.getElementById('alertPrice').value = '';
        App.loadAlerts();
    },
    removeAlert: (index) => {
        const alerts = Utils.storage.get('alerts', []);
        alerts.splice(index, 1);
        Utils.storage.set('alerts', alerts);
        App.loadAlerts();
    },
    checkAlerts: () => {
        const alerts = Utils.storage.get('alerts', []);
        if(alerts.length === 0) return;
        alerts.forEach((alert, index) => {
            if(alert.triggered) return;
            // Lightweight check using stock info
            API.fetch(`/api/info?ticker=${alert.ticker}`).then(data => {
                if(data.info && data.info.currentPrice) {
                    const price = data.info.currentPrice;
                    const cell = document.getElementById(`alert-curr-${index}`);
                    if(cell) cell.innerText = price;
                    let trigger = false;
                    if(alert.condition === 'gt' && price > alert.target) trigger = true;
                    if(alert.condition === 'lt' && price < alert.target) trigger = true;
                    if(trigger) {
                        alert.triggered = true;
                        Utils.storage.set('alerts', alerts);
                        App.loadAlerts();
                        // Browser Notification
                        if(Notification.permission === 'granted') {
                            new Notification(`Price Alert: ${alert.ticker}`, { body: `Price has reached ${price}` });
                        } else if (Notification.permission !== 'denied') {
                             Notification.requestPermission();
                        }
                    }
                }
            });
        });
    }
};

window.addToWatchlist = App.addToWatchlist;
window.removeFromWatchlist = App.removeFromWatchlist;
window.addAlert = App.addAlert;
window.removeAlert = App.removeAlert;
window.addForexPair = App.addForexPair;
window.triggerComparison = () => { const t = document.getElementById('compareInput').value.toUpperCase(); if(t) Charts.addComparison(t); };

document.addEventListener('DOMContentLoaded', App.init);
