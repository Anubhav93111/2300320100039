# Stage 1

## Notification System Design

### Core Actions
1. List notifications for logged-in users.
2. Get one notification detail.
3. Get unread count for badge display.
4. Mark one notification as read.
5. Mark all notifications as read.
6. Delete one notification.
7. Manage notification preferences.
8. Receive real-time updates.

### REST API Endpoints
- `GET /api/v1/notifications?page=1&limit=20&status=all` - list notifications
- `GET /api/v1/notifications/{id}` - get one notification
- `GET /api/v1/notifications/unread-count` - unread badge count
- `PATCH /api/v1/notifications/{id}/read` - mark one as read
- `PATCH /api/v1/notifications/read-all` - mark all as read
- `DELETE /api/v1/notifications/{id}` - delete one notification
- `GET /api/v1/notification-preferences` - fetch preferences
- `PUT /api/v1/notification-preferences` - update preferences

### Common Headers
Request headers:
```http
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
Accept: application/json
```
Response headers:
```http
Content-Type: application/json
X-Request-Id: <uuid>
```

### Sample JSON
List response:
```json
{"status":"success","data":{"items":[{"id":"ntf_1","title":"new message","message":"you received a message","type":"message","status":"unread","created_at":"2026-06-09T10:30:00Z"}],"pagination":{"page":1,"limit":20,"total":40}}}
```
Read request:
```json
{"read":true}
```
Preferences request:
```json
{"channels":{"in_app":true,"email":false,"push":true},"types":{"order":true,"message":true,"promotion":false}}
```

### Essential Schemas
Notification: `id, user_id, title, message, type, status, priority, action_url, metadata, created_at, read_at`

Preferences: `channels, types, quiet_hours`

### Real-Time Mechanism
Use WebSocket or Socket.IO.
- Endpoint: `wss://<host>/api/v1/notifications/stream`
- Client connects after login using JWT.
- Server sends `notification.created`, `notification.updated`, and `notification.unread_count` events.
- Client uses heartbeat and auto-reconnect to stay synced.

Stage 2
1. Database Choice
Recommended Database: MongoDB

Reasons:

Flexible schema for different notification types.
High write throughput.
Easy horizontal scaling using sharding.
JSON-like documents map directly to API responses.
Supports indexing for fast retrieval.
2. Database Schema
notifications Collection
{
  "_id": "6658a1234abc",
  "userId": "USR001",
  "title": "Order Confirmed",
  "message": "Your order #1234 has been confirmed",
  "type": "ORDER",
  "status": "UNREAD",
  "priority": "HIGH",
  "createdAt": "2026-06-09T10:00:00Z",
  "readAt": null,
  "metadata": {
    "orderId": "1234"
  }
}
users Collection
{
  "_id": "USR001",
  "name": "Anubhav Kumar",
  "email": "anubhav@example.com"
}
3. Indexes
Fetch Notifications Quickly
db.notifications.createIndex({
  userId: 1,
  createdAt: -1
});
Fetch Unread Notifications
db.notifications.createIndex({
  userId: 1,
  status: 1
});
4. Data Growth Challenges
Problem 1: Huge Number of Notifications

Millions of notifications can slow queries.

Solution:

Archive old notifications.
Add indexes.
Use pagination.
Problem 2: Database Storage Growth

Storage increases rapidly.

Solution:

db.notifications.createIndex(
  { createdAt: 1 },
  { expireAfterSeconds: 31536000 }
);

Automatically removes notifications older than 1 year.

Problem 3: High Read Traffic

Users frequently check notifications.

Solution:

Use Redis caching.
Store unread counts in cache.
Problem 4: High Write Traffic

Thousands of notifications generated simultaneously.

Solution:

Use message queues like:
Apache Kafka
RabbitMQ

Queue notifications before inserting into MongoDB.

5. NoSQL Queries
Create Notification
db.notifications.insertOne({
  userId: "USR001",
  title: "Payment Successful",
  message: "₹500 received",
  type: "PAYMENT",
  status: "UNREAD",
  createdAt: new Date()
});
Get User Notifications

Corresponding API:

GET /api/v1/notifications

Query:

