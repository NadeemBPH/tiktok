const puppeteer = require('puppeteer');
const fs = require('fs');

async function testBrowser() {
  console.log('🚀 Starting browser test...');
  
  // Check common Chrome paths
  const chromePaths = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    process.env.CHROME_BIN,
    process.env.CHROME_PATH,
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome'
  ];

  console.log('🔍 Checking for Chrome/Chromium in common locations:');
  let chromePath = null;
  
  for (const path of chromePaths) {
    if (path) {
      const exists = fs.existsSync(path);
      console.log(`  ${exists ? '✅' : '❌'} ${path}`);
      if (exists && !chromePath) {
        chromePath = path;
      }
    }
  }

  if (!chromePath) {
    console.error('❌ No Chrome/Chromium found in common locations');
    return;
  }

  console.log(`\n🎯 Using Chrome at: ${chromePath}`);
  
  // Try to launch the browser
  try {
    console.log('\n🚀 Launching browser...');
    const browser = await puppeteer.launch({
      headless: 'new',
      executablePath: chromePath,
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
      ],
      dumpio: true
    });

    console.log('🌐 Browser launched successfully!');
    
    // Test a simple page
    console.log('🌍 Opening test page...');
    const page = await browser.newPage();
    await page.goto('https://example.com');
    
    const title = await page.title();
    console.log(`📄 Page title: ${title}`);
    
    // Take a screenshot
    await page.screenshot({ path: 'test-screenshot.png' });
    console.log('📸 Screenshot saved as test-screenshot.png');
    
    await browser.close();
    console.log('✅ Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during browser test:');
    console.error(error);
    console.error('\n💡 Common solutions:');
    console.error('1. Check if Chrome/Chromium is installed');
    console.error('2. Verify the executable path is correct');
    console.error('3. Check file permissions (should be executable)');
    console.error('4. Ensure all required dependencies are installed');
    
    if (error.message.includes('No usable sandbox')) {
      console.error('\n⚠️  Sandbox issue detected. Try running with --no-sandbox');
    }
    
    if (error.message.includes('executable may have wrong permissions')) {
      console.error('\n⚠️  Permission issue detected. Try: chmod +x', chromePath);
    }
  }
}

// Run the test
testBrowser().catch(console.error);
