
import { initWebcam } from './webcam.js';
import { initDashboard } from './dashboard.js';
import { initIrrigation } from './irrigation.js';
import { initHistory } from './history.js';
import { initBatch } from './batch.js';


const appState = {
    user: null, 
    config: {}, 
    activeTab: 'dashboard',
    roboflowStatus: 'online',
    refreshAnalytics: null,
    refreshHistory: null,
    refreshRules: null,
    refreshIrrigation: null
};


document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initMobileNav();
    checkAuthStatus();
    setupAuthEventListeners();
});


function initTheme() {
    const themeToggleBtn = document.getElementById('theme-toggle');
    const storedTheme = localStorage.getItem('theme') || 'dark'; 
    if (storedTheme === 'dark') {
        document.body.classList.add('dark');
    } else {
        document.body.classList.remove('dark');
    }

    themeToggleBtn.addEventListener('click', () => {
        const isDark = document.body.classList.toggle('dark');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        window.dispatchEvent(new Event('themeChanged'));
    });
}


function initMobileNav() {
    const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
    const sidebar = document.querySelector('.sidebar');
    if (sidebarToggleBtn) {
        sidebarToggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            sidebar.classList.toggle('active');
        });
    }

    document.addEventListener('click', (e) => {
        if (sidebar && sidebar.classList.contains('active') && !sidebar.contains(e.target)) {
            sidebar.classList.remove('active');
        }
    });
}


function checkAuthStatus() {
    fetch('/api/auth/status')
        .then(res => res.json())
        .then(data => {
            if (data.logged_in) {
                onLoginSuccess(data.user);
            } else {
                showLoginOverlay();
            }
        })
        .catch(err => {
            console.error("Auth status verification error:", err);
            showLoginOverlay();
        });
}

function showLoginOverlay() {
    document.getElementById('login-modal').classList.add('active');
    document.getElementById('app-container').classList.add('hidden');
}

function hideLoginOverlay() {
    document.getElementById('login-modal').classList.remove('active');
    document.getElementById('app-container').classList.remove('hidden');
}

function setupAuthEventListeners() {
    const loginForm = document.getElementById('login-form');
    const logoutBtn = document.getElementById('btn-logout');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const usernameInput = document.getElementById('username').value.trim();
            const passwordInput = document.getElementById('password').value;
            const errorMsg = document.getElementById('login-error-msg');
            const loginBtn = document.getElementById('btn-login');
            loginBtn.disabled = true;
            loginBtn.textContent = 'Verifying...';
            errorMsg.classList.add('hidden');
            fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: usernameInput, password: passwordInput })
            })
            .then(res => {
                if (!res.ok) throw new Error('Invalid Credentials');
                return res.json();
            })
            .then(data => {
                if (data.success) {
                    onLoginSuccess(data.user);
                } else {
                    throw new Error(data.message || 'Login Failed');
                }
            })
            .catch(err => {
                errorMsg.textContent = err.message || 'Login failed. Please try again.';
                errorMsg.classList.remove('hidden');
            })
            .finally(() => {
                loginBtn.disabled = false;
                loginBtn.textContent = 'Sign In';
            });
        });
    }
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            fetch('/api/auth/logout', { method: 'POST' })
                .then(() => {
                    appState.user = null;
                    showLoginOverlay();
                    document.getElementById('username').value = '';
                    document.getElementById('password').value = '';
                });
        });
    }
}

function onLoginSuccess(user) {
    appState.user = user;
    hideLoginOverlay();
    document.getElementById('user-display-name').textContent = user.username;
    const roleBadge = document.getElementById('user-display-role');
    roleBadge.textContent = user.role.toUpperCase();
    const avatarIcon = document.getElementById('user-role-avatar-icon');
    if (avatarIcon) {
        avatarIcon.setAttribute('data-lucide', user.role === 'admin' ? 'user-cog' : 'user');
        lucide.createIcons();
    }
    if (user.role === 'admin') {
        document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
        document.querySelectorAll('.admin-only-field').forEach(el => el.removeAttribute('disabled'));
    } else {
        document.querySelectorAll('.admin-only').forEach(el => el.classList.add('hidden'));
        document.querySelectorAll('.admin-only-field').forEach(el => el.setAttribute('disabled', 'true'));
    }
    loadSystemConfig()
        .then(() => {
            initializeModules();
        });
}


function loadSystemConfig() {
    return fetch('/api/config')
        .then(res => res.json())
        .then(config => {
            appState.config = config;
            updateConnectionStatus();
        })
        .catch(err => {
            console.error("Config fetch error:", err);
        });
}

function updateConnectionStatus() {
    const statusDiv = document.getElementById('roboflow-status');
    const indicator = statusDiv.querySelector('.status-indicator');
    const text = statusDiv.querySelector('.status-text');
    if (!appState.config.roboflow_api_key) {
        appState.roboflowStatus = 'offline';
        indicator.className = 'status-indicator offline';
        text.textContent = 'Offline Simulation Active';
    } else {
        appState.roboflowStatus = 'online';
        indicator.className = 'status-indicator online';
        text.textContent = 'Roboflow API Online';
    }
}


function initTabRouter() {
    const navButtons = document.querySelectorAll('.nav-item');
    const tabPanels = document.querySelectorAll('.tab-panel');
    const pageTitle = document.getElementById('page-title');
    const sidebar = document.querySelector('.sidebar');
    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');
            navButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            tabPanels.forEach(p => p.classList.remove('active'));
            document.getElementById(`tab-${tabId}`).classList.add('active');
            const tabNames = {
                dashboard: 'Irrigation & Analytics Dashboard',
                webcam: 'Live Crop Disease Monitor',
                batch: 'Batch Image Diagnostics',
                gallery: 'Detection Records Gallery',
                timeline: 'Historical Timeline Logs',
                rules: 'Smart Irrigation Decider Rules',
                admin: 'System Configurations Hub'
            };
            pageTitle.textContent = tabNames[tabId] || 'Dashboard';
            appState.activeTab = tabId;
            if (tabId === 'dashboard') {
                if (appState.refreshAnalytics) appState.refreshAnalytics();
            } else if (tabId === 'gallery') {
                if (appState.refreshHistory) appState.refreshHistory();
            } else if (tabId === 'rules') {
                if (appState.refreshRules) appState.refreshRules();
            } else if (tabId === 'admin') {
                loadSystemConfig();
            }
            if (sidebar) {
                sidebar.classList.remove('active');
            }
        });
    });
}


function initializeModules() {
    initTabRouter();
    initDashboard(appState);
    initWebcam(appState);
    initIrrigation(appState);
    initHistory(appState);
    initBatch(appState);
    lucide.createIcons();
}