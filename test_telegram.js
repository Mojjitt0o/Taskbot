require('dotenv').config();
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