db.notifications.find({
  userId: "USR001"
}).sort({
  createdAt: -1
}).limit(20);
Get Unread Notifications
db.notifications.find({
  userId: "USR001",
  status: "UNREAD"
});
Mark Notification as Read

Corresponding API:

PATCH /api/v1/notifications/:id/read

Query:

db.notifications.updateOne(
  { _id: ObjectId("6658a1234abc") },
  {
    $set: {
      status: "READ",
      readAt: new Date()
    }
  }
);
Mark All Notifications as Read
db.notifications.updateMany(
  {
    userId: "USR001",
    status: "UNREAD"
  },
  {
    $set: {
      status: "READ",
      readAt: new Date()
    }
  }
);
Delete Notification
db.notifications.deleteOne({
  _id: ObjectId("6658a1234abc")
});
6. Real-Time Notification Storage Flow
Application Event
       │
       ▼
 Notification Service
       │
       ├── Store in MongoDB
       │
       └── Push via WebSocket
               │
               ▼
            Frontend


# Stage 3

## Query Review

The given query is logically correct for fetching one student's unread notifications:


SELECT * FROM notifications
WHERE studentID = 1042 AND isRead = false
ORDER BY createdAt ASC;


## Why It Is Slow

1. It may scan a very large number of rows if there is no useful index.
2. `SELECT *` reads every column, even if the API does not need them all.
3. `ORDER BY createdAt ASC` can force a sort after filtering.
4. A boolean filter like `isRead = false` alone is not selective enough.

## What I Would Change

Use a composite index that matches the filter and ordering pattern:

```sql
CREATE INDEX idx_notifications_student_read_created
ON notifications (studentID, isRead, createdAt);
```

Then fetch only the required columns:

```sql
SELECT notificationID, title, message, notificationType, createdAt
FROM notifications
WHERE studentID = 1042 AND isRead = false
ORDER BY createdAt ASC;
```

## Likely Computation Cost

- Without a good index: roughly `O(N)` scan plus `O(U log U)` sorting, where `N` is total rows and `U` is unread rows for that student.
- With the right composite index: closer to `O(log N + U)` because the database can filter and read rows in order more efficiently.

## Are Indexes on Every Column a Good Idea?

No.

- Too many indexes slow down `INSERT`, `UPDATE`, and `DELETE`.
- They consume extra storage.
- The database may not use low-value indexes, especially on columns like `isRead`.
- Indexes should be chosen based on real query patterns, not added everywhere.

## Placement Query

To find all students who got a placement notification in the last 7 days:

```sql
SELECT DISTINCT studentID
FROM notifications
WHERE notificationType = 'Placement'
  AND createdAt >= NOW() - INTERVAL 7 DAY;
```

## Conclusion

The query is correct, but it is slow because of poor indexing and extra sorting work. A composite index and selective column retrieval would improve performance a lot.

# Stage 4

## Problem

Notifications are being fetched on every page load for 50,000 students with 5,000,000 notifications. This causes database overload and poor user experience.

## Performance Improvement Strategies

### 1. Client-Side Caching

Store notifications in browser `localStorage` or `sessionStorage`.

```javascript
// Save notifications
localStorage.setItem('notifications', JSON.stringify(notifications));

// Load cached notifications on page load
const cached = JSON.parse(localStorage.getItem('notifications')) || [];
```

**Tradeoffs:**
- **Pros:** Zero database calls. Instant page load.
- **Cons:** Stale data. Loss on browser clear. Multiple devices see different data.

### 2. Server-Side Caching with Redis

Cache unread counts and recent notifications in Redis.

```javascript
// Cache unread count
app.get('/api/v1/notifications/unread-count', async (req, res) => {
  const cacheKey = `unread:${req.user.id}`;
  let count = await redis.get(cacheKey);

  if (!count) {
    count = await db.notifications.count({
      userId: req.user.id,
      status: 'unread'
    });
    await redis.setex(cacheKey, 300, count); // Cache for 5 minutes
  }

  res.json({ unread_count: count });
});
```

**Tradeoffs:**
- **Pros:** Fast reads. Reduces database load.
- **Cons:** Additional infrastructure. Cache invalidation challenges. Stale data possible.

### 3. Pagination and Lazy Loading

