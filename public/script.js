// Helper untuk akses ID dengan aman (mencegah crash)
function safeId(obj, fallback = null) {
    const id = obj?.id;
    return (id === 0 || id) ? id : fallback;
}

let currentUser = null;
let currentToken = null;
let currentView = 'login';
let currentFilter = 'all';
let tasks = [];
let users = [];
let socket = null;
let theme = localStorage.getItem('theme') || 'dark';
let taskCharts = {};

// Audio notification variables
let notificationAudio = null;
let audioEnabled = true;

// Chat variables
let currentChatRoom = null;
let chatRooms = [];
let friends = [];
let friendRequests = [];
let chatMessages = {};
let typingTimeout = null;
let messagePage = 1;
let hasMoreMessages = true;
let loadingMessages = false;

// Group variables
let groups = [];
let groupInvitations = [];
let selectedMembers = [];
// let currentGroupDetail = null;


// Profile picture
let selectedProfilePicture = null;

// Search timeout
let searchTimeout = null;

// Chat file
let selectedChatFile = null;


// Reply to message
let replyToMessage = null;

// Emoji picker
let emojiPickerVisible = false;

// Edit message
let currentEditingMessage = null;
let messageStatusCheckInterval = null;

let presenceHeartbeatInterval = null;

// =============== ANNOUNCEMENT SYSTEM ===============

let announcements = [];
let currentAnnouncementIndex = 0;
let announcementInterval;

async function loadAnnouncements() {
    try {
        console.log('📢 Loading announcements...');
        const response = await fetch('/api/announcements', {
            headers: {
                'Authorization': `Bearer ${currentToken}`
            }
        });
        
        const data = await response.json();
        console.log('📦 Raw API data:', data);
        
        if (data.success && data.announcements && data.announcements.length > 0) {
            console.log('✅ Found', data.announcements.length, 'announcements from API');
            
            // Get today's date string
            const today = new Date().toDateString();
            console.log('📅 Today is:', today);
            
            // Get dismissed announcements from localStorage
            let dismissedToday = {};
            try {
                dismissedToday = JSON.parse(localStorage.getItem('dismissedAnnouncements') || '{}');
                console.log('🚫 Dismissed announcements:', dismissedToday);
            } catch (e) {
                console.warn('Error parsing dismissed announcements:', e);
                localStorage.removeItem('dismissedAnnouncements');
            }
            
            // Filter announcements
            announcements = data.announcements.filter(a => {
                const key = `announcement_${a.id}`;
                const isDismissed = dismissedToday[key] === today;
                console.log(`🔍 Announcement ${a.id} (${a.title}):`, {
                    dismissed: isDismissed,
                    key: key,
                    stored: dismissedToday[key],
                    today: today
                });
                return !isDismissed;
            });
            
            console.log('🎯 Final announcements after filter:', announcements);
            
            if (announcements.length > 0) {
                console.log('⏰ Scheduling modal in 1 second...');
                setTimeout(() => {
                    console.log('🚀 Showing announcement modal now!');
                    showAnnouncementModal();
                }, 1000);
            } else {
                console.log('😴 No announcements to show after filtering');
                
                // DEBUG: Show all announcements anyway for testing
                console.log('🔄 FORCE SHOW ALL ANNOUNCEMENTS FOR TESTING');
                announcements = data.announcements; // Force all announcements
                setTimeout(() => {
                    showAnnouncementModal();
                }, 1000);
            }
        } else {
            console.log('❌ No announcements from API');
            console.log('API Response:', data);
        }
    } catch (error) {
        console.error('❌ Load announcements error:', error);
    }
}

function showAnnouncementModal() {
    console.log('🚀 showAnnouncementModal called');
    
    const existingModal = document.querySelector('#announcementModal');
    if (existingModal) {
        console.log('🗑️ Removing existing modal');
        existingModal.remove();
    }
    
    const template = document.getElementById('announcement-modal-template');
    console.log('📝 Template found:', !!template);
    
    if (!template) {
        console.error('❌ Template not found!');
        return;
    }
    
    const modal = template.content.cloneNode(true);
    console.log('✅ Template cloned');
    
    const carousel = modal.querySelector('#announcementCarousel');
    const dots = modal.querySelector('#announcementDots');
    
    if (!carousel || !dots) {
        console.error('❌ Carousel or dots not found in template');
        return;
    }
    
    console.log('📦 Creating slides for', announcements.length, 'announcements');
    
    // Bersihkan carousel dan dots dari template (kalau ada konten default)
    carousel.innerHTML = '';
    dots.innerHTML = '';
    
    // Create slides
    announcements.forEach((announcement, index) => {
        console.log(`Creating slide ${index}:`, announcement.title);
        
        const slide = document.createElement('div');
        slide.className = `announcement-slide ${index === 0 ? 'active' : ''}`;
        slide.setAttribute('data-index', index);
        
        const gradient = announcement.background_color || 'linear-gradient(135deg, var(--primary), var(--secondary))';
        
        slide.innerHTML = `
            <div class="announcement-icon" style="background: ${gradient}">
                <i class="fas ${announcement.icon || getDefaultIcon(announcement.type)}"></i>
            </div>
            <span class="announcement-badge" style="background: ${gradient}">
                ${getAnnouncementTypeText(announcement.type)}
            </span>
            <h2 class="announcement-title" style="background: ${gradient}; -webkit-background-clip: text; background-clip: text;">
                ${escapeHtml(announcement.title)}
            </h2>
            <div class="announcement-content-text">
                ${escapeHtml(announcement.content).replace(/\n/g, '<br>')}
            </div>
        `;
        
        carousel.appendChild(slide);
        
        // Create dot
        const dot = document.createElement('span');
        dot.className = `dot ${index === 0 ? 'active' : ''}`;
        dot.setAttribute('data-index', index);
        dot.onclick = () => goToAnnouncement(index);
        dots.appendChild(dot);
    });
    
    document.body.appendChild(modal);
    
    // 🔥 PASTIKAN MODAL AKTIF
    const modalElement = document.querySelector('#announcementModal');
    if (modalElement) {
        modalElement.classList.add('active');
        modalElement.style.display = 'flex';
        modalElement.style.visibility = 'visible';
        modalElement.style.opacity = '1';
        
        // HAPUS FOOTER (bagian checkbox dan tombol)
        const footer = modalElement.querySelector('.announcement-footer');
        if (footer) {
            footer.remove(); // Hapus footer yang berisi checkbox
        }
        
        console.log('✅ Modal activated and visible (without dismiss checkbox)');
    } else {
        console.error('❌ Modal element not found after append');
    }
    
    // Auto play carousel jika lebih dari 1
    if (announcements.length > 1) {
        startAnnouncementCarousel();
    }
}

// Fallback manual modal
function createManualAnnouncementModal() {
    console.log('🛠️ Creating manual modal');
    
    const modal = document.createElement('div');
    modal.id = 'announcementModal';
    modal.className = 'modal active announcement-modal';
    
    modal.innerHTML = `
        <div class="modal-content announcement-content">
            <button class="modal-close announcement-close" onclick="closeAnnouncementModal()">
                <i class="fas fa-times"></i>
            </button>
            
            <div class="announcement-carousel" id="announcementCarousel">
                ${announcements.map((a, index) => `
                    <div class="announcement-slide ${index === 0 ? 'active' : ''}" data-index="${index}">
                        <div class="announcement-icon" style="background: ${a.background_color || 'linear-gradient(135deg, var(--primary), var(--secondary))'}">
                            <i class="fas ${a.icon || getDefaultIcon(a.type)}"></i>
                        </div>
                        <span class="announcement-badge" style="background: ${a.background_color || 'linear-gradient(135deg, var(--primary), var(--secondary))'}">
                            ${getAnnouncementTypeText(a.type)}
                        </span>
                        <h2 class="announcement-title">${escapeHtml(a.title)}</h2>
                        <div class="announcement-content-text">
                            ${escapeHtml(a.content).replace(/\n/g, '<br>')}
                        </div>
                    </div>
                `).join('')}
            </div>
            
            <div class="announcement-dots" id="announcementDots">
                ${announcements.map((_, index) => `
                    <span class="dot ${index === 0 ? 'active' : ''}" data-index="${index}" onclick="goToAnnouncement(${index})"></span>
                `).join('')}
            </div>
            
            <div class="announcement-footer">
                <label class="dismiss-checkbox">
                    <input type="checkbox" id="dontShowToday">
                    <span>Jangan tampilkan hari ini</span>
                </label>
                <button class="btn-primary" onclick="closeAnnouncementModal()">
                    Tutup
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    if (announcements.length > 1) {
        startAnnouncementCarousel();
    }
}

// Get default icon based on type
function getDefaultIcon(type) {
    const icons = {
        'info': 'fa-info-circle',
        'warning': 'fa-exclamation-triangle',
        'success': 'fa-check-circle',
        'holiday': 'fa-moon',
        'changelog': 'fa-rocket'
    };
    return icons[type] || 'fa-bell';
}

// Get type text
function getAnnouncementTypeText(type) {
    const texts = {
        'info': 'Informasi',
        'warning': 'Peringatan',
        'success': 'Sukses',
        'holiday': 'Hari Spesial',
        'changelog': 'Pembaruan'
    };
    return texts[type] || 'Informasi';
}

// Carousel functions
function startAnnouncementCarousel() {
    if (announcementInterval) {
        clearInterval(announcementInterval);
    }
    
    announcementInterval = setInterval(() => {
        const nextIndex = (currentAnnouncementIndex + 1) % announcements.length;
        goToAnnouncement(nextIndex);
    }, 5000);
}

function goToAnnouncement(index) {
    // Update slides
    document.querySelectorAll('.announcement-slide').forEach(slide => {
        slide.classList.remove('active');
    });
    document.querySelector(`.announcement-slide[data-index="${index}"]`).classList.add('active');
    
    // Update dots
    document.querySelectorAll('.dot').forEach(dot => {
        dot.classList.remove('active');
    });
    document.querySelector(`.dot[data-index="${index}"]`).classList.add('active');
    
    currentAnnouncementIndex = index;
}

// Close announcement modal
async function closeAnnouncementModal() {
    // Hapus modal dari DOM
    const modal = document.getElementById('announcementModal');
    if (modal) {
        modal.remove();
    }
    
    // Hentikan carousel interval
    if (announcementInterval) {
        clearInterval(announcementInterval);
        announcementInterval = null;
    }
    
    console.log('✅ Announcement modal closed');
}

// Click outside to close
document.addEventListener('click', function(e) {
    const modal = document.getElementById('announcementModal');
    if (modal && e.target === modal) {
        closeAnnouncementModal();
    }
});

// =============== ADMIN ANNOUNCEMENT MANAGEMENT ===============

let announcementsList = [];

// Render admin announcements view
function renderAdminAnnouncements() {
    const contentArea = document.getElementById('contentArea');
    if (!contentArea) return;
    
    const template = document.getElementById('admin-announcements-template');
    contentArea.innerHTML = template.innerHTML;
    
    loadAdminAnnouncements();
}

// Load announcements for admin
async function loadAdminAnnouncements() {
    try {
        const response = await fetch('/api/admin/announcements', {
            headers: {
                'Authorization': `Bearer ${currentToken}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            announcementsList = data.announcements || [];
            displayAdminAnnouncements();
        }
    } catch (error) {
        console.error('Load admin announcements error:', error);
        showNotification('❌ Gagal memuat announcements', 'error');
    }
}

// Display admin announcements table
function displayAdminAnnouncements() {
    const tbody = document.getElementById('announcementsTableBody');
    if (!tbody) return;
    
    if (announcementsList.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center">
                    <div class="empty-state small">
                        <i class="fas fa-bullhorn"></i>
                        <p>Belum ada announcement</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = announcementsList.map(a => `
        <tr>
            <td>
                <span class="status-badge ${a.is_active ? 'active' : 'inactive'}">
                    ${a.is_active ? 'Aktif' : 'Nonaktif'}
                </span>
            </td>
            <td>
                <strong>${escapeHtml(a.title)}</strong>
                <br>
                <small>${escapeHtml(a.content.substring(0, 50))}...</small>
            </td>
            <td>
                <span class="type-badge ${a.type}">${getAnnouncementTypeText(a.type)}</span>
            </td>
            <td>${a.priority || 0}</td>
            <td>
                ${a.start_date ? formatDate(a.start_date) : '-'}
                <br>
                <small>s/d ${a.end_date ? formatDate(a.end_date) : '-'}</small>
            </td>
            <td>${a.dismiss_count || 0} user</td>
            <td>
                <div class="action-buttons">
                    <button class="btn-icon" onclick="editAnnouncement(${a.id})" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon" onclick="toggleAnnouncementStatus(${a.id})" title="${a.is_active ? 'Nonaktifkan' : 'Aktifkan'}">
                        <i class="fas ${a.is_active ? 'fa-eye-slash' : 'fa-eye'}"></i>
                    </button>
                    <button class="btn-icon delete" onclick="deleteAnnouncement(${a.id})" title="Hapus">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

// Show create announcement modal
function showCreateAnnouncementModal() {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content announcement-form">
            <div class="modal-header">
                <h3><i class="fas fa-plus-circle"></i> Buat Announcement Baru</h3>
                <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            
            <div class="modal-body">
                <form id="announcementForm">
                    <div class="form-group">
                        <label>Judul <span class="required">*</span></label>
                        <input type="text" name="title" required placeholder="Contoh: Selamat Hari Raya">
                    </div>
                    
                    <div class="form-group">
                        <label>Konten <span class="required">*</span></label>
                        <textarea name="content" required rows="5" placeholder="Tulis konten announcement..."></textarea>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label>Tipe</label>
                            <select name="type" onchange="updateIconPreview(this)">
                                <option value="info">Informasi</option>
                                <option value="warning">Peringatan</option>
                                <option value="success">Sukses</option>
                                <option value="holiday">Hari Spesial</option>
                                <option value="changelog">Pembaruan</option>
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label>Icon</label>
                            <select name="icon">
                                <option value="fa-bell">🔔 Bell</option>
                                <option value="fa-moon">🌙 Moon</option>
                                <option value="fa-star">⭐ Star</option>
                                <option value="fa-rocket">🚀 Rocket</option>
                                <option value="fa-gift">🎁 Gift</option>
                                <option value="fa-tree">🎄 Tree</option>
                                <option value="fa-snowman">⛄ Snowman</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label>Background Color (gradient)</label>
                        <input type="text" name="background_color" 
                               value="linear-gradient(135deg, var(--primary), var(--secondary))"
                               placeholder="linear-gradient(135deg, #b58b5b, #2d5a4c)">
                        <div class="color-preview" id="colorPreview" 
                             style="background: linear-gradient(135deg, var(--primary), var(--secondary))"></div>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label>Priority</label>
                            <input type="number" name="priority" value="0" min="0" max="999">
                        </div>
                        
                        <div class="form-group">
                            <label>Status</label>
                            <select name="is_active">
                                <option value="1">Aktif</option>
                                <option value="0">Nonaktif</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label>Mulai Tanggal</label>
                            <input type="datetime-local" name="start_date">
                        </div>
                        
                        <div class="form-group">
                            <label>Sampai Tanggal</label>
                            <input type="datetime-local" name="end_date">
                        </div>
                    </div>
                    
                    <div class="form-actions">
                        <button type="button" class="btn-secondary" onclick="this.closest('.modal').remove()">Batal</button>
                        <button type="submit" class="btn-primary">
                            <i class="fas fa-save"></i> Simpan
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Color preview on input change
    const colorInput = modal.querySelector('input[name="background_color"]');
    colorInput.addEventListener('input', function() {
        document.getElementById('colorPreview').style.background = this.value;
    });
    
    // Form submit
    const form = document.getElementById('announcementForm');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());
        
        try {
            showNotification('🔄 Menyimpan announcement...', 'info');
            
            const response = await fetch('/api/admin/announcements', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${currentToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            
            const result = await response.json();
            
            if (result.success) {
                showNotification('✅ Announcement berhasil disimpan!', 'success');
                modal.remove();
                loadAdminAnnouncements();
            } else {
                showNotification('❌ Gagal menyimpan announcement', 'error');
            }
        } catch (error) {
            console.error('Save announcement error:', error);
            showNotification('❌ Gagal menyimpan announcement', 'error');
        }
    });
}

// Update icon preview
function updateIconPreview(select) {
    const type = select.value;
    const iconMap = {
        'info': 'fa-info-circle',
        'warning': 'fa-exclamation-triangle',
        'success': 'fa-check-circle',
        'holiday': 'fa-moon',
        'changelog': 'fa-rocket'
    };
    
    const iconSelect = select.closest('.modal').querySelector('select[name="icon"]');
    if (iconSelect && iconMap[type]) {
        // Auto select icon based on type
        Array.from(iconSelect.options).forEach(opt => {
            if (opt.value === iconMap[type]) {
                opt.selected = true;
            }
        });
    }
}

// Edit announcement
function editAnnouncement(id) {
    const announcement = announcementsList.find(a => a.id === id);
    if (!announcement) return;
    
    showCreateAnnouncementModal(); // Reuse create modal
    setTimeout(() => {
        const form = document.getElementById('announcementForm');
        form.querySelector('input[name="title"]').value = announcement.title;
        form.querySelector('textarea[name="content"]').value = announcement.content;
        form.querySelector('select[name="type"]').value = announcement.type;
        form.querySelector('select[name="icon"]').value = announcement.icon || getDefaultIcon(announcement.type);
        form.querySelector('input[name="background_color"]').value = announcement.background_color;
        form.querySelector('input[name="priority"]').value = announcement.priority || 0;
        form.querySelector('select[name="is_active"]').value = announcement.is_active ? '1' : '0';
        
        if (announcement.start_date) {
            form.querySelector('input[name="start_date"]').value = announcement.start_date.slice(0, 16);
        }
        if (announcement.end_date) {
            form.querySelector('input[name="end_date"]').value = announcement.end_date.slice(0, 16);
        }
        
        // Add hidden ID field
        const idInput = document.createElement('input');
        idInput.type = 'hidden';
        idInput.name = 'id';
        idInput.value = id;
        form.appendChild(idInput);
    }, 100);
}

// Toggle announcement status
async function toggleAnnouncementStatus(id) {
    const announcement = announcementsList.find(a => a.id === id);
    if (!announcement) return;
    
    announcement.is_active = !announcement.is_active;
    
    try {
        const response = await fetch('/api/admin/announcements', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${currentToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(announcement)
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification(`✅ Announcement ${announcement.is_active ? 'diaktifkan' : 'dinonaktifkan'}!`, 'success');
            loadAdminAnnouncements();
        }
    } catch (error) {
        console.error('Toggle announcement error:', error);
        showNotification('❌ Gagal mengubah status', 'error');
    }
}

// Delete announcement
async function deleteAnnouncement(id) {
    if (!confirm('Yakin ingin menghapus announcement ini?')) return;
    
    try {
        const response = await fetch(`/api/admin/announcements/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${currentToken}`
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification('✅ Announcement dihapus!', 'success');
            loadAdminAnnouncements();
        }
    } catch (error) {
        console.error('Delete announcement error:', error);
        showNotification('❌ Gagal menghapus announcement', 'error');
    }
}

// =============== SESSION TIMEOUT TRACKER ===============
let lastActivityTime = Date.now();
const SESSION_TIMEOUT = 60 * 60 * 1000; // 1 menit untuk testing
let sessionCheckInterval = null;
let monitoringActive = false; // Tambahkan flag untuk tracking

// Fungsi untuk mereset timer aktivitas
function resetActivityTimer() {
    lastActivityTime = Date.now();
    // console.log('⏰ Activity timer reset:', new Date().toLocaleTimeString(), 'by:', event?.type || 'manual');
}

// Fungsi untuk memeriksa apakah session masih valid
function checkSessionTimeout() {
    if (!currentUser || !currentToken) {
        // console.log('⏰ No user/token, stopping timeout check');
        stopActivityMonitoring();
        return false;
    }
    
    const now = Date.now();
    const elapsed = now - lastActivityTime;
    
    // console.log('⏰ Time since last activity:', Math.round(elapsed / 1000), 'seconds', 'Timeout:', SESSION_TIMEOUT/1000, 'seconds');
    
    if (elapsed > SESSION_TIMEOUT) {
        console.log('⏰⏰⏰ SESSION TIMEOUT! Logging out...');
        showNotification('⏰ Sesi berakhir karena tidak ada aktivitas selama 1 jam', 'warning');
        logout();
        return false;
    }
    return true;
}

// Fungsi untuk memulai monitoring aktivitas
function startActivityMonitoring() {
    // console.log('⏰ Starting activity monitoring...', 'Current user:', currentUser?.username);
    
    // Jika sudah aktif, jangan mulai lagi
    if (monitoringActive) {
        console.log('⏰ Monitoring already active, skipping...');
        return;
    }
    
    // Hentikan interval yang sudah ada
    if (sessionCheckInterval) {
        clearInterval(sessionCheckInterval);
        sessionCheckInterval = null;
    }
    
    // Reset timer aktivitas
    resetActivityTimer();
    
    // Cek setiap 10 detik (lebih responsif untuk testing)
    sessionCheckInterval = setInterval(checkSessionTimeout, 60 * 1000);
    
    // HAPUS semua event listener lama
    const activityEvents = [
        'mousedown', 'mousemove', 'keydown', 'scroll',
        'touchstart', 'click', 'wheel', 'input'
    ];
    
    activityEvents.forEach(eventType => {
        document.removeEventListener(eventType, resetActivityTimer);
    });
    
    // TAMBAHKAN event listener baru
    activityEvents.forEach(eventType => {
        document.addEventListener(eventType, resetActivityTimer);
        // console.log('⏰ Added listener for:', eventType);
    });
    
    monitoringActive = true;
    console.log('⏰ Activity monitoring started with', activityEvents.length, 'event listeners');
}

// Fungsi untuk menghentikan monitoring aktivitas
function stopActivityMonitoring() {
    // console.log('⏰ Stopping activity monitoring...');
    
    if (sessionCheckInterval) {
        clearInterval(sessionCheckInterval);
        sessionCheckInterval = null;
    }
    
    const activityEvents = [
        'mousedown', 'mousemove', 'keydown', 'scroll',
        'touchstart', 'click', 'wheel', 'input'
    ];
    
    activityEvents.forEach(eventType => {
        document.removeEventListener(eventType, resetActivityTimer);
        // console.log('⏰ Removed listener for:', eventType);
    });
    
    monitoringActive = false;
    console.log('⏰ Activity monitoring stopped');
}

// Fungsi debug untuk cek status
function checkMonitoringStatus() {
    console.log('=== MONITORING STATUS ===');
    console.log('Current user:', currentUser?.username);
    console.log('Has token:', !!currentToken);
    console.log('Monitoring active:', monitoringActive);
    console.log('Session timeout:', SESSION_TIMEOUT / 1000, 'seconds');
    console.log('Last activity:', new Date(lastActivityTime).toLocaleTimeString());
    console.log('Interval active:', sessionCheckInterval ? 'Yes' : 'No');
    
    const elapsed = (Date.now() - lastActivityTime) / 1000;
    console.log('Time since last activity:', Math.round(elapsed), 'seconds');
    
    if (elapsed > SESSION_TIMEOUT / 1000) {
        console.log('⚠️ SHOULD BE LOGGED OUT!');
    } else {
        const remaining = (SESSION_TIMEOUT / 1000) - elapsed;
        console.log('⏰ Time remaining:', Math.round(remaining), 'seconds');
    }
    console.log('=========================');
}


// =============== HELPER FUNCTIONS UNTUK GROUP ===============

// Safe JSON parse untuk other_user
function safeParseOtherUser(data) {
    if (!data) return null;
    if (typeof data === 'object') return data;
    if (typeof data !== 'string') return null;
    
    try {
        return JSON.parse(data);
    } catch (e) {
        console.warn('Failed to parse other_user:', data.substring(0, 50));
        return null;
    }
}

// Validasi room apakah benar group room
function isValidGroupRoom(room) {
    if (!room) return false;
    
    // Prioritas 1: group_id harus ada dan valid
    if (room.group_id != null && parseInt(room.group_id) > 0) {
        return true;
    }
    
    // Prioritas 2: cek tipe room
    if (room.room_type && String(room.room_type).toLowerCase() === 'group') {
        return true;
    }
    
    // Prioritas 3: cek flag is_group
    if (room.is_group === true) {
        return true;
    }
    
    // Prioritas 4: cek dari participant_count (group biasanya > 2)
    if (room.participant_count > 2 && !room.other_user) {
        return true;
    }
    
    return false;
}

// Mendapatkan nama group dari ID
function getGroupNameFromId(groupId) {
    if (!groupId) return 'Group Chat';
    
    const group = Array.isArray(groups) ? groups.find(g => String(g.id) === String(groupId)) : null;
    return group?.name || group?.group_name || `Group #${groupId}`;
}

// Debounce function untuk search
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// =============== DOM ELEMENTS ===============
const app = document.getElementById('app');
const loadingScreen = document.getElementById('loadingScreen');
const notificationContainer = document.getElementById('notificationContainer');

// =============== EMOJI LIST ===============
const emojiList = [
    '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇',
    '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚',
    '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🥸',
    '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️',
    '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡',
    '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓',
    '🤗', '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄',
    '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵',
    '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠',
    '😈', '👿', '👹', '👺', '💀', '👻', '👽', '👾', '🤖', '🎃',
    '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾', '💋',
    '👋', '🤚', '🖐', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞',
    '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍',
    '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝',
    '🙏', '✍️', '💅', '🤳', '💪', '🦾', '🦵', '🦿', '🦶', '👣',
    '👂', '🦻', '👃', '🧠', '🫀', '🫁', '🦷', '🦴', '👀', '👁',
    '👅', '👄', '💋', '🩸', '💧', '💦', '💤', '💨', '💫', '💥'
];

// =============== INITIALIZATION ===============
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 TaskBot Pro Initializing...');
    
    // Load audio preference
    loadAudioPreference();
    
    // Initialize notification audio
    setTimeout(() => {
        initNotificationAudio();
    }, 1000);
    
    // Enable audio on first user interaction
    document.addEventListener('click', function enableAudioOnFirstClick() {
        console.log('👆 User clicked, enabling audio...');
        enableAudio();
        document.removeEventListener('click', enableAudioOnFirstClick);
    }, { once: true });
    
    // Check saved token
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    
    if (savedToken && savedUser) {
        try {
            currentToken = savedToken;
            currentUser = JSON.parse(savedUser);
            
            const isValid = await verifyToken();
            if (isValid) {
                // ===== MULAI MONITORING =====
                console.log('🔄 Valid token found, starting monitoring');
                startActivityMonitoring();
                // ============================
                
                const profilePicUrl = await getProfilePictureUrlFixed(currentUser.id);
                currentUser.profile_picture_url = profilePicUrl;
                localStorage.setItem('user', JSON.stringify(currentUser));
                
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
    
    setTimeout(() => {
        if (loadingScreen) {
            loadingScreen.style.opacity = '0';
            setTimeout(() => {
                loadingScreen.style.display = 'none';
            }, 500);
        }
    }, 1000);
    
    loadTheme();
});

// Fungsi untuk mengecek status monitoring
function checkMonitoringStatus() {
    console.log('=== MONITORING STATUS ===');
    console.log('Session timeout:', SESSION_TIMEOUT / 1000, 'seconds');
    console.log('Last activity:', new Date(lastActivityTime).toLocaleTimeString());
    console.log('Interval active:', sessionCheckInterval ? 'Yes' : 'No');
    
    const elapsed = (Date.now() - lastActivityTime) / 1000;
    console.log('Time since last activity:', Math.round(elapsed), 'seconds');
    
    if (elapsed > SESSION_TIMEOUT / 1000) {
        console.log('⚠️ SHOULD BE LOGGED OUT!');
    } else {
        const remaining = (SESSION_TIMEOUT / 1000) - elapsed;
        console.log('⏰ Time remaining:', Math.round(remaining), 'seconds');
    }
    console.log('=========================');
}

// Panggil fungsi ini dari console browser untuk debug
// ketik: checkMonitoringStatus()

// =============== AUDIO NOTIFICATION SYSTEM ===============

function initNotificationAudio() {
    try {
        notificationAudio = new Audio('/audio/ping.mp3');
        notificationAudio.preload = 'auto';
        notificationAudio.volume = 0.5;
        
        notificationAudio.load();
        console.log('✅ Audio object created');
        
        notificationAudio.addEventListener('canplaythrough', () => {
            console.log('✅ Audio loaded successfully');
        });
        
        notificationAudio.addEventListener('error', (e) => {
            console.error('❌ Audio error:', e);
        });
        
        const playPromise = notificationAudio.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                notificationAudio.pause();
                notificationAudio.currentTime = 0;
                console.log('✅ Audio notification initialized and ready');
                audioEnabled = true;
            }).catch(error => {
                console.log('⚠️ Audio autoplay blocked:', error);
                audioEnabled = false;
            });
        }
    } catch (error) {
        console.error('❌ Failed to initialize audio:', error);
        notificationAudio = null;
        audioEnabled = false;
    }
}

function playNotificationSound() {
    if (!audioEnabled || !notificationAudio) {
        console.log('🔇 Audio is disabled or not initialized');
        return;
    }
    
    try {
        const audioClone = notificationAudio.cloneNode();
        audioClone.volume = 0.5;
        audioClone.currentTime = 0;
        
        const playPromise = audioClone.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                console.log('🔔 Notification sound played');
                setTimeout(() => {
                    audioClone.pause();
                    audioClone.remove();
                }, 1000);
            }).catch(error => {
                console.log('⚠️ Cannot play audio automatically:', error);
            });
        }
    } catch (error) {
        console.error('❌ Error playing notification sound:', error);
    }
}

function testNotificationSound() {
    if (!notificationAudio) {
        console.log('🔇 Audio not initialized, creating new...');
        try {
            notificationAudio = new Audio('/audio/ping.mp3');
            notificationAudio.load();
        } catch (e) {
            console.error('❌ Failed to create audio:', e);
            showNotification('❌ Gagal memuat file audio', 'error');
            return;
        }
    }
    
    audioEnabled = true;
    playNotificationSound();
    showNotification('🔊 Testing notification sound...', 'info');
}

function enableAudio() {
    audioEnabled = true;
    console.log('✅ Audio enabled');
    if (notificationAudio) {
        testNotificationSound();
    }
}

function loadAudioPreference() {
    const saved = localStorage.getItem('audioEnabled');
    if (saved !== null) {
        audioEnabled = saved === 'true';
    }
    console.log('🎵 Audio preference loaded:', audioEnabled ? 'enabled' : 'disabled');
}

function saveAudioPreference() {
    localStorage.setItem('audioEnabled', audioEnabled ? 'true' : 'false');
    console.log('🎵 Audio preference saved:', audioEnabled ? 'enabled' : 'disabled');
}

function toggleAudio() {
    audioEnabled = !audioEnabled;
    
    if (audioEnabled) {
        testNotificationSound();
        showNotification('🔊 Notifikasi suara diaktifkan', 'success');
    } else {
        showNotification('🔇 Notifikasi suara dimatikan', 'info');
    }
    
    const audioToggle = document.getElementById('audioToggle');
    if (audioToggle) {
        audioToggle.checked = audioEnabled;
    }
    
    saveAudioPreference();
}

// =============== NOTIFICATION SYSTEM ===============

const notificationCache = {};

function showNotification(message, type = 'info') {
    if (!notificationContainer) return;
    
    const key = `${message}_${type}`;
    if (notificationCache[key]) {
        const lastTime = notificationCache[key];
        if (Date.now() - lastTime < 1000) {
            console.log('Duplicate notification prevented');
            return;
        }
    }
    notificationCache[key] = Date.now();
    
    setTimeout(() => {
        delete notificationCache[key];
    }, 2000);
    
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

// =============== DESKTOP NOTIFICATIONS ===============

function toggleDesktopNotifications() {
    if (!("Notification" in window)) {
        showNotification('❌ Browser tidak mendukung desktop notifications', 'error');
        return;
    }
    
    if (Notification.permission === "granted") {
        localStorage.setItem('desktopEnabled', 
            localStorage.getItem('desktopEnabled') !== 'true' ? 'true' : 'false'
        );
        showNotification('💻 Desktop notifications ' + 
            (localStorage.getItem('desktopEnabled') === 'true' ? 'diaktifkan' : 'dimatikan'), 
            'info');
    } else if (Notification.permission !== "denied") {
        Notification.requestPermission().then(permission => {
            if (permission === "granted") {
                localStorage.setItem('desktopEnabled', 'true');
                showNotification('💻 Desktop notifications diaktifkan', 'success');
                
                new Notification('TaskBot Pro', {
                    body: 'Desktop notifications aktif!',
                    icon: 'https://cdn-icons-png.flaticon.com/512/2111/2111646.png'
                });
            }
        });
    }
}

const originalShowNotification = showNotification;
showNotification = function(message, type = 'info') {
    originalShowNotification(message, type);
    
    if (localStorage.getItem('desktopEnabled') === 'true' && 
        Notification.permission === "granted" && 
        document.visibilityState !== 'visible') {
        
        const icon = type === 'success' ? '✅' : 
                    type === 'error' ? '❌' : 
                    type === 'warning' ? '⚠️' : 'ℹ️';
        
        new Notification('TaskBot Pro', {
            body: `${icon} ${message}`,
            icon: 'https://cdn-icons-png.flaticon.com/512/2111/2111646.png'
        });
    }
};

// =============== AUTHENTICATION ===============

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
            
            // ===== RESET AKTIVITAS =====
            resetActivityTimer();
            console.log('⏰ Token verified, activity timer reset');
            // ============================
            
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

async function handleLogin(e) {
    e.preventDefault();
    
    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const btnText = submitBtn.querySelector('span');
    const btnLoader = submitBtn.querySelector('.btn-loader');
    
    // UI Loading
    if (btnText) btnText.style.opacity = '0';
    if (btnLoader) btnLoader.style.display = 'inline-flex';
    submitBtn.disabled = true;
    
    const formData = new FormData(form);
    const username = formData.get('username');
    const password = formData.get('password');
    
    // Validasi input
    if (!username || !password) {
        showNotification('❌ Username dan password harus diisi', 'error');
        resetLoginButton(submitBtn, btnText, btnLoader);
        return;
    }
    
    showNotification('🔄 Logging in...', 'info');
    
    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();
        
        // Reset button state dulu
        resetLoginButton(submitBtn, btnText, btnLoader);

        // CEK RESPONSE 403 (PERLU VERIFIKASI)
        if (response.status === 403 && data.needs_verification) {
            showNotification('🔐 Akun perlu diverifikasi via Telegram', 'warning');
            showVerificationModal(data.user_id, username);
            form.classList.add('shake');
            setTimeout(() => form.classList.remove('shake'), 500);
            return;
        }

        if (!response.ok) {
            showNotification('❌ ' + (data.error || data.message || `Login gagal (${response.status})`), 'error');
            form.classList.add('shake');
            setTimeout(() => form.classList.remove('shake'), 500);
            return;
        }
        
        if (data.success) {
            currentToken = data.token;
            currentUser = data.user;
            
            // Simpan ke localStorage
            localStorage.setItem('token', currentToken);
            localStorage.setItem('user', JSON.stringify(currentUser));
            saveLastLoginUser(username);
            
            showNotification('✅ Login berhasil! Selamat datang ' + (currentUser.full_name || currentUser.username), 'success');
            
            // Inisialisasi socket
            initSocket();
            
            // ===== PASTIKAN MONITORING DIMULAI =====
            console.log('🚀 Login success, starting activity monitoring...');
            // Hentikan monitoring yang mungkin masih berjalan
            stopActivityMonitoring();
            // Mulai monitoring baru
            startActivityMonitoring();
            // ========================================
            
            renderDashboard();
            loadAnnouncements();
        } else {
            showNotification('❌ ' + (data.error || 'Login gagal'), 'error');
            form.classList.add('shake');
            setTimeout(() => form.classList.remove('shake'), 500);
        }
    } catch (error) {
        console.error('Login error detail:', error);
        showNotification('❌ Gagal terhubung ke server - ' + error.message, 'error');
        resetLoginButton(submitBtn, btnText, btnLoader);
        
        form.classList.add('shake');
        setTimeout(() => form.classList.remove('shake'), 500);
    }
}

