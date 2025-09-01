const express = require("express");
const router = express.Router();
const { loginTikTok } = require("../services/puppeteerLogin");
const { fetchProfileAndVideosFromCookies } = require("../services/tiktokScraper");
const TikTokUser = require("../models/TikTokUser");
const TikTokVideo = require("../models/TikTokVideo");

/**
 * POST /auth/login-scrape
 * body: { loginUsername, loginPassword, targetUsername }
 *
 * Logs in using loginUsername/loginPassword, then scrapes targetUsername profile + videos,
 * saves them to SQLite DB.
 */
router.post("/login-scrape", async (req, res) => {
  try {
    console.log("Received /auth/login-scrape request", req.body);
    const { loginUsername, loginPassword, targetUsername } = req.body || {};
    if (!loginUsername || !loginPassword || !targetUsername) {
      return res.status(400).json({ error: "loginUsername, loginPassword and targetUsername are required" });
    }

    // 1) login with puppeteer
    const cookies = await loginTikTok(loginUsername, loginPassword);

    // 2) scrape profile + videos
    const scraped = await fetchProfileAndVideosFromCookies(cookies, targetUsername);

    // 3) Save user
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
      verified: !!u.verified,
      raw: scraped.rawState,
    }, { returning: true });

    // 4) Save videos
    const videoRecords = [];
    for (const v of scraped.videos) {
      try {
        const rec = await TikTokVideo.upsert({
          videoId: v.id,
          description: v.desc,
          createTime: v.createTime,
          playUrl: v.video,
          coverUrl: v.cover,
          likeCount: v.stats && v.stats.diggCount ? v.stats.diggCount : (v.stats && v.stats.likes) || 0,
          commentCount: v.stats && v.stats.commentCount ? v.stats.commentCount : 0,
          shareCount: v.stats && v.stats.shareCount ? v.stats.shareCount : 0,
          raw: v.raw,
          TikTokUserId: userRecord.id,
        }, { returning: true });
        videoRecords.push(rec);
      } catch (err) {
        console.warn("Failed saving video", v.id, err.message);
      }
    }

    res.json({
      ok: true,
      message: "Scraped and saved",
      user: userRecord,
      videosSaved: videoRecords.length,
    });
  } catch (err) {
    console.error("login-scrape error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
