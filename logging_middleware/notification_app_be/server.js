// Express server with logging middleware integration
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { client, initializeDatabase } = require(process.env.USE_MOCK === 'true' ? './db-mock' : './db');
const routes = require('./routes');
const { createLoggingMiddleware, log } = require('../logging_package/src');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(bodyParser.json());
app.use(cors());

// Custom logging middleware with auth token from environment
app.use(createLoggingMiddleware({
  authToken: process.env.LOG_API_TOKEN || 'test-token',
  packageName: 'notification_server'
}));

// Routes
app.use('/api/v1', routes);

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    await log('backend', 'info', 'health_check', 'health check endpoint hit');
    res.json({ status: 'ok', message: 'Server is healthy' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Logging failed' });
  }
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ status: 'error', error: { code: 'internal_error', message: err.message } });
});

// Start server
async function startServer() {
  try {
    // Initialize database
    await initializeDatabase();
    
    // Seed test notifications if using mock
    if (process.env.USE_MOCK === 'true' && client.addTestNotification) {
      client.addTestNotification('test_user_001', {
        title: 'Welcome to Notifications',
        message: 'This is your first test notification',
        type: 'info',
        priority: 'normal'
      });
      client.addTestNotification('test_user_001', {
        title: 'Integration Test',
        message: 'Testing Stage 1 & 2 implementation',
        type: 'test',
        priority: 'normal'
      });
      client.addTestNotification('test_user_001', {
        title: 'Logging Middleware Test',
        message: 'Verify logging is working',
        type: 'warning',
        status: 'unread',
        priority: 'high'
      });
      console.log('📋 Test notifications seeded');
    }

    // Seed test user if not exists
    try {
      await client.query(
        `INSERT INTO users (user_uuid, email) VALUES ($1, $2)
         ON CONFLICT (user_uuid) DO NOTHING`,
        ['test_user_001', 'test@example.com']
      );

      // Ensure preferences exist for test user
      const userResult = await client.query(`SELECT id FROM users WHERE user_uuid = $1`, ['test_user_001']);
      if (userResult.rows.length > 0) {
        await client.query(
          `INSERT INTO notification_preferences (user_id) VALUES ($1)
           ON CONFLICT (user_id) DO NOTHING`,
          [userResult.rows[0].id]
        );
      }
    } catch (err) {
      console.log('Seeding user skipped:', err.message);
    }

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log(`Notification API available at http://localhost:${PORT}/api/v1`);
    });
  } catch (error) {
    console.error('Server startup failed:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  await client.end();
  process.exit(0);
});

startServer();