Fetch only 20-30 notifications per page instead of all.

```sql
SELECT * FROM notifications
WHERE userId = :id AND deleted_at IS NULL
ORDER BY createdAt DESC
LIMIT 20 OFFSET 0;
```

**Tradeoffs:**
- **Pros:** Less data per request. Faster queries.
- **Cons:** Users must click "Load More". More API calls over time.

### 4. Service Worker & Offline Support

Cache notifications using Service Worker for offline access.

```javascript
self.addEventListener('install', () => {
  caches.open('notifications-v1').then(cache => {
    cache.addAll(['/api/v1/notifications']);
  });
});
```

**Tradeoffs:**
- **Pros:** Works offline. Faster first load.
- **Cons:** Complex to implement. Sync challenges.

### 5. Read Replicas

Set up read-only database replicas for notification queries.

```javascript
// Route reads to replica, writes to primary
const readDbConnection = createReadReplicaConnection();
const writeDbConnection = createPrimaryDbConnection();
```

**Tradeoffs:**
- **Pros:** Spreads load. Fast reads without slowing writes.
- **Cons:** High cost. Replication lag. Complexity.

### 6. Pre-Computed Unread Counts

Update unread count in separate denormalized table using background jobs.

```sql
CREATE TABLE user_notification_counts (
  userId BIGINT PRIMARY KEY,
  unreadCount INT,
  lastUpdated TIMESTAMP
);

-- Background job runs every 1 minute
UPDATE user_notification_counts
SET unreadCount = (
  SELECT COUNT(*) FROM notifications
  WHERE userId = user_notification_counts.userId AND status = 'unread'
);
```

**Tradeoffs:**
- **Pros:** O(1) unread count lookup.
- **Cons:** Extra storage. Eventual consistency (1-min delay).

## Recommended Approach (Hybrid)

Combine multiple strategies:

1. Use **server-side Redis caching** for unread counts (5-minute TTL).
2. Use **pagination** to fetch 20 notifications per page.
3. Use **client-side caching** with a `Last-Modified` header to detect changes.
4. Use **Service Worker** to cache the first page for instant load.
5. Add **read replicas** only if Redis alone does not solve the issue.

## Cache Invalidation Strategy

When a notification is created, updated, or read:

```javascript
async function invalidateCache(userId) {
  await redis.del(`unread:${userId}`);
  await redis.del(`notifications:${userId}:page:1`);
}
```

## Expected Performance Gain

- Without caching: ~500ms per API call.
- With Redis caching: ~5-10ms per API call (50x faster).
- With pagination: Reduce payload by 80%.
- With Service Worker: First load instant (cached).

## Conclusion

A combination of Redis caching, pagination, and client-side strategies will reduce database load significantly and provide a much better user experience.

# Stage 5

## Notify All Implementation Analysis

### Original Synchronous Implementation

```pseudocode
function notify_all(student_ids: array, message: string):
    for student_id in student_ids:
      send_email(student_id, message)  # calls Email API
      save_to_db(student_id, message)  # DB insert
      push_to_app(student_id, message) # WebSocket/real-time push
```

### Shortcomings

1. **No Asynchronicity:** Processing 50,000 students sequentially blocks the HR's request for hours.
2. **No Error Handling:** If send_email fails for 200 students, there's no retry, no rollback.
3. **Inconsistent State:** 200 students failed email but DB and push may have succeeded. Now they have the notification but no email.
4. **No Idempotency:** If the process crashes, restarting causes duplicate emails.
5. **Tight Coupling:** All three operations (email, DB, push) are tightly coupled. Email failure cascades.
6. **No Logging:** Missing observability using the custom logging middleware.
7. **Single Point of Failure:** If email API is slow, the entire operation stalls.

### What Happened When 200 Emails Failed?

Status is inconsistent:
- 49,800 students received emails.
- All 50,000 got DB entries.
- All 50,000 got in-app notifications.

The 200 who failed have no email but have the notification. Manual retry is needed but error tracking is absent.

### Redesigned Solution: Async Queue-Based Architecture

Use a message queue (RabbitMQ, Kafka) to decouple operations. Database is the source of truth.

