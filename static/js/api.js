// static/js/api.js

const API = {
    fetch: async (endpoint) => {
        try {
            const res = await fetch(endpoint);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.json();
        } catch (err) {
            console.error(`API Error (${endpoint}):`, err);
            throw err;
        }
    },

    // UI Helper for Error States
    handleError: (elementId, message = "Error loading data.", retryCallback = null) => {
        const el = document.getElementById(elementId);
        if (!el) return;

        let html = `<div class="text-center text-danger py-4">
            <i class="fa-solid fa-triangle-exclamation mb-2"></i><br>
            ${message}
        </div>`;

        if (retryCallback) {
            // Create unique ID for retry button
            const btnId = `retry-${Math.random().toString(36).substr(2, 9)}`;
            html += `<div class="text-center"><button id="${btnId}" class="btn btn-sm btn-outline-secondary">Retry</button></div>`;
            el.innerHTML = html; // Warning: using innerHTML for template structure

            setTimeout(() => {
                const btn = document.getElementById(btnId);
                if (btn) btn.addEventListener('click', retryCallback);
            }, 0);
        } else {
            el.innerHTML = html;
        }
    }
};
