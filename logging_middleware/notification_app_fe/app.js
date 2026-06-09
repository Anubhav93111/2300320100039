// Frontend notification app with client-side caching (Stage 4)
class NotificationApp {
  constructor() {
    this.baseUrl = 'http://localhost:5000/api/v1';
    this.userId = 'test_user_001';
    this.cacheTTL = 5 * 60 * 1000; // 5 minutes
    this.notifications = [];
    this.currentPage = 1;
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.loadFromCache();
    this.fetchNotifications();
  }

  setupEventListeners() {
    document.getElementById('refreshBtn').addEventListener('click', () => this.fetchNotifications());
    document.getElementById('markAllReadBtn').addEventListener('click', () => this.markAllRead());
    document.getElementById('nextPageBtn').addEventListener('click', () => this.nextPage());
    document.getElementById('prevPageBtn').addEventListener('click', () => this.prevPage());
  }

  // Client-side caching (Stage 4)
  saveToCache(data) {
    const cacheData = {
      timestamp: Date.now(),
      notifications: data
    };
    localStorage.setItem('notifications_cache', JSON.stringify(cacheData));
  }

  loadFromCache() {
    const cached = localStorage.getItem('notifications_cache');
    if (!cached) return null;

    const { timestamp, notifications } = JSON.parse(cached);
    const isExpired = Date.now() - timestamp > this.cacheTTL;

    if (!isExpired) {
      this.notifications = notifications;
      this.render();
      console.log('Loaded from cache');
      return notifications;
    }

    localStorage.removeItem('notifications_cache');
    return null;
  }

  async fetchNotifications() {
    try {
      const response = await fetch(
        `${this.baseUrl}/notifications?page=${this.currentPage}&limit=20`,
        {
          headers: {
            'x-user-id': this.userId,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      this.notifications = data.data.items;
      this.saveToCache(this.notifications);
      this.updatePagination(data.data.pagination);
      this.render();
    } catch (error) {
      console.error('Error fetching notifications:', error);
      this.showError(`Failed to fetch notifications: ${error.message}`);
    }
  }

  async fetchUnreadCount() {
    try {
      const response = await fetch(`${this.baseUrl}/notifications/unread-count`, {
        headers: { 'x-user-id': this.userId }
      });

      const data = await response.json();
      document.getElementById('unreadBadge').textContent = data.data.unread_count;
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  }

  async markAsRead(notificationId) {
    try {
      const response = await fetch(
        `${this.baseUrl}/notifications/${notificationId}/read`,
        {
          method: 'PATCH',
          headers: { 'x-user-id': this.userId, 'Content-Type': 'application/json' },
          body: JSON.stringify({ read: true })
        }
      );

      if (response.ok) {
        this.fetchNotifications();
        this.fetchUnreadCount();
      }
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  }

  async markAllRead() {
    try {
      const response = await fetch(`${this.baseUrl}/notifications/read-all`, {
        method: 'PATCH',
        headers: { 'x-user-id': this.userId, 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        this.fetchNotifications();
        this.fetchUnreadCount();
      }
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  }

  async deleteNotification(notificationId) {
    try {
      const response = await fetch(`${this.baseUrl}/notifications/${notificationId}`, {
        method: 'DELETE',
        headers: { 'x-user-id': this.userId }
      });

      if (response.ok) {
        this.fetchNotifications();
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  }

  nextPage() {
    this.currentPage++;
    this.fetchNotifications();
  }

  prevPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.fetchNotifications();
    }
  }

  updatePagination(pagination) {
    document.getElementById('pageIndicator').textContent = `Page ${pagination.page} of ${pagination.total_pages}`;
    document.getElementById('prevPageBtn').disabled = pagination.page === 1;
    document.getElementById('nextPageBtn').disabled = pagination.page === pagination.total_pages;
  }

  render() {
    const container = document.getElementById('notificationsList');
    container.innerHTML = '';

    if (this.notifications.length === 0) {
      container.innerHTML = '<p>No notifications found</p>';
      return;
    }

    this.notifications.forEach(notif => {
      const div = document.createElement('div');
      div.className = `notification-item ${notif.status}`;
      div.innerHTML = `
        <div class="notification-header">
          <h3>${notif.title}</h3>
          <span class="badge ${notif.status}">${notif.status}</span>
        </div>
        <p>${notif.message}</p>
        <small>Type: ${notif.type} | Priority: ${notif.priority}</small>
        <div class="notification-actions">
          <button onclick="app.markAsRead('${notif.notification_uuid}')">Mark as Read</button>
          <button onclick="app.deleteNotification('${notif.notification_uuid}')">Delete</button>
        </div>
        <small class="timestamp">${new Date(notif.created_at).toLocaleString()}</small>
      `;
      container.appendChild(div);
    });

    this.fetchUnreadCount();
  }

  showError(message) {
    const errorDiv = document.getElementById('error');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    setTimeout(() => {
      errorDiv.style.display = 'none';
    }, 5000);
  }
}

// Initialize app on page load
document.addEventListener('DOMContentLoaded', () => {
  window.app = new NotificationApp();
});
