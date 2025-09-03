require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const { sequelize } = require("./models");
const TikTokUser = require("./models/TikTokUser");
const TikTokVideo = require("./models/TikTokVideo");

const app = express();
app.use(bodyParser.json({ limit: "5mb" }));
app.use(bodyParser.urlencoded({ extended: false }));

// Add request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Health check endpoints
app.get('/', (req, res) => {
  res.json({
    ok: true,
    service: 'tiktok-scraper',
    status: 'operational',
    timestamp: new Date().toISOString()
  });
});

app.get('/health', async (req, res) => {
  try {
    // Check database connection
    await sequelize.authenticate();
    
    res.json({
      ok: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected',
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(503).json({
      ok: false,
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Routes
app.use("/auth", require("./routes/auth"));
app.use("/users", require("./routes/users"));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    ok: false,
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

const PORT = process.env.PORT || 4000;

// Graceful shutdown handler
function setupGracefulShutdown(server) {
  const shutdown = async () => {
    console.log('Received shutdown signal, closing server...');
    
    try {
      // Close the server first to stop accepting new connections
      await new Promise((resolve) => server.close(resolve));
      console.log('Server closed');
      
      // Close database connections
      if (sequelize) {
        await sequelize.close();
        console.log('Database connection closed');
      }
      
      process.exit(0);
    } catch (error) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  };

  // Handle various shutdown signals
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
  process.on('SIGQUIT', shutdown);
}

// Start the server
async function start() {
  try {
    console.log(`[boot] Starting service on port ${PORT} (NODE_ENV=${process.env.NODE_ENV || 'development'})`);
    
    // Test database connection
    await sequelize.authenticate();
    console.log('Database connection established');
    
    // Sync database models
    await sequelize.sync({ alter: true });
    console.log('Database synced');
    
    // Start the server
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://0.0.0.0:${PORT}`);
      console.log('Press Ctrl+C to stop the server');
    });
    
    // Configure server timeouts
    server.headersTimeout = 300000; // 5 minutes
    server.requestTimeout = 300000; // 5 minutes
    server.keepAliveTimeout = 120000; // 2 minutes
    
    // Setup graceful shutdown
    setupGracefulShutdown(server);
    
  } catch (error) {
    console.error("Failed to start:", error);
    process.exit(1);
  }
}

// Start the application
start().catch(error => {
  console.error("Fatal error during startup:", error);
  process.exit(1);
});
