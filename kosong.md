// =====================================================
// TASK BOT DASHBOARD PRO - CLIENT SIDE
// DENGAN SISTEM LOGIN LENGKAP - FIXED VERSION
// =====================================================

// =============== GLOBAL STATE ===============
let currentUser = null;
let currentToken = null;
let currentView = 'login';
let currentFilter = 'all';
let tasks = [];
let users = [];
let socket = null;
let theme = localStorage.getItem('theme') || 'dark';
let taskCharts = {};

// =============== DOM ELEMENTS ===============
const app = document.getElementById('app');
const loadingScreen = document.getElementById('loadingScreen');
const notificationContainer = document.getElementById('notificationContainer');

// =============== INITIALIZATION ===============
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 TaskBot Pro Initializing...');
    
    // Check saved token
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    
    if (savedToken && savedUser) {
        try {
            currentToken = savedToken;
            currentUser = JSON.parse(savedUser);
            
            // Verify token
            const isValid = await verifyToken();
            if (isValid) {
                initSocket();
                renderDashboard();
            } else {
                showLoginPage();
            }
        } catch (e) {
            console.error('Failed to parse user:', e);
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            showLoginPage();
        }
    } else {
        showLoginPage();
    }
    
    // Hide loading screen
    setTimeout(() => {
        if (loadingScreen) {
            loadingScreen.style.opacity = '0';
            setTimeout(() => {
                loadingScreen.style.display = 'none';
            }, 500);
        }
    }, 1000);
    
    // Load theme
    loadTheme();
});

// =============== AUTHENTICATION ===============

