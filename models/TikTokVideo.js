const { DataTypes } = require("sequelize");
const { sequelize } = require("./index");
const TikTokUser = require("./TikTokUser");

const TikTokVideo = sequelize.define("TikTokVideo", {
  videoId: { 
    type: DataTypes.STRING, 
    unique: true,
    allowNull: false,
    comment: "TikTok video ID"
  },
  description: { 
    type: DataTypes.TEXT,
    comment: "Video description/caption"
  },
  createTime: { 
    type: DataTypes.DATE,
    comment: "When video was created"
  },
  playUrl: { 
    type: DataTypes.STRING,
    comment: "Video playback URL"
  },
  coverUrl: { 
    type: DataTypes.STRING,
    comment: "Video thumbnail URL"
  },
  likeCount: { 
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: "Number of likes"
  },
  commentCount: { 
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: "Number of comments"
  },
  shareCount: { 
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: "Number of shares"
  },
  viewCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: "Number of views"
  },
  duration: {
    type: DataTypes.INTEGER,
    comment: "Video duration in seconds"
  },
  musicTitle: {
    type: DataTypes.STRING,
    comment: "Music/sound title"
  },
  musicAuthor: {
    type: DataTypes.STRING,
    comment: "Music/sound author"
  },
  musicUrl: {
    type: DataTypes.STRING,
    comment: "Music/sound URL"
  },
  hashtags: {
    type: DataTypes.JSON,
    comment: "Array of hashtags used"
  },
  mentions: {
    type: DataTypes.JSON,
    comment: "Array of mentioned users"
  },
  isPrivate: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: "Whether video is private"
  },
  isDownloaded: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: "Whether video has been downloaded"
  },
  lastScraped: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    comment: "Last time data was scraped"
  },
  raw: { 
    type: DataTypes.JSON,
    comment: "Raw JSON dump for debugging"
  },
}, {
  indexes: [
    {
      fields: ['videoId']
    },
    {
      fields: ['TikTokUserId']
    },
    {
      fields: ['createTime']
    },
    {
      fields: ['lastScraped']
    }
  ]
});

TikTokUser.hasMany(TikTokVideo);
TikTokVideo.belongsTo(TikTokUser);

module.exports = TikTokVideo;
