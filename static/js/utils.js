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
    },

    // Theme Management - Dark vs Darker
    initTheme: () => {
        const savedTheme = Utils.storage.get('theme');
        // Default to 'dark' (navy blue theme)
        const theme = savedTheme || 'dark';
        
        document.documentElement.setAttribute('data-theme', theme);
        Utils.updateThemeIcon(theme);
    },

    toggleTheme: () => {
        const current = document.documentElement.getAttribute('data-theme') || 'dark';
        // Toggle between 'dark' (navy) and 'darker' (pitch black)
        const newTheme = current === 'dark' ? 'darker' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        Utils.storage.set('theme', newTheme);
        Utils.updateThemeIcon(newTheme);
        
        // Show toast to inform user
        const message = newTheme === 'dark' 
            ? '🌙 Dark Mode (Navy Blue)' 
            : '🌑 Pitch Black (OLED Optimized)';
        Utils.showToast(message, 'info', 2000);
    },

    updateThemeIcon: (theme) => {
        const icon = document.getElementById('themeIcon');
        const label = document.getElementById('themeLabel');
        const button = document.getElementById('themeToggle');
        
        if (icon) {
            // Moon for Dark (navy), Circle for Darker (pitch black)
            if (theme === 'dark') {
                icon.className = 'fa-solid fa-moon';
                if (label) label.textContent = 'Dark';
                if (button) button.title = 'Switch to Pitch Black (OLED)';
            } else {
                icon.className = 'fa-solid fa-circle';
                if (label) label.textContent = 'Black';
                if (button) button.title = 'Switch to Dark Navy';
            }
        }
    },

    // Toast Notifications
    showToast: (message, type = 'info', duration = 3000) => {
        const container = document.getElementById('toastContainer');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `custom-toast ${type}`;
        
        const icon = type === 'success' ? 'fa-check-circle' : 
                     type === 'error' ? 'fa-exclamation-circle' : 
                     'fa-info-circle';
        
        toast.innerHTML = `
            <div class="d-flex align-items-center gap-2">
                <i class="fa-solid ${icon}"></i>
                <span class="flex-grow-1">${message}</span>
                <button class="btn btn-sm btn-link text-muted p-0" onclick="this.parentElement.parentElement.remove()">
                    <i class="fa-solid fa-times"></i>
                </button>
            </div>
        `;
        
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    },

    // Price Flash Animation
    flashPrice: (element, isUp) => {
        if (!element) return;
        element.classList.add(isUp ? 'price-flash-up' : 'price-flash-down');
        setTimeout(() => {
            element.classList.remove('price-flash-up', 'price-flash-down');
        }, 600);
    }
};

// Global theme toggle function
window.toggleTheme = Utils.toggleTheme;
