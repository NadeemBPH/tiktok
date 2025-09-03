// services/puppeteerLogin.js
const puppeteer = require("puppeteer");
const fs = require("fs");
require("dotenv").config();

/**
 * Enhanced TikTok login using Puppeteer with VPN/proxy support.
 * - Supports proxy configuration for VPN environments
 * - Enhanced error handling for blocked regions
 * - Improved login flow with better selectors
 * - Better session management
 */
async function loginTikTok(loginUsername, loginPassword, opts = {}) {
  console.log('🚀 Starting enhanced TikTok login process...');
  console.log('Environment:', {
    NODE_ENV: process.env.NODE_ENV,
    IS_RAILWAY: process.env.IS_RAILWAY || 'false',
    RAILWAY: process.env.RAILWAY || 'false',
    USE_PROXY: process.env.USE_PROXY || 'false'
  });
  
  const isProduction = (process.env.NODE_ENV || '').toLowerCase() === 'production';
  const DEFAULT_TIMEOUT = Math.min(parseInt(process.env.PUPPETEER_TIMEOUT || "45000", 10), 60000);
  const connectExisting = (process.env.CONNECT_EXISTING_CHROME === "true") || opts.connectExisting;
  const useProxy = (process.env.USE_PROXY === "true") || opts.useProxy;

  const remoteDebuggerUrl = process.env.CONNECTED_CHROME_URL || opts.connectedChromeUrl || "http://127.0.0.1:9222";

  let browser;
  let connectedToExisting = false;

  console.log('🔍 Checking for Chrome/Chromium in common locations...');
  
  const possibleChromePaths = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    process.env.CHROME_BIN,
    process.env.CHROME_PATH,
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/usr/local/bin/google-chrome-stable',
    '/usr/local/bin/google-chrome',
    '/usr/local/bin/chromium-browser',
    '/usr/local/bin/chromium'
  ].filter(Boolean);

  let chromePath = null;
  
  try {
    const { execSync } = require('child_process');
    const chromeBin = execSync('which google-chrome-stable || which google-chrome || which chromium-browser || which chromium', { timeout: 3000 }).toString().trim();
    if (chromeBin) {
      chromePath = chromeBin;
      console.log(`✅ Found Chrome via 'which' command: ${chromePath}`);
    }
  } catch (e) {
    console.log('ℹ️ Could not find Chrome using which command, falling back to path checking');
  }

  if (!chromePath) {
    for (const path of possibleChromePaths) {
      try {
        await fs.promises.access(path, fs.constants.X_OK);
        chromePath = path;
        console.log(`✅ Found Chrome at: ${chromePath}`);
        break;
      } catch (e) {}
    }
  }

  // Minimal, stable launch options for Railway
  // Enhanced launch options to avoid detection
  const launchOptions = {
    // headless: isProduction ? 'new' : (process.env.HEADLESS !== 'false' ? 'new' : false),
    headless: "new", 
    ignoreHTTPSErrors: true,
    executablePath: '/usr/bin/google-chrome-stable',
    timeout: Math.min(DEFAULT_TIMEOUT, 30000),
    dumpio: true, // Enable verbose logging
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
    ],
    defaultViewport: { 
      width: 1366, 
      height: 768,
      deviceScaleFactor: 1,
      isMobile: false,
      hasTouch: false
    },
    ignoreDefaultArgs: ['--enable-automation'],
    handleSIGINT: false,
    handleSIGTERM: false,
    handleSIGHUP: false,
    ...opts.launchOptions,
  };

  // Enhanced Proxy configuration
  if (useProxy) {
    const proxyServer = process.env.PROXY_SERVER || opts.proxyServer || 'http://185.199.229.156:7492';
    if (proxyServer) {
      console.log(`🔌 Using proxy server: ${proxyServer}`);
      launchOptions.args.push(
        `--proxy-server=${proxyServer}`,
        '--proxy-bypass-list=<-loopback>',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-site-isolation-trials',
        '--disable-web-security',
        '--disable-blink-features=AutomationControlled'
      );
      
      // Add proxy authentication if credentials are provided
      if (process.env.PROXY_USERNAME && process.env.PROXY_PASSWORD) {
        console.log('🔑 Proxy authentication enabled');
      }
    } else {
      console.warn('⚠️ Proxy enabled but no proxy server specified. Running without proxy.');
    }
  }

  console.log('🚀 Preparing browser launch options...');

  try {
    // First try to connect to existing Chrome instance
    if (connectExisting || isProduction) {
      try {
        console.log('🔍 Attempting to connect to existing Chrome instance...');
        browser = await puppeteer.connect({ 
          browserURL: 'http://127.0.0.1:9222', 
          defaultViewport: null, 
          ...opts.connectOptions 
        });
        
        // Create a new page in the existing browser
        const pages = await browser.pages();
        const page = pages.length > 0 ? pages[0] : await browser.newPage();
        await page.setViewport({ width: 1366, height: 768 });
        
        connectedToExisting = true;
        console.log("✅ Connected to existing Chrome at", remoteDebuggerUrl);
        
        // Try to use the existing page
        try {
          await page.goto('about:blank');
          console.log('🔄 Using existing browser tab');
          return { browser, page };
        } catch (err) {
          console.warn('⚠️ Could not use existing tab, falling back to new window');
          await page.close();
        }
      } catch (err) {
        console.warn("❌ Could not connect to existing Chrome:", err.message, " — falling back to launching new instance.");
        connectedToExisting = false;
      }
    }

    // If we get here, we need to launch a new browser instance
    console.log('🚀 Launching new browser instance with VPN support...');
    
    // Add extension directory if specified
    if (process.env.CHROME_EXTENSION_DIR) {
      launchOptions.args.push(`--load-extension=${process.env.CHROME_EXTENSION_DIR}`);
      console.log('🔌 Loading Chrome extensions from:', process.env.CHROME_EXTENSION_DIR);
    }

    // Add user data directory to maintain extensions and cookies
    if (process.env.CHROME_USER_DATA_DIR) {
      launchOptions.args.push(`--user-data-dir=${process.env.CHROME_USER_DATA_DIR}`);
      console.log('📁 Using Chrome user data from:', process.env.CHROME_USER_DATA_DIR);
    }

    browser = await puppeteer.launch(launchOptions);
    console.log("✅ Launched new browser instance");

    const page = await browser.newPage();
    
    // Set a realistic user agent
    const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    await page.setUserAgent(userAgent);
    
    // Set viewport and device metrics
    await page.setViewport({ 
      width: 1366, 
      height: 768,
      deviceScaleFactor: 1,
      isMobile: false,
      hasTouch: false
    });

    // Set timeouts
    page.setDefaultNavigationTimeout(DEFAULT_TIMEOUT);
    page.setDefaultTimeout(DEFAULT_TIMEOUT);

    // Set proxy authentication if needed
    if (useProxy && process.env.PROXY_USERNAME && process.env.PROXY_PASSWORD) {
      console.log('🔐 Authenticating with proxy...');
      await page.authenticate({ 
        username: process.env.PROXY_USERNAME, 
        password: process.env.PROXY_PASSWORD 
      });
    }

    // Randomize some browser properties to avoid detection
    await page.evaluateOnNewDocument(() => {

      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      // Overwrite the `plugins` property to use a custom getter
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });

      // Overwrite the `languages` property to use a custom getter
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });

      // Overwrite the `webdriver` property to make it false
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });

      // Set Chrome app version to a common one
      Object.defineProperty(navigator, 'appVersion', {
        get: () => '5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      });
    });

    // Block unnecessary resources to speed up loading
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const url = request.url();
      const resourceType = request.resourceType();
      
      // Block unnecessary resources
      const blockResources = ['image', 'stylesheet', 'font', 'media', 'imageset', 'other'];
      const blockedDomains = ['analytics', 'facebook', 'google-analytics', 'doubleclick', 'googletagmanager'];
      
      // Block resources from blocked domains
      const shouldBlock = blockedDomains.some(domain => url.includes(domain)) || 
                         blockResources.includes(resourceType);
      
      if (shouldBlock) {
        request.abort();
      } else {
        request.continue();
      }
    });

    // Try multiple login URLs with different approaches and user agents
    const loginUrls = [
      { 
        url: 'https://www.tiktok.com/login/phone-or-email/email', 
        method: 'direct',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      { 
        url: 'https://www.tiktok.com/login', 
        method: 'direct',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      { 
        url: 'https://www.tiktok.com/', 
        method: 'navigate',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0'
      }
    ];

    let loaded = false;
    for (const { url, method, userAgent } of loginUrls) {
      try {
        console.log(`🌐 Attempting to load: ${url} (${method})`);
        
        // Set user agent for this attempt
        await page.setUserAgent(userAgent);
        
        // Set extra headers to mimic a real browser
        await page.setExtraHTTPHeaders({
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
          'Referer': 'https://www.google.com/',
          'Upgrade-Insecure-Requests': '1'
        });
        
        if (method === 'direct') {
          await page.goto(url, { 
            waitUntil: ['domcontentloaded', 'networkidle2'],
            timeout: 60000, // Increased timeout to 60 seconds
            referer: 'https://www.google.com/'
          });
        } else {
          // Try loading homepage first, then navigate to login
          await page.goto('https://www.tiktok.com/', { 
            waitUntil: 'networkidle2',
            timeout: DEFAULT_TIMEOUT
          });
          
          // Click on login button if it exists
          const loginButton = await page.$('div[data-e2e="top-login-button"]');
          if (loginButton) {
            await Promise.all([
              loginButton.click(),
              page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {})
            ]);
          } else {
            await page.goto(url, { 
              waitUntil: 'networkidle2',
              timeout: DEFAULT_TIMEOUT
            });
          }
        }
        
        // Check if we're on a login page
        const isLoginPage = await page.evaluate(() => {
          return document.querySelector('input[type="email"], input[type="password"]') !== null || 
                 document.querySelector('button[type="submit"]') !== null;
        });
        
        if (isLoginPage) {
          loaded = true;
          console.log('✅ Successfully loaded login page');
          break;
        }
      } catch (error) {
        console.warn(`⚠️ Failed to load ${url}:`, error.message);
        // Take a screenshot for debugging
        await page.screenshot({ path: `error-${Date.now()}.png` }).catch(() => {});
      }
    }
    
    if (!loaded) {
      throw new Error("Failed to reach TikTok login page. The site might be blocking automated access. Please try again later or use a different IP/proxy.");
    }

    // Add random delays between actions to mimic human behavior
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    const randomDelay = (min, max) => delay(Math.random() * (max - min) + min);

    // Selectors with higher priority first
    const usernameSelectors = [
      'input[type="email"]',
      'input[name="email"]',
      'input[name="username"]',
      'input[type="text"]',
      'input[placeholder*="email" i]',
      'input[placeholder*="username" i]',
      'input[placeholder*="login" i]',
      'input[autocomplete="email"]',
      'input[autocomplete="username"]'
    ];

    const passwordSelectors = [
      'input[type="password"]',
      'input[name="password"]',
      'input[placeholder*="password" i]',
      'input[autocomplete="current-password"]'
    ];

    const loginButtonSelectors = [
      'button[type="submit"]',
      'button:has-text("Log in")',
      'button:has-text("Sign in")',
      'button:contains("Log in")',
      'button:contains("Sign in")',
      'div[data-e2e="login-button"]',
      'button.login-button',
      'button.btn-login'
    ];

    // Helper function to type with human-like delays
    async function humanType(element, text) {
      await element.click({ clickCount: 3 }); // Select all text if any
      await element.press('Backspace');
      
      // Type with random delays between keystrokes
      for (const char of text) {
        await element.type(char, { delay: Math.random() * 50 + 30 });
      }
      
      // Random delay after typing
      await randomDelay(100, 300);
    }

    // Helper function to find and interact with elements
    async function tryType(selectors, value) {
      for (const sel of selectors) {
        try {
          const el = await page.$(sel);
          if (!el) continue;
          
          await el.scrollIntoViewIfNeeded();
          await el.click({ clickCount: 3 }).catch(() => {}); // Select all text if any
          await delay(100);
          await humanType(el, value);
          return true;
        } catch (error) {
          console.warn(`Failed with selector ${sel}:`, error.message);
        }
      }
      return false;
    }

    // Type username and password with error handling
    console.log('🔑 Attempting to enter credentials...');
    const typedUser = await tryType(usernameSelectors, loginUsername);
    if (!typedUser) {
      throw new Error('Failed to find username/email field. The page structure might have changed.');
    }
    
    await randomDelay(500, 1500); // Natural delay between fields
    
    const typedPass = await tryType(passwordSelectors, loginPassword);
    if (!typedPass) {
      throw new Error('Failed to find password field. The page structure might have changed.');
    }
    
    console.log('✅ Credentials entered successfully');
    await randomDelay(800, 2000); // Natural delay before submission
    
    // Try to submit the form
    console.log('🚀 Attempting to submit login form...');
    
    // First try: Press Enter on the password field
    try {
      const passwordField = await page.$('input[type="password"]');
      if (passwordField) {
        await passwordField.press('Enter');
        console.log('🔘 Submitted form using Enter key');
        await randomDelay(2000, 4000);
      }
    } catch (error) {
      console.warn('Could not submit with Enter key:', error.message);
    }
    
    // Second try: Click the login button directly
    let loginSuccessful = false;
    for (const sel of loginButtonSelectors) {
      try {
        const buttons = await page.$$(sel);
        for (const button of buttons) {
          try {
            const isVisible = await button.isVisible();
            if (isVisible) {
              await button.scrollIntoViewIfNeeded();
              await randomDelay(300, 800);
              await button.click({ delay: 100 });
              console.log(`✅ Clicked login button with selector: ${sel}`);
              loginSuccessful = true;
              await randomDelay(2000, 4000);
              break;
            }
          } catch (error) {
            console.warn(`Error clicking button with selector ${sel}:`, error.message);
          }
        }
        if (loginSuccessful) break;
      } catch (error) {
        console.warn(`Error finding login button with selector ${sel}:`, error.message);
      }
    }
    
    // Check for login success or failure
    console.log('🔍 Checking login status...');
    await randomDelay(3000, 6000); // Wait for any redirects or error messages
    
    // Check for error messages
    const errorMessages = await page.evaluate(() => {
      const errorElements = Array.from(document.querySelectorAll('[role="alert"], .error-message, .error, .error-text, [class*="error" i]'));
      return errorElements.map(el => el.textContent.trim()).filter(Boolean);
    });
    
    if (errorMessages.length > 0) {
      throw new Error(`Login failed: ${errorMessages.join(' | ')}`);
    }
    
    // Check if we're on a logged-in page
    const isLoggedIn = await page.evaluate(() => {
      return !document.querySelector('input[type="password"]') && 
             (document.body.innerText.includes('For You') || 
              document.body.innerText.includes('Following') ||
              !!document.querySelector('[data-e2e="top-logo"]'));
    });
    
    if (!isLoggedIn) {
      // Take a screenshot for debugging
      const screenshotPath = `login-error-${Date.now()}.png`;
      await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});
      console.warn(`⚠️ Login status unclear. Saved screenshot to ${screenshotPath}`);
      
      // Check for captcha
      const hasCaptcha = await page.evaluate(() => {
        return !!document.querySelector('iframe[src*="captcha"], .captcha-container, #captcha');
      });
      
      if (hasCaptcha) {
        throw new Error('CAPTCHA detected. Please try again later or use a different IP/proxy.');
      }
      
      throw new Error('Login failed. Please check your credentials and try again.');
    }
    
    console.log('🎉 Successfully logged in!');
    
    // Wait for session cookie to be set
    console.log('🔍 Waiting for session cookie...');
    const checkInterval = 1000;
    const maxChecks = 10; // 10 seconds max
    let sessionCookie = null;
    let attempts = 0;
    
    while (attempts < maxChecks && !sessionCookie) {
      attempts++;
      await delay(checkInterval);
      
      // Check for session cookies
      const allCookies = await page.cookies();
      sessionCookie = allCookies.find(c => 
        c.name.includes('session') || 
        c.name.includes('sid_tt') || 
        c.name === 'sessionid' || 
        c.name === 'session_id'
      );
      
      // Check if we're still on the login page (which would indicate login failure)
      const stillOnLoginPage = await page.evaluate(() => {
        return !!document.querySelector('input[type="password"]') || 
               !!document.querySelector('button[type="submit"]');
      });
      
      if (stillOnLoginPage && attempts > 3) {
        // If we're still on the login page after a few attempts, check for errors
        const errorMessage = await page.evaluate(() => {
          const errorEl = document.querySelector('[role="alert"], .error-message, .error, .error-text, [class*="error" i]');
          return errorEl ? errorEl.textContent.trim() : null;
        });
        
        if (errorMessage) {
          throw new Error(`Login error: ${errorMessage}`);
        }
      }
      
      console.log(`Attempt ${attempts}/${maxChecks}: ${sessionCookie ? 'Session found' : 'Waiting for session...'}`);
    }
    
    if (!sessionCookie) {
      // Take a screenshot for debugging
      const screenshotPath = `login-session-error-${Date.now()}.png`;
      await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});
      console.warn(`⚠️ Could not find session cookie. Saved screenshot to ${screenshotPath}`);
      
      // Check if we're actually logged in despite missing session cookie
      const isActuallyLoggedIn = await page.evaluate(() => {
        return !document.querySelector('input[type="password"]') && 
               (document.body.innerText.includes('For You') || 
                document.body.innerText.includes('Following') ||
                !!document.querySelector('[data-e2e="top-logo"]'));
      });
      
      if (!isActuallyLoggedIn) {
        throw new Error('Login verification failed. Please check your credentials and try again.');
      }
      
      console.warn('⚠️ Proceeding without session cookie - user appears to be logged in');
    }
    
    // Get final cookies and user data
    const finalCookies = await page.cookies();
    const userData = await page.evaluate(() => {
      try {
        const script = Array.from(document.scripts).find(s => 
          s.textContent && s.textContent.includes('SIGI_STATE')
        );
        if (script) {
          const match = script.textContent.match(/SIGI_STATE\s*=\s*({.+?});/);
          if (match) {
            return JSON.parse(match[1]);
          }
        }
      } catch (e) {
        console.warn('Error extracting user data:', e.message);
        return null;
      }
      return null;
    });
    
    console.log('✅ Login process completed successfully');
    
    // Final cleanup and return
    try {
      // Take a final screenshot for reference
      const screenshot = await page.screenshot({ encoding: 'base64' });
      
      // Close the browser if we're not reusing it
      if (!connectedToExisting && browser) {
        await browser.close();
      }
      
      // Verify we have a valid session
      if (!sessionCookie) {
        throw new Error('Login did not produce a valid session. Please check your credentials and try again.');
      }
      
      return {
        success: true,
        cookies: finalCookies,
        session: sessionCookie,
        userData: userData,
        userAgent: userAgent,
        screenshot: screenshot
      };
      
    } catch (error) {
      console.error('❌ Error during login process:', error.message);
      
      // Take a screenshot of the error state
      try {
        await page.screenshot({ path: `login-error-${Date.now()}.png`, fullPage: true });
      } catch (screenshotError) {
        console.warn('Could not take error screenshot:', screenshotError.message);
      }
      
      // Ensure browser is closed even if there's an error
      try {
        if (!connectedToExisting && browser) {
          await browser.close();
        }
      } catch (closeError) {
        console.warn('Error closing browser:', closeError.message);
      }
      
      // Re-throw the original error
      throw error;
    }
  } catch (err) {
    try { 
      if (browser && !connectedToExisting) await browser.close(); 
    } catch (_) {}
    throw err;
  }
}

module.exports = { loginTikTok };
