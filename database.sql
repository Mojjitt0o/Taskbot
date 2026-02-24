


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