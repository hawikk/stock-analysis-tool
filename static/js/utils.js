// static/js/utils.js

const Utils = {
    // Format large numbers (M, B, T)
    formatNumber: (num) => {
        if (!num || num === 'N/A') return 'N/A';
        if (num >= 1.0e+12) return (num / 1.0e+12).toFixed(2) + "T";
        if (num >= 1.0e+9) return (num / 1.0e+9).toFixed(2) + "B";
        if (num >= 1.0e+6) return (num / 1.0e+6).toFixed(2) + "M";
        if (num >= 1.0e+3) return (num / 1.0e+3).toFixed(1) + "k";
        return num.toFixed(2);
    },

    // Get CSS Variable Value
    getCssVar: (name) => {
        return getComputedStyle(document.body).getPropertyValue(name).trim();
    },

    // Local Storage Wrapper
    storage: {
        get: (key, defaultVal = null) => {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultVal;
        },
        set: (key, value) => {
            localStorage.setItem(key, JSON.stringify(value));
        }
    },

    // Security: Escaping HTML
    escapeHtml: (unsafe) => {
        if (typeof unsafe !== 'string') return unsafe;
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    },

    // Referral Banner Logic
    initReferralBanner: () => {
        const banner = document.querySelector('.fixed-bottom.bg-primary');
        if (!banner) return;

        if (Utils.storage.get('referralDismissed', false)) {
            banner.style.display = 'none';
        }

        const closeBtn = banner.querySelector('.btn-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                Utils.storage.set('referralDismissed', true);
                banner.style.display = 'none';
            });
        }
    }
};
