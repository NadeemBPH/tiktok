require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const { sequelize } = require("./models");
const TikTokUser = require("./models/TikTokUser");
const TikTokVideo = require("./models/TikTokVideo");

const app = express();
app.use(bodyParser.json({ limit: "5mb" }));
app.use(bodyParser.urlencoded({ extended: false }));

// quick readiness and health
app.get('/', (req, res) => res.json({ ok: true, service: 'tiktok-scraper' }));
app.get('/health', (req, res) => res.json({ ok: true }));

// routes
app.use("/auth", require("./routes/auth"));
app.use("/users", require("./routes/users"));

const PORT = process.env.PORT || 4000;

async function start() {
  console.log(`[boot] Starting service on port ${PORT} (NODE_ENV=${process.env.NODE_ENV || 'development'})`);
  // sync DB (no force), keep fast
  await sequelize.sync({ alter: true });
  const server = app.listen(PORT, '0.0.0.0', () => console.log(`Server running on http://0.0.0.0:${PORT}`));
  // increase timeouts to avoid 502 on long puppeteer operations
  server.headersTimeout = 120000; // 120s
  server.requestTimeout = 120000; // 120s
}

start().catch(err => {
  console.error("Failed to start:", err);
  process.exit(1);
});
