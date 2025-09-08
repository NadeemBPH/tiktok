require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const { sequelize } = require("./models");
require("./models/TikTokUser");
require("./models/TikTokVideo");

const app = express();
app.use(bodyParser.json({ limit: "5mb" }));
app.use(bodyParser.urlencoded({ extended: false }));

// fast health/readiness
app.get('/', (req, res) => res.json({ ok: true, service: 'tiktok-scraper' }));
app.get('/health', (req, res) => res.json({ ok: true }));

// routes
app.use("/auth", require("./routes/auth"));
app.use("/users", require("./routes/users"));

const PORT = process.env.PORT || 4000;

async function start() {
  console.log(`[boot] Starting service on port ${PORT} (NODE_ENV=${process.env.NODE_ENV || 'development'})`);

  // start server immediately so healthcheck passes
  const server = app.listen(PORT, '0.0.0.0', () => console.log(`Server running on http://0.0.0.0:${PORT}`));
  server.headersTimeout = 120000;
  server.requestTimeout = 120000;

  // run DB sync in background; don't block health
  (async () => {
    try {
      console.log('[db] Sync start');
      await sequelize.sync({ alter: true });
      console.log('[db] Sync complete');
    } catch (err) {
      console.error('[db] Sync error:', err.message);
    }
  })();
}

process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});

start().catch(err => {
  console.error("Failed to start:", err);
  process.exit(1);
});