// =============== Helper function untuk reset button ===============
function resetLoginButton(btn, btnText, btnLoader) {
    if (btnText) btnText.style.opacity = '1';
    if (btnLoader) btnLoader.style.display = 'none';
    if (btn) btn.disabled = false;
}

// =============== SAVE LAST LOGIN USER ===============
function saveLastLoginUser(username) {
    localStorage.setItem('lastLoginUser', JSON.stringify({ username }));
}

// =============== SHOW VERIFICATION MODAL (UPDATED) ===============
function showVerificationModal(userId, email) {
    const existingModal = document.querySelector('.modal.active');
    if (existingModal) existingModal.remove();
    
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 500px;">
            <div class="modal-header">
                <h3><i class="fab fa-telegram"></i> Verifikasi Akun</h3>
                <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <div style="text-align: center; margin-bottom: 20px;">
                    <i class="fab fa-telegram" style="font-size: 64px; color: #0088cc; margin-bottom: 15px;"></i>
                    <h4 style="margin-bottom: 10px;">Akun Perlu Diverifikasi</h4>
                    <p style="color: var(--text-secondary); margin-bottom: 20px;">
                        Untuk keamanan, akun Anda perlu diverifikasi melalui Telegram sebelum dapat login.
                    </p>
                </div>
                
                <div class="verification-steps" style="background: var(--bg-hover); padding: 20px; border-radius: var(--radius-lg); margin-bottom: 25px; border: 2px solid var(--border);">
                    <h5 style="display: flex; align-items: center; gap: 8px; margin-bottom: 15px; color: var(--primary);">
                        <i class="fas fa-list-ol"></i> Langkah-langkah Verifikasi:
                    </h5>
                    
                    <div class="step-item" style="display: flex; gap: 12px; margin-bottom: 15px; align-items: flex-start;">
                        <div style="background: var(--primary); color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; flex-shrink: 0;">1</div>
                        <div>
                            <strong>Buka Telegram</strong>
                            <p style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">Cari bot <strong>@newregistrasiBot</strong> atau klik link berikut:</p>
                            <a href="https://t.me/newregistrasiBot" target="_blank" style="display: inline-block; margin-top: 5px; padding: 6px 12px; background: #0088cc; color: white; border-radius: var(--radius-full); text-decoration: none; font-size: 12px;">
                                <i class="fab fa-telegram"></i> @newregistrasiBot
                            </a>
                        </div>
                    </div>
                    
                    <div class="step-item" style="display: flex; gap: 12px; margin-bottom: 15px;">
                        <div style="background: var(--primary); color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; flex-shrink: 0;">2</div>
                        <div>
                            <strong>Kirim perintah /verify</strong>
                            <p style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">Bot akan meminta email Anda</p>
                        </div>
                    </div>
                    
                    <div class="step-item" style="display: flex; gap: 12px; margin-bottom: 15px;">
                        <div style="background: var(--primary); color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; flex-shrink: 0;">3</div>
                        <div>
                            <strong>Masukkan email Anda</strong>
                            <p style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">Gunakan email: <strong>${escapeHtml(email)}</strong></p>
                            <div style="background: var(--bg-card); padding: 8px; border-radius: var(--radius-sm); margin-top: 5px; font-family: monospace; border: 1px dashed var(--primary);">
                                ${escapeHtml(email)}
                            </div>
                        </div>
                    </div>
                    
                    <div class="step-item" style="display: flex; gap: 12px;">
                        <div style="background: var(--primary); color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; flex-shrink: 0;">4</div>
                        <div>
                            <strong>Bot akan mengirim kode 6 digit</strong>
                            <p style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">Masukkan kode di bawah ini</p>
                        </div>
                    </div>
                </div>
                
                <div class="verification-code-input" style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">
                        <i class="fas fa-key"></i> Masukkan Kode Verifikasi:
                    </label>
                    <input type="text" id="verificationCode" maxlength="6" 
                        placeholder="6 digit kode" 
                        style="text-align: center; font-size: 28px; letter-spacing: 8px; width: 100%; padding: 15px; background: var(--bg-input); border: 3px solid var(--border); border-radius: var(--radius-lg); font-weight: bold;"
                        onkeypress="if(event.key === 'Enter') verifyTelegramCode(${userId}, this.value)">
                </div>
                
                <div class="verification-timer" style="text-align: center; margin-bottom: 20px; padding: 10px; background: rgba(181, 139, 91, 0.1); border-radius: var(--radius-md);">
                    <i class="fas fa-clock"></i> 
                    <span id="verificationTimer">Kode berlaku 10 menit</span>
                </div>
                
                <div style="display: flex; gap: 12px;">
                    <button
                        onclick="verifyTelegramCode(${userId}, document.getElementById('verificationCode').value)"
                        class="auth-btn"
                        style="flex: 2;"
                    >
                        <i class="fas fa-check-circle"></i> Verifikasi
                    </button>
                    <button onclick="this.closest('.modal').remove()" class="auth-btn secondary" style="flex: 1;">
                        Tutup
                    </button>
                </div>
                
                <div style="margin-top: 15px; text-align: center;">
                    <button onclick="resendVerificationCode(${userId})" class="btn-link" style="background: none; border: none; color: var(--primary); text-decoration: underline; cursor: pointer; font-size: 13px;">
                        <i class="fas fa-redo-alt"></i> Kirim ulang kode?
                    </button>
                </div>
                
                <p style="margin-top: 20px; font-size: 12px; color: var(--text-muted); text-align: center; padding-top: 15px; border-top: 1px solid var(--border);">
                    <i class="fas fa-info-circle"></i>
                    Kode verifikasi hanya berlaku 10 menit. Jika tidak menerima kode, pastikan Anda sudah chat dengan bot.
                </p>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Auto focus ke input kode
    setTimeout(() => {
        document.getElementById('verificationCode')?.focus();
    }, 500);
}

// =============== RESEND VERIFICATION CODE ===============
async function resendVerificationCode(userId) {
    try {
        showNotification('🔄 Mengirim ulang kode verifikasi...', 'info');
        
        // Panggil API untuk resend code
        const response = await fetch('/api/auth/resend-verification', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ user_id: userId })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('✅ Kode verifikasi telah dikirim ulang ke Telegram', 'success');
            
            // Update timer
            const timerEl = document.getElementById('verificationTimer');
            if (timerEl) {
                timerEl.innerHTML = 'Kode baru telah dikirim';
                setTimeout(() => {
                    timerEl.innerHTML = 'Kode berlaku 10 menit';
                }, 3000);
            }
        } else {
            showNotification('❌ ' + (data.error || 'Gagal mengirim ulang kode'), 'error');
        }
    } catch (error) {
        console.error('Resend code error:', error);
        showNotification('❌ Gagal mengirim ulang kode', 'error');
    }
}

// =============== VERIFY TELEGRAM CODE (UPDATED) ===============
async function verifyTelegramCode(userId, code) {
    if (!code || code.length !== 6) {
        showNotification('❌ Masukkan 6 digit kode verifikasi', 'error');
        return false;
    }
    
    // Validasi hanya angka
    if (!/^\d+$/.test(code)) {
        showNotification('❌ Kode hanya boleh berisi angka', 'error');
        return false;
    }
    
    const verifyBtn = document.querySelector('.modal.active .auth-btn:first-of-type');
    const originalText = verifyBtn?.innerHTML;
    if (verifyBtn) {
        verifyBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memverifikasi...';
        verifyBtn.disabled = true;
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
        
        if (verifyBtn) {
            verifyBtn.innerHTML = originalText;
            verifyBtn.disabled = false;
        }
        
        if (data.success) {
            showNotification('✅ Akun berhasil diverifikasi! Silakan login.', 'success');
            
            const modal = document.querySelector('.modal.active');
            if (modal) modal.remove();
            
            // Auto-fill username di form login
            const loginForm = document.getElementById('loginForm');
            if (loginForm) {
                const usernameInput = loginForm.querySelector('input[name="username"]');
                if (usernameInput) {
                    // Coba ambil username dari localStorage atau dari user yang login sebelumnya
                    const lastUser = JSON.parse(localStorage.getItem('lastLoginUser') || '{}');
                    if (lastUser.username) {
                        usernameInput.value = lastUser.username;
                    }
                }
                
                // Focus ke password
                setTimeout(() => {
                    const passwordInput = loginForm.querySelector('input[name="password"]');
                    if (passwordInput) passwordInput.focus();
                }, 500);
            }
            
            return true;
        } else {
            showNotification('❌ ' + (data.error || 'Kode tidak valid'), 'error');
            
            // Highlight input kode merah
            const codeInput = document.getElementById('verificationCode');
            if (codeInput) {
                codeInput.classList.add('error');
                codeInput.value = '';
                codeInput.focus();
                setTimeout(() => codeInput.classList.remove('error'), 500);
            }
            
            return false;
        }
    } catch (error) {
        console.error('Verification error:', error);
        showNotification('❌ Gagal verifikasi: ' + error.message, 'error');
        
        if (verifyBtn) {
            verifyBtn.innerHTML = originalText;
            verifyBtn.disabled = false;
        }
        
        return false;
    }
}

// =============== TAMBAHKAN CSS UNTUK VERIFICATION MODAL ===============
const verificationStyle = document.createElement('style');
verificationStyle.textContent = `
    .verification-steps {
        animation: slideDown 0.3s ease;
    }
    
    .step-item {
        transition: all 0.2s ease;
    }
    
    .step-item:hover {
        transform: translateX(5px);
    }
    
    .verification-code-input input {
        transition: all 0.3s ease;
    }
    
    .verification-code-input input:focus {
        border-color: var(--primary) !important;
        box-shadow: 0 0 0 4px rgba(181, 139, 91, 0.2);
        transform: scale(1.02);
    }
    
    .verification-code-input input.error {
        border-color: var(--danger) !important;
        animation: shake 0.5s ease;
    }
    
    .btn-link {
        background: none;
        border: none;
        color: var(--primary);
        text-decoration: underline;
        cursor: pointer;
        font-size: 13px;
        padding: 5px 10px;
        border-radius: var(--radius-sm);
        transition: all 0.2s ease;
    }
    
    .btn-link:hover {
        background: rgba(181, 139, 91, 0.1);
        text-decoration: none;
    }
    
    .btn-link:active {
        transform: scale(0.95);
    }
    
    .verification-timer {
        animation: pulse 2s infinite;
    }
    
    @keyframes slideDown {
        from {
            opacity: 0;
            transform: translateY(-20px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
    
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
        20%, 40%, 60%, 80% { transform: translateX(5px); }
    }
`;
document.head.appendChild(verificationStyle);

// =============== ESC KEY HANDLER ===============
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        // Cek apakah sedang di chat room
        if (currentChatRoom) {
            e.preventDefault();
            closeChatRoom();
            // showNotification('👋 Keluar dari percakapan', 'info');
        }
        
        // Tutup modal yang aktif jika ada
        const activeModal = document.querySelector('.modal.active');
        if (activeModal) {
            activeModal.remove();
        }
    }
});

// Helper function untuk reset button
function resetLoginButton(btn, btnText, btnLoader) {
    if (btnText) btnText.style.opacity = '1';
    if (btnLoader) btnLoader.style.display = 'none';
    if (btn) btn.disabled = false;
}

async function handleRegister(e) {
    e.preventDefault();
    
    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const btnText = submitBtn.querySelector('span');
    const btnLoader = submitBtn.querySelector('.btn-loader');
    
    if (btnText) btnText.style.opacity = '0';
    if (btnLoader) btnLoader.style.display = 'inline-flex';
    submitBtn.disabled = true;
    
    const formData = new FormData(form);
    const data = {
        username: formData.get('username'),
        email: formData.get('email'),
        password: formData.get('password'),
        full_name: formData.get('full_name'),
        telegram_chat_id: formData.get('telegram_chat_id') || null
    };
    
    const confirmPassword = formData.get('confirm_password');
    
    if (data.password !== confirmPassword) {
        showNotification('❌ Password tidak cocok', 'error');
        
        if (btnText) btnText.style.opacity = '1';
        if (btnLoader) btnLoader.style.display = 'none';
        submitBtn.disabled = false;
        
        document.querySelector('input[name="confirm_password"]').classList.add('error');
        setTimeout(() => document.querySelector('input[name="confirm_password"]').classList.remove('error'), 500);
        return;
    }
    
    if (data.password.length < 6) {
        showNotification('❌ Password minimal 6 karakter', 'error');
        
        if (btnText) btnText.style.opacity = '1';
        if (btnLoader) btnLoader.style.display = 'none';
        submitBtn.disabled = false;
        
        document.querySelector('input[name="password"]').classList.add('error');
        setTimeout(() => document.querySelector('input[name="password"]').classList.remove('error'), 500);
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
        
        if (btnText) btnText.style.opacity = '1';
        if (btnLoader) btnLoader.style.display = 'none';
        submitBtn.disabled = false;
        
        if (result.success) {
            showNotification('✅ ' + result.message, 'success');
            
            form.reset();
            
            const authFormContainer = document.getElementById('authFormContainer');
            authFormContainer.innerHTML = `
                <div class="auth-success">
                    <i class="fas fa-check-circle"></i>
                    <h3>Registrasi Berhasil!</h3>
                    <p>Silakan verifikasi akun Anda via Telegram</p>
                    <button class="auth-btn" onclick="showVerificationModal(${result.user_id})">
                        <i class="fas fa-check"></i>
                        <span>Verifikasi Sekarang</span>
                    </button>
                </div>
            `;
        } else {
            showNotification('❌ ' + (result.error || 'Registrasi gagal'), 'error');
            
            form.classList.add('shake');
            setTimeout(() => form.classList.remove('shake'), 500);
        }
    } catch (error) {
        if (btnText) btnText.style.opacity = '1';
        if (btnLoader) btnLoader.style.display = 'none';
        submitBtn.disabled = false;
        
        console.error('Register error:', error);
        showNotification('❌ Gagal terhubung ke server', 'error');
        
        form.classList.add('shake');
        setTimeout(() => form.classList.remove('shake'), 500);
    }
}

function switchAuthTab(tab) {
    const container = document.getElementById('authFormContainer');
    if (!container) return;
    
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    if (event && event.target) {
        event.target.classList.add('active');
    }
    
    container.style.opacity = '0';
    container.style.transform = 'translateY(10px)';
    
    setTimeout(() => {
        if (tab === 'login') {
            container.innerHTML = `
                <form id="loginForm" class="auth-form">
                    <div class="form-group">
                        <label><i class="fas fa-user"></i> Username / Email</label>
                        <input type="text" name="username" required placeholder="Masukkan username atau email" autocomplete="username">
                    </div>
                    <div class="form-group">
                        <label><i class="fas fa-lock"></i> Password</label>
                        <div class="password-field">
                            <input type="password" name="password" required placeholder="Masukkan password" autocomplete="current-password">
                            <button type="button" class="password-toggle" onclick="togglePassword(this)">
                                <i class="fas fa-eye"></i>
                            </button>
                        </div>
                    </div>
                    <button type="submit" class="auth-btn">
                        <i class="fas fa-sign-in-alt"></i>
                        <span>Login</span>
                        <div class="btn-loader" style="display: none;">
                            <div class="loader-dot"></div>
                            <div class="loader-dot"></div>
                            <div class="loader-dot"></div>
                        </div>
                    </button>
                </form>
            `;
            document.getElementById('loginForm')?.addEventListener('submit', handleLogin);
        } else {
            container.innerHTML = `
                <form id="registerForm" class="auth-form">
                    <div class="form-group">
                        <label><i class="fas fa-user-circle"></i> Nama Lengkap <span class="required">*</span></label>
                        <input type="text" name="full_name" required placeholder="Masukkan nama lengkap" autocomplete="name">
                    </div>
                    <div class="form-group">
                        <label><i class="fas fa-user"></i> Username <span class="required">*</span></label>
                        <input type="text" name="username" required placeholder="Minimal 3 karakter" autocomplete="username">
                        <small class="form-text">Hanya huruf, angka, dan underscore</small>
                    </div>
                    <div class="form-group">
                        <label><i class="fas fa-envelope"></i> Email <span class="required">*</span></label>
                        <input type="email" name="email" required placeholder="Masukkan email" autocomplete="email">
                    </div>
                    <div class="form-group">
                        <label><i class="fas fa-lock"></i> Password <span class="required">*</span></label>
                        <div class="password-field">
                            <input type="password" name="password" required placeholder="Minimal 6 karakter" autocomplete="new-password">
                            <button type="button" class="password-toggle" onclick="togglePassword(this)">
                                <i class="fas fa-eye"></i>
                            </button>
                        </div>
                    </div>
                    <div class="form-group">
                        <label><i class="fas fa-lock"></i> Konfirmasi Password <span class="required">*</span></label>
                        <div class="password-field">
                            <input type="password" name="confirm_password" required placeholder="Ulangi password" autocomplete="new-password">
                            <button type="button" class="password-toggle" onclick="togglePassword(this)">
                                <i class="fas fa-eye"></i>
                            </button>
                        </div>
                    </div>
                    <div class="form-group">
                        <label><i class="fab fa-telegram"></i> Telegram Chat ID</label>
                        <input type="text" name="telegram_chat_id" placeholder="Untuk verifikasi & notifikasi">
                        <small class="form-text">
                            <i class="fas fa-info-circle"></i> 
                            Dapatkan Chat ID dari @userinfobot di Telegram
                        </small>
                    </div>
                    <button type="submit" class="auth-btn">
                        <i class="fas fa-user-plus"></i>
                        <span>Register</span>
                        <div class="btn-loader" style="display: none;">
                            <div class="loader-dot"></div>
                            <div class="loader-dot"></div>
                            <div class="loader-dot"></div>
                        </div>
                    </button>
                </form>
            `;
            document.getElementById('registerForm')?.addEventListener('submit', handleRegister);
        }
        
        setTimeout(() => {
            container.style.opacity = '1';
            container.style.transform = 'translateY(0)';
        }, 50);
    }, 200);
}

// Tambahkan di bagian style (dalam script.js)
const avatarStyle = document.createElement('style');
avatarStyle.textContent = `
    .chat-room-avatar img, 
    .chat-avatar-img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        border-radius: 50%;
    }
    
    .chat-room-avatar {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, var(--primary), var(--secondary));
        color: white;
        font-size: 24px;
    }
    
    .chat-room-avatar i {
        font-size: 24px;
        color: white;
    }
`;
document.head.appendChild(avatarStyle);

// Tambahkan CSS untuk animasi shake
const style = document.createElement('style');
style.textContent = `
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
        20%, 40%, 60%, 80% { transform: translateX(5px); }
    }
    
    .shake {
        animation: shake 0.5s ease;
    }
    
    input.error {
        border-color: var(--danger) !important;
        box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.15) !important;
    }

    /* Emoji Picker Styles */
    .emoji-picker {
        position: absolute;
        bottom: 100%;
        left: 0;
        width: 300px;
        height: 200px;
        background: var(--bg-card);
        border: 2px solid var(--border);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-lg);
        display: grid;
        grid-template-columns: repeat(8, 1fr);
        gap: 5px;
        padding: 10px;
        overflow-y: auto;
        z-index: 1000;
        margin-bottom: 10px;
    }

    .emoji-item {
        font-size: 20px;
        padding: 5px;
        text-align: center;
        cursor: pointer;
        border-radius: var(--radius-sm);
        transition: all 0.2s ease;
    }

    .emoji-item:hover {
        background: var(--bg-hover);
        transform: scale(1.2);
    }

    /* Reply Message Styles */
    .reply-preview {
        background: var(--bg-hover);
        border-left: 4px solid var(--primary);
        padding: 10px;
        margin-bottom: 10px;
        border-radius: var(--radius-md);
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 12px;
    }

    .reply-preview .reply-info {
        flex: 1;
    }

    .reply-preview .reply-sender {
        font-weight: 700;
        color: var(--primary);
        margin-right: 5px;
    }

    .reply-preview .reply-message {
        color: var(--text-secondary);
    }

    .reply-preview .cancel-reply {
        background: none;
        border: none;
        color: var(--danger);
        cursor: pointer;
        padding: 5px;
    }

    .reply-preview .cancel-reply:hover {
        transform: scale(1.1);
    }

    .message.replying {
        background: rgba(181, 139, 91, 0.1);
        border-left: 4px solid var(--primary);
    }

    .message .reply-to {
        font-size: 11px;
        color: var(--text-muted);
        margin-bottom: 5px;
        padding: 5px;
        background: rgba(0,0,0,0.05);
        border-radius: var(--radius-sm);
        border-left: 3px solid var(--primary);
        cursor: pointer;
    }

    .message .reply-to:hover {
        opacity: 0.8;
        text-decoration: underline;
    }

    .message .reply-to .reply-sender {
        font-weight: 700;
        color: var(--primary);
    }

    .message.own .reply-to {
        background: rgba(255,255,255,0.1);
    }

    .message.own .reply-to .reply-sender {
        color: var(--primary-light);
    }

    /* Message Actions */
    .message-actions {
        position: absolute;
        top: -20px;
        right: 0;
        display: none;
        gap: 5px;
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: var(--radius-full);
        padding: 3px;
        box-shadow: var(--shadow-md);
        z-index: 10;
    }

    .message:hover .message-actions {
        display: flex;
    }

    .message-actions .action-btn {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: transparent;
        border: none;
        color: var(--text-secondary);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
    }

    .message-actions .action-btn:hover {
        background: var(--primary);
        color: white;
    }

    .message {
        position: relative;
    }

    /* Edit Message Styles */
    .edit-message-input {
        width: 100%;
        padding: 8px;
        background: var(--bg-input);
        border: 2px solid var(--primary);
        border-radius: var(--radius-md);
        color: var(--text-primary);
        font-family: inherit;
        font-size: 13px;
        resize: none;
    }

    .edited-indicator {
        font-size: 10px;
        opacity: 0.7;
        margin-left: 4px;
        font-style: italic;
    }

    /* Message Status */
    .message-status.read i {
        color: var(--primary);
    }
    .message-status.delivered i {
        color: var(--text-muted);
    }
    .message-status.sent i {
        color: var(--text-muted);
    }

    /* Chat Room Status */
    .chat-room-status.online::before {
        background: var(--success);
        box-shadow: 0 0 10px var(--success);
    }
    .chat-room-status.offline::before {
        background: var(--text-muted);
    }

    /* Highlight animation */
    .message.highlight {
        animation: highlightPulse 2s ease;
    }

    @keyframes highlightPulse {
        0%, 100% { background: transparent; }
        50% { background: rgba(181, 139, 91, 0.2); }
    }
`;
document.head.appendChild(style);

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

async function handleForgotPassword(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const email = formData.get('email');
    
    if (!email) {
        showNotification('❌ Email harus diisi', 'error');
        return;
    }
    
    // Validasi email sederhana
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showNotification('❌ Format email tidak valid', 'error');
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
            // Kembali ke halaman login setelah 3 detik
            setTimeout(() => {
                showLoginPage();
            }, 3000);
        } else {
            showNotification('❌ ' + (data.error || 'Permintaan gagal'), 'error');
        }
    } catch (error) {
        console.error('Forgot password error:', error);
        showNotification('❌ Gagal terhubung ke server', 'error');
    }
}

// =============== FIXED: logout dengan cleanup ===============
// Di dalam fungsi logout
function logout() {
    console.log('🚪 Logging out...');
    
    // ===== TAMBAHKAN INI =====
    // Hentikan monitoring aktivitas
    stopActivityMonitoring();
    // ===== END TAMBAHAN =====
    
    // Hentikan interval presence
    if (presenceHeartbeatInterval) {
        clearInterval(presenceHeartbeatInterval);
        presenceHeartbeatInterval = null;
    }
    
    // Hapus dari localStorage
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('lastLoginUser');
    
    // Reset variabel
    currentToken = null;
    currentUser = null;
    
    // Disconnect socket
    if (socket) {
        socket.disconnect();
        socket = null;
    }
    
    showNotification('👋 Berhasil logout', 'info');
    showLoginPage();
}

// =============== SOCKET.IO ===============

function initSocket() {
    // VALIDASI: Pastikan ada token dan user
    if (!currentToken || !currentUser) {
        console.log('No token/user, skipping socket init');
        return;
    }
    
    if (typeof io === 'undefined') {
        console.log('⚠️ Socket.IO not available');
        return;
    }
    
    try {
        if (socket) {
            socket.removeAllListeners();
            socket.disconnect();
        }
        
        socket = io();
        
        socket.on('connect', () => {
            console.log('🔌 Socket connected');
            if (currentUser && currentUser.id) {
                socket.emit('join', currentUser.id);
                
                // Set online status - dengan pengecekan token
                if (currentToken) {
                    fetch('/api/user/presence', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${currentToken}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ status: 'online' })
                    }).catch(err => console.log('Presence error:', err.message));
                }
            }
        });
        
        socket.on('task_created', (task) => {
            console.log('🔔 New task created:', task);
            playNotificationSound();
            showNotification('📦 Task baru: ' + task.title, 'info');
            if (currentView === 'dashboard' || currentView === 'tasks' || currentView === 'myTasks') {
                loadTasks();
            }
        });
        
        socket.on('task_updated', (data) => {
            console.log('🔔 Task updated:', data);
            playNotificationSound();
            if (currentView === 'dashboard' || currentView === 'tasks' || currentView === 'myTasks') {
                loadTasks();
            }
        });
        
        socket.on('task_approved', (data) => {
            console.log('🔔 Task approved:', data);
            playNotificationSound();
            showNotification('✅ Task di-approve admin!', 'success');
            if (currentView === 'dashboard' || currentView === 'tasks' || currentView === 'myTasks') {
                loadTasks();
                loadStats();
            }
        });
        
        socket.on('task_rejected', (data) => {
            console.log('🔔 Task rejected:', data);
            playNotificationSound();
            showNotification('❌ Task ditolak', 'warning');
            if (currentView === 'dashboard' || currentView === 'tasks' || currentView === 'myTasks') {
                loadTasks();
                loadStats();
            }
        });
        
        socket.on('new_message', (data) => {
            console.log('🔔 New message received:', data);
            
            playNotificationSound();
            
            // Validasi data
            if (!data || !data.message) {
                console.error('Invalid message data received:', data);
                return;
            }
            
            // Validasi message ID
            if (!data.message.id || String(data.message.id).startsWith('temp-')) {
                console.warn('Received message with invalid ID:', data.message.id);
                return;
            }
            
            const notificationKey = `msg_${data.message.id}`;
            if (window[notificationKey]) {
                console.log('Duplicate notification prevented');
                return;
            }
            window[notificationKey] = true;
            setTimeout(() => delete window[notificationKey], 3000);
            
            refreshChatRooms();
            
            if (currentChatRoom && currentChatRoom.id == data.room_id) {
                const container = document.getElementById('chatMessages');
                if (container) {
                    const existingMessages = container.querySelectorAll('.message');
                    let isDuplicate = false;
                    
                    for (let i = Math.max(0, existingMessages.length - 5); i < existingMessages.length; i++) {
                        const msg = existingMessages[i];
                        const msgId = msg.getAttribute('data-message-id');
                        if (msgId == data.message.id) {
                            isDuplicate = true;
                            break;
                        }
                    }
                    
                    if (!isDuplicate) {
                        appendMessage(data.message);
                        markMessagesRead(data.room_id);
                    }
                }
            } else {
                updateRoomUnreadCount(data.room_id);
                const senderName = data.message.full_name || data.message.username || 'Seseorang';
                showNotification(`📩 Pesan baru dari ${senderName}`, 'info');
            }
            
            loadStats();
        });
        
        socket.on('user_typing', (data) => {
            if (currentChatRoom && data.user_id !== currentUser.id) {
                showTypingIndicator(data.username);
            }
        });
        
        socket.on('friend_request', (data) => {
            console.log('🔔 Friend request received:', data);
            playNotificationSound();
            showNotification(`👋 Permintaan pertemanan dari ${data.from_name}`, 'info');
            loadFriendRequests();
            loadStats();
        });
        
        socket.on('friend_accepted', (data) => {
            console.log('🔔 Friend request accepted:', data);
            playNotificationSound();
            showNotification(`✅ ${data.by_name} menerima permintaan pertemanan`, 'success');
            loadChatRooms();
            if (currentView === 'chat') {
                openChatRoom(data.room_id);
            }
        });
        
        socket.on('room_messages_deleted', (data) => {
            if (currentChatRoom && currentChatRoom.id == data.room_id) {
                clearChatMessages();
                showNotification('🗑️ Semua pesan di chat ini telah dihapus', 'warning');
            }
            refreshChatRooms();
        });
        
        socket.on('messages_read', (data) => {
            if (currentChatRoom && currentChatRoom.id == data.room_id && data.user_id !== currentUser.id) {
                updateMessageReadStatus(data.user_id, data.read_at);
            }
        });
        
        socket.on('message_edited', (data) => {
            const messageEl = document.querySelector(`[data-message-id="${data.message_id}"]`);
            if (messageEl) {
                const textEl = messageEl.querySelector('.message-text');
                if (textEl) {
                    textEl.textContent = data.message;
                    
                    // Add edited indicator if not exists
                    const timeEl = messageEl.querySelector('.message-time');
                    if (timeEl && !timeEl.querySelector('.edited-indicator')) {
                        const editedSpan = document.createElement('span');
                        editedSpan.className = 'edited-indicator';
                        editedSpan.textContent = ' (edited)';
                        editedSpan.style.fontSize = '10px';
                        editedSpan.style.opacity = '0.7';
                        editedSpan.style.marginLeft = '4px';
                        timeEl.appendChild(editedSpan);
                    }
                }
            }
        });
        
        socket.on('message_deleted', (data) => {
            const messageEl = document.querySelector(`[data-message-id="${data.message_id}"]`);
            if (messageEl) {
                messageEl.remove();
            }
            showNotification('🗑️ Sebuah pesan telah dihapus', 'info');
        });
        
        socket.on('messages_status_update', (data) => {
            if (data.user_id === currentUser.id) return;
            
            data.message_ids.forEach(msgId => {
                const messageEl = document.querySelector(`[data-message-id="${msgId}"]`);
                if (messageEl) {
                    const statusEl = messageEl.querySelector('.message-status');
                    if (statusEl) {
                        if (data.status === 'read') {
                            statusEl.innerHTML = '<i class="fas fa-check-double" style="color: var(--primary);"></i>';
                            statusEl.className = 'message-status read';
                        } else if (data.status === 'delivered') {
                            statusEl.innerHTML = '<i class="fas fa-check-double"></i>';
                            statusEl.className = 'message-status delivered';
                        }
                    }
                }
            });
        });
        
        socket.on('user_presence', (data) => {
            if (currentChatRoom) {
                const otherUser = currentChatRoom.other_user;
                // Gunakan safeId untuk akses ID dengan aman
                if (otherUser && safeId(otherUser) === data.user_id) {
                    const statusEl = document.getElementById('chatRoomStatus');
                    if (statusEl) {
                        if (data.status === 'online') {
                            statusEl.textContent = 'online';
                            statusEl.className = 'chat-room-status online';
                        } else {
                            const lastSeen = data.last_seen ? timeAgo(data.last_seen) : 'long time ago';
                            statusEl.textContent = `last seen ${lastSeen}`;
                            statusEl.className = 'chat-room-status offline';
                        }
                    }
                }
            }
        });

        // TAMBAHKAN INI!
        socket.on('rooms_need_refresh', (data) => {
    console.log('Rooms need refresh:', data);
    
    // Refresh chat rooms
    loadChatRooms();
    
    // Jika room yang sama sedang dibuka, update unread count
    if (data.reason === 'messages_read' && data.room_id) {
        // Update local unread count untuk room tertentu
        const room = chatRooms.find(r => r.id == data.room_id);
        if (room) {
            room.unread_count = 0;
            if (typeof displayChatRooms === 'function') {
                displayChatRooms();
            }
        }
    }
    
    // Update nav badge
    updateNavChatBadge();
});

        // GROUP SOCKET EVENTS
        socket.on('group_invitation', (data) => {
            console.log('🔔 Group invitation received:', data);
            playNotificationSound();
            showNotification(`👋 Undangan group dari ${data.invited_by_name}`, 'info');
            loadGroupInvitations();
        });

        socket.on('added_to_group', (data) => {
            console.log('🔔 Added to group:', data);
            playNotificationSound();
            showNotification(`✅ Anda ditambahkan ke group ${data.group_name} oleh ${data.added_by_name}`, 'success');
            loadGroups();
            if (data.group_id) {
                loadChatRooms();
            }
        });

        socket.on('removed_from_group', (data) => {
            console.log('🔔 Removed from group:', data);
            playNotificationSound();
            showNotification(`❌ Anda dihapus dari group`, 'warning');
            loadGroups();
            
            if (currentChatRoom && currentChatRoom.group_id == data.group_id) {
                closeChatRoom();
            }
        });

        socket.on('became_admin', (data) => {
            console.log('🔔 Became admin:', data);
            playNotificationSound();
            showNotification(`👑 Anda menjadi admin group`, 'success');
            loadGroups();
        });

        socket.on('disconnect', () => {
            console.log('🔌 Socket disconnected');
        });
    } catch (error) {
        console.error('Socket initialization error:', error);
    }
}

