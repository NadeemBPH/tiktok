const { loginTikTok } = require('./services/puppeteerLogin');
const fs = require('fs').promises;

async function testLogin() {
  console.log('🚀 Starting TikTok login test...');
  
  try {
    // Get credentials from environment or use test credentials
    const username = process.env.TIKTOK_USERNAME || 'your_username';
    const password = process.env.TIKTOK_PASSWORD || 'your_password';
    
    if (username === 'your_username' || password === 'your_password') {
      throw new Error('Please set TIKTOK_USERNAME and TIKTOK_PASSWORD environment variables');
    }

    console.log('🔑 Attempting to log in...');
    
    // Call the login function with extended timeout
    const result = await loginTikTok(username, password, {
      headless: process.env.HEADLESS !== 'false',
      timeout: 60000, // 60 seconds
      launchOptions: {
        defaultViewport: {
          width: 1200,
          height: 800
        }
      }
    });

    console.log('✅ Login successful!');
    console.log('Result:', {
      success: result.success,
      message: result.message,
      cookies: result.cookies ? `${result.cookies.length} cookies received` : 'No cookies',
      userAgent: result.userAgent
    });

    // Save screenshot if available
    if (result.screenshot) {
      await fs.writeFile('login-success.png', result.screenshot, 'base64');
      console.log('📸 Screenshot saved as login-success.png');
    }

    // Save cookies if available
    if (result.cookies) {
      await fs.writeFile('cookies.json', JSON.stringify(result.cookies, null, 2));
      console.log('🍪 Cookies saved to cookies.json');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Login failed:');
    console.error(error);
    
    // Save error screenshot if available
    if (error.screenshot) {
      await fs.writeFile('login-error.png', error.screenshot, 'base64');
      console.log('📸 Error screenshot saved as login-error.png');
    }
    
    process.exit(1);
  }
}

// Run the test
testLogin().catch(console.error);
