-- Drop database jika ada dan buat baru
DROP DATABASE IF EXISTS task_bot_db;
CREATE DATABASE IF NOT EXISTS task_bot_db;
USE task_bot_db;

-- =====================================================
-- TABEL USERS (Manajemen Akun)
-- =====================================================
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    role ENUM('admin', 'user') DEFAULT 'user',
    telegram_chat_id VARCHAR(100),
    telegram_verified BOOLEAN DEFAULT FALSE,
    verification_code VARCHAR(10),
    verification_expires DATETIME,
    reset_token VARCHAR(100),
    reset_expires DATETIME,
    is_active BOOLEAN DEFAULT TRUE,
    last_login DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_username (username),
    INDEX idx_email (email),
    INDEX idx_role (role)
);

-- =====================================================
-- TABEL TASKS (Dengan Approval System)
-- =====================================================
CREATE TABLE tasks (
    id INT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    assignee_id INT NOT NULL,
    created_by INT NOT NULL,
    approved_by INT NULL,
    status ENUM('pending', 'in_progress', 'completed', 'rejected', 'approved') DEFAULT 'pending',
    approval_status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    file_path VARCHAR(500),
    result_text TEXT,
    telegram_chat_id VARCHAR(100),
    telegram_sent BOOLEAN DEFAULT FALSE,
    completed_at DATETIME NULL,
    approved_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (assignee_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
    
    INDEX idx_status (status),
    INDEX idx_assignee (assignee_id),
    INDEX idx_created_by (created_by),
    INDEX idx_approval (approval_status)
);

-- =====================================================
-- TABEL TEST CASES (Per Task)
-- =====================================================
CREATE TABLE test_cases (
    id INT PRIMARY KEY AUTO_INCREMENT,
    task_id INT NOT NULL,
    test_name VARCHAR(255) NOT NULL,
    test_description TEXT,
    input_data TEXT,
    expected_output TEXT,
    actual_output TEXT,
    status ENUM('pending', 'passed', 'failed', 'skipped') DEFAULT 'pending',
    executed_by INT,
    executed_at DATETIME,
    screenshot_path VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (executed_by) REFERENCES users(id) ON DELETE SET NULL,
    
    INDEX idx_task (task_id),
    INDEX idx_status (status)
);

-- =====================================================
-- TABEL UPLOADS (Riwayat File)
-- =====================================================
CREATE TABLE uploads (
    id INT PRIMARY KEY AUTO_INCREMENT,
    task_id INT NOT NULL,
    user_id INT NOT NULL,
    file_name VARCHAR(255),
    file_path VARCHAR(500),
    file_size INT,
    file_type VARCHAR(100),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    INDEX idx_task_file (task_id)
);

-- =====================================================
-- TABEL TELEGRAM LOGS
-- =====================================================
CREATE TABLE telegram_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    task_id INT,
    message_id VARCHAR(100),
    message_type ENUM('verification', 'task_notification', 'approval', 'rejection'),
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    
    INDEX idx_user (user_id),
    INDEX idx_task (task_id)
);

-- =====================================================
-- TABEL ACTIVITY LOGS (Audit Trail)
-- =====================================================
CREATE TABLE activity_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    action VARCHAR(50),
    entity_type VARCHAR(50),
    entity_id INT,
    details JSON,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    
    INDEX idx_user_action (user_id, action),
    INDEX idx_entity (entity_type, entity_id),
    INDEX idx_created (created_at)
);

-- =====================================================
-- INSERT DATA DEFAULT (Admin & Sample User)
-- =====================================================

-- Password: admin123 (hash bcrypt)
INSERT INTO users (username, email, password, full_name, role, telegram_verified) VALUES
('admin', 'admin@taskbot.com', '$2b$10$YourHashedPasswordHere', 'Administrator', 'admin', TRUE);

-- Password: user123
INSERT INTO users (username, email, password, full_name, role, telegram_verified) VALUES
('user1', 'user1@taskbot.com', '$2b$10$YourHashedPasswordHere', 'Regular User', 'user', FALSE);