// Verify Token
async function verifyToken() {
    try {
        const response = await fetch('/api/auth/me', {
            headers: {
                'Authorization': `Bearer ${currentToken}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            currentUser = data.user;
            localStorage.setItem('user', JSON.stringify(currentUser));
            return true;
        } else {
            logout();
            return false;
        }
    } catch (error) {
        console.error('Token verification error:', error);
        return false;
    }
}

// Login
async function handleLogin(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const username = formData.get('username');
    const password = formData.get('password');
    
    showNotification('🔄 Logging in...', 'info');
    
    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            currentToken = data.token;
            currentUser = data.user;
            
            localStorage.setItem('token', currentToken);
            localStorage.setItem('user', JSON.stringify(currentUser));
            
            showNotification('✅ Login berhasil! Selamat datang ' + (currentUser.full_name || currentUser.username), 'success');
            
            initSocket();
            renderDashboard();
        } else {
            showNotification('❌ ' + (data.error || 'Login gagal'), 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showNotification('❌ Gagal terhubung ke server', 'error');
    }
}

// Register
async function handleRegister(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const data = {
        username: formData.get('username'),
        email: formData.get('email'),
        password: formData.get('password'),
        full_name: formData.get('full_name'),
        telegram_chat_id: formData.get('telegram_chat_id') || null
    };
    
    const confirmPassword = formData.get('confirm_password');
    
    // Validasi
    if (data.password !== confirmPassword) {
        showNotification('❌ Password tidak cocok', 'error');
        return;
    }
    
    if (data.password.length < 6) {
        showNotification('❌ Password minimal 6 karakter', 'error');
        return;
    }
    
    showNotification('🔄 Mendaftarkan akun...', 'info');
    
    try {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification('✅ ' + result.message, 'success');
            
            // Show verification modal
            showVerificationModal(result.user_id);
        } else {
            showNotification('❌ ' + (result.error || 'Registrasi gagal'), 'error');
        }
    } catch (error) {
        console.error('Register error:', error);
        showNotification('❌ Gagal terhubung ke server', 'error');
    }
}

// Verify Telegram Code
async function verifyTelegramCode(userId, code) {
    if (!code || code.length !== 6) {
        showNotification('❌ Masukkan 6 digit kode verifikasi', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/auth/verify-telegram', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                user_id: userId,
                verification_code: code
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('✅ Akun berhasil diverifikasi! Silakan login.', 'success');
            
            // Close modal
            const modal = document.querySelector('.modal.active');
            if (modal) modal.remove();
            
            showLoginPage();
            return true;
        } else {
            showNotification('❌ ' + (data.error || 'Kode tidak valid'), 'error');
            return false;
        }
    } catch (error) {
        console.error('Verification error:', error);
        showNotification('❌ Gagal verifikasi', 'error');
        return false;
    }
}

// Forgot Password
async function handleForgotPassword(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const email = formData.get('email');
    
    if (!email) {
        showNotification('❌ Email harus diisi', 'error');
        return;
    }
    
    showNotification('🔄 Mengirim permintaan...', 'info');
    
    try {
        const response = await fetch('/api/auth/forgot-password', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('✅ ' + data.message, 'success');
            showLoginPage();
        } else {
            showNotification('❌ ' + (data.error || 'Permintaan gagal'), 'error');
        }
    } catch (error) {
        console.error('Forgot password error:', error);
        showNotification('❌ Gagal terhubung ke server', 'error');
    }
}

// Logout
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    currentToken = null;
    currentUser = null;
    
    if (socket) {
        socket.disconnect();
        socket = null;
    }
    
    showNotification('👋 Berhasil logout', 'info');
    showLoginPage();
}

// =============== SOCKET.IO ===============

function initSocket() {
    if (typeof io === 'undefined') {
        console.log('⚠️ Socket.IO not available');
        return;
    }
    
    try {
        socket = io();
        
        socket.on('connect', () => {
            console.log('🔌 Socket connected');
            if (currentUser && currentUser.id) {
                socket.emit('join', currentUser.id);
            }
        });
        
        socket.on('task_created', (task) => {
            showNotification('📦 Task baru: ' + task.title, 'info');
            if (currentView === 'dashboard' || currentView === 'tasks' || currentView === 'myTasks') {
                loadTasks();
            }
        });
        
        socket.on('task_updated', (data) => {
            if (currentView === 'dashboard' || currentView === 'tasks' || currentView === 'myTasks') {
                loadTasks();
            }
        });
        
        socket.on('task_approved', (data) => {
            showNotification('✅ Task di-approve admin!', 'success');
            if (currentView === 'dashboard' || currentView === 'tasks' || currentView === 'myTasks') {
                loadTasks();
                loadStats();
            }
        });
        
        socket.on('disconnect', () => {
            console.log('🔌 Socket disconnected');
        });
    } catch (error) {
        console.error('Socket initialization error:', error);
    }
}

// =============== RENDER FUNCTIONS ===============

// Show Login Page
function showLoginPage() {
    currentView = 'login';
    
    const template = document.getElementById('login-page-template');
    if (template) {
        app.innerHTML = '';
        const clone = document.importNode(template.content, true);
        app.appendChild(clone);
    } else {
        // Fallback jika template tidak ada
        app.innerHTML = `
            <div class="auth-container">
                <div class="auth-card glassmorphism fade-in">
                    <div class="auth-header">
                        <div class="auth-logo">
                            <i class="fas fa-rocket"></i>
                            <h1>Task<span>Bot</span> Pro</h1>
                        </div>
                        <p class="auth-subtitle">Task Management dengan Telegram Integration</p>
                    </div>
                    
                    <div class="auth-tabs">
                        <button class="auth-tab active" onclick="switchAuthTab('login')">Login</button>
                        <button class="auth-tab" onclick="switchAuthTab('register')">Register</button>
                    </div>
                    
                    <div id="authFormContainer">
                        <form id="loginForm" class="auth-form">
                            <div class="form-group">
                                <label><i class="fas fa-user"></i> Username / Email</label>
                                <input type="text" name="username" required placeholder="Masukkan username atau email">
                            </div>
                            <div class="form-group">
                                <label><i class="fas fa-lock"></i> Password</label>
                                <div class="password-field">
                                    <input type="password" name="password" required placeholder="Masukkan password">
                                    <button type="button" class="password-toggle" onclick="togglePassword(this)">
                                        <i class="fas fa-eye"></i>
                                    </button>
                                </div>
                            </div>
                            <button type="submit" class="auth-btn">
                                <i class="fas fa-sign-in-alt"></i> Login
                            </button>
                        </form>
                    </div>
                    
                    <div class="auth-footer">
                        <a href="#" onclick="showForgotPassword()">Lupa Password?</a>
                        <span class="separator">•</span>
                        <a href="#" onclick="toggleTheme()"><i class="fas fa-moon"></i> Theme</a>
                    </div>
                </div>
                
                <div class="auth-decoration">
                    <div class="decoration-circle"></div>
                    <div class="decoration-circle"></div>
                    <div class="decoration-content">
                        <i class="fab fa-telegram"></i>
                        <h2>Telegram Verified</h2>
                        <p>Kode verifikasi dikirim via Telegram Bot</p>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Add event listeners
    const loginForm = document.getElementById('loginForm');
    if (loginForm) loginForm.addEventListener('submit', handleLogin);
}

// Switch Auth Tab
function switchAuthTab(tab) {
    const container = document.getElementById('authFormContainer');
    if (!container) return;
    
    // Update active tab
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    if (event && event.target) {
        event.target.classList.add('active');
    }
    
    if (tab === 'login') {
        container.innerHTML = `
            <form id="loginForm" class="auth-form">
                <div class="form-group">
                    <label><i class="fas fa-user"></i> Username / Email</label>
                    <input type="text" name="username" required placeholder="Masukkan username atau email">
                </div>
                <div class="form-group">
                    <label><i class="fas fa-lock"></i> Password</label>
                    <div class="password-field">
                        <input type="password" name="password" required placeholder="Masukkan password">
                        <button type="button" class="password-toggle" onclick="togglePassword(this)">
                            <i class="fas fa-eye"></i>
                        </button>
                    </div>
                </div>
                <button type="submit" class="auth-btn">
                    <i class="fas fa-sign-in-alt"></i> Login
                </button>
            </form>
        `;
        document.getElementById('loginForm')?.addEventListener('submit', handleLogin);
    } else {
        container.innerHTML = `
            <form id="registerForm" class="auth-form">
                <div class="form-group">
                    <label><i class="fas fa-user-circle"></i> Nama Lengkap <span class="required">*</span></label>
                    <input type="text" name="full_name" required placeholder="Masukkan nama lengkap">
                </div>
                <div class="form-group">
                    <label><i class="fas fa-user"></i> Username <span class="required">*</span></label>
                    <input type="text" name="username" required placeholder="Minimal 3 karakter">
                </div>
                <div class="form-group">
                    <label><i class="fas fa-envelope"></i> Email <span class="required">*</span></label>
                    <input type="email" name="email" required placeholder="Masukkan email">
                </div>
                <div class="form-group">
                    <label><i class="fas fa-lock"></i> Password <span class="required">*</span></label>
                    <div class="password-field">
                        <input type="password" name="password" required placeholder="Minimal 6 karakter">
                        <button type="button" class="password-toggle" onclick="togglePassword(this)">
                            <i class="fas fa-eye"></i>
                        </button>
                    </div>
                </div>
                <div class="form-group">
                    <label><i class="fas fa-lock"></i> Konfirmasi Password <span class="required">*</span></label>
                    <div class="password-field">
                        <input type="password" name="confirm_password" required placeholder="Ulangi password">
                        <button type="button" class="password-toggle" onclick="togglePassword(this)">
                            <i class="fas fa-eye"></i>
                        </button>
                    </div>
                </div>
                <div class="form-group">
                    <label><i class="fab fa-telegram"></i> Telegram Chat ID</label>
                    <input type="text" name="telegram_chat_id" placeholder="Untuk verifikasi & notifikasi">
                    <small class="form-text">Dapatkan Chat ID dari @userinfobot</small>
                </div>
                <button type="submit" class="auth-btn">
                    <i class="fas fa-user-plus"></i> Register
                </button>
            </form>
        `;
        document.getElementById('registerForm')?.addEventListener('submit', handleRegister);
    }
}

// Show Forgot Password
function showForgotPassword() {
    const container = document.getElementById('authFormContainer');
    if (!container) return;
    
    container.innerHTML = `
        <div class="auth-form">
            <div class="form-group" style="text-align: center; margin-bottom: 30px;">
                <i class="fas fa-question-circle" style="font-size: 48px; color: var(--primary-color);"></i>
                <h3 style="margin: 20px 0 10px;">Lupa Password?</h3>
                <p style="color: var(--text-secondary);">Masukkan email Anda untuk reset password</p>
            </div>
            
            <form id="forgotPasswordForm">
                <div class="form-group">
                    <label><i class="fas fa-envelope"></i> Email</label>
                    <input type="email" name="email" required placeholder="Masukkan email terdaftar">
                </div>
                
                <button type="submit" class="auth-btn">
                    <i class="fas fa-paper-plane"></i> Kirim Permintaan
                </button>
                
                <button type="button" class="auth-btn secondary" onclick="showLoginPage()">
                    <i class="fas fa-arrow-left"></i> Kembali ke Login
                </button>
            </form>
        </div>
    `;
    
    document.getElementById('forgotPasswordForm')?.addEventListener('submit', handleForgotPassword);
}

// Show Verification Modal
function showVerificationModal(userId) {
    // Remove existing modal
    const existingModal = document.querySelector('.modal.active');
    if (existingModal) existingModal.remove();
    
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 450px;">
            <div class="modal-header">
                <h3><i class="fab fa-telegram"></i> Verifikasi Akun</h3>
                <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            <div class="modal-body" style="text-align: center;">
                <i class="fab fa-telegram" style="font-size: 64px; color: #0088cc; margin-bottom: 20px;"></i>
                <p style="margin-bottom: 20px;">
                    Kode verifikasi telah dikirim ke Telegram Anda.<br>
                    Cek bot <strong>@TaskBot</strong>
                </p>
                
                <div class="verification-code-input">
                    <input type="text" id="verificationCode" maxlength="6" 
                           placeholder="Masukkan 6 digit kode" 
                           style="text-align: center; font-size: 24px; letter-spacing: 8px; width: 100%; padding: 12px;">
                </div>
                
                <div style="display: flex; gap: 12px; margin-top: 30px;">
                    <button onclick="verifyTelegramCode(${userId}, document.getElementById('verificationCode').value)" 
                            class="auth-btn" style="flex: 1;">
                        <i class="fas fa-check"></i> Verifikasi
                    </button>
                    <button onclick="this.closest('.modal').remove(); showLoginPage()" 
                            class="auth-btn secondary" style="flex: 1;">
                        Nanti
                    </button>
                </div>
                
                <p style="margin-top: 20px; font-size: 0.9rem; color: var(--text-muted);">
                    Kirim command <strong>/start</strong> ke bot Telegram untuk memulai
                </p>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Auto focus
    setTimeout(() => {
        document.getElementById('verificationCode')?.focus();
    }, 500);
}

// Render Dashboard
function renderDashboard() {
    currentView = 'dashboard';
    
    if (!currentUser) {
        showLoginPage();
        return;
    }
    
    if (currentUser.role === 'admin') {
        renderAdminDashboard();
    } else {
        renderUserDashboard();
    }
    
    // Load initial data
    loadTasks();
    loadStats();
    if (currentUser.role === 'admin') {
        loadUsers();
    }
}

// Render Admin Dashboard
function renderAdminDashboard() {
    const template = document.getElementById('admin-dashboard-template');
    
    if (template) {
        app.innerHTML = '';
        const clone = document.importNode(template.content, true);
        app.appendChild(clone);
        
        // Set user info
        const userNameEl = document.getElementById('sidebarUserName');
        if (userNameEl) userNameEl.textContent = currentUser.full_name || currentUser.username;
    } else {
        // Fallback jika template tidak ada
        app.innerHTML = '<div style="padding: 50px; text-align: center;">Loading Dashboard...</div>';
    }
    
    // Load default view
    switchView('dashboard');
}

// Render User Dashboard
function renderUserDashboard() {
    const template = document.getElementById('user-dashboard-template');
    
    if (template) {
        app.innerHTML = '';
        const clone = document.importNode(template.content, true);
        app.appendChild(clone);
        
        // Set user info
        const userNameEl = document.getElementById('sidebarUserName');
        if (userNameEl) userNameEl.textContent = currentUser.full_name || currentUser.username;
        
        // Update telegram status
        const telegramIcon = document.getElementById('telegramStatusIcon');
        const telegramText = document.getElementById('telegramStatusText');
        
        if (telegramIcon && telegramText) {
            if (currentUser.telegram_verified) {
                telegramIcon.className = 'fas fa-circle online';
                telegramText.textContent = 'Telegram Verified';
            } else {
                telegramIcon.className = 'fas fa-circle offline';
                telegramText.textContent = 'Telegram Not Verified';
            }
        }
    } else {
        app.innerHTML = '<div style="padding: 50px; text-align: center;">Loading Dashboard...</div>';
    }
    
    // Load default view
    switchView('dashboard');
}

// =============== VIEW SWITCHING ===============

function switchView(view) {
    currentView = view;
    
    // Update active nav
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    
    if (event && event.target) {
        const target = event.target.closest('.nav-item');
        if (target) target.classList.add('active');
    }
    
    // Update page title
    const pageTitle = document.getElementById('pageTitle');
    const pageSubtitle = document.getElementById('pageSubtitle');
    
    if (!pageTitle || !pageSubtitle) return;
    
    switch(view) {
        case 'dashboard':
            pageTitle.textContent = 'Dashboard Overview';
            pageSubtitle.textContent = currentUser && currentUser.role === 'admin' 
                ? 'Ringkasan aktivitas task dan user' 
                : 'Ringkasan task Anda';
            renderDashboardContent();
            break;
            
        case 'tasks':
        case 'myTasks':
            pageTitle.textContent = currentUser && currentUser.role === 'admin' ? 'Task Management' : 'My Tasks';
            pageSubtitle.textContent = 'Kelola dan monitor semua task';
            renderTasksView();
            break;
            
        case 'users':
            if (currentUser && currentUser.role === 'admin') {
                pageTitle.textContent = 'User Management';
                pageSubtitle.textContent = 'Kelola user dan hak akses';
                renderUsersView();
            }
            break;
            
        case 'reports':
            pageTitle.textContent = 'Reports & Analytics';
            pageSubtitle.textContent = 'Laporan lengkap task dan performa';
            renderReportsView();
            break;
            
        case 'profile':
            pageTitle.textContent = 'My Profile';
            pageSubtitle.textContent = 'Kelola informasi akun Anda';
            renderProfileView();
            break;
            
        case 'settings':
            pageTitle.textContent = 'Settings';
            pageSubtitle.textContent = 'Konfigurasi sistem';
            renderSettingsView();
            break;
            
        case 'completed':
            pageTitle.textContent = 'Completed Tasks';
            pageSubtitle.textContent = 'Task yang sudah selesai';
            renderCompletedTasksView();
            break;
    }
}

// =============== DASHBOARD CONTENT ===============

function renderDashboardContent() {
    const contentArea = document.getElementById('contentArea');
    if (!contentArea) return;
    
    contentArea.innerHTML = `
        <div class="dashboard-content">
            <!-- Stats Cards -->
            <div class="stats-grid" id="statsContainer">
                <div class="stat-card glassmorphism">
                    <div class="stat-icon pending">
                        <i class="fas fa-clock"></i>
                    </div>
                    <div class="stat-details">
                        <h3>Pending</h3>
                        <div class="stat-number" id="statPending">0</div>
                    </div>
                </div>
                
                <div class="stat-card glassmorphism">
                    <div class="stat-icon in-progress">
                        <i class="fas fa-sync-alt"></i>
                    </div>
                    <div class="stat-details">
                        <h3>In Progress</h3>
                        <div class="stat-number" id="statProgress">0</div>
                    </div>
                </div>
                
                <div class="stat-card glassmorphism">
                    <div class="stat-icon completed">
                        <i class="fas fa-check-circle"></i>
                    </div>
                    <div class="stat-details">
                        <h3>Completed</h3>
                        <div class="stat-number" id="statCompleted">0</div>
                    </div>
                </div>
                
                <div class="stat-card glassmorphism">
                    <div class="stat-icon approved">
                        <i class="fas fa-check-double"></i>
                    </div>
                    <div class="stat-details">
                        <h3>Approved</h3>
                        <div class="stat-number" id="statApproved">0</div>
                    </div>
                </div>
            </div>
            
            <!-- Charts -->
            <div class="charts-grid">
                <div class="chart-card glassmorphism">
                    <h3><i class="fas fa-chart-pie"></i> Task Distribution</h3>
                    <canvas id="taskChart"></canvas>
                </div>
                
                <div class="chart-card glassmorphism">
                    <h3><i class="fas fa-chart-line"></i> Weekly Activity</h3>
                    <canvas id="activityChart"></canvas>
                </div>
            </div>
            
            <!-- Recent Tasks -->
            <div class="recent-tasks glassmorphism">
                <div class="section-header">
                    <h3><i class="fas fa-history"></i> Recent Tasks</h3>
                    <a href="#" onclick="switchView('tasks')">View All</a>
                </div>
                <div id="recentTasksList" class="tasks-list">
                    <div class="loading-state">
                        <div class="loading-spinner"></div>
                    </div>
                </div>
            </div>
            
            <!-- Activity Log -->
            <div class="activity-log glassmorphism">
                <div class="section-header">
                    <h3><i class="fas fa-bell"></i> Recent Activity</h3>
                    <span class="badge">Live</span>
                </div>
                <div id="activityList" class="activity-list"></div>
            </div>
        </div>
    `;
    
    // Load data
    loadStats();
    loadRecentTasks();
    loadActivities();
    
    // Initialize charts
    setTimeout(() => {
        initCharts();
    }, 500);
}

// =============== TASKS VIEW ===============

function renderTasksView() {
    const contentArea = document.getElementById('contentArea');
    if (!contentArea) return;
    
    contentArea.innerHTML = `
        <div class="tasks-view">
            <!-- Filters -->
            <div class="tasks-filters glassmorphism">
                <div class="filter-group">
                    <label>Status</label>
                    <select id="filterStatus" onchange="filterTasks()">
                        <option value="all">All Status</option>
                        <option value="pending">Pending</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                    </select>
                </div>
                
                ${currentUser && currentUser.role === 'admin' ? `
                <div class="filter-group" id="assigneeFilterGroup">
                    <label>Assignee</label>
                    <select id="filterAssignee" onchange="filterTasks()">
                        <option value="all">All Users</option>
                    </select>
                </div>
                ` : ''}
                
                <div class="filter-group">
                    <label>Sort By</label>
                    <select id="filterSort" onchange="filterTasks()">
                        <option value="newest">Newest First</option>
                        <option value="oldest">Oldest First</option>
                        <option value="title">Title A-Z</option>
                    </select>
                </div>
                
                <div class="filter-actions">
                    <button class="btn-secondary" onclick="resetFilters()">
                        <i class="fas fa-undo"></i> Reset
                    </button>
                    
                    ${currentUser && currentUser.role === 'admin' ? `
                    <button class="btn-primary" onclick="showCreateTaskModal()">
                        <i class="fas fa-plus"></i> New Task
                    </button>
                    ` : ''}
                </div>
            </div>
            
            <!-- Tasks List -->
            <div class="tasks-container glassmorphism">
                <div id="tasksList" class="tasks-grid">
                    <div class="loading-state">
                        <div class="loading-spinner"></div>
                        <p>Loading tasks...</p>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Populate assignee filter
    if (currentUser && currentUser.role === 'admin' && users.length > 0) {
        const filterAssignee = document.getElementById('filterAssignee');
        if (filterAssignee) {
            filterAssignee.innerHTML = '<option value="all">All Users</option>' + 
                users.map(user => `<option value="${user.id}">${escapeHtml(user.full_name || user.username)}</option>`).join('');
        }
    }
    
    // Load tasks
    loadTasks();
}

// Render Completed Tasks View (User)
function renderCompletedTasksView() {
    const contentArea = document.getElementById('contentArea');
    if (!contentArea) return;
    
    contentArea.innerHTML = `
        <div class="tasks-view">
            <div class="tasks-container glassmorphism">
                <div id="tasksList" class="tasks-grid">
                    <div class="loading-state">
                        <div class="loading-spinner"></div>
                        <p>Loading completed tasks...</p>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    loadTasks();
}

// =============== USERS VIEW ===============

function renderUsersView() {
    if (!currentUser || currentUser.role !== 'admin') return;
    
    const contentArea = document.getElementById('contentArea');
    if (!contentArea) return;
    
    contentArea.innerHTML = `
        <div class="users-view">
            <!-- Header -->
            <div class="users-header glassmorphism">
                <h3><i class="fas fa-users"></i> User Management</h3>
                <button class="btn-primary" onclick="showCreateUserModal()">
                    <i class="fas fa-user-plus"></i> Add User
                </button>
            </div>
            
            <!-- Users Table -->
            <div class="users-table-container glassmorphism">
                <table class="users-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>User</th>
                            <th>Email</th>
                            <th>Role</th>
                            <th>Telegram</th>
                            <th>Status</th>
                            <th>Joined</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody id="usersTableBody">
                        <tr>
                            <td colspan="8" class="text-center">
                                <div class="loading-spinner"></div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    // Load users
    loadUsers();
}

// =============== PROFILE VIEW ===============

function renderProfileView() {
    const contentArea = document.getElementById('contentArea');
    if (!contentArea || !currentUser) return;
    
    contentArea.innerHTML = `
        <div class="profile-view">
            <div class="profile-grid">
                <!-- Profile Card -->
                <div class="profile-card glassmorphism">
                    <div class="profile-avatar">
                        <i class="fas fa-user-circle"></i>
                        <span class="status-badge ${currentUser.telegram_verified ? 'verified' : 'unverified'}">
                            <i class="fas ${currentUser.telegram_verified ? 'fa-check-circle' : 'fa-clock'}"></i>
                        </span>
                    </div>
                    <h2 id="profileFullName">${escapeHtml(currentUser.full_name || currentUser.username)}</h2>
                    <p class="username" id="profileUsername">@${escapeHtml(currentUser.username)}</p>
                    <p class="role-badge ${currentUser.role}">${currentUser.role}</p>
                    
                    <div class="profile-stats">
                        <div class="stat">
                            <span class="label">Tasks Completed</span>
                            <span class="value" id="profileTasksCompleted">0</span>
                        </div>
                        <div class="stat">
                            <span class="label">Approval Rate</span>
                            <span class="value" id="profileApprovalRate">0%</span>
                        </div>
                    </div>
                </div>
                
                <!-- Edit Profile Form -->
                <div class="profile-form glassmorphism">
                    <h3><i class="fas fa-edit"></i> Edit Profile</h3>
                    
                    <form id="profileForm">
                        <div class="form-group">
                            <label>Nama Lengkap</label>
                            <input type="text" name="full_name" id="profileInputFullName" 
                                   value="${escapeHtml(currentUser.full_name || '')}">
                        </div>
                        
                        <div class="form-group">
                            <label>Email</label>
                            <input type="email" name="email" id="profileInputEmail" 
                                   value="${escapeHtml(currentUser.email || '')}">
                        </div>
                        
                        <div class="form-group">
                            <label>Telegram Chat ID</label>
                            <div class="input-group">
                                <input type="text" name="telegram_chat_id" id="profileInputTelegram" 
                                       value="${escapeHtml(currentUser.telegram_chat_id || '')}">
                                <button type="button" class="btn-secondary" onclick="verifyTelegram()">
                                    <i class="fab fa-telegram"></i> Verify
                                </button>
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label>Change Password</label>
                            <input type="password" name="current_password" placeholder="Current Password">
                            <input type="password" name="new_password" placeholder="New Password">
                            <input type="password" name="confirm_password" placeholder="Confirm New Password">
                        </div>
                        
                        <button type="submit" class="btn-primary">
                            <i class="fas fa-save"></i> Update Profile
                        </button>
                    </form>
                </div>
            </div>
        </div>
    `;
    
    // Add event listener
    const profileForm = document.getElementById('profileForm');
    if (profileForm) profileForm.addEventListener('submit', handleUpdateProfile);
    
    // Load user stats
    loadUserStats();
}

// =============== REPORTS VIEW ===============

function renderReportsView() {
    const contentArea = document.getElementById('contentArea');
    if (!contentArea) return;
    
    contentArea.innerHTML = `
        <div class="reports-view">
            <div class="reports-header glassmorphism">
                <h3><i class="fas fa-chart-bar"></i> Reports & Analytics</h3>
                <div class="report-actions">
                    <button class="btn-secondary" onclick="exportReport('pdf')">
                        <i class="fas fa-file-pdf"></i> Export PDF
                    </button>
                    <button class="btn-secondary" onclick="exportReport('excel')">
                        <i class="fas fa-file-excel"></i> Export Excel
                    </button>
                </div>
            </div>
            
            <div class="reports-grid">
                <div class="report-card glassmorphism">
                    <h4>Task Completion Rate</h4>
                    <div class="report-chart-container">
                        <canvas id="completionRateChart"></canvas>
                    </div>
                </div>
                
                <div class="report-card glassmorphism">
                    <h4>User Performance</h4>
                    <div class="report-chart-container">
                        <canvas id="userPerformanceChart"></canvas>
                    </div>
                </div>
                
                <div class="report-card glassmorphism">
                    <h4>Test Case Success Rate</h4>
                    <div class="report-chart-container">
                        <canvas id="testSuccessChart"></canvas>
                    </div>
                </div>
                
                <div class="report-card glassmorphism">
                    <h4>Weekly Summary</h4>
                    <div class="report-stats">
                        <div class="stat-item">
                            <span class="label">Tasks Created</span>
                            <span class="value" id="weeklyTasksCreated">0</span>
                        </div>
                        <div class="stat-item">
                            <span class="label">Tasks Completed</span>
                            <span class="value" id="weeklyTasksCompleted">0</span>
                        </div>
                        <div class="stat-item">
                            <span class="label">Tests Passed</span>
                            <span class="value" id="weeklyTestsPassed">0</span>
                        </div>
                        <div class="stat-item">
                            <span class="label">Active Users</span>
                            <span class="value" id="weeklyActiveUsers">0</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Initialize report charts
    setTimeout(() => {
        initReportCharts();
    }, 500);
}

// =============== SETTINGS VIEW ===============

function renderSettingsView() {
    const contentArea = document.getElementById('contentArea');
    if (!contentArea || !currentUser || currentUser.role !== 'admin') return;
    
    contentArea.innerHTML = `
        <div class="settings-view">
            <div class="settings-header glassmorphism">
                <h3><i class="fas fa-cog"></i> System Settings</h3>
            </div>
            
            <div class="settings-grid">
                <div class="settings-card glassmorphism">
                    <h4><i class="fas fa-robot"></i> Telegram Bot</h4>
                    <form id="telegramSettingsForm">
                        <div class="form-group">
                            <label>Bot Token</label>
                            <input type="password" name="bot_token" value="********" readonly>
                            <small class="form-text">Configure in .env file</small>
                        </div>
                        
                        <div class="form-group">
                            <label>Admin Chat ID</label>
                            <input type="text" name="admin_chat_id" value="${process.env.TELEGRAM_ADMIN_CHAT_ID || ''}">
                        </div>
                        
                        <div class="form-group">
                            <label>Enable Notifications</label>
                            <div class="toggle-switch">
                                <input type="checkbox" id="enableTelegram" checked>
                                <label for="enableTelegram"></label>
                            </div>
                        </div>
                        
                        <button type="button" class="btn-primary" onclick="testTelegram()">
                            <i class="fab fa-telegram"></i> Test Connection
                        </button>
                    </form>
                </div>
                
                <div class="settings-card glassmorphism">
                    <h4><i class="fas fa-shield-alt"></i> Security</h4>
                    <form id="securitySettingsForm">
                        <div class="form-group">
                            <label>Session Timeout (minutes)</label>
                            <input type="number" name="session_timeout" value="60">
                        </div>
                        
                        <div class="form-group">
                            <label>Max Login Attempts</label>
                            <input type="number" name="max_login_attempts" value="5">
                        </div>
                        
                        <div class="form-group">
                            <label>Two-Factor Authentication</label>
                            <div class="toggle-switch">
                                <input type="checkbox" id="enable2FA">
                                <label for="enable2FA"></label>
                            </div>
                        </div>
                        
                        <button type="submit" class="btn-primary">
                            <i class="fas fa-save"></i> Save Settings
                        </button>
                    </form>
                </div>
                
                <div class="settings-card glassmorphism">
                    <h4><i class="fas fa-database"></i> System Info</h4>
                    <div class="system-info">
                        <div class="info-row">
                            <span class="label">Version</span>
                            <span class="value">2.0.0</span>
                        </div>
                        <div class="info-row">
                            <span class="label">Node.js</span>
                            <span class="value" id="nodeVersion">v18.x</span>
                        </div>
                        <div class="info-row">
                            <span class="label">Database</span>
                            <span class="value" id="dbStatus">Connected</span>
                        </div>
                        <div class="info-row">
                            <span class="label">Uptime</span>
                            <span class="value" id="uptime">0d 0h</span>
                        </div>
                    </div>
                    
                    <div class="backup-actions">
                        <button class="btn-secondary" onclick="backupDatabase()">
                            <i class="fas fa-download"></i> Backup Database
                        </button>
                        <button class="btn-secondary" onclick="clearCache()">
                            <i class="fas fa-trash"></i> Clear Cache
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// =============== API CALLS ===============

// Load Tasks
async function loadTasks() {
    try {
        const response = await fetch('/api/tasks', {
            headers: {
                'Authorization': `Bearer ${currentToken}`
            }
        });
        
        tasks = await response.json();
        
        // Update display
        if (currentView === 'tasks' || currentView === 'myTasks' || currentView === 'dashboard' || currentView === 'completed') {
            displayTasks();
        }
        
        // Update badges
        updateTaskBadges();
        
    } catch (error) {
        console.error('Load tasks error:', error);
        if (currentView !== 'login') {
            showNotification('❌ Gagal memuat tasks', 'error');
        }
    }
}

// Load Stats
async function loadStats() {
    try {
        const response = await fetch('/api/stats', {
            headers: {
                'Authorization': `Bearer ${currentToken}`
            }
        });
        
        const stats = await response.json();
        
        // Update stat cards
        const statPending = document.getElementById('statPending');
        const statProgress = document.getElementById('statProgress');
        const statCompleted = document.getElementById('statCompleted');
        const statApproved = document.getElementById('statApproved');
        
        if (statPending) statPending.textContent = stats.pending_tasks || 0;
        if (statProgress) statProgress.textContent = stats.in_progress_tasks || 0;
        if (statCompleted) statCompleted.textContent = stats.completed_tasks || 0;
        if (statApproved) statApproved.textContent = stats.approved_tasks || 0;
        
        // Update nav badges
        const navDashboardBadge = document.getElementById('navDashboardBadge');
        const navTasksBadge = document.getElementById('navTasksBadge');
        const navUsersBadge = document.getElementById('navUsersBadge');
        
        if (navDashboardBadge) navDashboardBadge.textContent = stats.pending_approval || 0;
        if (navTasksBadge) navTasksBadge.textContent = tasks?.length || 0;
        if (navUsersBadge) navUsersBadge.textContent = users?.length || 0;
        
    } catch (error) {
        console.error('Load stats error:', error);
    }
}

// Load Users (Admin)
async function loadUsers() {
    if (!currentUser || currentUser.role !== 'admin') return;
    
    try {
        const response = await fetch('/api/admin/users', {
            headers: {
                'Authorization': `Bearer ${currentToken}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            users = data.users;
            
            // Update users table
            const tbody = document.getElementById('usersTableBody');
            if (tbody) {
                tbody.innerHTML = users.map(user => `
                    <tr>
                        <td>#${user.id}</td>
                        <td>
                            <div class="user-cell">
                                <i class="fas fa-user-circle"></i>
                                <div>
                                    <strong>${escapeHtml(user.full_name || user.username)}</strong>
                                    <small>@${escapeHtml(user.username)}</small>
                                </div>
                            </div>
                        </td>
                        <td>${escapeHtml(user.email)}</td>
                        <td>
                            <span class="role-badge ${user.role}">${user.role}</span>
                        </td>
                        <td>
                            ${user.telegram_chat_id ? `
                                <span class="status-badge ${user.telegram_verified ? 'verified' : 'unverified'}">
                                    <i class="fas ${user.telegram_verified ? 'fa-check' : 'fa-clock'}"></i>
                                    ${user.telegram_verified ? 'Verified' : 'Pending'}
                                </span>
                            ` : '-'}
                        </td>
                        <td>
                            <span class="status-badge ${user.is_active ? 'active' : 'inactive'}">
                                ${user.is_active ? 'Active' : 'Inactive'}
                            </span>
                        </td>
                        <td>${formatDate(user.created_at)}</td>
                        <td>
                            <div class="action-buttons">
                                <button class="btn-icon" onclick="editUser(${user.id})" title="Edit">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="btn-icon" onclick="resetUserPassword(${user.id})" title="Reset Password">
                                    <i class="fas fa-key"></i>
                                </button>
                                <button class="btn-icon delete" onclick="deleteUser(${user.id})" title="Delete">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `).join('');
            }
            
            // Update assignee filter
            const filterAssignee = document.getElementById('filterAssignee');
            if (filterAssignee) {
                filterAssignee.innerHTML = '<option value="all">All Users</option>' + 
                    users.map(user => `<option value="${user.id}">${escapeHtml(user.full_name || user.username)}</option>`).join('');
            }
        }
        
    } catch (error) {
        console.error('Load users error:', error);
    }
}

// Load Recent Tasks
async function loadRecentTasks() {
    const container = document.getElementById('recentTasksList');
    if (!container) return;
    
    try {
        const response = await fetch('/api/tasks', {
            headers: {
                'Authorization': `Bearer ${currentToken}`
            }
        });
        
        const recentTasks = await response.json();
        const limitedTasks = recentTasks.slice(0, 5);
        
        if (limitedTasks.length === 0) {
            container.innerHTML = `
                <div class="empty-state small">
                    <i class="fas fa-tasks"></i>
                    <p>Belum ada task</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = limitedTasks.map(task => `
            <div class="task-item-small" onclick="showTaskDetail(${task.id})">
                <div class="task-info">
                    <h4>${escapeHtml(task.title)}</h4>
                    <span class="status-badge ${task.status}">${getStatusText(task.status)}</span>
                </div>
                <div class="task-meta">
                    <span><i class="fas fa-user"></i> ${escapeHtml(task.assignee_name || task.assignee_username || 'Unknown')}</span>
                    <span><i class="far fa-calendar"></i> ${formatDate(task.created_at)}</span>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Load recent tasks error:', error);
        container.innerHTML = '<p class="error">Gagal memuat tasks</p>';
    }
}

// Load Activities
async function loadActivities() {
    const container = document.getElementById('activityList');
    if (!container) return;
    
    try {
        const response = await fetch('/api/dashboard', {
            headers: {
                'Authorization': `Bearer ${currentToken}`
            }
        });
        
        const data = await response.json();
        const activities = data.activities || [];
        
        if (activities.length === 0) {
            container.innerHTML = `
                <div class="empty-state small">
                    <i class="fas fa-bell"></i>
                    <p>Belum ada aktivitas</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = activities.map(activity => `
            <div class="activity-item">
                <div class="activity-icon">
                    <i class="fas ${getActivityIcon(activity.action)}"></i>
                </div>
                <div class="activity-details">
                    <p class="activity-text">${escapeHtml(activity.details || activity.action)}</p>
                    <span class="activity-time">${formatDate(activity.created_at)}</span>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Load activities error:', error);
    }
}

// Load User Stats
async function loadUserStats() {
    try {
        const response = await fetch('/api/stats', {
            headers: {
                'Authorization': `Bearer ${currentToken}`
            }
        });
        
        const stats = await response.json();
        
        const profileTasksCompleted = document.getElementById('profileTasksCompleted');
        const profileApprovalRate = document.getElementById('profileApprovalRate');
        
        if (profileTasksCompleted) {
            profileTasksCompleted.textContent = stats.completed_tasks || 0;
        }
        
        if (profileApprovalRate) {
            const rate = stats.completed_tasks > 0 
                ? Math.round((stats.approved_tasks || 0) / stats.completed_tasks * 100) 
                : 0;
            profileApprovalRate.textContent = rate + '%';
        }
        
    } catch (error) {
        console.error('Load user stats error:', error);
    }
}

// Create Task
async function createTask(taskData) {
    try {
        const formData = new FormData();
        formData.append('title', taskData.title);
        formData.append('description', taskData.description);
        formData.append('assignee_id', taskData.assignee_id);
        
        if (taskData.file) {
            formData.append('file', taskData.file);
        }
        
        const response = await fetch('/api/tasks', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${currentToken}`
            },
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('✅ Task berhasil dibuat!', 'success');
            loadTasks();
            loadStats();
            return true;
        } else {
            showNotification('❌ ' + (data.error || 'Gagal membuat task'), 'error');
            return false;
        }
    } catch (error) {
        console.error('Create task error:', error);
        showNotification('❌ Gagal membuat task', 'error');
        return false;
    }
}

// Update Task Status
async function updateTaskStatus(taskId, status) {
    try {
        const response = await fetch(`/api/tasks/${taskId}/status`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${currentToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('✅ Status diupdate', 'success');
            loadTasks();
            loadStats();
            return true;
        } else {
            showNotification('❌ ' + (data.error || 'Gagal update status'), 'error');
            return false;
        }
    } catch (error) {
        console.error('Update status error:', error);
        showNotification('❌ Gagal update status', 'error');
        return false;
    }
}

// Approve Task (Admin)
async function approveTask(taskId) {
    try {
        const response = await fetch(`/api/tasks/${taskId}/approve`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${currentToken}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('✅ Task di-approve!', 'success');
            loadTasks();
            loadStats();
            return true;
        } else {
            showNotification('❌ ' + (data.error || 'Gagal approve task'), 'error');
            return false;
        }
    } catch (error) {
        console.error('Approve task error:', error);
        showNotification('❌ Gagal approve task', 'error');
        return false;
    }
}

// Reject Task (Admin)
async function rejectTask(taskId, reason) {
    try {
        const response = await fetch(`/api/tasks/${taskId}/reject`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${currentToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ reason })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('✅ Task ditolak', 'warning');
            loadTasks();
            loadStats();
            return true;
        } else {
            showNotification('❌ ' + (data.error || 'Gagal reject task'), 'error');
            return false;
        }
    } catch (error) {
        console.error('Reject task error:', error);
        showNotification('❌ Gagal reject task', 'error');
        return false;
    }
}

// Update Profile
async function handleUpdateProfile(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const data = {
        full_name: formData.get('full_name'),
        email: formData.get('email'),
        telegram_chat_id: formData.get('telegram_chat_id')
    };
    
    const currentPassword = formData.get('current_password');
    const newPassword = formData.get('new_password');
    const confirmPassword = formData.get('confirm_password');
    
    if (newPassword) {
        if (newPassword !== confirmPassword) {
            showNotification('❌ Password baru tidak cocok', 'error');
            return;
        }
        if (newPassword.length < 6) {
            showNotification('❌ Password minimal 6 karakter', 'error');
            return;
        }
        data.current_password = currentPassword;
        data.new_password = newPassword;
    }
    
    showNotification('🔄 Mengupdate profile...', 'info');
    
    try {
        const response = await fetch('/api/profile', {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${currentToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification('✅ Profile berhasil diupdate', 'success');
            
            // Update current user
            currentUser = { ...currentUser, ...data };
            localStorage.setItem('user', JSON.stringify(currentUser));
            
            // Refresh view
            renderProfileView();
        } else {
            showNotification('❌ ' + (result.error || 'Gagal update profile'), 'error');
        }
    } catch (error) {
        console.error('Update profile error:', error);
        showNotification('❌ Gagal update profile', 'error');
    }
}

// =============== DISPLAY FUNCTIONS ===============

function displayTasks() {
    const container = document.getElementById('tasksList');
    if (!container) return;
    
    // Apply filters
    let filteredTasks = [...tasks];
    
    // Filter by status
    const statusFilter = document.getElementById('filterStatus')?.value;
    if (statusFilter && statusFilter !== 'all') {
        filteredTasks = filteredTasks.filter(t => t.status === statusFilter);
    }
    
    // Filter by assignee (admin only)
    if (currentUser && currentUser.role === 'admin') {
        const assigneeFilter = document.getElementById('filterAssignee')?.value;
        if (assigneeFilter && assigneeFilter !== 'all') {
            filteredTasks = filteredTasks.filter(t => t.assignee_id == assigneeFilter);
        }
    } else {
        // Filter by current user
        filteredTasks = filteredTasks.filter(t => t.assignee_id === currentUser?.id);
    }
    
    // Filter by view
    if (currentView === 'completed') {
        filteredTasks = filteredTasks.filter(t => t.status === 'completed' || t.status === 'approved');
    }
    
    // Search
    const searchTerm = document.getElementById('globalSearch')?.value?.toLowerCase();
    if (searchTerm) {
        filteredTasks = filteredTasks.filter(t => 
            (t.title && t.title.toLowerCase().includes(searchTerm)) ||
            (t.description && t.description.toLowerCase().includes(searchTerm))
        );
    }
    
    // Sort
    const sortBy = document.getElementById('filterSort')?.value || 'newest';
    filteredTasks.sort((a, b) => {
        if (sortBy === 'oldest') {
            return new Date(a.created_at) - new Date(b.created_at);
        } else if (sortBy === 'title') {
            return (a.title || '').localeCompare(b.title || '');
        } else {
            return new Date(b.created_at) - new Date(a.created_at);
        }
    });
    
    if (filteredTasks.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-tasks"></i>
                <h3>Tidak ada task</h3>
                <p>Belum ada task yang tersedia</p>
                ${currentUser && currentUser.role === 'admin' ? `
                    <button class="btn-primary" onclick="showCreateTaskModal()">
                        <i class="fas fa-plus"></i> Buat Task Baru
                    </button>
                ` : ''}
            </div>
        `;
        return;
    }
    
    container.innerHTML = filteredTasks.map(task => `
        <div class="task-card ${task.status}" onclick="showTaskDetail(${task.id})">
            <div class="task-card-header">
                <div class="task-title">
                    <h3>${escapeHtml(task.title)}</h3>
                    <span class="status-badge ${task.status}">
                        ${getStatusIcon(task.status)} ${getStatusText(task.status)}
                    </span>
                </div>
                
                <div class="task-meta">
                    <span class="assignee">
                        <i class="fas fa-user"></i>
                        ${escapeHtml(task.assignee_name || task.assignee_username || 'Unassigned')}
                    </span>
                    <span class="date">
                        <i class="far fa-calendar"></i>
                        ${formatDate(task.created_at)}
                    </span>
                </div>
            </div>
            
            <div class="task-card-body">
                <p>${escapeHtml(task.description ? task.description.substring(0, 150) : '')}${task.description && task.description.length > 150 ? '...' : ''}</p>
            </div>
            
            <div class="task-card-footer">
                <div class="task-stats">
                    ${task.total_test_cases ? `
                        <span class="test-badge">
                            <i class="fas fa-check-circle"></i> ${task.passed_tests || 0}/${task.total_test_cases}
                        </span>
                    ` : ''}
                    
                    ${task.file_path ? `
                        <span class="file-badge">
                            <i class="fas fa-paperclip"></i> 1 file
                        </span>
                    ` : ''}
                </div>
                
                <div class="task-actions" onclick="event.stopPropagation()">
                    ${currentUser && currentUser.role === 'admin' ? `
                        <button class="btn-icon" onclick="editTask(${task.id})" title="Edit Task">
                            <i class="fas fa-edit"></i>
                        </button>
                    ` : ''}
                    
                    ${task.status === 'completed' && task.approval_status === 'pending' && currentUser && currentUser.role === 'admin' ? `
                        <button class="btn-icon success" onclick="approveTask(${task.id})" title="Approve">
                            <i class="fas fa-check"></i>
                        </button>
                        <button class="btn-icon warning" onclick="showRejectModal(${task.id})" title="Reject">
                            <i class="fas fa-times"></i>
                        </button>
                    ` : ''}
                    
                    <button class="btn-icon" onclick="showTaskDetail(${task.id})" title="Detail">
                        <i class="fas fa-eye"></i>
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

// =============== MODALS ===============

// Show Create Task Modal (Admin)
function showCreateTaskModal() {
    if (!currentUser || currentUser.role !== 'admin') {
        showNotification('❌ Hanya admin yang bisa membuat task', 'error');
        return;
    }
    
    // Remove existing modal
    const existingModal = document.querySelector('.modal.active');
    if (existingModal) existingModal.remove();
    
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content large">
            <div class="modal-header">
                <h3><i class="fas fa-plus-circle"></i> Buat Task Baru</h3>
                <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            
            <div class="modal-body">
                <form id="createTaskForm">
                    <div class="form-group">
                        <label>Judul Task <span class="required">*</span></label>
                        <input type="text" name="title" required 
                               placeholder="Contoh: Fix Bug Login Page">
                    </div>
                    
                    <div class="form-group">
                        <label>Deskripsi <span class="required">*</span></label>
                        <textarea name="description" required rows="4" 
                                  placeholder="Jelaskan task secara detail..."></textarea>
                    </div>
                    
                    <div class="form-group">
                        <label>Assignee <span class="required">*</span></label>
                        <select name="assignee_id" id="taskAssigneeSelect" required>
                            <option value="">Pilih user</option>
                            ${users.map(user => `
                                <option value="${user.id}">${escapeHtml(user.full_name || user.username)} (${user.username})</option>
                            `).join('')}
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label>Lampiran File</label>
                        <div class="file-upload-area" id="modalFileDropZone">
                            <i class="fas fa-cloud-upload-alt"></i>
                            <p>Drag & drop file atau <span class="browse-link">browse</span></p>
                            <input type="file" name="file" id="modalFileInput" style="display: none;">
                        </div>
                        <div id="modalFilePreview" class="file-preview"></div>
                    </div>
                    
                    <div class="form-actions">
                        <button type="button" class="btn-secondary" onclick="this.closest('.modal').remove()">
                            Batal
                        </button>
                        <button type="submit" class="btn-primary">
                            <i class="fas fa-paper-plane"></i> Buat Task
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Setup file upload
    const dropZone = document.getElementById('modalFileDropZone');
    const fileInput = document.getElementById('modalFileInput');
    
    if (dropZone && fileInput) {
        dropZone.addEventListener('click', () => fileInput.click());
        
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        });
        
        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('dragover');
        });
        
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            if (e.dataTransfer.files.length > 0) {
                fileInput.files = e.dataTransfer.files;
                handleFileSelect(e.dataTransfer.files[0], 'modalFilePreview');
            }
        });
        
        fileInput.addEventListener('change', () => {
            if (fileInput.files.length > 0) {
                handleFileSelect(fileInput.files[0], 'modalFilePreview');
            }
        });
    }
    
    // Handle form submit
    const createTaskForm = document.getElementById('createTaskForm');
    if (createTaskForm) {
        createTaskForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(e.target);
            const taskData = {
                title: formData.get('title'),
                description: formData.get('description'),
                assignee_id: formData.get('assignee_id'),
                file: formData.get('file')
            };
            
            const success = await createTask(taskData);
            if (success) {
                modal.remove();
            }
        });
    }
}

// Show Task Detail
async function showTaskDetail(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
    // Remove existing modal
    const existingModal = document.querySelector('.modal.active');
    if (existingModal) existingModal.remove();
    
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content large">
            <div class="modal-header">
                <h3><i class="fas fa-info-circle"></i> Detail Task</h3>
                <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            
            <div class="modal-body">
                <div class="task-detail" id="taskDetailContainer">
                    <div class="loading-state">
                        <div class="loading-spinner"></div>
                        <p>Loading task details...</p>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    const container = document.getElementById('taskDetailContainer');
    
    container.innerHTML = `
        <div class="detail-section">
            <h4>${escapeHtml(task.title)}</h4>
            <div style="display: flex; gap: 12px; margin-top: 8px;">
                <span class="status-badge ${task.status}">
                    ${getStatusIcon(task.status)} ${getStatusText(task.status)}
                </span>
                ${task.approval_status ? `
                    <span class="status-badge ${task.approval_status}">
                        ${task.approval_status === 'approved' ? '✅ Approved' : '⏳ Pending Approval'}
                    </span>
                ` : ''}
            </div>
        </div>
        
        <div class="detail-grid">
            <div class="detail-item">
                <label>Assignee</label>
                <p><i class="fas fa-user"></i> ${escapeHtml(task.assignee_name || task.assignee_username || 'Unknown')}</p>
            </div>
            
            <div class="detail-item">
                <label>Created By</label>
                <p><i class="fas fa-user-tie"></i> ${escapeHtml(task.creator_username || 'System')}</p>
            </div>
            
            <div class="detail-item">
                <label>Created At</label>
                <p><i class="far fa-calendar"></i> ${formatDate(task.created_at)}</p>
            </div>
            
            ${task.completed_at ? `
                <div class="detail-item">
                    <label>Completed At</label>
                    <p><i class="far fa-check-circle"></i> ${formatDate(task.completed_at)}</p>
                </div>
            ` : ''}
            
            ${task.approved_at ? `
                <div class="detail-item">
                    <label>Approved At</label>
                    <p><i class="fas fa-check-double"></i> ${formatDate(task.approved_at)}</p>
                </div>
            ` : ''}
        </div>
        
        <div class="detail-section">
            <h5>Deskripsi</h5>
            <div class="description-box">
                ${escapeHtml(task.description || '').replace(/\n/g, '<br>')}
            </div>
        </div>
        
        ${task.result_text ? `
            <div class="detail-section">
                <h5>Hasil Pengerjaan</h5>
                <div class="result-box">
                    ${escapeHtml(task.result_text).replace(/\n/g, '<br>')}
                </div>
            </div>
        ` : ''}
        
        ${task.file_path ? `
            <div class="detail-section">
                <h5>File Lampiran</h5>
                <div class="file-attachment">
                    <i class="fas fa-paperclip"></i>
                    <a href="/api/download/${path.basename(task.file_path)}" target="_blank">
                        ${escapeHtml(path.basename(task.file_path))}
                    </a>
                </div>
            </div>
        ` : ''}
        
        <!-- Test Cases Section -->
        <div class="detail-section">
            <div class="section-header">
                <h5><i class="fas fa-vial"></i> Test Cases</h5>
                ${task.assignee_id === currentUser?.id || currentUser?.role === 'admin' ? `
                    <button class="btn-sm" onclick="showAddTestCaseModal(${task.id})">
                        <i class="fas fa-plus"></i> Add Test
                    </button>
                ` : ''}
            </div>
            
            <div id="testCasesList" class="test-cases-list">
                <div class="loading-spinner small"></div>
            </div>
        </div>
        
        <!-- Actions -->
        <div class="detail-actions">
            ${task.assignee_id === currentUser?.id ? `
                <button class="btn-primary" onclick="updateTaskStatus(${task.id}, 'in_progress')" 
                        ${task.status === 'in_progress' ? 'disabled' : ''}>
                    <i class="fas fa-play"></i> Mulai
                </button>
                
                <button class="btn-success" onclick="updateTaskStatus(${task.id}, 'completed')"
                        ${task.status === 'completed' || task.status === 'approved' ? 'disabled' : ''}>
                    <i class="fas fa-check"></i> Selesai
                </button>
                
                <button class="btn-secondary" onclick="showUploadResultModal(${task.id})">
                    <i class="fas fa-upload"></i> Upload Hasil
                </button>
            ` : ''}
            
            ${currentUser && currentUser.role === 'admin' && task.status === 'completed' && task.approval_status === 'pending' ? `
                <button class="btn-success" onclick="approveTask(${task.id})">
                    <i class="fas fa-check-double"></i> Approve
                </button>
                <button class="btn-warning" onclick="showRejectModal(${task.id})">
                    <i class="fas fa-times"></i> Reject
                </button>
            ` : ''}
            
            ${currentUser && currentUser.role === 'admin' ? `
                <button class="btn-danger" onclick="deleteTask(${task.id})">
                    <i class="fas fa-trash"></i> Hapus
                </button>
            ` : ''}
            
            <button class="btn-secondary" onclick="this.closest('.modal').remove()">
                <i class="fas fa-times"></i> Tutup
            </button>
        </div>
    `;
    
    // Load test cases
    loadTestCases(task.id);
}

// Show Add Test Case Modal
function showAddTestCaseModal(taskId) {
    // Remove existing modal
    const existingModal = document.querySelector('.modal.active');
    if (existingModal) existingModal.remove();
    
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3><i class="fas fa-vial"></i> Tambah Test Case</h3>
                <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            
            <div class="modal-body">
                <form id="addTestCaseForm">
                    <input type="hidden" name="task_id" value="${taskId}">
                    
                    <div class="form-group">
                        <label>Nama Test <span class="required">*</span></label>
                        <input type="text" name="test_name" required 
                               placeholder="Contoh: Login dengan credential valid">
                    </div>
                    
                    <div class="form-group">
                        <label>Deskripsi Test</label>
                        <textarea name="test_description" rows="3" 
                                  placeholder="Jelaskan skenario test..."></textarea>
                    </div>
                    
                    <div class="form-group">
                        <label>Input Data</label>
                        <textarea name="input_data" rows="2" 
                                  placeholder="Data input yang digunakan"></textarea>
                    </div>
                    
                    <div class="form-group">
                        <label>Expected Output</label>
                        <textarea name="expected_output" rows="2" 
                                  placeholder="Hasil yang diharapkan"></textarea>
                    </div>
                    
                    <div class="form-group">
                        <label>Screenshot (Opsional)</label>
                        <input type="file" name="screenshot" accept="image/*">
                    </div>
                    
                    <div class="form-actions">
                        <button type="button" class="btn-secondary" onclick="this.closest('.modal').remove()">
                            Batal
                        </button>
                        <button type="submit" class="btn-primary">
                            <i class="fas fa-save"></i> Simpan Test Case
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Handle submit
    const addTestCaseForm = document.getElementById('addTestCaseForm');
    if (addTestCaseForm) {
        addTestCaseForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(e.target);
            const taskId = formData.get('task_id');
            
            try {
                const response = await fetch(`/api/tasks/${taskId}/test-cases`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${currentToken}`
                    },
                    body: formData
                });
                
                const data = await response.json();
                
                if (data.success) {
                    showNotification('✅ Test case ditambahkan', 'success');
                    modal.remove();
                    loadTestCases(taskId);
                } else {
                    showNotification('❌ ' + (data.error || 'Gagal menambah test case'), 'error');
                }
            } catch (error) {
                console.error('Add test case error:', error);
                showNotification('❌ Gagal menambah test case', 'error');
            }
        });
    }
}

