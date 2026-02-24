// =====================================================
// SETUP DATABASE - CREATE TABLES & DEFAULT ADMIN
// =====================================================

const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function setupDatabase() {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🗄️  TASK BOT DATABASE SETUP                           ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
    `);
    
    try {
        // Connect without database selected
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            multipleStatements: true
        });
        
        console.log('📦 Connected to MySQL server');
        
        // Read SQL file
        const sqlFile = path.join(__dirname, 'database.sql');
        const sql = fs.readFileSync(sqlFile, 'utf8');
        
        // Execute SQL
        console.log('🔄 Creating database and tables...');
        await connection.query(sql);
        console.log('✅ Database and tables created successfully');
        
        // Generate password hash for admin
        const adminPassword = 'admin123';
        const userPassword = 'user123';
        
        const hashedAdminPassword = await bcrypt.hash(adminPassword, 10);
        const hashedUserPassword = await bcrypt.hash(userPassword, 10);
        
        // Update SQL with real hashed passwords
        const [db] = await connection.query('USE task_bot_db');
        
        // Insert admin user
        await connection.query(
            `INSERT INTO users (username, email, password, full_name, role, telegram_verified) 
             VALUES (?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE 
             password = VALUES(password),
             full_name = VALUES(full_name),
             role = VALUES(role)`,
            ['admin', 'admin@taskbot.com', hashedAdminPassword, 'Administrator', 'admin', true]
        );
        
        // Insert regular user
        await connection.query(
            `INSERT INTO users (username, email, password, full_name, role, telegram_verified) 
             VALUES (?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE 
             password = VALUES(password),
             full_name = VALUES(full_name)`,
            ['user1', 'user1@taskbot.com', hashedUserPassword, 'Regular User', 'user', false]
        );
        
        console.log('👤 Default users created:');
        console.log('   - Admin: admin / admin123');
        console.log('   - User: user1 / user123');
        
        await connection.end();
        
        console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   ✅ DATABASE SETUP COMPLETED!                           ║
║                                                           ║
║   📊 Database: ${process.env.DB_NAME || 'task_bot_db'}   ║
║   👤 Admin Login: admin / admin123                       ║
║   👤 User Login: user1 / user123                         ║
║                                                           ║
║   🚀 Run: npm start                                      ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
        `);
        
    } catch (error) {
        console.error('❌ Setup failed:', error.message);
        console.log('\n💡 Troubleshooting:');
        console.log('   1. Check if MySQL is running');
        console.log('   2. Verify database credentials in .env');
        console.log('   3. Run: npm install to install dependencies');
        console.log('   4. Run: node setup_db.js again');
    }
}

setupDatabase();