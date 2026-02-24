// =====================================================
// CREATE ADMIN USER
// =====================================================

const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const readline = require('readline');
require('dotenv').config();

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

async function createAdmin() {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   👤 CREATE ADMIN USER                                   ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
    `);
    
    rl.question('Username: ', async (username) => {
        rl.question('Email: ', async (email) => {
            rl.question('Full Name: ', async (fullName) => {
                rl.question('Password: ', async (password) => {
                    rl.question('Telegram Chat ID (optional): ', async (telegramChatId) => {
                        
                        try {
                            const connection = await mysql.createConnection({
                                host: process.env.DB_HOST || 'localhost',
                                user: process.env.DB_USER || 'root',
                                password: process.env.DB_PASSWORD || '',
                                database: process.env.DB_NAME || 'task_bot_db'
                            });
                            
                            // Check if user exists
                            const [existing] = await connection.query(
                                'SELECT id FROM users WHERE username = ? OR email = ?',
                                [username, email]
                            );
                            
                            if (existing.length > 0) {
                                console.log('❌ Username or email already exists');
                                rl.close();
                                return;
                            }
                            
                            // Hash password
                            const hashedPassword = await bcrypt.hash(password, 10);
                            
                            // Insert admin
                            const [result] = await connection.query(
                                `INSERT INTO users 
                                (username, email, password, full_name, role, telegram_chat_id, telegram_verified) 
                                VALUES (?, ?, ?, ?, 'admin', ?, 1)`,
                                [username, email, hashedPassword, fullName, telegramChatId || null]
                            );
                            
                            console.log(`
✅ ADMIN USER CREATED SUCCESSFULLY!
──────────────────────────────────
🆔 ID: ${result.insertId}
👤 Username: ${username}
📧 Email: ${email}
👑 Role: admin
📱 Telegram: ${telegramChatId || 'Not set'}
                            `);
                            
                            await connection.end();
                            rl.close();
                            
                        } catch (error) {
                            console.error('❌ Error:', error.message);
                            rl.close();
                        }
                    });
                });
            });
        });
    });
}

createAdmin();