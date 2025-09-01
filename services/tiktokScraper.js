/**
 * Uses Puppeteer cookies (session) to load a user's profile page and
 * extract JSON state embedded in the page (SIGI_STATE) to get profile + videos.
 *
 * This approach reads the <script id="SIGI_STATE"> JSON object that TikTok renders.
 */

const puppeteer = require("puppeteer");

async function fetchProfileAndVideosFromCookies(cookies, targetUsername, opts = {}) {
  const browserArgs = [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
  ];

  const launchOptions = {
    headless: true,
    args: browserArgs,
    ...opts.launchOptions,
  };

  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  const browser = await puppeteer.launch(launchOptions);
  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
  );

  // set cookies for domain
  const formatted = cookies.map(c => {
    // ensure domain field present
    if (!c.domain) c.domain = ".tiktok.com";
    return c;
  });

  await page.setCookie(...formatted);

  const profileUrl = `https://www.tiktok.com/@${encodeURIComponent(targetUsername)}`;

  // goto profile
  await page.goto(profileUrl, { waitUntil: "networkidle2", timeout: 30000 });

  // Wait for the SIGI_STATE script (common pattern)
  try {
    await page.waitForSelector('script[id="SIGI_STATE"]', { timeout: 10000 });
  } catch (err) {
    // fallback: wait for any script tag containing "SIGI_STATE"
    try {
      await page.waitForFunction(() => !!document.querySelector('script[id="SIGI_STATE"]') || !!window['SIGI_STATE'], { timeout: 10000 });
    } catch (e) {
      console.warn("SIGI_STATE not found — page structure may have changed.");
    }
  }

  // Extract the JSON state
  const sigiText = await page.evaluate(() => {
    const el = document.querySelector('script[id="SIGI_STATE"]');
    if (el) return el.innerText;
    // fallback: try window.SIGI_STATE
    if (window.SIGI_STATE) return JSON.stringify(window.SIGI_STATE);
    return null;
  });

  if (!sigiText) {
    await browser.close();
    throw new Error("Couldn't extract SIGI_STATE from page. Page structure changed or blocked.");
  }

  let state;
  try {
    state = JSON.parse(sigiText);
  } catch (err) {
    await browser.close();
    throw new Error("Failed parsing SIGI_STATE JSON.");
  }

  // Parse profile info
  // Structure: state.UserModule.users[<secUid or uniqueId>], and state.UserModule.stats[<id>]
  const users = state.UserModule && state.UserModule.users ? state.UserModule.users : {};
  const stats = state.UserModule && state.UserModule.stats ? state.UserModule.stats : {};
  // pick the first matching user object for our username
  let userObj = null;
  for (const key of Object.keys(users)) {
    const u = users[key];
    if (u && (u.uniqueId === targetUsername || u.nickname === targetUsername)) {
      userObj = u;
      break;
    }
  }
  if (!userObj) {
    // fallback: pick first user in users
    const keys = Object.keys(users);
    if (keys.length > 0) userObj = users[keys[0]];
  }

  // Parse videos: state.ItemModule.items is keyed by video id
  const itemsMap = state.ItemModule && state.ItemModule.items ? state.ItemModule.items : {};
  const videos = Object.values(itemsMap).map(item => {
    return {
      id: item.id,
      desc: item.desc,
      createTime: item.createTime ? new Date(item.createTime * 1000) : null,
      stats: item.stats || {},
      video: (item.video && item.video.playAddr) || null,
      cover: (item.video && item.video.dynamicCover) || (item.author && item.author.avatarThumb) || null,
      raw: item,
    };
  });

  await browser.close();
  return {
    user: userObj,
    userStats: stats[userObj && userObj.id ? userObj.id : Object.keys(stats)[0]] || {},
    videos,
    rawState: state,
  };
}

module.exports = { fetchProfileAndVideosFromCookies };
