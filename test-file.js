// test-file.js
const fs = require('fs');
const path = require('path');

function checkUploadedFiles() {
    console.log('\n🔍 CHECKING UPLOADED FILES...\n');
    
    const subfolders = ['images', 'documents', 'screenshots', 'videos'];
    
    subfolders.forEach(subfolder => {
        const folderPath = path.join(__dirname, 'uploads', subfolder);
        
        if (fs.existsSync(folderPath)) {
            const files = fs.readdirSync(folderPath);
            console.log(`📁 ${subfolder}: ${files.length} files`);
            
            files.forEach(file => {
                const filePath = path.join(folderPath, file);
                const stats = fs.statSync(filePath);
                const sizeKB = (stats.size / 1024).toFixed(2);
                console.log(`   - ${file} (${sizeKB} KB)`);
            });
            console.log('');
        } else {
            console.log(`📁 ${subfolder}: Folder not found\n`);
        }
    });
}

checkUploadedFiles();