const { DataTypes } = require("sequelize");
const { sequelize } = require("./index");

const TikTokUser = sequelize.define("TikTokUser", {
  uniqueId: { type: DataTypes.STRING, unique: true }, // e.g. "someuser"
  nickname: { type: DataTypes.STRING },
  avatarUrl: { type: DataTypes.STRING },
  signature: { type: DataTypes.TEXT },
  followingCount: { type: DataTypes.INTEGER },
  followerCount: { type: DataTypes.INTEGER },
  heartCount: { type: DataTypes.INTEGER }, // total likes
  verified: { type: DataTypes.BOOLEAN, defaultValue: false },
  raw: { type: DataTypes.JSON }, // store raw JSON dump for debugging
});

module.exports = TikTokUser;
