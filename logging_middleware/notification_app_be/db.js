// Database connection and schema setup
const { Client } = require('pg');

const client = new Client({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_NAME || 'notifications_db'
});

// Initialize database schema
async function initializeDatabase() {
  try {
    await client.connect();
    console.log('Database connected');

    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id BIGSERIAL PRIMARY KEY,
        user_uuid VARCHAR(64) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    // Create notifications table
    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id BIGSERIAL PRIMARY KEY,
        notification_uuid VARCHAR(64) UNIQUE NOT NULL,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(120) NOT NULL,
        message TEXT NOT NULL,
        type VARCHAR(30) NOT NULL,
        status VARCHAR(10) NOT NULL DEFAULT 'unread',
        priority VARCHAR(10) NOT NULL DEFAULT 'normal',
        action_url TEXT,
        metadata JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        read_at TIMESTAMP NULL,
        deleted_at TIMESTAMP NULL
      );
    `);

    // Create composite index for fast lookups
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_notifications_user_status_created
      ON notifications (user_id, status, created_at DESC);
    `);

    // Create notification_preferences table
    await client.query(`
      CREATE TABLE IF NOT EXISTS notification_preferences (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        in_app_enabled BOOLEAN NOT NULL DEFAULT TRUE,
        email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
        push_enabled BOOLEAN NOT NULL DEFAULT FALSE,
        quiet_hours_start TIME,
        quiet_hours_end TIME,
        timezone VARCHAR(64),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    console.log('Database schema initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
}

module.exports = { client, initializeDatabase };
