// Mock database for testing (no PostgreSQL required)
class MockDatabase {
  constructor() {
    this.users = new Map();
    this.notifications = new Map();
    this.preferences = new Map();
    this.idCounter = 1;
    this.notificationIdCounter = 1;
    
    // Seed test user
    this.users.set('test_user_001', {
      id: this.idCounter++,
      user_uuid: 'test_user_001',
      email: 'test@example.com',
      created_at: new Date()
    });
    
    // Seed test preferences
    this.preferences.set('test_user_001', {
      in_app_enabled: true,
      email_enabled: true,
      push_enabled: false,
      quiet_hours_start: null,
      quiet_hours_end: null,
      timezone: 'UTC'
    });
  }

  async query(sql, params) {
    // Parse query type
    if (sql.includes('CREATE TABLE')) {
      return { rows: [], rowCount: 0 };
    }
    
    if (sql.includes('CREATE INDEX')) {
      return { rows: [], rowCount: 0 };
    }

    // SELECT COUNT(*) FROM users WHERE user_uuid
    if (sql.includes('SELECT id FROM users WHERE user_uuid')) {
      const userId = params[0];
      const user = this.users.get(userId);
      return {
        rows: user ? [{ id: user.id }] : [],
        rowCount: user ? 1 : 0
      };
    }

    // INSERT INTO users
    if (sql.includes('INSERT INTO users')) {
      const user = {
        id: this.idCounter++,
        user_uuid: params[0],
        email: params[1],
        created_at: new Date()
      };
      this.users.set(params[0], user);
      return { rows: [user], rowCount: 1 };
    }

    // SELECT FROM notifications with pagination
    if (sql.includes('SELECT id, notification_uuid')) {
      const userId = params[0];
      const limit = params[1];
      const offset = params[2];
      
      const user = this.users.get(userId);
      if (!user) return { rows: [], rowCount: 0 };
      
      const userNotifications = Array.from(this.notifications.values())
        .filter(n => n.user_id === user.id && !n.deleted_at)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(offset, offset + limit);

      return { rows: userNotifications, rowCount: userNotifications.length };
    }

    // SELECT COUNT(*) FROM notifications
    if (sql.includes('SELECT COUNT(*) FROM notifications')) {
      const userId = params[0];
      const user = this.users.get(userId);
      if (!user) return { rows: [{ count: '0' }], rowCount: 1 };
      
      const count = Array.from(this.notifications.values())
        .filter(n => n.user_id === user.id && !n.deleted_at).length;
      return { rows: [{ count: count.toString() }], rowCount: 1 };
    }

    // SELECT * FROM notifications WHERE notification_uuid
    if (sql.includes('SELECT * FROM notifications') && sql.includes('notification_uuid')) {
      const notificationId = params[0];
      const userId = params[1];
      const user = this.users.get(userId);
      
      const notif = this.notifications.get(notificationId);
      if (notif && notif.user_id === user.id && !notif.deleted_at) {
        return { rows: [notif], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    // COUNT(*) unread
    if (sql.includes('SELECT COUNT(*) as unread_count')) {
      const userId = params[0];
      const user = this.users.get(userId);
      if (!user) return { rows: [{ unread_count: '0' }], rowCount: 1 };
      
      const count = Array.from(this.notifications.values())
        .filter(n => n.user_id === user.id && n.status === 'unread' && !n.deleted_at).length;
      return { rows: [{ unread_count: count.toString() }], rowCount: 1 };
    }

    // UPDATE notifications SET status = 'read'
    if (sql.includes('UPDATE notifications') && sql.includes('status = \'read\'')) {
      const notificationId = params[0];
      const userId = params[1];
      const user = this.users.get(userId);
      
      const notif = this.notifications.get(notificationId);
      if (notif && notif.user_id === user.id) {
        notif.status = 'read';
        notif.read_at = new Date();
        return { rows: [notif], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    // UPDATE notifications SET status = 'read', read_at = NOW() - mark all read
    if (sql.includes('UPDATE notifications') && sql.includes('read-all')) {
      const userId = params[0];
      const user = this.users.get(userId);
      if (!user) return { rows: [], rowCount: 0 };
      
      let count = 0;
      this.notifications.forEach(notif => {
        if (notif.user_id === user.id && notif.status === 'unread') {
          notif.status = 'read';
          notif.read_at = new Date();
          count++;
        }
      });
      return { rows: Array(count).fill({}), rowCount: count };
    }

    // UPDATE notifications SET deleted_at = NOW()
    if (sql.includes('UPDATE notifications') && sql.includes('deleted_at')) {
      const notificationId = params[0];
      const userId = params[1];
      const user = this.users.get(userId);
      
      const notif = this.notifications.get(notificationId);
      if (notif && notif.user_id === user.id) {
        notif.deleted_at = new Date();
        return { rows: [{ id: notif.id }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    // SELECT FROM notification_preferences
    if (sql.includes('SELECT in_app_enabled')) {
      const userId = params[0];
      const user = this.users.get(userId);
      if (!user) return { rows: [], rowCount: 0 };
      
      const prefs = this.preferences.get(userId);
      return { rows: prefs ? [prefs] : [], rowCount: prefs ? 1 : 0 };
    }

    // INSERT or UPDATE preferences
    if (sql.includes('INSERT INTO notification_preferences')) {
      const userId = params[0];
      const prefs = {
        user_id: userId,
        in_app_enabled: params[1],
        email_enabled: params[2],
        push_enabled: params[3],
        quiet_hours_start: params[4],
        quiet_hours_end: params[5],
        timezone: params[6],
        updated_at: new Date()
      };
      this.preferences.set(userid, prefs);
      return { rows: [prefs], rowCount: 1 };
    }

    console.log('Unhandled query:', sql);
    return { rows: [], rowCount: 0 };
  }

  async connect() {
    console.log('✅ Mock database connected (no PostgreSQL required)');
  }

  async end() {
    console.log('Mock database connection closed');
  }

  // Helper: Add test notification
  addTestNotification(userId, data = {}) {
    const user = this.users.get(userId);
    if (!user) return null;

    const notif = {
      id: this.notificationIdCounter++,
      notification_uuid: `ntf_${Math.random().toString(36).substr(2, 21)}`,
      user_id: user.id,
      title: data.title || 'Test Notification',
      message: data.message || 'This is a test notification',
      type: data.type || 'info',
      status: data.status || 'unread',
      priority: data.priority || 'normal',
      action_url: data.action_url || null,
      metadata: data.metadata || null,
      created_at: new Date(),
      read_at: null,
      deleted_at: null
    };

    this.notifications.set(notif.notification_uuid, notif);
    return notif;
  }
}

module.exports = { client: new MockDatabase(), initializeDatabase: async () => {} };