// =============== RENDER FUNCTIONS ===============

function showLoginPage() {
    currentView = 'login';
    
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
    
    const loginForm = document.getElementById('loginForm');
    if (loginForm) loginForm.addEventListener('submit', handleLogin);
}

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

function showVerificationModal(userId) {
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
                    Cek bot <strong>@newregistrasiBot</strong>
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
    
    setTimeout(() => {
        document.getElementById('verificationCode')?.focus();
    }, 500);
}

async function renderDashboard() {
    currentView = 'dashboard';
    
    if (!currentUser) {
        showLoginPage();
        return;
    }
    
    // ===== PASTIKAN MONITORING AKTIF SETIAP RENDER DASHBOARD =====
    if (!monitoringActive) {
        console.log('📊 Dashboard rendered, ensuring monitoring is active');
        startActivityMonitoring();
    } else {
        console.log('📊 Dashboard rendered, monitoring already active');
        resetActivityTimer(); // Reset timer saat render dashboard
    }
    // =============================================================
    
    showNotification('🔄 Memuat data user...', 'info');
    await loadUserProfile();
    
    if (currentUser.role === 'admin') {
        await renderAdminDashboard();
    } else {
        await renderUserDashboard();
    }
    
    loadTasks();
    loadStats();
    if (currentUser.role === 'admin') {
        loadUsers();
    }
}

async function handleLogin(e) {
    e.preventDefault();
    
    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const btnText = submitBtn.querySelector('span');
    const btnLoader = submitBtn.querySelector('.btn-loader');
    
    // UI Loading
    if (btnText) btnText.style.opacity = '0';
    if (btnLoader) btnLoader.style.display = 'inline-flex';
    submitBtn.disabled = true;
    
    const formData = new FormData(form);
    const username = formData.get('username');
    const password = formData.get('password');
    
    // Validasi input
    if (!username || !password) {
        showNotification('❌ Username dan password harus diisi', 'error');
        resetLoginButton(submitBtn, btnText, btnLoader);
        return;
    }
    
    showNotification('🔄 Logging in...', 'info');
    
    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();
        
        // Reset button state dulu
        resetLoginButton(submitBtn, btnText, btnLoader);

        // CEK RESPONSE 403 (PERLU VERIFIKASI)
        if (response.status === 403 && data.needs_verification) {
            showNotification('🔐 Akun perlu diverifikasi via Telegram', 'warning');
            
            // Tampilkan modal verifikasi dengan email user
            showVerificationModal(data.user_id, username);
            
            form.classList.add('shake');
            setTimeout(() => form.classList.remove('shake'), 500);
            return;
        }

        if (!response.ok) {
            showNotification('❌ ' + (data.error || data.message || `Login gagal (${response.status})`), 'error');
            form.classList.add('shake');
            setTimeout(() => form.classList.remove('shake'), 500);
            return;
        }
        
        if (data.success) {
            currentToken = data.token;
            currentUser = data.user;
            
            // Simpan ke localStorage
            localStorage.setItem('token', currentToken);
            localStorage.setItem('user', JSON.stringify(currentUser));
            
            // SIMPAN USERNAME TERAKHIR UNTUK AUTO-FILL
            saveLastLoginUser(username);
            
            showNotification('✅ Login berhasil! Selamat datang ' + (currentUser.full_name || currentUser.username), 'success');
            
            // Inisialisasi socket dan render dashboard
            initSocket();
            renderDashboard();
            
            // ===== TAMBAHKAN INI =====
            // Load announcements setelah login sukses
            loadAnnouncements();
            // ===== END TAMBAHAN =====
        } else {
            showNotification('❌ ' + (data.error || 'Login gagal'), 'error');
            form.classList.add('shake');
            setTimeout(() => form.classList.remove('shake'), 500);
        }
    } catch (error) {
        console.error('Login error detail:', error);
        showNotification('❌ Gagal terhubung ke server - ' + error.message, 'error');
        resetLoginButton(submitBtn, btnText, btnLoader);
        
        form.classList.add('shake');
        setTimeout(() => form.classList.remove('shake'), 500);
    }
}

async function renderAdminDashboard() {
    const profilePicUrl = currentUser.profile_picture_url;
    
    app.innerHTML = `
        <div class="dashboard-wrapper">
            <aside class="sidebar glassmorphism">
                <div class="sidebar-header">
                    <div class="logo">
                        <i class="fas fa-rocket"></i>
                        <h2>Task<span>Bot</span></h2>
                    </div>
                    <div class="user-info">
                        <div class="user-avatar" id="sidebarAvatar">
                            ${profilePicUrl ? 
                                `<img src="${profilePicUrl}" alt="Profile" style="width: 100%; height: 100%; object-fit: cover; border-radius: var(--radius-lg);">` : 
                                `<i class="fas fa-user-shield"></i>`
                            }
                        </div>
                        <div class="user-details">
                            <span class="user-name" id="sidebarUserName">${escapeHtml(currentUser.full_name || currentUser.username)}</span>
                            <span class="user-role admin">Administrator</span>
                        </div>
                    </div>
                </div>
                
                <nav class="sidebar-nav">
                    <button class="nav-item active" onclick="switchView('dashboard')">
                        <i class="fas fa-chart-pie"></i>
                        <span>Dashboard</span>
                        <span class="nav-badge" id="navDashboardBadge"></span>
                    </button>

                    <button class="nav-item" onclick="switchView('chat')">
                        <i class="fas fa-comments"></i>
                        <span>Chat</span>
                        <span class="nav-badge" id="navChatBadge"></span>
                    </button>
                    
                    <button class="nav-item" onclick="switchView('groups')">
                        <i class="fas fa-users"></i>
                        <span>Groups</span>
                        <span class="nav-badge" id="navGroupsBadge"></span>
                    </button>
                    
                    <button class="nav-item" onclick="switchView('tasks')">
                        <i class="fas fa-tasks"></i>
                        <span>Tasks</span>
                        <span class="nav-badge" id="navTasksBadge"></span>
                    </button>
                    
                    <button class="nav-item" onclick="switchView('users')">
                        <i class="fas fa-users"></i>
                        <span>Users</span>
                        <span class="nav-badge" id="navUsersBadge"></span>
                    </button>
                    
                    <button class="nav-item" onclick="switchView('reports')">
                        <i class="fas fa-chart-bar"></i>
                        <span>Reports</span>
                    </button>
                    
                    <button class="nav-item" onclick="switchView('profile')">
                        <i class="fas fa-user-cog"></i>
                        <span>Profile</span>
                    </button>
                </nav>
                
                <div class="sidebar-footer">
                    <button class="nav-item" onclick="toggleTheme()">
                        <i class="fas ${theme === 'dark' ? 'fa-sun' : 'fa-moon'}" id="themeIcon"></i>
                        <span id="themeText">${theme === 'dark' ? 'Light' : 'Dark'} Mode</span>
                    </button>
                    
                    <button class="nav-item" onclick="logout()">
                        <i class="fas fa-sign-out-alt"></i>
                        <span>Logout</span>
                    </button>
                    
                    <div class="telegram-status">
                        <i class="fas fa-circle ${currentUser?.telegram_verified ? 'online' : 'offline'}"></i>
                        <span>Telegram ${currentUser?.telegram_verified ? 'Connected' : 'Not Connected'}</span>
                    </div>
                </div>
            </aside>
            
            <main class="main-content">
                <header class="content-header">
                    <div class="header-title">
                        <h1 id="pageTitle">Dashboard Overview</h1>
                        <p id="pageSubtitle" class="text-secondary">Selamat datang kembali, ${escapeHtml(currentUser.full_name || currentUser.username)}!</p>
                    </div>
                    
                    <div class="header-actions">
                        <div class="search-box">
                            <i class="fas fa-search"></i>
                            <input type="text" id="globalSearch" placeholder="Search...">
                        </div>
                        
                        <button class="btn-refresh" onclick="refreshAll()" title="Refresh">
                            <i class="fas fa-sync-alt"></i>
                        </button>
                        
                        <button class="btn-primary" onclick="showCreateTaskModal()">
                            <i class="fas fa-plus"></i>
                            <span>New Task</span>
                        </button>
                    </div>
                </header>
                
                <div id="contentArea" class="content-area"></div>
            </main>
        </div>
    `;
    
    switchView('dashboard');
}

async function renderUserDashboard() {
    const profilePicUrl = currentUser.profile_picture_url;
    
    app.innerHTML = `
        <div class="dashboard-wrapper">
            <aside class="sidebar glassmorphism">
                <div class="sidebar-header">
                    <div class="logo">
                        <i class="fas fa-rocket"></i>
                        <h2>Task<span>Bot</span></h2>
                    </div>
                    <div class="user-info">
                        <div class="user-avatar" id="sidebarAvatar">
                            ${profilePicUrl ? 
                                `<img src="${profilePicUrl}" alt="Profile" style="width: 100%; height: 100%; object-fit: cover; border-radius: var(--radius-lg);">` : 
                                `<i class="fas fa-user"></i>`
                            }
                        </div>
                        <div class="user-details">
                            <span class="user-name" id="sidebarUserName">${escapeHtml(currentUser.full_name || currentUser.username)}</span>
                            <span class="user-role">User</span>
                        </div>
                    </div>
                </div>
                
                <nav class="sidebar-nav">
                    <button class="nav-item active" onclick="switchView('dashboard')">
                        <i class="fas fa-chart-pie"></i>
                        <span>Dashboard</span>
                        <span class="nav-badge" id="navDashboardBadge"></span>
                    </button>

                    <button class="nav-item" onclick="switchView('chat')">
                        <i class="fas fa-comments"></i>
                        <span>Chat</span>
                        <span class="nav-badge" id="navChatBadge"></span>
                    </button>
                    
                    <button class="nav-item" onclick="switchView('groups')">
                        <i class="fas fa-users"></i>
                        <span>Groups</span>
                        <span class="nav-badge" id="navGroupsBadge"></span>
                    </button>
                    
                    <button class="nav-item" onclick="switchView('myTasks')">
                        <i class="fas fa-tasks"></i>
                        <span>My Tasks</span>
                        <span class="nav-badge" id="navTasksBadge"></span>
                    </button>
                    
                    <button class="nav-item" onclick="switchView('completed')">
                        <i class="fas fa-check-circle"></i>
                        <span>Completed</span>
                    </button>
                    
                    <button class="nav-item" onclick="switchView('profile')">
                        <i class="fas fa-user-cog"></i>
                        <span>Profile</span>
                    </button>
                </nav>
                
                <div class="sidebar-footer">
                    <button class="nav-item" onclick="toggleTheme()">
                        <i class="fas ${theme === 'dark' ? 'fa-sun' : 'fa-moon'}" id="themeIcon"></i>
                        <span id="themeText">${theme === 'dark' ? 'Light' : 'Dark'} Mode</span>
                    </button>
                    
                    <button class="nav-item" onclick="logout()">
                        <i class="fas fa-sign-out-alt"></i>
                        <span>Logout</span>
                    </button>
                    
                    <div class="telegram-status">
                        <i class="fas fa-circle ${currentUser.telegram_verified ? 'online' : 'offline'}"></i>
                        <span>Telegram ${currentUser.telegram_verified ? 'Verified' : 'Not Verified'}</span>
                    </div>
                </div>
            </aside>
            
            <main class="main-content">
                <header class="content-header">
                    <div class="header-title">
                        <h1 id="pageTitle">My Dashboard</h1>
                        <p id="pageSubtitle" class="text-secondary">Task Overview</p>
                    </div>
                    
                    <div class="header-actions">
                        <div class="search-box">
                            <i class="fas fa-search"></i>
                            <input type="text" id="globalSearch" placeholder="Search tasks...">
                        </div>
                        
                        <button class="btn-refresh" onclick="refreshAll()" title="Refresh">
                            <i class="fas fa-sync-alt"></i>
                        </button>
                    </div>
                </header>
                
                <div id="contentArea" class="content-area"></div>
            </main>
        </div>
    `;
    
    switchView('dashboard');
}

// Cari fungsi switchView yang sudah ada, lalu tambahkan case ini di dalamnya
function switchView(view) {
    currentView = view;
    
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    
    if (event && event.target) {
        const target = event.target.closest('.nav-item');
        if (target) target.classList.add('active');
    }

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
            
        case 'groups':
            pageTitle.textContent = 'Groups';
            pageSubtitle.textContent = 'Kelola group dan kolaborasi tim';
            renderGroupsView();
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
            
        case 'chat':
            pageTitle.textContent = 'Chat';
            pageSubtitle.textContent = 'Obrolan dengan teman dan group';
            renderChatView();
            break;
            
        case 'completed':
            pageTitle.textContent = 'Completed Tasks';
            pageSubtitle.textContent = 'Task yang sudah selesai';
            renderCompletedTasksView();
            break;
            
        case 'settings':
            pageTitle.textContent = 'Settings';
            pageSubtitle.textContent = 'Pengaturan sistem';
            renderSettingsView();
            break;

        // ===== TAMBAHKAN INI =====
        case 'announcements':
            if (currentUser && currentUser.role === 'admin') {
                pageTitle.textContent = 'Announcements';
                pageSubtitle.textContent = 'Kelola pengumuman dan notifikasi';
                renderAdminAnnouncements();
            }
            break;
        // ===== END TAMBAHAN =====
    }
}

function renderDashboardContent() {
    const contentArea = document.getElementById('contentArea');
    if (!contentArea) return;
    
    contentArea.innerHTML = `
        <div class="dashboard-content">
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
            
            <div class="activity-log glassmorphism">
                <div class="section-header">
                    <h3><i class="fas fa-bell"></i> Recent Activity</h3>
                    <span class="badge">Live</span>
                </div>
                <div id="activityList" class="activity-list"></div>
            </div>
        </div>
    `;
    
    loadStats();
    loadRecentTasks();
    loadActivities();
    
    setTimeout(() => {
        initCharts();
    }, 500);
}

function renderTasksView() {
    const contentArea = document.getElementById('contentArea');
    if (!contentArea) return;
    
    contentArea.innerHTML = `
        <div class="tasks-view">
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
    
    if (currentUser && currentUser.role === 'admin' && users.length > 0) {
        const filterAssignee = document.getElementById('filterAssignee');
        if (filterAssignee) {
            filterAssignee.innerHTML = '<option value="all">All Users</option>' + 
                users.map(user => `<option value="${user.id}">${escapeHtml(user.full_name || user.username)}</option>`).join('');
        }
    }
    
    loadTasks();
}

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

function renderUsersView() {
    if (!currentUser || currentUser.role !== 'admin') return;
    
    const contentArea = document.getElementById('contentArea');
    if (!contentArea) return;
    
    contentArea.innerHTML = `
        <div class="users-view">
            <div class="users-header glassmorphism">
                <h3><i class="fas fa-users"></i> User Management</h3>
                <button class="btn-primary" onclick="showCreateUserModal()">
                    <i class="fas fa-user-plus"></i> Add User
                </button>
            </div>
            
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
    
    loadUsers();
}

async function renderProfileView() {
    const contentArea = document.getElementById('contentArea');
    if (!contentArea || !currentUser) return;
    
    const profilePicUrl = await getProfilePictureUrlFixed(currentUser.id);
    
    contentArea.innerHTML = `
        <div class="profile-view">
            <div class="profile-grid">
                <div class="profile-card glassmorphism">
                    <div class="profile-avatar">
                        ${profilePicUrl ? 
                            `<img src="${profilePicUrl}" alt="Profile" class="profile-image" id="profileImage">` : 
                            `<i class="fas fa-user-circle" id="profileIcon"></i>`
                        }
                        <button class="edit-photo" onclick="showUploadProfilePictureModal()" title="Ubah Foto Profile">
                            <i class="fas fa-camera"></i>
                        </button>
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
                
                <div class="profile-form glassmorphism">
                    <h3><i class="fas fa-edit"></i> Edit Profile</h3>
                    
                    <form id="profileForm">
                        <div class="form-group">
                            <label><i class="fas fa-user"></i> Nama Lengkap</label>
                            <input type="text" name="full_name" id="profileInputFullName" 
                                value="${escapeHtml(currentUser.full_name || '')}" placeholder="Masukkan nama lengkap">
                        </div>
                        
                        <div class="form-group">
                            <label><i class="fas fa-envelope"></i> Email</label>
                            <input type="email" name="email" id="profileInputEmail" 
                                value="${escapeHtml(currentUser.email || '')}" placeholder="Masukkan email">
                        </div>
                        
                        <div class="form-group">
                            <label><i class="fab fa-telegram"></i> Telegram Chat ID</label>
                            <div class="input-group">
                                <input type="text" name="telegram_chat_id" id="profileInputTelegram" 
                                    value="${escapeHtml(currentUser.telegram_chat_id || '')}" placeholder="Masukkan Telegram Chat ID">
                                <button type="button" class="btn-secondary" onclick="verifyTelegram()">
                                    <i class="fab fa-telegram"></i> Verify
                                </button>
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label><i class="fas fa-lock"></i> Change Password</label>
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
    
    const profileForm = document.getElementById('profileForm');
    if (profileForm) profileForm.addEventListener('submit', handleUpdateProfile);
    
    loadUserStats();
}

// =============== REPORTS VIEW ===============

function renderReportsView() {
    const contentArea = document.getElementById('contentArea');
    if (!contentArea) return;
    
    const today = new Date();
    const dateStr = today.toLocaleDateString('id-ID', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric' 
    });
    
    contentArea.innerHTML = `
        <div class="reports-view">
            <div class="reports-header glassmorphism">
                <h3><i class="fas fa-chart-bar"></i> Reports & Analytics</h3>
                <div class="report-actions">
                    <button class="btn-excel" onclick="exportToExcel()">
                        <i class="fas fa-file-excel"></i> Export Excel
                    </button>
                    <button class="btn-pdf" onclick="exportToPDF()">
                        <i class="fas fa-file-pdf"></i> Export PDF
                    </button>
                </div>
            </div>
            
            <div class="report-summary">
                <div class="summary-card">
                    <div class="summary-icon">
                        <i class="fas fa-tasks"></i>
                    </div>
                    <div class="summary-details">
                        <span class="label">Total Tasks</span>
                        <span class="value" id="totalTasks">0</span>
                    </div>
                </div>
                
                <div class="summary-card">
                    <div class="summary-icon">
                        <i class="fas fa-check-circle"></i>
                    </div>
                    <div class="summary-details">
                        <span class="label">Completed</span>
                        <span class="value" id="completedTasks">0</span>
                    </div>
                </div>
                
                <div class="summary-card">
                    <div class="summary-icon">
                        <i class="fas fa-flask"></i>
                    </div>
                    <div class="summary-details">
                        <span class="label">Test Cases</span>
                        <span class="value" id="totalTests">0</span>
                    </div>
                </div>
                
                <div class="summary-card">
                    <div class="summary-icon">
                        <i class="fas fa-users"></i>
                    </div>
                    <div class="summary-details">
                        <span class="label">Active Users</span>
                        <span class="value" id="activeUsers">0</span>
                    </div>
                </div>
            </div>
            
            <div class="reports-grid">
                <div class="report-card glassmorphism">
                    <h4><i class="fas fa-chart-pie"></i> Task Completion Rate</h4>
                    <div class="report-chart-container">
                        <canvas id="completionRateChart"></canvas>
                    </div>
                </div>
                
                <div class="report-card glassmorphism">
                    <h4><i class="fas fa-chart-line"></i> User Performance</h4>
                    <div class="report-chart-container">
                        <canvas id="userPerformanceChart"></canvas>
                    </div>
                </div>
                
                <div class="report-card glassmorphism">
                    <h4><i class="fas fa-vial"></i> Test Case Success Rate</h4>
                    <div class="report-chart-container">
                        <canvas id="testSuccessChart"></canvas>
                    </div>
                </div>
                
                <div class="report-card glassmorphism">
                    <h4><i class="fas fa-calendar-week"></i> Weekly Summary</h4>
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
            
            <div class="detailed-report glassmorphism">
                <h4><i class="fas fa-clipboard-list"></i> Detailed Test Report</h4>
                
                <div class="report-filters">
                    <div class="filter-group">
                        <label><i class="fas fa-filter"></i> Filter by Date</label>
                        <input type="date" id="reportDateFilter" value="${today.toISOString().split('T')[0]}">
                    </div>
                    <div class="filter-group">
                        <label><i class="fas fa-user"></i> Tester</label>
                        <select id="reportTesterFilter">
                            <option value="all">All Testers</option>
                            <option value="Dimas">Dimas</option>
                            <option value="Admin">Admin</option>
                        </select>
                    </div>
                    <div class="filter-group">
                        <label><i class="fas fa-globe"></i> Environment</label>
                        <select id="reportEnvFilter">
                            <option value="all">All Environments</option>
                            <option value="http://13.229.198.150/">Production</option>
                            <option value="http://staging.13.229.198.150/">Staging</option>
                            <option value="http://localhost:3002/">Local</option>
                        </select>
                    </div>
                    <div class="filter-group">
                        <label><i class="fas fa-chart-line"></i> Status</label>
                        <select id="reportStatusFilter">
                            <option value="all">All Status</option>
                            <option value="passed">Passed</option>
                            <option value="failed">Failed</option>
                            <option value="pending">Pending</option>
                        </select>
                    </div>
                </div>
                
                <div class="report-table-container">
                    <table class="report-table" id="reportTable">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Test Scenario</th>
                                <th>Test Case</th>
                                <th>Test Data</th>
                                <th>Steps</th>
                                <th>Expected Result</th>
                                <th>Actual Result</th>
                                <th>Status</th>
                                <th>Evidence</th>
                                <th>Note</th>
                                <th>Status (2)</th>
                                <th>Note (2)</th>
                                <th>Evidence (2)</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="reportTableBody">
                            <tr>
                                <td colspan="14" class="text-center">
                                    <div class="loading-spinner small"></div>
                                    <p>Loading report data...</p>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                
                <div style="display: flex; justify-content: space-between; margin-top: 16px; padding: 12px; background: var(--bg-hover); border-radius: var(--radius-md); font-size: 12px; color: var(--text-secondary);">
                    <div><i class="fas fa-calendar"></i> Created at: <span id="reportCreatedDate">${dateStr}</span></div>
                    <div><i class="fas fa-ticket"></i> Ticket: <span id="reportTicket">TASK-${Math.floor(Math.random() * 1000)}</span></div>
                    <div><i class="fas fa-user"></i> Tested by: <span id="reportTester">Dimas</span></div>
                    <div><i class="fas fa-globe"></i> Env: <span id="reportEnv">http://13.229.198.150/</span></div>
                    <div><i class="fas fa-user-tie"></i> PIC: <span id="reportPIC">Dimas</span></div>
                    <div><i class="fas fa-clock"></i> Last update: <span id="reportLastUpdate">${dateStr}</span></div>
                </div>
            </div>
        </div>
    `;
    
    loadReportData();
    
    setTimeout(() => {
        initReportCharts();
    }, 500);
}

async function loadReportData() {
    try {
        const tasksResponse = await fetch('/api/tasks', {
            headers: { 'Authorization': `Bearer ${currentToken}` }
        });
        const tasks = await tasksResponse.json();
        
        const usersResponse = await fetch('/api/admin/users', {
            headers: { 'Authorization': `Bearer ${currentToken}` }
        });
        const usersData = await usersResponse.json();
        const users = usersData.users || [];
        
        const totalTasks = tasks.length;
        const completedTasks = tasks.filter(t => t.status === 'completed' || t.status === 'approved').length;
        
        let allTestCases = [];
        for (const task of tasks) {
            try {
                const testResponse = await fetch(`/api/tasks/${task.id}/test-cases`, {
                    headers: { 'Authorization': `Bearer ${currentToken}` }
                });
                const testCases = await testResponse.json();
                allTestCases = [...allTestCases, ...testCases];
            } catch (e) {
                console.log('No test cases for task:', task.id);
            }
        }
        
        const totalTests = allTestCases.length;
        const passedTests = allTestCases.filter(t => t.status === 'passed').length;
        
        document.getElementById('totalTasks').textContent = totalTasks;
        document.getElementById('completedTasks').textContent = completedTasks;
        document.getElementById('totalTests').textContent = totalTests;
        document.getElementById('activeUsers').textContent = users.filter(u => u.is_active).length;
        
        document.getElementById('weeklyTasksCreated').textContent = tasks.filter(t => {
            const created = new Date(t.created_at);
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            return created >= weekAgo;
        }).length;
        
        document.getElementById('weeklyTasksCompleted').textContent = tasks.filter(t => {
            if (!t.completed_at) return false;
            const completed = new Date(t.completed_at);
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            return completed >= weekAgo;
        }).length;
        
        document.getElementById('weeklyTestsPassed').textContent = passedTests;
        document.getElementById('weeklyActiveUsers').textContent = users.filter(u => {
            if (!u.last_login) return false;
            const lastLogin = new Date(u.last_login);
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            return lastLogin >= weekAgo;
        }).length;
        
        renderReportTable(tasks, allTestCases);
        
    } catch (error) {
        console.error('Load report data error:', error);
        showNotification('❌ Gagal memuat data report', 'error');
    }
}

function renderReportTable(tasks, testCases) {
    const tbody = document.getElementById('reportTableBody');
    if (!tbody) return;
    
    if (testCases.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="14" class="text-center">
                    <div class="empty-state small">
                        <i class="fas fa-flask"></i>
                        <p>No test cases found</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    const statusFilter = document.getElementById('reportStatusFilter')?.value;
    
    let filteredTests = [...testCases];
    
    if (statusFilter && statusFilter !== 'all') {
        filteredTests = filteredTests.filter(t => t.status === statusFilter);
    }
    
    const rows = filteredTests.map((test, index) => {
        const task = tasks.find(t => t.id === test.task_id) || {};
        const status = test.status || 'pending';
        const statusClass = status === 'passed' ? 'status-pass' : status === 'failed' ? 'status-fail' : 'status-pending';
        const statusText = status === 'passed' ? 'PASS' : status === 'failed' ? 'FAIL' : 'PENDING';
        
        return `
            <tr data-test-id="${test.id}">
                <td>#${test.id}</td>
                <td>${escapeHtml(task.title || 'N/A')}</td>
                <td>${escapeHtml(test.test_name || 'N/A')}</td>
                <td>${escapeHtml(test.input_data || '-')}</td>
                <td>${escapeHtml(test.test_description || '-')}</td>
                <td>${escapeHtml(test.expected_output || '-')}</td>
                <td>${escapeHtml(test.actual_output || '-')}</td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                <td>
                    ${test.screenshot_url ? 
                        `<a href="${test.screenshot_url}" target="_blank" class="evidence-link">
                            <i class="fas fa-image"></i> View
                        </a>` : 
                        '-'
                    }
                </td>
                <td class="note-cell">${escapeHtml(test.note || '-')}</td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                <td class="note-cell">${escapeHtml(test.note || '-')}</td>
                <td>
                    ${test.screenshot_url ? 
                        `<a href="${test.screenshot_url}" target="_blank" class="evidence-link">
                            <i class="fas fa-image"></i> View
                        </a>` : 
                        '-'
                    }
                </td>
                <td class="action-cell">
                    <button class="btn-icon-small" onclick="editTestCase(${test.id})" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon-small" onclick="viewTestCaseDetail(${test.id})" title="View Details">
                        <i class="fas fa-eye"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
    
    tbody.innerHTML = rows;
}

