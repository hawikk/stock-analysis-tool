// static/js/ui.js

const UI = {
    // Tab Switching Logic
    setupNavigation: () => {
        const buttons = document.querySelectorAll('[data-view]'); // Works for sidebar and mobile nav buttons

        buttons.forEach(btn => {
            btn.addEventListener('click', function() {
                // Remove active class from ALL buttons with this data-view to sync sidebar and mobile menu
                const viewName = this.getAttribute('data-view');
                document.querySelectorAll('[data-view]').forEach(b => {
                    if (b.getAttribute('data-view') === viewName) b.classList.add('active');
                    else b.classList.remove('active');
                });

                // Sections
                const viewId = 'view' + viewName.charAt(0).toUpperCase() + viewName.slice(1);
                document.querySelectorAll('.view-section').forEach(el => el.classList.add('d-none'));

                const target = document.getElementById(viewId);
                if(target) {
                    target.classList.remove('d-none');
                    // Trigger data load
                    App.loadViewData(viewName);
                } else {
                    // Fallback
                    if(viewName === 'chart') document.getElementById('viewStock').classList.remove('d-none');
                    else document.getElementById('viewDashboard').classList.remove('d-none');
                }
            });
        });
    },

    // Search Logic
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
                                // Use Utils.escapeHtml for safety
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

    // Render Functions
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
                div.innerHTML = `
                    <span class="fw-bold text-white">${idx.ticker}</span>
                    <span class="${color}">${idx.price.toFixed(2)}</span>
                    <span class="${color} small">${arrow} ${Math.abs(idx.change_pct).toFixed(2)}%</span>
                `;
                bar.appendChild(div);
            });
        }
    },

    renderWhaleActivity: (data) => {
        const tbody = document.getElementById('whaleTableBody');
        if (!tbody) return;
        tbody.innerHTML = '';

        if(data.data && data.data.length > 0) {
            data.data.forEach(item => {
                const tr = document.createElement('tr');
                tr.style.cursor = 'pointer';
                tr.addEventListener('click', () => App.loadStock(item.ticker));

                let typeClass = 'uw-put';
                let typeLabel = 'PUT';
                if (item.type === 'C') { typeClass = 'uw-call'; typeLabel = 'CALL'; }
                else if (item.type === 'EQ') { typeClass = 'bg-secondary text-white'; typeLabel = 'STOCK'; }

                const sentimentClass = item.sentiment === 'BULLISH' ? 'text-bull' : 'text-bear';
                const chgColor = item.change_pct >= 0 ? 'text-success' : 'text-danger';
                const otmColor = item.otm_status === 'OTM' ? 'text-muted' : 'text-white';

                tr.innerHTML = `
                    <td class="fw-bold text-white"><span class="d-flex align-items-center gap-2">${item.ticker}</span></td>
                    <td class="text-muted small">${item.contract}</td>
                    <td><span class="uw-tag ${typeClass}">${typeLabel}</span></td>
                    <td class="text-white">${item.dte === '-' ? '-' : item.dte + 'd'}</td>
                    <td class="text-end text-white">${item.strike > 0 ? item.strike.toFixed(2) : '-'}</td>
                    <td class="text-end text-muted">${item.stock_price > 0 ? item.stock_price.toFixed(2) : '-'}</td>
                    <td class="text-end ${otmColor}">${item.otm_pct > 0 ? item.otm_pct + '%' : '-'}</td>
                    <td class="text-end text-white">${item.price.toFixed(2)}</td>
                    <td class="text-end ${chgColor}">${item.change_pct > 0 ? '+' : ''}${item.change_pct.toFixed(1)}%</td>
                    <td class="text-end text-warning fw-bold">${Utils.formatNumber(item.vol)}</td>
                    <td class="text-end text-muted">${item.oi > 0 ? Utils.formatNumber(item.oi) : '-'}</td>
                    <td class="text-end text-white">$${Utils.formatNumber(item.premium)}</td>
                    <td class="text-end text-muted">${item.iv > 0 ? item.iv + '%' : '-'}</td>
                    <td class="text-center ${sentimentClass} fw-bold small">${item.sentiment}</td>
                `;
                tbody.appendChild(tr);
            });

            if (data.data[0].type === 'EQ') {
                const notice = document.createElement('tr');
                notice.innerHTML = '<td colspan="14" class="text-center text-warning small py-1 bg-darker"><i class="fa-solid fa-triangle-exclamation me-2"></i>Options data restricted by API plan. Showing High-Volume Equity Flows.</td>';
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
                    </a>
                `;
                grid.appendChild(div);
            });
        }
    }
    // ... Additional renders for other views can be migrated similarly, but for brevity/file size we might keep some inline in App or here.
    // I will migrate the major ones in App to keep this file cleaner or put them here. Ideally UI.js handles DOM.
};
