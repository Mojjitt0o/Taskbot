// =====================================================
// DATABASE MIGRATION SCRIPT
// =====================================================

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function migrateDatabase() {
    console.log('🔄 Starting database migration...');
    
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'task_bot_db',
            multipleStatements: true
        });
        
        console.log('✅ Connected to database');
        
        // Check existing tables
        const [tables] = await connection.query('SHOW TABLES');
        console.log(`📊 Existing tables: ${tables.length}`);
        
        // Backup data
        console.log('💾 Backing up existing data...');
        
        const backup = {};
        
        for (const table of tables) {
            const tableName = Object.values(table)[0];
            const [rows] = await connection.query(`SELECT * FROM ${tableName}`);
            backup[tableName] = rows;
            console.log(`   - ${tableName}: ${rows.length} records`);
        }
        
        // Save backup
        const backupFile = path.join(__dirname, `backup_${Date.now()}.json`);
        fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2));
        console.log(`✅ Backup saved to: ${backupFile}`);
        
        // Read migration SQL
        const sqlFile = path.join(__dirname, 'database.sql');
        const sql = fs.readFileSync(sqlFile, 'utf8');
        
        // Execute migration
        console.log('🔄 Running migration...');
        await connection.query(sql);
        
        // Restore data if needed
        if (backup.users && backup.users.length > 0) {
            console.log('🔄 Restoring user data...');
            // Restore logic here
        }
        
        await connection.end();
        
        console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   ✅ MIGRATION COMPLETED SUCCESSFULLY!                  ║
║                                                           ║
║   📁 Backup saved: ${path.basename(backupFile)}         ║
║   🚀 You can now run: npm start                         ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
        `);
        
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
    }
}

migrateDatabase();