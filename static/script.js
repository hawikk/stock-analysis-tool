let priceChartInstance = null;
let currentTicker = null;

// Dark Mode Logic
const darkModeToggle = document.getElementById('darkModeToggle');
const body = document.body;

darkModeToggle.addEventListener('click', () => {
    body.classList.toggle('dark-mode');
    const isDarkMode = body.classList.contains('dark-mode');
    localStorage.setItem('darkMode', isDarkMode);
    updateChartTheme(isDarkMode);
});

// Check for saved theme
if (localStorage.getItem('darkMode') === 'true') {
    body.classList.add('dark-mode');
    updateChartTheme(true);
}

// Autocomplete
const tickerInput = document.getElementById('tickerInput');
const autoCompleteJS = new autoComplete({
    selector: "#tickerInput",
    placeHolder: "Enter Stock Ticker (e.g., TSLA)",
    data: {
        src: async (query) => {
            try {
                const source = await fetch(`/api/search?q=${query}`);
                const data = await source.json();
                return data;
            } catch (error) {
                return error;
            }
        },
        keys: ["symbol", "name"],
        cache: false
    },
    resultsList: {
        element: (list, data) => {
            if (!data.results.length) {
                const message = document.createElement("div");
                message.setAttribute("class", "no_result");
                message.innerHTML = `<span>Found No Results for "${data.query}"</span>`;
                list.prepend(message);
            }
        },
        noResults: true,
    },
    resultItem: {
        highlight: true
    },
    events: {
        input: {
            selection: (event) => {
                const selection = event.detail.selection.value;
                tickerInput.value = selection.symbol;
                document.getElementById('searchBtn').click();
            }
        }
    }
});


document.getElementById('searchBtn').addEventListener('click', function() {
    const ticker = tickerInput.value.toUpperCase();
    if (!ticker) return alert('Please enter a stock ticker');
    currentTicker = ticker;

    autoCompleteJS.close();

    document.getElementById('stockTitle').innerText = `Results for ${ticker}`;
    document.getElementById('resultSection').classList.remove('d-none');

    resetTab('info');
    resetTab('news');
    resetTab('ai');
    resetTab('chart');

    fetchInfo(ticker);
    fetchNews(ticker);
    fetchAI(ticker);
    fetchHistory(ticker, '1y');

    document.querySelectorAll('#chartPeriodBtns button').forEach(button => {
        button.addEventListener('click', function() {
            document.querySelectorAll('#chartPeriodBtns button').forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            const period = this.getAttribute('data-period');
            fetchHistory(currentTicker, period);
        });
    });
});

function resetTab(name) {
    const loadingEl = document.getElementById(`${name}Loading`);
    const contentEl = document.getElementById(`${name}Content`);
    if (loadingEl && contentEl) {
        loadingEl.classList.remove('d-none');
        contentEl.classList.add('d-none');
    }
}

function showContent(name) {
    const loadingEl = document.getElementById(`${name}Loading`);
    const contentEl = document.getElementById(`${name}Content`);
    if (loadingEl && contentEl) {
        loadingEl.classList.add('d-none');
        contentEl.classList.remove('d-none');
    }
}

function fetchInfo(ticker) {
    fetch(`/api/info?ticker=${ticker}`)
    .then(response => response.json())
    .then(data => {
        if (data.error) throw new Error(data.error);

        const info = data.info;
        const techs = data.technicals;

        document.getElementById('companyLogo').src = info.logo || '';
        document.getElementById('stockTitle').innerText = info.name || ticker;

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

        let techHtml = '';
        for (const [key, value] of Object.entries(techs)) {
            techHtml += `<li class="list-group-item d-flex justify-content-between align-items-center">
                ${key}
                <span class="badge bg-primary rounded-pill">${value}</span>
            </li>`;
        }
        document.getElementById('technicalsList').innerHTML = techHtml;

        showContent('info');
    })
    .catch(err => {
        document.getElementById('infoContent').innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
        showContent('info');
    });
}

