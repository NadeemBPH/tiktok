require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const { sequelize } = require("./models");
const TikTokUser = require("./models/TikTokUser");
const TikTokVideo = require("./models/TikTokVideo");

const app = express();
app.use(bodyParser.json({ limit: "5mb" }));
app.use(bodyParser.urlencoded({ extended: false }));

// routes
app.use("/auth", require("./routes/auth"));
app.use("/users", require("./routes/users"));

const PORT = process.env.PORT || 4000;

async function start() {
  // sync DB
  await sequelize.sync({ alter: true });
  app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
}

start().catch(err => {
  console.error("Failed to start:", err);
});
