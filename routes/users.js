const express = require("express");
const router = express.Router();
const TikTokUser = require("../models/TikTokUser");
const TikTokVideo = require("../models/TikTokVideo");

router.get("/", async (req, res) => {
  const users = await TikTokUser.findAll({ include: TikTokVideo });
  res.json(users);
});

module.exports = router;