function initReportCharts() {
    if (typeof Chart === 'undefined') return;
    
    const completionCtx = document.getElementById('completionRateChart')?.getContext('2d');
    if (completionCtx) {
        new Chart(completionCtx, {
            type: 'doughnut',
            data: {
                labels: ['Completed', 'In Progress', 'Pending'],
                datasets: [{
                    data: [65, 20, 15],
                    backgroundColor: [
                        'rgba(45, 122, 75, 0.8)',
                        'rgba(74, 123, 157, 0.8)',
                        'rgba(201, 156, 71, 0.8)'
                    ],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom' }
                }
            }
        });
    }
    
    const performanceCtx = document.getElementById('userPerformanceChart')?.getContext('2d');
    if (performanceCtx) {
        new Chart(performanceCtx, {
            type: 'bar',
            data: {
                labels: ['Dimas', 'Admin', 'User1', 'User2'],
                datasets: [{
                    label: 'Tasks Completed',
                    data: [42, 38, 25, 18],
                    backgroundColor: 'rgba(181, 139, 91, 0.8)',
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });
    }
    
    const testCtx = document.getElementById('testSuccessChart')?.getContext('2d');
    if (testCtx) {
        new Chart(testCtx, {
            type: 'pie',
            data: {
                labels: ['Passed', 'Failed', 'Pending'],
                datasets: [{
                    data: [58, 12, 30],
                    backgroundColor: [
                        'rgba(45, 122, 75, 0.8)',
                        'rgba(179, 75, 75, 0.8)',
                        'rgba(201, 156, 71, 0.8)'
                    ],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom' }
                }
            }
        });
    }
}

// =============== EXPORT FUNCTIONS ===============

function exportToExcel() {
    showNotification('📊 Generating Excel report...', 'info');
    
    try {
        const table = document.getElementById('reportTable');
        const rows = table.querySelectorAll('tr');
        
        let csv = [];
        
        const dateStr = document.getElementById('reportCreatedDate')?.textContent || new Date().toLocaleDateString();
        const ticket = document.getElementById('reportTicket')?.textContent || 'TASK-001';
        const tester = document.getElementById('reportTester')?.textContent || 'Dimas';
        const env = document.getElementById('reportEnv')?.textContent || 'http://13.229.198.150/';
        const pic = document.getElementById('reportPIC')?.textContent || 'Dimas';
        const lastUpdate = document.getElementById('reportLastUpdate')?.textContent || dateStr;
        
        csv.push(`Created at:,${dateStr},Tiket:,${ticket},Tested by:,${tester},Env:,${env},PIC:,${pic}`);
        csv.push(`Last update:,${lastUpdate},,,,,,,,`);
        csv.push('');
        
        const headers = [];
        rows[0]?.querySelectorAll('th').forEach(th => {
            headers.push(`"${th.textContent}"`);
        });
        csv.push(headers.join(','));
        
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            const cols = row.querySelectorAll('td');
            if (cols.length > 0) {
                const rowData = [];
                cols.forEach(col => {
                    let text = col.textContent.trim().replace(/\s+/g, ' ');
                    const link = col.querySelector('a');
                    if (link) {
                        text = link.href || text;
                    }
                    rowData.push(`"${text}"`);
                });
                csv.push(rowData.join(','));
            }
        }
        
        const csvContent = csv.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', `test-report-${dateStr.replace(/\//g, '-')}.csv`);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showNotification('✅ Excel report downloaded successfully!', 'success');
    } catch (error) {
        console.error('Export error:', error);
        showNotification('❌ Failed to generate Excel report', 'error');
    }
}

function exportToPDF() {
    showNotification('📄 Generating PDF report...', 'info');
    
    try {
        const table = document.getElementById('reportTable');
        const rows = table.querySelectorAll('tr');
        
        const dateStr = document.getElementById('reportCreatedDate')?.textContent || new Date().toLocaleDateString();
        const ticket = document.getElementById('reportTicket')?.textContent || 'TASK-001';
        const tester = document.getElementById('reportTester')?.textContent || 'Dimas';
        const env = document.getElementById('reportEnv')?.textContent || 'http://13.229.198.150/';
        const pic = document.getElementById('reportPIC')?.textContent || 'Dimas';
        const lastUpdate = document.getElementById('reportLastUpdate')?.textContent || dateStr;
        
        let htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Test Report - ${dateStr}</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    h1 { color: #b58b5b; text-align: center; }
                    .metadata { 
                        display: grid; 
                        grid-template-columns: repeat(5, 1fr); 
                        gap: 10px; 
                        margin: 20px 0;
                        padding: 15px;
                        background: #f5ede1;
                        border-radius: 8px;
                    }
                    .metadata-item {
                        font-size: 12px;
                    }
                    .metadata-item strong {
                        color: #b58b5b;
                    }
                    table { 
                        width: 100%; 
                        border-collapse: collapse; 
                        margin-top: 20px;
                        font-size: 11px;
                    }
                    th { 
                        background: #b58b5b; 
                        color: white; 
                        padding: 10px;
                        text-align: left;
                        font-size: 11px;
                    }
                    td { 
                        border: 1px solid #e2d5c2; 
                        padding: 8px;
                        vertical-align: top;
                    }
                    tr:nth-child(even) { background: #f9f9f9; }
                    .status-pass { color: #2d7a4b; font-weight: bold; }
                    .status-fail { color: #b34b4b; font-weight: bold; }
                    .status-pending { color: #c99c47; font-weight: bold; }
                    .footer {
                        margin-top: 30px;
                        text-align: right;
                        font-size: 11px;
                        color: #666;
                    }
                </style>
            </head>
            <body>
                <h1>Test Report - TaskBot Pro</h1>
                
                <div class="metadata">
                    <div class="metadata-item"><strong>Created at:</strong> ${dateStr}</div>
                    <div class="metadata-item"><strong>Ticket:</strong> ${ticket}</div>
                    <div class="metadata-item"><strong>Tested by:</strong> ${tester}</div>
                    <div class="metadata-item"><strong>Environment:</strong> ${env}</div>
                    <div class="metadata-item"><strong>PIC:</strong> ${pic}</div>
                    <div class="metadata-item"><strong>Last update:</strong> ${lastUpdate}</div>
                </div>
                
                <table>
                    <thead>
                        <tr>
        `;
        
        rows[0]?.querySelectorAll('th').forEach(th => {
            htmlContent += `<th>${th.textContent}</th>`;
        });
        
        htmlContent += `
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            const cols = row.querySelectorAll('td');
            if (cols.length > 0) {
                htmlContent += '<tr>';
                cols.forEach(col => {
                    const statusBadge = col.querySelector('.status-badge');
                    if (statusBadge) {
                        const status = statusBadge.textContent.trim();
                        const statusClass = status === 'PASS' ? 'status-pass' : 
                                        status === 'FAIL' ? 'status-fail' : 'status-pending';
                        htmlContent += `<td class="${statusClass}">${status}</td>`;
                    } else {
                        const link = col.querySelector('a');
                        if (link) {
                            htmlContent += `<td><a href="${link.href}">${link.textContent}</a></td>`;
                        } else {
                            htmlContent += `<td>${col.textContent.trim()}</td>`;
                        }
                    }
                });
                htmlContent += '</tr>';
            }
        }
        
        htmlContent += `
                    </tbody>
                </table>
                
                <div class="footer">
                    Generated on ${new Date().toLocaleString()}
                </div>
            </body>
            </html>
        `;
        
        const blob = new Blob([htmlContent], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        
        const printWindow = window.open(url, '_blank');
        if (printWindow) {
            printWindow.onload = () => {
                printWindow.print();
            };
        } else {
            showNotification('❌ Please allow pop-ups to generate PDF', 'error');
        }
        
        showNotification('✅ PDF report generated! Check new window.', 'success');
    } catch (error) {
        console.error('PDF export error:', error);
        showNotification('❌ Failed to generate PDF report', 'error');
    }
}

function editTestCase(testId) {
    // Arahkan ke fungsi updateTestCaseResult
    updateTestCaseResult(testId);
}

function viewTestCaseDetail(testId) {
    // Bisa buat modal detail test case
    showNotification(`🔍 Detail test case #${testId} - Fitur akan segera hadir!`, 'info');
}

function initReportFilters() {
    const dateFilter = document.getElementById('reportDateFilter');
    const testerFilter = document.getElementById('reportTesterFilter');
    const envFilter = document.getElementById('reportEnvFilter');
    const statusFilter = document.getElementById('reportStatusFilter');
    
    if (dateFilter) {
        dateFilter.addEventListener('change', () => {
            loadReportData();
        });
    }
    
    if (testerFilter) {
        testerFilter.addEventListener('change', () => {
            loadReportData();
        });
    }
    
    if (envFilter) {
        envFilter.addEventListener('change', () => {
            loadReportData();
        });
    }
    
    if (statusFilter) {
        statusFilter.addEventListener('change', () => {
            loadReportData();
        });
    }
}

// =============== SETTINGS VIEW ===============

function renderSettingsView() {
    const contentArea = document.getElementById('contentArea');
    if (!contentArea) return;
    
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
                            <input type="password" name="bot_token" 
                                value="********" readonly>
                            <small class="form-text">Configure in .env file</small>
                        </div>
                        
                        <div class="form-group">
                            <label>Admin Chat ID</label>
                            <input type="text" name="admin_chat_id" 
                                value="" id="adminChatId">
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
                    <h4><i class="fas fa-volume-up"></i> Notifications</h4>
                    <form id="notificationSettingsForm">
                        <div class="form-group">
                            <label>Sound Notifications</label>
                            <div class="toggle-switch">
                                <input type="checkbox" id="audioToggle" ${audioEnabled ? 'checked' : ''} onchange="toggleAudio()">
                                <label for="audioToggle"></label>
                            </div>
                            <small class="form-text">Play sound when new messages/tasks arrive</small>
                        </div>
                        
                        <div class="form-group">
                            <label>Test Sound</label>
                            <button type="button" class="btn-secondary" onclick="testNotificationSound()">
                                <i class="fas fa-volume-up"></i> Test Notification Sound
                            </button>
                        </div>
                        
                        <div class="form-group">
                            <label>Desktop Notifications</label>
                            <div class="toggle-switch">
                                <input type="checkbox" id="desktopToggle" onchange="toggleDesktopNotifications()">
                                <label for="desktopToggle"></label>
                            </div>
                            <small class="form-text">Show desktop notifications</small>
                        </div>
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

async function loadTasks() {
    try {
        const response = await fetch('/api/tasks', {
            headers: {
                'Authorization': `Bearer ${currentToken}`
            }
        });
        
        tasks = await response.json();
        
        if (currentView === 'tasks' || currentView === 'myTasks' || currentView === 'dashboard' || currentView === 'completed') {
            displayTasks();
        }
        
        updateTaskBadges();
        
    } catch (error) {
        console.error('Load tasks error:', error);
        if (currentView !== 'login') {
            showNotification('❌ Gagal memuat tasks', 'error');
        }
    }
}

async function loadStats() {
    try {
        const response = await fetch('/api/stats', {
            headers: {
                'Authorization': `Bearer ${currentToken}`
            }
        });
        
        const stats = await response.json();
        
        const statPending = document.getElementById('statPending');
        const statProgress = document.getElementById('statProgress');
        const statCompleted = document.getElementById('statCompleted');
        const statApproved = document.getElementById('statApproved');
        
        if (statPending) statPending.textContent = stats.pending_tasks || 0;
        if (statProgress) statProgress.textContent = stats.in_progress_tasks || 0;
        if (statCompleted) statCompleted.textContent = stats.completed_tasks || 0;
        if (statApproved) statApproved.textContent = stats.approved_tasks || 0;
        
        const navDashboardBadge = document.getElementById('navDashboardBadge');
        const navTasksBadge = document.getElementById('navTasksBadge');
        const navUsersBadge = document.getElementById('navUsersBadge');
        const navGroupsBadge = document.getElementById('navGroupsBadge');
        
        if (navDashboardBadge) navDashboardBadge.textContent = stats.pending_approval || 0;
        if (navTasksBadge) navTasksBadge.textContent = tasks?.length || 0;
        if (navUsersBadge) navUsersBadge.textContent = users?.length || 0;
        
        if (navGroupsBadge && groupInvitations) {
            const count = groupInvitations.length || 0;
            navGroupsBadge.textContent = count;
            if (count === 0) {
                navGroupsBadge.style.display = 'none';
            } else {
                navGroupsBadge.style.display = 'inline-block';
            }
        }

        const navChatBadge = document.getElementById('navChatBadge');
        if (navChatBadge && chatRooms) {
            const totalUnread = chatRooms.reduce((sum, room) => sum + (room.unread_count || 0), 0);
            navChatBadge.textContent = totalUnread || 0;
            if (totalUnread === 0) {
                navChatBadge.style.display = 'none';
            } else {
                navChatBadge.style.display = 'inline-block';
            }
        }
        
    } catch (error) {
        console.error('Load stats error:', error);
    }
}

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
                                <span class="profile-status-badge ${user.telegram_verified ? 'verified' : 'unverified'}">
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

async function loadRecentTasks() {
    const container = document.getElementById('recentTasksList');
    if (!container) return;
    
    try {
        const limitedTasks = tasks.slice(0, 5);
        
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

async function loadActivities() {
    const container = document.getElementById('activityList');
    if (!container) return;
    
    try {
        const response = await fetch('/api/activities', {
            headers: {
                'Authorization': `Bearer ${currentToken}`
            }
        });
        
        const data = await response.json();
        
        if (!data.success) {
            console.error('Failed to load activities:', data.error);
            return;
        }
        
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
        
        container.innerHTML = activities.map(activity => {
            let activityText = '';
            let icon = 'fa-bell';
            
            switch(activity.action) {
                case 'LOGIN':
                    activityText = `${activity.full_name || activity.username} login ke sistem`;
                    icon = 'fa-sign-in-alt';
                    break;
                case 'REGISTER':
                    activityText = `User baru terdaftar: ${activity.full_name || activity.username}`;
                    icon = 'fa-user-plus';
                    break;
                case 'CREATE_TASK':
                    const taskTitle = activity.details?.title || 'Task baru';
                    activityText = `${activity.full_name || activity.username} membuat task: ${taskTitle}`;
                    icon = 'fa-plus-circle';
                    break;
                case 'UPDATE_TASK_STATUS':
                    activityText = `${activity.full_name || activity.username} mengubah status task`;
                    icon = 'fa-edit';
                    break;
                case 'APPROVE_TASK':
                    activityText = `${activity.full_name || activity.username} menyetujui task`;
                    icon = 'fa-check-double';
                    break;
                case 'REJECT_TASK':
                    activityText = `${activity.full_name || activity.username} menolak task`;
                    icon = 'fa-times-circle';
                    break;
                default:
                    activityText = `${activity.full_name || activity.username} ${activity.action.toLowerCase()}`;
            }
            
            return `
                <div class="activity-item">
                    <div class="activity-icon">
                        <i class="fas ${icon}"></i>
                    </div>
                    <div class="activity-details">
                        <p class="activity-text">${escapeHtml(activityText)}</p>
                        <span class="activity-time">${timeAgo(activity.created_at)}</span>
                    </div>
                </div>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Load activities error:', error);
        container.innerHTML = `
            <div class="empty-state small">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Gagal memuat aktivitas</p>
            </div>
        `;
    }
}

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

// =============== FIXED: updateTestCaseResult dengan simpan 2 foto ===============
async function updateTestCaseResult(testCaseId) {
    const existingModal = document.querySelector('.modal.active');
    if (existingModal) existingModal.remove();
    
    try {
        showNotification('🔄 Memuat data test case...', 'info');
        
        const response = await fetch(`/api/test-cases/${testCaseId}`, {
            headers: { 'Authorization': `Bearer ${currentToken}` }
        });
        
        if (!response.ok) throw new Error('Failed to load test case');
        
        const testCase = await response.json();
        const taskId = testCase.task_id;
        
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3><i class="fas fa-flask"></i> Update Result Test Case</h3>
                    <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
                </div>
                
                <div class="modal-body">
                    <form id="updateTestCaseForm" enctype="multipart/form-data">
                        <input type="hidden" name="test_case_id" value="${testCase.id}">
                        
                        <div class="test-case-info" style="background: var(--bg-hover); padding: 15px; border-radius: var(--radius-md); margin-bottom: 20px;">
                            <h4 style="margin-bottom: 10px; color: var(--primary);">${escapeHtml(testCase.test_name)}</h4>
                            
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 15px;">
                                ${testCase.input_data ? `
                                    <div>
                                        <strong>Input:</strong>
                                        <pre style="background: var(--bg-card); padding: 8px; border-radius: var(--radius-sm); margin-top: 5px;">${escapeHtml(testCase.input_data)}</pre>
                                    </div>
                                ` : ''}
                                
                                ${testCase.expected_output ? `
                                    <div>
                                        <strong>Expected Output:</strong>
                                        <pre style="background: var(--bg-card); padding: 8px; border-radius: var(--radius-sm); margin-top: 5px;">${escapeHtml(testCase.expected_output)}</pre>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label>Actual Output <span class="required">*</span></label>
                            <textarea name="actual_output" required rows="4" placeholder="Masukkan hasil actual test...">${escapeHtml(testCase.actual_output || '')}</textarea>
                        </div>
                        
                        <div class="form-group">
                            <label>Status <span class="required">*</span></label>
                            <select name="status" required>
                                <option value="pending" ${testCase.status === 'pending' ? 'selected' : ''}>Pending</option>
                                <option value="passed" ${testCase.status === 'passed' ? 'selected' : ''}>Passed</option>
                                <option value="failed" ${testCase.status === 'failed' ? 'selected' : ''}>Failed</option>
                            </select>
                        </div>
                        
                        <!-- FOTO LAMA (PREVIEW) -->
                        ${testCase.screenshot_url || testCase.cloudinary_url ? `
                        <div class="form-group">
                            <label>Foto Sebelumnya</label>
                            <div class="file-preview active" id="oldScreenshotPreview">
                                <div class="file-preview-item">
                                    <i class="fas fa-image"></i>
                                    <span class="name">Current Screenshot</span>
                                    <a href="${testCase.screenshot_url || testCase.cloudinary_url}" target="_blank" class="btn-icon" title="View">
                                        <i class="fas fa-eye"></i>
                                    </a>
                                    <span class="badge" style="background: var(--primary); color: white; margin-left: 10px;">Foto 1</span>
                                </div>
                            </div>
                        </div>
                        ` : ''}
                        
                        <!-- UPLOAD FOTO BARU -->
                        <div class="form-group">
                            <label>Upload Foto Baru</label>
                            <div class="file-upload-area" id="screenshotDropZone">
                                <i class="fas fa-cloud-upload-alt"></i>
                                <p>Drag & drop screenshot baru atau <span class="browse-link">browse</span></p>
                                <input type="file" name="screenshot" id="screenshotInput" accept="image/*" style="display: none;">
                            </div>
                            <div id="screenshotPreview" class="file-preview"></div>
                            <small class="form-text">Upload foto baru akan menambahkan foto kedua (foto lama tetap disimpan)</small>
                        </div>
                        
                        <div class="form-group">
                            <label>Note</label>
                            <textarea name="note" rows="3" placeholder="Tambah catatan...">${escapeHtml(testCase.note || '')}</textarea>
                        </div>
                        
                        <div class="form-actions">
                            <button type="button" class="btn-secondary" onclick="this.closest('.modal').remove()">
                                Batal
                            </button>
                            <button type="submit" class="btn-primary">
                                <i class="fas fa-save"></i> Update Result
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Setup file upload
        const dropZone = document.getElementById('screenshotDropZone');
        const fileInput = document.getElementById('screenshotInput');
        const preview = document.getElementById('screenshotPreview');
        
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
                const files = e.dataTransfer.files;
                if (files.length > 0) {
                    fileInput.files = files;
                    previewScreenshot(files[0]);
                }
            });
            
            fileInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    previewScreenshot(e.target.files[0]);
                }
            });
        }
        
        function previewScreenshot(file) {
            if (!file.type.startsWith('image/')) {
                showNotification('❌ File harus berupa gambar', 'error');
                return;
            }
            
            if (file.size > 5 * 1024 * 1024) {
                showNotification('❌ Ukuran file maksimal 5MB', 'error');
                fileInput.value = '';
                return;
            }
            
            const reader = new FileReader();
            reader.onload = (e) => {
                preview.innerHTML = `
                    <div class="file-preview-item">
                        <img src="${e.target.result}" style="width: 40px; height: 40px; object-fit: cover; border-radius: var(--radius-sm);">
                        <span class="name">${escapeHtml(file.name)}</span>
                        <span class="size">${formatFileSize(file.size)}</span>
                        <span class="badge" style="background: var(--success); color: white; margin-left: 10px;">Foto Baru</span>
                        <button type="button" onclick="document.getElementById('screenshotInput').value = ''; this.closest('.file-preview').innerHTML = ''; this.closest('.file-preview').classList.remove('active');">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                `;
                preview.classList.add('active');
            };
            reader.readAsDataURL(file);
        }
        
        const form = document.getElementById('updateTestCaseForm');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(e.target);
            
            const actualOutput = formData.get('actual_output');
            const status = formData.get('status');
            
            if (!actualOutput || !actualOutput.trim()) {
                showNotification('❌ Actual output harus diisi', 'error');
                return;
            }
            
            if (!status) {
                showNotification('❌ Status harus dipilih', 'error');
                return;
            }
            
            const submitBtn = form.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';
            submitBtn.disabled = true;
            
            try {
                showNotification('🔄 Mengupdate test case...', 'info');
                
                const response = await fetch(`/api/test-cases/${testCaseId}/result`, {
                    method: 'PUT',
                    headers: { 'Authorization': `Bearer ${currentToken}` },
                    body: formData
                });
                
                if (!response.ok) {
                    let errorMessage = `HTTP ${response.status}`;
                    try {
                        const errorData = await response.json();
                        errorMessage = errorData.error || errorMessage;
                    } catch {
                        const errorText = await response.text();
                        errorMessage = errorText || errorMessage;
                    }
                    throw new Error(errorMessage);
                }
                
                const data = await response.json();
                
                if (data.success) {
                    showNotification('✅ Test case berhasil diupdate (2 foto disimpan)', 'success');
                    
                    // 🔥 FIX: JANGAN TUTUP MODAL LANGSUNG
                    // Tapi update konten modal untuk menunjukkan sukses
                    const modalBody = modal.querySelector('.modal-body');
                    modalBody.innerHTML = `
                        <div class="auth-success" style="text-align: center; padding: 40px;">
                            <i class="fas fa-check-circle" style="font-size: 64px; color: var(--success); margin-bottom: 20px;"></i>
                            <h3 style="margin-bottom: 15px;">Update Berhasil!</h3>
                            <p style="margin-bottom: 25px; color: var(--text-secondary);">
                                Test case telah diupdate.<br>
                                ${testCase.screenshot_url ? 'Foto lama tetap tersimpan.' : ''}<br>
                                Foto baru telah ditambahkan.
                            </p>
                            <div style="display: flex; gap: 15px; justify-content: center;">
                                <button class="btn-primary" onclick="location.reload()">
                                    <i class="fas fa-sync-alt"></i> Refresh Halaman
                                </button>
                                <button class="btn-secondary" onclick="this.closest('.modal').remove()">
                                    <i class="fas fa-times"></i> Tutup
                                </button>
                            </div>
                        </div>
                    `;
                    
                    // 🔥 FIX: Load ulang test cases TANPA MENUTUP MODAL TASK DETAIL
                    if (taskId) {
                        // Refresh test cases di task detail
                        const testCasesList = document.getElementById('testCasesList');
                        if (testCasesList) {
                            await loadTestCases(taskId);
                        }
                    }
                    
                    // Refresh data tasks
                    await loadTasks();
                    
                } else {
                    showNotification('❌ ' + (data.error || 'Gagal mengupdate test case'), 'error');
                }
            } catch (error) {
                console.error('Update test case error:', error);
                showNotification('❌ Gagal mengupdate test case: ' + error.message, 'error');
            } finally {
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
            }
        });
        
    } catch (error) {
        console.error('Error loading test case:', error);
        showNotification('❌ Gagal memuat data test case: ' + error.message, 'error');
    }
}

// Helper function to load test cases data
async function loadTestCasesData(taskId) {
    try {
        const response = await fetch(`/api/tasks/${taskId}/test-cases`, {
            headers: {
                'Authorization': `Bearer ${currentToken}`
            }
        });
        return await response.json();
    } catch (error) {
        console.error('Load test cases data error:', error);
        return [];
    }
}

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
            
            const modal = document.querySelector('.modal.active');
            if (modal) modal.remove();
            
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
            
            const modal = document.querySelector('.modal.active');
            if (modal) modal.remove();
            
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
            
            const modal = document.querySelector('.modal.active');
            if (modal) modal.remove();
            
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
            
            currentUser = { ...currentUser, ...data };
            localStorage.setItem('user', JSON.stringify(currentUser));
            
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
    
    let filteredTasks = [...tasks];
    
    const statusFilter = document.getElementById('filterStatus')?.value;
    if (statusFilter && statusFilter !== 'all') {
        filteredTasks = filteredTasks.filter(t => t.status === statusFilter);
    }
    
    if (currentUser && currentUser.role === 'admin') {
        const assigneeFilter = document.getElementById('filterAssignee')?.value;
        if (assigneeFilter && assigneeFilter !== 'all') {
            filteredTasks = filteredTasks.filter(t => t.assignee_id == assigneeFilter);
        }
    } else {
        filteredTasks = filteredTasks.filter(t => t.assignee_id === currentUser?.id);
    }
    
    if (currentView === 'completed') {
        filteredTasks = filteredTasks.filter(t => t.status === 'completed' || t.status === 'approved');
    }
    
    const searchTerm = document.getElementById('globalSearch')?.value?.toLowerCase();
    if (searchTerm) {
        filteredTasks = filteredTasks.filter(t => 
            (t.title && t.title.toLowerCase().includes(searchTerm)) ||
            (t.description && t.description.toLowerCase().includes(searchTerm))
        );
    }
    
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
                        <i class="fas ${getStatusIcon(task.status)}"></i> 
                        ${task.status === 'completed' && task.approval_status === 'pending' 
                            ? 'Waiting Approval' 
                            : getStatusText(task.status)}
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

// =============== FIXED: showTaskDetail dengan perbaikan test cases ===============
async function showTaskDetail(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content task-detail-modal">
            <div class="modal-header">
                <div class="modal-header-left">
                    <i class="fas fa-clipboard-list"></i>
                    <h3>Task Details</h3>
                </div>
                <div class="modal-header-right">
                    <span class="task-id-badge">#${task.id}</span>
                    <button class="modal-close" onclick="this.closest('.modal').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
            
            <div class="modal-body">
                <div class="task-detail-container">
                    <div class="task-detail-header">
                        <h2 class="task-detail-title">${escapeHtml(task.title)}</h2>
                        <div class="task-detail-badges">
                            ${task.status === 'approved' ? `
                                <span class="status-badge approved">
                                    <i class="fas fa-check-double"></i> Approved
                                </span>
                            ` : task.status === 'rejected' ? `
                                <span class="status-badge rejected">
                                    <i class="fas fa-times-circle"></i> Rejected
                                </span>
                            ` : task.status === 'completed' && task.approval_status === 'pending' ? `
                                <span class="status-badge completed">
                                    <i class="fas fa-check-circle"></i> Completed (Pending Approval)
                                </span>
                            ` : task.status === 'completed' ? `
                                <span class="status-badge completed">
                                    <i class="fas fa-check-circle"></i> Completed
                                </span>
                            ` : `
                                <span class="status-badge ${task.status}">
                                    <i class="fas ${getStatusIcon(task.status)}"></i> ${getStatusText(task.status)}
                                </span>
                            `}
                        </div>
                    </div>
                    
                    <div class="task-info-grid">
                        <div class="info-card">
                            <div class="info-icon"><i class="fas fa-user-circle"></i></div>
                            <div class="info-content">
                                <span class="info-label">Assignee</span>
                                <span class="info-value">${escapeHtml(task.assignee_name || task.assignee_username || 'Unassigned')}</span>
                            </div>
                        </div>
                        <div class="info-card">
                            <div class="info-icon"><i class="fas fa-user-tie"></i></div>
                            <div class="info-content">
                                <span class="info-label">Created By</span>
                                <span class="info-value">${escapeHtml(task.creator_username || 'System')}</span>
                            </div>
                        </div>
                        <div class="info-card">
                            <div class="info-icon"><i class="fas fa-calendar-alt"></i></div>
                            <div class="info-content">
                                <span class="info-label">Created At</span>
                                <span class="info-value">${formatDate(task.created_at)}</span>
                                <span class="info-sub">${timeAgo(task.created_at)}</span>
                            </div>
                        </div>
                        ${task.completed_at ? `
                        <div class="info-card">
                            <div class="info-icon success"><i class="fas fa-check-circle"></i></div>
                            <div class="info-content">
                                <span class="info-label">Completed At</span>
                                <span class="info-value">${formatDate(task.completed_at)}</span>
                                <span class="info-sub">${timeAgo(task.completed_at)}</span>
                            </div>
                        </div>
                        ` : ''}
                        ${task.approved_at ? `
                        <div class="info-card">
                            <div class="info-icon primary"><i class="fas fa-check-double"></i></div>
                            <div class="info-content">
                                <span class="info-label">Approved At</span>
                                <span class="info-value">${formatDate(task.approved_at)}</span>
                                <span class="info-sub">by ${escapeHtml(task.approver_username || 'Admin')}</span>
                            </div>
                        </div>
                        ` : ''}
                    </div>
                    
                    <div class="task-section">
                        <div class="section-title">
                            <i class="fas fa-align-left"></i>
                            <h4>Description</h4>
                        </div>
                        <div class="description-box">
                            ${escapeHtml(task.description || 'No description provided.').replace(/\n/g, '<br>')}
                        </div>
                    </div>
                    
                    ${task.result_text ? `
                    <div class="task-section">
                        <div class="section-title">
                            <i class="fas fa-file-alt"></i>
                            <h4>Work Result</h4>
                        </div>
                        <div class="result-box">
                            ${escapeHtml(task.result_text).replace(/\n/g, '<br>')}
                        </div>
                    </div>
                    ` : ''}
                    
                    ${task.file_path ? `
                    <div class="task-section">
                        <div class="section-title">
                            <i class="fas fa-paperclip"></i>
                            <h4>Attachments</h4>
                        </div>
                        <div class="file-attachment-card">
                            <div class="file-icon">
                                <i class="fas ${getFileIcon(task.file_name)}"></i>
                            </div>
                            <div class="file-details">
                                <div class="file-name">${escapeHtml(task.file_name || path.basename(task.file_path))}</div>
                                <div class="file-meta">
                                    <span class="file-type">${getFileType(task.file_name)}</span>
                                    <span class="file-size">${task.file_size ? formatFileSize(task.file_size) : 'Unknown'}</span>
                                </div>
                            </div>
                            <div class="file-actions">
                                <button class="btn-icon" onclick="previewFile('${task.file_url}')" title="Preview">
                                    <i class="fas fa-eye"></i>
                                </button>
                                <a href="${task.file_url}" download="${task.file_name}" class="btn-icon" title="Download">
                                    <i class="fas fa-download"></i>
                                </a>
                            </div>
                        </div>
                    </div>
                    ` : ''}
                    
                    <div class="task-section">
                        <div class="section-title">
                            <i class="fas fa-flask"></i>
                            <h4>Test Cases</h4>
                            ${task.assignee_id === currentUser?.id || currentUser?.role === 'admin' ? `
                                <button class="btn-sm btn-primary" onclick="showAddTestCaseModal(${task.id})">
                                    <i class="fas fa-plus"></i> Add Test
                                </button>
                            ` : ''}
                        </div>
                        <div id="testCasesList" class="test-cases-grid">
                            <div class="loading-spinner small"></div>
                        </div>
                    </div>
                    
                    <div class="task-actions-footer">
                        ${task.assignee_id === currentUser?.id ? `
                            <button class="action-btn start" onclick="updateTaskStatus(${task.id}, 'in_progress')" 
                                    ${task.status === 'in_progress' ? 'disabled' : ''}>
                                <i class="fas fa-play"></i> Start
                            </button>
                            <button class="action-btn complete" onclick="updateTaskStatus(${task.id}, 'completed')"
                                    ${task.status === 'completed' || task.status === 'approved' ? 'disabled' : ''}>
                                <i class="fas fa-check"></i> Complete
                            </button>
                            <button class="action-btn upload" onclick="showUploadResultModal(${task.id})">
                                <i class="fas fa-upload"></i> Upload Result
                            </button>
                        ` : ''}
                        
                        ${currentUser?.role === 'admin' && task.status === 'completed' && task.approval_status === 'pending' ? `
                            <button class="action-btn approve" onclick="approveTask(${task.id})">
                                <i class="fas fa-check-double"></i> Approve
                            </button>
                            <button class="action-btn reject" onclick="showRejectModal(${task.id})">
                                <i class="fas fa-times"></i> Reject
                            </button>
                        ` : ''}
                        
                        ${currentUser?.role === 'admin' ? `
                            <button class="action-btn delete" onclick="deleteTask(${task.id})">
                                <i class="fas fa-trash"></i> Delete
                            </button>
                        ` : ''}
                        
                        <button class="action-btn close" onclick="this.closest('.modal').remove()">
                            <i class="fas fa-times"></i> Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    loadTestCases(task.id);
}

function showAddTestCaseModal(taskId) {
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

function showRejectModal(taskId) {
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

function showCreateUserModal() {
    if (!currentUser || currentUser.role !== 'admin') return;
    
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

// =============== FIXED: loadTestCases dengan tombol screenshot yang benar ===============
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
                <div class="empty-state-test">
                    <i class="fas fa-flask"></i>
                    <h5>No Test Cases</h5>
                    <p>Belum ada test case untuk task ini</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = testCases.map(tc => {
            // Cek apakah user boleh mengupdate (current user adalah assignee atau admin)
            const canUpdate = currentUser && (
    currentUser.role === 'admin' || 
    (tc.executed_by && tc.executed_by === currentUser.id) ||
    (tc.assignee_id && tc.assignee_id === currentUser.id)
);            
            // Format screenshot URL
            let screenshotUrl = tc.screenshot_url || tc.cloudinary_url;
            if (!screenshotUrl && tc.screenshot_path) {
                // Fallback ke path lokal
                const filename = tc.screenshot_path.split('/').pop();
                screenshotUrl = `/uploads/screenshots/${filename}`;
            }
            
            return `
            <div class="test-case-card ${tc.status || 'pending'}">
                <div class="test-case-header">
                    <div class="test-case-title">
                        <i class="fas ${tc.status === 'passed' ? 'fa-check-circle' : tc.status === 'failed' ? 'fa-times-circle' : 'fa-clock'}"></i>
                        <h6>${escapeHtml(tc.test_name)}</h6>
                    </div>
                    <span class="status-badge ${tc.status || 'pending'}">${tc.status || 'pending'}</span>
                </div>
                
                ${tc.test_description ? `<p class="test-description">${escapeHtml(tc.test_description)}</p>` : ''}
                
                <div class="test-details">
                    ${tc.input_data ? `<div class="test-detail-item"><span class="detail-label">Input:</span> <code>${escapeHtml(tc.input_data)}</code></div>` : ''}
                    ${tc.expected_output ? `<div class="test-detail-item"><span class="detail-label">Expected:</span> <code>${escapeHtml(tc.expected_output)}</code></div>` : ''}
                    ${tc.actual_output ? `<div class="test-detail-item"><span class="detail-label">Actual:</span> <code>${escapeHtml(tc.actual_output)}</code></div>` : ''}
                </div>
                
                ${screenshotUrl ? `
                    <div class="test-screenshot">
                        <button class="btn-screenshot" onclick="previewImage('${screenshotUrl}')">
                            <i class="fas fa-image"></i> View Screenshot
                        </button>
                    </div>
                ` : ''}
                
                ${tc.executed_by ? `
                    <div class="test-footer">
                        <span><i class="fas fa-user"></i> ${escapeHtml(tc.executed_by_username)}</span>
                        <span><i class="fas fa-clock"></i> ${timeAgo(tc.executed_at)}</span>
                    </div>
                ` : ''}
                
                ${canUpdate ? `
                    <div class="test-actions">
                        <button class="btn-sm" onclick="updateTestCaseResult(${tc.id})">
                            <i class="fas fa-edit"></i> Update Result
                        </button>
                    </div>
                ` : ''}
            </div>
        `}).join('');
        
    } catch (error) {
        console.error('Load test cases error:', error);
        container.innerHTML = '<p class="error">Gagal memuat test cases</p>';
    }
}

// =============== FILE PREVIEW ===============

function previewFile(fileUrl) {
    if (!fileUrl) return;
    
    const isImage = fileUrl.match(/\.(jpg|jpeg|png|gif|webp|bmp)$/i);
    
    if (isImage) {
        previewImage(fileUrl);
        return;
    }
    
    const isPDF = fileUrl.match(/\.pdf$/i);
    
    if (isPDF) {
        window.open(fileUrl, '_blank');
        return;
    }
    
    // Untuk file lain, download langsung
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = fileUrl.split('/').pop();
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// =============== FIXED: previewImage dengan error handling ===============
// =============== FIXED: previewImage dengan error handling ===============
function previewImage(imageUrl) {
    if (!imageUrl) {
        showNotification('❌ URL gambar tidak ditemukan', 'error');
        return;
    }
    
    console.log('Previewing image:', imageUrl); // Debug
    
    // Jika URL relatif (dimulai dengan /), tambahkan base URL
    let finalUrl = imageUrl;
    if (imageUrl.startsWith('/')) {
        const baseUrl = window.location.origin;
        finalUrl = baseUrl + imageUrl;
    }
    
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content image-preview-modal">
            <div class="modal-header">
                <div class="modal-header-left">
                    <i class="fas fa-image"></i>
                    <h3>Image Preview</h3>
                </div>
                <button class="modal-close" onclick="this.closest('.modal').remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body image-preview-body">
                <img src="${finalUrl}" 
                     class="image-preview" 
                     alt="Preview" 
                     onerror="this.onerror=null; this.parentElement.innerHTML='<div class=\\'error-message\\'><i class=\\'fas fa-exclamation-triangle\\'></i><p>Gagal memuat gambar</p><p class=\\'error-url\\'>URL: ${finalUrl}</p><button class=\\'btn-primary\\' onclick=\\'window.open(\\'${finalUrl}\\', \\'_blank\\')\\'>Buka di Tab Baru</button></div>';"
                     onload="console.log('Image loaded successfully')">
                <div class="image-preview-actions">
                    <a href="${finalUrl}" download class="btn-primary" target="_blank">
                        <i class="fas fa-download"></i> Download
                    </a>
                    <a href="${finalUrl}" target="_blank" class="btn-secondary">
                        <i class="fas fa-external-link-alt"></i> Buka di Tab Baru
                    </a>
                    <button class="btn-secondary" onclick="this.closest('.modal').remove()">
                        <i class="fas fa-times"></i> Close
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// =============== CHARTS ===============

function initCharts() {
    Object.keys(taskCharts).forEach(key => {
        if (taskCharts[key]) {
            taskCharts[key].destroy();
        }
    });
    taskCharts = {};
    
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
                        'rgba(245, 158, 11, 0.8)',
                        'rgba(59, 130, 246, 0.8)',
                        'rgba(16, 185, 129, 0.8)'
                    ],
                    borderWidth: 0,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                },
                cutout: '70%'
            }
        });
    }
    
    const activityChartCanvas = document.getElementById('activityChart');
    if (activityChartCanvas && typeof Chart !== 'undefined') {
        const ctx = activityChartCanvas.getContext('2d');
        
        fetch('/api/weekly-activity', {
            headers: {
                'Authorization': `Bearer ${currentToken}`
            }
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                taskCharts.activity = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: data.labels || ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'],
                        datasets: [{
                            label: 'Tasks',
                            data: data.data || [0, 0, 0, 0, 0, 0, 0],
                            borderColor: 'rgba(181, 139, 91, 0.8)',
                            backgroundColor: 'rgba(181, 139, 91, 0.1)',
                            tension: 0.4,
                            fill: true,
                            pointBackgroundColor: 'rgba(181, 139, 91, 0.8)',
                            pointBorderColor: '#fff',
                            pointBorderWidth: 2,
                            pointRadius: 4,
                            pointHoverRadius: 6
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                display: false
                            }
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                grid: {
                                    color: 'rgba(0,0,0,0.05)'
                                }
                            },
                            x: {
                                grid: {
                                    display: false
                                }
                            }
                        }
                    }
                });
            }
        })
        .catch(error => {
            console.error('Error loading weekly activity:', error);
            taskCharts.activity = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'],
                    datasets: [{
                        label: 'Tasks',
                        data: [3, 5, 2, 8, 6, 4, 7],
                        borderColor: 'rgba(181, 139, 91, 0.8)',
                        backgroundColor: 'rgba(181, 139, 91, 0.1)',
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
        'rejected': 'fa-times-circle',
        'waiting_approval': 'fa-hourglass-half'
    };
    return icons[status] || 'fa-tag';
}

function getStatusText(status) {
    const texts = {
        'pending': 'Pending',
        'in_progress': 'In Progress',
        'completed': 'Completed',
        'approved': 'Approved',
        'rejected': 'Rejected',
        'waiting_approval': 'Waiting Approval'
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
        'REGISTER': 'fa-user-plus',
        'CREATE_GROUP': 'fa-users',
        'ADD_MEMBERS': 'fa-user-plus',
        'REMOVE_MEMBER': 'fa-user-minus',
        'TRANSFER_ADMIN': 'fa-crown'
    };
    return icons[action] || 'fa-bell';
}

function getFileIcon(filename) {
    if (!filename) return 'fa-file';
    const ext = filename.split('.').pop()?.toLowerCase();
    const icons = {
        'jpg': 'fa-file-image', 'jpeg': 'fa-file-image', 'png': 'fa-file-image', 
        'gif': 'fa-file-image', 'webp': 'fa-file-image', 'bmp': 'fa-file-image',
        'pdf': 'fa-file-pdf',
        'doc': 'fa-file-word', 'docx': 'fa-file-word',
        'xls': 'fa-file-excel', 'xlsx': 'fa-file-excel',
        'zip': 'fa-file-archive', 'rar': 'fa-file-archive', '7z': 'fa-file-archive',
        'txt': 'fa-file-alt',
        'mp4': 'fa-file-video', 'avi': 'fa-file-video', 'mov': 'fa-file-video', 'mkv': 'fa-file-video',
        'mp3': 'fa-file-audio', 'wav': 'fa-file-audio'
    };
    return icons[ext] || 'fa-file';
}

function getFileType(filename) {
    if (!filename) return 'Unknown';
    const ext = filename.split('.').pop()?.toUpperCase();
    return ext ? ext + ' File' : 'Unknown';
}

function timeAgo(dateString) {
    if (!dateString) return '';
    try {
        const date = new Date(dateString);
        const now = new Date();
        const seconds = Math.floor((now - date) / 1000);
        
        if (seconds < 60) return 'just now';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        if (days < 7) return `${days}d ago`;
        return formatDate(dateString);
    } catch (e) {
        return '';
    }
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
            <i class="fas ${getFileIcon(file.name)}"></i>
            <span class="name">${escapeHtml(file.name)}</span>
            <span class="size">${formatFileSize(file.size)}</span>
            <button type="button" onclick="this.closest('.file-preview-item').remove(); this.closest('.file-preview').classList.remove('active');">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
    preview.classList.add('active');
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

// =============== PATH UTILITY ===============
const path = {
    basename: function(p) {
        if (!p) return '';
        const parts = p.split(/[\/\\]/);
        return parts[parts.length - 1];
    },
    dirname: function(p) {
        if (!p) return '';
        const parts = p.split(/[\/\\]/);
        parts.pop();
        return parts.join('/');
    }
};

// =============== SHOW CREATE TASK MODAL ===============

function showCreateTaskModal() {
    if (!currentUser || currentUser.role !== 'admin') {
        showNotification('❌ Hanya admin yang dapat membuat task', 'error');
        return;
    }
    
    const existingModal = document.querySelector('.modal.active');
    if (existingModal) existingModal.remove();
    
    const modal = document.createElement('div');
    modal.className = 'modal active';
    
    modal.innerHTML = `
        <div class="modal-content large">
            <div class="modal-header">
                <h3><i class="fas fa-plus-circle"></i> Buat Task Baru</h3>
                <button class="modal-close" onclick="this.closest('.modal').remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            
            <div class="modal-body">
                <form id="createTaskForm" enctype="multipart/form-data">
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
                            ${users.map(user => 
                                `<option value="${user.id}">${escapeHtml(user.full_name || user.username)}</option>`
                            ).join('')}
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label>Lampiran File</label>
                        <div class="file-upload-area" id="modalFileDropZone">
                            <i class="fas fa-cloud-upload-alt"></i>
                            <p>Drag & drop file atau <span class="browse-link" onclick="document.getElementById('modalFileInput').click()">browse</span></p>
                            <input type="file" name="file" id="modalFileInput" style="display: none;" onchange="handleFileSelect(this.files[0], 'modalFilePreview')">
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
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                fileInput.files = files;
                handleFileSelect(files[0], 'modalFilePreview');
            }
        });
    }
    
    const createTaskForm = document.getElementById('createTaskForm');
    if (createTaskForm) {
        createTaskForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(e.target);
            
            try {
                showNotification('🔄 Membuat task...', 'info');
                
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
                    modal.remove();
                    loadTasks();
                    loadStats();
                } else {
                    showNotification('❌ ' + (data.error || 'Gagal membuat task'), 'error');
                }
            } catch (error) {
                console.error('Create task error:', error);
                showNotification('❌ Gagal membuat task', 'error');
            }
        });
    }
}

async function showUploadResultModal(taskId) {
    const existingModal = document.querySelector('.modal.active');
    if (existingModal) existingModal.remove();
    
    // Cari data task
    const task = tasks.find(t => t.id == taskId);
    if (!task) {
        showNotification('❌ Task tidak ditemukan', 'error');
        return;
    }
    
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3><i class="fas fa-upload"></i> Upload Hasil Task</h3>
                <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            
            <div class="modal-body">
                <div class="task-info" style="background: var(--bg-hover); padding: 15px; border-radius: var(--radius-md); margin-bottom: 20px;">
                    <h4 style="margin-bottom: 10px; color: var(--primary);">${escapeHtml(task.title)}</h4>
                    <p style="color: var(--text-secondary); margin-bottom: 5px;">${escapeHtml(task.description || '')}</p>
                    <div style="display: flex; gap: 20px; margin-top: 10px;">
                        <span><strong>Status:</strong> <span class="status-badge ${task.status}">${getStatusText(task.status)}</span></span>
                        <span><strong>Assignee:</strong> ${escapeHtml(task.assignee_name || task.assignee_username || 'Unknown')}</span>
                    </div>
                </div>
                
                <form id="uploadResultForm" enctype="multipart/form-data">
                    <input type="hidden" name="task_id" value="${taskId}">
                    
                    <div class="form-group">
                        <label>Hasil Pekerjaan (Text)</label>
                        <textarea name="result_text" rows="6" placeholder="Jelaskan hasil pekerjaan Anda secara detail...">${escapeHtml(task.result_text || '')}</textarea>
                        <small class="form-text">Deskripsikan apa yang telah Anda kerjakan</small>
                    </div>
                    
                    <div class="form-group">
                        <label>Upload File (Opsional)</label>
                        <div class="file-upload-area" id="resultFileDropZone">
                            <i class="fas fa-cloud-upload-alt"></i>
                            <p>Drag & drop file atau <span class="browse-link">browse</span></p>
                            <input type="file" name="result_file" id="resultFileInput" style="display: none;">
                        </div>
                        <div id="resultFilePreview" class="file-preview"></div>
                        <small class="form-text">Maksimal 50MB. Format: PDF, DOC, DOCX, XLS, XLSX, TXT, ZIP, RAR, gambar</small>
                    </div>
                    
                    ${task.file_url ? `
                        <div class="form-group">
                            <label>File Sebelumnya</label>
                            <div class="file-preview active">
                                <div class="file-preview-item">
                                    <i class="fas ${getFileIcon(task.file_name)}"></i>
                                    <span class="name">${escapeHtml(task.file_name || 'File')}</span>
                                    <a href="${task.file_url}" download class="btn-icon" target="_blank">
                                        <i class="fas fa-download"></i>
                                    </a>
                                </div>
                            </div>
                        </div>
                    ` : ''}
                    
                    <div class="form-actions">
                        <button type="button" class="btn-secondary" onclick="this.closest('.modal').remove()">
                            Batal
                        </button>
                        <button type="submit" class="btn-primary">
                            <i class="fas fa-upload"></i> Upload Hasil
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Setup file upload
    const dropZone = document.getElementById('resultFileDropZone');
    const fileInput = document.getElementById('resultFileInput');
    const preview = document.getElementById('resultFilePreview');
    
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
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                fileInput.files = files;
                previewFileUpload(files[0]);
            }
        });
        
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                previewFileUpload(e.target.files[0]);
            }
        });
    }
    
    function previewFileUpload(file) {
        const maxSize = 50 * 1024 * 1024;
        if (file.size > maxSize) {
            showNotification('❌ Ukuran file maksimal 50MB', 'error');
            fileInput.value = '';
            return;
        }
        
        const isImage = file.type.startsWith('image/');
        
        if (isImage) {
            const reader = new FileReader();
            reader.onload = (e) => {
                preview.innerHTML = `
                    <div class="file-preview-item">
                        <img src="${e.target.result}" style="width: 40px; height: 40px; object-fit: cover; border-radius: var(--radius-sm);">
                        <span class="name">${escapeHtml(file.name)}</span>
                        <span class="size">${formatFileSize(file.size)}</span>
                        <button type="button" onclick="document.getElementById('resultFileInput').value = ''; this.closest('.file-preview').innerHTML = ''; this.closest('.file-preview').classList.remove('active');">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                `;
                preview.classList.add('active');
            };
            reader.readAsDataURL(file);
        } else {
            preview.innerHTML = `
                <div class="file-preview-item">
                    <i class="fas ${getFileIcon(file.name)}"></i>
                    <span class="name">${escapeHtml(file.name)}</span>
                    <span class="size">${formatFileSize(file.size)}</span>
                    <button type="button" onclick="document.getElementById('resultFileInput').value = ''; this.closest('.file-preview').innerHTML = ''; this.closest('.file-preview').classList.remove('active');">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
            preview.classList.add('active');
        }
    }
    
    const form = document.getElementById('uploadResultForm');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        
        try {
            showNotification('🔄 Mengupload hasil...', 'info');
            
            const response = await fetch(`/api/tasks/${taskId}/result`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${currentToken}`
                },
                body: formData
            });
            
            const data = await response.json();
            
            if (data.success) {
                showNotification('✅ Hasil berhasil diupload', 'success');
                modal.remove();
                
                // Refresh data task
                loadTasks();
                
                // Jika task detail sedang terbuka, refresh juga
                const taskModal = document.querySelector('.modal.active');
                if (taskModal) {
                    showTaskDetail(taskId);
                }
            } else {
                showNotification('❌ ' + (data.error || 'Gagal upload hasil'), 'error');
            }
        } catch (error) {
            console.error('Upload result error:', error);
            showNotification('❌ Gagal upload hasil', 'error');
        }
    });
}

function showUploadProfilePictureModal() {
    const existingModal = document.querySelector('.modal.active');
    if (existingModal) existingModal.remove();
    
    const modal = document.createElement('div');
    modal.className = 'modal active';
    
    const template = document.getElementById('upload-profile-picture-modal');
    modal.innerHTML = template.innerHTML;
    
    document.body.appendChild(modal);
    
    const dropZone = document.getElementById('profilePictureDropZone');
    const fileInput = document.getElementById('profilePictureInput');
    
    if (dropZone && fileInput) {
        // Hapus event listener lama untuk menghindari duplikasi
        const newDropZone = dropZone.cloneNode(true);
        dropZone.parentNode.replaceChild(newDropZone, dropZone);
        
        const newFileInput = fileInput.cloneNode(true);
        fileInput.parentNode.replaceChild(newFileInput, fileInput);
        
        // Re-attach event listeners
        newDropZone.addEventListener('click', () => newFileInput.click());
        
        newDropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            newDropZone.classList.add('dragover');
        });
        
        newDropZone.addEventListener('dragleave', () => {
            newDropZone.classList.remove('dragover');
        });
        
        newDropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            newDropZone.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                newFileInput.files = files;
                handleProfilePictureSelect(files[0]);
            }
        });
        
        newFileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handleProfilePictureSelect(e.target.files[0]);
            }
        });
        
        // Untuk mobile, tambahkan touch events
        newDropZone.addEventListener('touchstart', (e) => {
            e.preventDefault();
            newFileInput.click();
        });
    }
    
    // Pastikan modal bisa discroll di mobile
    const modalContent = modal.querySelector('.modal-content');
    if (modalContent) {
        modalContent.style.maxHeight = window.innerHeight * 0.8 + 'px';
        modalContent.style.overflowY = 'auto';
    }
}

function handleProfilePictureSelect(file) {
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
        showNotification('❌ Hanya file gambar yang diperbolehkan', 'error');
        return;
    }
    
    if (file.size > 2 * 1024 * 1024) {
        showNotification('❌ Ukuran file maksimal 2MB', 'error');
        return;
    }
    
    selectedProfilePicture = file;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        const preview = document.getElementById('profilePicturePreview');
        if (preview) {
            preview.innerHTML = `
                <div class="file-preview-item">
                    <i class="fas ${getFileIcon(file.name)}"></i>
                    <span class="name">${escapeHtml(file.name)}</span>
                    <span class="size">${formatFileSize(file.size)}</span>
                    <button type="button" onclick="removeProfilePicture()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
            preview.classList.add('active');
        }
    };
    reader.readAsDataURL(file);
}

function removeProfilePicture() {
    selectedProfilePicture = null;
    const preview = document.getElementById('profilePicturePreview');
    if (preview) {
        preview.classList.remove('active');
        preview.innerHTML = '';
    }
    document.getElementById('profilePictureInput').value = '';
}

async function uploadProfilePicture() {
    if (!selectedProfilePicture) {
        showNotification('❌ Pilih foto terlebih dahulu', 'error');
        return;
    }
    
    const formData = new FormData();
    formData.append('profile_picture', selectedProfilePicture);
    
    try {
        showNotification('🔄 Mengupload foto...', 'info');
        
        const response = await fetch('/api/profile/picture', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${currentToken}`
            },
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
            const modal = document.querySelector('.modal.active');
            if (modal) modal.remove();
            
            selectedProfilePicture = null;
            
            // Update profile view jika sedang di halaman profile
            if (currentView === 'profile') {
                renderProfileView();
            }
            
            // Update sidebar avatar
            updateSidebarProfile();
            
            // Refresh chat rooms list untuk update foto di daftar chat
            if (chatRooms.length > 0) {
                await loadChatRooms();
            }
            
            // HANYA panggil loadRoomMessages jika MASIH di chat room yang sama
            if (currentChatRoom && currentView === 'chat') {
                // Cek dulu apakah container chat messages ada
                const container = document.getElementById('chatMessages');
                if (container) {
                    await loadRoomMessages(currentChatRoom.id);
                } else {
                    console.log('Chat container not available, skipping message reload');
                }
            }
            
            showNotification('✅ Foto profile diperbarui', 'success');
        } else {
            showNotification('❌ ' + (data.error || 'Gagal upload foto'), 'error');
        }
    } catch (error) {
        console.error('Upload profile picture error:', error);
        showNotification('❌ Gagal upload foto', 'error');
    }
}

function updateSidebarProfile() {
    const sidebarAvatar = document.querySelector('.user-avatar');
    if (!sidebarAvatar) return;
    
    getProfilePictureUrlFixed(currentUser.id).then(profilePicUrl => {
        if (profilePicUrl) {
            sidebarAvatar.innerHTML = `<img src="${profilePicUrl}" alt="Profile" style="width: 100%; height: 100%; object-fit: cover; border-radius: var(--radius-lg);">`;
        } else {
            sidebarAvatar.innerHTML = `<i class="fas ${currentUser.role === 'admin' ? 'fa-user-shield' : 'fa-user'}"></i>`;
        }
    }).catch(error => {
        console.error('Error updating sidebar profile:', error);
    });
}

// Fungsi untuk mendapatkan URL foto profile (VERSI CLOUDINARY)
async function getProfilePictureUrlFixed(userId) {
    try {
        const response = await fetch(`/api/profile/picture/${userId}`, {
            headers: {
                'Authorization': `Bearer ${currentToken}`
            }
        });
        
        const data = await response.json();
        
        if (data.success && data.has_picture) {
            return data.file_url;
        }
        return null;
    } catch (error) {
        console.error('Get profile picture error:', error);
        return null;
    }
}

// =============== GROUP FUNCTIONS ===============

function renderGroupsView() {
    const contentArea = document.getElementById('contentArea');
    if (!contentArea) return;
    
    const template = document.getElementById('groups-view-template');
    if (template) {
        contentArea.innerHTML = template.innerHTML;
    } else {
        // Fallback jika template belum ada di HTML
        contentArea.innerHTML = `
            <div class="groups-view">
                <div class="groups-header glassmorphism">
                    <h3><i class="fas fa-users"></i> Groups</h3>
                    <button class="btn-primary" onclick="showCreateGroupModal()">
                        <i class="fas fa-plus"></i> Create Group
                    </button>
                </div>

                <div class="groups-tabs">
                    <button class="tab-btn active" onclick="switchGroupsTab('my-groups')">My Groups</button>
                    <button class="tab-btn" onclick="switchGroupsTab('invitations')">
                        Invitations
                        <span class="badge" id="groupInvitationsBadge" style="display: none;">0</span>
                    </button>
                </div>

                <div id="groupsContainer" class="groups-container">
                    <div class="loading-state">
                        <div class="loading-spinner"></div>
                        <p>Loading groups...</p>
                    </div>
                </div>
            </div>
        `;
    }
    
    loadGroups();
    loadGroupInvitations();
}

async function loadGroups() {
    try {
        const response = await fetch('/api/groups', {
            headers: {
                'Authorization': `Bearer ${currentToken}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            groups = data.groups || [];
            displayGroups();
        }
    } catch (error) {
        console.error('Load groups error:', error);
        showNotification('❌ Gagal memuat groups', 'error');
    }
}

function displayGroups() {
    const container = document.getElementById('groupsContainer');
    if (!container) return;
    
    if (groups.length === 0) {
        container.innerHTML = `
            <div class="empty-state-groups">
                <i class="fas fa-users"></i>
                <h3>No Groups Yet</h3>
                <p>Create a group to start collaborating with your team</p>
                <button class="btn-primary" onclick="showCreateGroupModal()">
                    <i class="fas fa-plus"></i> Create Group
                </button>
            </div>
        `;
        return;
    }
    
    container.innerHTML = `
        <div class="groups-grid">
            ${groups.map(group => `
                <div class="group-card" onclick="showGroupDetail(${group.id})">
                    <div class="group-card-header">
                        <div class="group-avatar">
                            ${group.avatar_url ? 
                                `<img src="${group.avatar_url}" alt="${escapeHtml(group.name)}">` : 
                                `<i class="fas fa-users"></i>`
                            }
                        </div>
                        <div class="group-info">
                            <h4>${escapeHtml(group.name)}</h4>
                            <div class="group-meta">
                                <span><i class="fas fa-user"></i> ${group.member_count} members</span>
                                <span><i class="fas fa-calendar"></i> ${formatDate(group.created_at)}</span>
                            </div>
                        </div>
                    </div>
                    <div class="group-card-body">
                        <p>${escapeHtml(group.description || 'No description')}</p>
                    </div>
                    <div class="group-card-footer">
                        <span class="created-by">Created by ${escapeHtml(group.creator_name || group.creator_username)}</span>
                        <div class="group-actions" onclick="event.stopPropagation()">
                            <button class="btn-icon" onclick="openGroupChat(${group.id})" title="Open Chat">
                                <i class="fas fa-comments"></i>
                            </button>
                            <button class="btn-icon" onclick="showGroupDetail(${group.id})" title="Details">
                                <i class="fas fa-info-circle"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function showCreateGroupModal() {
    const existingModal = document.querySelector('.modal.active');
    if (existingModal) existingModal.remove();
    
    const modal = document.createElement('div');
    modal.className = 'modal active';
    
    const template = document.getElementById('create-group-modal-template');
    if (template) {
        modal.innerHTML = template.innerHTML;
    } else {
        // Fallback jika template belum ada
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3><i class="fas fa-users"></i> Create New Group</h3>
                    <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
                </div>

                <div class="modal-body">
                    <form id="createGroupForm" enctype="multipart/form-data">
                        <div class="form-group">
                            <label>Group Avatar</label>
                            <div class="group-avatar-upload" id="groupAvatarPreview">
                                <i class="fas fa-users"></i>
                            </div>
                            <div class="file-upload-area" id="groupAvatarDropZone">
                                <i class="fas fa-cloud-upload-alt"></i>
                                <p>Drag & drop avatar atau <span class="browse-link">browse</span></p>
                                <input type="file" name="avatar" id="groupAvatarInput" accept="image/*" style="display: none;">
                            </div>
                        </div>

                        <div class="form-group">
                            <label>Group Name <span class="required">*</span></label>
                            <input type="text" name="name" required placeholder="e.g., QA Team, Developers">
                        </div>

                        <div class="form-group">
                            <label>Description</label>
                            <textarea name="description" rows="3" placeholder="Group description..."></textarea>
                        </div>

                        <div class="form-actions">
                            <button type="button" class="btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                            <button type="submit" class="btn-primary">
                                <i class="fas fa-save"></i> Create Group
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
    }
    
    document.body.appendChild(modal);
    
    // Setup file upload
    const dropZone = document.getElementById('groupAvatarDropZone');
    const fileInput = document.getElementById('groupAvatarInput');
    const preview = document.getElementById('groupAvatarPreview');
    
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
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                fileInput.files = files;
                previewGroupAvatar(files[0]);
            }
        });
        
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                previewGroupAvatar(e.target.files[0]);
            }
        });
    }
    
    const form = document.getElementById('createGroupForm');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        
        try {
            showNotification('🔄 Creating group...', 'info');
            
            const response = await fetch('/api/groups', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${currentToken}`
                },
                body: formData
            });
            
            const data = await response.json();
            
            if (data.success) {
                showNotification('✅ Group created successfully!', 'success');
                modal.remove();
                loadGroups();
                loadGroupInvitations();
            } else {
                showNotification('❌ ' + (data.error || 'Failed to create group'), 'error');
            }
        } catch (error) {
            console.error('Create group error:', error);
            showNotification('❌ Failed to create group', 'error');
        }
    });
}

function previewGroupAvatar(file) {
    if (!file.type.startsWith('image/')) {
        showNotification('❌ Please select an image file', 'error');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
        const preview = document.getElementById('groupAvatarPreview');
        if (preview) {
            preview.innerHTML = `<img src="${e.target.result}" alt="Avatar">`;
        }
    };
    reader.readAsDataURL(file);
}

// Simpan group yang sedang dibuka di modal (dipakai openGroupChat tanpa parameter)
let currentGroupDetail = null;

// =============== FIXED: showGroupDetail dengan tampilan lebih keren ===============
async function showGroupDetail(groupId) {
    try {
        if (!groupId) {
            showNotification('❌ Group ID tidak valid', 'error');
            return;
        }

        showNotification('🔄 Memuat detail group...', 'info');

        const response = await fetch(`/api/groups/${groupId}`, {
            headers: {
                'Authorization': `Bearer ${currentToken}`
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        if (!data.success) {
            showNotification('❌ Gagal memuat detail group', 'error');
            return;
        }

        const { group, members, invitations } = data;

        // Simpan untuk keperluan lain
        currentGroupDetail = group;

        const existingModal = document.querySelector('.modal.active');
        if (existingModal) existingModal.remove();

        const modal = document.createElement('div');
        modal.className = 'modal active';
        
        // Cek apakah user adalah admin
        const currentMember = members?.find(m => String(m.id) === String(currentUser.id));
        const isAdmin = currentMember?.role === 'admin' || currentUser?.role === 'admin';

        // ✅ TAMBAHKAN 3 BARIS INI UNTUK DEBUG
        console.log('Current user:', currentUser);
        console.log('Current member:', currentMember);
        console.log('Is admin:', isAdmin);

        // Tentukan apakah user masih member
        const isMember = !!currentMember;

        modal.innerHTML = `
            <div class="modal-content group-detail-modal">
                <div class="modal-header">
                    <div class="modal-header-left">
                        <i class="fas fa-users"></i>
                        <h3>Group Details</h3>
                    </div>
                    <div class="modal-header-right">
                        <span class="group-id-badge">#${group.id}</span>
                        <button class="modal-close" onclick="this.closest('.modal').remove()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
                
                <div class="modal-body">
                    <div class="group-detail-container">
                        <!-- HEADER GROUP dengan cover image effect -->
                        <div class="group-cover">
                            <div class="group-avatar-large">
                                ${group.avatar_url ? 
                                    `<img src="${group.avatar_url}" alt="${escapeHtml(group.name)}">` : 
                                    `<i class="fas fa-users"></i>`
                                }
                            </div>
                            <div class="group-cover-content">
                                <h1 class="group-name">${escapeHtml(group.name)}</h1>
                                <div class="group-meta-badges">
                                    <span class="meta-badge"><i class="fas fa-user"></i> ${members?.length || 0} members</span>
                                    <span class="meta-badge"><i class="fas fa-calendar"></i> ${formatDate(group.created_at)}</span>
                                    <span class="meta-badge"><i class="fas fa-user-tie"></i> ${escapeHtml(group.creator_name || group.creator_username || 'Unknown')}</span>
                                </div>
                                ${group.description ? `
                                    <div class="group-description">
                                        <i class="fas fa-quote-right"></i>
                                        <p>${escapeHtml(group.description)}</p>
                                    </div>
                                ` : ''}
                            </div>
                        </div>

                        <!-- ACTION BUTTONS -->
                        <div class="group-action-buttons">
                            <button class="action-btn primary" onclick="openGroupChat(${group.id})">
                                <i class="fas fa-comments"></i>
                                <span>Open Chat</span>
                            </button>
                            
                            ${isAdmin ? `
                                <button class="action-btn warning" onclick="editGroup(${group.id})">
                                    <i class="fas fa-edit"></i>
                                    <span>Edit Group</span>
                                </button>
                            ` : ''}
                            
                            ${isAdmin ? `
                                <button class="action-btn success" onclick="showAddMembersModal(${group.id})">
                                    <i class="fas fa-user-plus"></i>
                                    <span>Add Members</span>
                                </button>
                            ` : ''}
                            
                            ${isAdmin ? `
                                <button class="action-btn danger" onclick="deleteGroup(${group.id})">
                                    <i class="fas fa-trash"></i>
                                    <span>Delete Group</span>
                                </button>
                            ` : ''}
                            
                            ${isMember && !isAdmin ? `
                                <button class="action-btn danger" onclick="leaveGroup(${group.id})">
                                    <i class="fas fa-sign-out-alt"></i>
                                    <span>Leave Group</span>
                                </button>
                            ` : ''}
                        </div>

                        <!-- MEMBERS SECTION -->
                        <div class="group-section">
                            <div class="section-header">
                                <h4><i class="fas fa-users"></i> Members (${members?.length || 0})</h4>
                                ${isAdmin ? `
                                    <button class="btn-sm btn-primary" onclick="showAddMembersModal(${group.id})">
                                        <i class="fas fa-user-plus"></i> Add
                                    </button>
                                ` : ''}
                            </div>

                            <div class="members-grid">
                                ${members?.map(member => {
                                    const isCurrentUserAdmin = isAdmin;
                                    const isMemberAdmin = member.role === 'admin';
                                    const isSelf = String(member.id) === String(currentUser.id);
                                    
                                    return `
                                        <div class="member-card ${isMemberAdmin ? 'admin' : ''}">
                                            <div class="member-avatar">
                                                ${member.profile_picture ? 
                                                    `<img src="${member.profile_picture}" alt="${escapeHtml(member.full_name || member.username)}">` : 
                                                    `<i class="fas fa-user-circle"></i>`
                                                }
                                                ${isMemberAdmin ? '<span class="admin-crown"><i class="fas fa-crown"></i></span>' : ''}
                                            </div>
                                            <div class="member-info">
                                                <div class="member-name">
                                                    <strong>${escapeHtml(member.full_name || member.username)}</strong>
                                                    ${isSelf ? '<span class="self-badge">You</span>' : ''}
                                                </div>
                                                <div class="member-username">@${escapeHtml(member.username)}</div>
                                                <div class="member-role">${member.role}</div>
                                            </div>
                                            ${isCurrentUserAdmin && !isSelf ? `
                                                <div class="member-actions">
                                                    ${!isMemberAdmin ? `
                                                        <button class="btn-icon-small success" onclick="transferAdmin(${group.id}, ${member.id})" title="Make Admin">
                                                            <i class="fas fa-crown"></i>
                                                        </button>
                                                    ` : ''}
                                                    <button class="btn-icon-small danger" onclick="removeMember(${group.id}, ${member.id})" title="Remove">
                                                        <i class="fas fa-times"></i>
                                                    </button>
                                                </div>
                                            ` : ''}
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>

                        <!-- PENDING INVITATIONS (only for admins) -->
                        ${isAdmin && invitations && invitations.length > 0 ? `
                            <div class="group-section">
                                <div class="section-header">
                                    <h4><i class="fas fa-envelope"></i> Pending Invitations (${invitations.length})</h4>
                                </div>
                                <div class="invitations-grid">
                                    ${invitations.map(invite => `
                                        <div class="invitation-card">
                                            <div class="invitation-avatar">
                                                <i class="fas fa-user-clock"></i>
                                            </div>
                                            <div class="invitation-info">
                                                <strong>${escapeHtml(invite.full_name || invite.username)}</strong>
                                                <small>Invited by ${escapeHtml(invite.invited_by_username)}</small>
                                                <span class="time-badge">${timeAgo(invite.created_at)}</span>
                                            </div>
                                            <span class="status-badge pending">Pending</span>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}

                        <!-- DANGER ZONE (only for admins) -->
                        ${isAdmin ? `
                            <div class="group-section danger-zone">
                                <div class="section-header">
                                    <h4><i class="fas fa-exclamation-triangle"></i> Danger Zone</h4>
                                </div>
                                <div class="danger-actions">
                                    <div class="danger-item">
                                        <div class="danger-info">
                                            <strong>Delete Group</strong>
                                            <p>Once deleted, all messages and members will be removed. This action cannot be undone.</p>
                                        </div>
                                        <button class="btn-danger" onclick="deleteGroup(${group.id})">
                                            <i class="fas fa-trash"></i> Delete Group
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

    } catch (error) {
        console.error('Show group detail error:', error);
        showNotification('❌ Gagal memuat detail group: ' + error.message, 'error');
    }
}

// =============== NEW: deleteGroup ===============
async function deleteGroup(groupId) {
    if (!confirm('⚠️ PERINGATAN: Menghapus group akan menghapus semua pesan dan anggota. Yakin ingin melanjutkan?')) {
        return;
    }
    
    try {
        showNotification('🔄 Menghapus group...', 'info');
        
        const response = await fetch(`/api/groups/${groupId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${currentToken}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('✅ Group berhasil dihapus', 'success');
            
            // Tutup modal
            const modal = document.querySelector('.modal.active');
            if (modal) modal.remove();
            
            // Refresh groups
            loadGroups();
            
            // Jika sedang di chat room group ini, tutup
            if (currentChatRoom && currentChatRoom.group_id == groupId) {
                closeChatRoom();
            }
        } else {
            showNotification('❌ ' + (data.error || 'Gagal menghapus group'), 'error');
        }
    } catch (error) {
        console.error('Delete group error:', error);
        showNotification('❌ Gagal menghapus group: ' + error.message, 'error');
    }
}


async function loadGroupInvitations() {
    try {
        const response = await fetch('/api/groups/invitations/pending', {
            headers: {
                'Authorization': `Bearer ${currentToken}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            groupInvitations = data.invitations || [];
            updateInvitationsBadge();
        }
    } catch (error) {
        console.error('Load invitations error:', error);
    }
}

function updateInvitationsBadge() {
    const badge = document.getElementById('groupInvitationsBadge');
    const navBadge = document.getElementById('navGroupsBadge');
    
    const count = groupInvitations.length;
    
    if (badge) {
        if (count > 0) {
            badge.style.display = 'inline-block';
            badge.textContent = count;
        } else {
            badge.style.display = 'none';
        }
    }
    
    if (navBadge) {
        if (count > 0) {
            navBadge.style.display = 'inline-block';
            navBadge.textContent = count;
        } else {
            navBadge.style.display = 'none';
        }
    }
}

function switchGroupsTab(tab, e) {
    const container = document.getElementById('groupsContainer');
    if (!container) return;

    document.querySelectorAll('.groups-tabs .tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    const targetBtn = e?.target || document.querySelector(`.groups-tabs .tab-btn[onclick*="${tab}"]`);
    if (targetBtn) targetBtn.classList.add('active');

    if (tab === 'my-groups') {
        displayGroups();
    } else {
        displayInvitations();
    }
}


function displayInvitations() {
    const container = document.getElementById('groupsContainer');
    if (!container) return;
    
    if (groupInvitations.length === 0) {
        container.innerHTML = `
            <div class="empty-state-groups">
                <i class="fas fa-envelope-open"></i>
                <h3>No Invitations</h3>
                <p>You don't have any pending group invitations</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = `
        <div class="invitations-list">
            ${groupInvitations.map(invite => `
                <div class="invitation-item">
                    <div class="invitation-avatar">
                        ${invite.group_avatar ? 
                            `<img src="${invite.group_avatar}" alt="${escapeHtml(invite.group_name)}">` : 
                            `<i class="fas fa-users"></i>`
                        }
                    </div>
                    <div class="invitation-info">
                        <h4>${escapeHtml(invite.group_name)}</h4>
                        <p>Invited by ${escapeHtml(invite.invited_by_name || invite.invited_by_username)}</p>
                        <small>${timeAgo(invite.created_at)}</small>
                    </div>
                    <div class="invitation-actions">
                        <button class="btn-success btn-sm" onclick="acceptInvitation(${invite.id})">
                            <i class="fas fa-check"></i> Accept
                        </button>
                        <button class="btn-danger btn-sm" onclick="rejectInvitation(${invite.id})">
                            <i class="fas fa-times"></i> Reject
                        </button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

async function acceptInvitation(invitationId) {
    try {
        const response = await fetch(`/api/groups/invitations/${invitationId}/accept`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${currentToken}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('✅ Joined group successfully!', 'success');
            loadGroupInvitations();
            loadGroups();
            
            if (data.room_id) {
                openChatRoom(data.room_id);
            }
            
            switchGroupsTab('my-groups');
        } else {
            showNotification('❌ ' + (data.error || 'Failed to accept invitation'), 'error');
        }
    } catch (error) {
        console.error('Accept invitation error:', error);
        showNotification('❌ Failed to accept invitation', 'error');
    }
}

async function rejectInvitation(invitationId) {
    try {
        const response = await fetch(`/api/groups/invitations/${invitationId}/reject`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${currentToken}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('✅ Invitation rejected', 'info');
            loadGroupInvitations();
            displayInvitations();
        } else {
            showNotification('❌ ' + (data.error || 'Failed to reject invitation'), 'error');
        }
    } catch (error) {
        console.error('Reject invitation error:', error);
        showNotification('❌ Failed to reject invitation', 'error');
    }
}

// =============== FIXED: showAddMembersModal (hanya teman) ===============
async function showAddMembersModal(groupId) {
    try {
        // Reset selected members
        selectedMembers = [];

        // Fetch available users (HANYA TEMAN)
        const response = await fetch(`/api/groups/${groupId}/available-users?q=`, {
            headers: { 'Authorization': `Bearer ${currentToken}` }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        if (!data.success) {
            showNotification('❌ Gagal memuat daftar teman', 'error');
            return;
        }

        const existingModal = document.querySelector('.modal.active');
        if (existingModal) existingModal.remove();

        const modal = document.createElement('div');
        modal.className = 'modal active';

        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3><i class="fas fa-user-plus"></i> Invite Friends to Group</h3>
                    <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
                </div>

                <div class="modal-body">
                    <div class="form-group">
                        <label>Search friends</label>
                        <div class="search-input">
                            <i class="fas fa-search"></i>
                            <input type="text" id="addMembersSearch" placeholder="Search by username or name...">
                        </div>
                    </div>

                    <div id="availableUsersList" class="available-users-list">
                        ${renderAvailableUsersList(data.users || [])}
                    </div>

                    <div class="info-message" style="background: var(--bg-hover); padding: 10px; border-radius: var(--radius-md); margin: 10px 0; color: var(--text-secondary);">
                        <i class="fas fa-info-circle"></i> Only your friends are shown. Selected friends will receive an invitation.
                    </div>

                    <div class="form-actions">
                        <button type="button" class="btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                        <button type="button" class="btn-primary" id="confirmInviteBtn">
                            <i class="fas fa-paper-plane"></i> Send Invitations (0)
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Setup search
        const searchInput = document.getElementById('addMembersSearch');
        if (searchInput) {
            searchInput.addEventListener('input', debounce(async (e) => {
                const query = e.target.value.trim();
                try {
                    const searchResponse = await fetch(`/api/groups/${groupId}/available-users?q=${encodeURIComponent(query)}`, {
                        headers: { 'Authorization': `Bearer ${currentToken}` }
                    });
                    const searchData = await searchResponse.json();
                    if (searchData.success) {
                        document.getElementById('availableUsersList').innerHTML = 
                            renderAvailableUsersList(searchData.users || []);
                    }
                } catch (err) {
                    console.warn('Search failed:', err);
                }
            }, 500));
        }

        // Setup confirm button
        const confirmBtn = document.getElementById('confirmInviteBtn');
        if (confirmBtn) {
            confirmBtn.onclick = async () => {
                if (!selectedMembers || selectedMembers.length === 0) {
                    showNotification('❌ Pilih setidaknya satu teman', 'error');
                    return;
                }

                try {
                    showNotification('🔄 Mengirim undangan...', 'info');
                    
                    const inviteResponse = await fetch(`/api/groups/${groupId}/invite`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${currentToken}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ userIds: selectedMembers })
                    });

                    const inviteData = await inviteResponse.json();

                    if (inviteData.success) {
                        showNotification(`✅ ${inviteData.invited_count || selectedMembers.length} undangan terkirim!`, 'success');
                        modal.remove();
                        selectedMembers = [];
                        // Refresh group detail untuk melihat pending invitations
                        showGroupDetail(groupId);
                    } else {
                        showNotification('❌ ' + (inviteData.error || 'Gagal mengirim undangan'), 'error');
                    }
                } catch (error) {
                    console.error('Invite error:', error);
                    showNotification('❌ Gagal mengirim undangan', 'error');
                }
            };
        }

    } catch (error) {
        console.error('Show invite modal error:', error);
        showNotification('❌ Gagal memuat modal', 'error');
    }
}


// Helper untuk render daftar user
function renderAvailableUsersList(users) {
    if (!users || users.length === 0) {
        return `
            <div class="empty-state small">
                <i class="fas fa-users"></i>
                <p>No users available to add</p>
            </div>
        `;
    }

    return users.map(user => {
        const isChecked = selectedMembers.includes(parseInt(user.id));
        return `
            <label class="user-checkbox-item">
                <input type="checkbox" 
                       value="${user.id}" 
                       ${isChecked ? 'checked' : ''}
                       onchange="toggleSelectMember(${user.id}, this.checked)">
                <div class="user-avatar-small">
                    ${user.profile_picture_url ? 
                        `<img src="${user.profile_picture_url}" alt="${escapeHtml(user.full_name || user.username)}">` : 
                        '<i class="fas fa-user"></i>'
                    }
                </div>
                <div class="user-info">
                    <strong>${escapeHtml(user.full_name || user.username)}</strong>
                    <small>@${escapeHtml(user.username)}</small>
                </div>
                ${user.is_friend ? '<span class="friend-badge"><i class="fas fa-user-friends"></i> Friend</span>' : ''}
            </label>
        `;
    }).join('');
}




// Perbaiki fungsi addSelectedMembers
async function addSelectedMembers(groupId) {
    // Pastikan groupId ada
    if (!groupId) {
        showNotification('❌ Group ID tidak ditemukan', 'error');
        return;
    }
    
    // Pastikan selectedMembers adalah array dan memiliki length
    if (!selectedMembers || !Array.isArray(selectedMembers) || selectedMembers.length === 0) {
        showNotification('❌ Pilih setidaknya satu user', 'error');
        return;
    }
    
    console.log('Adding members to group:', groupId, 'Members:', selectedMembers); // Debugging
    
    try {
        const response = await fetch(`/api/groups/${groupId}/members`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${currentToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ userIds: selectedMembers })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification(`✅ ${data.added_count || selectedMembers.length} members added successfully!`, 'success');
            
            const modal = document.querySelector('.modal.active');
            if (modal) modal.remove();
            
            // Reset selected members
            selectedMembers = [];
            
            // Refresh group detail if open
            showGroupDetail(groupId);
        } else {
            showNotification('❌ ' + (data.error || 'Failed to add members'), 'error');
        }
    } catch (error) {
        console.error('Add members error:', error);
        showNotification('❌ Failed to add members: ' + error.message, 'error');
    }
}

// =========================================================
// ✅ 2) FIXED: displayAvailableUsers (FULL)
// - checkbox tetap checked sesuai selectedMembers
// - onchange kirim user.id (biar konsisten)
// =========================================================
function displayAvailableUsers(users) {
    const container = document.getElementById('availableUsersList');
    if (!container) return;

    if (!users || users.length === 0) {
        container.innerHTML = `
            <div class="empty-state small">
                <i class="fas fa-users"></i>
                <p>No users available to add</p>
            </div>
        `;
        return;
    }

    container.innerHTML = users.map(user => {
        const pic = user.profile_picture || user.profile_picture_url || user.avatar_url || '';
        const fullName = user.full_name || user.username || 'User';
        const uname = user.username || '';

        return `
            <label class="user-checkbox-item">
                <input type="checkbox" value="${user.id}"
                    onchange="toggleSelectMember(${user.id}, this.checked)">
                <div class="user-avatar-small">
                    ${pic
                        ? `<img src="${pic}" alt="${escapeHtml(fullName)}" onerror="this.onerror=null; this.style.display='none';">`
                        : `<i class="fas fa-user"></i>`
                    }
                </div>
                <div class="user-info">
                    <strong>${escapeHtml(fullName)}</strong>
                    <small>@${escapeHtml(uname)}</small>
                </div>
                ${user.is_friend ? '<span class="friend-badge"><i class="fas fa-user-friends"></i> Friend</span>' : ''}
            </label>
        `;
    }).join('');
}


// Fungsi toggle select member (update counter)
function toggleSelectMember(userId, checked) {
    if (!selectedMembers || !Array.isArray(selectedMembers)) {
        selectedMembers = [];
    }

    const id = parseInt(userId);
    if (isNaN(id)) return;

    if (checked) {
        if (!selectedMembers.includes(id)) {
            selectedMembers.push(id);
        }
    } else {
        selectedMembers = selectedMembers.filter(x => x !== id);
    }

    // Update button text
    const confirmBtn = document.getElementById('confirmAddMembersBtn');
    if (confirmBtn) {
        confirmBtn.innerHTML = `<i class="fas fa-user-plus"></i> Add Selected (${selectedMembers.length})`;
    }

    console.log('Selected members:', selectedMembers);
}



async function addMembersToGroup(groupId, userIds) {
    if (userIds.length === 0) {
        showNotification('❌ Select at least one user', 'error');
        return;
    }
    
    try {
        const response = await fetch(`/api/groups/${groupId}/members`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${currentToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ userIds })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification(`✅ ${data.added_count} members added successfully!`, 'success');
            
            const modal = document.querySelector('.modal.active');
            if (modal) modal.remove();
            
            // Refresh group detail if open
            const groupDetailModal = document.querySelector('.modal.active');
            if (groupDetailModal) {
                showGroupDetail(groupId);
            }
        } else {
            showNotification('❌ ' + (data.error || 'Failed to add members'), 'error');
        }
    } catch (error) {
        console.error('Add members error:', error);
        showNotification('❌ Failed to add members', 'error');
    }
}

async function removeMember(groupId, userId) {
    if (!confirm('Are you sure you want to remove this member?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/groups/${groupId}/members/${userId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${currentToken}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('✅ Member removed successfully!', 'success');
            showGroupDetail(groupId);
        } else {
            showNotification('❌ ' + (data.error || 'Failed to remove member'), 'error');
        }
    } catch (error) {
        console.error('Remove member error:', error);
        showNotification('❌ Failed to remove member', 'error');
    }
}

async function leaveGroup(groupId) {
    if (!confirm('Are you sure you want to leave this group?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/groups/${groupId}/leave`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${currentToken}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('✅ You left the group', 'info');
            
            const modal = document.querySelector('.modal.active');
            if (modal) modal.remove();
            
            loadGroups();
        } else {
            showNotification('❌ ' + (data.error || 'Failed to leave group'), 'error');
        }
    } catch (error) {
        console.error('Leave group error:', error);
        showNotification('❌ Failed to leave group', 'error');
    }
}

async function transferAdmin(groupId, userId) {
    if (!confirm('Are you sure you want to make this user an admin? You will become a regular member.')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/groups/${groupId}/transfer-admin/${userId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${currentToken}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('✅ Admin transferred successfully!', 'success');
            showGroupDetail(groupId);
        } else {
            showNotification('❌ ' + (data.error || 'Failed to transfer admin'), 'error');
        }
    } catch (error) {
        console.error('Transfer admin error:', error);
        showNotification('❌ Failed to transfer admin', 'error');
    }
}

// Fetch JSON aman: kalau server balikin HTML, gak akan error json(), tapi throw error yang jelas
async function fetchJsonSafe(url, options = {}) {
    const resp = await fetch(url, options);
    const ct = (resp.headers.get('content-type') || '').toLowerCase();
    const text = await resp.text();

    // Kalau bukan JSON (seringnya HTML fallback), jangan dipaksa JSON.parse
    if (!ct.includes('application/json')) {
        const snippet = text.slice(0, 120).replace(/\s+/g, ' ');
        const err = new Error(`Non-JSON response from ${url} (HTTP ${resp.status}). Snippet: ${snippet}`);
        err.http_status = resp.status;
        err.content_type = ct;
        err.raw_text = text;
        throw err;
    }

    let data;
    try {
        data = text ? JSON.parse(text) : {};
    } catch (e) {
        const err = new Error(`Invalid JSON from ${url} (HTTP ${resp.status})`);
        err.http_status = resp.status;
        err.content_type = ct;
        err.raw_text = text;
        throw err;
    }

    return { resp, data };
}

// Ambil nama group dari berbagai kemungkinan field (biar gak "Group Chat" terus)
function getGroupNameById(groupId) {
    const g = Array.isArray(groups) ? groups.find(x => String(x.id) === String(groupId)) : null;
    return g?.name || g?.group_name || g?.title || (groupId ? `Group #${groupId}` : 'Group Chat');
}


// =============== FIXED: openGroupChat tanpa endpoint yang tidak ada ===============
async function openGroupChat(groupId) {
    try {
        // Validasi input
        const gid = groupId || currentGroupDetail?.id;
        if (!gid) {
            showNotification('❌ Group ID tidak valid', 'error');
            return;
        }

        console.log('Opening group chat for group:', gid);

        // Cari room di chatRooms yang sudah ada
        let targetRoom = null;
        
        if (Array.isArray(chatRooms) && chatRooms.length > 0) {
            // Cari berdasarkan group_id (prioritas utama)
            targetRoom = chatRooms.find(r => 
                r.group_id != null && String(r.group_id) === String(gid)
            );
            
            console.log('Room found by group_id:', targetRoom);
        }

        // Jika masih tidak ditemukan, coba cari dari groups data
        if (!targetRoom) {
            // Cari group di daftar groups
            const group = Array.isArray(groups) ? groups.find(g => String(g.id) === String(gid)) : null;
            
            if (group && group.chat_room_id) {
                // Cari room berdasarkan chat_room_id
                targetRoom = Array.isArray(chatRooms) ? 
                    chatRooms.find(r => String(r.id) === String(group.chat_room_id)) : null;
                
                console.log('Room found by chat_room_id:', targetRoom);
            }
        }

        // Jika masih tidak ditemukan, cari room yang kelihatan seperti group
        if (!targetRoom && Array.isArray(chatRooms)) {
            // Cari room dengan tipe group
            targetRoom = chatRooms.find(r => 
                r.room_type === 'group' || 
                (r.participant_count > 2 && !r.other_user)
            );
            
            console.log('Room found by type:', targetRoom);
        }

        if (!targetRoom) {
            showNotification('❌ Room chat tidak ditemukan. Coba refresh halaman.', 'error');
            console.error('No group room found for group:', gid);
            return;
        }

        // Tutup modal group detail jika ada
        const modal = document.querySelector('.modal.active');
        if (modal) modal.remove();

        // Pindah ke view chat
        try { 
            await switchView('chat'); 
        } catch (e) {
            console.warn('Switch to chat view failed:', e);
        }

        // Tunggu DOM siap
        await new Promise(resolve => setTimeout(resolve, 100));

        // Buka room
        await openChatRoom(targetRoom.id);

    } catch (error) {
        console.error('Open group chat error:', error);
        showNotification('❌ Gagal membuka chat group', 'error');
    }
}


// =============== FIXED: editGroup ===============
async function editGroup(groupId) {
    const group = groups.find(g => g.id == groupId) || currentGroupDetail;
    if (!group) {
        showNotification('❌ Group tidak ditemukan', 'error');
        return;
    }
    
    const existingModal = document.querySelector('.modal.active');
    if (existingModal) existingModal.remove();
    
    const modal = document.createElement('div');
    modal.className = 'modal active';
    
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3><i class="fas fa-edit"></i> Edit Group</h3>
                <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            
            <div class="modal-body">
                <form id="editGroupForm" enctype="multipart/form-data">
                    <div class="form-group">
                        <label>Group Avatar</label>
                        <div class="current-avatar-preview">
                            ${group.avatar_url ? 
                                `<img src="${group.avatar_url}" alt="Current Avatar">` : 
                                `<i class="fas fa-users"></i>`
                            }
                            <p>Current Avatar</p>
                        </div>
                        <div class="file-upload-area" id="editGroupAvatarDropZone">
                            <i class="fas fa-cloud-upload-alt"></i>
                            <p>Drag & drop new avatar atau <span class="browse-link">browse</span></p>
                            <input type="file" name="avatar" id="editGroupAvatarInput" accept="image/*" style="display: none;">
                        </div>
                        <div id="editGroupAvatarPreview" class="file-preview"></div>
                    </div>
                    
                    <div class="form-group">
                        <label>Group Name <span class="required">*</span></label>
                        <input type="text" name="name" required value="${escapeHtml(group.name)}" placeholder="e.g., QA Team, Developers">
                    </div>
                    
                    <div class="form-group">
                        <label>Description</label>
                        <textarea name="description" rows="4" placeholder="Group description...">${escapeHtml(group.description || '')}</textarea>
                    </div>
                    
                    <div class="form-actions">
                        <button type="button" class="btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                        <button type="submit" class="btn-primary">
                            <i class="fas fa-save"></i> Update Group
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Setup file upload
    const dropZone = document.getElementById('editGroupAvatarDropZone');
    const fileInput = document.getElementById('editGroupAvatarInput');
    const preview = document.getElementById('editGroupAvatarPreview');
    
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
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                fileInput.files = files;
                previewGroupAvatarEdit(files[0], preview);
            }
        });
        
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                previewGroupAvatarEdit(e.target.files[0], preview);
            }
        });
    }
    
    const form = document.getElementById('editGroupForm');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        
        try {
            showNotification('🔄 Mengupdate group...', 'info');
            
            const response = await fetch(`/api/groups/${groupId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${currentToken}`
                },
                body: formData
            });
            
            const data = await response.json();
            
            if (data.success) {
                showNotification('✅ Group berhasil diupdate!', 'success');
                modal.remove();
                loadGroups();
                showGroupDetail(groupId);
            } else {
                showNotification('❌ ' + (data.error || 'Gagal mengupdate group'), 'error');
            }
        } catch (error) {
            console.error('Edit group error:', error);
            showNotification('❌ Gagal mengupdate group', 'error');
        }
    });
}

