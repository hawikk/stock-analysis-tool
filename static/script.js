let chartInstance = null;
let rsiChartInstance = null;
let macdChartInstance = null;
let volumeSeries, candlestickSeries, sma50Series, sma200Series, bbUpper, bbLower;
let rsiSeries;
let macdLineSeries, macdSignalSeries, macdHistSeries;

// Dark Mode Logic
const themeToggleBtn = document.getElementById('themeToggle');
const body = document.body;
const icon = themeToggleBtn.querySelector('i');

// Default to Dark Mode
if (!localStorage.getItem('theme')) {
    localStorage.setItem('theme', 'dark');
}

if (localStorage.getItem('theme') === 'dark') {
    body.setAttribute('data-theme', 'dark');
    icon.classList.remove('fa-moon');
    icon.classList.add('fa-sun');
}

themeToggleBtn.addEventListener('click', () => {
    const isDark = body.getAttribute('data-theme') === 'dark';
    if (isDark) {
        body.removeAttribute('data-theme');
        localStorage.setItem('theme', 'light');
        icon.classList.remove('fa-sun');
        icon.classList.add('fa-moon');
    } else {
        body.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
        icon.classList.remove('fa-moon');
        icon.classList.add('fa-sun');
    }
    if (chartInstance) {
        applyChartTheme(chartInstance, rsiChartInstance, macdChartInstance);
    }
});

// Autocomplete
const tickerInput = document.getElementById('tickerInput');
const suggestionsBox = document.getElementById('suggestionsBox');
let debounceTimer;

tickerInput.addEventListener('input', function() {
    const query = this.value;
    clearTimeout(debounceTimer);
    
    if (query.length < 1) {
        suggestionsBox.classList.add('d-none');
        return;
    }

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
                        div.innerHTML = `<span>${item.symbol}</span><span>${item.shortname || item.longname}</span>`;
                        div.addEventListener('click', () => {
                            tickerInput.value = item.symbol;
                            suggestionsBox.classList.add('d-none');
                            document.getElementById('searchBtn').click();
                        });
                        suggestionsBox.appendChild(div);
                    });
                } else {
                    suggestionsBox.classList.add('d-none');
                }
            })
            .catch(err => console.error(err));
    }, 300);
});

document.addEventListener('click', function(e) {
    if (e.target !== tickerInput && e.target !== suggestionsBox) {
        suggestionsBox.classList.add('d-none');
    }
});

document.querySelectorAll('.ticker-chip-nav').forEach(chip => {
    chip.addEventListener('click', function() {
        document.getElementById('tickerInput').value = this.textContent.trim();
        document.getElementById('searchBtn').click();
    });
});

// Search Button
document.getElementById('searchBtn').addEventListener('click', function() {
    const ticker = document.getElementById('tickerInput').value.toUpperCase();
    if (!ticker) return alert('Please enter a stock ticker');

    // Close suggestions
    suggestionsBox.classList.add('d-none');

    // UI Reset
    document.getElementById('initialState').classList.add('d-none');
    document.getElementById('dashboard').classList.remove('d-none');
    document.getElementById('chartLoader').classList.remove('d-none');
    document.getElementById('verdictSummary').innerText = "Analyzing market data...";

    // Clear data
    document.getElementById('stockSymbol').innerText = ticker;
    document.getElementById('stockName').innerText = "";
    document.getElementById('currentPrice').innerText = "---";
    document.getElementById('priceChange').innerText = "---";
    document.getElementById('verdictReasons').innerHTML = "";
    document.getElementById('verdictScore').innerText = "-";
    document.getElementById('fundamentalsGrid').innerHTML = "";

    // Fetch
    fetchDashboardData(ticker);
    fetchInfo(ticker);
    fetchNews(ticker);
    fetchAI(ticker);
});

function fetchDashboardData(ticker) {
    console.log("Fetching dashboard data for", ticker);
    fetch(`/api/dashboard_data?ticker=${ticker}`)
    .then(response => response.json())
    .then(data => {
        if (data.error) throw new Error(data.error);
        console.log("Dashboard data received", data);
        
        document.getElementById('chartLoader').classList.add('d-none');
        try {
            renderCharts(data);
            renderVerdict(data.verdict);
        } catch (e) {
            console.error("Error rendering charts/verdict:", e);
        }
    })
    .catch(err => {
        console.error("Dashboard Fetch Error:", err);
        document.getElementById('chartLoader').innerHTML = `<p class="text-danger">Error loading chart data: ${err.message}</p>`;
    });
}

