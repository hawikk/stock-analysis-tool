// static/js/charts.js

let chartInstance = null;
let chartSeries = {}; // Store references to series for toggling

const Charts = {
    renderStockChart: (containerId, data, currentPeriod) => {
        const container = document.getElementById(containerId);
        if (!container) return;

        // Defensive check for LightweightCharts
        if (typeof LightweightCharts === 'undefined') {
            console.error('LightweightCharts library is not loaded.');
            container.innerHTML = '<div class="alert alert-danger">Charting library failed to load.</div>';
            return;
        }

        try {
            // Cleanup previous instance if exists to avoid memory leaks or conflicts
            if (chartInstance) {
                try {
                    chartInstance.remove();
                } catch(e) { console.warn("Chart removal warning:", e); }
                chartInstance = null;
            }

            container.innerHTML = '';
            chartSeries = {}; // Reset

            const textColor = Utils.getCssVar('--text-main') || '#ecedee';
            const gridColor = Utils.getCssVar('--border') || '#2a2e39';
            const upColor = Utils.getCssVar('--bull') || '#00b894';
            const downColor = Utils.getCssVar('--bear') || '#ff4757';
            const accentColor = Utils.getCssVar('--accent') || '#fbc531';

            chartInstance = LightweightCharts.createChart(container, {
                layout: {
                    background: { type: 'solid', color: 'transparent' },
                    textColor: textColor,
                },
                grid: {
                    vertLines: { color: gridColor, style: 1 },
                    horzLines: { color: gridColor, style: 1 }
                },
                width: container.clientWidth,
                height: container.clientHeight,
                crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
                timeScale: { borderColor: gridColor, timeVisible: true, secondsVisible: false },
                rightPriceScale: { borderColor: gridColor }
            });

            // 1. Candlestick Series (Main)
            const candleSeries = chartInstance.addCandlestickSeries({
                upColor: upColor, downColor: downColor, borderVisible: false, wickUpColor: upColor, wickDownColor: downColor
            });

            // Data Formatting Helper
            const formatTime = (t) => {
                if (typeof t === 'string' && t.includes(' ')) {
                    // Parse "YYYY-MM-DD HH:MM" to unix timestamp
                    return new Date(t).getTime() / 1000;
                }
                return t;
            };

            const processedOHLC = data.ohlc.map(d => ({...d, time: formatTime(d.time)}));

            // Validate data before setting
            if (processedOHLC.length === 0) throw new Error("No chart data points");

            candleSeries.setData(processedOHLC);
            chartSeries['price'] = candleSeries;

            // 2. Indicators (if available)
            if (data.indicators) {
                // SMA 50
                if (data.indicators.sma50 && data.indicators.sma50.length > 0) {
                    const sma50 = chartInstance.addLineSeries({ color: accentColor, lineWidth: 1, title: 'SMA 50' });
                    sma50.setData(data.indicators.sma50.map(d => ({...d, time: formatTime(d.time)})));
                    chartSeries['sma50'] = sma50;
                }

                // BB
                if (data.indicators.bb_upper && data.indicators.bb_upper.length > 0) {
                    const bbUp = chartInstance.addLineSeries({ color: 'rgba(0, 150, 255, 0.3)', lineWidth: 1, title: 'BB' });
                    const bbLow = chartInstance.addLineSeries({ color: 'rgba(0, 150, 255, 0.3)', lineWidth: 1 });
                    bbUp.setData(data.indicators.bb_upper.map(d => ({...d, time: formatTime(d.time)})));
                    bbLow.setData(data.indicators.bb_lower.map(d => ({...d, time: formatTime(d.time)})));
                    chartSeries['bb'] = [bbUp, bbLow];
                }
            }

            // 3. Volume (Histogram)
            const volSeries = chartInstance.addHistogramSeries({
                priceFormat: { type: 'volume' },
                priceScaleId: '', // Overlay on main chart but at bottom
                scaleMargins: { top: 0.8, bottom: 0 },
            });
            const processedVol = data.volume.map(d => ({...d, time: formatTime(d.time)}));
            volSeries.setData(processedVol);
            chartSeries['volume'] = volSeries;


            // Markers
            if(data.markers) candleSeries.setMarkers(data.markers);

            // Resize Observer
            new ResizeObserver(() => {
                if (container.clientWidth > 0 && container.clientHeight > 0 && chartInstance) {
                    chartInstance.resize(container.clientWidth, container.clientHeight);
                    chartInstance.timeScale().fitContent();
                }
            }).observe(container);

            setTimeout(() => {
                if(chartInstance) chartInstance.timeScale().fitContent();
            }, 100);

        } catch (err) {
            console.error("Critical Charting Error:", err);
            throw err; // Re-throw to be caught by main.js
        }
    },

    toggleSeries: (name, isVisible) => {
        if (!chartSeries[name]) return;

        if (Array.isArray(chartSeries[name])) {
            chartSeries[name].forEach(s => s.applyOptions({ visible: isVisible }));
        } else {
            chartSeries[name].applyOptions({ visible: isVisible });
        }
    },

    renderMonteCarlo: (containerId, data) => {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = '';

        const chart = LightweightCharts.createChart(container, {
            layout: { background: { type: 'solid', color: 'transparent' }, textColor: '#ccc' },
            grid: { vertLines: { color: '#333' }, horzLines: { color: '#333' } },
            width: container.clientWidth, height: container.clientHeight,
            rightPriceScale: { borderColor: '#333' },
            timeScale: { borderColor: '#333' }
        });

        const colors = ['#2962ff', '#e91e63', '#4caf50', '#ff9800', '#9c27b0'];

        data.simulations.forEach((sim, idx) => {
            const series = chart.addLineSeries({
                color: colors[idx % colors.length],
                lineWidth: 1,
                lineType: 2 // Curved
            });
            // Ensure time is unique/sorted. Monte Carlo data usually is forward looking dates.
            series.setData(sim.data);

            // Only keep 50 lines max visible to save performance if many sims
            if (idx > 50) series.applyOptions({ visible: false });
        });

        chart.timeScale().fitContent();
    },

    renderHeatmap: (containerId, data) => {
        const container = document.getElementById(containerId);
        if (!container) return;

        // Simple DOM Table Heatmap
        let labels = data.labels;
        let matrix = data.matrix; // array of {x, y, value}

        let html = '<div class="table-responsive"><table class="table table-dark table-bordered table-sm text-center small font-monospace">';

        // Header
        html += '<thead><tr><th></th>';
        labels.forEach(l => html += `<th>${l}</th>`);
        html += '</tr></thead><tbody>';

        // Body
        labels.forEach(rowLabel => {
            html += `<tr><th class="text-end">${rowLabel}</th>`;
            labels.forEach(colLabel => {
                const cell = matrix.find(m => m.x === rowLabel && m.y === colLabel);
                const val = cell ? cell.value : 0;

                // Color scale: -1 (Red) -> 0 (Grey) -> 1 (Green)
                let bg = 'transparent';
                let color = '#fff';
                if (val > 0) {
                    const opacity = Math.min(val, 1);
                    bg = `rgba(0, 184, 148, ${opacity * 0.6})`; // Green
                } else if (val < 0) {
                    const opacity = Math.min(Math.abs(val), 1);
                    bg = `rgba(214, 48, 49, ${opacity * 0.6})`; // Red
                }

                if (rowLabel === colLabel) bg = '#2d3436';

                html += `<td style="background-color: ${bg}; color: ${color};">${val > 0 ? '+' : ''}${val}</td>`;
            });
            html += '</tr>';
        });

        html += '</tbody></table></div>';
        container.innerHTML = html;
    }
};
