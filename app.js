// =====================================================
// TASK BOT DASHBOARD PRO - ULTIMATE EDITION
// DENGAN SISTEM LOGIN & FILE UPLOAD FIXED
// =====================================================

require('dotenv').config();

// =====================================================
// DNS CONFIGURATION - FIX FOR RAILWAY (TARUH DISINI!)
// =====================================================
const dns = require('dns');

// Set DNS servers (Google DNS sebagai fallback)
dns.setServers([
    '8.8.8.8',      // Google DNS
    '8.8.4.4',      // Google DNS
    '1.1.1.1',      // Cloudflare DNS
    '208.67.222.222' // OpenDNS
]);

console.log('✅ DNS configured with fallback servers');
// =====================================================

const express = require('express');
const mysql = require('mysql2/promise');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const cors = require('cors');
const FormData = require('form-data');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const session = require('express-session');
const flash = require('connect-flash');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const crypto = require('crypto');
const socketIO = require('socket.io');
const http = require('http');

// =====================================================
// INITIALIZATION
// =====================================================
const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
    cors: {
        origin: process.env.APP_URL || 'http://localhost:3002',
        credentials: true
    }
});
const PORT = process.env.PORT || 3002;

// =====================================================
// PRODUCTION CONFIGURATION
// =====================================================
const isProduction = process.env.NODE_ENV === 'production';

// Trust proxy untuk Railway (penting!)
if (isProduction) {
    app.set('trust proxy', 1);
}

// Tambahkan ini
const {
    cloudinary,
    uploadProfilePicture,
    uploadTaskFile,
    uploadChatFile,
    uploadScreenshot,
    deleteFromCloudinary,
    extractPublicIdFromUrl
} = require('./services/cloudinary');

// =====================================================
// MIDDLEWARE - dengan Cache-Control untuk development
// =====================================================

// Static Files - URUTAN PENTING! dengan cache control
app.use(express.static(path.join(__dirname, 'public'), {
    etag: false,
    lastModified: false,
    setHeaders: (res, path) => {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }
}));

app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
    etag: false,
    lastModified: false,
    setHeaders: (res, path) => {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }
}));

app.use('/files', express.static(path.join(__dirname, 'uploads'), {
    etag: false,
    lastModified: false,
    setHeaders: (res, path) => {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }
}));

// Security Middleware
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));

// Compression
app.use(compression());

// Rate Limiting - Update dengan validasi untuk development
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 menit
    max: 700,
    message: 'Terlalu banyak request, silakan coba lagi nanti.',
    // Tambahkan ini untuk mematikan validasi yang mengganggu
    validate: {
        xForwardedForHeader: false,
        trustProxy: false,
        ip: false
    }
});
app.use('/api/', limiter);

// CORS - Update untuk Railway
app.use(cors({
    origin: isProduction 
        ? [process.env.APP_URL, 'https://*.up.railway.app'].filter(Boolean)
        : 'http://localhost:3002',
    credentials: true
}));

// Body Parser
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Session - Update untuk Railway
app.use(session({
    secret: process.env.SESSION_SECRET || 'taskbot-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: isProduction, // true di production
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24, // 24 hours
        sameSite: isProduction ? 'none' : 'lax'
    }
}));

// Flash Messages
app.use(flash());

// =====================================================
// DATABASE CONNECTION POOL - UNTUK PRODUCTION
// =====================================================
let pool;

async function initDatabase() {
    try {
        // Di Railway, database URL akan diberikan sebagai environment variable
        const dbUrl = process.env.DATABASE_URL;
        
        let connectionConfig;
        
        if (dbUrl) {
            // Parse MySQL URL dari Railway
            // Format: mysql://user:password@host:port/database
            connectionConfig = {
                host: process.env.MYSQLHOST || 'localhost',
                user: process.env.MYSQLUSER || 'root',
                password: process.env.MYSQLPASSWORD || '',
                database: process.env.MYSQLDATABASE || 'railway'
            };
        } else {
            // Local development
            connectionConfig = {
                host: process.env.DB_HOST || 'localhost',
                user: process.env.DB_USER || 'root',
                password: process.env.DB_PASSWORD || '',
                database: process.env.DB_NAME || 'task_bot_db'
            };
        }

        // Koneksi untuk create database
        const connection = await mysql.createConnection({
            host: connectionConfig.host,
            user: connectionConfig.user,
            password: connectionConfig.password,
            ssl: isProduction ? { rejectUnauthorized: false } : false
        });

        // Buat database jika belum ada (untuk development)
        if (!dbUrl) {
            await connection.query(`CREATE DATABASE IF NOT EXISTS ${connectionConfig.database}`);
            console.log('✅ Database ready');
        }

        await connection.end();

        // Buat pool koneksi
        pool = mysql.createPool({
            host: connectionConfig.host,
            user: connectionConfig.user,
            password: connectionConfig.password,
            database: connectionConfig.database,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
            enableKeepAlive: true,
            keepAliveInitialDelay: 0,
            ssl: isProduction ? { rejectUnauthorized: false } : false
        });

        console.log('✅ Database pool created');
        return pool;
    } catch (error) {
        console.error('❌ Database initialization failed:', error.message);
        if (!isProduction) {
            process.exit(1);
        }
    }
}

// Initialize database
initDatabase();

// =====================================================
// MULTER CONFIGURATION - PERBAIKAN
// =====================================================
const storage = multer.memoryStorage();

const upload = multer({
    storage: storage,
    limits: {
        fileSize: (parseInt(process.env.MAX_FILE_SIZE) || 50) * 1024 * 1024, // 50MB default
    },
    fileFilter: function (req, file, cb) {
        console.log('📁 Multer processing file:', {
            fieldname: file.fieldname,
            originalname: file.originalname,
            mimetype: file.mimetype,
            size: file.size
        });
        
        const allowedTypes = [
            'image/jpeg', 'image/png', 'image/gif', 'image/webp',
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'text/plain',
            'application/zip',
            'application/x-rar-compressed',
            'video/mp4', 'video/mpeg',
            'audio/mpeg', 'audio/wav'
        ];
        
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Tipe file tidak diizinkan: ' + file.mimetype), false);
        }
    }
});

// =====================================================
// TEST ENDPOINT - CEK ENV (TANPA AUTH)
// =====================================================
app.get('/api/test-env', (req, res) => {
    res.json({
        cloudinary_cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'TIDAK ADA',
        cloudinary_api_key: process.env.CLOUDINARY_API_KEY ? 'ADA' : 'TIDAK ADA',
        cloudinary_api_secret: process.env.CLOUDINARY_API_SECRET ? 'ADA' : 'TIDAK ADA',
        node_env: process.env.NODE_ENV,
        all_env: Object.keys(process.env).filter(key => key.includes('CLOUDINARY'))
    });
});

// =====================================================
// AUTHENTICATION MIDDLEWARE
// =====================================================

// Verify Token
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ 
            success: false, 
            error: 'Akses ditolak. Token tidak ditemukan.' 
        });
    }
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'taskbot-secret');
        
        const [users] = await pool.query(
            'SELECT id, username, email, full_name, role, telegram_chat_id, telegram_verified FROM users WHERE id = ? AND is_active = 1',
            [decoded.userId]
        );
        
        if (users.length === 0) {
            return res.status(401).json({ 
                success: false, 
                error: 'User tidak ditemukan atau tidak aktif.' 
            });
        }
        
        req.user = users[0];
        next();
    } catch (error) {
        return res.status(403).json({ 
            success: false, 
            error: 'Token tidak valid atau sudah kadaluarsa.' 
        });
    }
};

// Check Admin Role
const isAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ 
            success: false, 
            error: 'Akses ditolak. Hanya untuk administrator.' 
        });
    }
};

// =====================================================
// SOCKET.IO FOR REAL-TIME UPDATES & CHAT
// =====================================================
io.on('connection', (socket) => {
    console.log('🔌 Client connected:', socket.id);
    
    socket.on('join', (userId) => {
        socket.join(`user_${userId}`);
        console.log(`👤 User ${userId} joined personal room`);
    });
    
    socket.on('join_chat_room', (roomId) => {
        socket.join(`chat_${roomId}`);
        console.log(`💬 Joined chat room: ${roomId}`);
    });
    
    socket.on('leave_chat_room', (roomId) => {
        socket.leave(`chat_${roomId}`);
        console.log(`👋 Left chat room: ${roomId}`);
    });
    
    socket.on('typing', (data) => {
        socket.to(`chat_${data.room_id}`).emit('user_typing', {
            user_id: data.user_id,
            username: data.username,
            is_typing: data.is_typing
        });
    });
    
    socket.on('mark_read', async (data) => {
        try {
            // Update last_read_at in database
            await pool.query(
                'UPDATE chat_room_participants SET last_read_at = NOW() WHERE room_id = ? AND user_id = ?',
                [data.room_id, data.user_id]
            );
            
            // Broadcast ke semua participant di room (kecuali pengirim)
            socket.to(`chat_${data.room_id}`).emit('messages_read', {
                room_id: data.room_id,
                user_id: data.user_id,
                read_at: new Date()
            });
            
            // EMIT LANGSUNG KE SEMUA USER DI ROOM UNTUK UPDATE UNREAD COUNT
            io.to(`chat_${data.room_id}`).emit('rooms_need_refresh', {
                reason: 'messages_read',
                room_id: data.room_id,
                user_id: data.user_id
            });
            
        } catch (error) {
            console.error('Mark read error:', error);
        }
    });
    
    socket.on('disconnect', () => {
        console.log('🔌 Client disconnected:', socket.id);
    });
});

// =====================================================
// CLOUDINARY CONFIGURATION CHECK
// =====================================================
app.get('/api/cloudinary/status', authenticateToken, (req, res) => {
    try {
        const config = {
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME ? '✓' : '✗',
            api_key: process.env.CLOUDINARY_API_KEY ? '✓' : '✗',
            api_secret: process.env.CLOUDINARY_API_SECRET ? '✓' : '✗',
            folder: process.env.CLOUDINARY_FOLDER || 'taskbot'
        };
        
        res.json({
            success: true,
            configured: !!process.env.CLOUDINARY_CLOUD_NAME,
            config: config
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// =====================================================
// FILE ACCESS - CLOUDINARY
// =====================================================

// Endpoint untuk mendapatkan file info
app.get('/api/files/:fileId', authenticateToken, async (req, res) => {
    try {
        const fileId = req.params.fileId;
        
        // Cari file di semua tabel
        let fileInfo = null;
        
        // Cek di tasks
        const [tasks] = await pool.query(
            'SELECT cloudinary_url, file_name, file_size, mime_type FROM tasks WHERE id = ?',
            [fileId]
        );
        
        if (tasks.length > 0 && tasks[0].cloudinary_url) {
            fileInfo = tasks[0];
        }
        
        // Cek di test_cases
        if (!fileInfo) {
            const [testCases] = await pool.query(
                'SELECT cloudinary_url, NULL as file_name, NULL as file_size, NULL as mime_type FROM test_cases WHERE id = ?',
                [fileId]
            );
            if (testCases.length > 0 && testCases[0].cloudinary_url) {
                fileInfo = testCases[0];
            }
        }
        
        // Cek di chat_messages
        if (!fileInfo) {
            const [messages] = await pool.query(
                'SELECT cloudinary_url, file_name, file_size, mime_type FROM chat_messages WHERE id = ?',
                [fileId]
            );
            if (messages.length > 0 && messages[0].cloudinary_url) {
                fileInfo = messages[0];
            }
        }
        
        if (!fileInfo || !fileInfo.cloudinary_url) {
            return res.status(404).json({ 
                success: false, 
                error: 'File tidak ditemukan' 
            });
        }
        
        res.json({
            success: true,
            url: fileInfo.cloudinary_url,
            file_name: fileInfo.file_name,
            file_size: fileInfo.file_size,
            mime_type: fileInfo.mime_type
        });
        
    } catch (error) {
        console.error('❌ File info error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Internal server error' 
        });
    }
});

// Endpoint untuk redirect ke Cloudinary
app.get('/api/files/redirect/:fileId', authenticateToken, async (req, res) => {
    try {
        const fileId = req.params.fileId;
        
        // Cari file di semua tabel
        let cloudinaryUrl = null;
        
        // Cek di tasks
        const [tasks] = await pool.query(
            'SELECT cloudinary_url FROM tasks WHERE id = ?',
            [fileId]
        );
        
        if (tasks.length > 0 && tasks[0].cloudinary_url) {
            cloudinaryUrl = tasks[0].cloudinary_url;
        }
        
        // Cek di test_cases
        if (!cloudinaryUrl) {
            const [testCases] = await pool.query(
                'SELECT cloudinary_url FROM test_cases WHERE id = ?',
                [fileId]
            );
            if (testCases.length > 0 && testCases[0].cloudinary_url) {
                cloudinaryUrl = testCases[0].cloudinary_url;
            }
        }
        
        // Cek di chat_messages
        if (!cloudinaryUrl) {
            const [messages] = await pool.query(
                'SELECT cloudinary_url FROM chat_messages WHERE id = ?',
                [fileId]
            );
            if (messages.length > 0 && messages[0].cloudinary_url) {
                cloudinaryUrl = messages[0].cloudinary_url;
            }
        }
        
        if (!cloudinaryUrl) {
            return res.status(404).json({ 
                success: false, 
                error: 'File tidak ditemukan' 
            });
        }
        
        // Redirect ke Cloudinary URL
        res.redirect(cloudinaryUrl);
        
    } catch (error) {
        console.error('❌ File redirect error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Internal server error' 
        });
    }
});

// Tambahkan endpoint test koneksi
app.get('/api/test-connection', async (req, res) => {
    try {
        // Test DNS lookup
        const dns = require('dns');
        await dns.promises.lookup('api.telegram.org');
        
        // Test koneksi ke Telegram
        const response = await axios.get('https://api.telegram.org', {
            timeout: 5000,
            validateStatus: false
        });
        
        res.json({
            success: true,
            dns: 'OK',
            telegram_status: response.status,
            headers: response.headers
        });
    } catch (error) {
        res.json({
            success: false,
            error: error.message,
            code: error.code
        });
    }
});



// =====================================================
// AUTHENTICATION ROUTES
// =====================================================

// REGISTER
app.post('/api/auth/register', [
    body('username').isLength({ min: 3 }).withMessage('Username minimal 3 karakter'),
    body('email').isEmail().withMessage('Email tidak valid'),
    body('password').isLength({ min: 6 }).withMessage('Password minimal 6 karakter'),
    body('full_name').notEmpty().withMessage('Nama lengkap harus diisi')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                success: false, 
                errors: errors.array() 
            });
        }
        
        const { username, email, password, full_name, telegram_chat_id } = req.body;
        
        const [existing] = await pool.query(
            'SELECT id FROM users WHERE username = ? OR email = ?',
            [username, email]
        );
        
        if (existing.length > 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'Username atau email sudah terdaftar.' 
            });
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        const verificationExpires = new Date(Date.now() + 10 * 60000);
        
        const [result] = await pool.query(
            `INSERT INTO users 
            (username, email, password, full_name, telegram_chat_id, verification_code, verification_expires, role) 
            VALUES (?, ?, ?, ?, ?, ?, ?, 'user')`,
            [username, email, hashedPassword, full_name, telegram_chat_id || null, verificationCode, verificationExpires]
        );
        
        if (telegram_chat_id && process.env.TELEGRAM_BOT_TOKEN) {
            await sendTelegramVerification(telegram_chat_id, verificationCode);
        }
        
        res.status(201).json({
            success: true,
            message: 'Registrasi berhasil! Silakan verifikasi akun Anda via Telegram.',
            user_id: result.insertId
        });
        
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Gagal melakukan registrasi.' 
        });
    }
});

// VERIFY TELEGRAM
app.post('/api/auth/verify-telegram', async (req, res) => {
    try {
        const { user_id, verification_code } = req.body;
        
        const [users] = await pool.query(
            `SELECT * FROM users 
            WHERE id = ? AND verification_code = ? AND verification_expires > NOW()`,
            [user_id, verification_code]
        );
        
        if (users.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Kode verifikasi tidak valid atau sudah kadaluarsa.'
            });
        }
        
        await pool.query(
            `UPDATE users 
            SET telegram_verified = TRUE, 
                verification_code = NULL, 
                verification_expires = NULL 
            WHERE id = ?`,
            [user_id]
        );
        
        res.json({
            success: true,
            message: 'Akun berhasil diverifikasi!'
        });
        
    } catch (error) {
        console.error('Verify error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Gagal memverifikasi kode.' 
        });
    }
});

// LOGIN - FIXED dengan pengecekan verifikasi
app.post('/api/auth/login', [
    body('username').notEmpty().withMessage('Username harus diisi'),
    body('password').notEmpty().withMessage('Password harus diisi')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                success: false, 
                errors: errors.array() 
            });
        }
        
        const { username, password } = req.body;
        
        const [users] = await pool.query(
            'SELECT * FROM users WHERE (username = ? OR email = ?) AND is_active = 1',
            [username, username]
        );
        
        if (users.length === 0) {
            return res.status(401).json({
                success: false,
                error: 'Username atau password salah.'
            });
        }
        
        const user = users[0];
        const validPassword = await bcrypt.compare(password, user.password);
        
        if (!validPassword) {
            return res.status(401).json({
                success: false,
                error: 'Username atau password salah.'
            });
        }
        
        // 🔥 CEK VERIFIKASI: Jika user punya telegram_chat_id, WAJIB verifikasi
        if (user.telegram_chat_id && user.telegram_chat_id.trim() !== '' && user.telegram_verified === 0) {
            return res.status(403).json({
                success: false,
                error: 'Akun belum diverifikasi via Telegram. Silakan verifikasi terlebih dahulu.',
                needs_verification: true,
                user_id: user.id
            });
        }
        
        // Update last login
        await pool.query(
            'UPDATE users SET last_login = NOW() WHERE id = ?',
            [user.id]
        );
        
        const token = jwt.sign(
            { 
                userId: user.id, 
                username: user.username,
                role: user.role 
            },
            process.env.JWT_SECRET || 'taskbot-secret',
            { expiresIn: '7d' }
        );
        
        res.json({
            success: true,
            message: 'Login berhasil!',
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                full_name: user.full_name,
                role: user.role,
                telegram_verified: user.telegram_verified === 1,
                telegram_chat_id: user.telegram_chat_id
            }
        });
        
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Gagal melakukan login.' 
        });
    }
});



