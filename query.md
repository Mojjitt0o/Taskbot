Tolong kembangkan program web saya agar ada hak akses login. -> bisa buat akun, lupa password, kode verifikasi minta ke saya -> saya cek di bot telegram.
saya sebagai admin bisa buat task baru dan mengarahkan ke siapa yang akan mengerjakan.
user lainnya tidak bisa lihat task orang lain, jadi hanya bisa liat tasknya user tersebut sendiri.
user bisa ubah status dan status update di admin juga.
user bisa isi hasil test, upload gambar, buat test case satu-satu sesuai kebutuhan.
saat user ubah status ke completed, perlu accept dari admin, klo dari admin sudah oke -> admin accept dan status berubah.

Tampilan lebih baguskan juga, fitur maksimalkan semua,.
Tolong pengembangannya langsung tulis lengkap di code saya, biar saya tinggal copy paster. ini semua code saya saat ini :

app.js : const express = require('express');
const mysql = require('mysql2/promise');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const cors = require('cors');
const FormData = require('form-data');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Buat folder uploads jika belum ada
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Middleware untuk serve file uploads
app.use('/uploads', express.static(uploadsDir));

// Konfigurasi upload file yang diperbaiki
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadsDir); // Gunakan path absolut
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const safeFileName = file.originalname.replace(/[^a-zA-Z0-9.]/g, '_');
        cb(null, uniqueSuffix + '-' + safeFileName);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
    fileFilter: function (req, file, cb) {
        // Izinkan semua jenis file
        cb(null, true);
    }
});

// Koneksi database
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'task_bot_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Fungsi untuk mengirim pesan ke Telegram
async function sendToTelegram(taskData, filePath = null) {
    try {
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        const defaultChatId = process.env.TELEGRAM_CHAT_ID;
        
        if (!botToken) {
            console.error('❌ TELEGRAM_BOT_TOKEN tidak ditemukan di .env');
            return null;
        }

        // Gunakan chat_id dari input atau dari .env
        let chatId = taskData.telegram_chat_id || defaultChatId;
        
        // Jika chatId masih kosong, gunakan assignee (jika numeric)
        if (!chatId && !isNaN(taskData.assignee)) {
            chatId = taskData.assignee;
        }
        
        if (!chatId) {
            console.error('❌ Chat ID tidak ditemukan');
            return null;
        }

        console.log('📤 Mengirim ke Telegram:');
        console.log('   Chat ID:', chatId);
        console.log('   Title:', taskData.title);

        // Format pesan yang lebih baik
        const message = `🚀 *TASK BARU DITERIMA!*\n\n` +
                       `📌 *Judul:* ${taskData.title}\n` +
                       `📝 *Deskripsi:* ${taskData.description}\n` +
                       `👤 *Assignee:* ${taskData.assignee}\n` +
                       `📊 *Status:* ${taskData.status}\n` +
                       `\n⏰ *Dibuat:* ${new Date().toLocaleString('id-ID')}`;

        // 1. Kirim pesan teks
        let textResponse;
        try {
            textResponse = await axios.post(
                `https://api.telegram.org/bot${botToken}/sendMessage`,
                {
                    chat_id: chatId,
                    text: message,
                    parse_mode: 'Markdown',
                    disable_web_page_preview: true
                },
                {
                    timeout: 10000
                }
            );
            console.log('✅ Pesan teks berhasil dikirim');
        } catch (textError) {
            console.error('❌ Gagal mengirim pesan teks:', textError.response?.data?.description || textError.message);
            
            // Coba tanpa Markdown jika error
            try {
                textResponse = await axios.post(
                    `https://api.telegram.org/bot${botToken}/sendMessage`,
                    {
                        chat_id: chatId,
                        text: message.replace(/\*/g, ''),
                        disable_web_page_preview: true
                    }
                );
                console.log('✅ Pesan teks berhasil dikirim (tanpa Markdown)');
            } catch (fallbackError) {
                console.error('❌ Gagal total mengirim pesan:', fallbackError.message);
                throw fallbackError;
            }
        }

        // 2. Kirim file jika ada
        if (filePath && fs.existsSync(filePath)) {
            await sendFileToTelegram(botToken, chatId, filePath, taskData.title);
        }

        return textResponse?.data || null;

    } catch (error) {
        console.error('❌ Error dalam sendToTelegram:', error.message);
        return null;
    }
}

// Fungsi untuk mengirim file ke Telegram
async function sendFileToTelegram(botToken, chatId, filePath, caption) {
    try {
        if (!fs.existsSync(filePath)) {
            console.log('⚠️ File tidak ditemukan:', filePath);
            return;
        }

        const fileSize = fs.statSync(filePath).size;
        
        // Cek ukuran file (max 50MB untuk Telegram)
        if (fileSize > 50 * 1024 * 1024) {
            console.log('⚠️ File terlalu besar untuk Telegram:', (fileSize / 1024 / 1024).toFixed(2), 'MB');
            return;
        }

        const form = new FormData();
        const fileStream = fs.createReadStream(filePath);
        
        form.append('chat_id', chatId);
        form.append('caption', `📎 File untuk task: ${caption}`);
        form.append('document', fileStream, {
            filename: path.basename(filePath)
        });

        const response = await axios.post(
            `https://api.telegram.org/bot${botToken}/sendDocument`,
            form,
            {
                headers: form.getHeaders(),
                maxContentLength: Infinity,
                maxBodyLength: Infinity,
                timeout: 30000
            }
        );
        
        console.log('✅ File berhasil dikirim:', path.basename(filePath));
        return response.data;
    } catch (error) {
        console.error('❌ Gagal mengirim file:', error.message);
        console.error('   Detail:', error.response?.data);
        // Tidak throw error agar pesan tetap terkirim meski file gagal
    }
}

// Routes
app.get('/api/tasks', async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT *, DATE_FORMAT(created_at, "%Y-%m-%d %H:%i") as created_at_formatted FROM tasks ORDER BY created_at DESC'
        );
        // Konversi path file ke URL
        rows.forEach(row => {
            if (row.file_path) {
                row.file_url = `/uploads/${path.basename(row.file_path)}`;
            }
        });
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/tasks', upload.single('file'), async (req, res) => {
    let filePath = null;
    try {
        const { title, description, assignee, telegram_chat_id } = req.body;
        
        // Validasi
        if (!title || !description || !assignee) {
            return res.status(400).json({ 
                error: 'Semua field wajib diisi',
                details: { title: !!title, description: !!description, assignee: !!assignee }
            });
        }

        // Handle file upload
        if (req.file) {
            filePath = req.file.path;
            console.log('📁 File berhasil diupload:', filePath);
        }

        const [result] = await pool.query(
            'INSERT INTO tasks (title, description, assignee, file_path, telegram_chat_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())',
            [title, description, assignee, filePath, telegram_chat_id || assignee, 'pending']
        );

        const [newTask] = await pool.query(
            'SELECT * FROM tasks WHERE id = ?',
            [result.insertId]
        );

        const taskData = newTask[0];
        
        // Kirim ke Telegram (async, tidak blocking)
        (async () => {
            try {
                const telegramResult = await sendToTelegram(taskData, filePath);
                if (telegramResult) {
                    console.log('✅ Task berhasil dikirim ke Telegram');
                    
                    // Update status di database
                    await pool.query(
                        'UPDATE tasks SET telegram_sent = 1 WHERE id = ?',
                        [result.insertId]
                    );
                }
            } catch (telegramError) {
                console.error('⚠️ Telegram gagal:', telegramError.message);
            }
        })();

        res.status(201).json({
            ...taskData,
            message: 'Task berhasil dibuat',
            file_url: filePath ? `/uploads/${path.basename(filePath)}` : null
        });

    } catch (error) {
        console.error('❌ Error creating task:', error);
        
        // Hapus file jika gagal
        if (filePath && fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        
        res.status(500).json({ 
            error: 'Internal server error', 
            details: error.message 
        });
    }
});