function renderCharts(data) {
    const container = document.getElementById('chartContainer');
    container.innerHTML = '';

    // Create 3 divs
    const mainDiv = document.createElement('div');
    mainDiv.id = 'mainChartDiv';
    mainDiv.style.height = '65%';
    mainDiv.style.width = '100%';
    container.appendChild(mainDiv);

    const rsiDiv = document.createElement('div');
    rsiDiv.style.height = '17%';
    rsiDiv.style.width = '100%';
    container.appendChild(rsiDiv);

    const macdDiv = document.createElement('div');
    macdDiv.style.height = '18%';
    macdDiv.style.width = '100%';
    container.appendChild(macdDiv);

    const isDark = document.body.getAttribute('data-theme') === 'dark';
    const gridColor = isDark ? '#334155' : '#e2e8f0';
    const textColor = isDark ? '#94a3b8' : '#64748b';

    const chartOptions = {
        layout: { background: { type: 'solid', color: 'transparent' }, textColor: textColor },
        grid: { vertLines: { color: gridColor }, horzLines: { color: gridColor } },
        timeScale: { borderColor: gridColor, timeVisible: true },
        rightPriceScale: { borderColor: gridColor },
        width: container.clientWidth, // Set initial width
        height: container.clientHeight * 0.65 // Set initial height
    };

    // 1. Main Chart
    chartInstance = LightweightCharts.createChart(mainDiv, chartOptions);
    candlestickSeries = chartInstance.addCandlestickSeries({
        upColor: '#10b981', downColor: '#ef4444', borderVisible: false, wickUpColor: '#10b981', wickDownColor: '#ef4444',
    });
    candlestickSeries.setData(data.ohlc);

    volumeSeries = chartInstance.addHistogramSeries({
        priceFormat: { type: 'volume' },
        priceScaleId: '',
    });
    volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
    volumeSeries.setData(data.volume);

    sma50Series = chartInstance.addLineSeries({ color: '#FF9800', lineWidth: 2 });
    sma50Series.setData(data.indicators.sma50);

    sma200Series = chartInstance.addLineSeries({ color: '#2962FF', lineWidth: 2 });
    sma200Series.setData(data.indicators.sma200);

    bbUpper = chartInstance.addLineSeries({ color: 'rgba(38, 166, 154, 0.6)', lineWidth: 1, lineStyle: 2 });
    bbUpper.setData(data.indicators.bb_upper);
    bbLower = chartInstance.addLineSeries({ color: 'rgba(38, 166, 154, 0.6)', lineWidth: 1, lineStyle: 2 });
    bbLower.setData(data.indicators.bb_lower);

    // Add Markers (Crosses & Squeezes)
    if (data.markers && data.markers.length > 0) {
        candlestickSeries.setMarkers(data.markers);
    }

    // 2. RSI
    rsiChartInstance = LightweightCharts.createChart(rsiDiv, {
        ...chartOptions,
        height: container.clientHeight * 0.17,
        timeScale: { visible: false }
    });
    rsiSeries = rsiChartInstance.addLineSeries({ color: '#8b5cf6', lineWidth: 2 });
    rsiSeries.setData(data.indicators.rsi);

    const rsi70 = rsiChartInstance.addLineSeries({ color: '#ef4444', lineWidth: 1, lineStyle: 2 });
    rsi70.setData(data.indicators.rsi.map(d => ({ time: d.time, value: 70 })));
    const rsi30 = rsiChartInstance.addLineSeries({ color: '#10b981', lineWidth: 1, lineStyle: 2 });
    rsi30.setData(data.indicators.rsi.map(d => ({ time: d.time, value: 30 })));

    // 3. MACD
    macdChartInstance = LightweightCharts.createChart(macdDiv, {
        ...chartOptions,
        height: container.clientHeight * 0.18,
        timeScale: { visible: true }
    });
    macdHistSeries = macdChartInstance.addHistogramSeries({ color: '#26a69a' });
    macdHistSeries.setData(data.indicators.macd_hist);
    macdLineSeries = macdChartInstance.addLineSeries({ color: '#2962FF', lineWidth: 2 });
    macdLineSeries.setData(data.indicators.macd_line);
    macdSignalSeries = macdChartInstance.addLineSeries({ color: '#FF6D00', lineWidth: 2 });
    macdSignalSeries.setData(data.indicators.macd_signal);

    // Force resize
    const resize = () => {
        const w = container.clientWidth;
        const h = container.clientHeight;
        console.log("Resizing charts to", w, h);
        if (w === 0 || h === 0) return;
        
        chartInstance.resize(w, h * 0.65);
        rsiChartInstance.resize(w, h * 0.17);
        macdChartInstance.resize(w, h * 0.18);

        // Fit content after resize
        chartInstance.timeScale().fitContent();
        rsiChartInstance.timeScale().fitContent();
        macdChartInstance.timeScale().fitContent();
    };

    new ResizeObserver(resize).observe(container);

    // Call resize immediately
    setTimeout(resize, 0);

    // Sync
    const charts = [chartInstance, rsiChartInstance, macdChartInstance];
    charts.forEach(c => {
        c.timeScale().subscribeVisibleLogicalRangeChange(range => {
            charts.forEach(other => {
                if (other !== c) other.timeScale().setVisibleLogicalRange(range);
            });
        });
    });
}