// =====================================================
// ANNOUNCEMENT SYSTEM API
// =====================================================

// Get active announcements for user
app.get('/api/announcements', authenticateToken, async (req, res) => {
    try {
        const now = new Date();
        
        // Get announcements that are active, within date range, and not dismissed by user
        const [announcements] = await pool.query(`
            SELECT 
                a.*,
                u.username as created_by_username,
                CASE 
                    WHEN ad.id IS NOT NULL THEN true 
                    ELSE false 
                END as is_dismissed
            FROM announcements a
            LEFT JOIN users u ON a.created_by = u.id
            LEFT JOIN announcement_dismissals ad ON a.id = ad.announcement_id AND ad.user_id = ?
            WHERE a.is_active = true 
                AND (a.start_date IS NULL OR a.start_date <= ?)
                AND (a.end_date IS NULL OR a.end_date >= ?)
            ORDER BY a.priority DESC, a.created_at DESC
            LIMIT 5
        `, [req.user.id, now, now]);
        
        res.json({
            success: true,
            announcements
        });
    } catch (error) {
        console.error('Get announcements error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Gagal mengambil announcements' 
        });
    }
});

// Dismiss announcement
app.post('/api/announcements/:id/dismiss', authenticateToken, async (req, res) => {
    try {
        const announcementId = req.params.id;
        
        await pool.query(
            'INSERT IGNORE INTO announcement_dismissals (announcement_id, user_id) VALUES (?, ?)',
            [announcementId, req.user.id]
        );
        
        res.json({ success: true });
    } catch (error) {
        console.error('Dismiss announcement error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Gagal dismiss announcement' 
        });
    }
});

// ADMIN: Get all announcements
app.get('/api/admin/announcements', authenticateToken, isAdmin, async (req, res) => {
    try {
        const [announcements] = await pool.query(`
            SELECT 
                a.*,
                u.username as created_by_username,
                COUNT(ad.id) as dismiss_count
            FROM announcements a
            LEFT JOIN users u ON a.created_by = u.id
            LEFT JOIN announcement_dismissals ad ON a.id = ad.announcement_id
            GROUP BY a.id
            ORDER BY a.created_at DESC
        `);
        
        res.json({
            success: true,
            announcements
        });
    } catch (error) {
        console.error('Get admin announcements error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Gagal mengambil announcements' 
        });
    }
});

// ADMIN: Create/Update announcement
app.post('/api/admin/announcements', authenticateToken, isAdmin, async (req, res) => {
    try {
        const {
            id,
            title,
            content,
            type,
            icon,
            background_color,
            priority,
            start_date,
            end_date,
            is_active
        } = req.body;
        
        if (id) {
            // Update
            await pool.query(`
                UPDATE announcements 
                SET title = ?, content = ?, type = ?, icon = ?, 
                    background_color = ?, priority = ?, start_date = ?, 
                    end_date = ?, is_active = ?, updated_at = NOW()
                WHERE id = ?
            `, [title, content, type, icon, background_color, priority, 
                start_date, end_date, is_active, id]);
        } else {
            // Insert
            await pool.query(`
                INSERT INTO announcements 
                (title, content, type, icon, background_color, priority, start_date, end_date, is_active, created_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [title, content, type, icon, background_color, priority, 
                start_date, end_date, is_active, req.user.id]);
        }
        
        res.json({ success: true });
    } catch (error) {
        console.error('Save announcement error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Gagal menyimpan announcement' 
        });
    }
});

// ADMIN: Delete announcement
app.delete('/api/admin/announcements/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        await pool.query('DELETE FROM announcements WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        console.error('Delete announcement error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Gagal menghapus announcement' 
        });
    }
});



// =====================================================
// TELEGRAM BOT WEBHOOK - UNTUK VERIFIKASI
// =====================================================

// Endpoint untuk webhook Telegram
app.post('/api/telegram/webhook', express.json(), async (req, res) => {
    try {
        const message = req.body.message;
        if (!message) return res.sendStatus(200);
        
        const chatId = message.chat.id;
        const text = message.text || '';
        const username = message.from.username || '';
        
        console.log(`📱 Telegram message from ${chatId}: ${text}`);
        
        // Command /start
        if (text === '/start') {
            await sendTelegramMessage(chatId, 
                '👋 *Selamat datang di TaskBot Pro!*\n\n' +
                'Gunakan perintah berikut:\n' +
                '/verify - Verifikasi akun Anda\n' +
                '/help - Bantuan'
            );
        }
        
        // Command /verify
        else if (text === '/verify') {
            await sendTelegramMessage(chatId, 
                '🔐 *Verifikasi Akun*\n\n' +
                'Silakan masukkan *email* yang Anda gunakan saat registrasi:'
            );
            
            // Simpan state bahwa user sedang dalam proses verifikasi
            await pool.query(
                'INSERT INTO telegram_states (chat_id, step, data) VALUES (?, ?, ?) ' +
                'ON DUPLICATE KEY UPDATE step = VALUES(step), data = VALUES(data), updated_at = NOW()',
                [chatId, 'awaiting_email', JSON.stringify({})]
            );
        }
        
        // Cek apakah user sedang dalam proses verifikasi
        else {
            const [states] = await pool.query(
                'SELECT * FROM telegram_states WHERE chat_id = ? AND step IS NOT NULL',
                [chatId]
            );
            
            if (states.length > 0) {
                const state = states[0];
                
                // Step 1: User mengirim email
                if (state.step === 'awaiting_email') {
                    const email = text.trim();
                    
                    // Cari user berdasarkan email
                    const [users] = await pool.query(
                        'SELECT id, username, full_name, telegram_verified FROM users WHERE email = ?',
                        [email]
                    );
                    
                    if (users.length === 0) {
                        await sendTelegramMessage(chatId, 
                            '❌ Email tidak ditemukan. Silakan coba lagi dengan /verify'
                        );
                        await pool.query('DELETE FROM telegram_states WHERE chat_id = ?', [chatId]);
                        return res.sendStatus(200);
                    }
                    
                    const user = users[0];
                    
                    // Cek apakah sudah diverifikasi
                    if (user.telegram_verified) {
                        await sendTelegramMessage(chatId, 
                            '✅ Akun Anda sudah terverifikasi! Silakan login.'
                        );
                        await pool.query('DELETE FROM telegram_states WHERE chat_id = ?', [chatId]);
                        return res.sendStatus(200);
                    }
                    
                    // Generate kode verifikasi baru
                    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
                    const verificationExpires = new Date(Date.now() + 10 * 60000); // 10 menit
                    
                    // Update user dengan kode verifikasi
                    await pool.query(
                        'UPDATE users SET verification_code = ?, verification_expires = ?, telegram_chat_id = ? WHERE id = ?',
                        [verificationCode, verificationExpires, chatId, user.id]
                    );
                    
                    // Kirim kode ke user
                    await sendTelegramMessage(chatId, 
                        `🔐 *Kode Verifikasi Anda*\n\n` +
                        `Halo *${user.full_name || user.username}*,\n\n` +
                        `Kode verifikasi Anda: *${verificationCode}*\n\n` +
                        `Kode berlaku selama 10 menit.\n\n` +
                        `Silakan masukkan kode ini di aplikasi untuk verifikasi.`
                    );
                    
                    // Update state
                    await pool.query(
                        'UPDATE telegram_states SET step = ?, data = ?, updated_at = NOW() WHERE chat_id = ?',
                        ['awaiting_code', JSON.stringify({ user_id: user.id }), chatId]
                    );
                }
                
                // Step 2: User mengirim kode verifikasi
                else if (state.step === 'awaiting_code') {
                    const code = text.trim();
                    const data = JSON.parse(state.data || '{}');
                    const userId = data.user_id;
                    
                    if (!userId) {
                        await sendTelegramMessage(chatId, '❌ Terjadi kesalahan. Silakan mulai lagi dengan /verify');
                        await pool.query('DELETE FROM telegram_states WHERE chat_id = ?', [chatId]);
                        return res.sendStatus(200);
                    }
                    
                    // Cek kode verifikasi
                    const [users] = await pool.query(
                        'SELECT * FROM users WHERE id = ? AND verification_code = ? AND verification_expires > NOW()',
                        [userId, code]
                    );
                    
                    if (users.length === 0) {
                        await sendTelegramMessage(chatId, 
                            '❌ Kode verifikasi tidak valid atau sudah kadaluarsa. Silakan coba lagi dengan /verify'
                        );
                        await pool.query('DELETE FROM telegram_states WHERE chat_id = ?', [chatId]);
                        return res.sendStatus(200);
                    }
                    
                    // Update user menjadi terverifikasi
                    await pool.query(
                        'UPDATE users SET telegram_verified = 1, verification_code = NULL, verification_expires = NULL WHERE id = ?',
                        [userId]
                    );
                    
                    await sendTelegramMessage(chatId, 
                        '✅ *Verifikasi Berhasil!*\n\n' +
                        'Akun Anda sekarang sudah terverifikasi.\n' +
                        'Silakan login ke aplikasi.'
                    );
                    
                    // Hapus state
                    await pool.query('DELETE FROM telegram_states WHERE chat_id = ?', [chatId]);
                }
            } else {
                // Command /help
                if (text === '/help') {
                    await sendTelegramMessage(chatId,
                        '📚 *Bantuan TaskBot Pro*\n\n' +
                        'Perintah yang tersedia:\n' +
                        '/start - Mulai bot\n' +
                        '/verify - Verifikasi akun\n' +
                        '/help - Tampilkan bantuan ini'
                    );
                } else {
                    // Pesan tidak dikenal
                    await sendTelegramMessage(chatId,
                        '❌ Perintah tidak dikenal. Ketik /help untuk bantuan.'
                    );
                }
            }
        }
        
        res.sendStatus(200);
    } catch (error) {
        console.error('Telegram webhook error:', error);
        res.sendStatus(200);
    }
});

// app.js - Gunakan IP langsung untuk bypass DNS
app.get('/api/telegram/set-webhook', async (req, res) => {
    try {
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        
        if (!botToken) {
            return res.status(400).json({ 
                success: false, 
                error: 'TELEGRAM_BOT_TOKEN tidak ditemukan' 
            });
        }

        const baseUrl = process.env.APP_URL || `https://${req.get('host')}`;
        const webhookUrl = `${baseUrl}/api/telegram/webhook`;
        
        console.log('🔧 Setting webhook to:', webhookUrl);

        // IP Address Telegram yang diketahui
        const TELEGRAM_IPS = [
            '149.154.167.220',  // api.telegram.org IP 1
            '149.154.167.221',  // api.telegram.org IP 2  
            '149.154.175.50',   // api.telegram.org IP 3
            '149.154.175.100',  // api.telegram.org IP 4
            '149.154.167.91',   // api.telegram.org IP 5
            '149.154.171.5'     // api.telegram.org IP 6
        ];

        // Gunakan axios dengan IP langsung dan custom headers
        let attempts = 0;
        const maxAttempts = 3;
        let lastError = null;

        while (attempts < maxAttempts) {
            try {
                attempts++;
                const randomIP = TELEGRAM_IPS[Math.floor(Math.random() * TELEGRAM_IPS.length)];
                
                console.log(`📡 Attempt ${attempts} using IP: ${randomIP}`);
                
                // Hapus webhook lama (via IP)
                await axios({
                    method: 'GET',
                    url: `https://${randomIP}/bot${botToken}/deleteWebhook`,
                    headers: {
                        'Host': 'api.telegram.org'
                    },
                    timeout: 10000
                });
                
                // Set webhook baru (via IP)
                const response = await axios({
                    method: 'POST',
                    url: `https://${randomIP}/bot${botToken}/setWebhook`,
                    headers: {
                        'Host': 'api.telegram.org',
                        'Content-Type': 'application/json'
                    },
                    data: {
                        url: webhookUrl,
                        allowed_updates: ['message'],
                        max_connections: 40,
                        drop_pending_updates: true
                    },
                    timeout: 15000
                });
                
                console.log(`✅ Attempt ${attempts} successful!`);
                
                // Cek webhook info
                const infoResponse = await axios({
                    method: 'GET',
                    url: `https://${randomIP}/bot${botToken}/getWebhookInfo`,
                    headers: {
                        'Host': 'api.telegram.org'
                    },
                    timeout: 5000
                });
                
                return res.json({
                    success: true,
                    message: 'Webhook berhasil di-set',
                    webhook_url: webhookUrl,
                    used_ip: randomIP,
                    set_webhook_response: response.data,
                    webhook_info: infoResponse.data
                });
                
            } catch (error) {
                lastError = error;
                console.error(`❌ Attempt ${attempts} failed:`, error.message);
                
                if (attempts < maxAttempts) {
                    const waitTime = Math.pow(2, attempts) * 1000;
                    console.log(`⏳ Waiting ${waitTime}ms before retry...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                }
            }
        }
        
        throw lastError;
        
    } catch (error) {
        console.error('❌ Final error:', {
            message: error.message,
            code: error.code,
            response: error.response?.data
        });
        
        res.status(500).json({ 
            success: false, 
            error: error.message,
            details: error.response?.data
        });
    }
});

// Endpoint untuk cek status webhook
app.get('/api/telegram/webhook-info', async (req, res) => {
    try {
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        
        if (!botToken) {
            return res.status(400).json({ 
                success: false, 
                error: 'TELEGRAM_BOT_TOKEN tidak ditemukan' 
            });
        }
        
        const response = await axios.get(
            `https://api.telegram.org/bot${botToken}/getWebhookInfo`
        );
        
        res.json({
            success: true,
            data: response.data
        });
    } catch (error) {
        console.error('❌ Get webhook info error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Test endpoint untuk kirim pesan manual
app.post('/api/telegram/test-send', express.json(), async (req, res) => {
    try {
        const { chatId, text } = req.body;
        
        const result = await sendTelegramMessage(chatId, text);
        
        res.json({
            success: true,
            result
        });
    } catch (error) {
        console.error('Test send error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET CURRENT USER
app.get('/api/auth/me', authenticateToken, async (req, res) => {
    res.json({
        success: true,
        user: req.user
    });
});

// LOGOUT
app.post('/api/auth/logout', authenticateToken, (req, res) => {
    res.json({
        success: true,
        message: 'Logout berhasil!'
    });
});

// =====================================================
// FILE ACCESS ENDPOINT - DENGAN AUTHENTIKASI (UNTUK DOWNLOAD)
// =====================================================
app.get('/api/files/:filename', authenticateToken, async (req, res) => {
    try {
        const filename = req.params.filename;
        let filePath = null;
        const subfolders = ['images', 'documents', 'screenshots', 'videos'];
        
        // Cari file di semua subfolder
        for (const subfolder of subfolders) {
            const potentialPath = path.join(__dirname, 'uploads', subfolder, filename);
            if (fs.existsSync(potentialPath)) {
                filePath = potentialPath;
                break;
            }
        }
        
        if (!filePath) {
            return res.status(404).json({ 
                success: false, 
                error: 'File tidak ditemukan' 
            });
        }

        // Baca file stats
        const stat = fs.statSync(filePath);
        const ext = path.extname(filePath).toLowerCase();
        
        // Set content type berdasarkan ekstensi
        const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
        const videoExts = ['.mp4', '.avi', '.mov', '.wmv'];
        
        if (imageExts.includes(ext)) {
            res.setHeader('Content-Type', `image/${ext.slice(1)}`);
            res.setHeader('Content-Disposition', `inline; filename="${path.basename(filePath)}"`);
        } else if (videoExts.includes(ext)) {
            res.setHeader('Content-Type', `video/${ext.slice(1)}`);
            res.setHeader('Content-Disposition', `inline; filename="${path.basename(filePath)}"`);
        } else if (ext === '.pdf') {
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `inline; filename="${path.basename(filePath)}"`);
        } else {
            res.setHeader('Content-Type', 'application/octet-stream');
            res.setHeader('Content-Disposition', `attachment; filename="${path.basename(filePath)}"`);
        }
        
        res.setHeader('Content-Length', stat.size);
        res.setHeader('Cache-Control', 'public, max-age=31536000');
        
        // Kirim file
        res.sendFile(filePath);
        
    } catch (error) {
        console.error('❌ File access error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Internal server error',
            message: error.message 
        });
    }
});

// =====================================================
// TASK MANAGEMENT
// =====================================================

// GET TASKS
app.get('/api/tasks', authenticateToken, async (req, res) => {
    try {
        let query;
        let params = [];
        
        if (req.user.role === 'admin') {
            query = `
                SELECT t.*, 
                       assignee.username as assignee_username,
                       assignee.full_name as assignee_name,
                       creator.username as creator_username,
                       approver.username as approver_username,
                       DATE_FORMAT(t.created_at, '%Y-%m-%d %H:%i:%s') as created_at_formatted,
                       DATE_FORMAT(t.completed_at, '%Y-%m-%d %H:%i:%s') as completed_at_formatted,
                       DATE_FORMAT(t.approved_at, '%Y-%m-%d %H:%i:%s') as approved_at_formatted
                FROM tasks t
                LEFT JOIN users assignee ON t.assignee_id = assignee.id
                LEFT JOIN users creator ON t.created_by = creator.id
                LEFT JOIN users approver ON t.approved_by = approver.id
                ORDER BY t.created_at DESC
            `;
        } else {
            query = `
                SELECT t.*, 
                       creator.username as creator_username,
                       DATE_FORMAT(t.created_at, '%Y-%m-%d %H:%i:%s') as created_at_formatted,
                       DATE_FORMAT(t.completed_at, '%Y-%m-%d %H:%i:%s') as completed_at_formatted,
                       DATE_FORMAT(t.approved_at, '%Y-%m-%d %H:%i:%s') as approved_at_formatted
                FROM tasks t
                LEFT JOIN users creator ON t.created_by = creator.id
                WHERE t.assignee_id = ?
                ORDER BY t.created_at DESC
            `;
            params = [req.user.id];
        }
        
        const [rows] = await pool.query(query, params);
        
        // Gunakan URL Cloudinary
        rows.forEach(row => {
            if (row.cloudinary_url) {
                row.file_url = row.cloudinary_url;
                row.file_name = row.file_name || path.basename(row.cloudinary_url);
                row.file_size = row.file_size;
            }
        });
        
        res.json(rows);
        
    } catch (error) {
        console.error('❌ Get tasks error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Internal server error',
            message: error.message 
        });
    }
});

// FORGOT PASSWORD
app.post('/api/auth/forgot-password', [
    body('email').isEmail().withMessage('Email tidak valid')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                success: false, 
                errors: errors.array() 
            });
        }
        
        const { email } = req.body;
        
        // Cek apakah email terdaftar
        const [users] = await pool.query(
            'SELECT id, username, full_name FROM users WHERE email = ?',
            [email]
        );
        
        if (users.length === 0) {
            // Untuk keamanan, tetap berikan respons sukses meskipun email tidak ditemukan
            return res.json({
                success: true,
                message: 'Jika email terdaftar, instruksi reset password akan dikirim.'
            });
        }
        
        const user = users[0];
        
        // Generate reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 jam
        
        // Simpan token ke database
        await pool.query(
            'UPDATE users SET reset_token = ?, reset_expires = ? WHERE id = ?',
            [resetToken, resetExpires, user.id]
        );
        
        // Kirim email reset password (implementasi sesuai kebutuhan)
        // await sendResetPasswordEmail(user.email, resetToken);
        
        console.log(`🔐 Reset password untuk ${user.username}: ${resetToken}`);
        
        res.json({
            success: true,
            message: 'Instruksi reset password telah dikirim ke email Anda.'
        });
        
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Gagal memproses permintaan.' 
        });
    }
});

// RESET PASSWORD
app.post('/api/auth/reset-password', [
    body('token').notEmpty().withMessage('Token diperlukan'),
    body('new_password').isLength({ min: 6 }).withMessage('Password minimal 6 karakter')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                success: false, 
                errors: errors.array() 
            });
        }
        
        const { token, new_password } = req.body;
        
        // Cek token
        const [users] = await pool.query(
            'SELECT id FROM users WHERE reset_token = ? AND reset_expires > NOW()',
            [token]
        );
        
        if (users.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Token tidak valid atau sudah kadaluarsa.'
            });
        }
        
        const user = users[0];
        const hashedPassword = await bcrypt.hash(new_password, 10);
        
        // Update password dan hapus token
        await pool.query(
            'UPDATE users SET password = ?, reset_token = NULL, reset_expires = NULL WHERE id = ?',
            [hashedPassword, user.id]
        );
        
        res.json({
            success: true,
            message: 'Password berhasil direset. Silakan login.'
        });
        
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Gagal mereset password.' 
        });
    }
});