app.put('/api/tasks/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        await pool.query(
            'UPDATE tasks SET status = ?, updated_at = NOW() WHERE id = ?',
            [status, id]
        );

        const [updatedTask] = await pool.query(
            'SELECT * FROM tasks WHERE id = ?',
            [id]
        );

        res.json(updatedTask[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.delete('/api/tasks/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Hapus file jika ada
        const [task] = await pool.query(
            'SELECT file_path FROM tasks WHERE id = ?',
            [id]
        );

        if (task[0] && task[0].file_path) {
            const filePath = path.join(__dirname, task[0].file_path);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }

        await pool.query('DELETE FROM tasks WHERE id = ?', [id]);
        res.json({ message: 'Task deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/stats', async (req, res) => {
    try {
        const [total] = await pool.query('SELECT COUNT(*) as count FROM tasks');
        const [pending] = await pool.query('SELECT COUNT(*) as count FROM tasks WHERE status = "pending"');
        const [inProgress] = await pool.query('SELECT COUNT(*) as count FROM tasks WHERE status = "in_progress"');
        const [completed] = await pool.query('SELECT COUNT(*) as count FROM tasks WHERE status = "completed"');

        res.json({
            total: total[0].count,
            pending: pending[0].count,
            in_progress: inProgress[0].count,
            completed: completed[0].count
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Test endpoint untuk Telegram
app.get('/api/test-telegram', async (req, res) => {
    try {
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        const chatId = process.env.TELEGRAM_CHAT_ID;
        
        if (!botToken || !chatId) {
            return res.status(400).json({ 
                error: 'Token atau Chat ID belum diatur',
                botToken: !!botToken,
                chatId: !!chatId
            });
        }

        const response = await axios.post(
            `https://api.telegram.org/bot${botToken}/sendMessage`,
            {
                chat_id: chatId,
                text: '✅ Test berhasil! Bot Telegram terhubung dengan baik.\n\nTask Bot Dashboard siap digunakan!',
                parse_mode: 'Markdown'
            }
        );

        res.json({ 
            success: true, 
            message: 'Test pesan terkirim ke Telegram',
            data: response.data 
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message,
            details: error.response?.data 
        });
    }
});

// Endpoint untuk download file
app.get('/api/download/:filename', async (req, res) => {
    try {
        const filename = req.params.filename;
        const filePath = path.join(uploadsDir, filename);
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'File tidak ditemukan' });
        }
        
        res.download(filePath);
    } catch (error) {
        console.error('Download error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uploads_dir: uploadsDir,
        disk_space: Math.floor(fs.statSync(uploadsDir).size / 1024) + ' KB'
    });
});

// Serve index.html untuk semua route yang tidak ditangani
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🚀 Task Bot Dashboard Berhasil Dijalankan!            ║
║                                                           ║
║   ➤ Server: http://localhost:${PORT}                    ║
║   ➤ Upload Directory: ${uploadsDir}                     ║
║   ➤ Telegram Bot: ${process.env.TELEGRAM_BOT_TOKEN ? '✅ Token Tersedia' : '❌ Token Tidak Ditemukan'} ║
║   ➤ Chat ID: ${process.env.TELEGRAM_CHAT_ID || 'Belum Diatur'} ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
    `);
    
    // Tampilkan petunjuk setup
    if (!process.env.TELEGRAM_BOT_TOKEN) {
        console.log(`
⚠️  PERHATIAN: Telegram Bot Token belum diatur!
   Tambahkan ke file .env:
   TELEGRAM_BOT_TOKEN=your_bot_token_here
   TELEGRAM_CHAT_ID=your_chat_id_here
        `);
    }
});

.

database.sql : CREATE DATABASE IF NOT EXISTS task_bot_db;
USE task_bot_db;

CREATE TABLE tasks (
    id INT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    assignee VARCHAR(100) NOT NULL,
    status ENUM('pending', 'in_progress', 'completed') DEFAULT 'pending',
    file_path VARCHAR(500),
    telegram_chat_id VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Optional: Table untuk log pengiriman ke Telegram
CREATE TABLE telegram_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    task_id INT,
    message_id VARCHAR(100),
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

.

package.json : {
  "name": "task-bot-dashboard",
  "version": "1.0.0",
  "description": "Modern dashboard untuk mengirim task ke bot Telegram",
  "main": "app.js",
  "scripts": {
    "start": "node app.js",
    "dev": "nodemon app.js",
    "setup-db": "mysql -u root < database.sql",
    "test-bot": "node test_telegram.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "mysql2": "^3.6.0",
    "dotenv": "^16.3.1",
    "multer": "^1.4.5-lts.1",
    "axios": "^1.6.0",
    "cors": "^2.8.5",
    "form-data": "^4.0.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  }
}

.

test_telegram.js : require('dotenv').config();
const axios = require('axios');

async function testBot() {
    console.log('🤖 Testing Telegram Bot Connection\n');
    
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    
    console.log('Configuration:');
    console.log('  BOT_TOKEN:', botToken ? '✓ Ada' : '✗ TIDAK ADA');
    console.log('  CHAT_ID:', chatId || '✗ TIDAK ADA');
    
    if (!botToken) {
        console.log('\n❌ ERROR: TELEGRAM_BOT_TOKEN tidak ditemukan di .env');
        console.log('\nCara mendapatkan token:');
        console.log('1. Buka Telegram, cari @BotFather');
        console.log('2. Kirim /newbot');
        console.log('3. Ikuti instruksi untuk membuat bot baru');
        console.log('4. Copy token yang diberikan ke file .env');
        console.log('   Contoh: TELEGRAM_BOT_TOKEN=123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11');
        return;
    }
    
    if (!chatId) {
        console.log('\n⚠️ WARNING: TELEGRAM_CHAT_ID tidak ditemukan');
        console.log('\nCara mendapatkan Chat ID:');
        console.log('1. Buka Telegram, cari @userinfobot');
        console.log('2. Kirim /start');
        console.log('3. Bot akan memberikan Chat ID Anda');
        console.log('4. Copy Chat ID ke file .env');
        console.log('   Contoh: TELEGRAM_CHAT_ID=123456789');
    }
    
    console.log('\n' + '='.repeat(50));
    
    try {
        // Test 1: Get bot info
        console.log('\n1. Testing Bot Information...');
        const botInfo = await axios.get(`https://api.telegram.org/bot${botToken}/getMe`, {
            timeout: 5000
        });
        console.log('   ✓ Bot Name:', botInfo.data.result.first_name);
        console.log('   ✓ Username:', botInfo.data.result.username);
        console.log('   ✓ Bot ID:', botInfo.data.result.id);
        
        // Test 2: Get updates (to see available chats)
        console.log('\n2. Checking available chats...');
        const updates = await axios.get(`https://api.telegram.org/bot${botToken}/getUpdates`, {
            timeout: 5000
        });
        
        console.log('   ✓ Total updates:', updates.data.result.length);
        
        if (updates.data.result.length > 0) {
            console.log('\n   Available Chat IDs:');
            updates.data.result.forEach((update, index) => {
                const chat = update.message?.chat || update.channel_post?.chat;
                if (chat) {
                    console.log(`   ${index + 1}. ${chat.title || chat.first_name || 'Unknown'} - ID: ${chat.id} (@${chat.username || 'no-username'})`);
                }
            });
        } else {
            console.log('   ℹ️  Tidak ada chat yang ditemukan. Kirim pesan ke bot terlebih dahulu.');
        }
        
        // Test 3: Send test message
        console.log('\n3. Sending test message...');
        if (chatId) {
            try {
                const testMsg = await axios.post(
                    `https://api.telegram.org/bot${botToken}/sendMessage`,
                    {
                        chat_id: chatId,
                        text: '✅ Bot Telegram berhasil terhubung!\n\nIni adalah pesan test dari Task Bot Dashboard.',
                        parse_mode: 'HTML'
                    },
                    { timeout: 5000 }
                );
                console.log('   ✓ Test message sent successfully!');
                console.log('   ✓ Message ID:', testMsg.data.result.message_id);
            } catch (sendError) {
                console.log('   ❌ Failed to send message:', sendError.response?.data?.description || sendError.message);
                
                if (sendError.response?.data?.description?.includes('chat not found')) {
                    console.log('\n   💡 TIPS: Kirim pesan "/start" ke bot Anda di Telegram, lalu coba lagi.');
                }
            }
        } else {
            console.log('   ⚠️  Skipping send test (no CHAT_ID)');
        }
        
        console.log('\n' + '='.repeat(50));
        console.log('\n✅ Testing completed!');
        console.log('\nNext steps:');
        console.log('1. Pastikan bot sudah ditambahkan ke chat/grup yang dituju');
        console.log('2. Kirim pesan ke bot (biasanya "/start")');
        console.log('3. Jalankan server dengan: npm start');
        console.log('4. Buka http://localhost:3002 di browser');
        
    } catch (error) {
        console.log('\n❌ ERROR:', error.message);
        
        if (error.code === 'ENOTFOUND') {
            console.log('   🔧 Check your internet connection');
        } else if (error.response) {
            console.log('   🔧 Status:', error.response.status);
            console.log('   🔧 Error:', error.response.data.description);
            
            if (error.response.data.error_code === 404) {
                console.log('\n   💡 SOLUSI: Token bot salah atau bot tidak ditemukan');
            } else if (error.response.data.error_code === 401) {
                console.log('\n   💡 SOLUSI: Token bot tidak valid');
            }
        }
    }
}

testBot();

.

.env : 
# Server Configuration
PORT=3002
NODE_ENV=development

# Database Configuration
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=task_bot_db

# Telegram Configuration
TELEGRAM_BOT_TOKEN=7650265840:AAFAFKwsl8OVe-Vv65afxVBGh6546546NWsFg
TELEGRAM_CHAT_ID=1425168430780

# Upload Configuration
MAX_FILE_SIZE=20
UPLOAD_DIR=uploads

.

public/index.html : <!DOCTYPE html>
<html lang="id" class="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Task Bot Dashboard | Kirim Task ke Telegram</title>
    <link rel="stylesheet" href="style.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <link rel="icon" type="image/x-icon" href="https://cdn-icons-png.flaticon.com/512/2111/2111646.png">
</head>
<body>
    <div class="theme-toggle">
        <button id="themeBtn">
            <i class="fas fa-moon"></i>
            <i class="fas fa-sun"></i>
        </button>
    </div>

    <div class="container">
        <!-- Header -->
        <header class="dashboard-header">
            <div class="header-content">
                <div class="logo">
                    <i class="fas fa-rocket"></i>
                    <h1>Task<span>Bot</span> Dashboard</h1>
                </div>
                <p class="tagline">Kelola & kirim tugas ke Telegram dengan satu klik</p>
            </div>
            <div class="header-actions">
                <button class="btn-test-telegram" onclick="testTelegram()">
                    <i class="fab fa-telegram"></i> Test Bot
                </button>
            </div>
        </header>

        <!-- Stats Cards -->
        <div class="stats-container">
            <div class="stat-card">
                <div class="stat-icon">
                    <i class="fas fa-tasks"></i>
                </div>
                <div class="stat-info">
                    <h3>Total Tasks</h3>
                    <div class="stat-number" id="total-tasks">0</div>
                </div>
                <div class="stat-trend">
                    <i class="fas fa-chart-line"></i>
                </div>
            </div>

            <div class="stat-card">
                <div class="stat-icon pending">
                    <i class="fas fa-clock"></i>
                </div>
                <div class="stat-info">
                    <h3>Pending</h3>
                    <div class="stat-number" id="pending-tasks">0</div>
                </div>
                <div class="stat-trend">
                    <i class="fas fa-pause-circle"></i>
                </div>
            </div>

            <div class="stat-card">
                <div class="stat-icon in-progress">
                    <i class="fas fa-sync-alt"></i>
                </div>
                <div class="stat-info">
                    <h3>In Progress</h3>
                    <div class="stat-number" id="inprogress-tasks">0</div>
                </div>
                <div class="stat-trend">
                    <i class="fas fa-spinner"></i>
                </div>
            </div>

            <div class="stat-card">
                <div class="stat-icon completed">
                    <i class="fas fa-check-circle"></i>
                </div>
                <div class="stat-info">
                    <h3>Completed</h3>
                    <div class="stat-number" id="completed-tasks">0</div>
                </div>
                <div class="stat-trend">
                    <i class="fas fa-check"></i>
                </div>
            </div>
        </div>

        <!-- Main Content -->
        <div class="main-content">
            <!-- Form Panel -->
            <div class="form-panel glassmorphism">
                <div class="panel-header">
                    <h2><i class="fas fa-plus-circle"></i> Buat Task Baru</h2>
                    <div class="panel-subtitle">Isi form dan kirim langsung ke Telegram</div>
                </div>

                <form id="taskForm" class="task-form">
                    <div class="form-group">
                        <label for="title">
                            <i class="fas fa-heading"></i> Judul Task
                            <span class="required">*</span>
                        </label>
                        <input type="text" id="title" name="title" required 
                               placeholder="Contoh: Fix Bug Login Page">
                    </div>

                    <div class="form-group">
                        <label for="description">
                            <i class="fas fa-align-left"></i> Deskripsi Detail
                            <span class="required">*</span>
                        </label>
                        <textarea id="description" name="description" required 
                                  placeholder="Jelaskan task secara detail..."></textarea>
                        <div class="char-count">0/500</div>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label for="assignee">
                                <i class="fas fa-user-tag"></i> Assignee
                                <span class="required">*</span>
                            </label>
                            <input type="text" id="assignee" name="assignee" required 
                                   placeholder="@username atau chat_id">
                        </div>

                        <div class="form-group">
                            <label for="telegram_chat_id">
                                <i class="fab fa-telegram"></i> Chat ID
                            </label>
                            <input type="text" id="telegram_chat_id" name="telegram_chat_id" 
                                   placeholder="Opsional, default dari .env">
                        </div>
                    </div>

                    <div class="form-group">
                        <label for="file">
                            <i class="fas fa-paperclip"></i> Lampirkan File
                        </label>
                        <div class="file-upload-area" id="fileDropZone">
                            <i class="fas fa-cloud-upload-alt"></i>
                            <div class="upload-text">
                                <span class="drag-text">Drag & drop file di sini</span>
                                <span class="browse-text">atau <span class="browse-link">browse</span></span>
                            </div>
                            <input type="file" id="file" name="file" class="file-input">
                            <div class="file-info" id="fileInfo">Maksimal 20MB • All file types</div>
                        </div>
                        <div class="file-preview" id="filePreview"></div>
                    </div>

                    <button type="submit" class="submit-btn">
                        <i class="fas fa-paper-plane"></i>
                        <span class="btn-text">Kirim ke Telegram</span>
                        <div class="btn-loader" id="submitLoader">
                            <div class="loader-dot"></div>
                            <div class="loader-dot"></div>
                            <div class="loader-dot"></div>
                        </div>
                    </button>
                </form>
            </div>

            <!-- Tasks Panel -->
            <div class="tasks-panel glassmorphism">
                <div class="panel-header">
                    <h2><i class="fas fa-list-check"></i> Daftar Tasks</h2>
                    <div class="panel-actions">
                        <div class="search-box">
                            <i class="fas fa-search"></i>
                            <input type="text" id="taskSearch" placeholder="Cari task...">
                        </div>
                        <div class="filter-buttons">
                            <button class="filter-btn active" onclick="filterTasks('all')">All</button>
                            <button class="filter-btn" onclick="filterTasks('pending')">Pending</button>
                            <button class="filter-btn" onclick="filterTasks('in_progress')">Progress</button>
                            <button class="filter-btn" onclick="filterTasks('completed')">Done</button>
                        </div>
                    </div>
                </div>

                <div class="tasks-list" id="taskList">
                    <div class="loading-state">
                        <div class="loading-spinner"></div>
                        <p>Memuat tasks...</p>
                    </div>
                </div>
            </div>
        </div>

        <!-- Footer -->
        <footer class="dashboard-footer">
            <p>TaskBot Dashboard v1.0 • <span id="currentYear"></span></p>
            <div class="footer-links">
                <a href="#" onclick="refreshAll()"><i class="fas fa-sync-alt"></i> Refresh</a>
                <a href="#" onclick="exportTasks()"><i class="fas fa-download"></i> Export</a>
                <a href="https://t.me" target="_blank"><i class="fab fa-telegram"></i> Telegram Web</a>
            </div>
        </footer>
    </div>

    <!-- Notification Container -->
    <div id="notificationContainer"></div>

    <!-- Modal for Task Details -->
    <div id="taskModal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h3 id="modalTitle"></h3>
                <button class="modal-close" onclick="closeModal()">&times;</button>
            </div>
            <div class="modal-body" id="modalBody"></div>
        </div>
    </div>

    <script src="script.js"></script>
</body>
</html>

.

public/script.js : // State Management
let currentFilter = 'all';
let currentSearch = '';
let tasks = [];
let selectedFile = null;

// DOM Elements
const taskForm = document.getElementById('taskForm');
const taskList = document.getElementById('taskList');
const fileDropZone = document.getElementById('fileDropZone');
const fileInput = document.getElementById('file');
const filePreview = document.getElementById('filePreview');
const descriptionTextarea = document.getElementById('description');
const charCount = document.querySelector('.char-count');
const submitBtn = document.querySelector('.submit-btn');
const submitLoader = document.getElementById('submitLoader');
const taskSearch = document.getElementById('taskSearch');
const themeBtn = document.getElementById('themeBtn');

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    // Set current year in footer
    document.getElementById('currentYear').textContent = new Date().getFullYear();
    
    // Initialize event listeners
    initEventListeners();
    
    // Load initial data
    loadTasks();
    loadStats();
    
    // Set up auto-refresh
    setInterval(() => {
        loadTasks();
        loadStats();
    }, 30000);
    
    // Show welcome notification
    setTimeout(() => {
        showNotification('🎉 Selamat datang di Task Bot Dashboard!', 'info');
    }, 1000);
});

