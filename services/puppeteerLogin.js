// services/puppeteerLogin.js
const puppeteer = require("puppeteer");
const fs = require("fs");
require("dotenv").config();

/**
 * Enhanced TikTok login using Puppeteer with VPN/proxy support.
 */
async function loginTikTok(loginUsername, loginPassword, opts = {}) {
  console.log('🚀 Starting enhanced TikTok login process...');
  const isProduction = (process.env.NODE_ENV || '').toLowerCase() === 'production';
  const envHeadless = (process.env.HEADLESS || 'true').toLowerCase() !== 'false';
  const DEFAULT_TIMEOUT = Math.min(parseInt(process.env.PUPPETEER_TIMEOUT || "45000", 10), 90000);
  const connectExisting = (process.env.CONNECT_EXISTING_CHROME === "true") || opts.connectExisting;
  const useProxy = (process.env.USE_PROXY === "true") || opts.useProxy;

  const remoteDebuggerUrl = process.env.CONNECTED_CHROME_URL || opts.connectedChromeUrl || "http://127.0.0.1:9222";

  let browser;
  let connectedToExisting = false;
  let page;

  // Minimal, stable launch options
  const launchOptions = {
    headless: envHeadless ? 'new' : (isProduction ? 'new' : false),
    ignoreHTTPSErrors: true,
    executablePath: '/usr/bin/google-chrome-stable',
    timeout: 30000,
    dumpio: false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-first-run',
      '--no-zygote',
      '--window-size=1366,768',
      '--disable-blink-features=AutomationControlled'
    ],
    defaultViewport: { width: 1366, height: 768 },
    ignoreDefaultArgs: ['--enable-automation'],
    handleSIGINT: false,
    handleSIGTERM: false,
    handleSIGHUP: false,
    ...opts.launchOptions,
  };

  // Proxy configuration (do NOT add --no-proxy-server)
  if (useProxy) {
    const proxyServer = process.env.PROXY_SERVER || opts.proxyServer;
    if (proxyServer) {
      launchOptions.args.push(`--proxy-server=${proxyServer}`);
    }
  }

  // Helper: robust navigation with retries and staggered waitUntil
  async function retryGoto(targetPage, url, attempts = 3) {
    const strategies = ['domcontentloaded', 'networkidle0'];
    let lastErr;
    for (let i = 0; i < attempts; i++) {
      const waitUntil = strategies[Math.min(i, strategies.length - 1)];
      try {
        console.log(`🔗 goto attempt ${i + 1}/${attempts} (${waitUntil}): ${url}`);
        const res = await targetPage.goto(url, { waitUntil, timeout: Math.min(DEFAULT_TIMEOUT, 60000) });
        return res;
      } catch (e) {
        lastErr = e;
        console.warn(`goto failed (${waitUntil}):`, e.message);
        await targetPage.waitForTimeout(1000 + i * 500);
      }
    }
    throw lastErr;
  }

  try {
    // Launch browser
    if (connectExisting && !isProduction) {
      try {
        browser = await puppeteer.connect({ browserURL: remoteDebuggerUrl, defaultViewport: null, ...opts.connectOptions });
        connectedToExisting = true;
      } catch {
        connectedToExisting = false;
      }
    }
    if (!browser) browser = await puppeteer.launch(launchOptions);

    page = await browser.newPage();

    // Language and UA hints
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // Set timeouts
    page.setDefaultNavigationTimeout(Math.min(DEFAULT_TIMEOUT, 60000));
    page.setDefaultTimeout(Math.min(DEFAULT_TIMEOUT, 60000));

    // Only lightly block heavy resources to avoid breaking login
    try {
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        const type = req.resourceType();
        if (type === 'image' || type === 'media' || type === 'font') return req.abort();
        req.continue();
      });
    } catch (_) {}

    // Optional proxy auth
    if (useProxy && process.env.PROXY_USERNAME && process.env.PROXY_PASSWORD) {
      await page.authenticate({ username: process.env.PROXY_USERNAME, password: process.env.PROXY_PASSWORD });
    }

    // Warm-up
    try { await retryGoto(page, 'about:blank', 1); } catch (_) {}

    // Try multiple TikTok login URLs
    const loginUrls = [
      'https://www.tiktok.com/login/phone-or-email/email',
      'https://www.tiktok.com/login',
      'https://www.tiktok.com/foryou'
    ];

    let loaded = false;
    for (const url of loginUrls) {
      try { await retryGoto(page, url, 3); loaded = true; break; } catch (e) { console.warn('login url failed:', e.message); }
    }
    if (!loaded) throw new Error('Unable to reach TikTok login routes (network/VPN issue).');

    // Wait for any plausible input to appear
    const selectors = [ 'input[name="email"]', 'input[name="username"]', 'input[type="text"]', 'input[type="password"]' ];
    try {
      await Promise.race(selectors.map(sel => page.waitForSelector(sel, { visible: true, timeout: 15000 })));
    } catch (_) {
      // Not fatal; proceed and try typing
    }

    // Type helpers
    async function tryType(list, text) {
      for (const sel of list) {
        const el = await page.$(sel);
        if (!el) continue;
        try { await el.click({ clickCount: 3 }); } catch (_) {}
        try { await el.focus(); } catch (_) {}
        try { await page.type(sel, text, { delay: 50 }); return true; } catch (_) {}
      }
      return false;
    }

    const typedUser = await tryType(['input[name="email"]','input[name="username"]','input[type="text"]'], loginUsername);
    const typedPass = await tryType(['input[name="password"]','input[type="password"]'], loginPassword);

    try { await page.keyboard.press('Enter'); } catch (_) {}
    for (const sel of ['button[type="submit"]','button[role="button"]']) {
      try { const el = await page.$(sel); if (el) { await el.click(); break; } } catch (_) {}
    }

    // Cookie polling
    const maxChecks = 20; const delay = 700;
    let sessionCookie = null; let finalCookies = [];
    for (let i = 0; i < maxChecks; i++) {
      finalCookies = await page.cookies();
      sessionCookie = finalCookies.find(c => ['sessionid','sessionid_ss','sid_tt'].some(n => (c.name || '').includes(n)));
      if (sessionCookie) break;
      await page.waitForTimeout(delay);
    }
    if (!sessionCookie) throw new Error('No valid session cookies found after login.');

    if (browser && !connectedToExisting) { try { await browser.close(); } catch (_) {} }
    return finalCookies;
  } catch (error) {
    console.error('❌ Error during login process:', error.message);
    try { if (page) await page.screenshot({ path: `login-error-${Date.now()}.png`, fullPage: true }); } catch (_) {}
    if (browser && !connectedToExisting) { try { await browser.close(); } catch (_) {} }
    throw new Error(`Login failed: ${error.message}`);
  }
}

module.exports = { loginTikTok };