// CREATE TASK - DENGAN CLOUDINARY
app.post('/api/tasks', authenticateToken, isAdmin, upload.single('file'), async (req, res) => {
    let cloudinaryResult = null;
    try {
        const { title, description, assignee_id } = req.body;
        
        if (!title || !description || !assignee_id) {
            return res.status(400).json({ 
                success: false,
                error: 'Semua field wajib diisi'
            });
        }
        
        // Upload ke Cloudinary jika ada file
        let cloudinaryUrl = null;
        let cloudinaryPublicId = null;
        let fileInfo = null;
        
        if (req.file) {
            try {
                // Upload buffer ke Cloudinary
                const result = await new Promise((resolve, reject) => {
                    const uploadStream = cloudinary.uploader.upload_stream(
                        {
                            folder: `${process.env.CLOUDINARY_FOLDER || 'taskbot'}/tasks`,
                            resource_type: 'auto',
                            public_id: `task-${Date.now()}-${Math.round(Math.random() * 1E9)}`
                        },
                        (error, result) => {
                            if (error) reject(error);
                            else resolve(result);
                        }
                    );
                    
                    uploadStream.end(req.file.buffer);
                });
                
                cloudinaryUrl = result.secure_url;
                cloudinaryPublicId = result.public_id;
                fileInfo = {
                    file_name: req.file.originalname,
                    file_size: req.file.size,
                    mime_type: req.file.mimetype
                };
                
                console.log('✅ File uploaded to Cloudinary:', cloudinaryUrl);
            } catch (uploadError) {
                console.error('❌ Cloudinary upload error:', uploadError);
                return res.status(500).json({ 
                    success: false,
                    error: 'Gagal mengupload file ke Cloudinary'
                });
            }
        }
        
        const [assignee] = await pool.query(
            'SELECT telegram_chat_id FROM users WHERE id = ?',
            [assignee_id]
        );
        
        const [result] = await pool.query(
            `INSERT INTO tasks 
            (title, description, assignee_id, created_by, file_path, cloudinary_url, cloudinary_public_id, file_name, file_size, mime_type, telegram_chat_id, status, approval_status) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'pending')`,
            [
                title, 
                description, 
                assignee_id, 
                req.user.id, 
                cloudinaryUrl, // Simpan URL Cloudinary di file_path (untuk backward compatibility)
                cloudinaryUrl,
                cloudinaryPublicId,
                fileInfo?.file_name || null,
                fileInfo?.file_size || null,
                fileInfo?.mime_type || null,
                assignee[0]?.telegram_chat_id || null
            ]
        );
        
        // Log activity
        await logActivity(req.user.id, 'CREATE_TASK', 'task', result.insertId, {
            title: title,
            assignee_id: assignee_id
        });
        
        const [newTask] = await pool.query('SELECT * FROM tasks WHERE id = ?', [result.insertId]);
        
        if (assignee[0]?.telegram_chat_id && process.env.TELEGRAM_BOT_TOKEN) {
            sendTaskNotification(newTask[0], assignee[0].telegram_chat_id);
        }
        
        broadcastUpdate('task_created', newTask[0], assignee_id);
        
        res.status(201).json({
            success: true,
            message: 'Task berhasil dibuat',
            task: {
                ...newTask[0],
                file_url: cloudinaryUrl
            }
        });
        
    } catch (error) {
        console.error('Create task error:', error);
        
        // Hapus dari Cloudinary jika gagal
        if (cloudinaryResult?.public_id) {
            await deleteFromCloudinary(cloudinaryResult.public_id);
        }
        
        res.status(500).json({ 
            success: false,
            error: 'Internal server error'
        });
    }
});

// UPDATE TASK STATUS
app.put('/api/tasks/:id/status', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        
        const [tasks] = await pool.query(
            'SELECT t.*, assignee.telegram_chat_id, assignee.username FROM tasks t LEFT JOIN users assignee ON t.assignee_id = assignee.id WHERE t.id = ?',
            [id]
        );
        
        if (tasks.length === 0) {
            return res.status(404).json({ 
                success: false, 
                error: 'Task tidak ditemukan' 
            });
        }
        
        const task = tasks[0];
        
        if (req.user.role !== 'admin' && task.assignee_id !== req.user.id) {
            return res.status(403).json({ 
                success: false, 
                error: 'Anda tidak memiliki akses ke task ini' 
            });
        }
        
        let approvalStatus = task.approval_status;
        if (status === 'completed' && task.status !== 'completed') {
            approvalStatus = 'pending';
        }
        
        await pool.query(
            `UPDATE tasks 
             SET status = ?, 
                 approval_status = ?,
                 completed_at = CASE WHEN ? = 'completed' THEN NOW() ELSE completed_at END
             WHERE id = ?`,
            [status, approvalStatus, status, id]
        );
        
        // Log activity
        await logActivity(req.user.id, 'UPDATE_TASK_STATUS', 'task', id, {
            old_status: task.status,
            new_status: status
        });
        
        if (status === 'completed' && req.user.role !== 'admin') {
            const [admins] = await pool.query('SELECT telegram_chat_id FROM users WHERE role = "admin" AND telegram_chat_id IS NOT NULL');
            
            admins.forEach(admin => {
                if (admin.telegram_chat_id) {
                    sendApprovalRequest(task, admin.telegram_chat_id, req.user);
                }
            });
        }
        
        broadcastUpdate('task_updated', { id, status, approvalStatus }, task.assignee_id);
        
        res.json({
            success: true,
            message: 'Status berhasil diupdate',
            status,
            approval_status: approvalStatus
        });
        
    } catch (error) {
        console.error('Update status error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Internal server error' 
        });
    }
});

// APPROVE TASK
app.post('/api/tasks/:id/approve', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        const [tasks] = await pool.query(
            'SELECT t.*, assignee.telegram_chat_id FROM tasks t LEFT JOIN users assignee ON t.assignee_id = assignee.id WHERE t.id = ?',
            [id]
        );
        
        if (tasks.length === 0) {
            return res.status(404).json({ 
                success: false, 
                error: 'Task tidak ditemukan' 
            });
        }
        
        const task = tasks[0];
        
        await pool.query(
            `UPDATE tasks 
             SET approval_status = 'approved', 
                 status = 'approved',
                 approved_by = ?,
                 approved_at = NOW()
             WHERE id = ?`,
            [req.user.id, id]
        );
        
        // Log activity
        await logActivity(req.user.id, 'APPROVE_TASK', 'task', id, {
            task_title: task.title
        });
        
        if (task.telegram_chat_id && process.env.TELEGRAM_BOT_TOKEN) {
            sendApprovalNotification(task, task.telegram_chat_id, 'approved');
        }
        
        broadcastUpdate('task_approved', { id, approved_by: req.user.id }, task.assignee_id);
        
        res.json({
            success: true,
            message: 'Task berhasil di-approve'
        });
        
    } catch (error) {
        console.error('Approve task error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Internal server error' 
        });
    }
});

// REJECT TASK
app.post('/api/tasks/:id/reject', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        
        const [tasks] = await pool.query(
            'SELECT t.*, assignee.telegram_chat_id FROM tasks t LEFT JOIN users assignee ON t.assignee_id = assignee.id WHERE t.id = ?',
            [id]
        );
        
        if (tasks.length === 0) {
            return res.status(404).json({ 
                success: false, 
                error: 'Task tidak ditemukan' 
            });
        }
        
        const task = tasks[0];
        
        await pool.query(
            `UPDATE tasks 
             SET approval_status = 'rejected', 
                 status = 'rejected',
                 approved_by = ?,
                 approved_at = NOW()
             WHERE id = ?`,
            [req.user.id, id]
        );
        
        // Log activity
        await logActivity(req.user.id, 'REJECT_TASK', 'task', id, {
            task_title: task.title,
            reason: reason
        });
        
        if (task.telegram_chat_id && process.env.TELEGRAM_BOT_TOKEN) {
            sendRejectionNotification(task, task.telegram_chat_id, reason);
        }
        
        broadcastUpdate('task_rejected', { id, reason }, task.assignee_id);
        
        res.json({
            success: true,
            message: 'Task ditolak'
        });
        
    } catch (error) {
        console.error('Reject task error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Internal server error' 
        });
    }
});

// DELETE TASK - DENGAN CLOUDINARY
app.delete('/api/tasks/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        const [task] = await pool.query(
            'SELECT cloudinary_public_id FROM tasks WHERE id = ?', 
            [id]
        );
        
        // Hapus dari Cloudinary jika ada
        if (task[0]?.cloudinary_public_id) {
            await deleteFromCloudinary(task[0].cloudinary_public_id);
        }
        
        await pool.query('DELETE FROM tasks WHERE id = ?', [id]);
        
        res.json({
            success: true,
            message: 'Task berhasil dihapus'
        });
        
    } catch (error) {
        console.error('Delete task error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Internal server error' 
        });
    }
});

// =====================================================
// GROUP MANAGEMENT ROUTES
// =====================================================

// Create new group
app.post('/api/groups', authenticateToken, upload.single('avatar'), async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const { name, description } = req.body;
        const createdBy = req.user.id;

        if (!name || name.trim().length < 3) {
            return res.status(400).json({ 
                success: false, 
                error: 'Nama group minimal 3 karakter' 
            });
        }

        let avatarUrl = null;
        let avatarPublicId = null;

        // Upload avatar ke Cloudinary jika ada
        if (req.file) {
            try {
                const result = await new Promise((resolve, reject) => {
                    const uploadStream = cloudinary.uploader.upload_stream(
                        {
                            folder: `${process.env.CLOUDINARY_FOLDER || 'taskbot'}/groups`,
                            resource_type: 'image',
                            public_id: `group-${Date.now()}`,
                            transformation: [
                                { width: 400, height: 400, crop: 'limit' },
                                { quality: 'auto' }
                            ]
                        },
                        (error, result) => {
                            if (error) reject(error);
                            else resolve(result);
                        }
                    );
                    uploadStream.end(req.file.buffer);
                });

                avatarUrl = result.secure_url;
                avatarPublicId = result.public_id;
            } catch (uploadError) {
                console.error('Avatar upload error:', uploadError);
            }
        }

        // Insert group - PASTIKAN PAKAI BACKTICKS
        const [groupResult] = await connection.query(
            'INSERT INTO `groups` (name, description, avatar_url, avatar_public_id, created_by) VALUES (?, ?, ?, ?, ?)',
            [name.trim(), description || null, avatarUrl, avatarPublicId, createdBy]
        );

        const groupId = groupResult.insertId;

        // Add creator as admin
        await connection.query(
            'INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, "admin")',
            [groupId, createdBy]
        );

        // Create chat room for group
        const [roomResult] = await connection.query(
            'INSERT INTO chat_rooms (room_name, room_type, group_id, created_by) VALUES (?, "group", ?, ?)',
            [name, groupId, createdBy]
        );

        const roomId = roomResult.insertId;

        // Add creator to chat room
        await connection.query(
            'INSERT INTO chat_room_participants (room_id, user_id) VALUES (?, ?)',
            [roomId, createdBy]
        );

        await connection.commit();

        // Log activity
        await logActivity(req.user.id, 'CREATE_GROUP', 'group', groupId, {
            group_name: name
        });

        res.status(201).json({
            success: true,
            message: 'Group berhasil dibuat',
            group: {
                id: groupId,
                name,
                description,
                avatar_url: avatarUrl,
                room_id: roomId
            }
        });

    } catch (error) {
        await connection.rollback();
        console.error('Create group error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Gagal membuat group' 
        });
    } finally {
        connection.release();
    }
});

// Get user's groups
app.get('/api/groups', authenticateToken, async (req, res) => {
    try {
        const [groups] = await pool.query(
            `SELECT 
                g.*,
                u.username as creator_username,
                u.full_name as creator_name,
                COUNT(DISTINCT gm.user_id) as member_count,
                (SELECT COUNT(*) FROM group_invitations WHERE group_id = g.id AND status = "pending") as pending_invites,
                cr.id as chat_room_id
             FROM \`groups\` g
             JOIN group_members gm ON g.id = gm.group_id
             JOIN users u ON g.created_by = u.id
             LEFT JOIN chat_rooms cr ON cr.group_id = g.id
             WHERE gm.user_id = ? AND gm.is_active = TRUE AND g.is_active = TRUE
             GROUP BY g.id, u.username, u.full_name, cr.id
             ORDER BY g.created_at DESC`,
            [req.user.id]
        );

        res.json({ success: true, groups });
    } catch (error) {
        console.error('Get groups error:', error);
        res.status(500).json({ success: false, error: 'Gagal mengambil daftar group' });
    }
});

// Get group details
app.get('/api/groups/:groupId', authenticateToken, async (req, res) => {
    try {
        const groupId = req.params.groupId;

        // Check if user is member
        const [membership] = await pool.query(
            'SELECT * FROM group_members WHERE group_id = ? AND user_id = ? AND is_active = TRUE',
            [groupId, req.user.id]
        );

        if (membership.length === 0 && req.user.role !== 'admin') {
            return res.status(403).json({ 
                success: false, 
                error: 'Anda bukan anggota group ini' 
            });
        }

        // Get group info
        const [groups] = await pool.query(
            `SELECT 
                g.*,
                u.username as creator_username,
                u.full_name as creator_name,
                cr.id as chat_room_id
             FROM \`groups\` g
             LEFT JOIN users u ON g.created_by = u.id
             LEFT JOIN chat_rooms cr ON cr.group_id = g.id
             WHERE g.id = ?`,
            [groupId]
        );

        if (groups.length === 0) {
            return res.status(404).json({ 
                success: false, 
                error: 'Group tidak ditemukan' 
            });
        }

        const group = groups[0];

        // Get members
        const [members] = await pool.query(
            `SELECT 
                u.id, 
                u.username, 
                u.full_name, 
                u.email,
                gm.role, 
                gm.joined_at,
                pp.cloudinary_url as profile_picture
             FROM group_members gm
             INNER JOIN users u ON gm.user_id = u.id
             LEFT JOIN profile_pictures pp ON u.id = pp.user_id
             WHERE gm.group_id = ? AND gm.is_active = TRUE
             ORDER BY gm.role = 'admin' DESC, gm.joined_at ASC`,
            [groupId]
        );

        // Get pending invitations (only for admins)
        let invitations = [];
        if (membership.length > 0 && (membership[0].role === 'admin' || req.user.role === 'admin')) {
            const [invites] = await pool.query(
                `SELECT 
                    gi.*,
                    u.username, 
                    u.full_name,
                    inviter.username as inviter_username
                 FROM group_invitations gi
                 INNER JOIN users u ON gi.invitee_id = u.id
                 INNER JOIN users inviter ON gi.inviter_id = inviter.id
                 WHERE gi.group_id = ? AND gi.status = 'pending'`,
                [groupId]
            );
            invitations = invites;
        }

        res.json({
            success: true,
            group,
            members,
            invitations
        });

    } catch (error) {
        console.error('Get group details error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Gagal mengambil detail group',
            message: error.message 
        });
    }
});

