/**
 * Enhanced TikTok scraper using Puppeteer with VPN/proxy support.
 * Uses cookies (session) to load a user's profile page and
 * extract JSON state embedded in the page (SIGI_STATE) to get profile + videos.
 *
 * This approach reads the <script id="SIGI_STATE"> JSON object that TikTok renders.
 */

const puppeteer = require("puppeteer");

async function fetchProfileAndVideosFromCookies(cookies, targetUsername, opts = {}) {
  console.log(`🚀 Starting enhanced TikTok scraping for @${targetUsername}`);
  
  const browserArgs = [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-accelerated-2d-canvas",
    "--disable-gpu",
    "--disable-web-security",
    "--disable-blink-features=AutomationControlled",
    "--no-first-run",
    "--no-zygote",
    "--single-process",
    "--disable-infobars",
    "--window-size=1920,1080",
    "--start-maximized",
    "--disable-popup-blocking",
    "--disable-notifications",
    "--disable-extensions",
    "--mute-audio",
  ];

  // Add proxy support if enabled
  const useProxy = (process.env.USE_PROXY === "true") || opts.useProxy;
  if (useProxy && process.env.PROXY_SERVER) {
    console.log(`🌐 Using proxy: ${process.env.PROXY_SERVER}`);
    browserArgs.push(`--proxy-server=${process.env.PROXY_SERVER}`);
  }

  const launchOptions = {
    headless: process.env.HEADLESS !== 'false' ? 'new' : false,
    ignoreHTTPSErrors: true,
    args: browserArgs,
    defaultViewport: {
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
      hasTouch: false,
      isLandscape: false,
      isMobile: false,
    },
    ignoreDefaultArgs: ['--enable-automation'],
    ...opts.launchOptions,
  };

  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  const browser = await puppeteer.launch(launchOptions);
  const page = await browser.newPage();
  
  // Enhanced user agent
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  );

  // Set timeouts
  const DEFAULT_TIMEOUT = parseInt(process.env.PUPPETEER_TIMEOUT || "60000", 10);
  page.setDefaultNavigationTimeout(DEFAULT_TIMEOUT);
  page.setDefaultTimeout(DEFAULT_TIMEOUT);

  // Handle proxy authentication if needed
  if (useProxy && process.env.PROXY_USERNAME && process.env.PROXY_PASSWORD) {
    await page.authenticate({
      username: process.env.PROXY_USERNAME,
      password: process.env.PROXY_PASSWORD
    });
  }

  // Ensure cookies is an array
  if (!Array.isArray(cookies)) {
    console.error('❌ Error: cookies parameter must be an array');
    throw new Error('Invalid cookies parameter: expected an array');
  }

  // set cookies for domain
  const formatted = cookies.map(c => {
    // ensure domain field present
    if (c && typeof c === 'object') {
      if (!c.domain) c.domain = ".tiktok.com";
      return c;
    }
    return null;
  }).filter(Boolean); // Remove any null entries from invalid cookies

  console.log(`🍪 Setting ${formatted.length} cookies...`);
  await page.setCookie(...formatted);

  const profileUrl = `https://www.tiktok.com/@${encodeURIComponent(targetUsername)}`;
  console.log(`🔗 Navigating to: ${profileUrl}`);

  // Enhanced navigation with retry logic
  let pageLoaded = false;
  let retryCount = 0;
  const maxRetries = 3;

  while (!pageLoaded && retryCount < maxRetries) {
    try {
      await page.goto(profileUrl, { 
        waitUntil: "networkidle2", 
        timeout: DEFAULT_TIMEOUT 
      });
      pageLoaded = true;
      console.log("✅ Page loaded successfully");
    } catch (error) {
      retryCount++;
      console.log(`❌ Page load attempt ${retryCount} failed: ${error.message}`);
      
      if (retryCount >= maxRetries) {
        await browser.close();
        throw new Error(`Failed to load TikTok profile after ${maxRetries} attempts. Possible issues:\n` +
          "1. Network connectivity issues\n" +
          "2. TikTok blocking requests (try VPN)\n" +
          "3. Invalid username or profile doesn't exist\n" +
          "4. Rate limiting");
      }
      
      // Wait before retry
      await page.waitForTimeout(2000);
    }
  }

  // Wait for the SIGI_STATE script with enhanced detection
  console.log("🔍 Looking for SIGI_STATE data...");
  let sigiText = null;
  
  try {
    // First try: wait for the script tag
    await page.waitForSelector('script[id="SIGI_STATE"]', { timeout: 10000 });
    sigiText = await page.evaluate(() => {
      const el = document.querySelector('script[id="SIGI_STATE"]');
      return el ? el.innerText : null;
    });
  } catch (err) {
    console.log("⚠️ SIGI_STATE script tag not found, trying alternative methods...");
    
    // Second try: wait for window.SIGI_STATE
    try {
      await page.waitForFunction(() => !!window['SIGI_STATE'], { timeout: 10000 });
      sigiText = await page.evaluate(() => {
        return window.SIGI_STATE ? JSON.stringify(window.SIGI_STATE) : null;
      });
    } catch (e) {
      console.log("⚠️ window.SIGI_STATE not found, trying to extract from any script...");
      
      // Third try: search all script tags for SIGI_STATE
      sigiText = await page.evaluate(() => {
        const scripts = document.querySelectorAll('script');
        for (const script of scripts) {
          if (script.textContent && script.textContent.includes('SIGI_STATE')) {
            const match = script.textContent.match(/window\.SIGI_STATE\s*=\s*({.*?});/s);
            if (match) {
              return match[1];
            }
          }
        }
        return null;
      });
    }
  }

  if (!sigiText) {
    await browser.close();
    throw new Error("Couldn't extract SIGI_STATE from page. Possible issues:\n" +
      "1. TikTok page structure changed\n" +
      "2. Profile is private or doesn't exist\n" +
      "3. TikTok blocking requests (try VPN)\n" +
      "4. Rate limiting or geoblocking");
  }

  console.log("✅ SIGI_STATE data extracted successfully");

  let state;
  try {
    state = JSON.parse(sigiText);
  } catch (err) {
    await browser.close();
    throw new Error("Failed parsing SIGI_STATE JSON. Data may be corrupted or incomplete.");
  }

  // Enhanced profile parsing
  console.log("📊 Parsing profile data...");
  const users = state.UserModule && state.UserModule.users ? state.UserModule.users : {};
  const stats = state.UserModule && state.UserModule.stats ? state.UserModule.stats : {};
  
  // Find the target user
  let userObj = null;
  for (const key of Object.keys(users)) {
    const u = users[key];
    if (u && (u.uniqueId === targetUsername || u.nickname === targetUsername || u.unique_id === targetUsername)) {
      userObj = u;
      console.log(`✅ Found user: ${u.uniqueId || u.unique_id}`);
      break;
    }
  }
  
  if (!userObj) {
    // fallback: pick first user in users
    const keys = Object.keys(users);
    if (keys.length > 0) {
      userObj = users[keys[0]];
      console.log(`⚠️ Using fallback user: ${userObj.uniqueId || userObj.unique_id}`);
    }
  }

  if (!userObj) {
    await browser.close();
    throw new Error(`User @${targetUsername} not found in SIGI_STATE data. Profile may be private or doesn't exist.`);
  }

  // Enhanced video parsing
  console.log("🎬 Parsing video data...");
  const itemsMap = state.ItemModule && state.ItemModule.items ? state.ItemModule.items : {};
  const videos = Object.values(itemsMap).map(item => {
    return {
      id: item.id,
      desc: item.desc || item.description || "",
      createTime: item.createTime ? new Date(item.createTime * 1000) : null,
      stats: item.stats || {},
      video: (item.video && item.video.playAddr) || (item.video && item.video.downloadAddr) || null,
      cover: (item.video && item.video.dynamicCover) || 
             (item.video && item.video.cover) || 
             (item.author && item.author.avatarThumb) || null,
      author: item.author || {},
      music: item.music || {},
      challenges: item.challenges || [],
      raw: item,
    };
  });

  console.log(`✅ Parsed ${videos.length} videos`);

  // Get user stats
  const userStats = stats[userObj && userObj.id ? userObj.id : Object.keys(stats)[0]] || {};

  await browser.close();
  
  console.log("🎉 Scraping completed successfully!");
  
  return {
    user: userObj,
    userStats: userStats,
    videos: videos,
    rawState: state,
    metadata: {
      scrapedAt: new Date(),
      targetUsername: targetUsername,
      videoCount: videos.length,
      hasUserData: !!userObj,
      hasVideoData: videos.length > 0
    }
  };
}

/**
 * Enhanced function to fetch user data without videos (faster)
 */
async function fetchUserProfileFromCookies(cookies, targetUsername, opts = {}) {
  console.log(`🚀 Fetching user profile for @${targetUsername}...`);
  
  const result = await fetchProfileAndVideosFromCookies(cookies, targetUsername, opts);
  
  return {
    user: result.user,
    userStats: result.userStats,
    rawState: result.rawState,
    metadata: {
      ...result.metadata,
      videoCount: 0 // We didn't fetch videos
    }
  };
}

/**
 * Enhanced function to fetch only video data
 */
async function fetchUserVideosFromCookies(cookies, targetUsername, opts = {}) {
  console.log(`🎬 Fetching videos for @${targetUsername}...`);
  
  const result = await fetchProfileAndVideosFromCookies(cookies, targetUsername, opts);
  
  return {
    videos: result.videos,
    user: result.user, // Include basic user info
    metadata: {
      scrapedAt: new Date(),
      targetUsername: targetUsername,
      videoCount: result.videos.length
    }
  };
}

module.exports = { 
  fetchProfileAndVideosFromCookies,
  fetchUserProfileFromCookies,
  fetchUserVideosFromCookies
};