// Show Reject Modal
function showRejectModal(taskId) {
    // Remove existing modal
    const existingModal = document.querySelector('.modal.active');
    if (existingModal) existingModal.remove();
    
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3><i class="fas fa-times-circle"></i> Tolak Task</h3>
                <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            
            <div class="modal-body">
                <form id="rejectTaskForm">
                    <input type="hidden" name="task_id" value="${taskId}">
                    
                    <div class="form-group">
                        <label>Alasan Penolakan <span class="required">*</span></label>
                        <textarea name="reason" required rows="4" 
                                  placeholder="Jelaskan alasan mengapa task ditolak..."></textarea>
                    </div>
                    
                    <div class="form-actions">
                        <button type="button" class="btn-secondary" onclick="this.closest('.modal').remove()">
                            Batal
                        </button>
                        <button type="submit" class="btn-warning">
                            <i class="fas fa-times"></i> Tolak Task
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Handle submit
    const rejectTaskForm = document.getElementById('rejectTaskForm');
    if (rejectTaskForm) {
        rejectTaskForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(e.target);
            const taskId = formData.get('task_id');
            const reason = formData.get('reason');
            
            const success = await rejectTask(taskId, reason);
            if (success) {
                modal.remove();
            }
        });
    }
}

// Show Create User Modal (Admin)
function showCreateUserModal() {
    if (!currentUser || currentUser.role !== 'admin') return;
    
    // Remove existing modal
    const existingModal = document.querySelector('.modal.active');
    if (existingModal) existingModal.remove();
    
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3><i class="fas fa-user-plus"></i> Tambah User Baru</h3>
                <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            
            <div class="modal-body">
                <form id="createUserForm">
                    <div class="form-group">
                        <label>Username <span class="required">*</span></label>
                        <input type="text" name="username" required 
                               placeholder="Masukkan username">
                    </div>
                    
                    <div class="form-group">
                        <label>Email <span class="required">*</span></label>
                        <input type="email" name="email" required 
                               placeholder="Masukkan email">
                    </div>
                    
                    <div class="form-group">
                        <label>Password <span class="required">*</span></label>
                        <input type="password" name="password" required 
                               placeholder="Masukkan password">
                    </div>
                    
                    <div class="form-group">
                        <label>Nama Lengkap</label>
                        <input type="text" name="full_name" 
                               placeholder="Masukkan nama lengkap">
                    </div>
                    
                    <div class="form-group">
                        <label>Role</label>
                        <select name="role">
                            <option value="user">User</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label>Telegram Chat ID</label>
                        <input type="text" name="telegram_chat_id" 
                               placeholder="Opsional">
                    </div>
                    
                    <div class="form-actions">
                        <button type="button" class="btn-secondary" onclick="this.closest('.modal').remove()">
                            Batal
                        </button>
                        <button type="submit" class="btn-primary">
                            <i class="fas fa-save"></i> Simpan User
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Handle submit
    const createUserForm = document.getElementById('createUserForm');
    if (createUserForm) {
        createUserForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(e.target);
            const data = {
                username: formData.get('username'),
                email: formData.get('email'),
                password: formData.get('password'),
                full_name: formData.get('full_name'),
                role: formData.get('role'),
                telegram_chat_id: formData.get('telegram_chat_id')
            };
            
            try {
                const response = await fetch('/api/admin/users', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${currentToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(data)
                });
                
                const result = await response.json();
                
                if (result.success) {
                    showNotification('✅ User berhasil ditambahkan', 'success');
                    modal.remove();
                    loadUsers();
                } else {
                    showNotification('❌ ' + (result.error || 'Gagal menambah user'), 'error');
                }
            } catch (error) {
                console.error('Create user error:', error);
                showNotification('❌ Gagal menambah user', 'error');
            }
        });
    }
}