// Helper untuk preview avatar edit
function previewGroupAvatarEdit(file, previewElement) {
    if (!file.type.startsWith('image/')) {
        showNotification('❌ Pilih file gambar', 'error');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
        previewElement.innerHTML = `
            <div class="file-preview-item">
                <img src="${e.target.result}" style="width: 40px; height: 40px; object-fit: cover; border-radius: var(--radius-sm);">
                <span class="name">${escapeHtml(file.name)}</span>
                <span class="size">${formatFileSize(file.size)}</span>
                <button type="button" onclick="this.closest('.file-preview').innerHTML = ''; this.closest('.file-preview').classList.remove('active');">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        previewElement.classList.add('active');
    };
    reader.readAsDataURL(file);
}

// Helper function for debounce
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// =============== CHAT SYSTEM - ENHANCED ===============

function initChat() {
    loadChatRooms();
    loadFriendRequests();
    startPresenceTracking();
}

// =============== FIXED: startPresenceTracking dengan pengecekan token ===============
function startPresenceTracking() {
    if (!currentUser || !currentToken) {
        console.log('No user/token, skipping presence tracking');
        return;
    }

    // Hanya kirim presence jika token valid
    fetch('/api/user/presence', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${currentToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: 'online' })
    }).catch(err => {
        // Jangan tampilkan error ke user, cukup log
        console.log('Presence update error (non-critical):', err.message);
    });

    // Hapus listener lama
    window.removeEventListener('beforeunload', presenceBeforeUnloadHandler);
    window.addEventListener('beforeunload', presenceBeforeUnloadHandler);

    // Clear interval lama
    if (presenceHeartbeatInterval) {
        clearInterval(presenceHeartbeatInterval);
        presenceHeartbeatInterval = null;
    }
    
    // Set interval baru
    presenceHeartbeatInterval = setInterval(() => {
        // Cek token masih ada
        if (!currentToken || !currentUser) {
            console.log('No token/user, stopping heartbeat');
            if (presenceHeartbeatInterval) {
                clearInterval(presenceHeartbeatInterval);
                presenceHeartbeatInterval = null;
            }
            return;
        }
        
        fetch('/api/user/presence', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${currentToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: 'online' })
        }).catch(err => {
            // Jika 403, mungkin token expired, hentikan interval
            if (err.message.includes('403')) {
                console.log('Token expired, stopping heartbeat');
                if (presenceHeartbeatInterval) {
                    clearInterval(presenceHeartbeatInterval);
                    presenceHeartbeatInterval = null;
                }
            }
        });
    }, 30000);
}

function presenceBeforeUnloadHandler() {
    try {
        navigator.sendBeacon('/api/user/presence',
            new Blob([JSON.stringify({ status: 'offline' })], { type: 'application/json' })
        );
    } catch (e) {}
}


function startMessageStatusCheck() {
    if (messageStatusCheckInterval) {
        clearInterval(messageStatusCheckInterval);
    }
    
    messageStatusCheckInterval = setInterval(() => {
        // Hanya cek jika sedang di chat view dan ada chat room aktif
        if (currentView === 'chat' && currentChatRoom) {
            checkUnreadMessages();
        }
    }, 5000);
}

async function checkUnreadMessages() {
    if (!currentChatRoom) return;
    
    const container = document.getElementById('chatMessages');
    if (!container) {
        // HAPUS notifikasi error, cukup log saja
        console.log('Chat container not ready yet');
        return;
    }

    const messages = container.querySelectorAll('.message:not(.own)');
    const unreadMessageIds = [];
    
    messages.forEach(msg => {
        const statusEl = msg.querySelector('.message-status i');
        if (statusEl && statusEl.classList.contains('fa-check')) {
            const msgId = msg.getAttribute('data-message-id');
            if (msgId && !msgId.startsWith('temp-')) {
                unreadMessageIds.push(parseInt(msgId));
            }
        }
    });
    
    if (unreadMessageIds.length > 0 && document.visibilityState === 'visible') {
        try {
            await fetch('/api/chat/messages/status', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${currentToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    messageIds: unreadMessageIds,
                    status: 'read',
                    room_id: currentChatRoom.id
                })
            });
            
            messages.forEach(msg => {
                const msgId = msg.getAttribute('data-message-id');
                if (msgId && unreadMessageIds.includes(parseInt(msgId))) {
                    const statusEl = msg.querySelector('.message-status');
                    if (statusEl) {
                        statusEl.innerHTML = '<i class="fas fa-check-double" style="color: var(--primary);"></i>';
                        statusEl.className = 'message-status read';
                    }
                }
            });
        } catch (error) {
            console.log('Error marking messages as read:', error);
        }
    }
}

// Edit message function
function editMessage(messageId) {
    const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
    if (!messageElement) return;
    
    const messageText = messageElement.querySelector('.message-text');
    if (!messageText) return;
    
    const originalText = messageText.textContent;
    
    // Create edit input
    const input = document.createElement('textarea');
    input.className = 'edit-message-input';
    input.value = originalText;
    input.rows = 2;
    
    messageText.innerHTML = '';
    messageText.appendChild(input);
    input.focus();
    
    currentEditingMessage = messageId;
    
    const cancelEdit = () => {
        messageText.textContent = originalText;
        currentEditingMessage = null;
    };
    
    const saveEdit = async () => {
        const newText = input.value.trim();
        if (!newText || newText === originalText) {
            cancelEdit();
            return;
        }
        
        try {
            const response = await fetch(`/api/chat/messages/${messageId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${currentToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message: newText })
            });
            
            const data = await response.json();
            
            if (data.success) {
                messageText.textContent = newText;
                
                // Add edited indicator
                const timeEl = messageElement.querySelector('.message-time');
                if (timeEl && !timeEl.querySelector('.edited-indicator')) {
                    const editedSpan = document.createElement('span');
                    editedSpan.className = 'edited-indicator';
                    editedSpan.textContent = ' (edited)';
                    editedSpan.style.fontSize = '10px';
                    editedSpan.style.opacity = '0.7';
                    editedSpan.style.marginLeft = '4px';
                    timeEl.appendChild(editedSpan);
                }
                
                showNotification('✅ Pesan diedit', 'success');
            } else {
                showNotification('❌ Gagal mengedit pesan', 'error');
                messageText.textContent = originalText;
            }
        } catch (error) {
            console.error('Edit error:', error);
            showNotification('❌ Gagal mengedit pesan', 'error');
            messageText.textContent = originalText;
        } finally {
            currentEditingMessage = null;
        }
    };
    
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            saveEdit();
        } else if (e.key === 'Escape') {
            cancelEdit();
        }
    });
    
    input.addEventListener('blur', () => {
        if (currentEditingMessage === messageId) {
            setTimeout(() => {
                if (currentEditingMessage === messageId) {
                    cancelEdit();
                }
            }, 200);
        }
    });
}

