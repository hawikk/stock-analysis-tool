let mlChartInstance = null;

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
    })
    .catch(err => {
        document.getElementById('infoContent').innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
        showContent('info');
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
                            <h5 class="card-title"><a href="${article.url}" target="_blank" class="text-decoration-none text-dark stretched-link">${article.title}</a></h5>
                            <p class="card-text">${article.description || 'No description available.'}</p>
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

    mlChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: graphData.dates,
            datasets: [
                {
                    label: 'Actual Price',
                    data: graphData.prices,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 2,
                    pointRadius: 0,
                    fill: true,
                    tension: 0.1
                },
                {
                    label: 'Trend Line (Regression)',
                    data: graphData.regression,
                    borderColor: '#ef4444',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    pointRadius: 0,
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'top',
                },
                title: {
                    display: true,
                    text: 'Price History vs Trend'
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    title: {
                        display: true,
                        text: 'Price ($)'
                    }
                },
                x: {
                    display: false // Hide dates if too many
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
