let historyChartInstance = null;
let mlChartInstance = null;

// Dark Mode Logic
const themeToggleBtn = document.getElementById('themeToggle');
const body = document.body;
const icon = themeToggleBtn.querySelector('i');

// Check local storage
if (localStorage.getItem('theme') === 'dark') {
    body.setAttribute('data-theme', 'dark');
    icon.classList.remove('fa-moon');
    icon.classList.add('fa-sun');
    themeToggleBtn.classList.remove('btn-light');
    themeToggleBtn.classList.add('btn-dark');
}

themeToggleBtn.addEventListener('click', () => {
    if (body.getAttribute('data-theme') === 'dark') {
        body.removeAttribute('data-theme');
        localStorage.setItem('theme', 'light');
        icon.classList.remove('fa-sun');
        icon.classList.add('fa-moon');
        themeToggleBtn.classList.remove('btn-dark');
        themeToggleBtn.classList.add('btn-light');
    } else {
        body.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
        icon.classList.remove('fa-moon');
        icon.classList.add('fa-sun');
        themeToggleBtn.classList.remove('btn-light');
        themeToggleBtn.classList.add('btn-dark');
    }
});


// Autocomplete Logic
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
                        div.innerHTML = `<span class="suggestion-symbol">${item.symbol}</span><span class="suggestion-name">${item.shortname || item.longname}</span>`;
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

// Close suggestions when clicking outside
document.addEventListener('click', function(e) {
    if (e.target !== tickerInput && e.target !== suggestionsBox) {
        suggestionsBox.classList.add('d-none');
    }
});


document.getElementById('searchBtn').addEventListener('click', function() {
    const ticker = document.getElementById('tickerInput').value.toUpperCase();
    if (!ticker) return alert('Please enter a stock ticker');

    document.getElementById('stockTitle').innerText = `Results for ${ticker}`;
    document.getElementById('resultSection').classList.remove('d-none');

    // Reset and Show Loaders
    resetTab('info');
    resetTab('news');
    resetTab('ai');
    resetTab('ml');

    // Reset Logo
    document.getElementById('companyLogo').classList.add('d-none');
    document.getElementById('companyLogo').src = '';

    // Fetch Data
    fetchInfo(ticker);
    fetchNews(ticker);
    fetchAI(ticker);
    fetchML(ticker);
});

function resetTab(name) {
    document.getElementById(`${name}Loading`).classList.remove('d-none');
    document.getElementById(`${name}Content`).classList.add('d-none');
}

function showContent(name) {
    document.getElementById(`${name}Loading`).classList.add('d-none');
    document.getElementById(`${name}Content`).classList.remove('d-none');
}

function fetchInfo(ticker) {
    // Changed to GET request for caching
    fetch(`/api/info?ticker=${ticker}`)
    .then(response => response.json())
    .then(data => {
        if (data.error) throw new Error(data.error);

        const info = data.info;
        const techs = data.technicals;

        // Update Logo
        if (info.logo) {
            const logoImg = document.getElementById('companyLogo');
            logoImg.src = info.logo;
            logoImg.classList.remove('d-none');
        }

        // Update Title
        document.getElementById('stockTitle').innerText = info.name || ticker;

        // Render Key Metrics Cards
        const metrics = [
            { label: 'Current Price', value: `$${info.currentPrice}` },
            { label: 'Market Cap', value: formatNumber(info.marketCap) },
            { label: 'Sector', value: info.sector },
            { label: 'PE Ratio', value: info.peRatio !== 'N/A' ? info.peRatio.toFixed(2) : 'N/A' },
            { label: 'Div Yield', value: info.dividendYield !== 'N/A' ? (info.dividendYield * 100).toFixed(2) + '%' : 'N/A' },
            { label: '52W High', value: `$${info.fiftyTwoWeekHigh}` }
        ];

        let metricsHtml = '';
        metrics.forEach(m => {
            metricsHtml += `
                <div class="col-6 col-md-4 col-lg-2">
                    <div class="metric-card h-100">
                        <h6>${m.label}</h6>
                        <div class="value">${m.value}</div>
                    </div>
                </div>
            `;
        });
        document.getElementById('keyMetrics').innerHTML = metricsHtml;
        document.getElementById('companySummary').innerText = info.summary;

        // Technicals List
        let techHtml = '';
        for (const [key, value] of Object.entries(techs)) {
            techHtml += `<li class="list-group-item d-flex justify-content-between align-items-center">
                ${key}
                <span class="badge bg-primary rounded-pill">${value}</span>
            </li>`;
        }
        document.getElementById('technicalsList').innerHTML = techHtml;

        showContent('info');
        
        // Fetch History Chart for Overview
        fetchHistory(ticker);
    })
    .catch(err => {
        document.getElementById('infoContent').innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
        showContent('info');
    });
}

