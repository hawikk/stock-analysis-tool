// static/js/features.js - Advanced Features Module
console.log('📦 features.js loading...');

// ========================================
// WATCHLIST MANAGEMENT
// ========================================
const Watchlist = {
    currentGroup: 'default',

    init: () => {
        Watchlist.loadGroups();
        Watchlist.load();
    },

    loadGroups: () => {
        const groups = Utils.storage.get('watchlistGroups', {
            'default': { name: 'Default', tickers: [] }
        });
        
        const container = document.getElementById('watchlistGroups');
        if (!container) return;
        
        container.innerHTML = '';
        Object.keys(groups).forEach(key => {
            const group = groups[key];
            const pill = document.createElement('span');
            pill.className = `watchlist-group ${key === Watchlist.currentGroup ? 'active' : ''}`;
            pill.textContent = `${group.name} (${group.tickers.length})`;
            pill.onclick = () => {
                Watchlist.currentGroup = key;
                Watchlist.loadGroups();
                Watchlist.load();
            };
            container.appendChild(pill);
        });
    },

    createGroup: () => {
        const name = prompt('Enter group name:');
        if (!name) return;
        
        const groups = Utils.storage.get('watchlistGroups', { 'default': { name: 'Default', tickers: [] } });
        const key = name.toLowerCase().replace(/\s+/g, '_');
        
        if (groups[key]) {
            Utils.showToast('Group already exists', 'error');
            return;
        }
        
        groups[key] = { name: name, tickers: [] };
        Utils.storage.set('watchlistGroups', groups);
        Watchlist.loadGroups();
        Utils.showToast(`Group "${name}" created`, 'success');
    },

    add: () => {
        const input = document.getElementById('watchlistInput');
        const ticker = input.value.toUpperCase().trim();
        if (!ticker) return;

        const groups = Utils.storage.get('watchlistGroups', { 'default': { name: 'Default', tickers: [] } });
        
        if (groups[Watchlist.currentGroup].tickers.includes(ticker)) {
            Utils.showToast('Ticker already in watchlist', 'error');
            return;
        }

        groups[Watchlist.currentGroup].tickers.push(ticker);
        Utils.storage.set('watchlistGroups', groups);
        
        input.value = '';
        Watchlist.loadGroups();
        Watchlist.load();
        Utils.showToast(`${ticker} added to watchlist`, 'success');
    },

    remove: (ticker) => {
        const groups = Utils.storage.get('watchlistGroups', { 'default': { name: 'Default', tickers: [] } });
        groups[Watchlist.currentGroup].tickers = groups[Watchlist.currentGroup].tickers.filter(t => t !== ticker);
        Utils.storage.set('watchlistGroups', groups);
        Watchlist.loadGroups();
        Watchlist.load();
        Utils.showToast(`${ticker} removed`, 'info');
    },

    load: () => {
        const groups = Utils.storage.get('watchlistGroups', { 'default': { name: 'Default', tickers: [] } });
        const tickers = groups[Watchlist.currentGroup]?.tickers || [];
        const tbody = document.getElementById('watchlistBody');
        
        if (!tbody) return;
        tbody.innerHTML = '';
        
        if (tickers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">Watchlist is empty. Add tickers above.</td></tr>';
            return;
        }

        tickers.forEach((ticker, index) => {
            const tr = document.createElement('tr');
            tr.className = 'draggable';
            tr.draggable = true;
            tr.id = `wl-${ticker}`;
            tr.innerHTML = `
                <td class="text-center text-muted"><i class="fa-solid fa-grip-vertical"></i></td>
                <td class="fw-bold text-white cursor-pointer" onclick="App.loadStock('${ticker}')">${ticker}</td>
                <td class="text-end text-muted">...</td>
                <td class="text-end text-muted">...</td>
                <td class="text-center">
                    <button class="btn btn-xs btn-outline-warning" onclick="Alerts.quickAdd('${ticker}')" title="Set Alert">
                        <i class="fa-solid fa-bell"></i>
                    </button>
                </td>
                <td class="text-end">
                    <button class="btn btn-sm btn-outline-danger py-0" onclick="Watchlist.remove('${ticker}')">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);

            // Drag and drop event listeners
            tr.addEventListener('dragstart', (e) => {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', ticker);
                tr.classList.add('opacity-50');
            });

            tr.addEventListener('dragend', () => {
                tr.classList.remove('opacity-50');
            });

            tr.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
            });

            tr.addEventListener('drop', (e) => {
                e.preventDefault();
                const draggedTicker = e.dataTransfer.getData('text/plain');
                Watchlist.reorder(draggedTicker, ticker);
            });

            // Fetch live price
            API.fetch(`/api/dashboard_data?ticker=${ticker}&period=1d`).then(d => {
                if (d.ohlc && d.ohlc.length > 0) {
                    const close = d.ohlc[d.ohlc.length - 1].close;
                    const open = d.ohlc[0].open;
                    const change = ((close - open) / open) * 100;
                    const row = document.getElementById(`wl-${ticker}`);
                    if (row) {
                        const chgColor = change >= 0 ? 'text-success' : 'text-danger';
                        const cells = row.querySelectorAll('td');
                        cells[2].innerHTML = `<span class="text-white">${close.toFixed(2)}</span>`;
                        cells[3].innerHTML = `<span class="${chgColor}">${change > 0 ? '+' : ''}${change.toFixed(2)}%</span>`;
                        Utils.flashPrice(row, change >= 0);
                    }
                }
            });
        });
    },

    reorder: (draggedTicker, targetTicker) => {
        const groups = Utils.storage.get('watchlistGroups', { 'default': { name: 'Default', tickers: [] } });
        const tickers = groups[Watchlist.currentGroup].tickers;
        
        const draggedIndex = tickers.indexOf(draggedTicker);
        const targetIndex = tickers.indexOf(targetTicker);
        
        if (draggedIndex === -1 || targetIndex === -1) return;
        
        tickers.splice(draggedIndex, 1);
        tickers.splice(targetIndex, 0, draggedTicker);
        
        groups[Watchlist.currentGroup].tickers = tickers;
        Utils.storage.set('watchlistGroups', groups);
        Watchlist.load();
    },

    exportList: () => {
        const groups = Utils.storage.get('watchlistGroups', { 'default': { name: 'Default', tickers: [] } });
        const data = JSON.stringify(groups, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'watchlist_export.json';
        a.click();
        Utils.showToast('Watchlist exported', 'success');
    },

    importList: (event) => {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const imported = JSON.parse(e.target.result);
                Utils.storage.set('watchlistGroups', imported);
                Watchlist.loadGroups();
                Watchlist.load();
                Utils.showToast('Watchlist imported successfully', 'success');
            } catch (err) {
                Utils.showToast('Invalid file format', 'error');
            }
        };
        reader.readAsText(file);
    }
};

// ========================================
// ENHANCED ALERTS
// ========================================
const Alerts = {
    add: () => {
        const ticker = document.getElementById('alertTicker').value.toUpperCase().trim();
        const condition = document.getElementById('alertCondition').value;
        const price = parseFloat(document.getElementById('alertPrice').value);
        
        if (!ticker) {
            Utils.showToast('Enter a ticker', 'error');
            return;
        }

        // For non-price conditions, price is optional
        if (['gt', 'lt'].includes(condition) && !price) {
            Utils.showToast('Enter a target price', 'error');
            return;
        }

        const alerts = Utils.storage.get('alerts', []);
        alerts.push({
            ticker: ticker,
            condition: condition,
            target: price || null,
            triggered: false,
            created: new Date().toISOString()
        });
        Utils.storage.set('alerts', alerts);
        
        document.getElementById('alertTicker').value = '';
        document.getElementById('alertPrice').value = '';
        
        Alerts.load();
        Utils.showToast(`Alert set for ${ticker}`, 'success');
        
        // Request notification permission
        if (Notification.permission === 'default') {
            Notification.requestPermission();
        }
    },

    quickAdd: (ticker) => {
        document.getElementById('alertTicker').value = ticker;
        document.querySelector('[data-view="alerts"]').click();
        Utils.showToast(`Set alert for ${ticker}`, 'info');
    },

    remove: (index) => {
        const alerts = Utils.storage.get('alerts', []);
        alerts.splice(index, 1);
        Utils.storage.set('alerts', alerts);
        Alerts.load();
    },

    load: () => {
        const alerts = Utils.storage.get('alerts', []);
        const tbody = document.getElementById('alertsBody');
        
        if (!tbody) return;
        tbody.innerHTML = '';
        
        if (alerts.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">No alerts set. Create one above.</td></tr>';
            return;
        }

        alerts.forEach((alert, index) => {
            const tr = document.createElement('tr');
            const statusColor = alert.triggered ? 'text-danger fw-bold' : 'text-success';
            const statusText = alert.triggered ? '🔔 TRIGGERED' : '✓ ACTIVE';
            
            let conditionText = alert.condition === 'gt' ? '>' :
                               alert.condition === 'lt' ? '<' :
                               alert.condition === 'rsi_over' ? 'RSI > 70' :
                               alert.condition === 'rsi_under' ? 'RSI < 30' :
                               alert.condition === 'vol_spike' ? 'Vol Spike 2x' : alert.condition;
            
            tr.innerHTML = `
                <td class="text-white fw-bold">${alert.ticker}</td>
                <td class="text-info">${conditionText}</td>
                <td class="text-white">${alert.target || 'N/A'}</td>
                <td class="text-muted" id="alert-curr-${index}">...</td>
                <td class="${statusColor}">${statusText}</td>
                <td>
                    <button class="btn btn-sm btn-outline-danger py-0" onclick="Alerts.remove(${index})">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    },

    check: () => {
        const alerts = Utils.storage.get('alerts', []);
        if (alerts.length === 0) return;

        alerts.forEach((alert, index) => {
            if (alert.triggered) return;

            API.fetch(`/api/info?ticker=${alert.ticker}`).then(data => {
                if (!data.info) return;
                
                const price = data.info.currentPrice;
                const rsi = data.technicals ? data.technicals['RSI (14)'] : null;
                
                const cell = document.getElementById(`alert-curr-${index}`);
                if (cell) cell.innerText = price || 'N/A';

                let trigger = false;

                // Price conditions
                if (alert.condition === 'gt' && price > alert.target) trigger = true;
                if (alert.condition === 'lt' && price < alert.target) trigger = true;
                
                // Technical conditions
                if (alert.condition === 'rsi_over' && rsi && rsi > 70) trigger = true;
                if (alert.condition === 'rsi_under' && rsi && rsi < 30) trigger = true;

                if (trigger) {
                    alert.triggered = true;
                    Utils.storage.set('alerts', alerts);
                    Alerts.load();
                    
                    // Show notification
                    const message = `${alert.ticker} alert triggered! Current: ${price}`;
                    Utils.showToast(message, 'error', 5000);
                    
                    if (Notification.permission === 'granted') {
                        new Notification(`🔔 Price Alert: ${alert.ticker}`, {
                            body: message,
                            icon: '/static/icon.png'
                        });
                    }
                }
            });
        });
    }
};

// ========================================
// OPTIONS CHAIN
// ========================================
const Options = {
    load: () => {
        const ticker = document.getElementById('optionsTicker').value.toUpperCase().trim();
        if (!ticker) {
            Utils.showToast('Enter a ticker', 'error');
            return;
        }

        const container = document.getElementById('optionsContainer');
        container.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-success"></div><p class="mt-2 text-muted">Loading options chain...</p></div>';

        API.fetch(`/api/options/chain?ticker=${ticker}`)
           .then(data => Options.render(data))
           .catch(err => {
               container.innerHTML = `<div class="alert alert-danger m-3">Failed to load options: ${err.message}</div>`;
           });
    },

    render: (data) => {
        const container = document.getElementById('optionsContainer');
        
        if (!data.calls || !data.puts) {
            container.innerHTML = '<div class="alert alert-warning m-3">No options data available for this ticker</div>';
            return;
        }

        let html = `
            <div class="p-3">
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <h6 class="font-monospace">Stock Price: <span class="text-success">${data.current_price}</span></h6>
                    <span class="text-muted small">Expiry: ${data.expiry || 'N/A'}</span>
                </div>
                <div class="row g-2">
                    <div class="col-md-6">
                        <h6 class="text-success font-monospace mb-2">CALLS</h6>
                        <div class="table-responsive">
                            <table class="table table-dark table-sm mb-0 font-monospace small">
                                <thead>
                                    <tr>
                                        <th>Strike</th>
                                        <th>Last</th>
                                        <th>Vol</th>
                                        <th>OI</th>
                                        <th>IV</th>
                                    </tr>
                                </thead>
                                <tbody>
        `;

        data.calls.slice(0, 10).forEach(call => {
            html += `
                <tr>
                    <td class="fw-bold">${call.strike}</td>
                    <td>${call.lastPrice || 'N/A'}</td>
                    <td>${call.volume || 0}</td>
                    <td>${call.openInterest || 0}</td>
                    <td>${call.impliedVolatility ? (call.impliedVolatility * 100).toFixed(1) + '%' : 'N/A'}</td>
                </tr>
            `;
        });

        html += `
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <h6 class="text-danger font-monospace mb-2">PUTS</h6>
                        <div class="table-responsive">
                            <table class="table table-dark table-sm mb-0 font-monospace small">
                                <thead>
                                    <tr>
                                        <th>Strike</th>
                                        <th>Last</th>
                                        <th>Vol</th>
                                        <th>OI</th>
                                        <th>IV</th>
                                    </tr>
                                </thead>
                                <tbody>
        `;

        data.puts.slice(0, 10).forEach(put => {
            html += `
                <tr>
                    <td class="fw-bold">${put.strike}</td>
                    <td>${put.lastPrice || 'N/A'}</td>
                    <td>${put.volume || 0}</td>
                    <td>${put.openInterest || 0}</td>
                    <td>${put.impliedVolatility ? (put.impliedVolatility * 100).toFixed(1) + '%' : 'N/A'}</td>
                </tr>
            `;
        });

        html += `
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        `;

        container.innerHTML = html;
    }
};

// ========================================
// STOCK COMPARISON
// ========================================
const Comparison = {
    load: () => {
        const ticker1 = document.getElementById('compare1').value.toUpperCase().trim();
        const ticker2 = document.getElementById('compare2').value.toUpperCase().trim();
        const ticker3 = document.getElementById('compare3').value.toUpperCase().trim();

        if (!ticker1 || !ticker2) {
            Utils.showToast('Enter at least 2 tickers', 'error');
            return;
        }

        const tickers = [ticker1, ticker2];
        if (ticker3) tickers.push(ticker3);

        const container = document.getElementById('comparisonContainer');
        container.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-info"></div><p class="mt-2 text-muted">Loading comparison data...</p></div>';

        Promise.all(tickers.map(t => API.fetch(`/api/info?ticker=${t}`)))
               .then(results => Comparison.render(tickers, results))
               .catch(err => {
                   container.innerHTML = `<div class="alert alert-danger">Comparison failed: ${err.message}</div>`;
               });
    },

    render: (tickers, results) => {
        const container = document.getElementById('comparisonContainer');
        
        let html = '<div class="table-responsive"><table class="table table-dark table-hover mb-0 font-monospace">';
        html += '<thead><tr><th>Metric</th>';
        
        tickers.forEach(ticker => {
            html += `<th class="text-center">${ticker}</th>`;
        });
        html += '</tr></thead><tbody>';

        const metrics = [
            { key: 'currentPrice', label: 'Current Price', format: v => '$' + v },
            { key: 'marketCap', label: 'Market Cap', format: v => Utils.formatNumber(v) },
            { key: 'peRatio', label: 'P/E Ratio', format: v => v },
            { key: 'dividendYield', label: 'Dividend Yield', format: v => v },
            { key: 'sector', label: 'Sector', format: v => v }
        ];

        metrics.forEach(metric => {
            html += `<tr><td class="text-muted">${metric.label}</td>`;
            results.forEach(result => {
                const value = result.info?.[metric.key];
                const formatted = value ? metric.format(value) : 'N/A';
                html += `<td class="text-center text-white">${formatted}</td>`;
            });
            html += '</tr>';
        });

        html += '</tbody></table></div>';
        
        // Add chart comparison
        html += '<div class="mt-3"><div id="comparisonChart" style="height: 400px;"></div></div>';
        
        container.innerHTML = html;
        
        // Render comparison chart
        Comparison.renderChart(tickers);
    },

    renderChart: (tickers) => {
        // Simplified: Fetch 1Y data and overlay
        Promise.all(tickers.map(t => API.fetch(`/api/dashboard_data?ticker=${t}&period=1y`)))
               .then(results => {
                   const container = document.getElementById('comparisonChart');
                   if (!container) return;
                   
                   container.innerHTML = '<div class="text-center text-muted py-3">Chart comparison: Implement with LightweightCharts multi-series</div>';
                   // Full implementation would create a chart with multiple normalized series
               });
    }
};

// ========================================
// CUSTOM INDICATORS
// ========================================
const CustomIndicators = {
    conditions: [],

    addCondition: () => {
        const id = Date.now();
        CustomIndicators.conditions.push({ id: id, indicator: 'rsi', operator: 'gt', value: 70 });
        CustomIndicators.renderConditions();
    },

    renderConditions: () => {
        const container = document.getElementById('conditionsContainer');
        if (!container) return;
        
        container.innerHTML = '';
        CustomIndicators.conditions.forEach((cond, index) => {
            const div = document.createElement('div');
            div.className = 'input-group input-group-sm mb-2';
            div.innerHTML = `
                <select class="form-select bg-dark text-white border-secondary" onchange="CustomIndicators.updateCondition(${index}, 'indicator', this.value)">
                    <option value="rsi" ${cond.indicator === 'rsi' ? 'selected' : ''}>RSI</option>
                    <option value="macd" ${cond.indicator === 'macd' ? 'selected' : ''}>MACD</option>
                    <option value="sma50" ${cond.indicator === 'sma50' ? 'selected' : ''}>SMA 50</option>
                    <option value="sma200" ${cond.indicator === 'sma200' ? 'selected' : ''}>SMA 200</option>
                    <option value="volume" ${cond.indicator === 'volume' ? 'selected' : ''}>Volume</option>
                </select>
                <select class="form-select bg-dark text-white border-secondary" onchange="CustomIndicators.updateCondition(${index}, 'operator', this.value)">
                    <option value="gt" ${cond.operator === 'gt' ? 'selected' : ''}>&gt;</option>
                    <option value="lt" ${cond.operator === 'lt' ? 'selected' : ''}>&lt;</option>
                    <option value="cross_above" ${cond.operator === 'cross_above' ? 'selected' : ''}>Cross Above</option>
                    <option value="cross_below" ${cond.operator === 'cross_below' ? 'selected' : ''}>Cross Below</option>
                </select>
                <input type="number" class="form-control bg-dark text-white border-secondary" value="${cond.value}" onchange="CustomIndicators.updateCondition(${index}, 'value', this.value)">
                <button class="btn btn-outline-danger" onclick="CustomIndicators.removeCondition(${index})">
                    <i class="fa-solid fa-trash"></i>
                </button>
            `;
            container.appendChild(div);
        });
    },

    updateCondition: (index, field, value) => {
        CustomIndicators.conditions[index][field] = value;
    },

    removeCondition: (index) => {
        CustomIndicators.conditions.splice(index, 1);
        CustomIndicators.renderConditions();
    },

    save: () => {
        const name = document.getElementById('strategyName').value.trim();
        if (!name) {
            Utils.showToast('Enter a strategy name', 'error');
            return;
        }

        if (CustomIndicators.conditions.length === 0) {
            Utils.showToast('Add at least one condition', 'error');
            return;
        }

        const strategies = Utils.storage.get('customStrategies', []);
        strategies.push({
            name: name,
            conditions: CustomIndicators.conditions,
            created: new Date().toISOString()
        });
        Utils.storage.set('customStrategies', strategies);
        
        CustomIndicators.loadSaved();
        CustomIndicators.conditions = [];
        CustomIndicators.renderConditions();
        document.getElementById('strategyName').value = '';
        
        Utils.showToast(`Strategy "${name}" saved`, 'success');
    },

    loadSaved: () => {
        const strategies = Utils.storage.get('customStrategies', []);
        const container = document.getElementById('savedStrategies');
        
        if (!container) return;
        container.innerHTML = '';
        
        if (strategies.length === 0) {
            container.innerHTML = '<div class="text-center text-muted small py-3">No saved strategies</div>';
            return;
        }

        strategies.forEach((strategy, index) => {
            const div = document.createElement('div');
            div.className = 'card bg-darker border-secondary mb-2';
            div.innerHTML = `
                <div class="card-body p-2 small">
                    <div class="d-flex justify-content-between align-items-center">
                        <span class="fw-bold text-white">${strategy.name}</span>
                        <button class="btn btn-xs btn-outline-danger" onclick="CustomIndicators.delete(${index})">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                    <div class="text-muted x-small">${strategy.conditions.length} conditions</div>
                </div>
            `;
            container.appendChild(div);
        });
    },

    delete: (index) => {
        const strategies = Utils.storage.get('customStrategies', []);
        strategies.splice(index, 1);
        Utils.storage.set('customStrategies', strategies);
        CustomIndicators.loadSaved();
        Utils.showToast('Strategy deleted', 'info');
    },

    backtest: () => {
        Utils.showToast('Backtesting coming soon!', 'info');
        // Future: Send conditions to backend for historical testing
    }
};

// ========================================
// PATTERN RECOGNITION
// ========================================
const Patterns = {
    detect: () => {
        const ticker = document.getElementById('patternTicker').value.toUpperCase().trim();
        if (!ticker) {
            Utils.showToast('Enter a ticker', 'error');
            return;
        }

        const container = document.getElementById('patternsList');
        container.innerHTML = '<div class="text-center py-3"><div class="spinner-border spinner-border-sm text-primary"></div><p class="mt-2 text-muted small">Analyzing patterns...</p></div>';

        API.fetch(`/api/patterns/detect?ticker=${ticker}`)
           .then(data => Patterns.render(data))
           .catch(err => {
               container.innerHTML = `<div class="alert alert-danger small">Pattern detection failed: ${err.message}</div>`;
           });
    },

    render: (data) => {
        const container = document.getElementById('patternsList');
        
        if (!data.patterns || data.patterns.length === 0) {
            container.innerHTML = '<div class="alert alert-info small">No significant patterns detected</div>';
            return;
        }

        container.innerHTML = '';
        data.patterns.forEach(pattern => {
            const div = document.createElement('div');
            div.className = 'card bg-darker border-secondary mb-2';
            
            const color = pattern.signal === 'bullish' ? 'text-success' : 'text-danger';
            const icon = pattern.signal === 'bullish' ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down';
            
            div.innerHTML = `
                <div class="card-body p-2 small">
                    <div class="d-flex justify-content-between align-items-center mb-1">
                        <span class="fw-bold ${color}">
                            <i class="fa-solid ${icon}"></i> ${pattern.name}
                        </span>
                        <span class="badge bg-secondary">${pattern.confidence}%</span>
                    </div>
                    <div class="text-muted x-small">${pattern.description}</div>
                    <div class="text-white-50 x-small mt-1">
                        Success Rate: <span class="text-info">${pattern.success_rate || 'N/A'}</span>
                    </div>
                </div>
            `;
            container.appendChild(div);
        });

        // Render chart with pattern markers
        Patterns.renderChart(data);
    },

    renderChart: (data) => {
        const container = document.getElementById('patternChart');
        if (!container) return;
        
        // Clear previous chart
        container.innerHTML = '';
        
        // Show loading message
        container.innerHTML = '<div class="text-center text-muted py-5"><div class="spinner-border spinner-border-sm"></div> Loading chart...</div>';
        
        // Fetch historical data for the ticker
        const ticker = data.ticker;
        API.fetch(`/api/dashboard_data?ticker=${ticker}&period=6mo`)
           .then(chartData => {
               container.innerHTML = ''; // Clear loading
               
               if (!chartData.ohlc || chartData.ohlc.length === 0) {
                   container.innerHTML = '<div class="alert alert-warning small m-3">No chart data available</div>';
                   return;
               }
               
               // Create chart
               const textColor = Utils.getCssVar('--text-main') || '#ecedee';
               const gridColor = Utils.getCssVar('--border') || '#2a2e39';
               const upColor = Utils.getCssVar('--bull') || '#00b894';
               const downColor = Utils.getCssVar('--bear') || '#ff4757';
               
               const chart = LightweightCharts.createChart(container, {
                   layout: {
                       background: { type: 'solid', color: 'transparent' },
                       textColor: textColor,
                   },
                   grid: {
                       vertLines: { color: gridColor, style: 1 },
                       horzLines: { color: gridColor, style: 1 }
                   },
                   width: container.clientWidth,
                   height: 500,
                   crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
                   timeScale: { borderColor: gridColor, timeVisible: true },
                   rightPriceScale: { borderColor: gridColor }
               });
               
               // Add candlestick series
               const candleSeries = chart.addCandlestickSeries({
                   upColor: upColor,
                   downColor: downColor,
                   borderVisible: false,
                   wickUpColor: upColor,
                   wickDownColor: downColor
               });
               
               // Format time helper
               const formatTime = (t) => {
                   if (typeof t === 'string' && t.includes(' ')) {
                       return new Date(t).getTime() / 1000;
                   }
                   return t;
               };
               
               const processedOHLC = chartData.ohlc.map(d => ({
                   time: formatTime(d.time),
                   open: d.open,
                   high: d.high,
                   low: d.low,
                   close: d.close
               }));
               
               candleSeries.setData(processedOHLC);
               
               // Add pattern markers
               if (data.patterns && data.patterns.length > 0) {
                   const markers = data.patterns.map((pattern, index) => {
                       // Place marker at the most recent date (end of data)
                       const lastIndex = processedOHLC.length - 1;
                       const position = lastIndex - (index * 10); // Stagger markers
                       
                       if (position < 0 || position >= processedOHLC.length) return null;
                       
                       const dataPoint = processedOHLC[position];
                       
                       return {
                           time: dataPoint.time,
                           position: pattern.signal === 'bullish' ? 'belowBar' : 'aboveBar',
                           color: pattern.signal === 'bullish' ? upColor : downColor,
                           shape: pattern.signal === 'bullish' ? 'arrowUp' : 'arrowDown',
                           text: pattern.name,
                           size: 1
                       };
                   }).filter(m => m !== null);
                   
                   candleSeries.setMarkers(markers);
               }
               
               // Resize observer
               new ResizeObserver(() => {
                   if (container.clientWidth > 0) {
                       chart.resize(container.clientWidth, 500);
                       chart.timeScale().fitContent();
                   }
               }).observe(container);
               
               setTimeout(() => chart.timeScale().fitContent(), 100);
           })
           .catch(err => {
               container.innerHTML = `<div class="alert alert-danger small m-3">Chart loading failed: ${err.message}</div>`;
           });
    }
};

// Global exports
window.Watchlist = Watchlist;
window.Alerts = Alerts;
window.Options = Options;
window.Comparison = Comparison;
window.CustomIndicators = CustomIndicators;
window.Patterns = Patterns;

console.log('✅ features.js loaded successfully!');