// Initialize Event Listeners
function initEventListeners() {
    // Form submission
    taskForm.addEventListener('submit', handleFormSubmit);
    
    // File upload handling
    fileInput.addEventListener('change', handleFileSelect);
    fileDropZone.addEventListener('click', (e) => {
        if (e.target.classList.contains('browse-link')) {
            fileInput.click();
        }
    });
    
    // Drag and drop for files
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        fileDropZone.addEventListener(eventName, preventDefaults, false);
    });
    
    ['dragenter', 'dragover'].forEach(eventName => {
        fileDropZone.addEventListener(eventName, highlight, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        fileDropZone.addEventListener(eventName, unhighlight, false);
    });
    
    fileDropZone.addEventListener('drop', handleDrop, false);
    
    // Character counter for description
    descriptionTextarea.addEventListener('input', updateCharCount);
    
    // Real-time search
    taskSearch.addEventListener('input', debounce(() => {
        currentSearch = taskSearch.value.toLowerCase();
        displayTasks(tasks);
    }, 300));
    
    // Theme toggle
    themeBtn.addEventListener('click', toggleTheme);
    
    // Close modal on ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
    });
    
    // Prevent form submission on Enter in inputs
    document.querySelectorAll('input, textarea').forEach(input => {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
                e.preventDefault();
            }
        });
    });
}

// Form Submission Handler
async function handleFormSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(taskForm);
    const title = formData.get('title');
    const description = formData.get('description');
    const assignee = formData.get('assignee');
    
    // Validation
    if (!title || !description || !assignee) {
        showNotification('❌ Semua field wajib diisi!', 'error');
        
        // Highlight empty fields
        document.querySelectorAll('input[required], textarea[required]').forEach(input => {
            if (!input.value.trim()) {
                input.style.borderColor = 'var(--danger-color)';
                setTimeout(() => {
                    input.style.borderColor = '';
                }, 2000);
            }
        });
        
        return;
    }
    
    // Validate description length
    if (description.length > 500) {
        showNotification('❌ Deskripsi maksimal 500 karakter!', 'error');
        return;
    }
    
    // Show loading state
    submitBtn.classList.add('loading');
    
    try {
        // Add file to form data if exists
        if (selectedFile) {
            formData.set('file', selectedFile);
        }
        
        const response = await fetch('/api/tasks', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showNotification('✅ Task berhasil dibuat dan dikirim ke Telegram!', 'success');
            
            // Reset form
            taskForm.reset();
            clearFilePreview();
            updateCharCount();
            selectedFile = null;
            
            // Add success animation
            submitBtn.classList.remove('loading');
            submitBtn.innerHTML = '<i class="fas fa-check"></i><span class="btn-text">Berhasil!</span>';
            submitBtn.style.background = 'var(--success-gradient)';
            
            setTimeout(() => {
                submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i><span class="btn-text">Kirim ke Telegram</span>';
                submitBtn.style.background = '';
            }, 2000);
            
            // Reload data
            loadTasks();
            loadStats();
        } else {
            throw new Error(result.error || result.details || 'Gagal membuat task');
        }
    } catch (error) {
        console.error('Error:', error);
        showNotification(`❌ ${error.message}`, 'error');
        submitBtn.classList.remove('loading');
    }
}

// File Handling Functions
function handleFileSelect(e) {
    const files = e.target.files;
    if (files.length > 0) {
        handleFiles(files);
    }
}

function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    handleFiles(files);
}

function handleFiles(files) {
    if (files.length > 1) {
        showNotification('❌ Hanya bisa upload satu file sekaligus', 'error');
        return;
    }
    
    const file = files[0];
    
    // Validate file size
    if (file.size > 20 * 1024 * 1024) {
        showNotification(`❌ File terlalu besar (max 20MB)`, 'error');
        return;
    }
    
    // Validate file type
    const allowedTypes = [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/zip',
        'text/plain'
    ];
    
    if (!allowedTypes.includes(file.type)) {
        showNotification('⚠️ Tipe file mungkin tidak didukung', 'warning');
    }
    
    selectedFile = file;
    previewFile(file);
}

