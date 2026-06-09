// Notification routes and API endpoints (Stage 1)
const express = require('express');
const { client } = require('./db');
const { log } = require('../logging_package/src');

const router = express.Router();

// Middleware: Authentication (pre-authorized users)
const authMiddleware = (req, res, next) => {
  const userId = req.headers['x-user-id'];
  if (!userId) {
    return res.status(401).json({
      status: 'error',
      error: { code: 'auth_required', message: 'User ID required' }
    });
  }
  req.userId = userId;
  next();
};

router.use(authMiddleware);

// Helper: Generate UUID
function generateUUID() {
  return 'ntf_' + Math.random().toString(36).substr(2, 21);
}

// GET /api/v1/notifications - List notifications with pagination
router.get('/notifications', async (req, res) => {
  try {
    const { page = 1, limit = 20, status = 'all' } = req.query;
    const offset = (page - 1) * limit;

    await log('backend', 'info', 'notifications_api', 
      `fetching notifications user_id=${req.userId} page=${page}`);

    const result = await client.query(
      `SELECT id, notification_uuid, title, message, type, status, priority, action_url, metadata, created_at, read_at
       FROM notifications
       WHERE user_id = (SELECT id FROM users WHERE user_uuid = $1) AND deleted_at IS NULL
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.userId, limit, offset]
    );

    const totalResult = await client.query(
      `SELECT COUNT(*) FROM notifications
       WHERE user_id = (SELECT id FROM users WHERE user_uuid = $1) AND deleted_at IS NULL`,
      [req.userId]
    );

    const total = parseInt(totalResult.rows[0].count);
    const totalPages = Math.ceil(total / limit);

    res.json({
      status: 'success',
      data: {
        items: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          total_pages: totalPages
        }
      }
    });

    await log('backend', 'info', 'notifications_api', 
      `notifications fetched count=${result.rows.length} user_id=${req.userId}`);
  } catch (error) {
    await log('backend', 'error', 'notifications_api', 
      `fetch failed user_id=${req.userId} error=${error.message}`);
    res.status(500).json({ status: 'error', error: { code: 'db_error', message: error.message } });
  }
});

// GET /api/v1/notifications/:id - Get single notification
router.get('/notifications/:id', async (req, res) => {
  try {
    const result = await client.query(
      `SELECT * FROM notifications
       WHERE notification_uuid = $1 AND user_id = (SELECT id FROM users WHERE user_uuid = $2) AND deleted_at IS NULL`,
      [req.params.id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ status: 'error', error: { code: 'not_found', message: 'Notification not found' } });
    }

    res.json({ status: 'success', data: result.rows[0] });
  } catch (error) {
    await log('backend', 'error', 'notifications_api', 
      `get notification failed id=${req.params.id} error=${error.message}`);
    res.status(500).json({ status: 'error', error: { code: 'db_error', message: error.message } });
  }
});

// GET /api/v1/notifications/unread-count - Get unread count
router.get('/notifications/unread-count', async (req, res) => {
  try {
    const result = await client.query(
      `SELECT COUNT(*) as unread_count FROM notifications
       WHERE user_id = (SELECT id FROM users WHERE user_uuid = $1) AND status = 'unread' AND deleted_at IS NULL`,
      [req.userId]
    );

    res.json({
      status: 'success',
      data: { unread_count: parseInt(result.rows[0].unread_count) }
    });

    await log('backend', 'info', 'notifications_api', 
      `unread count user_id=${req.userId} count=${result.rows[0].unread_count}`);
  } catch (error) {
    await log('backend', 'error', 'notifications_api', 
      `unread count failed error=${error.message}`);
    res.status(500).json({ status: 'error', error: { code: 'db_error', message: error.message } });
  }
});

// PATCH /api/v1/notifications/:id/read - Mark one as read
router.patch('/notifications/:id/read', async (req, res) => {
  try {
    const result = await client.query(
      `UPDATE notifications
       SET status = 'read', read_at = NOW()
       WHERE notification_uuid = $1 AND user_id = (SELECT id FROM users WHERE user_uuid = $2)
       RETURNING *`,
      [req.params.id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ status: 'error', error: { code: 'not_found', message: 'Notification not found' } });
    }

    res.json({ status: 'success', data: result.rows[0] });

    await log('backend', 'info', 'notifications_api', 
      `marked read notification_id=${req.params.id} user_id=${req.userId}`);
  } catch (error) {
    await log('backend', 'error', 'notifications_api', 
      `mark read failed id=${req.params.id} error=${error.message}`);
    res.status(500).json({ status: 'error', error: { code: 'db_error', message: error.message } });
  }
});

// PATCH /api/v1/notifications/read-all - Mark all as read
router.patch('/notifications/read-all', async (req, res) => {
  try {
    const result = await client.query(
      `UPDATE notifications
       SET status = 'read', read_at = NOW()
       WHERE user_id = (SELECT id FROM users WHERE user_uuid = $1) AND status = 'unread'
       RETURNING id`,
      [req.userId]
    );

    res.json({
      status: 'success',
      data: { updated_count: result.rows.length }
    });

    await log('backend', 'info', 'notifications_api', 
      `marked all read user_id=${req.userId} count=${result.rows.length}`);
  } catch (error) {
    await log('backend', 'error', 'notifications_api', 
      `mark all read failed error=${error.message}`);
    res.status(500).json({ status: 'error', error: { code: 'db_error', message: error.message } });
  }
});

// DELETE /api/v1/notifications/:id - Delete one notification
router.delete('/notifications/:id', async (req, res) => {
  try {
    const result = await client.query(
      `UPDATE notifications
       SET deleted_at = NOW()
       WHERE notification_uuid = $1 AND user_id = (SELECT id FROM users WHERE user_uuid = $2)
       RETURNING id`,
      [req.params.id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ status: 'error', error: { code: 'not_found', message: 'Notification not found' } });
    }

    res.json({ status: 'success', data: { deleted_id: req.params.id } });

    await log('backend', 'info', 'notifications_api', 
      `deleted notification_id=${req.params.id} user_id=${req.userId}`);
  } catch (error) {
    await log('backend', 'error', 'notifications_api', 
      `delete failed id=${req.params.id} error=${error.message}`);
    res.status(500).json({ status: 'error', error: { code: 'db_error', message: error.message } });
  }
});

// GET /api/v1/notification-preferences - Get preferences
router.get('/notification-preferences', async (req, res) => {
  try {
    const result = await client.query(
      `SELECT in_app_enabled, email_enabled, push_enabled, quiet_hours_start, quiet_hours_end, timezone
       FROM notification_preferences
       WHERE user_id = (SELECT id FROM users WHERE user_uuid = $1)`,
      [req.userId]
    );

    const preferences = result.rows[0] || {
      in_app_enabled: true,
      email_enabled: true,
      push_enabled: false
    };

    res.json({ status: 'success', data: preferences });

    await log('backend', 'info', 'notifications_api', 
      `fetched preferences user_id=${req.userId}`);
  } catch (error) {
    await log('backend', 'error', 'notifications_api', 
      `fetch preferences failed error=${error.message}`);
    res.status(500).json({ status: 'error', error: { code: 'db_error', message: error.message } });
  }
});

// PUT /api/v1/notification-preferences - Update preferences
router.put('/notification-preferences', async (req, res) => {
  try {
    const { in_app_enabled, email_enabled, push_enabled, quiet_hours_start, quiet_hours_end, timezone } = req.body;

    const userIdResult = await client.query(`SELECT id FROM users WHERE user_uuid = $1`, [req.userId]);
    if (userIdResult.rows.length === 0) {
      return res.status(404).json({ status: 'error', error: { code: 'user_not_found' } });
    }

    const userId = userIdResult.rows[0].id;

    const result = await client.query(
      `INSERT INTO notification_preferences (user_id, in_app_enabled, email_enabled, push_enabled, quiet_hours_start, quiet_hours_end, timezone, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
       in_app_enabled = $2, email_enabled = $3, push_enabled = $4, 
       quiet_hours_start = $5, quiet_hours_end = $6, timezone = $7, updated_at = NOW()
       RETURNING *`,
      [userId, in_app_enabled, email_enabled, push_enabled, quiet_hours_start, quiet_hours_end, timezone]
    );

    res.json({ status: 'success', data: { updated: true } });

    await log('backend', 'info', 'notifications_api', 
      `updated preferences user_id=${req.userId}`);
  } catch (error) {
    await log('backend', 'error', 'notifications_api', 
      `update preferences failed error=${error.message}`);
    res.status(500).json({ status: 'error', error: { code: 'db_error', message: error.message } });
  }
});

module.exports = router;
