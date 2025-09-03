const { loginTikTok } = require('./services/puppeteerLogin');
require('dotenv').config();

async function testLogin() {
  console.log('🚀 Starting TikTok login test...');
  
  try {
    const result = await loginTikTok(
      process.env.TIKTOK_USERNAME,
      process.env.TIKTOK_PASSWORD,
      {
        headless: process.env.HEADLESS !== 'false',
        proxyServer: process.env.PROXY_SERVER,
        proxyUsername: process.env.PROXY_USERNAME,
        proxyPassword: process.env.PROXY_PASSWORD
      }
    );

    console.log('✅ Login successful!');
    console.log('Session info:', {
      hasSession: !!result.session,
      cookies: result.cookies ? `${result.cookies.length} cookies` : 'none',
      userData: result.userData ? 'available' : 'not available'
    });
    
    // Save screenshot to file
    if (result.screenshot) {
      const fs = require('fs');
      const path = 'login-success.png';
      fs.writeFileSync(path, result.screenshot, 'base64');
      console.log(`📸 Screenshot saved to: ${path}`);
    }
    
  } catch (error) {
    console.error('❌ Login failed:', error.message);
    process.exit(1);
  }
}

testLogin();