function fetchHistory(ticker) {
    fetch(`/api/history?ticker=${ticker}&period=1y`)
    .then(response => response.json())
    .then(data => {
        if (data.error) throw new Error(data.error);
        renderHistoryChart(data);
    })
    .catch(err => console.error("History fetch error:", err));
}

function renderHistoryChart(data) {
    const ctx = document.getElementById('historyChart').getContext('2d');
    if (historyChartInstance) historyChartInstance.destroy();

    // Create gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, 'rgba(59, 130, 246, 0.4)');
    gradient.addColorStop(1, 'rgba(59, 130, 246, 0.0)');

    historyChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.dates,
            datasets: [{
                label: 'Close Price',
                data: data.close,
                borderColor: '#3b82f6',
                backgroundColor: gradient,
                borderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 4,
                fill: true,
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            },
            scales: {
                x: { display: false },
                y: { 
                    grid: { color: document.body.getAttribute('data-theme') === 'dark' ? '#334155' : '#f1f5f9' }
                }
            }
        }
    });
}

function fetchNews(ticker) {
    // Changed to GET request for caching
    fetch(`/api/news?ticker=${ticker}`)
    .then(response => response.json())
    .then(data => {
        if (data.error) throw new Error(data.error);

        let newsHtml = '';
        data.articles.forEach(article => {
            // Fallback image if none provided
            const imgUrl = article.image || 'https://via.placeholder.com/400x200?text=No+Image';
            const date = new Date(article.publishedAt).toLocaleDateString();

            newsHtml += `
                <div class="col-md-4">
                    <div class="card news-card">
                        <img src="${imgUrl}" class="news-card-img" alt="${article.title}" onerror="this.src='https://via.placeholder.com/400x200?text=Image+Error'">
                        <div class="card-body">
                            <h5 class="card-title"><a href="${article.url}" target="_blank" class="text-decoration-none stretched-link">${article.title}</a></h5>
                            <div class="news-meta">
                                <span>${article.source}</span>
                                <span>${date}</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });
        document.getElementById('newsGrid').innerHTML = newsHtml;
        showContent('news');
    })
    .catch(err => {
        document.getElementById('newsContent').innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
        showContent('news');
    });
}

function fetchAI(ticker) {
    // Changed to GET request for caching
    fetch(`/api/ai?ticker=${ticker}`)
    .then(response => response.json())
    .then(data => {
        if (data.error) throw new Error(data.error);
        // Render Markdown
        document.getElementById('aiResponse').innerHTML = marked.parse(data.summary);
        showContent('ai');
    })
    .catch(err => {
        document.getElementById('aiContent').innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
        showContent('ai');
    });
}

function fetchML(ticker) {
    // Changed to GET request for caching
    fetch(`/api/ml?ticker=${ticker}`)
    .then(response => response.json())
    .then(data => {
        if (data.error) throw new Error(data.error);

        const analysis = data.analysis;
        document.getElementById('mlMessage').innerText = analysis.message;

        // Table
        let html = `
            <tr><th>Current Price</th><td>$${analysis.current_price}</td></tr>
            <tr><th>Predicted Next Close</th><td>$${analysis.predicted_next_close}</td></tr>
            <tr><th>Trend (60 Days)</th><td>${analysis.trend_60_days}</td></tr>
            <tr><th>Slope</th><td>${analysis.slope}</td></tr>
            <tr><th>Model Score (R²)</th><td>${analysis.model_score}</td></tr>
        `;
        document.getElementById('mlTable').innerHTML = html;

        // Chart
        renderChart(data.graph_data);

        showContent('ml');
    })
    .catch(err => {
        document.getElementById('mlContent').innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
        showContent('ml');
    });
}

function renderChart(graphData) {
    const ctx = document.getElementById('mlChart').getContext('2d');

    if (mlChartInstance) {
        mlChartInstance.destroy();
    }

    // Create gradient for the area chart
    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, 'rgba(59, 130, 246, 0.4)');
    gradient.addColorStop(1, 'rgba(59, 130, 246, 0.0)');

    mlChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: graphData.dates,
            datasets: [
                {
                    label: 'Actual Price',
                    data: graphData.prices,
                    borderColor: '#3b82f6', // Primary Blue
                    backgroundColor: gradient,
                    borderWidth: 2,
                    pointRadius: 0,
                    pointHoverRadius: 6,
                    pointHoverBackgroundColor: '#2563eb',
                    pointHoverBorderColor: '#ffffff',
                    pointHoverBorderWidth: 2,
                    fill: true,
                    tension: 0.3 // Smoother curve
                },
                {
                    label: 'Trend Line',
                    data: graphData.regression,
                    borderColor: '#f87171', // Soft Red
                    borderWidth: 2,
                    borderDash: [6, 4],
                    pointRadius: 0,
                    pointHoverRadius: 0,
                    fill: false,
                    tension: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: {
                    position: 'top',
                    align: 'end',
                    labels: {
                        usePointStyle: true,
                        boxWidth: 8,
                        padding: 20,
                        font: {
                            family: "'Inter', sans-serif",
                            size: 12,
                            weight: 500
                        },
                        color: document.body.getAttribute('data-theme') === 'dark' ? '#94a3b8' : '#475569' // Dynamic color
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(30, 41, 59, 0.95)',
                    titleColor: '#f8fafc',
                    bodyColor: '#f8fafc',
                    titleFont: {
                        family: "'Inter', sans-serif",
                        size: 13,
                        weight: 600
                    },
                    bodyFont: {
                        family: "'Inter', sans-serif",
                        size: 13
                    },
                    padding: 12,
                    cornerRadius: 8,
                    displayColors: true,
                    boxPadding: 4,
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(context.parsed.y);
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    grid: {
                        color: document.body.getAttribute('data-theme') === 'dark' ? '#334155' : '#f1f5f9', // Dynamic grid color
                        drawBorder: false,
                    },
                    ticks: {
                        font: {
                            family: "'Inter', sans-serif",
                            size: 11
                        },
                        color: document.body.getAttribute('data-theme') === 'dark' ? '#94a3b8' : '#64748b', // Dynamic tick color
                        callback: function(value) {
                            return '$' + value;
                        }
                    }
                },
                x: {
                    grid: {
                        display: false,
                        drawBorder: false
                    },
                    ticks: {
                        font: {
                            family: "'Inter', sans-serif",
                            size: 11
                        },
                        color: document.body.getAttribute('data-theme') === 'dark' ? '#94a3b8' : '#64748b', // Dynamic tick color
                        maxTicksLimit: 6,
                        maxRotation: 0
                    }
                }
            }
        }
    });
}

function formatNumber(num) {
    if (!num) return 'N/A';
    if (num >= 1.0e+12) return (num / 1.0e+12).toFixed(2) + "T";
    if (num >= 1.0e+9) return (num / 1.0e+9).toFixed(2) + "B";
    if (num >= 1.0e+6) return (num / 1.0e+6).toFixed(2) + "M";
    return num;
}