function fetchNews(ticker) {
    fetch(`/api/news?ticker=${ticker}`)
    .then(response => response.json())
    .then(data => {
        if (data.error) throw new Error(data.error);

        let newsHtml = '';
        data.articles.forEach(article => {
            const imgUrl = article.image || 'https://via.placeholder.com/400x200?text=No+Image';
            const date = new Date(article.publishedAt).toLocaleDateString();

            let sentimentIcon = '';
            if (article.sentiment > 0.05) {
                sentimentIcon = `<span class="text-success" title="Positive"><i class="fa-solid fa-circle-up"></i></span>`;
            } else if (article.sentiment < -0.05) {
                sentimentIcon = `<span class="text-danger" title="Negative"><i class="fa-solid fa-circle-down"></i></span>`;
            } else {
                sentimentIcon = `<span class="text-secondary" title="Neutral"><i class="fa-solid fa-circle-minus"></i></span>`;
            }

            newsHtml += `
                <div class="col-md-4">
                    <div class="card news-card">
                        <img src="${imgUrl}" class="news-card-img" alt="${article.title}" onerror="this.src='https://via.placeholder.com/400x200?text=Image+Error'">
                        <div class="card-body">
                            <h5 class="card-title"><a href="${article.url}" target="_blank" class="text-decoration-none text-dark stretched-link">${article.title}</a></h5>
                            <p class="card-text">${article.description || 'No description available.'}</p>
                            <div class="news-meta">
                                <span>${article.source}</span>
                                <div class="d-flex align-items-center">
                                    ${sentimentIcon}
                                    <span class="ms-2">${date}</span>
                                </div>
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
    fetch(`/api/ai?ticker=${ticker}`)
    .then(response => response.json())
    .then(data => {
        if (data.error) throw new Error(data.error);
        document.getElementById('aiResponse').innerHTML = marked.parse(data.summary);
        showContent('ai');
    })
    .catch(err => {
        document.getElementById('aiContent').innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
        showContent('ai');
    });
}

function fetchHistory(ticker, period) {
    resetTab('chart');
    fetch(`/api/history?ticker=${ticker}&period=${period}`)
    .then(response => response.json())
    .then(data => {
        if (data.error) throw new Error(data.error);
        renderPriceChart(data);
        showContent('chart');
    })
    .catch(err => {
        document.getElementById('chartContent').innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
        showContent('chart');
    });
}

function renderPriceChart(historicalData) {
    const ctx = document.getElementById('priceChart').getContext('2d');
    const isDarkMode = body.classList.contains('dark-mode');

    if (priceChartInstance) {
        priceChartInstance.destroy();
    }

    const chartData = historicalData.map(d => ({
        x: new Date(d.Date),
        y: d.Close
    }));

    priceChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [{
                label: 'Closing Price',
                data: chartData,
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                borderWidth: 2,
                pointRadius: 0,
                fill: true,
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    type: 'time',
                    time: { unit: 'month' },
                    title: { display: true, text: 'Date' },
                    ticks: { color: isDarkMode ? '#cbd5e1' : '#334155' }
                },
                y: {
                    title: { display: true, text: 'Price (USD)' },
                    ticks: { color: isDarkMode ? '#cbd5e1' : '#334155' }
                }
            },
            plugins: {
                legend: {
                    labels: { color: isDarkMode ? '#cbd5e1' : '#334155' }
                }
            }
        }
    });
}

function updateChartTheme(isDarkMode) {
    if (priceChartInstance) {
        priceChartInstance.options.scales.x.ticks.color = isDarkMode ? '#cbd5e1' : '#334155';
        priceChartInstance.options.scales.y.ticks.color = isDarkMode ? '#cbd5e1' : '#334155';
        priceChartInstance.options.plugins.legend.labels.color = isDarkMode ? '#cbd5e1' : '#334155';
        priceChartInstance.update();
    }
}

function formatNumber(num) {
    if (!num) return 'N/A';
    if (num >= 1.0e+12) return (num / 1.0e+12).toFixed(2) + "T";
    if (num >= 1.0e+9) return (num / 1.0e+9).toFixed(2) + "B";
    if (num >= 1.0e+6) return (num / 1.0e+6).toFixed(2) + "M";
    return num.toLocaleString();
}