function previewFile(file) {
    clearFilePreview();
    
    const fileItem = document.createElement('div');
    fileItem.className = 'file-preview-item';
    
    const fileSize = formatFileSize(file.size);
    const fileType = getFileTypeIcon(file.name);
    
    fileItem.innerHTML = `
        ${fileType}
        <div class="file-preview-name" title="${file.name}">
            ${truncateFileName(file.name, 25)}
        </div>
        <div class="file-preview-size">${fileSize}</div>
        <button class="file-preview-remove" onclick="removeFile(this)">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    filePreview.appendChild(fileItem);
    filePreview.classList.add('active');
    
    // Show success notification
    showNotification(`📎 File "${truncateFileName(file.name, 20)}" siap diupload`, 'info');
}

function clearFilePreview() {
    filePreview.innerHTML = '';
    filePreview.classList.remove('active');
    fileInput.value = '';
}

function removeFile(button) {
    const fileName = button.parentElement.querySelector('.file-preview-name').title;
    showNotification(`🗑️ File "${truncateFileName(fileName, 20)}" dihapus`, 'info');
    
    button.closest('.file-preview-item').remove();
    selectedFile = null;
    
    if (filePreview.children.length === 0) {
        filePreview.classList.remove('active');
    }
}

// Utility Functions
function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

function highlight() {
    fileDropZone.classList.add('dragover');
    fileDropZone.querySelector('i').style.color = 'var(--accent-color)';
}

function unhighlight() {
    fileDropZone.classList.remove('dragover');
    fileDropZone.querySelector('i').style.color = '';
}

function updateCharCount() {
    const count = descriptionTextarea.value.length;
    charCount.textContent = `${count}/500`;
    
    if (count > 500) {
        charCount.style.color = 'var(--danger-color)';
        descriptionTextarea.style.borderColor = 'var(--danger-color)';
    } else if (count > 400) {
        charCount.style.color = 'var(--warning-color)';
        descriptionTextarea.style.borderColor = '';
    } else {
        charCount.style.color = 'var(--text-muted)';
        descriptionTextarea.style.borderColor = '';
    }
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getFileTypeIcon(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const iconMap = {
        // Images
        'jpg': 'fas fa-file-image',
        'jpeg': 'fas fa-file-image',
        'png': 'fas fa-file-image',
        'gif': 'fas fa-file-image',
        'webp': 'fas fa-file-image',
        'svg': 'fas fa-file-image',
        
        // Documents
        'pdf': 'fas fa-file-pdf',
        'doc': 'fas fa-file-word',
        'docx': 'fas fa-file-word',
        'xls': 'fas fa-file-excel',
        'xlsx': 'fas fa-file-excel',
        'ppt': 'fas fa-file-powerpoint',
        'pptx': 'fas fa-file-powerpoint',
        'txt': 'fas fa-file-alt',
        'csv': 'fas fa-file-csv',
        
        // Archives
        'zip': 'fas fa-file-archive',
        'rar': 'fas fa-file-archive',
        '7z': 'fas fa-file-archive',
        'tar': 'fas fa-file-archive',
        'gz': 'fas fa-file-archive',
        
        // Media
        'mp3': 'fas fa-file-audio',
        'wav': 'fas fa-file-audio',
        'mp4': 'fas fa-file-video',
        'avi': 'fas fa-file-video',
        'mov': 'fas fa-file-video',
        
        // Code
        'js': 'fas fa-file-code',
        'html': 'fas fa-file-code',
        'css': 'fas fa-file-code',
        'json': 'fas fa-file-code',
        'xml': 'fas fa-file-code',
        
        // Default
        'default': 'fas fa-file'
    };
    
    const iconClass = iconMap[ext] || iconMap['default'];
    return `<i class="${iconClass}"></i>`;
}

function truncateFileName(name, maxLength) {
    if (name.length <= maxLength) return name;
    const extension = name.split('.').pop();
    const nameWithoutExt = name.slice(0, -(extension.length + 1));
    const truncatedName = nameWithoutExt.slice(0, maxLength - extension.length - 4);
    return `${truncatedName}... .${extension}`;
}

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

// Task Management Functions
async function loadTasks() {
    try {
        taskList.innerHTML = `
            <div class="loading-state">
                <div class="loading-spinner"></div>
                <p>Memuat tasks...</p>
            </div>
        `;
        
        const response = await fetch('/api/tasks');
        tasks = await response.json();
        displayTasks(tasks);
    } catch (error) {
        console.error('Error loading tasks:', error);
        taskList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-circle"></i>
                <p>Gagal memuat tasks. Silakan refresh halaman.</p>
                <button onclick="loadTasks()" style="margin-top: 16px; padding: 8px 16px; background: var(--primary-color); color: white; border: none; border-radius: var(--radius-md); cursor: pointer;">
                    Coba Lagi
                </button>
            </div>
        `;
    }
}

function displayTasks(taskArray) {
    if (taskArray.length === 0) {
        taskList.innerHTML = `
            <div class="empty-state fade-in">
                <i class="fas fa-tasks"></i>
                <p>Belum ada tasks. Buat task pertama Anda!</p>
            </div>
        `;
        return;
    }
    
    // Apply filters and search
    let filteredTasks = taskArray;
    
    if (currentFilter !== 'all') {
        filteredTasks = filteredTasks.filter(task => task.status === currentFilter);
    }
    
    if (currentSearch) {
        filteredTasks = filteredTasks.filter(task => 
            task.title.toLowerCase().includes(currentSearch) ||
            task.description.toLowerCase().includes(currentSearch) ||
            task.assignee.toLowerCase().includes(currentSearch) ||
            (task.status && task.status.toLowerCase().includes(currentSearch))
        );
    }
    
    // Sort by date (newest first)
    filteredTasks.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    taskList.innerHTML = filteredTasks.map((task, index) => `
        <div class="task-item ${task.status} fade-in" style="animation-delay: ${index * 50}ms" onclick="showTaskDetails(${task.id})">
            <div class="task-header">
                <div class="task-title">${escapeHtml(task.title)}</div>
                <div class="task-meta">
                    <span class="task-assignee">
                        <i class="fas fa-user"></i> ${escapeHtml(task.assignee)}
                    </span>
                    <span class="task-date">
                        <i class="far fa-calendar"></i> ${formatDate(task.created_at_formatted || task.created_at)}
                    </span>
                </div>
            </div>
            
            <div class="task-description">
                ${escapeHtml(task.description.length > 150 ? task.description.substring(0, 150) + '...' : task.description)}
            </div>
            
            ${task.file_path ? `
                <a href="${task.file_url || `/uploads/${path.basename(task.file_path)}`}" 
                   target="_blank" 
                   class="file-attachment" 
                   onclick="event.stopPropagation()"
                   download="${path.basename(task.file_path)}">
                    <i class="fas fa-paperclip"></i> 
                    ${escapeHtml(path.basename(task.file_path))}
                </a>
            ` : ''}
            
            <div class="task-footer">
                <div class="task-status status-${task.status}">
                    <i class="fas ${getStatusIcon(task.status)}"></i>
                    ${getStatusText(task.status)}
                </div>
                
                <div class="task-actions" onclick="event.stopPropagation()">
                    <select class="action-btn btn-status" onchange="updateStatus(${task.id}, this.value)" title="Ubah Status">
                        <option value="pending" ${task.status === 'pending' ? 'selected' : ''}>Pending</option>
                        <option value="in_progress" ${task.status === 'in_progress' ? 'selected' : ''}>In Progress</option>
                        <option value="completed" ${task.status === 'completed' ? 'selected' : ''}>Completed</option>
                    </select>
                    
                    ${task.file_path ? `
                        <button class="action-btn btn-download" onclick="downloadFile('${task.file_path}', event)" title="Download File">
                            <i class="fas fa-download"></i>
                        </button>
                    ` : ''}
                    
                    <button class="action-btn btn-delete" onclick="deleteTask(${task.id}, event)" title="Hapus Task">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

function getStatusIcon(status) {
    const icons = {
        'pending': 'fa-clock',
        'in_progress': 'fa-sync-alt',
        'completed': 'fa-check-circle'
    };
    return icons[status] || 'fa-question-circle';
}

async function loadStats() {
    try {
        const response = await fetch('/api/stats');
        const stats = await response.json();
        
        document.getElementById('total-tasks').textContent = stats.total;
        document.getElementById('pending-tasks').textContent = stats.pending;
        document.getElementById('inprogress-tasks').textContent = stats.in_progress;
        document.getElementById('completed-tasks').textContent = stats.completed;
        
        // Add animation to stats
        animateCounter('total-tasks', stats.total);
        animateCounter('pending-tasks', stats.pending);
        animateCounter('inprogress-tasks', stats.in_progress);
        animateCounter('completed-tasks', stats.completed);
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

function animateCounter(elementId, targetValue) {
    const element = document.getElementById(elementId);
    const currentValue = parseInt(element.textContent) || 0;
    
    if (currentValue === targetValue) return;
    
    const duration = 1000; // 1 second
    const step = (targetValue - currentValue) / (duration / 16);
    let current = currentValue;
    
    const timer = setInterval(() => {
        current += step;
        
        if ((step > 0 && current >= targetValue) || (step < 0 && current <= targetValue)) {
            clearInterval(timer);
            current = targetValue;
        }
        
        element.textContent = Math.round(current);
    }, 16);
}

async function updateStatus(taskId, status) {
    try {
        const response = await fetch(`/api/tasks/${taskId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status })
        });
        
        if (response.ok) {
            showNotification(`✅ Status diubah ke ${getStatusText(status)}`, 'success');
            
            // Update task in local array
            const taskIndex = tasks.findIndex(t => t.id === taskId);
            if (taskIndex !== -1) {
                tasks[taskIndex].status = status;
            }
            
            displayTasks(tasks);
            loadStats();
        } else {
            throw new Error('Gagal update status');
        }
    } catch (error) {
        console.error('Error updating status:', error);
        showNotification('❌ Gagal update status', 'error');
    }
}

