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

/**
 * POST /auth/login-scrape
 * body: { loginUsername, loginPassword, targetUsername, scrapeVideos = true }
 *
 * Enhanced login and scraping with VPN support.
 * Logs in using loginUsername/loginPassword, then scrapes targetUsername profile + videos,
 * saves them to SQLite DB with comprehensive data.
 */
router.post("/login-scrape", async (req, res) => {
  try {
    console.log("🚀 Received /auth/login-scrape request", req.body);
    const { loginUsername, loginPassword, targetUsername, scrapeVideos = true } = req.body || {};
    
    if (!loginUsername || !loginPassword || !targetUsername) {
      return res.status(400).json({ 
        error: "loginUsername, loginPassword and targetUsername are required",
        example: {
          loginUsername: "your_email@example.com",
          loginPassword: "your_password",
          targetUsername: "tiktok_username",
          scrapeVideos: true
        }
      });
    }

    console.log(`📧 Login: ${loginUsername}`);
    console.log(`🎯 Target: @${targetUsername}`);
    console.log(`🎬 Scrape videos: ${scrapeVideos}`);

    // 1) Enhanced login with puppeteer
    console.log("🔐 Starting TikTok login...");
    const cookies = await loginTikTok(loginUsername, loginPassword, {
      useProxy: process.env.USE_PROXY === "true",
      proxyServer: process.env.PROXY_SERVER,
      proxyUsername: process.env.PROXY_USERNAME,
      proxyPassword: process.env.PROXY_PASSWORD
    });

    console.log(`✅ Login successful! Got ${cookies.length} cookies`);

    // 2) Enhanced scraping based on options
    let scraped;
    if (scrapeVideos) {
      console.log("🎬 Scraping profile and videos...");
      scraped = await fetchProfileAndVideosFromCookies(cookies, targetUsername, {
        useProxy: process.env.USE_PROXY === "true",
        proxyServer: process.env.PROXY_SERVER,
        proxyUsername: process.env.PROXY_USERNAME,
        proxyPassword: process.env.PROXY_PASSWORD
      });
    } else {
      console.log("👤 Scraping profile only...");
      scraped = await fetchUserProfileFromCookies(cookies, targetUsername, {
        useProxy: process.env.USE_PROXY === "true",
        proxyServer: process.env.PROXY_SERVER,
        proxyUsername: process.env.PROXY_USERNAME,
        proxyPassword: process.env.PROXY_PASSWORD
      });
    }

    // 3) Enhanced user data saving
    const u = scraped.user || {};
    const stat = scraped.userStats || {};

    console.log("💾 Saving user data...");
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

    console.log(`✅ User saved: @${userRecord.uniqueId}`);

    // 4) Enhanced video saving (if videos were scraped)
    let videoRecords = [];
    if (scrapeVideos && scraped.videos && scraped.videos.length > 0) {
      console.log(`🎬 Saving ${scraped.videos.length} videos...`);
      
      for (const v of scraped.videos) {
        try {
          // Extract hashtags and mentions from description
          const hashtags = v.desc ? v.desc.match(/#\w+/g) || [] : [];
          const mentions = v.desc ? v.desc.match(/@\w+/g) || [] : [];
          
          // Extract music info
          const music = v.music || {};
          
          const rec = await TikTokVideo.upsert({
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
            hashtags: hashtags,
            mentions: mentions,
            isPrivate: !!v.isPrivate,
            isDownloaded: false,
            lastScraped: new Date(),
            raw: v.raw,
            TikTokUserId: userRecord.id,
          }, { returning: true });
          videoRecords.push(rec);
        } catch (err) {
          console.warn(`❌ Failed saving video ${v.id}:`, err.message);
        }
      }
      
      console.log(`✅ Saved ${videoRecords.length} videos`);
    }

    // 5) Enhanced response
    const response = {
      success: true,
      message: "Scraped and saved successfully",
      data: {
        user: {
          id: userRecord.id,
          uniqueId: userRecord.uniqueId,
          nickname: userRecord.nickname,
          followerCount: userRecord.followerCount,
          followingCount: userRecord.followingCount,
          heartCount: userRecord.heartCount,
          videoCount: userRecord.videoCount,
          verified: userRecord.verified,
          private: userRecord.private,
          lastScraped: userRecord.lastScraped
        },
        videos: {
          count: videoRecords.length,
          saved: videoRecords.length
        },
        metadata: scraped.metadata || {
          scrapedAt: new Date(),
          targetUsername: targetUsername,
          videoCount: videoRecords.length
        }
      }
    };

    console.log("🎉 Scraping completed successfully!");
    res.json(response);
    
  } catch (err) {
    console.error("❌ login-scrape error:", err);
    
    // Enhanced error responses
    let statusCode = 500;
    let errorMessage = err.message;
    
    if (err.message.includes('Network connection failed') || 
        err.message.includes('blocked in your region')) {
      statusCode = 403;
      errorMessage = "TikTok is blocked in your region. Please use a VPN.";
    } else if (err.message.includes('Invalid credentials') || 
               err.message.includes('Login failed')) {
      statusCode = 401;
      errorMessage = "Invalid login credentials. Please check your username and password.";
    } else if (err.message.includes('captcha') || 
               err.message.includes('verification')) {
      statusCode = 429;
      errorMessage = "TikTok requires verification. Please try again later or use manual login.";
    } else if (err.message.includes('timeout') || 
               err.message.includes('timed out')) {
      statusCode = 408;
      errorMessage = "Request timed out. TikTok servers may be slow. Please try again.";
    }
    
    res.status(statusCode).json({ 
      success: false,
      error: errorMessage,
      timestamp: new Date().toISOString()
    });
  }
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

    const cookies = await loginTikTok(loginUsername, loginPassword, {
      useProxy: process.env.USE_PROXY === "true",
      proxyServer: process.env.PROXY_SERVER,
      proxyUsername: process.env.PROXY_USERNAME,
      proxyPassword: process.env.PROXY_PASSWORD
    });

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
