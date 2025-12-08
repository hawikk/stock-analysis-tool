// static/js/heatmap_chart.js
// Handles the Combined Historical + Option Heatmap Chart

const HeatmapChart = {
    render: (ticker) => {
        const container = document.getElementById('pdfChartContainer');
        if (!container) return;

        container.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-primary"></div><div class="mt-2 text-muted">Calculating Probability Surface...</div></div>';

        // Fetch Both Historical (for candles) and Options (for heatmap)
        Promise.all([
            API.fetch(`/api/dashboard_data?ticker=${ticker}&period=1y`), // Get 1 year history
            API.fetch(`/api/options/pdf?ticker=${ticker}`) // Get Heatmap data
        ]).then(([histData, pdfData]) => {

            if (!histData.ohlc || histData.ohlc.length === 0) {
                container.innerHTML = '<div class="alert alert-warning">No historical data available.</div>';
                return;
            }
            if (!pdfData.heatmap || !pdfData.heatmap.z || pdfData.heatmap.z.length === 0) {
                container.innerHTML = '<div class="alert alert-warning">No options data available for heatmap.</div>';
                return;
            }

            // 1. Prepare Candlestick Data (Trace 0)
            // Plotly expects arrays for x, open, high, low, close
            const xHist = histData.ohlc.map(d => d.time);
            const open = histData.ohlc.map(d => d.open);
            const high = histData.ohlc.map(d => d.high);
            const low = histData.ohlc.map(d => d.low);
            const close = histData.ohlc.map(d => d.close);

            const traceCandle = {
                x: xHist,
                close: close,
                decreasing: { line: { color: '#ff4757' } }, // Bear
                increasing: { line: { color: '#00b894' } }, // Bull
                high: high,
                low: low,
                open: open,
                type: 'candlestick',
                xaxis: 'x',
                yaxis: 'y',
                name: 'History'
            };

            // 2. Prepare Heatmap Data (Trace 1)
            // pdfData.heatmap.x = Dates (Future)
            // pdfData.heatmap.y = Prices
            // pdfData.heatmap.z = Probabilities [price_index][date_index]

            const traceHeatmap = {
                x: pdfData.heatmap.x,
                y: pdfData.heatmap.y,
                z: pdfData.heatmap.z,
                type: 'heatmap',
                colorscale: 'Jet', // Bright colors like the image
                xaxis: 'x', // Shared X axis (Plotly handles date continuity)
                yaxis: 'y',
                showscale: false, // Hide color bar to look cleaner like image
                zsmooth: 'best',   // Smooth interpolation
                name: 'Implied Probability'
            };

            // 3. Layout
            const layout = {
                dragmode: 'zoom',
                margin: { r: 50, t: 30, b: 30, l: 50 },
                showlegend: false,
                xaxis: {
                    autorange: true,
                    title: 'Date',
                    type: 'date',
                    gridcolor: 'rgba(255,255,255,0.1)',
                    rangeslider: { visible: false } // Disable bottom slider
                },
                yaxis: {
                    autorange: true,
                    type: 'linear',
                    gridcolor: 'rgba(255,255,255,0.1)',
                    title: 'Price'
                },
                paper_bgcolor: 'rgba(0,0,0,0)',
                plot_bgcolor: 'rgba(0,0,0,0)',
                font: {
                    family: 'JetBrains Mono',
                    color: '#cbd5e1'
                }
            };

            // Render
            Plotly.newPlot('pdfChartContainer', [traceCandle, traceHeatmap], layout, {responsive: true});

            // Update Ticker Input if needed
            const input = document.getElementById('pdfTicker');
            if (input) input.value = ticker;

        }).catch(err => {
            console.error(err);
            container.innerHTML = `<div class="alert alert-danger">Chart Error: ${err.message}</div>`;
        });
    }
};

window.HeatmapChart = HeatmapChart;