// =============== LOAD TEST CASES ===============

async function loadTestCases(taskId) {
    const container = document.getElementById('testCasesList');
    if (!container) return;
    
    try {
        const response = await fetch(`/api/tasks/${taskId}/test-cases`, {
            headers: {
                'Authorization': `Bearer ${currentToken}`
            }
        });
        
        const testCases = await response.json();
        
        if (testCases.length === 0) {
            container.innerHTML = `
                <div class="empty-state small">
                    <i class="fas fa-flask"></i>
                    <p>Belum ada test case</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = testCases.map(tc => `
            <div class="test-case-item ${tc.status}">
                <div class="test-case-header">
                    <h6>${escapeHtml(tc.test_name)}</h6>
                    <span class="status-badge ${tc.status}">${tc.status}</span>
                </div>
                
                ${tc.test_description ? `<p>${escapeHtml(tc.test_description)}</p>` : ''}
                
                <div class="test-case-details">
                    ${tc.input_data ? `
                        <div class="detail">
                            <strong>Input:</strong> ${escapeHtml(tc.input_data)}
                        </div>
                    ` : ''}
                    
                    ${tc.expected_output ? `
                        <div class="detail">
                            <strong>Expected:</strong> ${escapeHtml(tc.expected_output)}
                        </div>
                    ` : ''}
                    
                    ${tc.actual_output ? `
                        <div class="detail">
                            <strong>Actual:</strong> ${escapeHtml(tc.actual_output)}
                        </div>
                    ` : ''}
                </div>
                
                ${tc.screenshot_url ? `
                    <div class="test-case-screenshot">
                        <a href="${tc.screenshot_url}" target="_blank">
                            <i class="fas fa-image"></i> View Screenshot
                        </a>
                    </div>
                ` : ''}
                
                ${tc.executed_by ? `
                    <div class="test-case-footer">
                        <small>Executed by: ${escapeHtml(tc.executed_by_username)}</small>
                        <small>${formatDate(tc.executed_at)}</small>
                    </div>
                ` : ''}
                
                ${taskId === currentUser?.id ? `
                    <div class="test-case-actions">
                        <button class="btn-sm" onclick="updateTestCaseResult(${tc.id})">
                            <i class="fas fa-edit"></i> Update Result
                        </button>
                    </div>
                ` : ''}
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Load test cases error:', error);
        container.innerHTML = '<p class="error">Gagal memuat test cases</p>';
    }
}

// =============== CHARTS ===============

function initCharts() {
    // Destroy existing charts
    Object.keys(taskCharts).forEach(key => {
        if (taskCharts[key]) {
            taskCharts[key].destroy();
        }
    });
    taskCharts = {};
    
    // Task Distribution Chart
    const taskChartCanvas = document.getElementById('taskChart');
    if (taskChartCanvas && typeof Chart !== 'undefined') {
        const ctx = taskChartCanvas.getContext('2d');
        
        const pending = parseInt(document.getElementById('statPending')?.textContent || '0');
        const progress = parseInt(document.getElementById('statProgress')?.textContent || '0');
        const completed = parseInt(document.getElementById('statCompleted')?.textContent || '0');
        
        taskCharts.task = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Pending', 'In Progress', 'Completed'],
                datasets: [{
                    data: [pending, progress, completed],
                    backgroundColor: [
                        '#f59e0b',
                        '#3b82f6',
                        '#10b981'
                    ],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }
    
    // Activity Chart
    const activityChartCanvas = document.getElementById('activityChart');
    if (activityChartCanvas && typeof Chart !== 'undefined') {
        const ctx = activityChartCanvas.getContext('2d');
        
        taskCharts.activity = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'],
                datasets: [{
                    label: 'Tasks',
                    data: [3, 5, 2, 8, 6, 4, 7],
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
    }
}

// =============== UTILITY FUNCTIONS ===============

function togglePassword(btn) {
    const input = btn.closest('.password-field')?.querySelector('input');
    const icon = btn.querySelector('i');
    
    if (input && icon) {
        if (input.type === 'password') {
            input.type = 'text';
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
        } else {
            input.type = 'password';
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
        }
    }
}

function getStatusIcon(status) {
    const icons = {
        'pending': 'fa-clock',
        'in_progress': 'fa-sync-alt',
        'completed': 'fa-check-circle',
        'approved': 'fa-check-double',
        'rejected': 'fa-times-circle'
    };
    return `<i class="fas ${icons[status] || 'fa-question-circle'}"></i>`;
}

function getStatusText(status) {
    const texts = {
        'pending': 'Pending',
        'in_progress': 'In Progress',
        'completed': 'Completed',
        'approved': 'Approved',
        'rejected': 'Rejected'
    };
    return texts[status] || status;
}

function getActivityIcon(action) {
    const icons = {
        'LOGIN': 'fa-sign-in-alt',
        'CREATE_TASK': 'fa-plus-circle',
        'UPDATE_TASK_STATUS': 'fa-edit',
        'APPROVE_TASK': 'fa-check-double',
        'REJECT_TASK': 'fa-times-circle',
        'REGISTER': 'fa-user-plus'
    };
    return icons[action] || 'fa-bell';
}

function formatDate(dateString) {
    if (!dateString) return '-';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return '-';
        
        return date.toLocaleDateString('id-ID', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (e) {
        return '-';
    }
}

function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function escapeHtml(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function handleFileSelect(file, previewId) {
    if (!file) return;
    
    const preview = document.getElementById(previewId);
    if (!preview) return;
    
    preview.innerHTML = `
        <div class="file-preview-item">
            <i class="fas fa-file"></i>
            <span class="name">${escapeHtml(file.name)}</span>
            <span class="size">${formatFileSize(file.size)}</span>
            <button type="button" onclick="this.closest('.file-preview-item').remove(); this.closest('.file-preview').classList.remove('active');">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
    preview.classList.add('active');
}

function showNotification(message, type = 'info') {
    if (!notificationContainer) return;
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <span>${message}</span>
        <button onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    notificationContainer.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentElement) {
            notification.classList.add('fade-out');
            setTimeout(() => {
                if (notification.parentElement) {
                    notification.remove();
                }
            }, 300);
        }
    }, 5000);
}

function loadTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.body.className = savedTheme;
    theme = savedTheme;
}

function toggleTheme() {
    theme = theme === 'dark' ? 'light' : 'dark';
    document.body.className = theme;
    localStorage.setItem('theme', theme);
    
    // Update icon if on dashboard
    const themeIcon = document.getElementById('themeIcon');
    const themeText = document.getElementById('themeText');
    
    if (themeIcon) {
        themeIcon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    }
    
    if (themeText) {
        themeText.textContent = theme === 'dark' ? 'Light Mode' : 'Dark Mode';
    }
}

function refreshAll() {
    loadTasks();
    loadStats();
    if (currentUser && currentUser.role === 'admin') {
        loadUsers();
    }
    if (currentView === 'dashboard') {
        loadRecentTasks();
        loadActivities();
        initCharts();
    }
    showNotification('🔄 Data diperbarui', 'info');
}

function resetFilters() {
    const filterStatus = document.getElementById('filterStatus');
    const filterAssignee = document.getElementById('filterAssignee');
    const filterSort = document.getElementById('filterSort');
    const globalSearch = document.getElementById('globalSearch');
    
    if (filterStatus) filterStatus.value = 'all';
    if (filterAssignee) filterAssignee.value = 'all';
    if (filterSort) filterSort.value = 'newest';
    if (globalSearch) globalSearch.value = '';
    
    filterTasks();
}

function filterTasks() {
    displayTasks();
}

function updateTaskBadges() {
    const pendingCount = tasks.filter(t => t.status === 'pending').length;
    const navTasksBadge = document.getElementById('navTasksBadge');
    if (navTasksBadge) navTasksBadge.textContent = tasks.length;
}

function testTelegram() {
    showNotification('📱 Test Telegram - Fitur akan segera hadir!', 'info');
}

function verifyTelegram() {
    showNotification('📱 Verifikasi Telegram - Fitur akan segera hadir!', 'info');
}

function exportReport(type) {
    showNotification(`📊 Export ${type} - Fitur akan segera hadir!`, 'info');
}

function backupDatabase() {
    showNotification('💾 Backup database - Fitur akan segera hadir!', 'info');
}

function clearCache() {
    showNotification('🧹 Clear cache - Fitur akan segera hadir!', 'info');
}

function editUser(userId) {
    showNotification(`✏️ Edit user #${userId} - Fitur akan segera hadir!`, 'info');
}

function resetUserPassword(userId) {
    showNotification(`🔑 Reset password user #${userId} - Fitur akan segera hadir!`, 'info');
}

function deleteUser(userId) {
    if (confirm(`Apakah Anda yakin ingin menghapus user #${userId}?`)) {
        showNotification(`🗑️ Delete user #${userId} - Fitur akan segera hadir!`, 'info');
    }
}

function editTask(taskId) {
    showNotification(`✏️ Edit task #${taskId} - Fitur akan segera hadir!`, 'info');
}

function deleteTask(taskId) {
    if (confirm(`Apakah Anda yakin ingin menghapus task #${taskId}?`)) {
        showNotification(`🗑️ Delete task #${taskId} - Fitur akan segera hadir!`, 'info');
    }
}

function updateTestCaseResult(testCaseId) {
    showNotification(`📝 Update test case #${testCaseId} - Fitur akan segera hadir!`, 'info');
}

function showUploadResultModal(taskId) {
    showNotification(`📤 Upload hasil task #${taskId} - Fitur akan segera hadir!`, 'info');
}

function initReportCharts() {
    // Will be implemented later
}

// =============== PATH UTILITY ===============
const path = {
    basename: function(p) {
        if (!p) return '';
        return p.split('/').pop();
    }
};

// =============== EXPOSE GLOBALLY ===============
window.showLoginPage = showLoginPage;
window.switchAuthTab = switchAuthTab;
window.showForgotPassword = showForgotPassword;
window.togglePassword = togglePassword;
window.verifyTelegramCode = verifyTelegramCode;
window.logout = logout;
window.switchView = switchView;
window.toggleTheme = toggleTheme;
window.refreshAll = refreshAll;
window.showCreateTaskModal = showCreateTaskModal;
window.showTaskDetail = showTaskDetail;
window.updateTaskStatus = updateTaskStatus;
window.approveTask = approveTask;
window.rejectTask = rejectTask;
window.showRejectModal = showRejectModal;
window.showAddTestCaseModal = showAddTestCaseModal;
window.filterTasks = filterTasks;
window.loadTasks = loadTasks;
window.resetFilters = resetFilters;
window.testTelegram = testTelegram;
window.verifyTelegram = verifyTelegram;
window.exportReport = exportReport;
window.backupDatabase = backupDatabase;
window.clearCache = clearCache;
window.editUser = editUser;
window.resetUserPassword = resetUserPassword;
window.deleteUser = deleteUser;
window.editTask = editTask;
window.deleteTask = deleteTask;
window.updateTestCaseResult = updateTestCaseResult;
window.showUploadResultModal = showUploadResultModal;
window.showCreateUserModal = showCreateUserModal;
window.getStatusIcon = getStatusIcon;
window.getStatusText = getStatusText;
window.formatDate = formatDate;
window.escapeHtml = escapeHtml;
window.path = path;