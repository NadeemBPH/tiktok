const { DataTypes } = require("sequelize");
const { sequelize } = require("./index");
const TikTokUser = require("./TikTokUser");

const TikTokVideo = sequelize.define("TikTokVideo", {
  videoId: { type: DataTypes.STRING, unique: true },
  description: { type: DataTypes.TEXT },
  createTime: { type: DataTypes.DATE },
  playUrl: { type: DataTypes.STRING },
  coverUrl: { type: DataTypes.STRING },
  likeCount: { type: DataTypes.INTEGER },
  commentCount: { type: DataTypes.INTEGER },
  shareCount: { type: DataTypes.INTEGER },
  raw: { type: DataTypes.JSON },
});

TikTokUser.hasMany(TikTokVideo);
TikTokVideo.belongsTo(TikTokUser);

module.exports = TikTokVideo;
