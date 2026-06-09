# Stage 1: Notification System Design

## Core Actions

1. Create Notification
2. Get All Notifications
3. Get Unread Notifications
4. Mark Notification as Read
5. Mark All Notifications as Read
6. Delete Notification
7. Real-Time Notification Delivery

## API Endpoints

| Method | Endpoint                        | Purpose                        |
| ------ | ------------------------------- | ------------------------------ |
| POST   | /api/v1/notifications           | Create notification            |
| GET    | /api/v1/notifications           | Get all notifications          |
| GET    | /api/v1/notifications/unread    | Get unread notifications       |
| PATCH  | /api/v1/notifications/{id}/read | Mark one notification as read  |
| PATCH  | /api/v1/notifications/read-all  | Mark all notifications as read |
| DELETE | /api/v1/notifications/{id}      | Delete notification            |

## Common Headers
1-> Authorization: Bearer <JWT_TOKEN>
2-> Content-Type: application/json

## Notification JSON Structure

{
  "id": "notif_123",
  "userId": "user_101",
  "title": "New Message",
  "message": "You received a new message.",
  "type": "message",
  "isRead": false,
  "createdAt": "2026-06-09T10:30:00Z"
}

## Logical Implementation

* User logs in and JWT token is verified.
* Notifications are stored in the database.
* GET APIs fetch notifications for the logged-in user.
* PATCH APIs update the `isRead` status.
* DELETE API removes a notification.
* POST API creates a new notification when an event occurs.

## Real-Time Notifications

Use **WebSocket (Socket.IO)**.

**Flow:**

1. User connects to WebSocket after login.
2. Server authenticates using JWT.
3. When a new notification is created, the server pushes it instantly to the user.
4. Frontend updates the notification bell and unread count without page refresh.

## Database Fields

* id
* userId
* title
* message
* type
* isRead
* createdAt

## Conclusion

The system uses REST APIs for notification management and WebSockets for real-time updates. JWT authentication ensures secure access, while a consistent JSON structure makes frontend integration easy.
