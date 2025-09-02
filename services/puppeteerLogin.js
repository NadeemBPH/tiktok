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
  
  const HEADLESS_ENV = (process.env.HEADLESS ?? "true").toLowerCase() === "true";
  const DEFAULT_TIMEOUT = parseInt(process.env.PUPPETEER_TIMEOUT || "60000", 10);
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
  
  // First try using 'which' command to find Chrome
  try {
    const { execSync } = require('child_process');
    const chromeBin = execSync('which google-chrome-stable || which google-chrome || which chromium-browser || which chromium', { timeout: 5000 }).toString().trim();
    if (chromeBin) {
      chromePath = chromeBin;
      console.log(`✅ Found Chrome via 'which' command: ${chromePath}`);
    }
  } catch (e) {
    console.log('ℹ️ Could not find Chrome using which command, falling back to path checking');
  }

  // If which didn't find it, check possible paths
  if (!chromePath) {
    for (const path of possibleChromePaths) {
      try {
        await fs.promises.access(path, fs.constants.X_OK);
        chromePath = path;
        console.log(`✅ Found Chrome at: ${chromePath}`);
        break;
      } catch (e) {
        console.log(`❌ Chrome not found at: ${path}`);
      }
    }
  }
  
  // If still no Chrome found and we're in Railway, use the installed Chromium
  if (!chromePath && (process.env.IS_RAILWAY || process.env.RAILWAY)) {
    chromePath = '/usr/bin/google-chrome-stable';
    console.log(`🚂 Railway environment detected, defaulting to: ${chromePath}`);
  }

  if (!chromePath) {
    console.warn('⚠️ No Chrome/Chromium executable found in common locations');
  }

  // Enhanced launch options with VPN/proxy support
  const launchOptions = {
    headless: process.env.HEADLESS !== 'false' ? 'new' : false,
    ignoreHTTPSErrors: true,
    executablePath: chromePath,
    timeout: 30000,
    dumpio: true,
    args: [
      // Essential flags
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      
      // Performance flags
      '--disable-gpu',
      '--disable-software-rasterizer',
      '--disable-features=site-per-process',
      '--disable-features=IsolateOrigins',
      '--shm-size=3gb',
      
      // Security flags
      '--disable-web-security',
      '--disable-blink-features=AutomationControlled',
      '--password-store=basic',
      '--use-mock-keychain',
      
      // UI/UX flags
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-infobars',
      '--window-size=1920,1080',
      '--start-maximized',
      '--disable-popup-blocking',
      '--disable-notifications',
      '--disable-extensions',
      '--mute-audio',
      
      // Network flags
      '--disable-background-networking',
      '--disable-background-timer-throttling',
      '--disable-client-side-phishing-detection',
      '--disable-default-apps',
      '--disable-sync',
      '--metrics-recording-only',
      '--no-default-browser-check',
      '--safebrowsing-disable-auto-update',
      
      // VPN/Proxy support flags
      '--disable-backgrounding-occluded-windows',
      '--disable-breakpad',
      '--disable-component-update',
      '--disable-crash-reporter',
      '--disable-ipc-flooding-protection',
      '--enable-features=NetworkService,NetworkServiceInProcess',
      '--force-color-profile=srgb',
      '--no-pings',
      '--safebrowsing-disable-auto-update',
      
      // Debugging flags (can be removed in production)
      '--remote-debugging-port=9222',
      '--remote-debugging-address=0.0.0.0',
      '--enable-logging',
      '--v=1'
    ],
    defaultViewport: {
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
      hasTouch: false,
      isLandscape: false,
      isMobile: false,
    },
    ignoreDefaultArgs: ['--enable-automation'],
    handleSIGINT: false,
    handleSIGTERM: false,
    handleSIGHUP: false,
    ...opts.launchOptions,
  };

  // Add proxy configuration if enabled
  if (useProxy) {
    const proxyServer = process.env.PROXY_SERVER || opts.proxyServer;
    const proxyUsername = process.env.PROXY_USERNAME || opts.proxyUsername;
    const proxyPassword = process.env.PROXY_PASSWORD || opts.proxyPassword;
    
    if (proxyServer) {
      console.log(`🌐 Using proxy: ${proxyServer}`);
      launchOptions.args.push(`--proxy-server=${proxyServer}`);
      
      // If proxy requires authentication, we'll handle it in the page
      if (proxyUsername && proxyPassword) {
        console.log('🔐 Proxy authentication enabled');
      }
    } else {
      console.warn('⚠️ Proxy enabled but PROXY_SERVER not configured');
    }
  }
  
  console.log('🚀 Launch options prepared with enhanced VPN support');

  try {
    if (connectExisting) {
      try {
        browser = await puppeteer.connect({
          browserURL: remoteDebuggerUrl,
          defaultViewport: null,
          ...opts.connectOptions,
        });
        connectedToExisting = true;
        console.log("✅ Connected to existing Chrome at", remoteDebuggerUrl);
      } catch (err) {
        console.warn("❌ Could not connect to existing Chrome:", err.message, " — falling back to launching.");
        connectedToExisting = false;
      }
    }

    if (!browser) {
      browser = await puppeteer.launch(launchOptions);
      console.log("✅ Launched new browser instance");
    }

    const page = await browser.newPage();

    // Enhanced user agent and viewport
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    // Set timeouts
    page.setDefaultNavigationTimeout(DEFAULT_TIMEOUT);
    page.setDefaultTimeout(DEFAULT_TIMEOUT);

    // Handle proxy authentication if needed
    if (useProxy && process.env.PROXY_USERNAME && process.env.PROXY_PASSWORD) {
      await page.authenticate({
        username: process.env.PROXY_USERNAME,
        password: process.env.PROXY_PASSWORD
      });
    }

    // Enhanced login URLs with better fallback
    const loginUrls = [
      "https://www.tiktok.com/login/phone-or-email/email",
      "https://www.tiktok.com/login/phone-or-email/phone",
      "https://www.tiktok.com/login",
      "https://www.tiktok.com/foryou",
    ];

    let loaded = false;
    let loginPage = null;
    
    for (const url of loginUrls) {
      try {
        console.log(`🔗 Attempting to load: ${url}`);
        await page.goto(url, { waitUntil: "networkidle2", timeout: DEFAULT_TIMEOUT });
        
        // Check if we're already logged in
        const cookies = await page.cookies();
        const sessionCookie = cookies.find((c) => c.name === "sessionid" || c.name === "session_id" || c.name === "sid_tt");
        
        if (sessionCookie) {
          console.log("✅ Already logged in, found session cookie");
          loaded = true;
          loginPage = url;
          break;
        }
        
        // Check if we're on a login page
        const loginElements = await page.$$('input[name="email"], input[name="username"], input[type="password"]');
        if (loginElements.length > 0) {
          console.log(`✅ Found login form on: ${url}`);
          loaded = true;
          loginPage = url;
          break;
        }
        
        // If we're on the main page, try to find login button
        const loginButton = await page.$('a[href*="login"], button[class*="login"]');
        if (loginButton) {
          console.log(`✅ Found login button on: ${url}`);
          await loginButton.click();
          await page.waitForTimeout(2000);
          loaded = true;
          loginPage = url;
          break;
        }
        
      } catch (e) {
        console.log(`❌ Failed to load ${url}: ${e.message}`);
      }
    }
    
    if (!loaded) {
      throw new Error("Failed to reach TikTok login page. Network or site blocking? Try using a VPN.");
    }

    // Enhanced selectors for better compatibility
    const usernameSelectors = [
      'input[name="email"]',
      'input[name="username"]',
      'input[type="text"]',
      'input[placeholder*="Email"]',
      'input[placeholder*="email"]',
      'input[placeholder*="Phone"]',
      'input[placeholder*="phone"]',
      'input[data-testid*="email"]',
      'input[data-testid*="username"]',
    ];

    const passwordSelectors = [
      'input[name="password"]',
      'input[type="password"]',
      'input[placeholder*="Password"]',
      'input[placeholder*="password"]',
      'input[data-testid*="password"]',
    ];

    async function tryType(selectors, value, fieldName) {
      for (const sel of selectors) {
        try {
          const el = await page.$(sel);
          if (el) {
            console.log(`✅ Found ${fieldName} field: ${sel}`);
            await el.click({ clickCount: 3 }).catch(() => {});
            await el.focus();
            await page.evaluate((s) => { 
              const e = document.querySelector(s); 
              if (e) e.value = ""; 
            }, sel).catch(() => {});
            await page.type(sel, value, { delay: 100 });
            return true;
          }
        } catch (e) {
          console.log(`❌ Failed to type in ${sel}: ${e.message}`);
        }
      }
      return false;
    }

    console.log('📝 Attempting to fill login form...');
    const typedUser = await tryType(usernameSelectors, loginUsername, "username");
    const typedPass = await tryType(passwordSelectors, loginPassword, "password");

    if (!typedUser || !typedPass) {
      console.log('🔄 Trying fallback login methods...');
      
      // Try clicking fallback "Use phone / email" etc., then re-try
      const fallbackButtons = [
        "//button[contains(., 'Use phone / email') or contains(., 'Use phone or email') or contains(., 'Email / phone')]",
        "//a[contains(., 'Use phone / email')]",
        "//button[contains(., 'Log in with email')]",
        "//button[contains(., 'Continue with email')]",
      ];
      
      for (const xpath of fallbackButtons) {
        try {
          const els = await page.$x(xpath);
          if (els && els.length) {
            console.log(`✅ Clicking fallback button: ${xpath}`);
            await els[0].click();
            await page.waitForTimeout(2000);
            break;
          }
        } catch (e) {
          console.log(`❌ Failed to click fallback button: ${e.message}`);
        }
      }
      
      // Re-try typing after fallback
      await tryType(usernameSelectors, loginUsername, "username (retry)");
      await tryType(passwordSelectors, loginPassword, "password (retry)");
    }

    // Enhanced submit process
    console.log('🚀 Attempting to submit login form...');
    
    // Try pressing Enter first
    try { 
      await page.keyboard.press("Enter"); 
      console.log('✅ Pressed Enter key');
    } catch (e) {
      console.log('❌ Failed to press Enter: ${e.message}');
    }
    
    // Try clicking submit buttons
    const submitSelectors = [
      'button[type="submit"]',
      'button[role="button"]',
      'button[class*="login"]',
      'button[class*="submit"]',
      'button[data-testid*="login"]',
      'button[data-testid*="submit"]',
    ];
    
    for (const sel of submitSelectors) {
      try {
        const el = await page.$(sel);
        if (el) {
          console.log(`✅ Clicking submit button: ${sel}`);
          await el.click();
          break;
        }
      } catch (e) {
        console.log(`❌ Failed to click submit button ${sel}: ${e.message}`);
      }
    }

    // Enhanced session cookie detection
    console.log('🔍 Waiting for session cookie...');
    const checkInterval = 1000;
    const maxChecks = Math.ceil(DEFAULT_TIMEOUT / checkInterval);
    let sessionCookie = null;

    for (let i = 0; i < maxChecks; i++) {
      const cookies = await page.cookies();
      sessionCookie = cookies.find((c) => c.name === "sessionid" || c.name === "session_id" || c.name === "sid_tt");
      
      if (sessionCookie) {
        console.log(`✅ Found session cookie: ${sessionCookie.name}`);
        break;
      }
      
      // Check for captcha/verification
      const bodyText = await page.evaluate(() => document.body.innerText || "");
      if (/captcha|verify|verification|2fa|two-step/i.test(bodyText)) {
        throw new Error("TikTok displayed a captcha/verification step. Manual interaction required (use HEADLESS=false to inspect).");
      }
      
      // Check for login errors
      if (/incorrect|invalid|wrong|failed/i.test(bodyText)) {
        throw new Error("Login failed: Invalid credentials or account locked.");
      }
      
      await page.waitForTimeout(checkInterval);
    }

    if (!sessionCookie) {
      // Fallback: try to navigate to profile page
      console.log('🔄 Fallback: Navigating to profile page...');
      try {
        await page.goto("https://www.tiktok.com/@" + encodeURIComponent(loginUsername), { 
          waitUntil: "networkidle2", 
          timeout: 8000 
        });
        const cookies = await page.cookies();
        sessionCookie = cookies.find((c) => c.name === "sessionid" || c.name === "session_id" || c.name === "sid_tt");
      } catch (e) {
        console.log(`❌ Fallback navigation failed: ${e.message}`);
      }
    }

    if (!sessionCookie) {
      const allCookies = await page.cookies();
      console.log('❌ Available cookies:', allCookies.map(c => ({ name: c.name, domain: c.domain })));
      
      // Cleanup
      try { await page.close(); } catch (_) {}
      if (!connectedToExisting) {
        try { await browser.close(); } catch (_) {}
      }
      
      throw new Error("Login did not produce session cookie. Possible issues:\n" +
        "1. Captcha/2FA required\n" +
        "2. Wrong credentials\n" +
        "3. Account locked\n" +
        "4. TikTok blocking requests (try VPN)\n" +
        "5. Site structure changed");
    }

    // Gather all cookies
    const cookies = await page.cookies();
    console.log(`✅ Login successful! Found ${cookies.length} cookies`);

    // Cleanup
    try { await page.close(); } catch (_) {}
    if (!connectedToExisting) {
      try { await browser.close(); } catch (_) {}
    }

    return cookies;
  } catch (err) {
    console.error('❌ Login failed:', err.message);
    
    // Enhanced error handling
    if (err.message.includes('ERR_CONNECTION_REFUSED') || err.message.includes('ERR_NAME_NOT_RESOLVED')) {
      throw new Error("Network connection failed. TikTok may be blocked in your region. Please use a VPN.");
    } else if (err.message.includes('ERR_TIMED_OUT')) {
      throw new Error("Request timed out. TikTok servers may be slow or blocking requests. Try again later or use a VPN.");
    } else if (err.message.includes('ERR_SSL_PROTOCOL_ERROR')) {
      throw new Error("SSL error. This may be due to network restrictions. Try using a VPN.");
    }
    
    // Cleanup on failure
    try {
      if (browser && !connectedToExisting) await browser.close();
    } catch (_) {}
    
    throw err;
  }
}

module.exports = { loginTikTok };