function applyChartTheme(c1, c2, c3) {
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    const gridColor = isDark ? '#334155' : '#e2e8f0';
    const textColor = isDark ? '#94a3b8' : '#64748b';
    const opts = {
        layout: { textColor: textColor },
        grid: { vertLines: { color: gridColor }, horzLines: { color: gridColor } },
        timeScale: { borderColor: gridColor },
        rightPriceScale: { borderColor: gridColor }
    };
    [c1, c2, c3].forEach(c => { if(c) c.applyOptions(opts); });
}

function renderVerdict(verdict) {
    console.log("Rendering Verdict", verdict);
    document.getElementById('verdictScore').innerText = verdict.score;
    document.getElementById('verdictSignal').innerText = verdict.signal;
    document.getElementById('verdictSignal').style.color = verdict.color;

    const circle = document.getElementById('verdictCircle');
    circle.className = 'verdict-circle';
    if (verdict.score >= 1) circle.classList.add('buy');
    else if (verdict.score <= -1) circle.classList.add('sell');
    else circle.classList.add('neutral');
    circle.style.borderColor = verdict.color;
    circle.style.color = verdict.color;

    const list = document.getElementById('verdictReasons');
    list.innerHTML = '';
    verdict.reasons.forEach(r => {
        const li = document.createElement('li');
        let icon = '<i class="fa-solid fa-circle-info text-muted"></i>';
        if (r.includes("Bullish") || r.includes("Uptrend") || r.includes("Oversold")) icon = '<i class="fa-solid fa-circle-check text-success"></i>';
        if (r.includes("Bearish") || r.includes("Downtrend") || r.includes("Overbought")) icon = '<i class="fa-solid fa-circle-xmark text-danger"></i>';
        li.innerHTML = `${icon} <span class="ms-2">${r}</span>`;
        list.appendChild(li);
    });
    document.getElementById('verdictSummary').innerText = `Based on current technical indicators, the asset is showing a ${verdict.signal} signal with a composite score of ${verdict.score}.`;
}

function fetchInfo(ticker) {
    fetch(`/api/info?ticker=${ticker}`)
    .then(response => response.json())
    .then(data => {
        if (data.error) return console.error("Info Error:", data.error);
        const info = data.info;
        document.getElementById('stockName').innerText = info.name;
        document.getElementById('stockSector').innerText = info.sector;
        document.getElementById('currentPrice').innerText = `$${info.currentPrice}`;

        const logoImg = document.getElementById('companyLogo');
        const defaultIcon = document.querySelector('.default-logo');
        if (info.logo) {
            logoImg.src = info.logo;
            logoImg.classList.remove('d-none');
            defaultIcon.classList.add('d-none');
        } else {
            logoImg.classList.add('d-none');
            defaultIcon.classList.remove('d-none');
        }

        const grid = document.getElementById('fundamentalsGrid');
        grid.innerHTML = `
            <div class="stat-item"><div class="stat-label">Mkt Cap</div><div class="stat-value">${formatNumber(info.marketCap)}</div></div>
            <div class="stat-item"><div class="stat-label">P/E Ratio</div><div class="stat-value">${info.peRatio}</div></div>
            <div class="stat-item"><div class="stat-label">Div Yield</div><div class="stat-value">${info.dividendYield !== 'N/A' ? (info.dividendYield * 100).toFixed(2) + '%' : 'N/A'}</div></div>
            <div class="stat-item"><div class="stat-label">52W High</div><div class="stat-value">$${info.fiftyTwoWeekHigh}</div></div>
            <div class="stat-item"><div class="stat-label">52W Low</div><div class="stat-value">$${info.fiftyTwoWeekLow}</div></div>
        `;
    })
    .catch(console.error);
}

