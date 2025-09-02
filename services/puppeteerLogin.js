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
  const launchOptions = {
    headless: isProduction ? 'new' : (process.env.HEADLESS !== 'false' ? 'new' : false),
    ignoreHTTPSErrors: true,
    executablePath: chromePath,
    timeout: Math.min(DEFAULT_TIMEOUT, 30000),
    dumpio: false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-first-run',
      '--no-zygote',
      '--disable-accelerated-2d-canvas',
      '--window-size=1280,800'
    ],
    defaultViewport: { width: 1280, height: 800 },
    ignoreDefaultArgs: ['--enable-automation'],
    handleSIGINT: false,
    handleSIGTERM: false,
    handleSIGHUP: false,
    ...opts.launchOptions,
  };

  // Proxy config
  if (useProxy) {
    const proxyServer = process.env.PROXY_SERVER || opts.proxyServer;
    if (proxyServer) {
      launchOptions.args.push(`--proxy-server=${proxyServer}`);
    }
  }

  console.log('🚀 Launch options prepared for Railway');

  try {
    if (connectExisting && !isProduction) {
      try {
        browser = await puppeteer.connect({ browserURL: remoteDebuggerUrl, defaultViewport: null, ...opts.connectOptions });
        connectedToExisting = true;
        console.log("✅ Connected to existing Chrome at", remoteDebuggerUrl);
      } catch (err) {
        console.warn("❌ Could not connect to existing Chrome:", err.message, " — falling back to launching.");
        connectedToExisting = false;
      }
    }

    if (!browser) {
      browser = await puppeteer.launch(launchOptions);
      console.log("✅ Launched browser instance");
    }

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    page.setDefaultNavigationTimeout(DEFAULT_TIMEOUT);
    page.setDefaultTimeout(DEFAULT_TIMEOUT);

    if (useProxy && process.env.PROXY_USERNAME && process.env.PROXY_PASSWORD) {
      await page.authenticate({ username: process.env.PROXY_USERNAME, password: process.env.PROXY_PASSWORD });
    }

    const loginUrls = [
      "https://www.tiktok.com/login/phone-or-email/email",
      "https://www.tiktok.com/login",
    ];

    let loaded = false;
    for (const url of loginUrls) {
      try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: DEFAULT_TIMEOUT });
        loaded = true;
        break;
      } catch (_) {}
    }
    if (!loaded) throw new Error("Failed to reach TikTok login page. Network or site blocking? Try using a VPN.");

    const usernameSelectors = [ 'input[name="email"]', 'input[name="username"]', 'input[type="text"]' ];
    const passwordSelectors = [ 'input[name="password"]', 'input[type="password"]' ];

    async function tryType(selectors, value) {
      for (const sel of selectors) {
        try {
          const el = await page.$(sel);
          if (!el) continue;
          await el.click({ clickCount: 3 }).catch(() => {});
          await el.focus();
          await page.type(sel, value, { delay: 60 });
          return true;
        } catch (_) {}
      }
      return false;
    }

    const typedUser = await tryType(usernameSelectors, loginUsername);
    const typedPass = await tryType(passwordSelectors, loginPassword);

    // Submit
    try { await page.keyboard.press("Enter"); } catch (_) {}
    const submitSelectors = [ 'button[type="submit"]', 'button[role="button"]' ];
    for (const sel of submitSelectors) {
      try { const el = await page.$(sel); if (el) { await el.click(); break; } } catch (_) {}
    }

    // Wait briefly for cookie
    const checkInterval = 800;
    const maxChecks = Math.ceil(Math.min(DEFAULT_TIMEOUT, 20000) / checkInterval);
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
      // Quick fallback
      try {
        await page.goto("https://www.tiktok.com/" + (loginUsername ? ("@" + encodeURIComponent(loginUsername)) : ''), { waitUntil: "domcontentloaded", timeout: 8000 });
        const cookies = await page.cookies();
        sessionCookie = cookies.find((c) => c.name === "sessionid" || c.name === "session_id" || c.name === "sid_tt");
      } catch (_) {}
    }

    if (!sessionCookie) {
      try { await page.close(); } catch (_) {}
      if (!connectedToExisting) { try { await browser.close(); } catch (_) {} }
      throw new Error("Login did not produce session cookie. Try again with VPN or different credentials.");
    }

    const cookies = await page.cookies();
    try { await page.close(); } catch (_) {}
    if (!connectedToExisting) { try { await browser.close(); } catch (_) {} }

    return cookies;
  } catch (err) {
    try { if (browser && !connectedToExisting) await browser.close(); } catch (_) {}
    throw err;
  }
}

module.exports = { loginTikTok };