// Delete message function
async function deleteMessage(messageId) {
    if (!confirm('Apakah Anda yakin ingin menghapus pesan ini?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/chat/messages/${messageId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${currentToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ reason: 'User deleted' })
        });
        
        const data = await response.json();
        
        if (data.success) {
            const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
            if (messageElement) {
                messageElement.remove();
            }
            showNotification('✅ Pesan dihapus', 'success');
        } else {
            showNotification('❌ Gagal menghapus pesan', 'error');
        }
    } catch (error) {
        console.error('Delete error:', error);
        showNotification('❌ Gagal menghapus pesan', 'error');
    }
}

// Scroll to message
function scrollToMessage(messageId) {
    const messageEl = document.querySelector(`[data-message-id="${messageId}"]`);
    if (messageEl) {
        messageEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        messageEl.classList.add('highlight');
        setTimeout(() => messageEl.classList.remove('highlight'), 2000);
    }
}

/* =========================================================
   ✅ HELPERS (tambahkan sekali, sebelum fungsi2 di bawah)
   ========================================================= */

// Escape untuk string JavaScript (aman dipakai di parameter onclick '...')
function escapeJsString(str) {
    return String(str ?? '')
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029');
}

// Safe parse JSON string -> object (khusus other_user dll)
function safeJsonParse(maybeJson) {
    if (!maybeJson) return null;
    if (typeof maybeJson === 'object') return maybeJson;
    if (typeof maybeJson !== 'string') return null;
    try {
        return JSON.parse(maybeJson);
    } catch (e) {
        return null;
    }
}


// =========================================================
// 1) ✅ FIXED: Enhanced createMessageElement (FULL)
// =========================================================
function createMessageElement(message) {
    // 🔥 FIX: Validasi ID message
    if (!message || !message.id) {
        console.error('createMessageElement: Invalid message object', message);
        return document.createElement('div'); // Return empty div
    }

    // 🔥 FIX: Jika ID = 0, jangan tampilkan
    if (message.id === 0 || parseInt(message.id) === 0) {
        console.error('createMessageElement: Message ID is 0', message);
        return document.createElement('div'); // Return empty div
    }

    const div = document.createElement('div');
    const isOwn = message.user_id == currentUser.id;
    const isEdited = !!message.edited;

    const createdAtMs = message.created_at ? new Date(message.created_at).getTime() : Date.now();
    const messageAge = Date.now() - createdAtMs;

    const canEdit = isOwn && messageAge < 24 * 60 * 60 * 1000; // 24 jam
    const canDelete = isOwn || currentUser.role === 'admin';

    div.className = `message ${isOwn ? 'own' : 'other'}`;
    
    // 🔥 FIX: Pastikan ID disimpan sebagai string untuk querySelector
    div.setAttribute('data-message-id', String(message.id));
    div.setAttribute('data-message-time', message.created_at || new Date().toISOString());

    let content = '';
    let profilePicHtml = '';

    // Profile picture
    if (message.profile_picture_url) {
        // NOTE: URL biasanya dari server (trusted), kalau mau super-aman bisa whitelist domain.
        profilePicHtml = `<img src="${message.profile_picture_url}" alt="Profile" onerror="this.onerror=null; this.src='data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2236%22%20height%3D%2236%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22%23b58b5b%22%3E%3Cpath%20d%3D%22M12%2012c2.21%200%204-1.79%204-4s-1.79-4-4-4-4%201.79-4%204%201.79%204%204%204zm0%202c-2.67%200-8%201.34-8%204v2h16v-2c0-2.66-5.33-4-8-4z%22%2F%3E%3C%2Fsvg%3E';">`;
    } else {
        profilePicHtml = `<i class="fas fa-user-circle"></i>`;
    }

    // Reply to message
    let replyHtml = '';
    if (message.reply_to) {
        // message.reply_to.id sebaiknya number
        const replyId = parseInt(message.reply_to.id);
        const safeReplyId = isNaN(replyId) ? 0 : replyId;

        replyHtml = `
            <div class="reply-to" onclick="scrollToMessage(${safeReplyId})">
                <span class="reply-sender">${escapeHtml(message.reply_to.full_name || message.reply_to.username || '')}</span>
                <span>${escapeHtml(message.reply_to.message || '')}</span>
            </div>
        `;
    }

    // Message content based on type
    if (message.message_type === 'text') {
        content = `
            <div class="message-content-wrapper">
                ${replyHtml}
                <p class="message-text">${escapeHtml(message.message || '').replace(/\n/g, '<br>')}</p>
                ${isEdited ? '<span class="edited-indicator">edited</span>' : ''}
            </div>
        `;
    } else if (message.message_type === 'image') {
        // 🔥 PASTIKAN URL GAMBAR VALID
        let imageUrl = message.file_url || message.cloudinary_url || '';
        
        // Jika URL relatif, tambahkan base URL
        if (imageUrl && imageUrl.startsWith('/')) {
            imageUrl = window.location.origin + imageUrl;
        }
        
        // Jika masih kosong, beri placeholder
        if (!imageUrl) {
            imageUrl = 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22100%22%20height%3D%22100%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22%23b58b5b%22%3E%3Cpath%20d%3D%22M21%2019V5c0-1.1-.9-2-2-2H5c-1.1%200-2%20.9-2%202v14c0%201.1.9%202%202%202h14c1.1%200%202-.9%202-2zM8.5%2013.5l2.5%203.01L14.5%2012l4.5%206H5l3.5-4.5z%22%2F%3E%3C%2Fsvg%3E';
        }
        
        console.log('Rendering image with URL:', imageUrl);
        
        const safeImageUrl = escapeJsString(imageUrl);
        
        content = `
            <div class="message-image">
                ${replyHtml}
                <img src="${imageUrl}" 
                     alt="Image" 
                     onclick="previewImage('${safeImageUrl}')"
                     onerror="this.onerror=null; this.src='data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22100%22%20height%3D%22100%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22%23b58b5b%22%3E%3Cpath%20d%3D%22M21%2019V5c0-1.1-.9-2-2-2H5c-1.1%200-2%20.9-2%202v14c0%201.1.9%202%202%202h14c1.1%200%202-.9%202-2zM8.5%2013.5l2.5%203.01L14.5%2012l4.5%206H5l3.5-4.5z%22%2F%3E%3C%2Fsvg%3E'; this.style.opacity='0.5';"
                     onload="console.log('Image loaded successfully:', this.src)">
                ${message.message ? `<p class="message-text">${escapeHtml(message.message)}</p>` : ''}
                ${isEdited ? '<span class="edited-indicator">edited</span>' : ''}
            </div>
        `;
    } else if (message.message_type === 'file') {
        let fileUrl = message.file_url || message.cloudinary_url || '#';
        
        // Jika URL relatif, tambahkan base URL
        if (fileUrl && fileUrl.startsWith('/')) {
            fileUrl = window.location.origin + fileUrl;
        }
        
        const fileName = message.file_name || 'File';
        const fileSize = message.file_size || 0;
        const icon = getFileIcon(fileName);

        content = `
            <div class="message-file">
                ${replyHtml}
                <i class="fas ${icon}"></i>
                <div class="file-info">
                    <span class="file-name">${escapeHtml(fileName)}</span>
                    <span class="file-size">${formatFileSize(fileSize)}</span>
                </div>
                <a href="${fileUrl}" download="${escapeHtml(fileName)}" class="btn-icon" onclick="event.stopPropagation()" target="_blank">
                    <i class="fas fa-download"></i>
                </a>
                ${isEdited ? '<span class="edited-indicator">edited</span>' : ''}
            </div>
        `;
    } else {
        // fallback untuk tipe lain (kalau ada)
        content = `
            <div class="message-content-wrapper">
                ${replyHtml}
                <p class="message-text">${escapeHtml(message.message || '')}</p>
                ${isEdited ? '<span class="edited-indicator">edited</span>' : ''}
            </div>
        `;
    }

    // Status message
    let statusHtml = '';
    if (isOwn) {
        if (message.read_count > 0 || message.message_status === 'read') {
            statusHtml = `<span class="message-status read" title="Dibaca"><i class="fas fa-check-double" style="color: var(--primary);"></i></span>`;
        } else if (message.message_status === 'delivered') {
            statusHtml = `<span class="message-status delivered" title="Terkirim"><i class="fas fa-check-double"></i></span>`;
        } else {
            statusHtml = `<span class="message-status sent" title="Terkirim"><i class="fas fa-check"></i></span>`;
        }
    }

    // Message actions
    let actionsHtml = '';
    // Hanya tampilkan action jika message memiliki ID valid (bukan temp)
    if (message && message.id && !String(message.id).startsWith('temp-')) {
        const realId = parseInt(message.id);

        if (isNaN(realId) || realId === 0) {
            console.warn('createMessageElement: Invalid message ID:', message.id);
        } else {
            // ❗IMPORTANT: untuk onclick JS string, pakai escapeJsString (bukan escapeHtml)
            const senderRaw = (message.full_name || message.username || 'User');
            // NOTE: untuk image/file, message.message bisa kosong -> tetap ok (reply boleh)
            const textRaw = (message.message ?? '');

            const safeSenderName = escapeJsString(senderRaw);
            const safeMessageText = escapeJsString(textRaw);

            actionsHtml = `
                <div class="message-actions">
                    <button class="action-btn" onclick="replyToMessageFn(${realId}, '${safeSenderName}', '${safeMessageText}')" title="Reply">
                        <i class="fas fa-reply"></i>
                    </button>
                    ${canEdit ? `
                    <button class="action-btn" onclick="editMessage(${realId})" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    ` : ''}
                    ${canDelete ? `
                    <button class="action-btn" onclick="deleteMessage(${realId})" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                    ` : ''}
                </div>
            `;
        }
    }

    div.innerHTML = `
        <div class="message-avatar">
            ${profilePicHtml}
        </div>
        <div class="message-content">
            <div class="message-header">
                <span class="message-sender">${escapeHtml(message.full_name || message.username || '')}</span>
                <span class="message-time">${formatTime(message.created_at)}</span>
            </div>
            ${content}
            <div class="message-footer">
                ${statusHtml}
            </div>
        </div>
        ${actionsHtml}
    `;

    return div;
}


