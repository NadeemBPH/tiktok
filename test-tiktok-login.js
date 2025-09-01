const { loginTikTok } = require('./services/puppeteerLogin');
require('dotenv').config();

async function testTikTokLogin() {
  try {
    // Get credentials from environment or use test credentials
    const username = process.env.TIKTOK_USERNAME || 'test@example.com';
    const password = process.env.TIKTOK_PASSWORD || 'testpassword';
    const targetUser = process.env.TIKTOK_TARGET_USER || 'tiktok';

    console.log('🚀 Starting TikTok login test...');
    console.log(`📧 Username: ${username}`);
    console.log(`🎯 Target user: @${targetUser}`);

    // Call the login function
    const result = await loginTikTok(username, password, {
      headless: false, // Set to true in production
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu',
        '--remote-debugging-port=9222',
        '--remote-debugging-address=0.0.0.0'
      ]
    });

    console.log('✅ Login successful!');
    console.log('Result:', result);

  } catch (error) {
    console.error('❌ Login failed:');
    console.error(error);
    
    // Provide helpful error messages
    if (error.message.includes('browser was not found')) {
      console.error('\n🔧 Chrome/Chromium not found. Please check:');
      console.error('1. Is Chrome/Chromium installed?');
      console.error('2. Is the path to Chrome/Chromium correct?');
      console.error('3. Are all required dependencies installed?');
    } else if (error.message.includes('ERR_CONNECTION_REFUSED')) {
      console.error('\n🔧 Connection refused. Is TikTok blocking the request?');
      console.error('1. Try using a VPN or different IP address');
      console.error('2. Check if TikTok is accessible from your location');
    } else if (error.message.includes('timeout')) {
      console.error('\n⏱️  Request timed out. Possible issues:');
      console.error('1. Slow internet connection');
      console.error('2. TikTok server issues');
      console.error('3. Increase timeout in the code if needed');
    }
  }
}

// Run the test
testTikTokLogin().catch(console.error);
