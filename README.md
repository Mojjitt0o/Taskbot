# README.md - TaskBot Pro

```markdown
# 🚀 TaskBot Pro - Task Management dengan Telegram Integration

![Version](https://img.shields.io/badge/version-2.0-blue)
![Node](https://img.shields.io/badge/node-%3E%3D18.x-green)
![MySQL](https://img.shields.io/badge/mysql-5.7%2B-orange)
![License](https://img.shields.io/badge/license-MIT-yellow)

TaskBot Pro adalah aplikasi manajemen task lengkap dengan integrasi Telegram, sistem chat real-time, manajemen group, dan approval task. Dibangun dengan Node.js, Express, MySQL, dan Socket.IO.

## 📋 Daftar Isi

- [Fitur Utama](#fitur-utama)
- [Teknologi yang Digunakan](#teknologi-yang-digunakan)
- [Struktur Database](#struktur-database)
- [Instalasi](#instalasi)
- [Konfigurasi Environment](#konfigurasi-environment)
- [Menjalankan Aplikasi](#menjalankan-aplikasi)
- [Struktur Folder](#struktur-folder)
- [API Documentation](#api-documentation)
- [Fitur Chat](#fitur-chat)
- [Integrasi Telegram](#integrasi-telegram)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)
- [Kontribusi](#kontribusi)
- [Lisensi](#lisensi)

## ✨ Fitur Utama

### 🔐 **Sistem Autentikasi**
- Register dengan verifikasi Telegram
- Login dengan JWT token
- Forgot password & reset password
- Verifikasi 2 faktor via Telegram

### 📋 **Manajemen Task**
- Buat task dengan assignee
- Update status task (pending, in_progress, completed)
- Approval system (admin approve/reject)
- Upload file attachment (Cloudinary)
- Test cases untuk setiap task

### 💬 **Chat System Real-time**
- Private chat antar user
- Group chat
- Online/offline presence
- Typing indicator
- Emoji picker
- Reply, edit, delete message
- Upload file & gambar (paste image support)
- Read receipts

### 👥 **Group Management**
- Buat group chat
- Invite friends (hanya teman)
- Admin group (transfer admin)
- Leave group
- Group avatar upload

### 📊 **Dashboard & Reports**
- Statistik task
- Chart distribusi task
- Weekly activity chart
- Export report (Excel/PDF)
- User management (admin)

### 🌙 **Tema Ramadhan**
- Light/Dark mode
- Dekorasi Islami
- Animasi halus

## 🛠️ Teknologi yang Digunakan

### **Backend**
- Node.js (v18+)
- Express.js
- MySQL (MySQL2)
- Socket.IO (real-time)
- JWT (autentikasi)
- Bcrypt (hashing password)
- Multer (file upload)
- Cloudinary (cloud storage)
- Axios (HTTP client)
- Express Validator (validasi)

### **Frontend**
- Vanilla JavaScript
- HTML5
- CSS3 (Flexbox/Grid)
- Font Awesome 6 (icons)
- Google Fonts (Inter)
- Chart.js (grafik)
- Socket.IO Client

### **Database**
- MySQL 5.7+
- Tables: users, tasks, chat_messages, groups, friends, dll

## 📁 Struktur Database

### **Tabel Utama**

```sql
-- Users
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) UNIQUE,
    email VARCHAR(100) UNIQUE,
    password VARCHAR(255),
    full_name VARCHAR(100),
    role ENUM('admin','user') DEFAULT 'user',
    telegram_chat_id VARCHAR(50),
    telegram_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tasks
CREATE TABLE tasks (
    id INT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(255),
    description TEXT,
    assignee_id INT,
    status ENUM('pending','in_progress','completed','approved','rejected'),
    cloudinary_url VARCHAR(500),
    FOREIGN KEY (assignee_id) REFERENCES users(id)
);

