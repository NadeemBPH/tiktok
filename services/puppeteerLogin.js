// services/puppeteerLogin.js
const puppeteer = require("puppeteer");
require("dotenv").config();

/**
 * Robust TikTok login using Puppeteer.
 * - If CONNECT_EXISTING_CHROME=true it will try to connect to a running Chrome via remote debugging
 *   and open a NEW TAB there. If connection fails it falls back to launching a new browser.
 * - When connected to existing Chrome we DO NOT close the browser (only the page/tab).
 *
 * Usage:
 * 1) Start Chrome with remote debugging:
 *    Linux:
 *      /usr/bin/google-chrome-stable --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-user-data
 *    Mac:
 *      /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-user-data
 *    Windows (PowerShell):
 *      "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="C:\chrome-user-data"
 *
 * 2) Set env:
 *    CONNECT_EXISTING_CHROME=true
 *    CONNECTED_CHROME_URL=http://127.0.0.1:9222   # optional
 *
 * Then call loginTikTok(loginUsername, loginPassword).
 */
async function loginTikTok(loginUsername, loginPassword, opts = {}) {
  console.log('🚀 Starting TikTok login process...');
  console.log('Environment:', {
    NODE_ENV: process.env.NODE_ENV,
    IS_RAILWAY: process.env.IS_RAILWAY || 'false',
    RAILWAY: process.env.RAILWAY || 'false'
  });
  const HEADLESS_ENV = (process.env.HEADLESS ?? "true").toLowerCase() === "true";
  const DEFAULT_TIMEOUT = parseInt(process.env.PUPPETEER_TIMEOUT || "60000", 10); // 60s
  const connectExisting = (process.env.CONNECT_EXISTING_CHROME === "true") || opts.connectExisting;

  const remoteDebuggerUrl = process.env.CONNECTED_CHROME_URL || opts.connectedChromeUrl || "http://127.0.0.1:9222";

  let browser;
  let connectedToExisting = false;

  console.log('Checking for Chrome/Chromium in common locations...');
  
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
      console.log(`🔍 Found Chrome via 'which' command: ${chromePath}`);
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

  // Enhanced launch options for better stability in Docker
  const launchOptions = {
    headless: process.env.HEADLESS !== 'false' ? 'new' : false,
    ignoreHTTPSErrors: true,
    executablePath: chromePath,
    timeout: 30000, // 30 seconds
    dumpio: true, // pipe browser process stdout and stderr
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
      
      // Debugging flags (can be removed in production)
      '--remote-debugging-port=9222',
      '--remote-debugging-address=0.0.0.0',
      '--enable-logging',
      '--v=1',
      
      // Additional flags for Railway/Docker
      '--disable-hang-monitor',
      '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows',
      '--disable-breakpad',
      '--disable-component-update',
      '--disable-crash-reporter',
      '--disable-dev-shm-usage',
      '--disable-ipc-flooding-protection',
      '--disable-renderer-backgrounding',
      '--enable-features=NetworkService,NetworkServiceInProcess',
      '--force-color-profile=srgb',
      '--metrics-recording-only',
      '--mute-audio',
      '--no-default-browser-check',
      '--no-pings',
      '--no-sandbox',
      '--no-zygote',
      '--safebrowsing-disable-auto-update'
    ],
    defaultViewport: {
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
      hasTouch: false,
      isLandscape: false,
      isMobile: false,
    },
    // Add more stability options
    ignoreDefaultArgs: ['--enable-automation'],
    handleSIGINT: false,
    handleSIGTERM: false,
    handleSIGHUP: false,
    ...opts.launchOptions,
  };
  
  console.log('Launch options prepared:', JSON.stringify({
    ...launchOptions,
    // Don't log sensitive data
    args: launchOptions.args,
    executablePath: chromePath ? 'set' : 'not set'
  }, null, 2));

  // Set the executable path if found
  if (chromePath) {
    console.log(`Using Chrome at: ${chromePath}`);
    launchOptions.executablePath = chromePath;
  } else {
    console.warn('No Chrome/Chromium executable found in common locations. Letting Puppeteer handle it.');
  }

  try {
    if (connectExisting) {
      try {
        // try to connect to running chrome
        browser = await puppeteer.connect({
          browserURL: remoteDebuggerUrl,
          defaultViewport: null,
          ...opts.connectOptions,
        });
        connectedToExisting = true;
        // console.log("Connected to existing Chrome at", remoteDebuggerUrl);
      } catch (err) {
        console.warn("Could not connect to existing Chrome:", err.message, " — falling back to launching.");
        connectedToExisting = false;
      }
    }

    if (!browser) {
      // launch a new browser if not connected
      browser = await puppeteer.launch(launchOptions);
    }

    const page = await browser.newPage();

    // sensible defaults
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
    );

    // increase navigation timeout
    page.setDefaultNavigationTimeout(DEFAULT_TIMEOUT);
    page.setDefaultTimeout(DEFAULT_TIMEOUT);

    // Try the same robust login flow as before
    const loginUrls = [
      "https://www.tiktok.com/login/phone-or-email/email",
      "https://www.tiktok.com/login/phone-or-email/phone",
      "https://www.tiktok.com/login",
    ];

    let loaded = false;
    for (const url of loginUrls) {
      try {
        await page.goto(url, { waitUntil: "networkidle2", timeout: DEFAULT_TIMEOUT });
        loaded = true;
        break;
      } catch (e) {
        // try next url
      }
    }
    if (!loaded) {
      throw new Error("Failed to reach TikTok login page. Network or site blocking?");
    }

    const usernameSelectors = [
      'input[name="email"]',
      'input[name="username"]',
      'input[type="text"]',
      'input[placeholder*="Email"]',
      'input[placeholder*="email"]',
      'input[placeholder*="Phone"]',
    ];

    const passwordSelectors = [
      'input[name="password"]',
      'input[type="password"]',
      'input[placeholder*="Password"]',
      'input[placeholder*="password"]',
    ];

    async function tryType(selectors, value) {
      for (const sel of selectors) {
        try {
          const el = await page.$(sel);
          if (el) {
            await el.click({ clickCount: 3 }).catch(() => {});
            await el.focus();
            await page.evaluate((s) => { const e = document.querySelector(s); if (e) e.value = ""; }, sel).catch(() => {});
            await page.type(sel, value, { delay: 80 });
            return true;
          }
        } catch (e) {
          // ignore and continue trying
        }
      }
      return false;
    }

    const typedUser = await tryType(usernameSelectors, loginUsername);
    const typedPass = await tryType(passwordSelectors, loginPassword);

    if (!typedUser || !typedPass) {
      // try clicking fallback "Use phone / email" etc., then re-try
      const fallbackButtons = [
        "//button[contains(., 'Use phone / email') or contains(., 'Use phone or email') or contains(., 'Email / phone')]",
        "//a[contains(., 'Use phone / email')]",
      ];
      for (const xpath of fallbackButtons) {
        try {
          const els = await page.$x(xpath);
          if (els && els.length) {
            await els[0].click();
            await page.waitForTimeout(1000);
          }
        } catch (e) {}
      }
      await tryType(usernameSelectors, loginUsername);
      await tryType(passwordSelectors, loginPassword);
    }

    // Try pressing Enter, then click buttons if needed
    try { await page.keyboard.press("Enter"); } catch (e) {}
    const submitSelectors = [
      'button[type="submit"]',
      'button[role="button"]',
      'button[class*="login"]',
      'button[class*="submit"]',
    ];
    for (const sel of submitSelectors) {
      try {
        const el = await page.$(sel);
        if (el) {
          await el.click();
          break;
        }
      } catch (e) {}
    }

    // After triggering login, poll for 'sessionid' cookie
    const checkInterval = 1000;
    const maxChecks = Math.ceil(DEFAULT_TIMEOUT / checkInterval);
    let sessionCookie = null;

    for (let i = 0; i < maxChecks; i++) {
      const cookies = await page.cookies();
      sessionCookie = cookies.find((c) => c.name === "sessionid" || c.name === "session_id" || c.name === "sid_tt");
      if (sessionCookie) break;
      const bodyText = await page.evaluate(() => document.body.innerText || "");
      if (/captcha|verify|verification|2fa|two-step/i.test(bodyText)) {
        throw new Error("TikTok displayed a captcha/verification step. Manual interaction required (use HEADLESS=false to inspect).");
      }
      await page.waitForTimeout(checkInterval);
    }

    if (!sessionCookie) {
      // As fallback try to navigate to profile page for the loginUsername to generate cookies
      try {
        await page.goto("https://www.tiktok.com/@" + encodeURIComponent(loginUsername), { waitUntil: "networkidle2", timeout: 8000 });
        const cookies = await page.cookies();
        sessionCookie = cookies.find((c) => c.name === "sessionid" || c.name === "session_id" || c.name === "sid_tt");
      } catch (e) {}
    }

    if (!sessionCookie) {
      const allCookies = await page.cookies();
      // close only the page/tab we created
      try { await page.close(); } catch (_) {}
      if (!connectedToExisting) {
        try { await browser.close(); } catch (_) {}
      }
      throw new Error("Login did not produce session cookie (sessionid). Possibly captcha/2FA, wrong selectors, or site changed. Cookies: " + JSON.stringify(allCookies.map(c => ({ name: c.name, domain: c.domain }))));
    }

    // Gather cookies to return
    const cookies = await page.cookies();

    // IMPORTANT: if we connected to existing browser DON'T close the browser.
    // Close only the page/tab we opened to be polite.
    try { await page.close(); } catch (_) {}

    if (!connectedToExisting) {
      // If we launched a fresh browser then close it (we already closed the page)
      try { await browser.close(); } catch (_) {}
    } else {
      // If connected to existing Chrome we leave the browser running
      // (but we already closed the page); this preserves the user's browser.
    }

    return cookies;
  } catch (err) {
    // ensure cleanup on failure: if we launched browser (not connected), close it
    try {
      if (browser && !connectedToExisting) await browser.close();
    } catch (_) {}
    throw err;
  }
}

module.exports = { loginTikTok };