// Update group
app.put('/api/groups/:groupId', authenticateToken, upload.single('avatar'), async (req, res) => {
    try {
        const groupId = req.params.groupId;
        const { name, description } = req.body;

        // Check if user is admin of group
        const [membership] = await pool.query(
            'SELECT * FROM group_members WHERE group_id = ? AND user_id = ? AND role = "admin" AND is_active = TRUE',
            [groupId, req.user.id]
        );

        if (membership.length === 0 && req.user.role !== 'admin') {
            return res.status(403).json({ 
                success: false, 
                error: 'Hanya admin group yang dapat mengupdate group' 
            });
        }

        const updates = [];
        const values = [];

        if (name) {
            updates.push('name = ?');
            values.push(name.trim());
        }

        if (description !== undefined) {
            updates.push('description = ?');
            values.push(description || null);
        }

        // Handle avatar update
        if (req.file) {
            // Get old avatar to delete
            const [oldGroup] = await pool.query(
                'SELECT avatar_public_id FROM `groups` WHERE id = ?',
                [groupId]
            );

            if (oldGroup[0]?.avatar_public_id) {
                await deleteFromCloudinary(oldGroup[0].avatar_public_id);
            }

            const result = await new Promise((resolve, reject) => {
                const uploadStream = cloudinary.uploader.upload_stream(
                    {
                        folder: `${process.env.CLOUDINARY_FOLDER || 'taskbot'}/groups`,
                        resource_type: 'image',
                        public_id: `group-${groupId}-${Date.now()}`,
                        transformation: [
                            { width: 400, height: 400, crop: 'limit' },
                            { quality: 'auto' }
                        ]
                    },
                    (error, result) => {
                        if (error) reject(error);
                        else resolve(result);
                    }
                );
                uploadStream.end(req.file.buffer);
            });

            updates.push('avatar_url = ?, avatar_public_id = ?');
            values.push(result.secure_url, result.public_id);
        }

        if (updates.length > 0) {
            values.push(groupId);
            await pool.query(
                'UPDATE `groups` SET ' + updates.join(', ') + ' WHERE id = ?',
                values
            );

            // Update chat room name if name changed
            if (name) {
                await pool.query(
                    'UPDATE chat_rooms SET room_name = ? WHERE group_id = ?',
                    [name.trim(), groupId]
                );
            }
        }

        res.json({ success: true, message: 'Group berhasil diupdate' });

    } catch (error) {
        console.error('Update group error:', error);
        res.status(500).json({ success: false, error: 'Gagal mengupdate group' });
    }
});

// Delete group (soft delete)
app.delete('/api/groups/:groupId', authenticateToken, async (req, res) => {
    try {
        const groupId = req.params.groupId;

        // Check if user is admin of group
        const [membership] = await pool.query(
            'SELECT * FROM group_members WHERE group_id = ? AND user_id = ? AND role = "admin" AND is_active = TRUE',
            [groupId, req.user.id]
        );

        if (membership.length === 0 && req.user.role !== 'admin') {
            return res.status(403).json({ 
                success: false, 
                error: 'Hanya admin yang dapat menghapus group' 
            });
        }

        // Soft delete group
        await pool.query(
            'UPDATE `groups` SET is_active = FALSE WHERE id = ?',
            [groupId]
        );

        // Soft delete group members
        await pool.query(
            'UPDATE group_members SET is_active = FALSE WHERE group_id = ?',
            [groupId]
        );

        res.json({ success: true, message: 'Group berhasil dihapus' });

    } catch (error) {
        console.error('Delete group error:', error);
        res.status(500).json({ success: false, error: 'Gagal menghapus group' });
    }
});

// Add members to group
app.post('/api/groups/:groupId/members', authenticateToken, async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const groupId = req.params.groupId;
        const { userIds } = req.body;

        if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'Pilih user yang akan ditambahkan' 
            });
        }

        console.log('Checking admin status for user:', req.user.id, 'group:', groupId);
        
        const [membership] = await connection.query(
            'SELECT * FROM group_members WHERE group_id = ? AND user_id = ? AND is_active = TRUE',
            [groupId, req.user.id]
        );

        console.log('Membership found:', membership);

        const isAdmin = membership.length > 0 && membership[0].role === 'admin';
        const isSuperAdmin = req.user.role === 'admin';

        console.log('Is admin:', isAdmin, 'Is super admin:', isSuperAdmin);

        if (!isAdmin && !isSuperAdmin) {
            await connection.rollback();
            return res.status(403).json({ 
                success: false, 
                error: 'Hanya admin group yang dapat menambah anggota' 
            });
        }

        // Get group info
        const [groups] = await connection.query(
            'SELECT name, id FROM `groups` WHERE id = ?',
            [groupId]
        );

        if (groups.length === 0) {
            await connection.rollback();
            return res.status(404).json({ success: false, error: 'Group tidak ditemukan' });
        }

        const group = groups[0];
        const addedUsers = [];

        // Dapatkan chat room ID
        const [rooms] = await connection.query(
            'SELECT id FROM chat_rooms WHERE group_id = ?',
            [groupId]
        );
        const chatRoomId = rooms.length > 0 ? rooms[0].id : null;

        for (const userId of userIds) {
            // Check if already member
            const [existing] = await connection.query(
                'SELECT * FROM group_members WHERE group_id = ? AND user_id = ?',
                [groupId, userId]
            );

            if (existing.length > 0) {
                if (!existing[0].is_active) {
                    // Reactivate if previously left
                    await connection.query(
                        'UPDATE group_members SET is_active = TRUE, left_at = NULL, joined_at = NOW() WHERE id = ?',
                        [existing[0].id]
                    );
                    addedUsers.push(userId);
                }
                continue;
            }

            // Add new member
            await connection.query(
                'INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, "member")',
                [groupId, userId]
            );

            // Add to chat room
            if (chatRoomId) {
                await connection.query(
                    'INSERT IGNORE INTO chat_room_participants (room_id, user_id) VALUES (?, ?)',
                    [chatRoomId, userId]
                );
            }

            addedUsers.push(userId);
        }

        await connection.commit();

        // Notify added users via socket
        addedUsers.forEach(userId => {
            io.to(`user_${userId}`).emit('added_to_group', {
                group_id: parseInt(groupId),
                group_name: group.name,
                added_by: req.user.id,
                added_by_name: req.user.full_name || req.user.username
            });
        });

        res.json({ 
            success: true, 
            message: `${addedUsers.length} anggota berhasil ditambahkan`,
            added_count: addedUsers.length
        });

    } catch (error) {
        await connection.rollback();
        console.error('Add members error:', error);
        res.status(500).json({ success: false, error: 'Gagal menambah anggota' });
    } finally {
        connection.release();
    }
});

// Remove member from group
app.delete('/api/groups/:groupId/members/:userId', authenticateToken, async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const groupId = req.params.groupId;
        const userId = req.params.userId;

        // Check if user is admin of group
        const [membership] = await connection.query(
            'SELECT * FROM group_members WHERE group_id = ? AND user_id = ? AND role = "admin" AND is_active = TRUE',
            [groupId, req.user.id]
        );

        const isAdmin = membership.length > 0 || req.user.role === 'admin';

        // Allow self-remove or admin remove
        if (userId != req.user.id && !isAdmin) {
            await connection.rollback();
            return res.status(403).json({ 
                success: false, 
                error: 'Anda tidak memiliki izin untuk menghapus anggota' 
            });
        }

        // Check if removing last admin
        if (userId != req.user.id) {
            const [admins] = await connection.query(
                'SELECT COUNT(*) as count FROM group_members WHERE group_id = ? AND role = "admin" AND is_active = TRUE',
                [groupId]
            );

            const [targetMember] = await connection.query(
                'SELECT role FROM group_members WHERE group_id = ? AND user_id = ? AND is_active = TRUE',
                [groupId, userId]
            );

            if (admins[0].count <= 1 && targetMember[0]?.role === 'admin') {
                await connection.rollback();
                return res.status(400).json({ 
                    success: false, 
                    error: 'Tidak dapat menghapus admin terakhir' 
                });
            }
        }

        // Remove from group
        await connection.query(
            'UPDATE group_members SET is_active = FALSE, left_at = NOW() WHERE group_id = ? AND user_id = ?',
            [groupId, userId]
        );

        // Remove from chat room
        const [rooms] = await connection.query(
            'SELECT id FROM chat_rooms WHERE group_id = ?',
            [groupId]
        );

        if (rooms.length > 0) {
            await connection.query(
                'DELETE FROM chat_room_participants WHERE room_id = ? AND user_id = ?',
                [rooms[0].id, userId]
            );
        }

        await connection.commit();

        // Notify removed user
        if (userId != req.user.id) {
            io.to(`user_${userId}`).emit('removed_from_group', {
                group_id: parseInt(groupId),
                removed_by: req.user.id,
                removed_by_name: req.user.full_name || req.user.username
            });
        }

        res.json({ success: true, message: 'Anggota berhasil dihapus' });

    } catch (error) {
        await connection.rollback();
        console.error('Remove member error:', error);
        res.status(500).json({ success: false, error: 'Gagal menghapus anggota' });
    } finally {
        connection.release();
    }
});

// Leave group
app.post('/api/groups/:groupId/leave', authenticateToken, async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const groupId = req.params.groupId;

        // Check if last admin
        const [admins] = await connection.query(
            'SELECT COUNT(*) as count FROM group_members WHERE group_id = ? AND role = "admin" AND is_active = TRUE',
            [groupId]
        );

        const [currentUser] = await connection.query(
            'SELECT role FROM group_members WHERE group_id = ? AND user_id = ? AND is_active = TRUE',
            [groupId, req.user.id]
        );

        if (admins[0].count <= 1 && currentUser[0]?.role === 'admin') {
            await connection.rollback();
            return res.status(400).json({ 
                success: false, 
                error: 'Anda adalah admin terakhir. Transfer admin ke anggota lain sebelum keluar.' 
            });
        }

        // Leave group
        await connection.query(
            'UPDATE group_members SET is_active = FALSE, left_at = NOW() WHERE group_id = ? AND user_id = ?',
            [groupId, req.user.id]
        );

        // Remove from chat room
        const [rooms] = await connection.query(
            'SELECT id FROM chat_rooms WHERE group_id = ?',
            [groupId]
        );

        if (rooms.length > 0) {
            await connection.query(
                'DELETE FROM chat_room_participants WHERE room_id = ? AND user_id = ?',
                [rooms[0].id, req.user.id]
            );
        }

        await connection.commit();

        res.json({ success: true, message: 'Anda keluar dari group' });

    } catch (error) {
        await connection.rollback();
        console.error('Leave group error:', error);
        res.status(500).json({ success: false, error: 'Gagal keluar dari group' });
    } finally {
        connection.release();
    }
});

// Transfer admin role
app.post('/api/groups/:groupId/transfer-admin/:userId', authenticateToken, async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const groupId = req.params.groupId;
        const newAdminId = req.params.userId;

        // Check if current user is admin
        const [membership] = await connection.query(
            'SELECT * FROM group_members WHERE group_id = ? AND user_id = ? AND role = "admin" AND is_active = TRUE',
            [groupId, req.user.id]
        );

        if (membership.length === 0) {
            await connection.rollback();
            return res.status(403).json({ 
                success: false, 
                error: 'Hanya admin yang dapat mentransfer admin' 
            });
        }

        // Check if target user is member
        const [targetMember] = await connection.query(
            'SELECT * FROM group_members WHERE group_id = ? AND user_id = ? AND is_active = TRUE',
            [groupId, newAdminId]
        );

        if (targetMember.length === 0) {
            await connection.rollback();
            return res.status(404).json({ 
                success: false, 
                error: 'User bukan anggota group' 
            });
        }

        // Demote current user
        await connection.query(
            'UPDATE group_members SET role = "member" WHERE group_id = ? AND user_id = ?',
            [groupId, req.user.id]
        );

        // Promote new admin
        await connection.query(
            'UPDATE group_members SET role = "admin" WHERE group_id = ? AND user_id = ?',
            [groupId, newAdminId]
        );

        await connection.commit();

        // Notify new admin
        io.to(`user_${newAdminId}`).emit('became_admin', {
            group_id: parseInt(groupId),
            transferred_by: req.user.id,
            transferred_by_name: req.user.full_name || req.user.username
        });

        res.json({ success: true, message: 'Admin berhasil ditransfer' });

    } catch (error) {
        await connection.rollback();
        console.error('Transfer admin error:', error);
        res.status(500).json({ success: false, error: 'Gagal mentransfer admin' });
    } finally {
        connection.release();
    }
});

// Invite members to group (bukan langsung add)
app.post('/api/groups/:groupId/invite', authenticateToken, async (req, res) => {
    try {
        const groupId = req.params.groupId;
        const { userIds } = req.body;

        if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'Pilih user yang akan diundang' 
            });
        }

        // Check if user is admin of group
        const [membership] = await pool.query(
            'SELECT * FROM group_members WHERE group_id = ? AND user_id = ? AND role = "admin" AND is_active = TRUE',
            [groupId, req.user.id]
        );

        if (membership.length === 0 && req.user.role !== 'admin') {
            return res.status(403).json({ 
                success: false, 
                error: 'Hanya admin yang dapat mengundang anggota' 
            });
        }

        // Get group info
        const [groups] = await pool.query('SELECT name, id FROM `groups` WHERE id = ?', [groupId]);
        if (groups.length === 0) {
            return res.status(404).json({ success: false, error: 'Group tidak ditemukan' });
        }

        const group = groups[0];
        const invited = [];

        for (const userId of userIds) {
            // Check if already member
            const [member] = await pool.query(
                'SELECT * FROM group_members WHERE group_id = ? AND user_id = ?',
                [groupId, userId]
            );

            if (member.length > 0 && member[0].is_active) {
                continue; // Already active member
            }

            const [existing] = await pool.query(
                'SELECT * FROM group_invitations WHERE group_id = ? AND invitee_id = ? AND status = "pending"',
                [groupId, userId]
            );

            if (existing.length === 0) {
                await pool.query(
                    'INSERT INTO group_invitations (group_id, inviter_id, invitee_id, status) VALUES (?, ?, ?, "pending")',
                    [groupId, req.user.id, userId]
                );
                invited.push(userId);
            }
        }

        // Notify invited users via socket
        invited.forEach(userId => {
            io.to(`user_${userId}`).emit('group_invitation', {
                group_id: parseInt(groupId),
                group_name: group.name,
                invited_by: req.user.id,
                invited_by_name: req.user.full_name || req.user.username
            });
        });

        res.json({ 
            success: true, 
            message: `${invited.length} undangan terkirim`,
            invited_count: invited.length
        });

    } catch (error) {
        console.error('Invite users error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Gagal mengirim undangan',
            message: error.message 
        });
    }
});

// Accept group invitation
app.post('/api/groups/invitations/:invitationId/accept', authenticateToken, async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const invitationId = req.params.invitationId;

        const [invitations] = await connection.query(
            'SELECT * FROM group_invitations WHERE id = ? AND invitee_id = ? AND status = "pending"',
            [invitationId, req.user.id]
        );

        if (invitations.length === 0) {
            await connection.rollback();
            return res.status(404).json({ 
                success: false, 
                error: 'Undangan tidak ditemukan atau sudah kadaluarsa' 
            });
        }

        const invitation = invitations[0];

        // Check if already member
        const [existing] = await connection.query(
            'SELECT * FROM group_members WHERE group_id = ? AND user_id = ?',
            [invitation.group_id, req.user.id]
        );

        if (existing.length > 0) {
            if (!existing[0].is_active) {
                // Reactivate
                await connection.query(
                    'UPDATE group_members SET is_active = TRUE, left_at = NULL, joined_at = NOW() WHERE id = ?',
                    [existing[0].id]
                );
            } else {
                await connection.rollback();
                return res.status(400).json({ 
                    success: false, 
                    error: 'Anda sudah menjadi anggota group ini' 
                });
            }
        } else {
            // Add as member
            await connection.query(
                'INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, "member")',
                [invitation.group_id, req.user.id]
            );
        }

        // Add to chat room
        const [rooms] = await connection.query(
            'SELECT id FROM chat_rooms WHERE group_id = ?',
            [invitation.group_id]
        );

        if (rooms.length > 0) {
            await connection.query(
                'INSERT IGNORE INTO chat_room_participants (room_id, user_id) VALUES (?, ?)',
                [rooms[0].id, req.user.id]
            );
        }

        // Update invitation status
        await connection.query(
            'UPDATE group_invitations SET status = "accepted", responded_at = NOW() WHERE id = ?',
            [invitationId]
        );

        await connection.commit();

        res.json({ 
            success: true, 
            message: 'Anda bergabung ke group',
            group_id: invitation.group_id,
            room_id: rooms[0]?.id
        });

    } catch (error) {
        await connection.rollback();
        console.error('Accept invitation error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Gagal menerima undangan',
            message: error.message 
        });
    } finally {
        connection.release();
    }
});

// Reject group invitation
app.post('/api/groups/invitations/:invitationId/reject', authenticateToken, async (req, res) => {
    try {
        const invitationId = req.params.invitationId;

        const [result] = await pool.query(
            'UPDATE group_invitations SET status = "rejected", responded_at = NOW() WHERE id = ? AND invitee_id = ?',
            [invitationId, req.user.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ 
                success: false, 
                error: 'Undangan tidak ditemukan' 
            });
        }

        res.json({ success: true, message: 'Undangan ditolak' });

    } catch (error) {
        console.error('Reject invitation error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Gagal menolak undangan',
            message: error.message 
        });
    }
});

// Get pending invitations for user
app.get('/api/groups/invitations/pending', authenticateToken, async (req, res) => {
    try {
        const [invitations] = await pool.query(
            `SELECT 
                gi.*,
                g.name as group_name,
                g.avatar_url as group_avatar,
                u.username as inviter_username,
                u.full_name as inviter_name
             FROM group_invitations gi
             INNER JOIN \`groups\` g ON gi.group_id = g.id
             INNER JOIN users u ON gi.inviter_id = u.id
             WHERE gi.invitee_id = ? AND gi.status = 'pending'
             ORDER BY gi.created_at DESC`,
            [req.user.id]
        );

        res.json({ 
            success: true, 
            invitations: invitations || [] 
        });
    } catch (error) {
        console.error('Get pending invitations error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Gagal mengambil undangan',
            message: error.message 
        });
    }
});

// Get group chat room by group ID
app.get('/api/chat/groups/:groupId/room', authenticateToken, async (req, res) => {
    try {
        const groupId = req.params.groupId;
        
        // Cek apakah user member of group
        const [membership] = await pool.query(
            'SELECT * FROM group_members WHERE group_id = ? AND user_id = ? AND is_active = TRUE',
            [groupId, req.user.id]
        );
        
        if (membership.length === 0 && req.user.role !== 'admin') {
            return res.status(403).json({ 
                success: false, 
                error: 'Anda bukan anggota group ini' 
            });
        }
        
        // Cari chat room untuk group
        const [rooms] = await pool.query(
            `SELECT cr.* 
             FROM chat_rooms cr
             WHERE cr.group_id = ?`,
            [groupId]
        );
        
        if (rooms.length === 0) {
            return res.status(404).json({ 
                success: false, 
                error: 'Room chat tidak ditemukan' 
            });
        }
        
        const room = rooms[0];
        
        // Dapatkan info group
        const [groups] = await pool.query(
            'SELECT name, avatar_url FROM `groups` WHERE id = ?',
            [groupId]
        );
        
        res.json({
            success: true,
            room: {
                ...room,
                group_info: groups[0] || null
            }
        });
        
    } catch (error) {
        console.error('Get group room error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Internal server error' 
        });
    }
});

