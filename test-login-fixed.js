require('dotenv').config();
const { loginTikTok } = require('./services/puppeteerLogin');
const path = require('path');
const { findChromePaths } = require('./find-chrome-paths');

// Find Chrome user data and VPN extension paths
console.log('🔍 Locating Chrome paths...');
const { userDataDir: CHROME_USER_DATA_DIR, vpnExtensionDir: VPN_EXTENSION_DIR } = findChromePaths();

if (!CHROME_USER_DATA_DIR) {
  console.error('❌ Chrome user data directory not found. Make sure Chrome is installed.');
  process.exit(1);
}

console.log('\nℹ️  Using paths:');
console.log(`   - Chrome User Data: ${CHROME_USER_DATA_DIR}`);
console.log(`   - VPN Extension: ${VPN_EXTENSION_DIR || 'Not found'}`);

if (!VPN_EXTENSION_DIR) {
  console.warn('\n⚠️  No VPN extension found. The script will run without VPN.');
}

async function testLogin() {
  try {
    console.log('🚀 Starting TikTok login test...');
    
    // Get credentials from environment variables or use test credentials
    const username = process.env.TIKTOK_USERNAME || 'your_username';
    const password = process.env.TIKTOK_PASSWORD || 'your_password';
    
    console.log('🔑 Using username:', username);
    
    // Set environment variables for Chrome
    process.env.CHROME_USER_DATA_DIR = CHROME_USER_DATA_DIR;
    process.env.CHROME_EXTENSION_DIR = VPN_EXTENSION_DIR;
    
    // Call the login function with debug options
    const result = await loginTikTok(username, password, {
      headless: false, // Keep false to see the browser
      devtools: true,  // Open devtools for debugging
      slowMo: 100,     // Slow down Puppeteer operations by 100ms
      connectExisting: true, // Try to connect to existing Chrome instance first
      useProxy: true,  // Enable proxy
      proxyServer: 'http://185.199.229.156:7492',
      launchOptions: {
        defaultViewport: null,
        args: [
          '--start-maximized',
          '--disable-blink-features=AutomationControlled',
          '--disable-infobars',
          '--window-size=1920,1080',
          '--remote-debugging-port=9222',
          '--remote-debugging-address=0.0.0.0',
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-software-rasterizer',
          '--disable-web-security',
          '--disable-site-isolation-trials',
          '--disable-features=IsolateOrigins,site-per-process',
          '--disable-webgl',
          '--disable-threaded-animation',
          '--disable-threaded-scrolling',
          '--disable-in-process-stack-traces',
          '--disable-logging',
          '--disable-breakpad',
          '--disable-client-side-phishing-detection',
          '--disable-component-update',
          '--disable-default-apps',
          '--disable-extensions',
          '--disable-hang-monitor',
          '--disable-prompt-on-repost',
          '--disable-sync',
          '--disable-translate',
          '--metrics-recording-only',
          '--mute-audio',
          '--no-default-browser-check',
          '--no-first-run',
          '--no-pings',
          '--password-store=basic',
          '--use-mock-keychain'
        ],
        ignoreDefaultArgs: ['--enable-automation']
      }
    });
    
    console.log('✅ Login successful!');
    console.log('Session data:', result);
    
    // Keep the browser open for inspection
    console.log('⏳ Keeping browser open for 5 minutes...');
    await new Promise(resolve => setTimeout(resolve, 5 * 60 * 1000));
    
    await result.browser.close();
    console.log('👋 Browser closed.');
    
  } catch (error) {
    console.error('❌ Login failed:', error);
    process.exit(1);
  }
}

testLogin();
