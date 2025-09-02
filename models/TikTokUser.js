const { DataTypes } = require("sequelize");
const { sequelize } = require("./index");

const TikTokUser = sequelize.define("TikTokUser", {
  uniqueId: { 
    type: DataTypes.STRING, 
    unique: true,
    allowNull: false,
    comment: "TikTok username (e.g., 'someuser')"
  },
  nickname: { 
    type: DataTypes.STRING,
    comment: "Display name"
  },
  avatarUrl: { 
    type: DataTypes.STRING,
    comment: "Profile picture URL"
  },
  signature: { 
    type: DataTypes.TEXT,
    comment: "Bio/description"
  },
  followingCount: { 
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: "Number of users following"
  },
  followerCount: { 
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: "Number of followers"
  },
  heartCount: { 
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: "Total likes received"
  },
  videoCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: "Number of videos posted"
  },
  verified: { 
    type: DataTypes.BOOLEAN, 
    defaultValue: false,
    comment: "Whether account is verified"
  },
  private: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: "Whether account is private"
  },
  secUid: {
    type: DataTypes.STRING,
    comment: "TikTok's internal user ID"
  },
  userId: {
    type: DataTypes.STRING,
    comment: "TikTok's numeric user ID"
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
      fields: ['uniqueId']
    },
    {
      fields: ['lastScraped']
    }
  ]
});

module.exports = TikTokUser;