// Enhanced loadRoomMessages
async function loadRoomMessages(roomId, before = null) {
    if (loadingMessages) return;
    
    loadingMessages = true;
    const container = document.getElementById('chatMessages');
    
    if (!container) {
        console.warn('loadRoomMessages: chatMessages container not found');
        loadingMessages = false;
        return;
    }
    
    try {
        let url = `/api/chat/rooms/${roomId}/messages-enhanced?limit=30`;
        if (before) {
            url += `&before=${encodeURIComponent(before)}`;
        }
        
        console.log('📥 Loading messages from:', url);
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${currentToken}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            console.log(`📦 Received ${data.messages.length} messages`);
            
            // 🔥 DEBUG: Lihat messages dengan tipe image
            const imageMessages = data.messages.filter(m => m.message_type === 'image');
            if (imageMessages.length > 0) {
                console.log('Image messages:', imageMessages.map(m => ({
                    id: m.id,
                    file_url: m.file_url,
                    cloudinary_url: m.cloudinary_url
                })));
            }
            
            // Filter pesan yang memiliki ID valid dan ID > 0
            const validMessages = data.messages.filter(msg => {
                if (!msg || !msg.id) return false;
                
                const id = parseInt(msg.id);
                if (isNaN(id) || id === 0) {
                    console.warn('Filtered out message with invalid ID:', msg.id);
                    return false;
                }
                
                if (String(msg.id).startsWith('temp-')) {
                    console.warn('Filtered out temporary message:', msg.id);
                    return false;
                }
                
                return true;
            });
            
            if (validMessages.length !== data.messages.length) {
                console.warn('Filtered out invalid messages:', 
                    data.messages.length - validMessages.length);
            }
            
            if (before) {
                const scrollHeight = container.scrollHeight;
                const scrollTop = container.scrollTop;
                
                validMessages.forEach(msg => {
                    const msgEl = createMessageElement(msg);
                    container.insertBefore(msgEl, container.firstChild);
                });
                
                container.scrollTop = container.scrollHeight - scrollHeight + container.scrollTop;
            } else {
                container.innerHTML = '';
                validMessages.forEach(msg => {
                    container.appendChild(createMessageElement(msg));
                });
                
                setTimeout(() => {
                    container.scrollTop = container.scrollHeight;
                }, 100);
            }
            
            hasMoreMessages = data.has_more;
            messagePage++;
        }
    } catch (error) {
        console.error('Load messages error:', error);
        if (container) {
            showNotification('❌ Gagal memuat pesan', 'error');
        }
    } finally {
        loadingMessages = false;
    }
}

// =============== FIXED: displayChatRooms dengan fallback ===============
function displayChatRooms() {
    const container = document.getElementById('chatRoomsList');
    if (!container) return;

    if (!chatRooms || chatRooms.length === 0) {
        container.innerHTML = `
            <div class="empty-state small">
                <i class="fas fa-comments"></i>
                <p>No chats yet</p>
                <p class="hint">Add friends to start chatting</p>
            </div>
        `;
        updateNavChatBadge();
        return;
    }

    container.innerHTML = chatRooms.map(room => {
        // Cek apakah room adalah private chat
        const isPrivate = room.room_type === 'private' && room.participant_count === 2;
        
        let roomName = 'Unknown';
        let avatarHtml = '<i class="fas fa-user-circle"></i>';
        let lastMessage = room.last_message || '';
        let lastTime = room.last_message_time ? formatTime(room.last_message_time) : '';
        const unread = room.unread_count || 0;
        
        if (isPrivate) {
            // Untuk private chat, kita perlu mencari user lain
            // Cara 1: Pakai other_user jika ada
            if (room.other_user && typeof room.other_user === 'object') {
                roomName = room.other_user.full_name || room.other_user.username || 'Unknown User';
                if (room.other_user.profile_picture_url) {
                    avatarHtml = `<img src="${room.other_user.profile_picture_url}" alt="${escapeHtml(roomName)}">`;
                }
            } 
            // Cara 2: Fallback - tampilkan "Private Chat" jika tidak ada data
            else {
                roomName = 'Private Chat';
                console.warn('Private chat without other_user data:', room);
            }
        } 
        else if (room.room_type === 'group' || room.group_id) {
            // Group chat
            const groupId = room.group_id;
            const group = Array.isArray(groups) ? groups.find(g => String(g.id) === String(groupId)) : null;
            
            roomName = group?.name || 'Group Chat';
            avatarHtml = '<i class="fas fa-users"></i>';
        }

        // Truncate last message
        if (lastMessage.length > 30) lastMessage = lastMessage.substring(0, 30) + '...';

        const isActive = currentChatRoom && String(currentChatRoom.id) === String(room.id);

        return `
            <div class="chat-room-item ${isActive ? 'active' : ''}" onclick="openChatRoom(${room.id})">
                <div class="chat-room-avatar">
                    ${avatarHtml}
                </div>
                <div class="chat-room-preview">
                    <div class="chat-room-name">
                        <h4>${escapeHtml(roomName)}</h4>
                        <span class="chat-time">${lastTime}</span>
                    </div>
                    <div class="chat-last-message">
                        <p>${escapeHtml(lastMessage)}</p>
                        ${unread > 0 ? `<span class="unread-badge">${unread}</span>` : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');

    updateNavChatBadge();
}

// =============== FIXED: loadChatRooms dengan parsing other_user ===============
// =============== FIXED: loadChatRooms dengan debug ===============
async function loadChatRooms() {
    try {
        const response = await fetch('/api/chat/rooms', {
            headers: {
                'Authorization': `Bearer ${currentToken}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            console.log('Raw rooms from server:', data.rooms); // DEBUG
            
            // Parse other_user untuk setiap room
            chatRooms = (data.rooms || []).map(room => {
                // Log setiap room untuk debug
                console.log(`Room ${room.id} (${room.room_type}):`, {
                    other_user_raw: room.other_user,
                    participant_count: room.participant_count
                });
                
                if (room.other_user && typeof room.other_user === 'string') {
                    try {
                        room.other_user = JSON.parse(room.other_user);
                        console.log(`✅ Parsed other_user for room ${room.id}:`, room.other_user);
                    } catch (e) {
                        console.error(`❌ Failed to parse other_user for room ${room.id}:`, room.other_user);
                        room.other_user = null;
                    }
                }
                return room;
            });
            
            displayChatRooms();
        } else {
            console.error('Failed to load chat rooms:', data.error);
            showNotification('❌ Gagal memuat chat: ' + (data.error || 'Unknown error'), 'error');
        }
    } catch (error) {
        console.error('Load chat rooms error:', error);
        showNotification('❌ Gagal terhubung ke server', 'error');
        
        const container = document.getElementById('chatRoomsList');
        if (container) {
            container.innerHTML = `
                <div class="empty-state small">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Gagal memuat chat</p>
                    <button class="btn-primary btn-sm" onclick="loadChatRooms()">
                        <i class="fas fa-sync-alt"></i> Coba Lagi
                    </button>
                </div>
            `;
        }
    }
}

function validateMessageId(messageId) {
    if (!messageId) {
        console.error('Message ID is null or undefined');
        return false;
    }
    
    const id = parseInt(messageId);
    if (isNaN(id)) {
        console.error('Message ID is not a number:', messageId);
        return false;
    }
    
    if (id === 0) {
        console.error('Message ID is 0');
        return false;
    }
    
    if (String(messageId).startsWith('temp-')) {
        console.warn('Message ID is temporary:', messageId);
        return false;
    }
    
    return true;
}

function closeChatRoom() {
    if (!currentChatRoom) return;
    
    if (socket) {
        socket.emit('leave_chat_room', currentChatRoom.id);
    }
    
    currentChatRoom = null;
    replyToMessage = null;
    
    const chatMain = document.getElementById('chatMainArea');
    if (chatMain) {
        chatMain.innerHTML = `
            <div class="chat-placeholder">
                <i class="fas fa-comment-dots"></i>
                <h3>Select a chat to start messaging</h3>
                <p>Choose a friend from the list to begin conversation</p>
            </div>
        `;
    }
    
    // 🔥 TAMBAHKAN INI - HAPUS CLASS UNTUK MOBILE
    // Hapus class dari body
    document.body.classList.remove('chat-room-active');
    
    // Di mobile, kembali ke daftar chat
    if (window.innerWidth <= 640) {
        const sidebar = document.querySelector('.chat-sidebar');
        const chatRoom = document.querySelector('.chat-room');
        if (sidebar) sidebar.style.display = 'block';
        if (chatRoom) chatRoom.style.display = 'none';
    }
    
    refreshChatRooms();
}

// =============== DETEKSI KEYBOARD MOBILE ===============
let isKeyboardOpen = false;

function detectKeyboard() {
    const isMobile = window.innerWidth <= 640;
    if (!isMobile) return;
    
    // Deteksi berdasarkan perubahan tinggi window
    const initialHeight = window.innerHeight;
    
    window.addEventListener('resize', () => {
        const currentHeight = window.innerHeight;
        
        // Jika tinggi berkurang lebih dari 150px, kemungkinan keyboard muncul
        if (initialHeight - currentHeight > 150) {
            isKeyboardOpen = true;
            document.body.classList.add('keyboard-open');
            
            // Scroll ke bawah agar input terlihat
            setTimeout(() => {
                const chatMessages = document.getElementById('chatMessages');
                if (chatMessages) {
                    chatMessages.scrollTop = chatMessages.scrollHeight;
                }
            }, 100);
        } else {
            isKeyboardOpen = false;
            document.body.classList.remove('keyboard-open');
        }
    });
}

// Deteksi focus pada input
function setupInputFocusDetection() {
    const chatInput = document.getElementById('chatMessageInput');
    if (!chatInput) return;
    
    chatInput.addEventListener('focus', () => {
        if (window.innerWidth <= 640) {
            // Scroll ke bawah saat input fokus
            setTimeout(() => {
                const chatMessages = document.getElementById('chatMessages');
                if (chatMessages) {
                    chatMessages.scrollTop = chatMessages.scrollHeight;
                }
                
                // Scroll input ke view
                chatInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 300);
        }
    });
}

// Panggil di init
document.addEventListener('DOMContentLoaded', () => {
    detectKeyboard();
    setupInputFocusDetection();
});

// Panggil juga saat chat room dibuka
function setupChatRoomKeyboardHandling() {
    setupInputFocusDetection();
    
    // Deteksi visual viewport (lebih akurat untuk mobile)
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', () => {
            const chatMessages = document.getElementById('chatMessages');
            const chatInput = document.getElementById('chatMessageInput');
            
            if (chatMessages && chatInput && document.activeElement === chatInput) {
                // Keyboard terbuka, scroll ke bawah
                setTimeout(() => {
                    chatMessages.scrollTop = chatMessages.scrollHeight;
                }, 100);
            }
        });
    }
}

// =============== PASTIKAN INPUT TERLIHAT - VERSI PAKSA ===============
function ensureChatInputVisible() {
    if (window.innerWidth > 640) return;
    
    console.log('🔍 Checking chat input visibility...');
    
    const chatInput = document.getElementById('chatMessageInput');
    const chatInputArea = document.querySelector('.chat-input-area');
    const chatMessages = document.getElementById('chatMessages');
    const chatRoom = document.querySelector('.chat-room');
    
    console.log('Elements found:', {
        chatInput: !!chatInput,
        chatInputArea: !!chatInputArea,
        chatMessages: !!chatMessages,
        chatRoom: !!chatRoom
    });
    
    if (!chatInput || !chatInputArea || !chatMessages) {
        console.log('❌ Chat elements not found');
        return;
    }
    
    // PAKSA posisi input area
    chatInputArea.style.position = 'fixed';
    chatInputArea.style.bottom = '60px'; // Tinggi bottom navigation
    chatInputArea.style.left = '0';
    chatInputArea.style.right = '0';
    chatInputArea.style.zIndex = '1000';
    chatInputArea.style.backgroundColor = 'var(--bg-card)';
    
    // PAKSA margin-bottom pada chat messages
    chatMessages.style.paddingBottom = '80px';
    chatMessages.style.marginBottom = '0';
    
    // Scroll ke bawah
    setTimeout(() => {
        chatMessages.scrollTop = chatMessages.scrollHeight;
        console.log('📜 Scrolled to bottom, new scrollTop:', chatMessages.scrollTop);
        
        // Focus input
        chatInput.focus();
        
        // Cek ulang posisi
        const rect = chatInputArea.getBoundingClientRect();
        console.log('New chat input position:', {
            bottom: rect.bottom,
            windowHeight: window.innerHeight,
            visible: rect.bottom <= window.innerHeight
        });
    }, 300);
}

// Panggil saat chat room dibuka
function setupChatRoomVisibility() {
    ensureChatInputVisible();
    
    // Observasi perubahan DOM
    const observer = new MutationObserver(() => {
        ensureChatInputVisible();
    });
    
    const chatRoom = document.querySelector('.chat-room');
    if (chatRoom) {
        observer.observe(chatRoom, { childList: true, subtree: true });
    }
    
    // Observasi resize
    window.addEventListener('resize', () => {
        setTimeout(ensureChatInputVisible, 100);
    });
}


// =========================================================
// FIXED: openChatRoom - langsung tampilkan chat dengan semua perbaikan
// =========================================================
async function openChatRoom(roomId) {
    const room = chatRooms.find(r => String(r.id) === String(roomId));
    if (!room) {
        console.error('Room not found:', roomId);
        return;
    }

    // Pastikan other_user sudah diparse
    if (room.other_user && typeof room.other_user === 'string') {
        try {
            room.other_user = JSON.parse(room.other_user);
        } catch (e) {
            console.error('Failed to parse other_user in openChatRoom:', e);
            room.other_user = null;
        }
    }

    // Pastikan chat view sudah dirender
    const chatMain = document.getElementById('chatMainArea');
    if (!chatMain) {
        console.warn('ChatMainArea not found, rendering chat view first...');
        await renderChatView();
        // Tunggu DOM terupdate
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    const chatMain2 = document.getElementById('chatMainArea');
    if (!chatMain2) {
        console.error('Failed to render chat view');
        return;
    }

    if (currentChatRoom && socket) {
        socket.emit('leave_chat_room', currentChatRoom.id);
    }

    currentChatRoom = room;
    messagePage = 1;
    hasMoreMessages = true;
    replyToMessage = null;

    if (socket) {
        socket.emit('join_chat_room', roomId);
    }

    // Render chat room template
    const template = document.getElementById('chat-room-template');
    chatMain2.innerHTML = template ? template.innerHTML : getDefaultChatRoomTemplate();

    // 🔥 TAMBAHKAN CLASS UNTUK MOBILE - SEMBUNYIKAN BOTTOM NAV
    if (window.innerWidth <= 640) {
        document.body.classList.add('chat-room-active');
    }

    // 🔥 TUNGGU DOM SIAP
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // 🔥 PAKSA INPUT TERLIHAT
    if (typeof ensureChatInputVisible === 'function') {
        ensureChatInputVisible();
    }
    
    if (typeof setupChatRoomVisibility === 'function') {
        setupChatRoomVisibility();
    }

    // 🔥 TAMPILKAN CHAT ROOM, SEMBUNYIKAN CHAT SIDEBAR DI MOBILE
    if (window.innerWidth <= 640) {
        const chatSidebar = document.querySelector('.chat-sidebar');
        const chatRoom = document.querySelector('.chat-room');
        
        if (chatSidebar) {
            chatSidebar.style.display = 'none';
        }
        
        if (chatRoom) {
            chatRoom.style.display = 'flex';
        }
        
        // Tampilkan back button
        const backButton = document.querySelector('.back-button');
        if (backButton) {
            backButton.style.display = 'flex';
        }
    }

    // Tunggu DOM siap
    await new Promise(resolve => setTimeout(resolve, 50));

    // Parse other_user dengan aman
    const otherUser = room.other_user;
    const isGroup = isValidGroupRoom(room);
    
    let roomName = 'Chat';
    let avatarUrl = '/img/default-avatar.png';

    const avatarImg = document.getElementById('chatRoomAvatar');
    const nameEl = document.getElementById('chatRoomName');

    if (isGroup) {
        // GROUP CHAT
        const groupId = room.group_id;
        const group = Array.isArray(groups) ? groups.find(g => String(g.id) === String(groupId)) : null;
        
        roomName = group?.name || getGroupNameFromId(groupId);
        avatarUrl = group?.avatar_url || '/img/default-group.png';
        
        if (avatarImg) {
            avatarImg.src = avatarUrl;
            avatarImg.onerror = () => {
                avatarImg.src = '/img/default-group.png';
                avatarImg.onerror = null;
            };
        }
        
        // Set status untuk group
        const statusEl = document.getElementById('chatRoomStatus');
        if (statusEl) {
            statusEl.textContent = `${room.participant_count || 0} members`;
            statusEl.className = 'chat-room-status';
            statusEl.style.color = 'var(--text-secondary)';
        }
    } else if (otherUser) {
        // PRIVATE CHAT
        roomName = otherUser.full_name || otherUser.username || 'Unknown User';
        avatarUrl = otherUser.profile_picture_url || '/img/default-avatar.png';
        
        if (avatarImg) {
            avatarImg.src = avatarUrl;
            avatarImg.onerror = () => {
                avatarImg.src = '/img/default-avatar.png';
                avatarImg.onerror = null;
            };
        }
        
        // Get presence untuk private chat
        getPresence(otherUser.id);
    }

    if (nameEl) nameEl.textContent = roomName;

    // Load messages
// Di dalam openChatRoom, setelah load messages
await loadRoomMessages(roomId);
await markMessagesRead(roomId);

// Scroll ke bawah
scrollChatToBottom();

// Setup observer untuk pesan baru
setupChatRoom();

    // Reset unread count
    room.unread_count = 0;
    refreshChatRooms();

    // 🔥 SETUP KEYBOARD HANDLING
    if (typeof setupChatRoomKeyboardHandling === 'function') {
        setupChatRoomKeyboardHandling();
    }

    // Focus input dengan delay untuk mobile
    setTimeout(() => {
        const input = document.getElementById('chatMessageInput');
        if (input) {
            input.focus();
            
            // Di mobile, scroll ke bawah
            if (window.innerWidth <= 640) {
                const chatMessages = document.getElementById('chatMessages');
                if (chatMessages) {
                    chatMessages.scrollTop = chatMessages.scrollHeight;
                    
                    // Debug posisi input
                    const chatInputArea = document.querySelector('.chat-input-area');
                    if (chatInputArea) {
                        const rect = chatInputArea.getBoundingClientRect();
                        console.log('Chat input position after focus:', {
                            bottom: rect.bottom,
                            windowHeight: window.innerHeight,
                            visible: rect.bottom <= window.innerHeight
                        });
                    }
                }
            }
        }
    }, 500); // Delay lebih lama untuk mobile

    // Setup scroll listener
    const messagesContainer = document.getElementById('chatMessages');
    if (messagesContainer) {
        messagesContainer.removeEventListener('scroll', handleMessageScroll);
        messagesContainer.addEventListener('scroll', handleMessageScroll);
    }
}

// Default template fallback
function getDefaultChatRoomTemplate() {
    return `
        <div class="chat-room">
            <div class="chat-room-header">
                <div class="chat-room-info">
                    <button class="btn-icon back-button" onclick="closeChatRoom()" title="Kembali">
                        <i class="fas fa-arrow-left"></i>
                    </button>
                    <div class="chat-room-avatar">
                        <img id="chatRoomAvatar" src="/img/default-avatar.png" alt="avatar" />
                    </div>
                    <div class="chat-room-details">
                        <h4 id="chatRoomName">Loading...</h4>
                        <span class="chat-room-status" id="chatRoomStatus">online</span>
                    </div>
                </div>
                <div class="chat-room-actions">
                    <button class="btn-icon" onclick="showRoomInfo()" title="Room Info">
                        <i class="fas fa-info-circle"></i>
                    </button>
                </div>
            </div>

            <div class="chat-messages" id="chatMessages">
                <div class="loading-state"><div class="loading-spinner small"></div></div>
            </div>

            <div class="chat-input-area">
                <div class="chat-typing-indicator" id="typingIndicator" style="display: none;">
                    <span>Someone is typing</span>
                    <span class="typing-dots"><span>.</span><span>.</span><span>.</span></span>
                </div>

                <div class="chat-input-wrapper">
                    <button class="btn-icon" onclick="showFileUploadModal()" title="Attach File">
                        <i class="fas fa-paperclip"></i>
                    </button>
                    <button class="btn-icon" onclick="toggleEmojiPicker()" title="Emoji">
                        <i class="fas fa-smile"></i>
                    </button>
                    <textarea
                        id="chatMessageInput"
                        placeholder="Type a message..."
                        rows="1"
                        onkeyup="handleTyping(event)"
                        onkeydown="handleEnterKey(event)"
                    ></textarea>
                    <button class="btn-send" onclick="sendMessage()">
                        <i class="fas fa-paper-plane"></i>
                    </button>
                </div>
            </div>
        </div>
    `;
}



async function loadUserProfile() {
    try {
        const response = await fetch('/api/auth/me', {
            headers: {
                'Authorization': `Bearer ${currentToken}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            currentUser = data.user;
            
            const profilePicUrl = await getProfilePictureUrlFixed(currentUser.id);
            currentUser.profile_picture_url = profilePicUrl;
            
            localStorage.setItem('user', JSON.stringify(currentUser));
            return currentUser;
        }
    } catch (error) {
        console.error('Load user profile error:', error);
    }
    return null;
}

// =========================================================
// 2) ✅ FIXED: replyToMessageFn (FULL)
// =========================================================
function replyToMessageFn(messageId, sender, messageText) {
    // Validasi lebih ketat untuk ID
    if (messageId == null) {
        console.warn('replyToMessageFn: messageId is null or undefined');
        showNotification('❌ Tidak dapat membalas pesan ini', 'error');
        return;
    }

    // Cegah reply ke pesan sementara (temp-)
    if (String(messageId).startsWith('temp-')) {
        showNotification('⏳ Tunggu pesan tersimpan dulu sebelum reply', 'info');
        return;
    }

    const id = parseInt(messageId);

    if (isNaN(id) || id === 0) {
        console.warn('replyToMessageFn: Invalid messageId:', messageId);
        showNotification('❌ ID pesan tidak valid', 'error');
        return;
    }

    // Sender minimal harus ada
    if (!sender) {
        console.warn('replyToMessageFn: sender is missing');
        showNotification('❌ Data pengirim tidak lengkap', 'error');
        return;
    }

    // messageText boleh kosong (image/file tanpa caption), jadi jangan blok
    if (messageText == null) messageText = '';

    replyToMessage = {
        id: id,
        sender: String(sender).substring(0, 50),
        message: String(messageText).substring(0, 200)
    };

    showReplyPreview();

    const input = document.getElementById('chatMessageInput');
    if (input) {
        input.focus();
        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}



// =========================================================
// 3) ✅ FIX tambahan (langsung di code kamu juga)
//    Preview reply: tampilkan placeholder kalau message kosong
//    (opsional tapi sangat membantu UX)
// =========================================================
function showReplyPreview() {
    const inputArea = document.querySelector('.chat-input-area');
    if (!inputArea) return;

    const existingPreview = document.querySelector('.reply-preview');
    if (existingPreview) existingPreview.remove();

    const preview = document.createElement('div');
    preview.className = 'reply-preview';

    const msg = (replyToMessage?.message ?? '').trim();
    const previewText = msg.length ? msg : '[Attachment]';

    preview.innerHTML = `
        <div class="reply-info">
            <span class="reply-sender">${escapeHtml(replyToMessage.sender)}</span>
            <span class="reply-message">${escapeHtml(previewText.substring(0, 50))}${previewText.length > 50 ? '...' : ''}</span>
        </div>
        <button class="cancel-reply" onclick="cancelReply()">
            <i class="fas fa-times"></i>
        </button>
    `;

    inputArea.insertBefore(preview, inputArea.firstChild);
}


function cancelReply() {
    replyToMessage = null;
    const preview = document.querySelector('.reply-preview');
    if (preview) {
        preview.remove();
    }
}

function toggleEmojiPicker() {
    const inputWrapper = document.querySelector('.chat-input-wrapper');
    if (!inputWrapper) return;
    
    const existingPicker = document.querySelector('.emoji-picker');
    if (existingPicker) {
        existingPicker.remove();
        emojiPickerVisible = false;
        return;
    }
    
    const picker = document.createElement('div');
    picker.className = 'emoji-picker';
    
    emojiList.forEach(emoji => {
        const emojiItem = document.createElement('span');
        emojiItem.className = 'emoji-item';
        emojiItem.textContent = emoji;
        emojiItem.onclick = () => insertEmoji(emoji);
        picker.appendChild(emojiItem);
    });
    
    inputWrapper.appendChild(picker);
    emojiPickerVisible = true;
}

function insertEmoji(emoji) {
    const input = document.getElementById('chatMessageInput');
    if (!input) return;
    
    const cursorPos = input.selectionStart;
    const text = input.value;
    input.value = text.substring(0, cursorPos) + emoji + text.substring(cursorPos);
    input.focus();
    
    const picker = document.querySelector('.emoji-picker');
    if (picker) {
        picker.remove();
        emojiPickerVisible = false;
    }
}

async function sendMessage() {
    const input = document.getElementById('chatMessageInput');
    const message = input.value; // JANGAN trim() dulu, biarkan spasi/enter
    
    if ((!message || !message.trim()) && !selectedChatFile) {
        // Jika hanya whitespace/enter, jangan kirim
        if (!selectedChatFile) return;
    }
    
    if (selectedChatFile) {
        await uploadChatFile();
        return;
    }

    // --- PERBAIKAN BUG REPLY ---
    // Snapshot reply sebelum di-cancel
    const reply = replyToMessage;
    // --- END PERBAIKAN ---
    
    // 🔥 FIX: Simpan message dengan newline yang asli
    const tempMessage = {
        id: 'temp-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
        user_id: currentUser.id,
        username: currentUser.username,
        full_name: currentUser.full_name,
        message: message, // Simpan dengan newline
        message_type: 'text',
        created_at: new Date().toISOString(),
        profile_picture_url: currentUser.profile_picture_url,
        reply_to: reply,
        message_status: 'sent'
    };
    
    appendMessage(tempMessage);
    
    input.value = '';
    input.style.height = 'auto';
    
    cancelReply(); // Hapus preview UI
    
    try {
        let url, payload;
        
        // Gunakan snapshot 'reply' untuk request
        if (reply) {
            url = `/api/chat/messages/${reply.id}/reply`;
            payload = {
                message: message, // Kirim dengan newline
                room_id: currentChatRoom.id
            };
        } else {
            url = `/api/chat/rooms/${currentChatRoom.id}/messages`;
            payload = { message: message }; // Kirim dengan newline
        }
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${currentToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        
        const data = await response.json();
        
        if (data.success) {
            const container = document.getElementById('chatMessages');
            const tempMsgElement = container.querySelector(`[data-message-id="${tempMessage.id}"]`);
            if (tempMsgElement) {
                tempMsgElement.remove();
            }
            
            const newMsgElement = createMessageElement(data.message);
            container.appendChild(newMsgElement);
            container.scrollTop = container.scrollHeight;
            
            refreshChatRooms();
        } else {
            const container = document.getElementById('chatMessages');
            const tempMsgElement = container.querySelector(`[data-message-id="${tempMessage.id}"]`);
            if (tempMsgElement) {
                tempMsgElement.remove();
            }
            showNotification('❌ Gagal mengirim pesan', 'error');
        }
    } catch (error) {
        console.error('Send message error:', error);
        const container = document.getElementById('chatMessages');
        const tempMsgElement = container.querySelector(`[data-message-id="${tempMessage.id}"]`);
        if (tempMsgElement) {
            tempMsgElement.remove();
        }
        showNotification('❌ Gagal mengirim pesan', 'error');
    }
}

function appendMessage(message) {
    const container = document.getElementById('chatMessages');
    if (!container) return;
    
    const existingMessage = container.querySelector(`[data-message-id="${message.id}"]`);
    if (existingMessage) {
        console.log('Message already exists, skipping');
        return;
    }
    
    const lastMessage = container.lastChild;
    if (lastMessage) {
        const lastMessageText = lastMessage.querySelector('.message-text')?.textContent;
        const lastMessageTime = lastMessage.getAttribute('data-message-time');
        
        if (lastMessageText === message.message && 
            Math.abs(new Date(message.created_at) - new Date(lastMessageTime)) < 2000) {
            console.log('Duplicate message detected, skipping');
            return;
        }
    }
    
    const msgEl = createMessageElement(message);
    container.appendChild(msgEl);
    
    container.scrollTop = container.scrollHeight;
}

function handleTyping(event) {
    if (!socket || !currentChatRoom) return;
    
    clearTimeout(typingTimeout);
    
    socket.emit('typing', {
        room_id: currentChatRoom.id,
        user_id: currentUser.id,
        username: currentUser.full_name || currentUser.username,
        is_typing: true
    });
    
    typingTimeout = setTimeout(() => {
        socket.emit('typing', {
            room_id: currentChatRoom.id,
            user_id: currentUser.id,
            username: currentUser.full_name || currentUser.username,
            is_typing: false
        });
    }, 2000);
}

function showTypingIndicator(username) {
    const indicator = document.getElementById('typingIndicator');
    if (!indicator) return;
    
    indicator.style.display = 'block';
    indicator.querySelector('span:first-child').textContent = `${username} is typing`;
    
    setTimeout(() => {
        indicator.style.display = 'none';
    }, 3000);
}

function handleEnterKey(event) {
    if (event.key === 'Enter') {
        if (event.shiftKey) {
            // Shift+Enter = new line
            // Biarkan default behavior (tambah newline)
            return;
        } else {
            // Enter tanpa Shift = kirim pesan
            event.preventDefault();
            sendMessage();
        }
    }
}

async function markMessagesRead(roomId) {
    if (!socket || !currentUser || !roomId) return;
    
    console.log('Marking messages as read for room:', roomId);
    
    socket.emit('mark_read', {
        room_id: roomId,
        user_id: currentUser.id
    });
    
    // Update local unread count untuk room ini
    const roomIndex = chatRooms.findIndex(r => r.id == roomId);
    if (roomIndex !== -1) {
        chatRooms[roomIndex].unread_count = 0;
        // PASTIKAN FUNGSI INI ADA
        if (typeof displayChatRooms === 'function') {
            displayChatRooms(); // Refresh UI
        } else {
            console.warn('displayChatRooms not available, refreshing via loadChatRooms');
            loadChatRooms(); // Fallback
        }
    }
    
    // Update badge di sidebar
    updateNavChatBadge();
}

function handleMessageScroll() {
    const container = document.getElementById('chatMessages');
    if (!container || !hasMoreMessages || loadingMessages) return;
    
    if (container.scrollTop === 0) {
        const oldestMessage = container.firstChild;
        if (oldestMessage) {
            const timestamp = oldestMessage.getAttribute('data-message-time');
            if (timestamp) {
                loadRoomMessages(currentChatRoom.id, timestamp);
            }
        }
    }
}

function showAddFriendModal() {
    const existingModal = document.querySelector('.modal.active');
    if (existingModal) existingModal.remove();
    
    const modal = document.createElement('div');
    modal.className = 'modal active';
    
    const template = document.getElementById('add-friend-modal-template');
    if (template) {
        modal.innerHTML = template.innerHTML;
    } else {
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3><i class="fas fa-user-plus"></i> Add Friend</h3>
                    <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
                </div>

                <div class="modal-body">
                    <div class="form-group">
                        <label>Search by username, email, or name</label>
                        <div class="search-input">
                            <i class="fas fa-search"></i>
                            <input type="text" id="friendSearchInput" placeholder="Start typing..." onkeyup="searchUsers()" />
                        </div>
                    </div>

                    <div id="userSearchResults" class="user-search-results">
                        <div class="search-placeholder">
                            <i class="fas fa-users"></i>
                            <p>Search for users to add as friends</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    document.body.appendChild(modal);
}

async function searchUsers() {
    const input = document.getElementById('friendSearchInput');
    const query = input.value.trim();
    
    clearTimeout(searchTimeout);
    
    // PERBAIKAN: Minimal 3 karakter untuk mencari
    if (query.length < 3) {
        document.getElementById('userSearchResults').innerHTML = `
            <div class="search-placeholder">
                <i class="fas fa-users"></i>
                <p>Ketik minimal 3 karakter untuk mencari</p>
            </div>
        `;
        return;
    }
    
    searchTimeout = setTimeout(async () => {
        try {
            const response = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`, {
                headers: {
                    'Authorization': `Bearer ${currentToken}`
                }
            });
            
            const data = await response.json();
            
            if (data.success) {
                displaySearchResults(data.users);
            }
        } catch (error) {
            console.error('Search users error:', error);
        }
    }, 500);
}

function displaySearchResults(users) {
    const container = document.getElementById('userSearchResults');
    
    if (users.length === 0) {
        container.innerHTML = `
            <div class="search-placeholder">
                <i class="fas fa-user-slash"></i>
                <p>No users found</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = users.map(user => `
        <div class="search-result-item">
            <div class="user-info">
                <i class="fas fa-user-circle"></i>
                <div>
                    <strong>${escapeHtml(user.full_name || user.username)}</strong>
                    <small>@${escapeHtml(user.username)}</small>
                </div>
            </div>
            <button class="btn-primary btn-sm" onclick="sendFriendRequest(${user.id})">
                <i class="fas fa-user-plus"></i> Add Friend
            </button>
        </div>
    `).join('');
}

async function sendFriendRequest(userId) {
    try {
        const response = await fetch(`/api/friends/request/${userId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${currentToken}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('✅ Friend request sent!', 'success');
            const modal = document.querySelector('.modal.active');
            if (modal) modal.remove();
        } else {
            showNotification('❌ ' + (data.error || 'Failed to send request'), 'error');
        }
    } catch (error) {
        console.error('Send friend request error:', error);
        showNotification('❌ Failed to send request', 'error');
    }
}

async function loadFriendRequests() {
    try {
        const response = await fetch('/api/friends/requests/pending', {
            headers: {
                'Authorization': `Bearer ${currentToken}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            friendRequests = data.requests;
            updateFriendRequestsBadge();
        }
    } catch (error) {
        console.error('Load friend requests error:', error);
    }
}

function updateFriendRequestsBadge() {
    const badge = document.getElementById('friendRequestsBadge');
    const count = document.getElementById('friendRequestsCount');
    
    if (friendRequests.length > 0) {
        badge.style.display = 'flex';
        count.textContent = friendRequests.length;
    } else {
        badge.style.display = 'none';
    }
}

function showFriendRequests() {
    const existingModal = document.querySelector('.modal.active');
    if (existingModal) existingModal.remove();
    
    const modal = document.createElement('div');
    modal.className = 'modal active';
    
    const template = document.getElementById('friend-requests-modal-template');
    if (template) {
        modal.innerHTML = template.innerHTML;
    } else {
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3><i class="fas fa-user-friends"></i> Friend Requests</h3>
                    <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
                </div>

                <div class="modal-body">
                    <div id="friendRequestsList" class="friend-requests-list">
                        <div class="loading-state"><div class="loading-spinner small"></div></div>
                    </div>
                </div>
            </div>
        `;
    }
    
    document.body.appendChild(modal);
    
    displayFriendRequests();
}

async function displayFriendRequests() {
    const container = document.getElementById('friendRequestsList');
    if (!container) return;
    
    if (friendRequests.length === 0) {
        container.innerHTML = `
            <div class="empty-state small">
                <i class="fas fa-user-friends"></i>
                <p>No pending friend requests</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = friendRequests.map(request => `
        <div class="friend-request-item">
            <div class="user-info">
                <i class="fas fa-user-circle"></i>
                <div>
                    <strong>${escapeHtml(request.full_name || request.username)}</strong>
                    <small>@${escapeHtml(request.username)}</small>
                </div>
            </div>
            <div class="request-actions">
                <button class="btn-icon success" onclick="acceptFriendRequest(${request.id})" title="Accept">
                    <i class="fas fa-check"></i>
                </button>
                <button class="btn-icon danger" onclick="rejectFriendRequest(${request.id})" title="Reject">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        </div>
    `).join('');
}

async function acceptFriendRequest(requestId) {
    try {
        const response = await fetch(`/api/friends/accept/${requestId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${currentToken}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('✅ Friend request accepted!', 'success');
            loadFriendRequests();
            loadChatRooms();
            
            if (data.room_id) {
                openChatRoom(data.room_id);
            }
            
            const modal = document.querySelector('.modal.active');
            if (modal) modal.remove();
        } else {
            showNotification('❌ ' + (data.error || 'Failed to accept request'), 'error');
        }
    } catch (error) {
        console.error('Accept friend request error:', error);
        showNotification('❌ Failed to accept request', 'error');
    }
}

async function rejectFriendRequest(requestId) {
    try {
        const response = await fetch(`/api/friends/reject/${requestId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${currentToken}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('✅ Friend request rejected', 'info');
            loadFriendRequests();
            
            const modal = document.querySelector('.modal.active');
            if (modal) modal.remove();
        } else {
            showNotification('❌ ' + (data.error || 'Failed to reject request'), 'error');
        }
    } catch (error) {
        console.error('Reject friend request error:', error);
        showNotification('❌ Failed to reject request', 'error');
    }
}

function showFileUploadModal() {
    const existingModal = document.querySelector('.modal.active');
    if (existingModal) existingModal.remove();
    
    const modal = document.createElement('div');
    modal.className = 'modal active';
    
    const template = document.getElementById('chat-file-upload-modal-template');
    if (template) {
        modal.innerHTML = template.innerHTML;
    } else {
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3><i class="fas fa-upload"></i> Upload File</h3>
                    <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
                </div>

                <div class="modal-body">
                    <div class="file-upload-area" id="chatFileDropZone">
                        <i class="fas fa-cloud-upload-alt"></i>
                        <p>Drag & drop file atau <span class="browse-link" onclick="document.getElementById('chatFileInput').click()">browse</span></p>
                        <input type="file" id="chatFileInput" style="display: none;" onchange="handleChatFileSelect(this.files[0])" />
                    </div>

                    <div id="chatFilePreview" class="file-preview"></div>

                    <div class="form-group" style="margin-top: 20px;">
                        <label>Optional message</label>
                        <textarea id="chatFileMessage" rows="3" placeholder="Add a message..."></textarea>
                    </div>

                    <div class="form-actions">
                        <button type="button" class="btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                        <button type="button" class="btn-primary" onclick="uploadChatFile()">Send</button>
                    </div>
                </div>
            </div>
        `;
    }
    
    document.body.appendChild(modal);
    
    const dropZone = document.getElementById('chatFileDropZone');
    const fileInput = document.getElementById('chatFileInput');
    const messageTextarea = document.getElementById('chatFileMessage');
    
    if (dropZone && fileInput) {
        dropZone.addEventListener('click', (e) => {
            if (e.target.classList.contains('browse-link')) return;
            fileInput.click();
        });
        
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
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                fileInput.files = files;
                handleChatFileSelect(files[0]);
            }
        });
    }
    
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handleChatFileSelect(e.target.files[0]);
            }
        });
    }
    
    setTimeout(() => {
        if (messageTextarea) messageTextarea.focus();
    }, 300);
}

