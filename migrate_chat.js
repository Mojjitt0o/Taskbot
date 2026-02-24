const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrate() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'task_bot_db',
        multipleStatements: true
    });

    console.log('🚀 Starting chat system migration...');

    const queries = `
    -- Tabel friends
    CREATE TABLE IF NOT EXISTS friends (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        friend_id INT NOT NULL,
        status ENUM('pending', 'accepted', 'blocked') DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (friend_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY unique_friendship (user_id, friend_id)
    );

    -- Tabel chat_rooms
    CREATE TABLE IF NOT EXISTS chat_rooms (
        id INT PRIMARY KEY AUTO_INCREMENT,
        room_name VARCHAR(255),
        room_type ENUM('private', 'group') DEFAULT 'private',
        created_by INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Tabel chat_room_participants
    CREATE TABLE IF NOT EXISTS chat_room_participants (
        id INT PRIMARY KEY AUTO_INCREMENT,
        room_id INT NOT NULL,
        user_id INT NOT NULL,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_read_at TIMESTAMP NULL,
        FOREIGN KEY (room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY unique_participant (room_id, user_id)
    );

    -- Tabel chat_messages
    CREATE TABLE IF NOT EXISTS chat_messages (
        id INT PRIMARY KEY AUTO_INCREMENT,
        room_id INT NOT NULL,
        user_id INT NOT NULL,
        message TEXT,
        message_type ENUM('text', 'image', 'file', 'audio') DEFAULT 'text',
        file_path VARCHAR(500),
        file_name VARCHAR(255),
        file_size INT,
        mime_type VARCHAR(100),
        is_deleted BOOLEAN DEFAULT FALSE,
        deleted_by INT NULL,
        deleted_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (deleted_by) REFERENCES users(id) ON DELETE SET NULL
    );

    -- Tabel chat_message_reads
    CREATE TABLE IF NOT EXISTS chat_message_reads (
        id INT PRIMARY KEY AUTO_INCREMENT,
        message_id INT NOT NULL,
        user_id INT NOT NULL,
        read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (message_id) REFERENCES chat_messages(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY unique_read (message_id, user_id)
    );

    -- Tabel chat_room_deletions
    CREATE TABLE IF NOT EXISTS chat_room_deletions (
        id INT PRIMARY KEY AUTO_INCREMENT,
        room_id INT NOT NULL,
        deleted_by INT NOT NULL,
        reason TEXT,
        deleted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE,
        FOREIGN KEY (deleted_by) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Tabel friend_requests
    CREATE TABLE IF NOT EXISTS friend_requests (
        id INT PRIMARY KEY AUTO_INCREMENT,
        sender_id INT NOT NULL,
        receiver_id INT NOT NULL,
        status ENUM('pending', 'accepted', 'rejected', 'cancelled') DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Index untuk performance
    CREATE INDEX idx_messages_room ON chat_messages(room_id, created_at);
    CREATE INDEX idx_messages_user ON chat_messages(user_id);
    CREATE INDEX idx_participants_user ON chat_room_participants(user_id);
    CREATE INDEX idx_participants_room ON chat_room_participants(room_id);
    CREATE INDEX idx_friends_user ON friends(user_id, status);
    CREATE INDEX idx_friends_friend ON friends(friend_id, status);
    `;

    try {
        await connection.query(queries);
        console.log('✅ Chat system migration completed successfully!');
    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        await connection.end();
    }
}

migrate();