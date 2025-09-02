const express = require("express");
const router = express.Router();
const TikTokUser = require("../models/TikTokUser");
const TikTokVideo = require("../models/TikTokVideo");
const { Op } = require("sequelize");

/**
 * GET /users
 * Query params: limit, offset, search, sortBy, sortOrder
 * 
 * Get all users with optional filtering and pagination
 */
router.get("/", async (req, res) => {
  try {
    const { 
      limit = 50, 
      offset = 0, 
      search, 
      sortBy = 'lastScraped', 
      sortOrder = 'DESC' 
    } = req.query;

    const whereClause = {};
    if (search) {
      whereClause[Op.or] = [
        { uniqueId: { [Op.like]: `%${search}%` } },
        { nickname: { [Op.like]: `%${search}%` } },
        { signature: { [Op.like]: `%${search}%` } }
      ];
    }

    const users = await TikTokUser.findAndCountAll({
      where: whereClause,
      include: [{
        model: TikTokVideo,
        attributes: ['videoId', 'description', 'createTime', 'likeCount', 'commentCount', 'shareCount']
      }],
      order: [[sortBy, sortOrder]],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      data: {
        users: users.rows,
        pagination: {
          total: users.count,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: users.count > parseInt(offset) + users.rows.length
        }
      }
    });
  } catch (error) {
    console.error("❌ Error fetching users:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * GET /users/:username
 * 
 * Get specific user by username
 */
router.get("/:username", async (req, res) => {
  try {
    const { username } = req.params;
    const { includeVideos = 'true' } = req.query;

    const include = [];
    if (includeVideos === 'true') {
      include.push({
        model: TikTokVideo,
        order: [['createTime', 'DESC']]
      });
    }

    const user = await TikTokUser.findOne({
      where: { uniqueId: username },
      include: include
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: `User @${username} not found`
      });
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error("❌ Error fetching user:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * GET /users/:username/videos
 * Query params: limit, offset, sortBy, sortOrder
 * 
 * Get videos for specific user
 */
router.get("/:username/videos", async (req, res) => {
  try {
    const { username } = req.params;
    const { 
      limit = 50, 
      offset = 0, 
      sortBy = 'createTime', 
      sortOrder = 'DESC' 
    } = req.query;

    const user = await TikTokUser.findOne({
      where: { uniqueId: username }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: `User @${username} not found`
      });
    }

    const videos = await TikTokVideo.findAndCountAll({
      where: { TikTokUserId: user.id },
      order: [[sortBy, sortOrder]],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          uniqueId: user.uniqueId,
          nickname: user.nickname
        },
        videos: videos.rows,
        pagination: {
          total: videos.count,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: videos.count > parseInt(offset) + videos.rows.length
        }
      }
    });
  } catch (error) {
    console.error("❌ Error fetching user videos:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * GET /users/:username/stats
 * 
 * Get user statistics
 */
router.get("/:username/stats", async (req, res) => {
  try {
    const { username } = req.params;

    const user = await TikTokUser.findOne({
      where: { uniqueId: username },
      include: [{
        model: TikTokVideo,
        attributes: ['likeCount', 'commentCount', 'shareCount', 'viewCount']
      }]
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: `User @${username} not found`
      });
    }

    // Calculate video statistics
    const videoStats = user.TikTokVideos.reduce((acc, video) => {
      acc.totalLikes += video.likeCount || 0;
      acc.totalComments += video.commentCount || 0;
      acc.totalShares += video.shareCount || 0;
      acc.totalViews += video.viewCount || 0;
      return acc;
    }, {
      totalLikes: 0,
      totalComments: 0,
      totalShares: 0,
      totalViews: 0
    });

    const stats = {
      user: {
        uniqueId: user.uniqueId,
        nickname: user.nickname,
        followerCount: user.followerCount,
        followingCount: user.followingCount,
        heartCount: user.heartCount,
        videoCount: user.videoCount,
        verified: user.verified,
        private: user.private,
        lastScraped: user.lastScraped
      },
      videos: {
        count: user.TikTokVideos.length,
        totalLikes: videoStats.totalLikes,
        totalComments: videoStats.totalComments,
        totalShares: videoStats.totalShares,
        totalViews: videoStats.totalViews,
        averageLikes: user.TikTokVideos.length > 0 ? Math.round(videoStats.totalLikes / user.TikTokVideos.length) : 0,
        averageComments: user.TikTokVideos.length > 0 ? Math.round(videoStats.totalComments / user.TikTokVideos.length) : 0,
        averageShares: user.TikTokVideos.length > 0 ? Math.round(videoStats.totalShares / user.TikTokVideos.length) : 0,
        averageViews: user.TikTokVideos.length > 0 ? Math.round(videoStats.totalViews / user.TikTokVideos.length) : 0
      }
    };

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error("❌ Error fetching user stats:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * DELETE /users/:username
 * 
 * Delete user and all their videos
 */
router.delete("/:username", async (req, res) => {
  try {
    const { username } = req.params;

    const user = await TikTokUser.findOne({
      where: { uniqueId: username }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: `User @${username} not found`
      });
    }

    // Delete all videos first (due to foreign key constraint)
    await TikTokVideo.destroy({
      where: { TikTokUserId: user.id }
    });

    // Delete user
    await user.destroy();

    res.json({
      success: true,
      message: `User @${username} and all associated videos deleted successfully`
    });
  } catch (error) {
    console.error("❌ Error deleting user:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

module.exports = router;