-- Chat Messages
CREATE TABLE chat_messages (
    id INT PRIMARY KEY AUTO_INCREMENT,
    room_id INT,
    user_id INT,
    message TEXT,
    message_type ENUM('text','image','file'),
    cloudinary_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (room_id) REFERENCES chat_rooms(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Groups
CREATE TABLE `groups` (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100),
    description TEXT,
    avatar_url VARCHAR(500),
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Friends
CREATE TABLE friends (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    friend_id INT,
    status ENUM('pending','accepted','blocked') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_friendship (user_id, friend_id)
);
```

Lihat file `database.sql` untuk script lengkap semua tabel.

## 🚀 Instalasi

### **Prasyarat**
- Node.js 18.x atau lebih tinggi
- MySQL 5.7 atau lebih tinggi
- Akun Cloudinary (untuk upload file)
- Bot Telegram (untuk verifikasi)

### **Langkah-langkah Instalasi**

1. **Clone repository**
```bash
git clone https://github.com/username/taskbot-pro.git
cd taskbot-pro
```

2. **Install dependencies**
```bash
npm install
```

3. **Buat database MySQL**
```bash
mysql -u root -p
CREATE DATABASE task_bot_db;
USE task_bot_db;
SOURCE database.sql;
```

4. **Konfigurasi environment**
```bash
cp .env.example .env
# Edit file .env sesuai konfigurasi Anda
```

5. **Jalankan aplikasi**
```bash
# Development
npm run dev

# Production
npm start
```

## 🔧 Konfigurasi Environment

Buat file `.env` di root folder:

```env
# Server Configuration
PORT=3002
NODE_ENV=development
APP_URL=http://localhost:3002

# Database Configuration
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=yourpassword
DB_NAME=task_bot_db

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this
SESSION_SECRET=your-session-secret-key-change-this

# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
CLOUDINARY_FOLDER=taskbot

# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_BOT_USERNAME=@YourBotUsername

# File Upload
MAX_FILE_SIZE=50 # in MB
```

## 🏃 Menjalankan Aplikasi

### **Development Mode**
```bash
npm run dev
# Aplikasi akan berjalan di http://localhost:3002
# Dengan nodemon auto-restart
```

### **Production Mode**
```bash
npm start
# Aplikasi berjalan tanpa auto-restart
```

### **Setup Telegram Webhook**
Akses endpoint berikut untuk set webhook Telegram:
```
GET http://localhost:3002/api/telegram/set-webhook
```

## 📁 Struktur Folder

```
taskbot-pro/
├── app.js                 # Main application file
├── package.json           # Dependencies
├── .env                   # Environment variables
├── database.sql           # Complete database schema
├── README.md              # Documentation
├── public/                # Frontend files
│   ├── index.html         # Main HTML
│   ├── style.css          # Stylesheet
│   └── script.js          # Client-side JavaScript
├── services/              # Backend services
│   └── cloudinary.js      # Cloudinary integration
└── uploads/               # Local uploads (optional)
    ├── images/
    ├── documents/
    ├── screenshots/
    └── videos/
```

## 📚 API Documentation

### **Authentication Endpoints**

| Method | Endpoint | Description | Body |
|--------|----------|-------------|------|
| POST | `/api/auth/register` | Register user | `{username, email, password, full_name, telegram_chat_id}` |
| POST | `/api/auth/login` | Login user | `{username, password}` |
| POST | `/api/auth/verify-telegram` | Verifikasi kode | `{user_id, verification_code}` |
| GET | `/api/auth/me` | Get current user | - |
| POST | `/api/auth/logout` | Logout | - |
| POST | `/api/auth/forgot-password` | Lupa password | `{email}` |
| POST | `/api/auth/reset-password` | Reset password | `{token, new_password}` |

### **Task Endpoints**

| Method | Endpoint | Description | Body |
|--------|----------|-------------|------|
| GET | `/api/tasks` | Get all tasks | - |
| POST | `/api/tasks` | Create task | `{title, description, assignee_id, file}` |
| PUT | `/api/tasks/:id/status` | Update status | `{status}` |
| POST | `/api/tasks/:id/approve` | Approve task | - |
| POST | `/api/tasks/:id/reject` | Reject task | `{reason}` |
| DELETE | `/api/tasks/:id` | Delete task | - |
| POST | `/api/tasks/:id/result` | Upload result | `{result_text, result_file}` |

### **Chat Endpoints**

| Method | Endpoint | Description | Body |
|--------|----------|-------------|------|
| GET | `/api/chat/rooms` | Get chat rooms | - |
| GET | `/api/chat/rooms/:roomId/messages` | Get messages | - |
| POST | `/api/chat/rooms/:roomId/messages` | Send message | `{message, file}` |
| PUT | `/api/chat/messages/:messageId` | Edit message | `{message}` |
| DELETE | `/api/chat/messages/:messageId` | Delete message | `{reason}` |
| POST | `/api/chat/messages/:messageId/reply` | Reply to message | `{message, room_id}` |
| POST | `/api/chat/messages/status` | Update status | `{messageIds, status, room_id}` |

### **Friend Endpoints**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users/search?q=query` | Search users |
| POST | `/api/friends/request/:userId` | Send friend request |
| POST | `/api/friends/accept/:requestId` | Accept request |
| POST | `/api/friends/reject/:requestId` | Reject request |
| GET | `/api/friends` | Get friends list |
| GET | `/api/friends/requests/pending` | Get pending requests |

### **Group Endpoints**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/groups` | Get user groups |
| POST | `/api/groups` | Create group |
| GET | `/api/groups/:groupId` | Get group details |
| PUT | `/api/groups/:groupId` | Update group |
| DELETE | `/api/groups/:groupId` | Delete group |
| POST | `/api/groups/:groupId/members` | Add members |
| DELETE | `/api/groups/:groupId/members/:userId` | Remove member |
| POST | `/api/groups/:groupId/invite` | Invite members |
| POST | `/api/groups/invitations/:invitationId/accept` | Accept invitation |
| POST | `/api/groups/invitations/:invitationId/reject` | Reject invitation |
| GET | `/api/groups/invitations/pending` | Get pending invitations |

## 💬 Fitur Chat

### **Shortcut Keyboard**
- `Enter` - Kirim pesan
- `Shift + Enter` - Baris baru
- `Escape` - Keluar dari chat / tutup modal
- `Ctrl + V` - Paste gambar langsung

### **Fitur Pesan**
- ✅ Text dengan format (enter = new line)
- ✅ Gambar (upload file atau paste)
- ✅ File attachment
- ✅ Reply ke pesan
- ✅ Edit pesan (dalam 24 jam)
- ✅ Delete pesan
- ✅ Emoji picker
- ✅ Typing indicator
- ✅ Online/offline status
- ✅ Read receipts

### **Group Chat**
- ✅ Buat group
- ✅ Invite friends
- ✅ Admin group
- ✅ Transfer admin
- ✅ Leave group
- ✅ Group avatar

## 🤖 Integrasi Telegram

### **Setup Bot Telegram**

1. Buat bot melalui [@BotFather](https://t.me/botfather)
2. Dapatkan token bot
3. Set webhook:
```bash
curl -F "url=https://your-domain.com/api/telegram/webhook" https://api.telegram.org/bot<YOUR_TOKEN>/setWebhook
```

### **Perintah Bot**
- `/start` - Memulai bot
- `/verify` - Verifikasi akun
- `/help` - Bantuan

### **Alur Verifikasi**
1. User register dengan Telegram Chat ID
2. User kirim `/verify` ke bot
3. Bot minta email
4. User kirim email
5. Bot kirim kode 6 digit
6. User masukkan kode di aplikasi
7. Akun terverifikasi

## ☁️ Cloudinary Setup

### **Konfigurasi Cloudinary**
1. Daftar di [Cloudinary](https://cloudinary.com)
2. Dapatkan credentials dari dashboard
3. Set di file `.env`

### **Upload Options**
- Profile pictures (dengan transformasi 400x400)
- Task attachments
- Chat images
- Group avatars
- Screenshots test case

## 📱 Responsive Design

Aplikasi fully responsive untuk:
- 💻 Desktop (1024px+)
- 💻 Tablet (768px - 1024px)
- 📱 Mobile (320px - 640px)

### **Mobile Features**
- Bottom navigation
- Slide-in sidebar
- Touch-friendly buttons
- Optimasi keyboard
- Prevent zoom on input

## 🚢 Deployment

### **Deploy ke Railway**

1. Push code ke GitHub
2. Buat project baru di Railway
3. Connect GitHub repository
4. Set environment variables
5. Deploy!

### **Environment Variables untuk Railway**
```
PORT=3002
NODE_ENV=production
APP_URL=https://your-app.railway.app
MYSQLHOST=your-mysql-host
MYSQLUSER=your-mysql-user
MYSQLPASSWORD=your-mysql-password
MYSQLDATABASE=your-mysql-database
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
TELEGRAM_BOT_TOKEN=your-bot-token
JWT_SECRET=your-jwt-secret
SESSION_SECRET=your-session-secret
```

### **Deploy ke VPS**
```bash
# Install dependencies
npm install --production

# Setup PM2
npm install -g pm2
pm2 start app.js --name taskbot
pm2 save
pm2 startup

# Setup Nginx sebagai reverse proxy
```

## 🐛 Troubleshooting

### **Masalah Umum**

#### **1. Gambar tidak tampil setelah di-paste**
**Penyebab**: ID message = 0 di database
**Solusi**: 
```sql
ALTER TABLE chat_messages MODIFY id INT NOT NULL AUTO_INCREMENT;
```

#### **2. File tidak terdeteksi oleh multer**
**Cek log server**: Pastikan `hasFile: true` di log
**Perbaikan**: Pastikan form data menggunakan field name `file`

#### **3. Webhook Telegram tidak bekerja**
**Cek**: 
```bash
curl https://api.telegram.org/bot<YOUR_TOKEN>/getWebhookInfo
```

#### **4. Socket.IO tidak konek**
**Periksa**: CORS configuration di `app.js`

### **Debug Mode**

Aktifkan debug dengan melihat console:
- **Browser**: F12 → Console
- **Server**: `console.log()` sudah ditambahkan di endpoint penting

## 🤝 Kontribusi

Kami sangat menerima kontribusi! Silakan:

1. Fork repository
2. Buat branch fitur (`git checkout -b feature/AmazingFeature`)
3. Commit perubahan (`git commit -m 'Add some AmazingFeature'`)
4. Push ke branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

### **Coding Standards**
- Gunakan 2 spasi untuk indentasi
- Gunakan `const` dan `let`, hindari `var`
- Beri komentar untuk fungsi kompleks
- Ikuti pattern yang sudah ada

## 📄 Lisensi

Distributed under the MIT License. See `LICENSE` for more information.

## 📞 Kontak

Project Link: [https://github.com/username/taskbot-pro](https://github.com/username/taskbot-pro)

---

## 🙏 Credits

- **Icons**: Font Awesome
- **Fonts**: Google Fonts (Inter)
- **Charts**: Chart.js
- **Real-time**: Socket.IO
- **Cloud Storage**: Cloudinary

---

**Dibuat dengan ❤️ oleh Tim TaskBot Pro**
```

## File `database.sql` (Lengkap)

```sql
-- =====================================================
-- DATABASE TASK BOT PRO - LENGKAP
-- =====================================================

-- Buat database
CREATE DATABASE IF NOT EXISTS task_bot_db 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE task_bot_db;

-- =====================================================
-- TABEL USERS
-- =====================================================
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    role ENUM('admin', 'user') DEFAULT 'user',
    telegram_chat_id VARCHAR(50),
    telegram_verified BOOLEAN DEFAULT FALSE,
    verification_code VARCHAR(10),
    verification_expires DATETIME,
    reset_token VARCHAR(100),
    reset_expires DATETIME,
    is_active BOOLEAN DEFAULT TRUE,
    last_login DATETIME,
    last_active DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_username (username),
    INDEX idx_email (email),
    INDEX idx_telegram (telegram_chat_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================
-- TABEL PROFILE PICTURES
-- =====================================================
CREATE TABLE profile_pictures (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL UNIQUE,
    file_path VARCHAR(500),
    cloudinary_url VARCHAR(500),
    cloudinary_public_id VARCHAR(200),
    file_name VARCHAR(255),
    file_size BIGINT,
    mime_type VARCHAR(100),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================
-- TABEL USER PRESENCE
-- =====================================================
CREATE TABLE user_presence (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL UNIQUE,
    status ENUM('online', 'offline') DEFAULT 'offline',
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_active DATETIME,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================
-- TABEL TASKS
-- =====================================================
CREATE TABLE tasks (
    id INT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    assignee_id INT,
    created_by INT NOT NULL,
    approved_by INT,
    status ENUM('pending', 'in_progress', 'completed', 'approved', 'rejected') DEFAULT 'pending',
    approval_status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    file_path VARCHAR(500),
    cloudinary_url VARCHAR(500),
    cloudinary_public_id VARCHAR(200),
    file_name VARCHAR(255),
    file_size BIGINT,
    mime_type VARCHAR(100),
    result_text TEXT,
    telegram_chat_id VARCHAR(50),
    completed_at DATETIME,
    approved_at DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (assignee_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
    
    INDEX idx_assignee (assignee_id),
    INDEX idx_status (status),
    INDEX idx_approval (approval_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================
-- TABEL TEST CASES
-- =====================================================
CREATE TABLE test_cases (
    id INT PRIMARY KEY AUTO_INCREMENT,
    task_id INT NOT NULL,
    test_name VARCHAR(255) NOT NULL,
    test_description TEXT,
    input_data TEXT,
    expected_output TEXT,
    actual_output TEXT,
    status ENUM('pending', 'passed', 'failed') DEFAULT 'pending',
    screenshot_path VARCHAR(500),
    cloudinary_url VARCHAR(500),
    cloudinary_public_id VARCHAR(200),
    executed_by INT,
    executed_at DATETIME,
    note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (executed_by) REFERENCES users(id) ON DELETE SET NULL,
    
    INDEX idx_task (task_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================
-- TABEL GROUPS
-- =====================================================
CREATE TABLE `groups` (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    avatar_url VARCHAR(500),
    avatar_public_id VARCHAR(200),
    created_by INT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
    
    INDEX idx_name (name),
    INDEX idx_creator (created_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================
-- TABEL GROUP MEMBERS
-- =====================================================
CREATE TABLE group_members (
    id INT PRIMARY KEY AUTO_INCREMENT,
    group_id INT NOT NULL,
    user_id INT NOT NULL,
    role ENUM('admin', 'member') DEFAULT 'member',
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    left_at DATETIME,
    is_active BOOLEAN DEFAULT TRUE,
    
    FOREIGN KEY (group_id) REFERENCES `groups`(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_member (group_id, user_id),
    
    INDEX idx_group (group_id),
    INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================
-- TABEL GROUP INVITATIONS
-- =====================================================
CREATE TABLE group_invitations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    group_id INT NOT NULL,
    inviter_id INT NOT NULL,
    invitee_id INT NOT NULL,
    status ENUM('pending', 'accepted', 'rejected') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    responded_at DATETIME,
    
    FOREIGN KEY (group_id) REFERENCES `groups`(id) ON DELETE CASCADE,
    FOREIGN KEY (inviter_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (invitee_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_invitation (group_id, invitee_id),
    
    INDEX idx_group (group_id),
    INDEX idx_invitee (invitee_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================
-- TABEL FRIENDS
-- =====================================================
CREATE TABLE friends (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    friend_id INT NOT NULL,
    status ENUM('pending', 'accepted', 'blocked') DEFAULT 'accepted',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (friend_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_friendship (user_id, friend_id),
    
    INDEX idx_user (user_id),
    INDEX idx_friend (friend_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================
-- TABEL FRIEND REQUESTS
-- =====================================================
CREATE TABLE friend_requests (
    id INT PRIMARY KEY AUTO_INCREMENT,
    sender_id INT NOT NULL,
    receiver_id INT NOT NULL,
    status ENUM('pending', 'accepted', 'rejected') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_request (sender_id, receiver_id),
    
    INDEX idx_sender (sender_id),
    INDEX idx_receiver (receiver_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================
-- TABEL CHAT ROOMS
-- =====================================================
CREATE TABLE chat_rooms (
    id INT PRIMARY KEY AUTO_INCREMENT,
    room_name VARCHAR(100),
    room_type ENUM('private', 'group') DEFAULT 'private',
    group_id INT,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (group_id) REFERENCES `groups`(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
    
    INDEX idx_type (room_type),
    INDEX idx_group (group_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================
-- TABEL CHAT ROOM PARTICIPANTS
-- =====================================================
CREATE TABLE chat_room_participants (
    id INT PRIMARY KEY AUTO_INCREMENT,
    room_id INT NOT NULL,
    user_id INT NOT NULL,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_read_at DATETIME,
    is_active BOOLEAN DEFAULT TRUE,
    
    FOREIGN KEY (room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_participant (room_id, user_id),
    
    INDEX idx_room (room_id),
    INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================
-- TABEL CHAT MESSAGES
-- =====================================================
CREATE TABLE chat_messages (
    id INT PRIMARY KEY AUTO_INCREMENT,
    room_id INT NOT NULL,
    user_id INT NOT NULL,
    reply_to_id INT,
    message TEXT,
    message_type ENUM('text', 'image', 'file', 'audio', 'video') DEFAULT 'text',
    file_path VARCHAR(500),
    cloudinary_url VARCHAR(500),
    cloudinary_public_id VARCHAR(200),
    file_name VARCHAR(255),
    file_size BIGINT,
    mime_type VARCHAR(100),
    status ENUM('sent', 'delivered', 'read') DEFAULT 'sent',
    edited BOOLEAN DEFAULT FALSE,
    edited_at DATETIME,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_by INT,
    deleted_at DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (reply_to_id) REFERENCES chat_messages(id) ON DELETE SET NULL,
    FOREIGN KEY (deleted_by) REFERENCES users(id) ON DELETE SET NULL,
    
    INDEX idx_room (room_id),
    INDEX idx_user (user_id),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================
-- TABEL CHAT MESSAGE READS
-- =====================================================
CREATE TABLE chat_message_reads (
    id INT PRIMARY KEY AUTO_INCREMENT,
    message_id INT NOT NULL,
    user_id INT NOT NULL,
    read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (message_id) REFERENCES chat_messages(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_read (message_id, user_id),
    
    INDEX idx_message (message_id),
    INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================
-- TABEL CHAT ROOM DELETIONS
-- =====================================================
CREATE TABLE chat_room_deletions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    room_id INT NOT NULL,
    deleted_by INT NOT NULL,
    reason TEXT,
    deleted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (deleted_by) REFERENCES users(id) ON DELETE CASCADE,
    
    INDEX idx_room (room_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================
-- TABEL TELEGRAM STATES
-- =====================================================
CREATE TABLE telegram_states (
    id INT PRIMARY KEY AUTO_INCREMENT,
    chat_id VARCHAR(50) NOT NULL UNIQUE,
    step VARCHAR(50),
    data TEXT,
    created_at DATETIME DEFAULT NULL,
    updated_at DATETIME DEFAULT NULL,
    
    INDEX idx_chat (chat_id),
    INDEX idx_step (step)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================
-- TABEL ACTIVITY LOGS
-- =====================================================
CREATE TABLE activity_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50),
    entity_id INT,
    details JSON,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    INDEX idx_user (user_id),
    INDEX idx_action (action),
    INDEX idx_entity (entity_type, entity_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================
-- TABEL UPLOADS
-- =====================================================
CREATE TABLE uploads (
    id INT PRIMARY KEY AUTO_INCREMENT,
    task_id INT,
    user_id INT,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size BIGINT,
    file_type VARCHAR(100),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    INDEX idx_task (task_id),
    INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================
-- INSERT DATA DEFAULT
-- =====================================================

-- Insert admin default (password: admin123)
INSERT INTO users (username, email, password, full_name, role, telegram_verified) VALUES
('admin', 'admin@taskbot.com', '$2a$10$X/hQgLvU7wCXcSXxUvWQ7O8X9X9X9X9X9X9X9X9X9X9X9X9X9X9', 'Administrator', 'admin', TRUE);

-- Insert user default (password: user123)
INSERT INTO users (username, email, password, full_name, role, telegram_verified) VALUES
('user1', 'user1@taskbot.com', '$2a$10$Y/hQgLvU7wCXcSXxUvWQ7O8X9X9X9X9X9X9X9X9X9X9X9X9X9X9', 'User Satu', 'user', FALSE),
('user2', 'user2@taskbot.com', '$2a$10$Z/hQgLvU7wCXcSXxUvWQ7O8X9X9X9X9X9X9X9X9X9X9X9X9X9X9', 'User Dua', 'user', FALSE);

-- Insert sample friends
INSERT INTO friends (user_id, friend_id, status) VALUES
(1, 2, 'accepted'),
(2, 1, 'accepted');

-- Insert sample chat room
INSERT INTO chat_rooms (room_name, room_type, created_by) VALUES
(NULL, 'private', 1);

INSERT INTO chat_room_participants (room_id, user_id) VALUES
(1, 1),
(1, 2);

-- Insert sample messages
INSERT INTO chat_messages (room_id, user_id, message, message_type, status) VALUES
(1, 1, 'Halo User1, selamat datang di TaskBot Pro!', 'text', 'read'),
(1, 2, 'Halo Admin, terima kasih!', 'text', 'read'),
(1, 1, 'Jangan lupa cek task yang sudah diberikan ya', 'text', 'read'),
(1, 2, 'Siap, akan segera saya kerjakan', 'text', 'sent');

-- Update last_read_at
UPDATE chat_room_participants SET last_read_at = NOW() WHERE room_id = 1;

-- Insert user presence
INSERT INTO user_presence (user_id, status, last_seen, last_active) VALUES
(1, 'offline', NOW(), NOW()),
(2, 'offline', NOW(), NOW()),
(3, 'offline', NOW(), NOW());

-- =====================================================
-- INDEXES UNTUK PERFORMANCE
-- =====================================================

CREATE INDEX idx_tasks_assignee_status ON tasks(assignee_id, status);
CREATE INDEX idx_tasks_created_status ON tasks(created_at, status);
CREATE INDEX idx_test_cases_task_status ON test_cases(task_id, status);
CREATE INDEX idx_chat_messages_room_created ON chat_messages(room_id, created_at);
CREATE INDEX idx_activity_logs_user_created ON activity_logs(user_id, created_at);
CREATE INDEX idx_group_members_group_user ON group_members(group_id, user_id, is_active);

-- =====================================================
-- VIEWS
-- =====================================================

CREATE VIEW v_task_details AS
SELECT 
    t.*,
    assignee.username as assignee_username,
    assignee.full_name as assignee_name,
    creator.username as creator_username,
    approver.username as approver_username,
    DATE_FORMAT(t.created_at, '%Y-%m-%d %H:%i:%s') as created_at_formatted,
    DATE_FORMAT(t.completed_at, '%Y-%m-%d %H:%i:%s') as completed_at_formatted,
    DATE_FORMAT(t.approved_at, '%Y-%m-%d %H:%i:%s') as approved_at_formatted,
    (SELECT COUNT(*) FROM test_cases WHERE task_id = t.id) as total_test_cases,
    (SELECT COUNT(*) FROM test_cases WHERE task_id = t.id AND status = 'passed') as passed_tests
FROM tasks t
LEFT JOIN users assignee ON t.assignee_id = assignee.id
LEFT JOIN users creator ON t.created_by = creator.id
LEFT JOIN users approver ON t.approved_by = approver.id;

-- =====================================================
-- CEK HASIL
-- =====================================================

SELECT 'Setup Complete!' as Status;
```

## Cara Penggunaan

1. **Clone repository**
2. **Install dependencies**: `npm install`
3. **Setup database**: Jalankan `database.sql` di MySQL
4. **Konfigurasi .env**: Sesuaikan dengan environment Anda
5. **Jalankan aplikasi**: `npm run dev`
6. **Akses di browser**: `http://localhost:3002`

Selamat menggunakan TaskBot Pro! 🚀