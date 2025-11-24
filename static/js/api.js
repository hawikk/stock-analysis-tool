// static/js/api.js

const API = {
    fetch: async (endpoint, options = {}) => {
        try {
            const res = await fetch(endpoint, options);
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.message || `HTTP ${res.status}`);
            }
            return data;
        } catch (err) {
            console.error(`API Error (${endpoint}):`, err);
            throw err;
        }
    },

    post: async (endpoint, body) => {
        return API.fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
    },

    // New 2.0 endpoints
    fetchCorrelation: (tickers) => API.post('/api/tools/correlation', { tickers }),

    fetchMonteCarlo: (ticker, days=30, sims=50) => API.fetch(`/api/tools/monte_carlo?ticker=${ticker}&days=${days}&sims=${sims}`),

    fetchSentimentSummary: () => API.fetch('/api/market/sentiment_analysis'),

    // UI Helper for Error States
    handleError: (elementId, message = "Error loading data.", retryCallback = null) => {
        const el = document.getElementById(elementId);
        if (!el) return;

        let html = `<div class="text-center text-danger py-4 font-monospace small">
            <i class="fa-solid fa-triangle-exclamation mb-2"></i><br>
            ${message}
        </div>`;

        if (retryCallback) {
            const btnId = `retry-${Math.random().toString(36).substr(2, 9)}`;
            html += `<div class="text-center"><button id="${btnId}" class="btn btn-sm btn-outline-secondary font-monospace">Retry</button></div>`;
            el.innerHTML = html;

            setTimeout(() => {
                const btn = document.getElementById(btnId);
                if (btn) btn.onclick = retryCallback;
            }, 0);
        } else {
            el.innerHTML = html;
        }
    }
};
