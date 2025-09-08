const express = require("express");
const router = express.Router();
const { loginTikTok } = require("../services/puppeteerLogin");
const { 
  fetchProfileAndVideosFromCookies,
  fetchUserProfileFromCookies,
  fetchUserVideosFromCookies
} = require("../services/tiktokScraper");
const TikTokUser = require("../models/TikTokUser");
const TikTokVideo = require("../models/TikTokVideo");

// simple in-memory job store (resets on restart)
const jobs = new Map();

router.get('/ping', (req, res) => res.json({ ok: true }));

router.get('/job/:id', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ success: false, error: 'job not found' });
  res.json(job);
});

function newJob() {
  const id = Math.random().toString(36).slice(2);
  const job = { id, status: 'pending', startedAt: new Date().toISOString() };
  jobs.set(id, job);
  return job;
}

function completeJob(id, payload) {
  const job = jobs.get(id);
  if (job) {
    job.status = 'completed';
    job.completedAt = new Date().toISOString();
    job.result = payload;
    jobs.set(id, job);
  }
}

function failJob(id, errorMessage) {
  const job = jobs.get(id);
  if (job) {
    job.status = 'failed';
    job.completedAt = new Date().toISOString();
    job.error = errorMessage;
    jobs.set(id, job);
  }
}

function normalizeCookies(loginResult) {
  if (!loginResult) return null;
  if (Array.isArray(loginResult)) return loginResult;
  if (loginResult.cookies && Array.isArray(loginResult.cookies)) return loginResult.cookies;
  return null;
}

/**
 * POST /auth/login-scrape (async)
 * Accepts request, returns 202 with jobId immediately to avoid 15s ingress timeout.
 * Client polls /auth/job/:id until completed/failed.
 */