-- Note: Ganti hash password dengan hasil bcrypt yang sebenarnya
-- Cara generate: node -e "console.log(require('bcryptjs').hashSync('admin123', 10))"

-- =====================================================
-- CREATE VIEWS
-- =====================================================

-- View untuk dashboard admin
CREATE VIEW vw_task_summary AS
SELECT 
    t.*,
    assignee.username as assignee_username,
    assignee.full_name as assignee_name,
    creator.username as creator_username,
    creator.full_name as creator_name,
    approver.username as approver_username,
    approver.full_name as approver_name,
    COUNT(DISTINCT tc.id) as total_test_cases,
    SUM(CASE WHEN tc.status = 'passed' THEN 1 ELSE 0 END) as passed_tests,
    SUM(CASE WHEN tc.status = 'failed' THEN 1 ELSE 0 END) as failed_tests
FROM tasks t
LEFT JOIN users assignee ON t.assignee_id = assignee.id
LEFT JOIN users creator ON t.created_by = creator.id
LEFT JOIN users approver ON t.approved_by = approver.id
LEFT JOIN test_cases tc ON t.id = tc.task_id
GROUP BY t.id;

-- View untuk user tasks
CREATE VIEW vw_user_tasks AS
SELECT 
    t.*,
    creator.username as creator_username,
    approver.username as approver_username
FROM tasks t
JOIN users assignee ON t.assignee_id = assignee.id
LEFT JOIN users creator ON t.created_by = creator.id
LEFT JOIN users approver ON t.approved_by = approver.id;

-- =====================================================
-- CREATE TRIGGERS
-- =====================================================

DELIMITER //

-- Trigger untuk log aktivitas task
CREATE TRIGGER after_task_insert
AFTER INSERT ON tasks
FOR EACH ROW
BEGIN
    INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details)
    VALUES (NEW.created_by, 'CREATE_TASK', 'task', NEW.id, 
            JSON_OBJECT('title', NEW.title, 'assignee', NEW.assignee_id));
END//

CREATE TRIGGER after_task_update
AFTER UPDATE ON tasks
FOR EACH ROW
BEGIN
    IF OLD.status != NEW.status THEN
        INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details)
        VALUES (NEW.created_by, 'UPDATE_TASK_STATUS', 'task', NEW.id,
                JSON_OBJECT('old_status', OLD.status, 'new_status', NEW.status));
    END IF;
    
    IF OLD.approval_status != NEW.approval_status THEN
        INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details)
        VALUES (NEW.approved_by, 'APPROVE_TASK', 'task', NEW.id,
                JSON_OBJECT('status', NEW.approval_status));
    END IF;
END//

DELIMITER ;

-- =====================================================
-- CREATE STORED PROCEDURES
-- =====================================================

DELIMITER //

-- Procedure untuk mendapatkan tasks berdasarkan user
CREATE PROCEDURE GetUserTasks(IN p_user_id INT, IN p_role VARCHAR(20))
BEGIN
    IF p_role = 'admin' THEN
        SELECT * FROM vw_task_summary ORDER BY created_at DESC;
    ELSE
        SELECT * FROM vw_user_tasks 
        WHERE assignee_id = p_user_id 
        ORDER BY created_at DESC;
    END IF;
END//

-- Procedure untuk approve task
CREATE PROCEDURE ApproveTask(IN p_task_id INT, IN p_admin_id INT)
BEGIN
    UPDATE tasks 
    SET status = 'approved',
        approval_status = 'approved',
        approved_by = p_admin_id,
        approved_at = NOW(),
        completed_at = NOW()
    WHERE id = p_task_id;
    
    INSERT INTO activity_logs (user_id, action, entity_type, entity_id)
    VALUES (p_admin_id, 'APPROVE_TASK', 'task', p_task_id);
END//

DELIMITER ;
