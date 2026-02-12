// static/js/ui.js

const UI = {
    setupNavigation: () => {
        const buttons = document.querySelectorAll('[data-view]');

        buttons.forEach(btn => {
            btn.addEventListener('click', function() {
                const viewName = this.getAttribute('data-view');
                document.querySelectorAll('[data-view]').forEach(b => {
                    if (b.getAttribute('data-view') === viewName) b.classList.add('active');
                    else b.classList.remove('active');
                });

                // Map view names to IDs explicitly
                let targetId = 'view' + viewName.charAt(0).toUpperCase() + viewName.slice(1);

                // Overrides for mismatched IDs
                if (viewName === 'chart') targetId = 'viewStock';

                // Truflation View Logic
                if (viewName === 'truflation') {
                    const iframe = document.getElementById('truflationFrame');
                    if (iframe && !iframe.getAttribute('src')) {
                        iframe.src = "https://truflation.com/dashboard/us";
                    }
                }

                document.querySelectorAll('.view-section').forEach(el => el.classList.add('d-none'));

                const target = document.getElementById(targetId);
                if(target) {
                    target.classList.remove('d-none');
                    App.loadViewData(viewName);
                } else {
                    console.warn(`View target #${targetId} not found`);
                    // Fallback for safety
                    const market = document.getElementById('viewMarket');
                    if(market) market.classList.remove('d-none');
                }
            });
        });
    },

    setupSearch: () => {
        const tickerInput = document.getElementById('tickerInput');
        const suggestionsBox = document.getElementById('suggestionsBox');
        let debounceTimer;

        if (!tickerInput || !suggestionsBox) return;

        tickerInput.addEventListener('input', function() {
            const query = this.value;
            clearTimeout(debounceTimer);
            if (query.length < 1) { suggestionsBox.classList.add('d-none'); return; }

            debounceTimer = setTimeout(() => {
                API.fetch(`/api/search?q=${query}`)
                    .then(data => {
                        suggestionsBox.innerHTML = '';
                        if (data.results && data.results.length > 0) {
                            suggestionsBox.classList.remove('d-none');
                            data.results.forEach(item => {
                                const div = document.createElement('div');
                                div.classList.add('suggestion-item');
                                div.innerHTML = `<span class="fw-bold text-white">${Utils.escapeHtml(item.symbol)}</span> <span class="text-muted small ms-2">${Utils.escapeHtml(item.shortname)}</span>`;
                                div.addEventListener('click', () => {
                                    tickerInput.value = item.symbol;
                                    suggestionsBox.classList.add('d-none');
                                    App.loadStock(item.symbol);
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
    },

    // --- Renderers ---

    renderMarketStatus: (data) => {
        const bar = document.getElementById('marketTickerBar');
        if(!bar) return;
        bar.innerHTML = '';

        if(data.indices) {
            data.indices.forEach(idx => {
                const color = idx.change_pct >= 0 ? 'text-success' : 'text-danger';
                const arrow = idx.change_pct >= 0 ? '▲' : '▼';
                const div = document.createElement('div');
                div.className = 'd-flex align-items-center gap-2 px-3 py-1 bg-darker border border-secondary rounded font-monospace small text-nowrap';
                div.innerHTML = `<span class="fw-bold text-white">${idx.ticker}</span><span class="${color}">${idx.price.toFixed(2)}</span><span class="${color} small">${arrow} ${Math.abs(idx.change_pct).toFixed(2)}%</span>`;
                bar.appendChild(div);
            });
        }
    },

    renderWhaleActivity: (data) => {
        const tbody = document.getElementById('whaleTableBody');
        if (!tbody) return;
        tbody.innerHTML = '';

        if(data.data && data.data.length > 0) {
            const isEquity = data.data[0].type === 'EQ';

            const toggle = (sel, s) => document.querySelectorAll(sel).forEach(el => s ? el.classList.remove('d-none') : el.classList.add('d-none'));
            toggle('.col-dte', !isEquity);
            toggle('.col-strike', !isEquity);
            toggle('.col-otm', !isEquity);
            toggle('.col-oi', !isEquity);

            data.data.forEach(item => {
                const tr = document.createElement('tr');
                tr.style.cursor = 'pointer';
                tr.addEventListener('click', () => App.loadStock(item.ticker));

                let typeClass = item.type === 'C' ? 'uw-call' : (item.type === 'EQ' ? 'bg-secondary text-white' : 'uw-put');
                let typeLabel = item.type === 'C' ? 'CALL' : (item.type === 'EQ' ? 'STOCK' : 'PUT');
                const chgColor = item.change_pct >= 0 ? 'text-success' : 'text-danger';

                const dteCell = `<td class="text-white col-dte ${isEquity ? 'd-none' : ''}">${item.dte === '-' ? '-' : item.dte + 'd'}</td>`;
                const strikeCell = `<td class="text-end text-white col-strike ${isEquity ? 'd-none' : ''}">${item.strike > 0 ? item.strike.toFixed(2) : '-'}</td>`;
                const otmCell = `<td class="text-end ${item.otm_status==='OTM'?'text-muted':'text-white'} col-otm ${isEquity ? 'd-none' : ''}">${item.otm_pct > 0 ? item.otm_pct + '%' : '-'}</td>`;
                const oiCell = `<td class="text-end text-muted col-oi ${isEquity ? 'd-none' : ''}">${item.oi > 0 ? Utils.formatNumber(item.oi) : '-'}</td>`;

                tr.innerHTML = `
                    <td class="fw-bold text-white">${item.ticker}</td>
                    <td class="text-muted small">${item.contract}</td>
                    <td><span class="uw-tag ${typeClass}">${typeLabel}</span></td>
                    ${dteCell}${strikeCell}
                    <td class="text-end text-muted">${item.stock_price > 0 ? item.stock_price.toFixed(2) : '-'}</td>
                    ${otmCell}
                    <td class="text-end text-white">${item.price.toFixed(2)}</td>
                    <td class="text-end ${chgColor}">${item.change_pct > 0 ? '+' : ''}${item.change_pct.toFixed(1)}%</td>
                    <td class="text-end text-warning fw-bold">${Utils.formatNumber(item.vol)}</td>
                    ${oiCell}
                    <td class="text-end text-white">$${Utils.formatNumber(item.premium)}</td>
                    <td class="text-end text-muted">${item.iv > 0 ? item.iv + '%' : '-'}</td>
                    <td class="text-center ${item.sentiment==='BULLISH'?'text-bull':'text-bear'} fw-bold small">${item.sentiment}</td>
                `;
                tbody.appendChild(tr);
            });

            if (isEquity) {
                const notice = document.createElement('tr');
                notice.innerHTML = '<td colspan="14" class="text-center text-warning small py-1 bg-darker">Options Restricted. Showing High-Volume Equity.</td>';
                tbody.insertBefore(notice, tbody.firstChild);
            }
        } else {
            tbody.innerHTML = '<tr><td colspan="14" class="text-center text-muted py-4">No unusual activity found.</td></tr>';
        }
    },

    renderNews: (data) => {
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
                                <div class="text-white small fw-bold mb-1">${Utils.escapeHtml(a.title)}</div>
                                <div class="text-muted x-small d-flex justify-content-between">
                                    <span>${Utils.escapeHtml(a.source)}</span>
                                    <span>${new Date(a.publishedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                </div>
                            </div>
                        </div>
                    </a>`;
                grid.appendChild(div);
            });
        }
    },

    // New 2.0 Feature Renders

    renderSentimentSummary: (data) => {
        const container = document.getElementById('sentimentSummaryContainer');
        if (!container) return;

        // Fix: check if data is already an object (Flask jsonify returns dict) or needs parsing
        let parsed = data;
        try {
            if (typeof data === 'string') {
                parsed = JSON.parse(data);
            }
        } catch (e) {
            // If parsing fails, display raw text if it's not [object Object]
            // If it's an object but doesn't match expected structure, we might fail later.
            console.error("Sentiment Parse Error", e);
        }

        // If we still don't have a valid object with expected keys, show generic message
        if (!parsed || typeof parsed !== 'object') {
             container.innerHTML = `<div class="text-muted small">Sentiment Data Unavailable.</div>`;
             return;
        }

        // Fallback values if AI fails to return structured JSON
        const score = parsed.score || 50;
        const verdict = parsed.verdict || "Neutral";
        const narrative = parsed.narrative || "No analysis available.";

        let color = 'text-warning';
        if (score >= 60) color = 'text-success';
        if (score <= 40) color = 'text-danger';

        let gaugeColor = '#fbc531';
        if (score >= 60) gaugeColor = '#00b894';
        if (score <= 40) gaugeColor = '#ff4757';

        container.innerHTML = `
            <div class="row align-items-center">
                <div class="col-md-3 text-center border-end border-secondary">
                    <h1 class="display-4 fw-bold ${color} mb-0">${score}</h1>
                    <div class="small text-muted text-uppercase font-monospace">Market Score</div>
                    <div class="progress mt-2 bg-dark" style="height: 6px;">
                        <div class="progress-bar" role="progressbar" style="width: ${score}%; background-color: ${gaugeColor}"></div>
                    </div>
                </div>
                <div class="col-md-9 ps-4">
                        <h5 class="fw-bold text-white mb-2"><i class="fa-solid fa-robot me-2 text-info"></i>AI Market Verdict: ${verdict}</h5>
                        <p class="text-muted small font-monospace mb-0">${narrative}</p>
                </div>
            </div>
        `;
    },

    showAlerts: () => {
        const tbody = document.getElementById('alertsBody');
        if(!tbody) return;
        tbody.innerHTML = '';

        const alerts = JSON.parse(localStorage.getItem('myAlerts') || '[]');
        if(alerts.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No active alerts.</td></tr>';
            return;
        }

        alerts.forEach((alert, idx) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="fw-bold text-white">${alert.ticker}</td>
                <td class="text-info">${alert.condition === 'gt' ? 'Above' : 'Below'}</td>
                <td class="text-white">${alert.target}</td>
                <td class="text-muted" id="alert-price-${idx}">Waiting...</td>
                <td><span class="badge bg-secondary" id="alert-status-${idx}">Active</span></td>
                <td><button class="btn btn-xs btn-outline-danger" onclick="App.removeAlert(${idx})"><i class="fa-solid fa-trash"></i></button></td>
            `;
            tbody.appendChild(tr);
        });
    }
};