// Search users to invite (only friends)
app.get('/api/groups/:groupId/available-users', authenticateToken, async (req, res) => {
    try {
        const groupId = req.params.groupId;
        const { q } = req.query;

        // Get current members
        const [members] = await pool.query(
            'SELECT user_id FROM group_members WHERE group_id = ? AND is_active = TRUE',
            [groupId]
        );
        const memberIds = members.map(m => m.user_id);
        memberIds.push(req.user.id); // Exclude self

        // QUERY BARU: HANYA TEMAN YANG BISA DIINVITE
        let query = 'SELECT DISTINCT u.id, u.username, u.full_name, u.email, ' +
                   'pp.cloudinary_url as profile_picture ' +
                   'FROM users u ' +
                   'LEFT JOIN profile_pictures pp ON u.id = pp.user_id ' +
                   'JOIN friends f ON (f.user_id = ? AND f.friend_id = u.id) OR (f.user_id = u.id AND f.friend_id = ?) ' + // HANYA TEMAN
                   'WHERE u.is_active = 1 AND u.id NOT IN (?) AND f.status = "accepted"'; // PASTIKAN STATUS ACCEPTED

        const params = [req.user.id, req.user.id, memberIds];

        if (q && q.length >= 2) {
            query += ' AND (u.username LIKE ? OR u.full_name LIKE ? OR u.email LIKE ?)';
            const searchTerm = `%${q}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }

        query += ' ORDER BY u.full_name ASC LIMIT 20';

        const [users] = await pool.query(query, params);

        res.json({ success: true, users });
    } catch (error) {
        console.error('Search available users error:', error);
        res.status(500).json({ success: false, error: 'Gagal mencari user' });
    }
});

// =====================================================
// CHAT SYSTEM - FRIENDS MANAGEMENT
// =====================================================

// Search users to add friend
app.get('/api/users/search', authenticateToken, async (req, res) => {
    try {
        const { q } = req.query;
        
        if (!q || q.length < 3) {
            return res.json({ 
                success: true, 
                users: [],
                message: 'Ketik minimal 3 karakter untuk mencari' 
            });
        }

        const [users] = await pool.query(
            `SELECT id, username, full_name, email, role,
                    (SELECT cloudinary_url FROM profile_pictures WHERE user_id = users.id LIMIT 1) as profile_picture
             FROM users 
             WHERE (username LIKE ? OR email LIKE ? OR full_name LIKE ?) 
             AND id != ? 
             AND is_active = 1
             ORDER BY 
                CASE 
                    WHEN username = ? THEN 1
                    WHEN email = ? THEN 2
                    WHEN full_name = ? THEN 3
                    ELSE 4
                END,
                username
             LIMIT 20`,
            [`%${q}%`, `%${q}%`, `%${q}%`, req.user.id, q, q, q]
        );

        res.json({ success: true, users });
    } catch (error) {
        console.error('Search users error:', error);
        res.status(500).json({ success: false, error: 'Gagal mencari user' });
    }
});

// Send friend request
app.post('/api/friends/request/:userId', authenticateToken, async (req, res) => {
    try {
        const friendId = req.params.userId;
        
        if (friendId == req.user.id) {
            return res.status(400).json({ success: false, error: 'Tidak bisa menambah diri sendiri' });
        }

        const [existing] = await pool.query(
            'SELECT * FROM friends WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)',
            [req.user.id, friendId, friendId, req.user.id]
        );

        if (existing.length > 0) {
            return res.status(400).json({ success: false, error: 'Sudah ada hubungan pertemanan' });
        }

        const [existingRequest] = await pool.query(
            'SELECT * FROM friend_requests WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?) AND status = "pending"',
            [req.user.id, friendId, friendId, req.user.id]
        );

        if (existingRequest.length > 0) {
            return res.status(400).json({ success: false, error: 'Sudah ada permintaan pertemanan' });
        }

        await pool.query(
            'INSERT INTO friend_requests (sender_id, receiver_id) VALUES (?, ?)',
            [req.user.id, friendId]
        );

        io.to(`user_${friendId}`).emit('friend_request', {
            from: req.user.id,
            from_name: req.user.full_name || req.user.username
        });

        res.json({ success: true, message: 'Permintaan pertemanan terkirim' });
    } catch (error) {
        console.error('Send friend request error:', error);
        res.status(500).json({ success: false, error: 'Gagal mengirim permintaan' });
    }
});

// Accept friend request
app.post('/api/friends/accept/:requestId', authenticateToken, async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const requestId = req.params.requestId;

        const [requests] = await connection.query(
            'SELECT * FROM friend_requests WHERE id = ? AND receiver_id = ? AND status = "pending"',
            [requestId, req.user.id]
        );

        if (requests.length === 0) {
            await connection.rollback();
            return res.status(404).json({ success: false, error: 'Permintaan tidak ditemukan' });
        }

        const request = requests[0];

        await connection.query(
            'UPDATE friend_requests SET status = "accepted" WHERE id = ?',
            [requestId]
        );

        const [existingFriends] = await connection.query(
            'SELECT id FROM friends WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)',
            [request.sender_id, req.user.id, req.user.id, request.sender_id]
        );

        if (existingFriends.length === 0) {
            await connection.query(
                `INSERT INTO friends (user_id, friend_id, status) 
                 VALUES (?, ?, "accepted"), (?, ?, "accepted")`,
                [request.sender_id, req.user.id, req.user.id, request.sender_id]
            );
        } else {
            console.log('Friendship already exists, skipping insert');
        }

        const [existingRooms] = await connection.query(
            `SELECT cr.id FROM chat_rooms cr
             JOIN chat_room_participants crp1 ON cr.id = crp1.room_id AND crp1.user_id = ?
             JOIN chat_room_participants crp2 ON cr.id = crp2.room_id AND crp2.user_id = ?
             WHERE cr.room_type = 'private'`,
            [request.sender_id, req.user.id]
        );

        let roomId;
        
        if (existingRooms.length === 0) {
            const [roomResult] = await connection.query(
                'INSERT INTO chat_rooms (room_name, room_type, created_by) VALUES (?, "private", ?)',
                [null, request.sender_id]
            );

            roomId = roomResult.insertId;

            await connection.query(
                'INSERT INTO chat_room_participants (room_id, user_id) VALUES (?, ?), (?, ?)',
                [roomId, request.sender_id, roomId, req.user.id]
            );
        } else {
            roomId = existingRooms[0].id;
            console.log('Chat room already exists, using existing room:', roomId);
        }

        await connection.commit();

        io.to(`user_${request.sender_id}`).emit('friend_accepted', {
            by: req.user.id,
            by_name: req.user.full_name || req.user.username,
            room_id: roomId
        });

        res.json({ 
            success: true, 
            message: 'Pertemanan diterima', 
            room_id: roomId 
        });
    } catch (error) {
        await connection.rollback();
        console.error('Accept friend request error:', error);
        res.status(500).json({ success: false, error: 'Gagal menerima permintaan' });
    } finally {
        connection.release();
    }
});

// Reject friend request
app.post('/api/friends/reject/:requestId', authenticateToken, async (req, res) => {
    try {
        const requestId = req.params.requestId;

        await pool.query(
            'UPDATE friend_requests SET status = "rejected" WHERE id = ? AND receiver_id = ?',
            [requestId, req.user.id]
        );

        res.json({ success: true, message: 'Permintaan ditolak' });
    } catch (error) {
        console.error('Reject friend request error:', error);
        res.status(500).json({ success: false, error: 'Gagal menolak permintaan' });
    }
});

// Get friends list
app.get('/api/friends', authenticateToken, async (req, res) => {
    try {
        const [friends] = await pool.query(
            `SELECT DISTINCT 
                u.id, u.username, u.full_name, u.email, u.role,
                f.created_at as friend_since,
                (SELECT COUNT(*) FROM chat_messages cm 
                 WHERE cm.room_id = cr.id AND cm.user_id != ? AND cm.created_at > COALESCE(
                    (SELECT last_read_at FROM chat_room_participants 
                     WHERE room_id = cr.id AND user_id = ?), '1970-01-01'
                 )) as unread_count
             FROM friends f
             JOIN users u ON f.friend_id = u.id
             LEFT JOIN chat_rooms cr ON cr.room_type = 'private' AND cr.id IN (
                SELECT room_id FROM chat_room_participants WHERE user_id = ?
                INTERSECT
                SELECT room_id FROM chat_room_participants WHERE user_id = u.id
             )
             WHERE f.user_id = ? AND f.status = 'accepted'
             GROUP BY u.id
             ORDER BY f.created_at DESC`,
            [req.user.id, req.user.id, req.user.id, req.user.id]
        );

        res.json({ success: true, friends });
    } catch (error) {
        console.error('Get friends error:', error);
        res.status(500).json({ success: false, error: 'Gagal mengambil daftar teman' });
    }
});

// Get pending friend requests
app.get('/api/friends/requests/pending', authenticateToken, async (req, res) => {
    try {
        const [requests] = await pool.query(
            `SELECT fr.*, 
                    u.username, u.full_name, u.email
             FROM friend_requests fr
             JOIN users u ON fr.sender_id = u.id
             WHERE fr.receiver_id = ? AND fr.status = 'pending'
             ORDER BY fr.created_at DESC`,
            [req.user.id]
        );

        res.json({ success: true, requests });
    } catch (error) {
        console.error('Get pending requests error:', error);
        res.status(500).json({ success: false, error: 'Gagal mengambil permintaan' });
    }
});

// =====================================================
// CHAT ROOMS & MESSAGES
// =====================================================

// GET /api/chat/rooms
app.get('/api/chat/rooms', authenticateToken, async (req, res) => {
    try {
        console.log('Fetching chat rooms for user:', req.user.id);

        const [rooms] = await pool.query(
            `SELECT 
                cr.*,
                (
                    SELECT COUNT(*) FROM chat_messages cm 
                    WHERE cm.room_id = cr.id 
                    AND cm.user_id != ? 
                    AND cm.created_at > COALESCE(
                        (
                            SELECT crp.last_read_at 
                            FROM chat_room_participants crp 
                            WHERE crp.room_id = cr.id AND crp.user_id = ?
                        ), 
                        '1970-01-01'
                    )
                ) as unread_count,

                CASE 
                    WHEN cr.room_type = 'private' THEN (
                        SELECT JSON_OBJECT(
                            'id', u.id,
                            'username', u.username,
                            'full_name', u.full_name,
                            'email', u.email,
                            'profile_picture_url', (
                                SELECT cloudinary_url 
                                FROM profile_pictures 
                                WHERE user_id = u.id 
                                LIMIT 1
                            )
                        )
                        FROM chat_room_participants crp2
                        JOIN users u ON crp2.user_id = u.id
                        WHERE crp2.room_id = cr.id 
                        AND crp2.user_id != ?
                        LIMIT 1
                    )
                    ELSE NULL
                END as other_user,

                CASE 
                    WHEN cr.room_type = 'group' THEN (
                        SELECT JSON_OBJECT(
                            'id', g.id,
                            'name', g.name,
                            'avatar_url', g.avatar_url
                        )
                        FROM \`groups\` g
                        WHERE g.id = cr.group_id
                        LIMIT 1
                    )
                    ELSE NULL
                END as group_info,

                (SELECT message FROM chat_messages 
                 WHERE room_id = cr.id 
                 ORDER BY created_at DESC LIMIT 1) as last_message,

                (SELECT created_at FROM chat_messages 
                 WHERE room_id = cr.id 
                 ORDER BY created_at DESC LIMIT 1) as last_message_time,

                (SELECT COUNT(*) FROM chat_messages WHERE room_id = cr.id) as message_count,
                (SELECT COUNT(*) FROM chat_room_participants WHERE room_id = cr.id) as participant_count

             FROM chat_rooms cr
             JOIN chat_room_participants crp ON cr.id = crp.room_id
             WHERE crp.user_id = ?
             ORDER BY COALESCE(last_message_time, cr.created_at) DESC`,
            [req.user.id, req.user.id, req.user.id, req.user.id]
        );

        console.log(`Found ${rooms.length} chat rooms`);
        res.json({ success: true, rooms });
    } catch (error) {
        console.error('❌ Get chat rooms error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Gagal mengambil room chat',
            message: error.message 
        });
    }
});

// Get room messages - DIPERBAIKI
app.get('/api/chat/rooms/:roomId/messages', authenticateToken, async (req, res) => {
    try {
        const roomId = req.params.roomId;
        const { before, limit = 50 } = req.query;

        const [participant] = await pool.query(
            'SELECT * FROM chat_room_participants WHERE room_id = ? AND user_id = ?',
            [roomId, req.user.id]
        );

        if (participant.length === 0 && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, error: 'Anda tidak memiliki akses ke room ini' });
        }

        let query = `
            SELECT 
                cm.*,
                u.username, 
                u.full_name,
                u.id as user_id,
                pp.file_path as profile_picture
            FROM chat_messages cm
            JOIN users u ON cm.user_id = u.id
            LEFT JOIN profile_pictures pp ON u.id = pp.user_id
            WHERE cm.room_id = ? AND cm.is_deleted = FALSE
        `;

        const params = [roomId];

        if (before) {
            query += ' AND cm.created_at < ?';
            params.push(before);
        }

        query += ' ORDER BY cm.created_at DESC LIMIT ?';
        params.push(parseInt(limit));

        const [messages] = await pool.query(query, params);

        const formattedMessages = messages.map(msg => {
            const message = { ...msg };
            
            if (message.profile_picture) {
                const filename = path.basename(message.profile_picture);
                const subfolder = path.basename(path.dirname(message.profile_picture));
                message.profile_picture_url = `/uploads/${subfolder}/${filename}`;
            }
            
            if (message.cloudinary_url) {
                message.file_url = message.cloudinary_url;
                message.file_name = message.file_name || message.file_url.split('/').pop();
            } else if (message.file_path) {
                const filename = path.basename(message.file_path);
                const pathParts = message.file_path.split(path.sep);
                const subfolder = pathParts[pathParts.length - 2];
                message.file_url = `/files/${subfolder}/${filename}`;
                message.file_name = message.file_name || filename;
            }
            
            message.read_count = 0;
            
            return message;
        });

        if (formattedMessages.length > 0) {
            for (const msg of formattedMessages) {
                if (msg.user_id !== req.user.id) {
                    await pool.query(
                        'INSERT IGNORE INTO chat_message_reads (message_id, user_id) VALUES (?, ?)',
                        [msg.id, req.user.id]
                    );
                }
            }

            await pool.query(
                'UPDATE chat_room_participants SET last_read_at = NOW() WHERE room_id = ? AND user_id = ?',
                [roomId, req.user.id]
            );
        }

        io.to(`chat_${roomId}`).emit('messages_read', {
            room_id: parseInt(roomId),
            user_id: req.user.id,
            read_at: new Date()
        });

        io.to(`user_${req.user.id}`).emit('rooms_need_refresh', {
            reason: 'opened_room',
            room_id: parseInt(roomId)
        });

        res.json({ 
            success: true, 
            messages: formattedMessages.reverse(),
            has_more: formattedMessages.length === parseInt(limit)
        });

    } catch (error) {
        console.error('❌ Get messages error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Gagal mengambil pesan',
            message: error.message 
        });
    }
});

