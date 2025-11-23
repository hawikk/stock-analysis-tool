// static/js/charts.js

let chartInstance = null;

const Charts = {
    renderStockChart: (containerId, data, currentPeriod) => {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = '';

        // Use CSS Variables for Colors
        const textColor = Utils.getCssVar('--text-main') || '#ecedee';
        const gridColor = Utils.getCssVar('--border') || '#2a2e39';
        const upColor = Utils.getCssVar('--bull') || '#00b894';
        const downColor = Utils.getCssVar('--bear') || '#ff4757';
        const accentColor = Utils.getCssVar('--accent') || '#fbc531';

        // Detect if data is intraday (contains time)
        const isIntraday = currentPeriod === '1d' || currentPeriod === '1w';

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
            crosshair: {
                mode: LightweightCharts.CrosshairMode.Normal,
            },
            timeScale: {
                borderColor: gridColor,
                timeVisible: true,
                secondsVisible: false
            },
            rightPriceScale: { borderColor: gridColor }
        });

        const candleSeries = chartInstance.addCandlestickSeries({
            upColor: upColor, downColor: downColor, borderVisible: false, wickUpColor: upColor, wickDownColor: downColor
        });

        // Process data
        const processedOHLC = data.ohlc.map(d => {
            if (d.time.includes(' ')) {
                 return { ...d, time: new Date(d.time).getTime() / 1000 };
            }
            return d;
        });
        candleSeries.setData(processedOHLC);

        // SMA 50
        const sma50 = chartInstance.addLineSeries({ color: accentColor, lineWidth: 1 });
        const processedSMA = data.indicators.sma50.map(d => {
             if (d.time.includes(' ')) {
                 return { ...d, time: new Date(d.time).getTime() / 1000 };
            }
            return d;
        });
        sma50.setData(processedSMA);

        // Markers
        if(data.markers) candleSeries.setMarkers(data.markers);

        // Resize Observer
        new ResizeObserver(() => {
            if (container.clientWidth > 0 && container.clientHeight > 0) {
                chartInstance.resize(container.clientWidth, container.clientHeight);
                chartInstance.timeScale().fitContent();
            }
        }).observe(container);

        // Force immediate resize
        setTimeout(() => {
            chartInstance.resize(container.clientWidth, container.clientHeight);
            chartInstance.timeScale().fitContent();
        }, 100);
    },

    addComparison: (ticker, color='#00ffff') => {
        if(!chartInstance) return;
        API.fetch(`/api/dashboard_data?ticker=${ticker}`)
        .then(data => {
            const lineSeries = chartInstance.addLineSeries({
                color: color,
                lineWidth: 2,
                priceScaleId: 'left'
            });
            // Convert OHLC to Line data (Close price)
            const lineData = data.ohlc.map(d => {
                let time = d.time;
                if (typeof time === 'string' && time.includes(' ')) {
                    time = new Date(time).getTime() / 1000;
                }
                return { time: time, value: d.close };
            });
            lineSeries.setData(lineData);
        });
    },

    renderSparkline: (elementId, dataPoints, changePct) => {
        const chartDiv = document.getElementById(elementId);
        if(!chartDiv) return;

        const upColor = Utils.getCssVar('--bull');
        const downColor = Utils.getCssVar('--bear');

        const chart = LightweightCharts.createChart(chartDiv, {
            layout: { background: { type: 'solid', color: 'transparent' }, attributionLogo: false },
            grid: { vertLines: { visible: false }, horzLines: { visible: false } },
            width: chartDiv.clientWidth,
            height: chartDiv.clientHeight,
            rightPriceScale: { visible: false },
            timeScale: { visible: false },
            handleScroll: false,
            handleScale: false
        });

        const line = chart.addLineSeries({
            color: changePct >= 0 ? upColor : downColor,
            lineWidth: 2,
            crosshairMarkerVisible: false
        });

        const data = dataPoints.map((val, idx) => ({
            time: '2023-01-' + (idx+10).toString().padStart(2, '0'),
            value: val
        }));

        line.setData(data);
        chart.timeScale().fitContent();
    }
};