function handleChatFileSelect(file) {
    if (!file) return;
    
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
        showNotification('❌ Ukuran file maksimal 50MB', 'error');
        return;
    }
    
    selectedChatFile = file;
    
    const preview = document.getElementById('chatFilePreview');
    if (!preview) return;
    
    const isImage = file.type.startsWith('image/');
    
    if (isImage) {
        const reader = new FileReader();
        reader.onload = (e) => {
            preview.innerHTML = `
                <div class="file-preview-item">
                    <img src="${e.target.result}" alt="Preview" style="width: 40px; height: 40px; object-fit: cover; border-radius: var(--radius-sm);">
                    <span class="name">${escapeHtml(file.name)}</span>
                    <span class="size">${formatFileSize(file.size)}</span>
                    <button type="button" onclick="removeChatFile()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
            preview.classList.add('active');
        };
        reader.readAsDataURL(file);
    } else {
        preview.innerHTML = `
            <div class="file-preview-item">
                <i class="fas ${getFileIcon(file.name)}"></i>
                <span class="name">${escapeHtml(file.name)}</span>
                <span class="size">${formatFileSize(file.size)}</span>
                <button type="button" onclick="removeChatFile()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        preview.classList.add('active');
    }
}

function removeChatFile() {
    selectedChatFile = null;
    const preview = document.getElementById('chatFilePreview');
    if (preview) {
        preview.classList.remove('active');
        preview.innerHTML = '';
    }
    const fileInput = document.getElementById('chatFileInput');
    if (fileInput) fileInput.value = '';
}

// Fungsi uploadChatFile yang sudah ada, tambahkan logging error
async function uploadChatFile() {
    if (!selectedChatFile || !currentChatRoom) return;

    const reply = replyToMessage;
    const message = document.getElementById('chatFileMessage')?.value || '';
    
    const isImage = selectedChatFile.type.startsWith('image/');
    const messageType = isImage ? 'image' : 'file';
    
    let tempImageUrl = null;
    if (isImage) {
        tempImageUrl = URL.createObjectURL(selectedChatFile);
    }
    
    const tempMessage = {
        id: 'temp-' + Date.now(),
        user_id: currentUser.id,
        username: currentUser.username,
        full_name: currentUser.full_name,
        message: message,
        message_type: messageType,
        file_name: selectedChatFile.name,
        file_size: selectedChatFile.size,
        created_at: new Date().toISOString(),
        profile_picture_url: currentUser.profile_picture_url,
        reply_to: reply,
        tempImageUrl: tempImageUrl,
        tempFileData: URL.createObjectURL(selectedChatFile),
        message_status: 'sent'
    };
    
    appendMessage(tempMessage);
    cancelReply();
    
    const modal = document.querySelector('.modal.active');
    if (modal) modal.remove();
    
    try {
        const formData = new FormData();
        formData.append('file', selectedChatFile);
        formData.append('message', message);
        
        if (reply) {
            formData.append('reply_to_id', reply.id);
        }
        
        console.log('📤 Uploading file to server:', selectedChatFile.name);
        
        const response = await fetch(`/api/chat/rooms/${currentChatRoom.id}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${currentToken}`
            },
            body: formData
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            console.error('Server error:', data);
            throw new Error(data.error || `HTTP ${response.status}`);
        }
        
        if (data.success) {
            const container = document.getElementById('chatMessages');
            const tempMsgElement = container.querySelector(`[data-message-id="${tempMessage.id}"]`);
            if (tempMsgElement) {
                tempMsgElement.remove();
            }
            
            appendMessage(data.message);
            refreshChatRooms();
            selectedChatFile = null;
            
            const fileInput = document.getElementById('chatFileInput');
            if (fileInput) fileInput.value = '';
            
            showNotification('✅ File berhasil dikirim', 'success');
        } else {
            throw new Error(data.error || 'Gagal mengirim file');
        }
    } catch (error) {
        console.error('Upload file error:', error);
        showNotification('❌ Gagal mengirim file: ' + error.message, 'error');
        
        const container = document.getElementById('chatMessages');
        const tempMsgElement = container.querySelector(`[data-message-id="${tempMessage.id}"]`);
        if (tempMsgElement) {
            tempMsgElement.remove();
        }
    } finally {
        if (tempMessage.tempImageUrl) {
            URL.revokeObjectURL(tempMessage.tempImageUrl);
        }
        if (tempMessage.tempFileData) {
            URL.revokeObjectURL(tempMessage.tempFileData);
        }
        selectedChatFile = null;
    }
}

function showDeleteChatConfirmation() {
    if (!currentChatRoom) return;
    
    const existingModal = document.querySelector('.modal.active');
    if (existingModal) existingModal.remove();
    
    const modal = document.createElement('div');
    modal.className = 'modal active';
    
    const template = document.getElementById('delete-chat-modal-template');
    if (template) {
        modal.innerHTML = template.innerHTML;
    } else {
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3><i class="fas fa-trash"></i> Delete Chat</h3>
                    <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
                </div>

                <div class="modal-body">
                    <p style="margin-bottom: 20px;">
                        Are you sure you want to delete all messages in this chat? This action cannot be undone.
                    </p>

                    <div class="form-group">
                        <label>Reason (optional)</label>
                        <textarea id="deleteChatReason" rows="3" placeholder="Enter reason for deletion..."></textarea>
                    </div>

                    <div class="form-actions">
                        <button type="button" class="btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                        <button type="button" class="btn-danger" onclick="deleteChatMessages()">Delete All Messages</button>
                    </div>
                </div>
            </div>
        `;
    }
    
    document.body.appendChild(modal);
}

async function deleteChatMessages() {
    if (!currentChatRoom) return;
    
    const reason = document.getElementById('deleteChatReason')?.value;
    
    try {
        const response = await fetch(`/api/chat/rooms/${currentChatRoom.id}/messages`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${currentToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ reason })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('✅ Chat messages deleted', 'success');
            
            const modal = document.querySelector('.modal.active');
            if (modal) modal.remove();
            
            clearChatMessages();
        } else {
            showNotification('❌ ' + (data.error || 'Failed to delete messages'), 'error');
        }
    } catch (error) {
        console.error('Delete chat messages error:', error);
        showNotification('❌ Failed to delete messages', 'error');
    }
}

function clearChatMessages() {
    const container = document.getElementById('chatMessages');
    if (container) {
        container.innerHTML = '';
    }
}

// =========================================================
// ✅ 5) FIXED: showRoomInfo (FULL)
// - other_user bisa string JSON / object -> parse aman pakai safeJsonParse
// =========================================================
async function showRoomInfo() {
    if (!currentChatRoom) return;

    const existingModal = document.querySelector('.modal.active');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.className = 'modal active';

    const template = document.getElementById('room-info-modal-template');
    if (template) {
        modal.innerHTML = template.innerHTML;
    } else {
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3><i class="fas fa-info-circle"></i> Room Information</h3>
                    <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
                </div>

                <div class="modal-body">
                    <div class="room-info" id="roomInfoContent"></div>
                </div>
            </div>
        `;
    }

    document.body.appendChild(modal);

    // ✅ parse other_user aman (bisa string atau object)
    const otherUser = safeJsonParse(currentChatRoom.other_user);

    let roomName = 'Chat';
    if (otherUser) {
        roomName = otherUser.full_name || otherUser.username || 'Unknown User';
    } else if (currentChatRoom.group_id) {
        roomName = getGroupNameById(currentChatRoom.group_id);
    } else {
        // fallback kalau backend punya field name/title
        roomName = currentChatRoom.name || currentChatRoom.title || 'Chat';
    }

    const content = document.getElementById('roomInfoContent');
    if (!content) return;

    content.innerHTML = `
        <div class="room-info-item">
            <span class="label">Room Name</span>
            <span class="value">${escapeHtml(roomName)}</span>
        </div>
        <div class="room-info-item">
            <span class="label">Created</span>
            <span class="value">${formatDate(currentChatRoom.created_at)}</span>
        </div>
        <div class="room-info-item">
            <span class="label">Total Messages</span>
            <span class="value">${currentChatRoom.message_count || 0}</span>
        </div>
        ${currentUser?.role === 'admin' ? `
            <hr>
            <div class="room-info-item">
                <span class="label">Admin Actions</span>
                <button class="btn-danger btn-sm" onclick="showDeleteChatConfirmation()">
                    <i class="fas fa-trash"></i> Delete All Messages
                </button>
            </div>
        ` : ''}
    `;
}

// =============== ESC KEY HANDLER ===============
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        // Cek apakah sedang di chat room
        if (currentChatRoom) {
            e.preventDefault();
            closeChatRoom();
            // showNotification('👋 Keluar dari percakapan', 'info');
        }
        
        // Tutup modal yang aktif jika ada
        const activeModal = document.querySelector('.modal.active');
        if (activeModal) {
            activeModal.remove();
        }
    }
});


// =========================================================
// 5) ✅ FIXED: filterChats (FULL) - biar konsisten parse other_user
//     (ini yang tadi sering bikin "Unknown User" atau error)
// =========================================================
function filterChats() {
    const searchTerm = (document.getElementById('chatSearch')?.value || '').toLowerCase();
    if (!searchTerm) {
        displayChatRooms();
        return;
    }

    const filtered = chatRooms.filter(room => {
        const otherUser = safeJsonParse(room.other_user);

        let roomName = '';
        if (otherUser) {
            roomName = (otherUser.full_name || otherUser.username || '').toLowerCase();
        } else if (room.group_id) {
            const group = groups.find(g => g.id == room.group_id);
            roomName = (group?.name || '').toLowerCase();
        }
        return roomName.includes(searchTerm);
    });

    const container = document.getElementById('chatRoomsList');
    if (!container) return;

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="empty-state small">
                <i class="fas fa-search"></i>
                <p>No chats found</p>
            </div>
        `;
        return;
    }

    container.innerHTML = filtered.map(room => {
        const otherUser = safeJsonParse(room.other_user);

        let roomName = 'Unknown User';
        let profilePicHtml = '<i class="fas fa-user-circle"></i>';

        if (otherUser) {
            roomName = otherUser.full_name || otherUser.username || 'Unknown User';
            if (otherUser.profile_picture_url) {
                profilePicHtml = `<img src="${otherUser.profile_picture_url}" alt="${escapeHtml(roomName)}">`;
            }
        } else if (room.group_id) {
            const group = groups.find(g => g.id == room.group_id);
            if (group) {
                roomName = group.name || 'Group Chat';
                if (group.avatar_url) {
                    profilePicHtml = `<img src="${group.avatar_url}" alt="${escapeHtml(roomName)}">`;
                } else {
                    profilePicHtml = '<i class="fas fa-users"></i>';
                }
            }
        }

        const lastMessageRaw = room.last_message || '';
        const lastMessage = lastMessageRaw.length > 30 ? lastMessageRaw.substring(0, 30) + '...' : lastMessageRaw;
        const lastTime = room.last_message_time ? formatTime(room.last_message_time) : '';
        const unread = room.unread_count || 0;

        return `
            <div class="chat-room-item ${currentChatRoom && currentChatRoom.id == room.id ? 'active' : ''}" onclick="openChatRoom(${room.id})">
                <div class="chat-room-avatar">
                    ${profilePicHtml}
                </div>
                <div class="chat-room-preview">
                    <div class="chat-room-name">
                        <h4>${escapeHtml(roomName)}</h4>
                        <span class="chat-time">${lastTime}</span>
                    </div>
                    <div class="chat-last-message">
                        <p>${escapeHtml(lastMessage)}</p>
                        ${unread > 0 ? `<span class="unread-badge">${unread}</span>` : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}


function refreshChatRooms() {
    loadChatRooms();
}

function formatTime(dateString) {
    if (!dateString) return '';
    try {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now - date;
        
        if (diff < 86400000) {
            return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        } else {
            return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
        }
    } catch (e) {
        return '';
    }
}

function updateRoomUnreadCount(roomId) {
    const room = chatRooms.find(r => r.id == roomId);
    if (room) {
        room.unread_count = (room.unread_count || 0) + 1;
        displayChatRooms();
    }
}

function updateMessageReadStatus(userId, readAt) {
    const messages = document.querySelectorAll('.message.own');
    messages.forEach(msg => {
        const statusSpan = msg.querySelector('.message-status');
        if (statusSpan) {
            statusSpan.className = 'message-status read';
            statusSpan.innerHTML = '<i class="fas fa-check-double" style="color: var(--primary);"></i>';
            statusSpan.title = 'Dibaca';
        }
    });
}

async function getPresence(userId) {
    try {
        const response = await fetch(`/api/user/presence/${userId}`, {
            headers: {
                'Authorization': `Bearer ${currentToken}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            const statusEl = document.getElementById('chatRoomStatus');
            if (statusEl) {
                if (data.status === 'online') {
                    statusEl.textContent = 'online';
                    statusEl.className = 'chat-room-status online';
                } else {
                    const lastSeen = data.last_seen ? timeAgo(data.last_seen) : 'long time ago';
                    statusEl.textContent = `last seen ${lastSeen}`;
                    statusEl.className = 'chat-room-status offline';
                }
            }
        }
    } catch (error) {
        console.error('Get presence error:', error);
    }
}

function updateNavChatBadge() {
    const navChatBadge = document.getElementById('navChatBadge');
    if (navChatBadge && Array.isArray(chatRooms)) {
        const totalUnread = chatRooms.reduce((sum, room) => sum + (room.unread_count || 0), 0);
        navChatBadge.textContent = totalUnread || 0;
        
        // Sembunyikan badge jika 0
        if (totalUnread === 0) {
            navChatBadge.style.display = 'none';
        } else {
            navChatBadge.style.display = 'inline-block';
        }
    }
}

// =============== MOBILE MENU TOGGLE ===============
function toggleMobileMenu() {
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
        sidebar.classList.toggle('expanded');
        
        const icon = document.querySelector('.mobile-menu-toggle i');
        if (icon) {
            if (sidebar.classList.contains('expanded')) {
                icon.className = 'fas fa-times';
            } else {
                icon.className = 'fas fa-bars';
            }
        }
    }
}

// Auto close mobile menu when clicking outside
document.addEventListener('click', function(e) {
    const sidebar = document.querySelector('.sidebar');
    const toggle = document.querySelector('.mobile-menu-toggle');
    
    if (window.innerWidth <= 640 && 
        sidebar && 
        sidebar.classList.contains('expanded') && 
        !sidebar.contains(e.target) && 
        !toggle.contains(e.target)) {
        sidebar.classList.remove('expanded');
        const icon = toggle.querySelector('i');
        if (icon) icon.className = 'fas fa-bars';
    }
});

// Show/hide mobile menu toggle based on screen size
window.addEventListener('resize', function() {
    const toggle = document.querySelector('.mobile-menu-toggle');
    if (toggle) {
        if (window.innerWidth <= 640) {
            toggle.style.display = 'flex';
        } else {
            toggle.style.display = 'none';
            
            // Reset sidebar expanded state on desktop
            const sidebar = document.querySelector('.sidebar');
            if (sidebar) {
                sidebar.classList.remove('expanded');
            }
        }
    }
});

// Initialize on load
document.addEventListener('DOMContentLoaded', function() {
    const toggle = document.querySelector('.mobile-menu-toggle');
    if (toggle) {
        if (window.innerWidth <= 640) {
            toggle.style.display = 'flex';
        } else {
            toggle.style.display = 'none';
        }
    }
});

// =========================================================
// FIXED: renderChatView - dengan inisialisasi yang benar
// =========================================================
function renderChatView() {
    const contentArea = document.getElementById('contentArea');
    if (!contentArea) return;
    
    const template = document.getElementById('chat-view-template');
    if (template) {
        contentArea.innerHTML = template.innerHTML;
    } else {
        // Fallback template
        contentArea.innerHTML = `
            <div class="chat-view">
                <div class="chat-container glassmorphism">
                    <div class="chat-sidebar" id="chatSidebar">
                        <div class="chat-sidebar-header">
                            <h3><i class="fas fa-comments"></i> Chats</h3>
                            <button class="btn-icon" onclick="showAddFriendModal()" title="Add Friend">
                                <i class="fas fa-user-plus"></i>
                            </button>
                        </div>

                        <div class="chat-search">
                            <i class="fas fa-search"></i>
                            <input type="text" id="chatSearch" placeholder="Search chats..." onkeyup="filterChats()" />
                        </div>

                        <div class="friend-requests-badge" id="friendRequestsBadge" style="display: none;" onclick="showFriendRequests()">
                            <i class="fas fa-user-friends"></i>
                            <span>Friend Requests</span>
                            <span class="badge" id="friendRequestsCount">0</span>
                        </div>

                        <div class="chat-rooms-list" id="chatRoomsList">
                            <div class="loading-state"><div class="loading-spinner small"></div></div>
                        </div>
                    </div>

                    <div class="chat-main" id="chatMainArea">
                        <div class="chat-placeholder">
                            <i class="fas fa-comment-dots"></i>
                            <h3>Select a chat to start messaging</h3>
                            <p>Choose a friend from the list to begin conversation</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Reset current chat room
    currentChatRoom = null;
    
    // Di mobile, pastikan sidebar terlihat
    if (window.innerWidth <= 640) {
        const sidebar = document.querySelector('.chat-sidebar');
        const chatRoom = document.querySelector('.chat-room');
        if (sidebar) sidebar.style.display = 'block';
        if (chatRoom) chatRoom.style.display = 'none';
    }
    
    // Load data
    loadChatRooms();
    loadFriendRequests();
    startPresenceTracking();
}

// =============== PASTE IMAGE WITH CTRL+V - PRODUCTION VERSION ===============
let pasteFile = null;
let pastePreviewUrl = null;
let isPasteInProgress = false;

// Event listener untuk paste
document.addEventListener('paste', async function(e) {
    // Cek apakah sedang di chat room
    if (!currentChatRoom) {
        return;
    }
    
    // Cek apakah fokus di input chat
    const chatInput = document.getElementById('chatMessageInput');
    const isChatFocused = chatInput && document.activeElement === chatInput;
    
    if (!isChatFocused) {
        return;
    }
    
    e.preventDefault();
    
    const items = e.clipboardData?.items;
    if (!items) return;
    
    // Cari gambar di clipboard
    for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
            const blob = items[i].getAsFile();
            if (blob) {
                handlePastedImage(blob);
                return;
            }
        }
    }
    
    // Paste text biasa
    if (items.length > 0 && items[0].type === 'text/plain') {
        items[0].getAsString(text => {
            const input = document.getElementById('chatMessageInput');
            if (input) {
                const start = input.selectionStart;
                const end = input.selectionEnd;
                input.value = input.value.substring(0, start) + text + input.value.substring(end);
                input.dispatchEvent(new Event('input', { bubbles: true }));
                
                if (socket && currentChatRoom) {
                    clearTimeout(typingTimeout);
                    socket.emit('typing', {
                        room_id: currentChatRoom.id,
                        user_id: currentUser.id,
                        username: currentUser.full_name || currentUser.username,
                        is_typing: true
                    });
                    typingTimeout = setTimeout(() => {
                        socket.emit('typing', {
                            room_id: currentChatRoom.id,
                            user_id: currentUser.id,
                            username: currentUser.full_name || currentUser.username,
                            is_typing: false
                        });
                    }, 2000);
                }
            }
        });
    }
});

// Handle gambar yang di-paste
function handlePastedImage(blob) {
    if (blob.size > 50 * 1024 * 1024) {
        showNotification('❌ Ukuran gambar maksimal 50MB', 'error');
        return;
    }
    
    if (!blob.type.startsWith('image/')) {
        showNotification('❌ File harus berupa gambar', 'error');
        return;
    }
    
    const fileExtension = blob.type.split('/')[1] || 'png';
    const fileName = `pasted-image-${Date.now()}.${fileExtension}`;
    
    try {
        pasteFile = new File([blob], fileName, { type: blob.type });
    } catch (e) {
        pasteFile = blob;
        Object.defineProperty(pasteFile, 'name', {
            value: fileName,
            writable: false
        });
    }
    
    pastePreviewUrl = null;
    isPasteInProgress = true;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        pastePreviewUrl = e.target.result;
        showPastePreview(pastePreviewUrl, pasteFile.name || fileName, pasteFile.size);
    };
    reader.onerror = () => {
        showNotification('❌ Gagal membaca gambar', 'error');
        cancelPaste();
    };
    reader.readAsDataURL(blob);
    
    const existingModal = document.querySelector('.modal.active');
    if (existingModal && existingModal.querySelector('#chatFileDropZone')) {
        existingModal.remove();
    }
}

// Tampilkan preview gambar
function showPastePreview(imageUrl, fileName, fileSize) {
    const existingPreview = document.querySelector('.paste-preview');
    if (existingPreview) {
        existingPreview.remove();
    }
    
    const preview = document.createElement('div');
    preview.className = 'paste-preview';
    preview.setAttribute('data-preview', 'active');
    preview.innerHTML = `
        <div class="paste-preview-header">
            <span><i class="fas fa-image"></i> Gambar dari Clipboard</span>
            <div class="paste-preview-actions">
                <button class="btn-icon" onclick="cancelPaste()" title="Batal">
                    <i class="fas fa-times"></i>
                </button>
                <button class="btn-icon success" onclick="sendPastedImage()" title="Kirim">
                    <i class="fas fa-paper-plane"></i>
                </button>
            </div>
        </div>
        <div class="paste-preview-content">
            <img src="${imageUrl}" alt="Preview" style="max-width: 100%; max-height: 200px; object-fit: contain;">
            <div class="paste-preview-info">
                <span class="file-name">${escapeHtml(fileName)}</span>
                <span class="file-size">${formatFileSize(fileSize)}</span>
            </div>
        </div>
        <div class="paste-preview-footer">
            <textarea id="pasteMessageInput" placeholder="Tambahkan pesan (opsional)..." rows="2"></textarea>
        </div>
    `;
    
    const chatInputArea = document.querySelector('.chat-input-area');
    if (chatInputArea) {
        chatInputArea.insertBefore(preview, chatInputArea.firstChild);
    } else {
        document.body.appendChild(preview);
    }
    
    setTimeout(() => {
        document.getElementById('pasteMessageInput')?.focus();
    }, 100);
}

// Kirim gambar yang di-paste
async function sendPastedImage() {
    if (!currentChatRoom) {
        showNotification('❌ Tidak ada room chat aktif', 'error');
        return;
    }
    
    if (!pasteFile) {
        showNotification('❌ Tidak ada gambar untuk dikirim', 'error');
        return;
    }
    
    // Fix jika file tidak punya name
    if (!(pasteFile instanceof File) || !pasteFile.name) {
        try {
            const blob = pasteFile;
            const fileExtension = blob.type?.split('/')[1] || 'png';
            const fileName = `pasted-image-${Date.now()}.${fileExtension}`;
            pasteFile = new File([blob], fileName, { type: blob.type || 'image/png' });
        } catch (e) {
            showNotification('❌ Format gambar tidak valid', 'error');
            cancelPaste();
            return;
        }
    }
    
    const messageInput = document.getElementById('pasteMessageInput');
    const message = messageInput ? messageInput.value.trim() : '';
    
    const tempId = 'temp-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    
    const fileToSend = pasteFile;
    const previewUrl = pastePreviewUrl;
    const currentReply = replyToMessage ? {...replyToMessage} : null;
    
    // Tampilkan preview sementara
    const tempMessage = {
        id: tempId,
        user_id: currentUser.id,
        username: currentUser.username,
        full_name: currentUser.full_name,
        message: message,
        message_type: 'image',
        file_name: fileToSend.name,
        file_size: fileToSend.size,
        created_at: new Date().toISOString(),
        profile_picture_url: currentUser.profile_picture_url,
        reply_to: currentReply,
        tempImageUrl: previewUrl,
        message_status: 'sent'
    };
    
    appendMessage(tempMessage);
    
    // Sembunyikan preview
    const preview = document.querySelector('.paste-preview');
    if (preview) {
        preview.style.display = 'none';
    }
    
    try {
        const formData = new FormData();
        formData.append('file', fileToSend, fileToSend.name);
        formData.append('message', message);
        
        if (currentReply && currentReply.id) {
            formData.append('reply_to_id', currentReply.id);
        }
        
        const response = await fetch(`/api/chat/rooms/${currentChatRoom.id}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${currentToken}`
            },
            body: formData
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || `HTTP ${response.status}`);
        }
        
        if (data.success) {
            // Hapus pesan sementara
            const container = document.getElementById('chatMessages');
            const tempMsgElement = container.querySelector(`[data-message-id="${tempId}"]`);
            if (tempMsgElement) {
                tempMsgElement.remove();
            }
            
            // Tambahkan pesan asli
            const newMsgElement = createMessageElement(data.message);
            container.appendChild(newMsgElement);
            container.scrollTop = container.scrollHeight;
            
            showNotification('✅ Gambar terkirim', 'success');
            
            if (currentReply) {
                cancelReply();
            }
            
        } else {
            throw new Error(data.error || 'Gagal mengirim gambar');
        }
    } catch (error) {
        let errorMessage = 'Gagal mengirim gambar';
        if (error.message.includes('413')) {
            errorMessage = 'Ukuran gambar terlalu besar';
        } else if (error.message.includes('500')) {
            errorMessage = 'Server error, coba lagi nanti';
        } else {
            errorMessage = error.message;
        }
        
        showNotification('❌ ' + errorMessage, 'error');
        
        // Hapus pesan sementara
        const container = document.getElementById('chatMessages');
        const tempMsgElement = container.querySelector(`[data-message-id="${tempId}"]`);
        if (tempMsgElement) {
            tempMsgElement.remove();
        }
    } finally {
        cancelPaste();
        if (preview) {
            preview.remove();
        }
    }
}

// Batal mengirim gambar
function cancelPaste() {
    const preview = document.querySelector('.paste-preview');
    if (preview) {
        preview.remove();
    }
    
    if (pastePreviewUrl) {
        URL.revokeObjectURL(pastePreviewUrl);
    }
    
    pasteFile = null;
    pastePreviewUrl = null;
    isPasteInProgress = false;
}

// Override fungsi showFileUploadModal
const originalShowFileUploadModal = showFileUploadModal;
showFileUploadModal = function() {
    if (pasteFile) {
        cancelPaste();
    }
    originalShowFileUploadModal();
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
window.previewFile = previewFile;
window.previewImage = previewImage;
window.getStatusIcon = getStatusIcon;
window.getStatusText = getStatusText;
window.getFileIcon = getFileIcon;
window.getFileType = getFileType;
window.formatDate = formatDate;
window.timeAgo = timeAgo;
window.formatFileSize = formatFileSize;
window.escapeHtml = escapeHtml;
window.path = path;
window.testNotificationSound = testNotificationSound;
window.toggleAudio = toggleAudio;
window.toggleDesktopNotifications = toggleDesktopNotifications;
window.showUploadProfilePictureModal = showUploadProfilePictureModal;
window.handleProfilePictureSelect = handleProfilePictureSelect;
window.uploadProfilePicture = uploadProfilePicture;
window.removeProfilePicture = removeProfilePicture;
window.closeChatRoom = closeChatRoom;
window.showAddFriendModal = showAddFriendModal;
window.searchUsers = searchUsers;
window.sendFriendRequest = sendFriendRequest;
window.showFriendRequests = showFriendRequests;
window.acceptFriendRequest = acceptFriendRequest;
window.rejectFriendRequest = rejectFriendRequest;
window.openChatRoom = openChatRoom;
window.sendMessage = sendMessage;
window.handleTyping = handleTyping;
window.handleEnterKey = handleEnterKey;
window.showFileUploadModal = showFileUploadModal;
window.handleChatFileSelect = handleChatFileSelect;
window.uploadChatFile = uploadChatFile;
window.showDeleteChatConfirmation = showDeleteChatConfirmation;
window.deleteChatMessages = deleteChatMessages;
window.showRoomInfo = showRoomInfo;
window.filterChats = filterChats;
window.toggleEmojiPicker = toggleEmojiPicker;
window.replyToMessageFn = replyToMessageFn;
window.cancelReply = cancelReply;
window.editMessage = editMessage;
window.deleteMessage = deleteMessage;
window.scrollToMessage = scrollToMessage;
window.createMessageElement = createMessageElement;
window.getProfilePictureUrlFixed = getProfilePictureUrlFixed;

// GROUP FUNCTIONS
window.renderGroupsView = renderGroupsView;
window.showCreateGroupModal = showCreateGroupModal;
window.showGroupDetail = showGroupDetail;
window.switchGroupsTab = switchGroupsTab;
window.acceptInvitation = acceptInvitation;
window.rejectInvitation = rejectInvitation;
window.showAddMembersModal = showAddMembersModal;
window.addSelectedMembers = addSelectedMembers;
window.addMembersToGroup = addMembersToGroup;
window.toggleSelectMember = toggleSelectMember;
window.removeMember = removeMember;
window.leaveGroup = leaveGroup;
window.transferAdmin = transferAdmin;
window.openGroupChat = openGroupChat;
window.editGroup = editGroup;

// ===== TAMBAHKAN INI - ANNOUNCEMENT FUNCTIONS =====
window.loadAnnouncements = loadAnnouncements;
window.closeAnnouncementModal = closeAnnouncementModal;
window.goToAnnouncement = goToAnnouncement;
window.showCreateAnnouncementModal = showCreateAnnouncementModal;
window.updateIconPreview = updateIconPreview;
window.editAnnouncement = editAnnouncement;
window.toggleAnnouncementStatus = toggleAnnouncementStatus;
window.deleteAnnouncement = deleteAnnouncement;
// ===== END TAMBAHAN =====