async function deleteTask(taskId, event) {
    if (event) event.stopPropagation();
    
    if (!confirm('Apakah Anda yakin ingin menghapus task ini?')) return;
    
    try {
        showNotification('🔄 Menghapus task...', 'info');
        
        const response = await fetch(`/api/tasks/${taskId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showNotification('✅ Task berhasil dihapus!', 'success');
            
            // Remove task from local array
            tasks = tasks.filter(t => t.id !== taskId);
            
            displayTasks(tasks);
            loadStats();
        } else {
            throw new Error('Gagal menghapus task');
        }
    } catch (error) {
        console.error('Error deleting task:', error);
        showNotification('❌ Gagal menghapus task', 'error');
    }
}

function filterTasks(filter) {
    if (currentFilter === filter) return;
    
    currentFilter = filter;
    
    // Update active button
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Show loading animation
    taskList.style.opacity = '0.5';
    
    setTimeout(() => {
        displayTasks(tasks);
        taskList.style.opacity = '1';
        
        // Show notification
        if (filter === 'all') {
            showNotification('📋 Menampilkan semua tasks', 'info');
        } else {
            showNotification(`📋 Menampilkan tasks dengan status: ${getStatusText(filter)}`, 'info');
        }
    }, 300);
}

async function showTaskDetails(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
    const modal = document.getElementById('taskModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    
    modalTitle.textContent = task.title;
    
    // Add loading state
    modalBody.innerHTML = `
        <div style="text-align: center; padding: 40px;">
            <div class="loading-spinner"></div>
            <p style="margin-top: 16px; color: var(--text-secondary);">Memuat detail task...</p>
        </div>
    `;
    
    modal.classList.add('active');
    
    // Load full details
    setTimeout(() => {
        modalBody.innerHTML = `
            <div class="task-detail">
                <div class="detail-section">
                    <h4><i class="fas fa-user-tag"></i> Assignee</h4>
                    <p style="font-size: 1.1rem; font-weight: 600; color: var(--primary-color);">${escapeHtml(task.assignee)}</p>
                </div>
                
                <div class="detail-section">
                    <h4><i class="fas fa-align-left"></i> Deskripsi</h4>
                    <p style="white-space: pre-wrap; background: var(--bg-hover); padding: 16px; border-radius: var(--radius-md);">${escapeHtml(task.description)}</p>
                </div>
                
                <div class="detail-section">
                    <h4><i class="fas fa-info-circle"></i> Status & Informasi</h4>
                    <div style="display: flex; gap: 16px; flex-wrap: wrap; align-items: center;">
                        <span class="task-status status-${task.status}" style="font-size: 1rem;">
                            <i class="fas ${getStatusIcon(task.status)}"></i>
                            ${getStatusText(task.status)}
                        </span>
                        <div style="color: var(--text-secondary); font-size: 0.9rem;">
                            <div><i class="far fa-calendar"></i> Dibuat: ${formatDate(task.created_at_formatted || task.created_at)}</div>
                            ${task.updated_at !== task.created_at ? 
                                `<div><i class="fas fa-history"></i> Diupdate: ${formatDate(task.updated_at)}</div>` : 
                                ''}
                        </div>
                    </div>
                </div>
                
                ${task.file_path ? `
                    <div class="detail-section">
                        <h4><i class="fas fa-paperclip"></i> File Lampiran</h4>
                        <div style="display: flex; align-items: center; gap: 16px; flex-wrap: wrap;">
                            <a href="${task.file_url || `/uploads/${path.basename(task.file_path)}`}" 
                               target="_blank" 
                               class="file-attachment"
                               style="flex: 1;"
                               download="${path.basename(task.file_path)}">
                                <i class="fas fa-download"></i> 
                                Download ${escapeHtml(path.basename(task.file_path))}
                            </a>
                            <button onclick="copyFileLink('${task.file_url || `/uploads/${path.basename(task.file_path)}`}')" 
                                    style="padding: 10px 16px; background: var(--bg-hover); border: 1px solid var(--border-color); border-radius: var(--radius-md); color: var(--text-primary); cursor: pointer;">
                                <i class="fas fa-copy"></i> Copy Link
                            </button>
                        </div>
                    </div>
                ` : ''}
                
                <div class="detail-section" style="border-top: 1px solid var(--border-color); padding-top: 20px; margin-top: 20px;">
                    <h4><i class="fas fa-cog"></i> Aksi</h4>
                    <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                        <button onclick="updateStatus(${task.id}, 'in_progress')" 
                                style="padding: 10px 20px; background: var(--primary-color); color: white; border: none; border-radius: var(--radius-md); cursor: pointer; font-weight: 600;">
                            <i class="fas fa-play"></i> Mulai Kerjakan
                        </button>
                        <button onclick="updateStatus(${task.id}, 'completed')" 
                                style="padding: 10px 20px; background: var(--accent-color); color: white; border: none; border-radius: var(--radius-md); cursor: pointer; font-weight: 600;">
                            <i class="fas fa-check"></i> Tandai Selesai
                        </button>
                        <button onclick="deleteTask(${task.id})" 
                                style="padding: 10px 20px; background: var(--danger-color); color: white; border: none; border-radius: var(--radius-md); cursor: pointer; font-weight: 600;">
                            <i class="fas fa-trash"></i> Hapus Task
                        </button>
                    </div>
                </div>
            </div>
        `;
    }, 500);
}

function closeModal() {
    document.getElementById('taskModal').classList.remove('active');
}

function downloadFile(filePath, event) {
    if (event) event.stopPropagation();
    
    const fileName = filePath.split('/').pop();
    const downloadUrl = `/api/download/${fileName}`;
    
    // Create temporary link
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showNotification(`📥 Mengunduh "${fileName}"...`, 'info');
}

function copyFileLink(url) {
    navigator.clipboard.writeText(window.location.origin + url)
        .then(() => {
            showNotification('✅ Link file disalin ke clipboard!', 'success');
        })
        .catch(err => {
            console.error('Failed to copy:', err);
            showNotification('❌ Gagal menyalin link', 'error');
        });
}

// Helper Functions
function getStatusText(status) {
    const statusMap = {
        'pending': 'Pending',
        'in_progress': 'In Progress',
        'completed': 'Completed'
    };
    return statusMap[status] || status;
}

function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
        return '-';
    }
    
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    // If less than 1 hour ago
    if (diffMins < 60) {
        return `${diffMins} menit yang lalu`;
    }
    
    // If less than 24 hours ago
    if (diffHours < 24) {
        return `${diffHours} jam yang lalu`;
    }
    
    // If less than 7 days ago
    if (diffDays < 7) {
        return `${diffDays} hari yang lalu`;
    }
    
    // Otherwise return full date
    return date.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Telegram Test Function
async function testTelegram() {
    try {
        showNotification('🔄 Menguji koneksi ke Telegram...', 'info');
        
        const response = await fetch('/api/test-telegram');
        const result = await response.json();
        
        if (result.success) {
            showNotification('✅ Bot Telegram terhubung dengan baik!', 'success');
        } else {
            throw new Error(result.error || 'Test gagal');
        }
    } catch (error) {
        console.error('Telegram test error:', error);
        showNotification(`❌ ${error.message}`, 'error');
    }
}

// Notification System
function showNotification(message, type = 'info') {
    const container = document.getElementById('notificationContainer');
    
    // Remove existing notifications
    container.querySelectorAll('.notification').forEach(notification => {
        notification.classList.add('fade-out');
        setTimeout(() => notification.remove(), 300);
    });
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    const icon = type === 'success' ? '✅' : 
                 type === 'error' ? '❌' : 
                 type === 'warning' ? '⚠️' : 'ℹ️';
    
    notification.innerHTML = `
        <span>${icon} ${message}</span>
        <button onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    container.appendChild(notification);
    
    // Auto remove after 5 seconds
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

// Theme Management
function toggleTheme() {
    const isDark = document.body.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    
    // Add animation
    themeBtn.style.transform = 'rotate(180deg) scale(1.1)';
    setTimeout(() => {
        themeBtn.style.transform = '';
    }, 300);
    
    showNotification(isDark ? '🌙 Mode gelap diaktifkan' : '☀️ Mode terang diaktifkan', 'info');
}

function loadTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    if (savedTheme === 'dark') {
        document.body.classList.add('dark');
    }
}

// Utility Functions
function refreshAll() {
    loadTasks();
    loadStats();
    showNotification('🔄 Data diperbarui!', 'info');
    
    // Add refresh animation
    document.querySelector('.dashboard-header').style.transform = 'scale(0.98)';
    setTimeout(() => {
        document.querySelector('.dashboard-header').style.transform = '';
    }, 300);
}

function exportTasks() {
    if (tasks.length === 0) {
        showNotification('❌ Tidak ada data untuk diexport', 'error');
        return;
    }
    
    const csvContent = "data:text/csv;charset=utf-8," 
        + ["ID,Title,Description,Assignee,Status,File,Created At"].join(",") + "\n"
        + tasks.map(task => 
            `${task.id},"${task.title.replace(/"/g, '""')}","${task.description.replace(/"/g, '""')}","${task.assignee}","${getStatusText(task.status)}","${task.file_path || ''}","${task.created_at}"`
        ).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `tasks_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showNotification('📥 Data berhasil diexport ke CSV!', 'success');
}

// Path utility for browser
const path = {
    basename: (filePath) => {
        return filePath.split('/').pop().split('\\').pop();
    }
};

// Initialize theme on load
loadTheme();

// Add keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + N untuk form baru
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        document.getElementById('title').focus();
    }
    
    // Ctrl/Cmd + F untuk search
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        document.getElementById('taskSearch').focus();
    }
    
    // Ctrl/Cmd + R untuk refresh
    if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
        e.preventDefault();
        refreshAll();
    }
});

// Add service worker for PWA (optional)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(error => {
            console.log('Service Worker registration failed:', error);
        });
    });
}

.

public/style.css : /* Reset & Base Styles */
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

:root {
    /* Light Theme */
    --primary-gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    --secondary-gradient: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
    --success-gradient: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
    --warning-gradient: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
    
    --primary-color: #667eea;
    --primary-dark: #5a67d8;
    --secondary-color: #764ba2;
    --accent-color: #10b981;
    --danger-color: #ef4444;
    --warning-color: #f59e0b;
    
    --bg-primary: #f8fafc;
    --bg-secondary: #ffffff;
    --bg-card: #ffffff;
    --bg-hover: #f1f5f9;
    --bg-input: #f8fafc;
    
    --text-primary: #1e293b;
    --text-secondary: #64748b;
    --text-muted: #94a3b8;
    --text-light: #cbd5e1;
    
    --border-color: #e2e8f0;
    --border-light: #f1f5f9;
    
    --shadow-sm: 0 2px 4px rgba(0, 0, 0, 0.05);
    --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
    --shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
    --shadow-xxl: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    
    --radius-sm: 8px;
    --radius-md: 12px;
    --radius-lg: 16px;
    --radius-xl: 20px;
    --radius-full: 9999px;
    
    --transition-fast: 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    --transition-normal: 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    --transition-slow: 0.5s cubic-bezier(0.4, 0, 0.2, 1);
    
    --glass-bg: rgba(255, 255, 255, 0.7);
    --glass-border: rgba(255, 255, 255, 0.2);
}

.dark {
    /* Dark Theme */
    --primary-gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    --secondary-gradient: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
    --success-gradient: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
    --warning-gradient: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
    
    --primary-color: #818cf8;
    --primary-dark: #6366f1;
    --secondary-color: #a78bfa;
    --accent-color: #34d399;
    --danger-color: #f87171;
    --warning-color: #fbbf24;
    
    --bg-primary: #0f172a;
    --bg-secondary: #1e293b;
    --bg-card: #1e293b;
    --bg-hover: #334155;
    --bg-input: #0f172a;
    
    --text-primary: #f1f5f9;
    --text-secondary: #cbd5e1;
    --text-muted: #94a3b8;
    --text-light: #64748b;
    
    --border-color: #334155;
    --border-light: #1e293b;
    
    --shadow-sm: 0 2px 4px rgba(0, 0, 0, 0.3);
    --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.4);
    --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.5);
    --shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.6);
    --shadow-xxl: 0 25px 50px -12px rgba(0, 0, 0, 0.8);
    
    --glass-bg: rgba(30, 41, 59, 0.7);
    --glass-border: rgba(255, 255, 255, 0.1);
}

body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: var(--bg-primary);
    color: var(--text-primary);
    min-height: 100vh;
    line-height: 1.6;
    transition: background-color var(--transition-normal), color var(--transition-normal);
    overflow-x: hidden;
}

body::before {
    content: '';
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: 
        radial-gradient(circle at 20% 80%, rgba(102, 126, 234, 0.1) 0%, transparent 50%),
        radial-gradient(circle at 80% 20%, rgba(118, 75, 162, 0.1) 0%, transparent 50%);
    z-index: -1;
    pointer-events: none;
}

/* Scrollbar Styling */
::-webkit-scrollbar {
    width: 10px;
}

::-webkit-scrollbar-track {
    background: var(--bg-secondary);
    border-radius: var(--radius-full);
}

::-webkit-scrollbar-thumb {
    background: var(--primary-color);
    border-radius: var(--radius-full);
}

::-webkit-scrollbar-thumb:hover {
    background: var(--primary-dark);
}

/* Theme Toggle */
.theme-toggle {
    position: fixed;
    top: 24px;
    right: 24px;
    z-index: 1000;
}

#themeBtn {
    width: 56px;
    height: 56px;
    border-radius: var(--radius-full);
    background: var(--glass-bg);
    backdrop-filter: blur(10px);
    border: 1px solid var(--glass-border);
    color: var(--text-primary);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.3rem;
    transition: all var(--transition-normal);
    box-shadow: var(--shadow-md);
    position: relative;
    overflow: hidden;
}

#themeBtn::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: var(--primary-gradient);
    opacity: 0;
    transition: opacity var(--transition-normal);
}

#themeBtn:hover::before {
    opacity: 0.1;
}

#themeBtn:hover {
    transform: rotate(15deg) scale(1.05);
    box-shadow: var(--shadow-lg);
}

#themeBtn i {
    position: relative;
    z-index: 1;
}

#themeBtn .fa-sun {
    display: none;
}

.dark #themeBtn .fa-moon {
    display: none;
}

.dark #themeBtn .fa-sun {
    display: block;
}

/* Container */
.container {
    max-width: 1400px;
    margin: 0 auto;
    padding: 24px;
    position: relative;
}

/* Header */
.dashboard-header {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 40px;
    padding: 32px;
    background: var(--glass-bg);
    backdrop-filter: blur(20px);
    border-radius: var(--radius-xl);
    border: 1px solid var(--glass-border);
    box-shadow: var(--shadow-lg);
    position: relative;
    overflow: hidden;
}

.dashboard-header::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 4px;
    background: var(--primary-gradient);
}

.logo {
    display: flex;
    align-items: center;
    gap: 16px;
    position: relative;
}

.logo-icon {
    width: 64px;
    height: 64px;
    border-radius: var(--radius-lg);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 2.5rem;
    background: var(--primary-gradient);
    color: white;
    box-shadow: var(--shadow-md);
    animation: float 3s ease-in-out infinite;
}

@keyframes float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-10px); }
}

.logo h1 {
    font-size: 2.4rem;
    font-weight: 800;
    background: var(--primary-gradient);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    letter-spacing: -0.5px;
}

.logo h1 span {
    color: var(--accent-color);
    -webkit-text-fill-color: var(--accent-color);
}

.tagline {
    color: var(--text-secondary);
    margin-top: 8px;
    font-size: 1.1rem;
    font-weight: 400;
    max-width: 400px;
}

.header-actions {
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
}

.btn-test-telegram {
    background: var(--primary-gradient);
    color: white;
    border: none;
    padding: 14px 28px;
    border-radius: var(--radius-full);
    font-weight: 600;
    font-size: 1rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 10px;
    transition: all var(--transition-normal);
    box-shadow: var(--shadow-md);
    position: relative;
    overflow: hidden;
}

.btn-test-telegram::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
    transition: left 0.5s;
}

.btn-test-telegram:hover::before {
    left: 100%;
}

.btn-test-telegram:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-lg);
}

/* Stats Container */
.stats-container {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 24px;
    margin-bottom: 48px;
}

.stat-card {
    background: var(--glass-bg);
    backdrop-filter: blur(10px);
    border-radius: var(--radius-lg);
    padding: 28px;
    display: flex;
    align-items: center;
    gap: 24px;
    border: 1px solid var(--glass-border);
    transition: all var(--transition-normal);
    box-shadow: var(--shadow-md);
    position: relative;
    overflow: hidden;
}

.stat-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: var(--primary-gradient);
    opacity: 0;
    transition: opacity var(--transition-normal);
}

.stat-card:hover::before {
    opacity: 0.05;
}

.stat-card:hover {
    transform: translateY(-8px);
    box-shadow: var(--shadow-xl);
}

.stat-icon {
    width: 72px;
    height: 72px;
    border-radius: var(--radius-lg);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 2rem;
    background: var(--bg-card);
    position: relative;
    z-index: 1;
    box-shadow: var(--shadow-sm);
}

.stat-icon i {
    background: var(--primary-gradient);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
}

.stat-icon.pending {
    background: rgba(245, 158, 11, 0.1);
}

.stat-icon.pending i {
    background: var(--warning-gradient);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
}

.stat-icon.in-progress {
    background: rgba(99, 102, 241, 0.1);
}

.stat-icon.completed {
    background: rgba(16, 185, 129, 0.1);
}

.stat-icon.completed i {
    background: var(--success-gradient);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
}

.stat-info {
    flex: 1;
    position: relative;
    z-index: 1;
}

.stat-info h3 {
    font-size: 0.9rem;
    color: var(--text-secondary);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 8px;
}

.stat-number {
    font-size: 2.8rem;
    font-weight: 800;
    color: var(--text-primary);
    line-height: 1;
    margin-bottom: 4px;
}

.stat-trend {
    margin-left: auto;
    font-size: 1.8rem;
    opacity: 0.5;
    position: relative;
    z-index: 1;
}

/* Main Content */
.main-content {
    display: grid;
    grid-template-columns: 1fr 1.5fr;
    gap: 32px;
    margin-bottom: 48px;
}

@media (max-width: 1200px) {
    .main-content {
        grid-template-columns: 1fr;
    }
}

/* Form Panel */
.form-panel {
    background: var(--glass-bg);
    backdrop-filter: blur(20px);
    border-radius: var(--radius-xl);
    padding: 32px;
    border: 1px solid var(--glass-border);
    box-shadow: var(--shadow-lg);
    position: relative;
    overflow: hidden;
}

.form-panel::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 4px;
    height: 100%;
    background: var(--primary-gradient);
}

.panel-header {
    margin-bottom: 32px;
    position: relative;
}

.panel-header h2 {
    font-size: 1.9rem;
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    gap: 12px;
    color: var(--text-primary);
}

.panel-header h2 i {
    color: var(--primary-color);
    font-size: 2rem;
}

.panel-subtitle {
    color: var(--text-secondary);
    font-size: 1rem;
    line-height: 1.6;
}

/* Form Styles */
.task-form {
    display: flex;
    flex-direction: column;
    gap: 28px;
}

.form-group {
    position: relative;
}

.form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
}

@media (max-width: 768px) {
    .form-row {
        grid-template-columns: 1fr;
    }
}

.form-group label {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 12px;
    font-weight: 600;
    color: var(--text-primary);
    font-size: 1rem;
}

.form-group label i {
    color: var(--primary-color);
    font-size: 1.1rem;
}

.required {
    color: var(--danger-color);
    margin-left: 4px;
}

.form-group input,
.form-group textarea,
.form-group select {
    width: 100%;
    padding: 16px 20px;
    background: var(--bg-input);
    border: 2px solid var(--border-color);
    border-radius: var(--radius-md);
    color: var(--text-primary);
    font-size: 1.05rem;
    transition: all var(--transition-fast);
    font-family: inherit;
}

.form-group input:focus,
.form-group textarea:focus,
.form-group select:focus {
    outline: none;
    border-color: var(--primary-color);
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    background: var(--bg-card);
}

.form-group input::placeholder,
.form-group textarea::placeholder {
    color: var(--text-muted);
}

.form-group textarea {
    min-height: 140px;
    resize: vertical;
    line-height: 1.6;
}

.char-count {
    text-align: right;
    font-size: 0.85rem;
    color: var(--text-muted);
    margin-top: 8px;
    font-weight: 500;
}

/* File Upload */
.file-upload-area {
    border: 2px dashed var(--border-color);
    border-radius: var(--radius-md);
    padding: 48px 32px;
    text-align: center;
    cursor: pointer;
    transition: all var(--transition-normal);
    position: relative;
    overflow: hidden;
    background: var(--bg-input);
}

.file-upload-area:hover,
.file-upload-area.dragover {
    border-color: var(--primary-color);
    background: rgba(102, 126, 234, 0.05);
    transform: translateY(-2px);
}

.file-upload-area.dragover {
    border-color: var(--accent-color);
    background: rgba(16, 185, 129, 0.05);
}

.file-upload-area i {
    font-size: 3.5rem;
    color: var(--primary-color);
    margin-bottom: 20px;
    opacity: 0.8;
    transition: all var(--transition-normal);
}

.file-upload-area:hover i {
    transform: scale(1.1);
    opacity: 1;
}

.upload-text {
    margin-bottom: 16px;
}

.drag-text {
    display: block;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 8px;
    font-size: 1.1rem;
}

.browse-text {
    color: var(--text-secondary);
    font-size: 0.95rem;
}

.browse-link {
    color: var(--primary-color);
    text-decoration: none;
    font-weight: 600;
    cursor: pointer;
    transition: color var(--transition-fast);
}

.browse-link:hover {
    color: var(--primary-dark);
    text-decoration: underline;
}

.file-input {
    position: absolute;
    width: 100%;
    height: 100%;
    top: 0;
    left: 0;
    opacity: 0;
    cursor: pointer;
}

.file-info {
    font-size: 0.9rem;
    color: var(--text-muted);
    margin-top: 12px;
}

.file-preview {
    margin-top: 20px;
    display: none;
}

.file-preview.active {
    display: block;
    animation: slideDown 0.3s ease;
}

@keyframes slideDown {
    from {
        opacity: 0;
        transform: translateY(-10px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.file-preview-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px;
    background: var(--bg-hover);
    border-radius: var(--radius-md);
    margin-top: 12px;
    border: 1px solid var(--border-color);
    transition: all var(--transition-fast);
}

.file-preview-item:hover {
    border-color: var(--primary-color);
    box-shadow: var(--shadow-sm);
}

.file-preview-item i {
    color: var(--primary-color);
    font-size: 1.3rem;
}

.file-preview-name {
    flex: 1;
    margin: 0 16px;
    font-weight: 500;
    color: var(--text-primary);
    font-size: 0.95rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.file-preview-size {
    color: var(--text-secondary);
    font-size: 0.85rem;
    font-weight: 500;
}

.file-preview-remove {
    color: var(--danger-color);
    cursor: pointer;
    background: none;
    border: none;
    font-size: 1.3rem;
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-sm);
    transition: all var(--transition-fast);
}

.file-preview-remove:hover {
    background: rgba(239, 68, 68, 0.1);
    transform: scale(1.1);
}

/* Submit Button */
.submit-btn {
    background: var(--primary-gradient);
    color: white;
    border: none;
    padding: 20px 40px;
    border-radius: var(--radius-full);
    font-size: 1.1rem;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    transition: all var(--transition-normal);
    box-shadow: var(--shadow-lg);
    position: relative;
    overflow: hidden;
    margin-top: 8px;
}

.submit-btn::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
    transition: left 0.6s;
}

.submit-btn:hover::before {
    left: 100%;
}

.submit-btn:hover {
    transform: translateY(-3px);
    box-shadow: var(--shadow-xl);
}

.submit-btn:active {
    transform: translateY(-1px);
}

.submit-btn.loading {
    pointer-events: none;
    opacity: 0.9;
}

.submit-btn.loading .btn-text {
    opacity: 0;
}

.submit-btn.loading .btn-loader {
    opacity: 1;
}

.btn-loader {
    position: absolute;
    display: flex;
    gap: 6px;
    opacity: 0;
    transition: opacity var(--transition-fast);
}

.loader-dot {
    width: 10px;
    height: 10px;
    background: white;
    border-radius: 50%;
    animation: loaderBounce 1.4s infinite ease-in-out both;
}

.loader-dot:nth-child(1) { animation-delay: -0.32s; }
.loader-dot:nth-child(2) { animation-delay: -0.16s; }

@keyframes loaderBounce {
    0%, 80%, 100% { 
        transform: scale(0);
        opacity: 0.5;
    }
    40% { 
        transform: scale(1);
        opacity: 1;
    }
}

/* Tasks Panel */
.tasks-panel {
    background: var(--glass-bg);
    backdrop-filter: blur(20px);
    border-radius: var(--radius-xl);
    padding: 32px;
    border: 1px solid var(--glass-border);
    box-shadow: var(--shadow-lg);
    position: relative;
    overflow: hidden;
}

.tasks-panel::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 4px;
    height: 100%;
    background: var(--secondary-gradient);
}

.panel-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 20px;
    align-items: center;
    margin-bottom: 32px;
}

.search-box {
    flex: 1;
    min-width: 250px;
    position: relative;
}

.search-box i {
    position: absolute;
    left: 18px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--text-muted);
    font-size: 1.1rem;
}

.search-box input {
    width: 100%;
    padding: 16px 20px 16px 52px;
    background: var(--bg-input);
    border: 2px solid var(--border-color);
    border-radius: var(--radius-full);
    color: var(--text-primary);
    font-size: 1.05rem;
    transition: all var(--transition-fast);
}

.search-box input:focus {
    outline: none;
    border-color: var(--primary-color);
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    background: var(--bg-card);
}

.filter-buttons {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
}

.filter-btn {
    padding: 10px 24px;
    background: var(--bg-input);
    border: 2px solid var(--border-color);
    border-radius: var(--radius-full);
    color: var(--text-secondary);
    font-weight: 600;
    cursor: pointer;
    transition: all var(--transition-fast);
    font-size: 0.95rem;
    position: relative;
    overflow: hidden;
}

.filter-btn::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: var(--primary-gradient);
    opacity: 0;
    transition: opacity var(--transition-fast);
}

.filter-btn.active,
.filter-btn:hover {
    color: white;
    border-color: transparent;
}

.filter-btn.active::before,
.filter-btn:hover::before {
    opacity: 1;
}

.filter-btn span {
    position: relative;
    z-index: 1;
}

/* Tasks List */
.tasks-list {
    margin-top: 8px;
}

.task-item {
    background: var(--bg-card);
    border-radius: var(--radius-lg);
    padding: 24px;
    margin-bottom: 20px;
    transition: all var(--transition-normal);
    border: 1px solid var(--border-color);
    position: relative;
    overflow: hidden;
    cursor: pointer;
}

.task-item::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 4px;
    height: 100%;
    background: var(--primary-color);
    opacity: 0.3;
    transition: opacity var(--transition-normal);
}

.task-item:hover::before {
    opacity: 1;
}

.task-item:hover {
    transform: translateX(8px);
    box-shadow: var(--shadow-lg);
}

.task-item.pending::before {
    background: var(--warning-color);
}

.task-item.in_progress::before {
    background: var(--primary-color);
}

.task-item.completed::before {
    background: var(--accent-color);
}

.task-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 16px;
    gap: 16px;
}

.task-title {
    font-size: 1.3rem;
    font-weight: 700;
    color: var(--text-primary);
    flex: 1;
    line-height: 1.4;
    transition: color var(--transition-fast);
}

.task-item:hover .task-title {
    color: var(--primary-color);
}

.task-meta {
    display: flex;
    gap: 12px;
    align-items: center;
    flex-wrap: wrap;
}

.task-assignee {
    background: rgba(102, 126, 234, 0.1);
    color: var(--primary-color);
    padding: 6px 16px;
    border-radius: var(--radius-full);
    font-size: 0.9rem;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 6px;
    white-space: nowrap;
}

.task-date {
    color: var(--text-muted);
    font-size: 0.9rem;
    white-space: nowrap;
    display: flex;
    align-items: center;
    gap: 6px;
}

.task-description {
    color: var(--text-secondary);
    margin-bottom: 20px;
    line-height: 1.7;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

.task-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 20px;
    border-top: 1px solid var(--border-color);
    gap: 16px;
}

.task-status {
    padding: 8px 20px;
    border-radius: var(--radius-full);
    font-size: 0.9rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    display: inline-flex;
    align-items: center;
    gap: 8px;
}

.status-pending {
    background: rgba(245, 158, 11, 0.1);
    color: var(--warning-color);
}

.status-in_progress {
    background: rgba(102, 126, 234, 0.1);
    color: var(--primary-color);
}

.status-completed {
    background: rgba(16, 185, 129, 0.1);
    color: var(--accent-color);
}

.task-actions {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
}

.action-btn {
    width: 42px;
    height: 42px;
    border-radius: var(--radius-full);
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all var(--transition-fast);
    font-size: 1rem;
    position: relative;
    overflow: hidden;
}

.action-btn::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: currentColor;
    opacity: 0.1;
}

.action-btn:hover {
    transform: translateY(-2px) scale(1.05);
    box-shadow: var(--shadow-md);
}

.btn-status {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    color: var(--text-primary);
    min-width: 140px;
    padding: 0 16px;
    justify-content: space-between;
}

.btn-status select {
    background: transparent;
    border: none;
    color: inherit;
    font-weight: 600;
    font-size: 0.9rem;
    cursor: pointer;
    width: 100%;
    appearance: none;
    outline: none;
}

.btn-delete {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    color: var(--danger-color);
}

.btn-delete:hover {
    background: var(--danger-color);
    color: white;
    border-color: var(--danger-color);
}

.btn-download {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    color: var(--accent-color);
}

.btn-download:hover {
    background: var(--accent-color);
    color: white;
    border-color: var(--accent-color);
}

.file-attachment {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    color: var(--primary-color);
    text-decoration: none;
    font-size: 0.95rem;
    margin-top: 16px;
    padding: 10px 16px;
    background: rgba(102, 126, 234, 0.1);
    border-radius: var(--radius-md);
    transition: all var(--transition-fast);
    font-weight: 500;
    border: 1px solid transparent;
}

.file-attachment:hover {
    background: rgba(102, 126, 234, 0.2);
    border-color: var(--primary-color);
    transform: translateX(4px);
}

/* Loading State */
.loading-state {
    text-align: center;
    padding: 80px 20px;
}

.loading-spinner {
    width: 48px;
    height: 48px;
    border: 3px solid var(--border-color);
    border-top-color: var(--primary-color);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 24px;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

.empty-state {
    text-align: center;
    padding: 80px 20px;
    color: var(--text-muted);
}

.empty-state i {
    font-size: 4rem;
    margin-bottom: 24px;
    opacity: 0.5;
    display: block;
}

.empty-state p {
    font-size: 1.1rem;
    max-width: 300px;
    margin: 0 auto;
    line-height: 1.6;
}

/* Footer */
.dashboard-footer {
    text-align: center;
    padding: 32px;
    color: var(--text-secondary);
    border-top: 1px solid var(--border-color);
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 24px;
    background: var(--glass-bg);
    backdrop-filter: blur(10px);
    border-radius: var(--radius-lg);
    margin-top: 48px;
}

.footer-links {
    display: flex;
    gap: 24px;
    flex-wrap: wrap;
}

.footer-links a {
    color: var(--text-secondary);
    text-decoration: none;
    display: flex;
    align-items: center;
    gap: 10px;
    transition: all var(--transition-fast);
    font-weight: 500;
    padding: 8px 16px;
    border-radius: var(--radius-md);
}

.footer-links a:hover {
    color: var(--primary-color);
    background: var(--bg-hover);
    transform: translateY(-2px);
}

/* Notification */
.notification {
    position: fixed;
    top: 24px;
    right: 24px;
    padding: 20px 24px;
    border-radius: var(--radius-lg);
    color: white;
    font-weight: 600;
    z-index: 10000;
    display: flex;
    align-items: center;
    gap: 14px;
    box-shadow: var(--shadow-xl);
    animation: slideInRight 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    max-width: 400px;
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.1);
}

.notification.success {
    background: linear-gradient(135deg, rgba(16, 185, 129, 0.9), rgba(16, 185, 129, 0.7));
}

.notification.error {
    background: linear-gradient(135deg, rgba(239, 68, 68, 0.9), rgba(239, 68, 68, 0.7));
}

.notification.info {
    background: linear-gradient(135deg, rgba(102, 126, 234, 0.9), rgba(102, 126, 234, 0.7));
}

.notification i {
    font-size: 1.3rem;
}

.notification button {
    background: none;
    border: none;
    color: white;
    font-size: 1.2rem;
    cursor: pointer;
    opacity: 0.8;
    transition: opacity var(--transition-fast);
    margin-left: auto;
}

.notification button:hover {
    opacity: 1;
}

@keyframes slideInRight {
    from {
        transform: translateX(100%);
        opacity: 0;
    }
    to {
        transform: translateX(0);
        opacity: 1;
    }
}

@keyframes slideOutRight {
    from {
        transform: translateX(0);
        opacity: 1;
    }
    to {
        transform: translateX(100%);
        opacity: 0;
    }
}

.notification.fade-out {
    animation: slideOutRight 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

/* Modal */
.modal {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(5px);
    z-index: 2000;
    align-items: center;
    justify-content: center;
    padding: 20px;
    animation: fadeIn 0.3s ease;
}

.modal.active {
    display: flex;
}

@keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}

.modal-content {
    background: var(--bg-card);
    border-radius: var(--radius-xl);
    width: 90%;
    max-width: 700px;
    max-height: 85vh;
    overflow-y: auto;
    box-shadow: var(--shadow-xxl);
    animation: slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    border: 1px solid var(--border-color);
}

@keyframes slideUp {
    from {
        transform: translateY(50px);
        opacity: 0;
    }
    to {
        transform: translateY(0);
        opacity: 1;
    }
}

.modal-header {
    padding: 28px 32px;
    border-bottom: 1px solid var(--border-color);
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: var(--bg-hover);
    border-radius: var(--radius-xl) var(--radius-xl) 0 0;
}

.modal-header h3 {
    font-size: 1.6rem;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0;
}

.modal-close {
    background: none;
    border: none;
    font-size: 2rem;
    color: var(--text-muted);
    cursor: pointer;
    transition: all var(--transition-fast);
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-full);
}

.modal-close:hover {
    color: var(--danger-color);
    background: var(--bg-hover);
    transform: rotate(90deg);
}

.modal-body {
    padding: 32px;
}

.task-detail {
    display: flex;
    flex-direction: column;
    gap: 28px;
}

.detail-section h4 {
    font-size: 1.1rem;
    color: var(--text-secondary);
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    gap: 10px;
    font-weight: 600;
}

.detail-section h4 i {
    color: var(--primary-color);
    font-size: 1.2rem;
}

.detail-section p {
    color: var(--text-primary);
    line-height: 1.7;
    margin: 0;
    padding: 0;
}

/* Responsive */
@media (max-width: 1024px) {
    .container {
        padding: 20px;
    }
    
    .stats-container {
        grid-template-columns: repeat(2, 1fr);
    }
    
    .dashboard-header {
        padding: 28px;
    }
    
    .logo h1 {
        font-size: 2rem;
    }
    
    .logo-icon {
        width: 56px;
        height: 56px;
        font-size: 2rem;
    }
}

@media (max-width: 768px) {
    .container {
        padding: 16px;
    }
    
    .stats-container {
        grid-template-columns: 1fr;
        gap: 20px;
    }
    
    .dashboard-header {
        flex-direction: column;
        gap: 24px;
        text-align: center;
        padding: 24px;
    }
    
    .logo {
        flex-direction: column;
        text-align: center;
        gap: 16px;
    }
    
    .logo h1 {
        font-size: 1.8rem;
    }
    
    .header-actions {
        width: 100%;
        justify-content: center;
    }
    
    .panel-actions {
        flex-direction: column;
        align-items: stretch;
        gap: 16px;
    }
    
    .search-box {
        min-width: unset;
    }
    
    .filter-buttons {
        justify-content: center;
    }
    
    .task-footer {
        flex-direction: column;
        align-items: stretch;
        gap: 20px;
    }
    
    .task-actions {
        justify-content: flex-end;
    }
    
    .dashboard-footer {
        flex-direction: column;
        text-align: center;
        gap: 20px;
        padding: 24px;
    }
    
    .footer-links {
        justify-content: center;
    }
    
    .theme-toggle {
        top: 16px;
        right: 16px;
    }
    
    #themeBtn {
        width: 48px;
        height: 48px;
        font-size: 1.2rem;
    }
}

@media (max-width: 480px) {
    .form-panel,
    .tasks-panel {
        padding: 24px;
    }
    
    .panel-header h2 {
        font-size: 1.6rem;
    }
    
    .task-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 12px;
    }
    
    .task-meta {
        width: 100%;
        justify-content: space-between;
    }
    
    .btn-status {
        min-width: 120px;
    }
    
    .notification {
        max-width: calc(100vw - 48px);
        left: 24px;
        right: 24px;
    }
}

/* Animation Classes */
.fade-in {
    animation: fadeIn 0.5s ease;
}

.slide-up {
    animation: slideUp 0.5s ease;
}

.pulse {
    animation: pulse 2s infinite;
}

@keyframes pulse {
    0% { transform: scale(1); }
    50% { transform: scale(1.05); }
    100% { transform: scale(1); }
}

/* Status Badge Animation */
@keyframes statusPulse {
    0%, 100% { 
        box-shadow: 0 0 0 0 rgba(var(--color-rgb), 0.4);
    }
    70% { 
        box-shadow: 0 0 0 10px rgba(var(--color-rgb), 0);
    }
}

.status-pending,
.status-in_progress,
.status-completed {
    animation: statusPulse 2s infinite;
}

/* Custom Scrollbar for Modal */
.modal-content::-webkit-scrollbar {
    width: 8px;
}

.modal-content::-webkit-scrollbar-track {
    background: var(--bg-hover);
    border-radius: var(--radius-full);
}

.modal-content::-webkit-scrollbar-thumb {
    background: var(--primary-color);
    border-radius: var(--radius-full);
}

/* Print Styles */
@media print {
    .theme-toggle,
    .header-actions,
    .footer-links,
    .task-actions,
    .file-upload-area,
    .submit-btn {
        display: none !important;
    }
    
    .container {
        padding: 0;
    }
    
    .dashboard-header,
    .form-panel,
    .tasks-panel {
        box-shadow: none;
        border: 1px solid #ddd;
    }
}

.