```pseudocode
function notify_all(student_ids: array, message: string):
    // Step 1: Save all notifications to DB first (atomically)
    batch_insert_notifications(student_ids, message)
    
    // Step 2: Queue email and push tasks asynchronously
    for student_id in student_ids:
        queue.enqueue({
            task_type: "send_email",
            student_id: student_id,
            message: message,
            idempotency_key: hash(student_id, message, timestamp),
            retry_count: 0,
            max_retries: 3
        })
    
    // Step 3: Return immediately to HR
    return { status: "queued", total: len(student_ids) }
```

### Should DB Save and Email Happen Together?

**No.** They should be separate:

- **Database should be the source of truth first.** Save to DB atomically, then queue email/push.
- **Eventual Consistency:** Email and push are fire-and-forget async tasks with retries.
- **Why:** If email fails, notification is still in the app. Email is secondary.
- **Tradeoff:** Email delays 5-10 seconds but notifications are instant and reliable.

### Worker Service Implementation

```javascript
const { log } = require("./logging_middleware");

async function processEmailQueue() {
  const message = await queue.dequeue();
  
  if (!message) return;
  
  const { student_id, message_text, idempotency_key, retry_count, max_retries } = message;
  
  try {
    // Log the attempt
    await log("backend", "info", "email_worker", 
      `sending email to student=${student_id} attempt=${retry_count + 1}`);
    
    // Attempt send with idempotency key
    const result = await emailAPI.send({
      to: getStudentEmail(student_id),
      body: message_text,
      idempotency_key: idempotency_key
    });
    
    // Log success
    await log("backend", "info", "email_worker", 
      `email sent student=${student_id}`);
    
  } catch (error) {
    // Log error using custom logger
    await log("backend", "error", "email_worker", 
      `email failed student=${student_id} error=${error.message}`);
    
    if (retry_count < max_retries) {
      // Exponential backoff
      const delay = Math.pow(2, retry_count) * 1000;
      await queue.delay(message, delay);
      message.retry_count++;
      await queue.enqueue(message);
    } else {
      // Final failure - log and skip
      await log("backend", "fatal", "email_worker", 
        `email max retries exceeded student=${student_id}`);
    }
  }
}
```

### In-App Push via WebSocket

Real-time push happens immediately after DB save:

```javascript
async function pushNotification(studentId, message) {
  await log("backend", "info", "websocket", 
    `pushing to student=${studentId}`);
  
  websocket.emit("notification.created", {
    student_id: studentId,
    message: message,
    timestamp: new Date()
  });
}
```

### Reliability Guarantees

1. **Idempotency:** Same `idempotency_key` prevents duplicates on retry.
2. **Retry Logic:** 3 retries with exponential backoff (1s, 2s, 4s).
3. **Dead Letter Queue:** Messages that fail 3 times go to DLQ for manual review.
4. **Logging:** Every step logged using custom middleware for audit trail.
5. **Atomicity:** All 50,000 DB inserts succeed or all roll back.

### Architecture Diagram

```
HR clicks "Notify All"
    │
    ▼
Validate & batch_insert_notifications to DB (atomic, all-or-nothing)
    │
    ├─ Success: 50,000 students have notifications
    │
    ├─ For each student_id, enqueue { task_type: "send_email", ... }
    │
    └─ Return { status: "queued" } to HR immediately
    
Background Workers (multiple instances)
    ├─ Email Worker: Dequeue, retry with exponential backoff
    │
    └─ Push Worker: Send via WebSocket immediately
```

### Performance

- **Response Time:** < 500ms (DB insert + queue enqueue, no email wait).
- **Email Delivery:** 5-10 minutes for all 50,000 (background workers scale horizontally).
- **In-App Delivery:** < 1 second (WebSocket push happens in parallel).

### If 200 Emails Fail Again

1. All 50,000 students have the notification in DB and app.
2. 200 failed emails are logged with student IDs.
3. Retry workers automatically retry 3 times.
4. Failed emails after 3 retries go to DLQ.
5. Manual alert triggers for DLQ investigation.
6. HR can retry specific failed students later.

## Conclusion

The original synchronous implementation is unreliable and slow. An async queue-based approach with DB-first semantics, idempotency keys, retry logic, and logging ensures reliability and fast delivery for 50,000 students.