function fetchNews(ticker) {
    fetch(`/api/news?ticker=${ticker}`)
    .then(res => res.json())
    .then(data => {
        const list = document.getElementById('newsList');
        document.getElementById('newsLoading').classList.add('d-none');
        list.innerHTML = '';

        if (!data.articles) return; // Handle missing articles

        data.articles.forEach(article => {
            let sentimentColor = 'text-muted';
            if (article.sentiment === 'positive') sentimentColor = 'text-success';
            if (article.sentiment === 'negative') sentimentColor = 'text-danger';

            const item = document.createElement('a');
            item.href = article.url;
            item.target = '_blank';
            item.className = 'list-group-item list-group-item-action d-flex justify-content-between align-items-start px-3 py-3';
            item.innerHTML = `
                <div class="ms-2 me-auto">
                    <div class="fw-bold mb-1">${article.title}</div>
                    <div class="small text-muted">${article.source} • ${new Date(article.publishedAt).toLocaleDateString()}</div>
                </div>
                <span class="badge rounded-pill bg-light ${sentimentColor} border ms-2">${article.sentiment}</span>
            `;
            list.appendChild(item);
        });
    })
    .catch(e => document.getElementById('newsList').innerHTML = `<div class="p-3 text-danger">News unavailable</div>`);
}

function fetchAI(ticker) {
    document.getElementById('aiContent').classList.add('d-none');
    document.getElementById('aiLoading').classList.remove('d-none');

    fetch(`/api/ai?ticker=${ticker}`)
    .then(res => res.json())
    .then(data => {
        document.getElementById('aiLoading').classList.add('d-none');
        const content = document.getElementById('aiContent');
        content.classList.remove('d-none');
        content.innerHTML = marked.parse(data.summary || "No analysis available.");
    })
    .catch(e => {
        document.getElementById('aiLoading').classList.add('d-none');
        document.getElementById('aiContent').classList.remove('d-none');
        document.getElementById('aiContent').innerText = "AI Analysis unavailable.";
    });
}

function formatNumber(num) {
    if (!num || num === 'N/A') return 'N/A';
    if (num >= 1.0e+12) return (num / 1.0e+12).toFixed(2) + "T";
    if (num >= 1.0e+9) return (num / 1.0e+9).toFixed(2) + "B";
    if (num >= 1.0e+6) return (num / 1.0e+6).toFixed(2) + "M";
    return num;
}

// Chat Bot
const chatToggle = document.getElementById('chatToggle');
const chatContainer = document.getElementById('chatContainer');
const closeChat = document.getElementById('closeChat');
const chatInput = document.getElementById('chatInput');
const sendMessageBtn = document.getElementById('sendMessageBtn');
const chatBody = document.getElementById('chatBody');

chatToggle.addEventListener('click', () => {
    chatContainer.classList.toggle('open');
});
closeChat.addEventListener('click', () => {
    chatContainer.classList.remove('open');
});
sendMessageBtn.addEventListener('click', sendMessage);
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

function sendMessage() {
    const message = chatInput.value.trim();
    const ticker = document.getElementById('stockSymbol').innerText;
    if (!message) return;
    if (ticker === '---' || !ticker) {
        appendMessage('bot', 'Please search for a stock first!');
        return;
    }
    appendMessage('user', message);
    chatInput.value = '';
    chatInput.disabled = true;

    fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker: ticker, message: message })
    })
    .then(response => response.json())
    .then(data => {
        appendMessage('bot', data.reply);
    })
    .catch(err => {
        appendMessage('bot', "Sorry, I couldn't process that request.");
    })
    .finally(() => {
        chatInput.disabled = false;
        chatInput.focus();
    });
}
function appendMessage(sender, text) {
    const div = document.createElement('div');
    div.classList.add('chat-message', `${sender}-message`);
    div.innerText = text;
    chatBody.appendChild(div);
    chatBody.scrollTop = chatBody.scrollHeight;
}