// Send message - DENGAN CLOUDINARY (FIXED - dengan debug)
app.post('/api/chat/rooms/:roomId/messages', authenticateToken, upload.single('file'), async (req, res) => {
    try {
        const roomId = req.params.roomId;
        const { message } = req.body;

        console.log('📥 Received message request:', {
            roomId,
            userId: req.user.id,
            hasFile: !!req.file,
            messageLength: message?.length,
            fileDetails: req.file ? {
                fieldname: req.file.fieldname,
                originalname: req.file.originalname,
                mimetype: req.file.mimetype,
                size: req.file.size,
                bufferLength: req.file.buffer?.length
            } : null,
            bodyKeys: Object.keys(req.body)
        });

        const [participant] = await pool.query(
            'SELECT * FROM chat_room_participants WHERE room_id = ? AND user_id = ?',
            [roomId, req.user.id]
        );

        if (participant.length === 0) {
            return res.status(403).json({ success: false, error: 'Anda tidak memiliki akses ke room ini' });
        }

        let messageType = 'text';
        let cloudinaryUrl = null;
        let cloudinaryPublicId = null;
        let fileName = null;
        let fileSize = null;
        let mimeType = null;

        if (req.file) {
            try {
                messageType = req.file.mimetype.startsWith('image/') ? 'image' : 'file';
                
                console.log('📤 Uploading to Cloudinary...', {
                    fileSize: req.file.size,
                    mimeType: req.file.mimetype,
                    originalname: req.file.originalname
                });
                
                if (!cloudinary) {
                    console.error('❌ Cloudinary not configured!');
                    throw new Error('Cloudinary configuration missing');
                }
                
                if (!req.file.buffer || req.file.buffer.length === 0) {
                    throw new Error('File buffer is empty');
                }
                
                const result = await new Promise((resolve, reject) => {
                    const uploadStream = cloudinary.uploader.upload_stream(
                        {
                            folder: `${process.env.CLOUDINARY_FOLDER || 'taskbot'}/chat`,
                            resource_type: 'auto',
                            public_id: `chat-${roomId}-${Date.now()}-${Math.round(Math.random() * 1E9)}`
                        },
                        (error, result) => {
                            if (error) {
                                console.error('❌ Cloudinary upload error:', error);
                                reject(error);
                            } else {
                                console.log('✅ Cloudinary upload success:', {
                                    url: result.secure_url,
                                    public_id: result.public_id
                                });
                                resolve(result);
                            }
                        }
                    );
                    
                    uploadStream.end(req.file.buffer);
                });
                
                cloudinaryUrl = result.secure_url;
                cloudinaryPublicId = result.public_id;
                fileName = req.file.originalname;
                fileSize = req.file.size;
                mimeType = req.file.mimetype;
                
                console.log('✅ File ready for database:', {
                    cloudinaryUrl,
                    fileName,
                    fileSize
                });
                
            } catch (uploadError) {
                console.error('❌ Cloudinary upload error:', uploadError);
                return res.status(500).json({ 
                    success: false, 
                    error: 'Gagal mengupload file: ' + uploadError.message 
                });
            }
        }

        console.log('📝 Checking table structure...');
        const [tableInfo] = await pool.query('DESCRIBE chat_messages');
        console.log('Table columns:', tableInfo.map(col => col.Field).join(', '));

        console.log('📝 Inserting into database with values:', {
            roomId,
            userId: req.user.id,
            message: message || null,
            messageType,
            cloudinaryUrl,
            cloudinaryPublicId,
            fileName,
            fileSize,
            mimeType
        });

        const [result] = await pool.query(
            `INSERT INTO chat_messages 
            (room_id, user_id, message, message_type, file_path, cloudinary_url, cloudinary_public_id, file_name, file_size, mime_type, status) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'sent')`,
            [roomId, req.user.id, message || null, messageType, cloudinaryUrl, cloudinaryUrl, cloudinaryPublicId, fileName, fileSize, mimeType]
        );

        console.log('✅ Message inserted with ID:', result.insertId);

        if (!result.insertId || result.insertId === 0) {
            console.error('❌ Insert returned invalid ID:', result);
            throw new Error('Database insert failed - returned ID 0');
        }

        console.log('📝 Retrieving inserted message with ID:', result.insertId);
        
        const [newMessages] = await pool.query(
            `SELECT 
                cm.*,
                u.username, 
                u.full_name,
                u.id as user_id,
                pp.cloudinary_url as profile_picture_url
            FROM chat_messages cm
            JOIN users u ON cm.user_id = u.id
            LEFT JOIN profile_pictures pp ON u.id = pp.user_id
            WHERE cm.id = ?`,
            [result.insertId]
        );

        if (newMessages.length === 0) {
            console.error('❌ No message found with ID:', result.insertId);
            throw new Error('Failed to retrieve created message');
        }

        const newMessage = newMessages[0];
        console.log('✅ Retrieved message from database:', {
            id: newMessage.id,
            user_id: newMessage.user_id,
            message_type: newMessage.message_type,
            cloudinary_url: newMessage.cloudinary_url ? 'exists' : 'none',
            file_path: newMessage.file_path ? 'exists' : 'none',
            file_name: newMessage.file_name
        });

        if (!newMessage.cloudinary_url && !newMessage.file_path && req.file) {
            console.error('❌ No file URL in retrieved message despite having file!');
        }

        const responseMessage = {
            ...newMessage,
            file_url: newMessage.cloudinary_url || newMessage.file_path
        };

        console.log('📦 Sending response with file_url:', responseMessage.file_url ? 'exists' : 'missing');

        const [participants] = await pool.query(
            'SELECT user_id FROM chat_room_participants WHERE room_id = ? AND user_id != ?',
            [roomId, req.user.id]
        );

        console.log(`📨 Broadcasting message ID ${newMessage.id} to ${participants.length} participants`);

        participants.forEach(p => {
            io.to(`user_${p.user_id}`).emit('new_message', {
                room_id: parseInt(roomId),
                message: responseMessage
            });
        });

        res.json({ 
            success: true, 
            message: responseMessage 
        });

    } catch (error) {
        console.error('❌ Send message error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Gagal mengirim pesan: ' + error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// =====================================================
// DEBUG ENDPOINT - CEK SEMUA MESSAGES
// =====================================================
app.get('/api/chat/debug/messages/:roomId', authenticateToken, async (req, res) => {
    try {
        const roomId = req.params.roomId;
        
        const [messages] = await pool.query(
            `SELECT 
                id, 
                message_type, 
                cloudinary_url, 
                file_path, 
                file_name,
                created_at,
                user_id
            FROM chat_messages 
            WHERE room_id = ? 
            ORDER BY created_at DESC 
            LIMIT 20`,
            [roomId]
        );
        
        const formatted = messages.map(m => ({
            id: m.id,
            type: m.message_type,
            has_url: !!(m.cloudinary_url || m.file_path),
            url: m.cloudinary_url || m.file_path,
            file_name: m.file_name,
            created: m.created_at
        }));
        
        res.json({
            success: true,
            total: messages.length,
            messages: formatted
        });
    } catch (error) {
        console.error('Debug error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// =====================================================
// TEST ENDPOINT UNTUK CEK MESSAGES
// =====================================================
app.get('/api/chat/test/messages/:roomId', authenticateToken, async (req, res) => {
    try {
        const roomId = req.params.roomId;
        
        const [messages] = await pool.query(
            `SELECT 
                id, 
                message_type, 
                cloudinary_url, 
                file_path, 
                file_name,
                created_at
            FROM chat_messages 
            WHERE room_id = ? 
            ORDER BY created_at DESC 
            LIMIT 10`,
            [roomId]
        );
        
        res.json({
            success: true,
            messages: messages.map(m => ({
                ...m,
                has_url: !!(m.cloudinary_url || m.file_path)
            }))
        });
    } catch (error) {
        console.error('Test messages error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete all messages in a room (by admin or room participants)
app.delete('/api/chat/rooms/:roomId/messages', authenticateToken, async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const roomId = req.params.roomId;
        const { reason } = req.body;

        if (req.user.role === 'admin') {
            await connection.query(
                'UPDATE chat_messages SET is_deleted = TRUE, deleted_by = ?, deleted_at = NOW() WHERE room_id = ?',
                [req.user.id, roomId]
            );

            await connection.query(
                'INSERT INTO chat_room_deletions (room_id, deleted_by, reason) VALUES (?, ?, ?)',
                [roomId, req.user.id, reason || 'Deleted by admin']
            );

            const [participants] = await connection.query(
                'SELECT user_id FROM chat_room_participants WHERE room_id = ?',
                [roomId]
            );

            participants.forEach(p => {
                io.to(`user_${p.user_id}`).emit('room_messages_deleted', {
                    room_id: roomId,
                    by: 'admin',
                    reason: reason
                });
            });
        } else {
            const [participant] = await connection.query(
                'SELECT * FROM chat_room_participants WHERE room_id = ? AND user_id = ?',
                [roomId, req.user.id]
            );

            if (participant.length === 0) {
                await connection.rollback();
                return res.status(403).json({ success: false, error: 'Anda tidak memiliki akses' });
            }

            await connection.query(
                'UPDATE chat_messages SET is_deleted = TRUE, deleted_by = ?, deleted_at = NOW() WHERE room_id = ?',
                [req.user.id, roomId]
            );

            const [participants] = await connection.query(
                'SELECT user_id FROM chat_room_participants WHERE room_id = ? AND user_id != ?',
                [roomId, req.user.id]
            );

            participants.forEach(p => {
                io.to(`user_${p.user_id}`).emit('room_messages_deleted', {
                    room_id: roomId,
                    by: req.user.id,
                    by_name: req.user.full_name || req.user.username
                });
            });
        }

        await connection.commit();
        res.json({ success: true, message: 'Semua pesan dihapus' });
    } catch (error) {
        await connection.rollback();
        console.error('Delete room messages error:', error);
        res.status(500).json({ success: false, error: 'Gagal menghapus pesan' });
    } finally {
        connection.release();
    }
});

// =====================================================
// USER PRESENCE (ONLINE/OFFLINE STATUS)
// =====================================================

// Update user presence
app.post('/api/user/presence', async (req, res) => {
    try {
        const { status } = req.body;
        let userId = null;
        
        // 🔥 CEK DARI TOKEN DULU (untuk request normal)
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        
        if (token) {
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET || 'taskbot-secret');
                userId = decoded.userId;
            } catch (e) {
                // Token tidak valid, lanjut cek dari body
                console.log('Token invalid in presence update:', e.message);
            }
        }
        
        // 🔥 JIKA TIDAK ADA TOKEN, CEK DARI BODY (untuk sendBeacon saat logout)
        if (!userId && req.body.user_id) {
            userId = req.body.user_id;
        }
        
        // Jika masih tidak ada user_id, return error
        if (!userId) {
            return res.status(400).json({ 
                success: false, 
                error: 'User ID required' 
            });
        }
        
        if (!['online', 'offline'].includes(status)) {
            return res.status(400).json({ 
                success: false, 
                error: 'Status harus online atau offline' 
            });
        }

        // Cek apakah user exists
        const [userExists] = await pool.query(
            'SELECT id FROM users WHERE id = ?',
            [userId]
        );

        if (userExists.length === 0) {
            return res.status(404).json({ 
                success: false, 
                error: 'User tidak ditemukan' 
            });
        }

        // Buat table jika belum ada
        const [tables] = await pool.query("SHOW TABLES LIKE 'user_presence'");
        
        if (tables.length === 0) {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS user_presence (
                    id INT PRIMARY KEY AUTO_INCREMENT,
                    user_id INT NOT NULL,
                    status ENUM('online', 'offline') DEFAULT 'offline',
                    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
                    last_active DATETIME NULL,
                    UNIQUE KEY unique_user (user_id),
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                )
            `);
            console.log('✅ Table user_presence created');
        }

        // Update presence berdasarkan status
        if (status === 'online') {
            await pool.query(
                `INSERT INTO user_presence (user_id, status, last_seen, last_active) 
                 VALUES (?, 'online', NOW(), NOW())
                 ON DUPLICATE KEY UPDATE 
                 status = 'online',
                 last_seen = NOW(),
                 last_active = NOW()`,
                [userId]
            );
        } else {
            await pool.query(
                `INSERT INTO user_presence (user_id, status, last_seen, last_active) 
                 VALUES (?, 'offline', NOW(), last_active)
                 ON DUPLICATE KEY UPDATE 
                 status = 'offline',
                 last_seen = NOW()`,
                [userId]
            );
            
            await pool.query(
                'UPDATE users SET last_active = NOW() WHERE id = ?',
                [userId]
            );
        }

        // Broadcast ke semua friends (hanya jika ada token, karena butuh validitas)
        // Untuk sendBeacon (tanpa token) kita skip broadcast karena user sudah logout
        if (token) {
            const [friends] = await pool.query(
                `SELECT friend_id FROM friends 
                 WHERE user_id = ? AND status = 'accepted'
                 UNION
                 SELECT user_id FROM friends 
                 WHERE friend_id = ? AND status = 'accepted'`,
                [userId, userId]
            );

            friends.forEach(f => {
                io.to(`user_${f.friend_id}`).emit('user_presence', {
                    user_id: userId,
                    status: status,
                    last_seen: new Date()
                });
            });
        }

        res.json({ 
            success: true,
            message: `Status updated to ${status}`
        });

    } catch (error) {
        console.error('❌ Presence update error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Get user presence
app.get('/api/user/presence/:userId', authenticateToken, async (req, res) => {
    try {
        const userId = req.params.userId;

        const [users] = await pool.query(
            'SELECT id FROM users WHERE id = ?',
            [userId]
        );

        if (users.length === 0) {
            return res.status(404).json({ 
                success: false, 
                error: 'User tidak ditemukan' 
            });
        }

        const [presence] = await pool.query(
            `SELECT up.*, 
                    CASE 
                        WHEN up.status = 'online' THEN 'online'
                        WHEN up.last_seen > DATE_SUB(NOW(), INTERVAL 5 MINUTE) THEN 'recent'
                        ELSE 'offline'
                    END as display_status
             FROM user_presence up
             WHERE up.user_id = ?`,
            [userId]
        );

        if (presence.length === 0) {
            return res.json({ 
                success: true, 
                status: 'offline',
                display_status: 'offline',
                last_seen: null,
                last_active: null
            });
        }

        const result = {
            success: true,
            status: presence[0].status,
            display_status: presence[0].display_status,
            last_seen: presence[0].last_seen,
            last_active: presence[0].last_active
        };

        if (presence[0].status === 'offline' && presence[0].last_seen) {
            const lastSeen = new Date(presence[0].last_seen);
            const now = new Date();
            const diffMinutes = Math.floor((now - lastSeen) / (1000 * 60));
            
            if (diffMinutes < 60) {
                result.last_seen_text = `${diffMinutes} menit yang lalu`;
            } else if (diffMinutes < 1440) {
                result.last_seen_text = `${Math.floor(diffMinutes / 60)} jam yang lalu`;
            } else {
                result.last_seen_text = lastSeen.toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            }
        }

        res.json(result);

    } catch (error) {
        console.error('❌ Get presence error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// GET SINGLE TEST CASE
app.get('/api/test-cases/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        
        const [testCases] = await pool.query(
            `SELECT tc.*, 
                    u.username as executed_by_username,
                    t.title as task_title
             FROM test_cases tc
             LEFT JOIN users u ON tc.executed_by = u.id
             LEFT JOIN tasks t ON tc.task_id = t.id
             WHERE tc.id = ?`,
            [id]
        );
        
        if (testCases.length === 0) {
            return res.status(404).json({ 
                success: false, 
                error: 'Test case tidak ditemukan' 
            });
        }
        
        const testCase = testCases[0];
        
        if (testCase.cloudinary_url) {
            testCase.screenshot_url = testCase.cloudinary_url;
            console.log('✅ Using Cloudinary URL:', testCase.cloudinary_url);
        } else if (testCase.screenshot_path) {
            let filename = path.basename(testCase.screenshot_path);
            
            if (testCase.screenshot_path.includes('uploads')) {
                const pathParts = testCase.screenshot_path.split(path.sep);
                const uploadsIndex = pathParts.findIndex(part => part === 'uploads');
                
                if (uploadsIndex !== -1 && pathParts.length > uploadsIndex + 1) {
                    const subfolder = pathParts[uploadsIndex + 1];
                    testCase.screenshot_url = `/uploads/${subfolder}/${filename}`;
                } else {
                    testCase.screenshot_url = `/uploads/${filename}`;
                }
            } else {
                testCase.screenshot_url = `/uploads/screenshots/${filename}`;
            }
            
            console.log('✅ Using local path:', testCase.screenshot_url);
        }
        
        if (testCase.screenshot_url && !testCase.screenshot_url.startsWith('http')) {
            const baseUrl = process.env.APP_URL || `http://localhost:${process.env.PORT || 3002}`;
            testCase.screenshot_full_url = baseUrl + testCase.screenshot_url;
        }
        
        res.json(testCase);
        
    } catch (error) {
        console.error('❌ Get test case error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Internal server error',
            message: error.message 
        });
    }
});

// Get all friends presence (for bulk updates)
app.get('/api/user/presence/friends/all', authenticateToken, async (req, res) => {
    try {
        const [friends] = await pool.query(
            `SELECT DISTINCT 
                CASE 
                    WHEN f.user_id = ? THEN f.friend_id
                    ELSE f.user_id
                END as friend_id
             FROM friends f
             WHERE (f.user_id = ? OR f.friend_id = ?) 
             AND f.status = 'accepted'`,
            [req.user.id, req.user.id, req.user.id]
        );

        if (friends.length === 0) {
            return res.json({ success: true, presences: [] });
        }

        const friendIds = friends.map(f => f.friend_id);

        const [presences] = await pool.query(
            `SELECT 
                up.user_id,
                up.status,
                up.last_seen,
                CASE 
                    WHEN up.status = 'online' THEN 'online'
                    WHEN up.last_seen > DATE_SUB(NOW(), INTERVAL 5 MINUTE) THEN 'recent'
                    ELSE 'offline'
                END as display_status
             FROM user_presence up
             WHERE up.user_id IN (?)`,
            [friendIds]
        );

        res.json({ 
            success: true, 
            presences: presences 
        });

    } catch (error) {
        console.error('❌ Get friends presence error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Heartbeat endpoint (called every 30 seconds from client)
app.post('/api/user/heartbeat', authenticateToken, async (req, res) => {
    try {
        await pool.query(
            `UPDATE user_presence 
             SET last_seen = NOW(), 
                 status = 'online' 
             WHERE user_id = ?`,
            [req.user.id]
        );

        res.json({ success: true });

    } catch (error) {
        console.error('❌ Heartbeat error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Edit message
app.put('/api/chat/messages/:messageId', authenticateToken, async (req, res) => {
    try {
        const messageId = req.params.messageId;
        const { message } = req.body;

        const [messages] = await pool.query(
            'SELECT * FROM chat_messages WHERE id = ? AND user_id = ?',
            [messageId, req.user.id]
        );

        if (messages.length === 0) {
            return res.status(404).json({ 
                success: false, 
                error: 'Pesan tidak ditemukan atau bukan milik Anda' 
            });
        }

        const msg = messages[0];
        
        const messageAge = Date.now() - new Date(msg.created_at).getTime();
        const maxAge = 24 * 60 * 60 * 1000;
        
        if (messageAge > maxAge) {
            return res.status(403).json({ 
                success: false, 
                error: 'Tidak bisa mengedit pesan yang lebih dari 24 jam' 
            });
        }

        await pool.query(
            'UPDATE chat_messages SET message = ?, edited = TRUE, edited_at = NOW() WHERE id = ?',
            [message, messageId]
        );

        const [updatedMessages] = await pool.query(
            `SELECT cm.*, u.username, u.full_name 
             FROM chat_messages cm
             JOIN users u ON cm.user_id = u.id
             WHERE cm.id = ?`,
            [messageId]
        );

        if (updatedMessages.length === 0) {
            throw new Error('Failed to retrieve updated message');
        }

        const updatedMessage = updatedMessages[0];

        io.to(`chat_${msg.room_id}`).emit('message_edited', {
            message_id: messageId,
            message: updatedMessage.message,
            edited_at: updatedMessage.edited_at,
            room_id: msg.room_id
        });

        res.json({ 
            success: true, 
            message: updatedMessage 
        });

    } catch (error) {
        console.error('Edit message error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete message
app.delete('/api/chat/messages/:messageId', authenticateToken, async (req, res) => {
    try {
        const messageId = req.params.messageId;
        const { reason } = req.body;

        const [messages] = await pool.query(
            'SELECT * FROM chat_messages WHERE id = ?',
            [messageId]
        );

        if (messages.length === 0) {
            return res.status(404).json({ 
                success: false, 
                error: 'Pesan tidak ditemukan' 
            });
        }

        const msg = messages[0];

        if (msg.user_id !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ 
                success: false, 
                error: 'Anda tidak memiliki izin menghapus pesan ini' 
            });
        }

        if (req.user.role !== 'admin') {
            const messageAge = Date.now() - new Date(msg.created_at).getTime();
            const maxAge = 24 * 60 * 60 * 1000;
            
            if (messageAge > maxAge) {
                return res.status(403).json({ 
                    success: false, 
                    error: 'Tidak bisa menghapus pesan yang lebih dari 24 jam' 
                });
            }
        }

        await pool.query(
            'UPDATE chat_messages SET is_deleted = TRUE, deleted_by = ?, deleted_at = NOW() WHERE id = ?',
            [req.user.id, messageId]
        );

        io.to(`chat_${msg.room_id}`).emit('message_deleted', {
            message_id: messageId,
            room_id: msg.room_id,
            deleted_by: req.user.id,
            reason: reason
        });

        res.json({ 
            success: true, 
            message: 'Pesan berhasil dihapus' 
        });

    } catch (error) {
        console.error('Delete message error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Mark messages as delivered/read
app.post('/api/chat/messages/status', authenticateToken, async (req, res) => {
    try {
        const { messageIds, status, room_id } = req.body;

        if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
            return res.status(400).json({ success: false, error: 'Invalid message IDs' });
        }

        await pool.query(
            `UPDATE chat_messages 
             SET status = ? 
             WHERE id IN (?) AND user_id != ?`,
            [status, messageIds, req.user.id]
        );

        if (status === 'read') {
            for (const messageId of messageIds) {
                await pool.query(
                    'INSERT IGNORE INTO chat_message_reads (message_id, user_id) VALUES (?, ?)',
                    [messageId, req.user.id]
                );
            }
        }

        const [messages] = await pool.query(
            `SELECT cm.*, COUNT(cmr.user_id) as read_count
             FROM chat_messages cm
             LEFT JOIN chat_message_reads cmr ON cm.id = cmr.message_id
             WHERE cm.id IN (?)
             GROUP BY cm.id`,
            [messageIds]
        );

        io.to(`chat_${room_id}`).emit('messages_status_update', {
            message_ids: messageIds,
            status: status,
            user_id: req.user.id,
            messages: messages
        });

        res.json({ 
            success: true, 
            messages: messages 
        });

    } catch (error) {
        console.error('Update message status error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Reply to message
app.post('/api/chat/messages/:messageId/reply', authenticateToken, async (req, res) => {
    try {
        const messageId = req.params.messageId;
        const { message, room_id } = req.body;

        const [originalMessages] = await pool.query(
            'SELECT * FROM chat_messages WHERE id = ?',
            [messageId]
        );

        if (originalMessages.length === 0) {
            return res.status(404).json({ 
                success: false, 
                error: 'Pesan yang direply tidak ditemukan' 
            });
        }

        const [result] = await pool.query(
            `INSERT INTO chat_messages 
            (room_id, user_id, message, message_type, reply_to_id, status) 
            VALUES (?, ?, ?, 'text', ?, 'sent')`,
            [room_id, req.user.id, message, messageId]
        );

        const [newMessages] = await pool.query(
            `SELECT cm.*, u.username, u.full_name,
                    cm2.message as reply_message,
                    cm2.user_id as reply_user_id,
                    u2.username as reply_username,
                    u2.full_name as reply_full_name
             FROM chat_messages cm
             JOIN users u ON cm.user_id = u.id
             LEFT JOIN chat_messages cm2 ON cm.reply_to_id = cm2.id
             LEFT JOIN users u2 ON cm2.user_id = u2.id
             WHERE cm.id = ?`,
            [result.insertId]
        );

        if (newMessages.length === 0) {
            throw new Error('Failed to retrieve created message');
        }

        const newMessage = newMessages[0];

        io.to(`chat_${room_id}`).emit('new_message', {
            room_id: parseInt(room_id),
            message: newMessage
        });

        res.json({ 
            success: true, 
            message: newMessage 
        });

    } catch (error) {
        console.error('Reply to message error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET messages with reply info (ENHANCED VERSION)
app.get('/api/chat/rooms/:roomId/messages-enhanced', authenticateToken, async (req, res) => {
    try {
        const roomId = req.params.roomId;
        const { before, limit = 50 } = req.query;

        const [participant] = await pool.query(
            'SELECT * FROM chat_room_participants WHERE room_id = ? AND user_id = ?',
            [roomId, req.user.id]
        );

        if (participant.length === 0 && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, error: 'Akses ditolak' });
        }

        let query = `
            SELECT 
                cm.*,
                u.username, 
                u.full_name,
                u.id as user_id,
                pp.file_path as profile_picture_path,
                pp.cloudinary_url as profile_picture_url,
                cm2.message as reply_message,
                cm2.user_id as reply_user_id,
                u2.username as reply_username,
                u2.full_name as reply_full_name,
                COUNT(DISTINCT cmr.user_id) as read_count,
                CASE 
                    WHEN cm.status = 'read' THEN 'read'
                    WHEN cm.status = 'delivered' THEN 'delivered'
                    ELSE 'sent'
                END as message_status
            FROM chat_messages cm
            JOIN users u ON cm.user_id = u.id
            LEFT JOIN profile_pictures pp ON u.id = pp.user_id
            LEFT JOIN chat_messages cm2 ON cm.reply_to_id = cm2.id
            LEFT JOIN users u2 ON cm2.user_id = u2.id
            LEFT JOIN chat_message_reads cmr ON cm.id = cmr.message_id
            WHERE cm.room_id = ? AND cm.is_deleted = FALSE
        `;

        const params = [roomId];

        if (before) {
            query += ' AND cm.created_at < ?';
            params.push(before);
        }

        query += ' GROUP BY cm.id ORDER BY cm.created_at DESC LIMIT ?';
        params.push(parseInt(limit));

        const [messages] = await pool.query(query, params);

        const formattedMessages = messages.map(msg => {
            const message = { ...msg };
            
            if (message.profile_picture_url) {
                message.profile_picture_url = message.profile_picture_url;
            } else if (message.profile_picture_path) {
                const filename = path.basename(message.profile_picture_path);
                const subfolder = path.basename(path.dirname(message.profile_picture_path));
                message.profile_picture_url = `/uploads/${subfolder}/${filename}`;
            }
            
            if (message.cloudinary_url) {
                message.file_url = message.cloudinary_url;
                message.file_name = message.file_name;
            } else if (message.file_path) {
                const filename = path.basename(message.file_path);
                const pathParts = message.file_path.split(path.sep);
                const subfolder = pathParts[pathParts.length - 2];
                message.file_url = `/uploads/${subfolder}/${filename}`;
                message.file_name = message.file_name || filename;
            }

            if (message.reply_to_id) {
                message.reply_to = {
                    id: message.reply_to_id,
                    message: message.reply_message,
                    user_id: message.reply_user_id,
                    username: message.reply_username,
                    full_name: message.reply_full_name
                };
            }
            
            return message;
        });

        const messageIds = messages
            .filter(m => m.user_id !== req.user.id && m.status === 'sent')
            .map(m => m.id);

        if (messageIds.length > 0) {
            await pool.query(
                'UPDATE chat_messages SET status = "delivered" WHERE id IN (?)',
                [messageIds]
            );
        }

        res.json({ 
            success: true, 
            messages: formattedMessages.reverse(),
            has_more: formattedMessages.length === parseInt(limit)
        });

    } catch (error) {
        console.error('❌ Get messages error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// =====================================================
// PROFILE PICTURE UPLOAD - CLOUDINARY
// =====================================================

// Upload profile picture
app.post('/api/profile/picture', authenticateToken, upload.single('profile_picture'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No file uploaded' });
        }

        const result = await new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    folder: `${process.env.CLOUDINARY_FOLDER || 'taskbot'}/profiles`,
                    resource_type: 'image',
                    public_id: `profile-${req.user.id}-${Date.now()}`,
                    transformation: [
                        { width: 400, height: 400, crop: 'limit' },
                        { quality: 'auto' }
                    ]
                },
                (error, result) => {
                    if (error) reject(error);
                    else resolve(result);
                }
            );
            
            uploadStream.end(req.file.buffer);
        });

        const [oldPicture] = await pool.query(
            'SELECT cloudinary_public_id FROM profile_pictures WHERE user_id = ?',
            [req.user.id]
        );

        if (oldPicture.length > 0 && oldPicture[0].cloudinary_public_id) {
            await deleteFromCloudinary(oldPicture[0].cloudinary_public_id);
        }

        await pool.query(
            `INSERT INTO profile_pictures (user_id, file_path, cloudinary_url, cloudinary_public_id, file_name, file_size) 
             VALUES (?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE 
             file_path = VALUES(file_path),
             cloudinary_url = VALUES(cloudinary_url),
             cloudinary_public_id = VALUES(cloudinary_public_id),
             file_name = VALUES(file_name),
             file_size = VALUES(file_size),
             uploaded_at = CURRENT_TIMESTAMP`,
            [req.user.id, result.secure_url, result.secure_url, result.public_id, req.file.originalname, req.file.size]
        );

        res.json({ 
            success: true, 
            message: 'Profile picture uploaded successfully',
            file_url: result.secure_url
        });
    } catch (error) {
        console.error('Upload profile picture error:', error);
        res.status(500).json({ success: false, error: 'Failed to upload profile picture' });
    }
});

// Get profile picture
app.get('/api/profile/picture/:userId', authenticateToken, async (req, res) => {
    try {
        const userId = req.params.userId;

        const [pictures] = await pool.query(
            'SELECT cloudinary_url, file_path FROM profile_pictures WHERE user_id = ?',
            [userId]
        );

        if (pictures.length === 0) {
            return res.json({ success: true, has_picture: false });
        }

        res.json({ 
            success: true, 
            has_picture: true,
            file_url: pictures[0].cloudinary_url || pictures[0].file_path
        });
    } catch (error) {
        console.error('Get profile picture error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Gagal mengambil foto profile' 
        });
    }
});

// =====================================================
// ADMIN CHAT MONITORING
// =====================================================

// Get all chat rooms (admin only)
app.get('/api/admin/chat/rooms', authenticateToken, isAdmin, async (req, res) => {
    try {
        const [rooms] = await pool.query(
            `SELECT 
                cr.*,
                COUNT(DISTINCT crp.user_id) as participant_count,
                COUNT(cm.id) as message_count,
                MAX(cm.created_at) as last_message_at,
                GROUP_CONCAT(DISTINCT CONCAT(u.username, ' (', u.full_name, ')')) as participants
             FROM chat_rooms cr
             LEFT JOIN chat_room_participants crp ON cr.id = crp.room_id
             LEFT JOIN users u ON crp.user_id = u.id
             LEFT JOIN chat_messages cm ON cr.id = cm.room_id
             GROUP BY cr.id
             ORDER BY cr.created_at DESC`
        );

        res.json({ success: true, rooms });
    } catch (error) {
        console.error('Admin get rooms error:', error);
        res.status(500).json({ success: false, error: 'Gagal mengambil data rooms' });
    }
});

// Get deleted messages history (admin only)
app.get('/api/admin/chat/deleted-messages', authenticateToken, isAdmin, async (req, res) => {
    try {
        const [deletions] = await pool.query(
            `SELECT 
                crd.*,
                u.username as deleted_by_username,
                u.full_name as deleted_by_name,
                cr.room_name,
                (SELECT COUNT(*) FROM chat_messages WHERE room_id = crd.room_id AND is_deleted = TRUE) as deleted_count
             FROM chat_room_deletions crd
             JOIN users u ON crd.deleted_by = u.id
             JOIN chat_rooms cr ON crd.room_id = cr.id
             ORDER BY crd.deleted_at DESC`
        );

        res.json({ success: true, deletions });
    } catch (error) {
        console.error('Get deleted messages error:', error);
        res.status(500).json({ success: false, error: 'Gagal mengambil history' });
    }
});

// Get room messages (admin only)
app.get('/api/admin/chat/rooms/:roomId/messages', authenticateToken, isAdmin, async (req, res) => {
    try {
        const roomId = req.params.roomId;

        const [messages] = await pool.query(
            `SELECT 
                cm.*,
                u.username, u.full_name,
                (SELECT COUNT(*) FROM chat_message_reads WHERE message_id = cm.id) as read_count
             FROM chat_messages cm
             JOIN users u ON cm.user_id = u.id
             WHERE cm.room_id = ?
             ORDER BY cm.created_at DESC
             LIMIT 100`,
            [roomId]
        );

        res.json({ success: true, messages });
    } catch (error) {
        console.error('Admin get messages error:', error);
        res.status(500).json({ success: false, error: 'Gagal mengambil pesan' });
    }
});

// =====================================================
// TEST CASES MANAGEMENT
// =====================================================

// GET TEST CASES BY TASK
app.get('/api/tasks/:taskId/test-cases', authenticateToken, async (req, res) => {
    try {
        const { taskId } = req.params;
        
        const [testCases] = await pool.query(
            `SELECT tc.*, 
                    u.username as executed_by_username,
                    t.title as task_title
             FROM test_cases tc
             LEFT JOIN users u ON tc.executed_by = u.id
             LEFT JOIN tasks t ON tc.task_id = t.id
             WHERE tc.task_id = ?
             ORDER BY tc.created_at DESC`,
            [taskId]
        );
        
        testCases.forEach(tc => {
            if (tc.cloudinary_url) {
                tc.screenshot_url = tc.cloudinary_url;
            } else if (tc.screenshot_path) {
                const filename = path.basename(tc.screenshot_path);
                
                if (tc.screenshot_path.includes('uploads')) {
                    const pathParts = tc.screenshot_path.split(path.sep);
                    const uploadsIndex = pathParts.findIndex(part => part === 'uploads');
                    
                    if (uploadsIndex !== -1 && pathParts.length > uploadsIndex + 1) {
                        const subfolder = pathParts[uploadsIndex + 1];
                        tc.screenshot_url = `/uploads/${subfolder}/${filename}`;
                    } else {
                        tc.screenshot_url = `/uploads/${filename}`;
                    }
                } else {
                    tc.screenshot_url = `/uploads/screenshots/${filename}`;
                }
            }
        });
        
        res.json(testCases);
        
    } catch (error) {
        console.error('❌ Get test cases error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Internal server error' 
        });
    }
});

// CREATE TEST CASE - DENGAN CLOUDINARY
app.post('/api/tasks/:taskId/test-cases', authenticateToken, upload.single('screenshot'), async (req, res) => {
    try {
        const { taskId } = req.params;
        const { test_name, test_description, input_data, expected_output } = req.body;
        
        const [tasks] = await pool.query('SELECT assignee_id FROM tasks WHERE id = ?', [taskId]);
        
        if (tasks.length === 0) {
            return res.status(404).json({ 
                success: false, 
                error: 'Task tidak ditemukan' 
            });
        }
        
        if (req.user.role !== 'admin' && tasks[0].assignee_id !== req.user.id) {
            return res.status(403).json({ 
                success: false, 
                error: 'Anda tidak memiliki akses ke task ini' 
            });
        }
        
        let cloudinaryUrl = null;
        let cloudinaryPublicId = null;
        
        if (req.file) {
            try {
                const result = await new Promise((resolve, reject) => {
                    const uploadStream = cloudinary.uploader.upload_stream(
                        {
                            folder: `${process.env.CLOUDINARY_FOLDER || 'taskbot'}/screenshots`,
                            resource_type: 'image',
                            public_id: `testcase-${taskId}-${Date.now()}`
                        },
                        (error, result) => {
                            if (error) reject(error);
                            else resolve(result);
                        }
                    );
                    
                    uploadStream.end(req.file.buffer);
                });
                
                cloudinaryUrl = result.secure_url;
                cloudinaryPublicId = result.public_id;
                
                console.log('✅ Screenshot uploaded to Cloudinary:', cloudinaryUrl);
            } catch (uploadError) {
                console.error('❌ Cloudinary upload error:', uploadError);
                return res.status(500).json({ 
                    success: false, 
                    error: 'Gagal mengupload screenshot' 
                });
            }
        }
        
        const [result] = await pool.query(
            `INSERT INTO test_cases 
            (task_id, test_name, test_description, input_data, expected_output, screenshot_path, cloudinary_url, cloudinary_public_id) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [taskId, test_name, test_description, input_data, expected_output, cloudinaryUrl, cloudinaryUrl, cloudinaryPublicId]
        );
        
        const [newTestCase] = await pool.query('SELECT * FROM test_cases WHERE id = ?', [result.insertId]);
        
        res.status(201).json({
            success: true,
            message: 'Test case berhasil ditambahkan',
            test_case: {
                ...newTestCase[0],
                screenshot_url: cloudinaryUrl
            }
        });
        
    } catch (error) {
        console.error('Create test case error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Internal server error' 
        });
    }
});

// UPDATE TEST CASE RESULT - VERSI CLOUDINARY
app.put('/api/test-cases/:id/result', authenticateToken, upload.single('screenshot'), async (req, res) => {
    try {
        const { id } = req.params;
        const { actual_output, status, note } = req.body;
        
        if (!actual_output || !status) {
            return res.status(400).json({ 
                success: false, 
                error: 'Actual output dan status harus diisi' 
            });
        }
        
        const [testCases] = await pool.query(
            `SELECT tc.*, t.assignee_id, t.cloudinary_url as task_file_url 
             FROM test_cases tc 
             JOIN tasks t ON tc.task_id = t.id 
             WHERE tc.id = ?`,
            [id]
        );
        
        if (testCases.length === 0) {
            return res.status(404).json({ 
                success: false, 
                error: 'Test case tidak ditemukan' 
            });
        }
        
        const testCase = testCases[0];
        
        if (req.user.role !== 'admin' && testCase.assignee_id !== req.user.id) {
            return res.status(403).json({ 
                success: false, 
                error: 'Anda tidak memiliki akses ke test case ini' 
            });
        }
        
        let cloudinaryUrl = testCase.cloudinary_url;
        let cloudinaryPublicId = testCase.cloudinary_public_id;
        
        if (req.file) {
            try {
                if (cloudinaryPublicId) {
                    await deleteFromCloudinary(cloudinaryPublicId);
                }
                
                const result = await new Promise((resolve, reject) => {
                    const uploadStream = cloudinary.uploader.upload_stream(
                        {
                            folder: `${process.env.CLOUDINARY_FOLDER || 'taskbot'}/screenshots`,
                            resource_type: 'image',
                            public_id: `testcase-${id}-${Date.now()}`
                        },
                        (error, result) => {
                            if (error) reject(error);
                            else resolve(result);
                        }
                    );
                    
                    uploadStream.end(req.file.buffer);
                });
                
                cloudinaryUrl = result.secure_url;
                cloudinaryPublicId = result.public_id;
                
                console.log('✅ Screenshot uploaded to Cloudinary:', cloudinaryUrl);
            } catch (uploadError) {
                console.error('❌ Cloudinary upload error:', uploadError);
                return res.status(500).json({ 
                    success: false, 
                    error: 'Gagal mengupload screenshot' 
                });
            }
        }
        
        await pool.query(
            `UPDATE test_cases 
             SET actual_output = ?, 
                 status = ?,
                 screenshot_path = ?,
                 cloudinary_url = ?,
                 cloudinary_public_id = ?,
                 executed_by = ?,
                 executed_at = NOW(),
                 note = ?
             WHERE id = ?`,
            [
                actual_output, 
                status, 
                cloudinaryUrl, 
                cloudinaryUrl, 
                cloudinaryPublicId,
                req.user.id, 
                note || null, 
                id
            ]
        );
        
        await logActivity(req.user.id, 'UPDATE_TEST_CASE', 'test_case', id, {
            status: status,
            test_name: testCase.test_name
        });
        
        res.json({
            success: true,
            message: 'Hasil test case berhasil diupdate',
            test_case: {
                id: id,
                status: status,
                actual_output: actual_output,
                screenshot_url: cloudinaryUrl
            }
        });
        
    } catch (error) {
        console.error('❌ Update test case result error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Internal server error: ' + error.message 
        });
    }
});

// =====================================================
// UPLOAD RESULT
// =====================================================
app.post('/api/tasks/:id/result', authenticateToken, upload.single('result_file'), async (req, res) => {
    try {
        const { id } = req.params;
        const { result_text } = req.body;
        
        const [tasks] = await pool.query('SELECT assignee_id FROM tasks WHERE id = ?', [id]);
        
        if (tasks.length === 0) {
            return res.status(404).json({ 
                success: false, 
                error: 'Task tidak ditemukan' 
            });
        }
        
        if (req.user.role !== 'admin' && tasks[0].assignee_id !== req.user.id) {
            return res.status(403).json({ 
                success: false, 
                error: 'Anda tidak memiliki akses' 
            });
        }
        
        let filePath = null;
        if (req.file) {
            filePath = req.file.path;
            
            await pool.query(
                `INSERT INTO uploads (task_id, user_id, file_name, file_path, file_size, file_type)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [id, req.user.id, req.file.originalname, filePath, req.file.size, req.file.mimetype]
            );
        }
        
        await pool.query(
            'UPDATE tasks SET result_text = ?, file_path = ? WHERE id = ?',
            [result_text, filePath || tasks[0].file_path, id]
        );
        
        res.json({
            success: true,
            message: 'Hasil pekerjaan berhasil diupload'
        });
        
    } catch (error) {
        console.error('Upload result error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Internal server error' 
        });
    }
});

// =====================================================
// ACTIVITIES - UNTUK RECENT ACTIVITY
// =====================================================
app.get('/api/activities', authenticateToken, async (req, res) => {
    try {
        let query;
        let params = [];
        
        if (req.user.role === 'admin') {
            query = `
                SELECT al.*, u.username, u.full_name
                FROM activity_logs al
                JOIN users u ON al.user_id = u.id
                ORDER BY al.created_at DESC
                LIMIT 20
            `;
        } else {
            query = `
                SELECT al.*, u.username, u.full_name
                FROM activity_logs al
                JOIN users u ON al.user_id = u.id
                WHERE al.user_id = ?
                ORDER BY al.created_at DESC
                LIMIT 20
            `;
            params = [req.user.id];
        }
        
        const [activities] = await pool.query(query, params);
        
        const formattedActivities = activities.map(activity => {
            let details = null;

            try {
                if (activity.details == null) {
                    details = null;
                } else if (typeof activity.details === 'object') {
                    details = activity.details;
                } else if (typeof activity.details === 'string') {
                    const s = activity.details.trim();

                    if (!s) {
                        details = null;
                    } else if (s === '[object Object]') {
                        details = { raw: s };
                    } else {
                        details = JSON.parse(s);
                    }
                } else {
                    details = { raw: String(activity.details) };
                }
            } catch (e) {
                console.error('Error parsing activity details:', e, 'RAW:', activity.details);
                details = { raw: activity.details, parse_error: e.message };
            }
            
            return {
                ...activity,
                action: activity.action,
                details: details,
                created_at: activity.created_at
            };
        });
        
        res.json({ 
            success: true, 
            activities: formattedActivities 
        });
        
    } catch (error) {
        console.error('❌ Get activities error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Internal server error',
            message: error.message 
        });
    }
});

// =====================================================
// WEEKLY ACTIVITY STATS
// =====================================================
app.get('/api/weekly-activity', authenticateToken, async (req, res) => {
    try {
        const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
        const today = new Date();
        const weeklyData = [];
        
        for (let i = 6; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const startOfDay = new Date(date.setHours(0, 0, 0, 0));
            const endOfDay = new Date(date.setHours(23, 59, 59, 999));
            
            let query;
            let params;
            
            if (req.user.role === 'admin') {
                query = `
                    SELECT COUNT(*) as count
                    FROM tasks
                    WHERE created_at BETWEEN ? AND ?
                `;
                params = [startOfDay, endOfDay];
            } else {
                query = `
                    SELECT COUNT(*) as count
                    FROM tasks
                    WHERE assignee_id = ? AND created_at BETWEEN ? AND ?
                `;
                params = [req.user.id, startOfDay, endOfDay];
            }
            
            const [rows] = await pool.query(query, params);
            weeklyData.push(rows[0].count);
        }
        
        res.json({
            success: true,
            labels: days,
            data: weeklyData
        });
        
    } catch (error) {
        console.error('Get weekly activity error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Internal server error' 
        });
    }
});

// =====================================================
// STATISTICS
// =====================================================
app.get('/api/stats', authenticateToken, async (req, res) => {
    try {
        let query;
        let params = [];
        
        if (req.user.role === 'admin') {
            query = `
                SELECT 
                    COUNT(DISTINCT t.id) as total_tasks,
                    COUNT(DISTINCT u.id) as total_users,
                    SUM(CASE WHEN t.status = 'pending' THEN 1 ELSE 0 END) as pending_tasks,
                    SUM(CASE WHEN t.status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_tasks,
                    SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) as completed_tasks,
                    SUM(CASE WHEN t.status = 'approved' THEN 1 ELSE 0 END) as approved_tasks,
                    SUM(CASE WHEN t.approval_status = 'pending' AND t.status = 'completed' THEN 1 ELSE 0 END) as pending_approval,
                    SUM(CASE WHEN t.status = 'rejected' THEN 1 ELSE 0 END) as rejected_tasks
                FROM tasks t
                LEFT JOIN users u ON 1=1
            `;
        } else {
            query = `
                SELECT 
                    COUNT(*) as total_tasks,
                    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_tasks,
                    SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_tasks,
                    SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_tasks,
                    SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_tasks,
                    SUM(CASE WHEN approval_status = 'pending' AND status = 'completed' THEN 1 ELSE 0 END) as pending_approval
                FROM tasks
                WHERE assignee_id = ?
            `;
            params = [req.user.id];
        }
        
        const [rows] = await pool.query(query, params);
        res.json(rows[0]);
        
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Internal server error' 
        });
    }
});

// =====================================================
// PROFILE UPDATE (NON-PICTURE)
// =====================================================
app.put('/api/profile', authenticateToken, async (req, res) => {
    try {
        const { full_name, email, telegram_chat_id, current_password, new_password } = req.body;
        
        if (email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Format email tidak valid' 
                });
            }
            
            const [existing] = await pool.query(
                'SELECT id FROM users WHERE email = ? AND id != ?',
                [email, req.user.id]
            );
            
            if (existing.length > 0) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Email sudah digunakan user lain' 
                });
            }
        }
        
        if (new_password) {
            if (!current_password) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Password saat ini harus diisi' 
                });
            }
            
            if (new_password.length < 6) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Password baru minimal 6 karakter' 
                });
            }
            
            const [users] = await pool.query(
                'SELECT password FROM users WHERE id = ?',
                [req.user.id]
            );
            
            if (users.length === 0) {
                return res.status(404).json({ 
                    success: false, 
                    error: 'User tidak ditemukan' 
                });
            }
            
            const validPassword = await bcrypt.compare(current_password, users[0].password);
            if (!validPassword) {
                return res.status(401).json({ 
                    success: false, 
                    error: 'Password saat ini salah' 
                });
            }
            
            const hashedPassword = await bcrypt.hash(new_password, 10);
            await pool.query(
                'UPDATE users SET password = ? WHERE id = ?',
                [hashedPassword, req.user.id]
            );
        }
        
        const updates = [];
        const values = [];
        
        if (full_name !== undefined) {
            updates.push('full_name = ?');
            values.push(full_name);
        }
        
        if (email !== undefined) {
            updates.push('email = ?');
            values.push(email);
        }
        
        if (telegram_chat_id !== undefined) {
            updates.push('telegram_chat_id = ?');
            values.push(telegram_chat_id);
        }
        
        if (updates.length > 0) {
            values.push(req.user.id);
            await pool.query(
                `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
                values
            );
        }
        
        const [updatedUsers] = await pool.query(
            'SELECT id, username, email, full_name, role, telegram_chat_id, telegram_verified FROM users WHERE id = ?',
            [req.user.id]
        );
        
        await logActivity(req.user.id, 'UPDATE_PROFILE', 'user', req.user.id, {
            fields_updated: updates.map(u => u.split(' ')[0])
        });
        
        res.json({
            success: true,
            message: 'Profile berhasil diupdate',
            user: updatedUsers[0]
        });
        
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Gagal mengupdate profile',
            message: error.message 
        });
    }
});

// =====================================================
// USER MANAGEMENT (ADMIN)
// =====================================================
app.get('/api/admin/users', authenticateToken, isAdmin, async (req, res) => {
    try {
        const [users] = await pool.query(
            `SELECT id, username, email, full_name, role, telegram_chat_id, 
                    telegram_verified, is_active, last_login, created_at 
             FROM users 
             ORDER BY created_at DESC`
        );
        
        res.json({
            success: true,
            users
        });
        
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Gagal mengambil data users.' 
        });
    }
});

app.post('/api/admin/users', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { username, email, password, full_name, role, telegram_chat_id } = req.body;
        
        const [existing] = await pool.query(
            'SELECT id FROM users WHERE username = ? OR email = ?',
            [username, email]
        );
        
        if (existing.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Username atau email sudah terdaftar.'
            });
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const [result] = await pool.query(
            `INSERT INTO users 
            (username, email, password, full_name, role, telegram_chat_id, telegram_verified) 
            VALUES (?, ?, ?, ?, ?, ?, 1)`,
            [username, email, hashedPassword, full_name, role || 'user', telegram_chat_id || null]
        );
        
        res.status(201).json({
            success: true,
            message: 'User berhasil ditambahkan.',
            user_id: result.insertId
        });
        
    } catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Gagal menambahkan user.' 
        });
    }
});

// PERBAIKAN: sendTelegramMessage dengan error handling lebih baik
async function sendTelegramMessage(chatId, text, parseMode = 'Markdown') {
    try {
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        
        if (!botToken) {
            console.log('⚠️ TELEGRAM_BOT_TOKEN tidak dikonfigurasi');
            return null;
        }
        
        if (!chatId) {
            console.log('⚠️ chatId tidak valid');
            return null;
        }
        
        console.log(`📤 Mengirim pesan ke ${chatId}: ${text.substring(0, 50)}...`);
        
        const response = await axios.post(
            `https://api.telegram.org/bot${botToken}/sendMessage`,
            {
                chat_id: chatId,
                text: text,
                parse_mode: parseMode,
                disable_web_page_preview: true
            },
            { 
                timeout: 10000,
                headers: { 'Content-Type': 'application/json' }
            }
        );
        
        console.log(`✅ Pesan terkirim ke ${chatId}`);
        return response.data;
    } catch (error) {
        console.error('❌ Telegram error:', {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status
        });
        
        // Fallback ke parse mode HTML jika Markdown error
        if (error.response?.data?.description?.includes('can\'t parse entities')) {
            try {
                console.log('⚠️ Markdown error, mencoba dengan HTML...');
                const response = await axios.post(
                    `https://api.telegram.org/bot${botToken}/sendMessage`,
                    {
                        chat_id: chatId,
                        text: text.replace(/\*/g, '').replace(/_/g, ''),
                        parse_mode: 'HTML'
                    },
                    { timeout: 10000 }
                );
                return response.data;
            } catch (htmlError) {
                console.error('❌ HTML fallback juga error:', htmlError.message);
            }
        }
        
        return null;
    }
}

// Endpoint untuk test bot (tanpa auth)
app.post('/api/telegram/test-bot', express.json(), async (req, res) => {
    try {
        const { chatId, text } = req.body;
        
        if (!chatId || !text) {
            return res.status(400).json({ 
                success: false, 
                error: 'chatId dan text required' 
            });
        }
        
        const result = await sendTelegramMessage(chatId, text);
        
        res.json({
            success: true,
            result
        });
    } catch (error) {
        console.error('Test bot error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

async function sendTelegramVerification(chatId, code) {
    const message = 
        '🔐 *Kode Verifikasi Akun*\n\n' +
        `Kode verifikasi Anda: *${code}*\n\n` +
        'Gunakan kode ini untuk memverifikasi akun Anda di dashboard.\n' +
        'Kode berlaku selama 10 menit.\n\n' +
        'Jika Anda tidak meminta kode ini, abaikan pesan ini.';
    
    return sendTelegramMessage(chatId, message);
}

async function sendTaskNotification(task, chatId) {
    const message = 
        '🚀 *Task Baru Diberikan!*\n\n' +
        `📌 *Judul:* ${task.title}\n` +
        `📝 *Deskripsi:* ${task.description}\n` +
        `📊 *Status:* Pending\n\n` +
        `Silakan login ke dashboard untuk mulai mengerjakan.\n` +
        `${process.env.APP_URL || 'http://localhost:3002'}`;
    
    return sendTelegramMessage(chatId, message);
}

async function sendApprovalRequest(task, adminChatId, user) {
    const message = 
        '⏳ *Approval Request*\n\n' +
        `👤 *User:* ${user.full_name || user.username}\n` +
        `📌 *Task:* ${task.title}\n` +
        `📝 *Deskripsi:* ${task.description}\n\n` +
        `User telah menyelesaikan task dan meminta approval.`;
    
    return sendTelegramMessage(adminChatId, message);
}

async function sendApprovalNotification(task, chatId, status) {
    const message = 
        status === 'approved' 
            ? '✅ *Task Di-approve!*\n\n' +
              `Task "${task.title}" telah disetujui oleh admin.\n` +
              `Terima kasih atas pekerjaannya!`
            : '❌ *Task Ditolak*\n\n' +
              `Task "${task.title}" ditolak oleh admin.\n` +
              `Silakan cek dashboard untuk detail lebih lanjut.`;
    
    return sendTelegramMessage(chatId, message);
}

async function sendRejectionNotification(task, chatId, reason) {
    const message = 
        '❌ *Task Ditolak*\n\n' +
        `📌 *Task:* ${task.title}\n` +
        `📝 *Alasan:* ${reason || 'Tidak memenuhi kriteria'}\n\n` +
        `Silakan perbaiki dan ajukan ulang.`;
    
    return sendTelegramMessage(chatId, message);
}

// Tambahkan endpoint ini di app.js untuk cek token
app.get('/api/telegram/check-token', async (req, res) => {
    try {
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        
        if (!botToken) {
            return res.json({ 
                success: false, 
                error: 'Token tidak ditemukan di .env' 
            });
        }

        // Cek token dengan getMe
        const response = await axios.get(
            `https://api.telegram.org/bot${botToken}/getMe`
        );
        
        res.json({
            success: true,
            bot: response.data.result,
            token_preview: botToken.substring(0, 10) + '...'
        });
    } catch (error) {
        res.json({ 
            success: false, 
            error: error.message,
            response: error.response?.data 
        });
    }
});

// =====================================================
// BROADCAST UPDATE FUNCTION
// =====================================================
function broadcastUpdate(event, data, targetUserId = null) {
    try {
        if (targetUserId) {
            io.to(`user_${targetUserId}`).emit(event, data);
        } else {
            io.emit(event, data);
        }
        console.log(`📢 Broadcasted ${event} to ${targetUserId ? 'user ' + targetUserId : 'all'}`);
    } catch (error) {
        console.error('❌ Broadcast error:', error);
    }
}

// =====================================================
// LOG ACTIVITY
// =====================================================
async function logActivity(userId, action, entityType, entityId, details = {}) {
    try {
        const safeDetails =
            details == null ? null :
            (typeof details === 'string' ? details : JSON.stringify(details));

        await pool.query(
            `INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details)
             VALUES (?, ?, ?, ?, ?)`,
            [userId, action, entityType, entityId, safeDetails]
        );
    } catch (error) {
        console.error('Log activity error:', error);
    }
}

// =====================================================
// HEALTH CHECK
// =====================================================
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        env: process.env.NODE_ENV
    });
});

// =====================================================
// SERVE FRONTEND - HARUS DI AKHIR!
// =====================================================
app.get('*', (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// =====================================================
// ERROR HANDLING
// =====================================================
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        success: false,
        error: err.message || 'Internal server error'
    });
});

// =====================================================
// START SERVER
// =====================================================
server.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🚀 TASK BOT DASHBOARD PRO v2.0                        ║
║   🔐 Dengan Sistem Login & Approval                     ║
║   📁 File Upload & Preview FIXED                        ║
║                                                           ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║   📍 Server: http://localhost:${PORT}                    ║
║   📍 File Access: http://localhost:${PORT}/uploads/      ║
║   📍 API Files: http://localhost:${PORT}/api/files/     ║
║                                                           ║
║   👤 Admin: admin / admin123                             ║
║   👤 User: user1 / user123                               ║
║                                                           ║
║   🤖 Telegram: ${process.env.TELEGRAM_BOT_TOKEN ? '✅ Connected' : '❌ Not Configured'} ║
║   📊 Database: ${process.env.DB_NAME || 'task_bot_db'} @ ${process.env.DB_HOST || 'localhost'} ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
    `);
});

module.exports = { app, server, io, pool };