router.post("/login-scrape", async (req, res) => {
  const job = newJob();
  res.status(202).json({ accepted: true, jobId: job.id, poll: `/auth/job/${job.id}` });

  // run in background (no await)
  (async () => {
    try {
      const { loginUsername, loginPassword, targetUsername, scrapeVideos = true } = req.body || {};
      if (!loginUsername || !loginPassword || !targetUsername) {
        failJob(job.id, "loginUsername, loginPassword and targetUsername are required");
        return;
      }

      console.log('🔑 Attempting to log in...');
      let loginResult;
      try {
        loginResult = await loginTikTok(loginUsername, loginPassword, {
          useProxy: process.env.USE_PROXY === "true",
          proxyServer: process.env.PROXY_SERVER,
          proxyUsername: process.env.PROXY_USERNAME,
          proxyPassword: process.env.PROXY_PASSWORD
        });
      } catch (loginError) {
        console.error('❌ Login error:', loginError);
        failJob(job.id, `Login failed: ${loginError.message}`);
        return;
      }

      const cookies = normalizeCookies(loginResult);
      if (!cookies) {
        console.error('❌ Invalid cookies in login result');
        failJob(job.id, 'Login failed: No valid cookies received');
        return;
      }

      let scraped;
      if (scrapeVideos) {
        scraped = await fetchProfileAndVideosFromCookies(cookies, targetUsername, {
          useProxy: process.env.USE_PROXY === "true",
          proxyServer: process.env.PROXY_SERVER,
          proxyUsername: process.env.PROXY_USERNAME,
          proxyPassword: process.env.PROXY_PASSWORD
        });
      } else {
        scraped = await fetchUserProfileFromCookies(cookies, targetUsername, {
          useProxy: process.env.USE_PROXY === "true",
          proxyServer: process.env.PROXY_SERVER,
          proxyUsername: process.env.PROXY_USERNAME,
          proxyPassword: process.env.PROXY_PASSWORD
        });
      }

      const u = scraped.user || {};
      const stat = scraped.userStats || {};

      const [userRecord] = await TikTokUser.upsert({
        uniqueId: u.uniqueId || u.unique_id || u.shortId || targetUsername,
        nickname: u.nickname || u.displayName || u.screen_name,
        avatarUrl: (u.avatarLarger || u.avatar || (u.avatarThumb && u.avatarThumb) || null),
        signature: u.signature || "",
        followingCount: stat.followingCount || stat.following || 0,
        followerCount: stat.followerCount || stat.follower || 0,
        heartCount: stat.heartCount || stat.heart || 0,
        videoCount: stat.videoCount || stat.video || 0,
        verified: !!u.verified,
        private: !!u.private,
        secUid: u.secUid || u.sec_uid,
        userId: u.id || u.userId,
        lastScraped: new Date(),
        raw: scraped.rawState,
      }, { returning: true });

      let saved = 0;
      if (scrapeVideos && scraped.videos && scraped.videos.length > 0) {
        for (const v of scraped.videos) {
          try {
            const hashtags = v.desc ? v.desc.match(/#\w+/g) || [] : [];
            const mentions = v.desc ? v.desc.match(/@\w+/g) || [] : [];
            const music = v.music || {};
            await TikTokVideo.upsert({
              videoId: v.id,
              description: v.desc,
              createTime: v.createTime,
              playUrl: v.video,
              coverUrl: v.cover,
              likeCount: v.stats && v.stats.diggCount ? v.stats.diggCount : (v.stats && v.stats.likes) || 0,
              commentCount: v.stats && v.stats.commentCount ? v.stats.commentCount : 0,
              shareCount: v.stats && v.stats.shareCount ? v.stats.shareCount : 0,
              viewCount: v.stats && v.stats.playCount ? v.stats.playCount : 0,
              duration: v.stats && v.stats.duration ? v.stats.duration : null,
              musicTitle: music.title || null,
              musicAuthor: music.authorName || null,
              musicUrl: music.playUrl || null,
              hashtags,
              mentions,
              isPrivate: !!v.isPrivate,
              isDownloaded: false,
              lastScraped: new Date(),
              raw: v.raw,
              TikTokUserId: userRecord.id,
            }, { returning: true });
            saved++;
          } catch (_) {}
        }
      }

      completeJob(job.id, { userId: userRecord.id, videosSaved: saved });
    } catch (err) {
      console.error('login-scrape async error:', err);
      failJob(job.id, err.message);
    }
  })();
});

/**
 * POST /auth/login-only
 * body: { loginUsername, loginPassword }
 *
 * Login only - returns cookies for later use
 */
router.post("/login-only", async (req, res) => {
  try {
    console.log("🔐 Received /auth/login-only request");
    const { loginUsername, loginPassword } = req.body || {};
    
    if (!loginUsername || !loginPassword) {
      return res.status(400).json({ 
        error: "loginUsername and loginPassword are required" 
      });
    }

    const loginResult = await loginTikTok(loginUsername, loginPassword, {
      useProxy: process.env.USE_PROXY === "true",
      proxyServer: process.env.PROXY_SERVER,
      proxyUsername: process.env.PROXY_USERNAME,
      proxyPassword: process.env.PROXY_PASSWORD
    });

    const cookies = normalizeCookies(loginResult);
    if (!cookies) return res.status(500).json({ success: false, error: 'No valid cookies received' });

    res.json({
      success: true,
      message: "Login successful",
      cookies: cookies.length,
      sessionCookie: cookies.find(c => c.name === "sessionid") ? "found" : "not found"
    });
    
  } catch (err) {
    console.error("❌ login-only error:", err);
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
});

/**
 * POST /auth/scrape-only
 * body: { cookies, targetUsername, scrapeVideos = true }
 *
 * Scrape only - uses provided cookies
 */
router.post("/scrape-only", async (req, res) => {
  try {
    console.log("🎯 Received /auth/scrape-only request");
    const { cookies, targetUsername, scrapeVideos = true } = req.body || {};
    
    if (!cookies || !targetUsername) {
      return res.status(400).json({ 
        error: "cookies and targetUsername are required" 
      });
    }

    let scraped;
    if (scrapeVideos) {
      scraped = await fetchProfileAndVideosFromCookies(cookies, targetUsername, {
        useProxy: process.env.USE_PROXY === "true",
        proxyServer: process.env.PROXY_SERVER,
        proxyUsername: process.env.PROXY_USERNAME,
        proxyPassword: process.env.PROXY_PASSWORD
      });
    } else {
      scraped = await fetchUserProfileFromCookies(cookies, targetUsername, {
        useProxy: process.env.USE_PROXY === "true",
        proxyServer: process.env.PROXY_SERVER,
        proxyUsername: process.env.PROXY_USERNAME,
        proxyPassword: process.env.PROXY_PASSWORD
      });
    }

    res.json({
      success: true,
      message: "Scraping successful",
      data: scraped
    });
    
  } catch (err) {
    console.error("❌ scrape-only error:", err);
    res.status(500).json({ 
      success: false, 
      error: err.message 
    });
  }
});

module.exports = router;
