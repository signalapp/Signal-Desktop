# Orbital Backend API Documentation

**Version:** 0.1.0
**Base URL:** `http://localhost:3000`
**Authentication:** JWT Bearer Token

## Authentication

All protected endpoints require a JWT token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

Tokens are obtained via the `/api/auth/login` endpoint and expire after 30 days (configurable).

---

## Thread API Endpoints

### 1. Create Thread

Create a new discussion thread within a group.

**Endpoint:** `POST /api/threads`
**Authentication:** Required
**Content-Type:** `application/json`

**Request Body:**
```json
{
  "group_id": "uuid",
  "encrypted_title": "string (encrypted)",
  "encrypted_body": "string (encrypted)",
  "root_message_id": "uuid (optional - links to Signal message)"
}
```

**Response:** `201 Created`
```json
{
  "thread_id": "uuid",
  "group_id": "uuid",
  "created_at": "2024-11-07T12:00:00.000Z"
}
```

**Errors:**
- `400` - Missing required fields
- `401` - Unauthorized (no/invalid token)
- `403` - Not a member of the group
- `404` - Group not found

**Features:**
- ✅ Validates required fields (group_id, encrypted_title, encrypted_body)
- ✅ Verifies user is member of group
- ✅ Optional Signal message linkage via root_message_id
- ✅ Logs thread creation events

---

### 2. List Threads in Group

Get paginated list of threads in a group.

**Endpoint:** `GET /api/groups/:groupId/threads`
**Authentication:** Required

**Query Parameters:**
- `limit` (optional, default: 50, max: 100) - Number of threads per page
- `offset` (optional, default: 0) - Pagination offset
- `sort` (optional, default: "created_desc") - Sort order: "created_asc" or "created_desc"

**Response:** `200 OK`
```json
{
  "threads": [
    {
      "thread_id": "uuid",
      "group_id": "uuid",
      "author_id": "uuid",
      "author_username": "string",
      "encrypted_title": "string (encrypted)",
      "encrypted_body": "string (encrypted)",
      "reply_count": 42,
      "created_at": "2024-11-07T12:00:00.000Z"
    }
  ],
  "total_count": 100,
  "has_more": true
}
```

**Errors:**
- `401` - Unauthorized
- `403` - Not a member of the group
- `404` - Group not found

**Features:**
- ✅ Pagination with configurable limit/offset
- ✅ Max 100 items per page (prevents abuse)
- ✅ Includes reply count for each thread
- ✅ Returns author username from JOIN
- ✅ Sort by creation time (ascending/descending)
- ✅ Returns total count and has_more flag

---

### 3. Get Single Thread

Retrieve details for a specific thread.

**Endpoint:** `GET /api/threads/:threadId`
**Authentication:** Required

**Response:** `200 OK`
```json
{
  "thread_id": "uuid",
  "group_id": "uuid",
  "author_id": "uuid",
  "author_username": "string",
  "encrypted_title": "string (encrypted)",
  "encrypted_body": "string (encrypted)",
  "reply_count": 42,
  "created_at": "2024-11-07T12:00:00.000Z"
}
```

**Errors:**
- `401` - Unauthorized
- `403` - Not a member of the group containing this thread
- `404` - Thread not found

**Features:**
- ✅ Membership verification (via thread's group_id)
- ✅ Includes reply count
- ✅ Returns author information

---

### 4. Get Thread Replies

Retrieve paginated replies to a thread.

**Endpoint:** `GET /api/threads/:threadId/replies`
**Authentication:** Required

**Query Parameters:**
- `limit` (optional, default: 50, max: 100) - Number of replies per page
- `offset` (optional, default: 0) - Pagination offset

**Response:** `200 OK`
```json
{
  "replies": [
    {
      "reply_id": "uuid",
      "thread_id": "uuid",
      "author_id": "uuid",
      "author_username": "string",
      "encrypted_body": "string (encrypted)",
      "created_at": "2024-11-07T12:00:00.000Z"
    }
  ],
  "total_count": 42,
  "has_more": false
}
```

**Errors:**
- `401` - Unauthorized
- `403` - Not a member of the group
- `404` - Thread not found

**Features:**
- ✅ Pagination (limit/offset)
- ✅ Replies sorted by creation time (chronological)
- ✅ Membership verification
- ✅ Total count and has_more pagination indicators

---

### 5. Create Reply

Post a reply to an existing thread.

**Endpoint:** `POST /api/threads/:threadId/replies`
**Authentication:** Required
**Content-Type:** `application/json`

**Request Body:**
```json
{
  "encrypted_body": "string (encrypted)",
  "message_id": "uuid (optional - links to Signal message)"
}
```

**Response:** `201 Created`
```json
{
  "reply_id": "uuid",
  "thread_id": "uuid",
  "created_at": "2024-11-07T12:00:00.000Z"
}
```

**Errors:**
- `400` - Missing required field (encrypted_body)
- `401` - Unauthorized
- `403` - Not a member of the group
- `404` - Thread not found

**Features:**
- ✅ Validates encrypted_body required
- ✅ Optional Signal message linkage via message_id
- ✅ Membership verification
- ✅ Logs reply creation events

---

## Data Model

### Thread-to-Signal-Message Mapping

Threads can optionally link to Signal protocol messages:

- **Thread Creation:** `root_message_id` links thread to originating Signal message
- **Reply Creation:** `message_id` links reply to specific Signal message

This enables hybrid architecture where:
- Signal Protocol handles E2EE message transport
- Orbital server organizes messages into threaded discussions
- Client can map threads/replies back to Signal conversations

### Encryption

All content is encrypted **client-side** using Signal Protocol:
- `encrypted_title` - Thread title (encrypted with group's Sender Key)
- `encrypted_body` - Thread/reply body (encrypted with group's Sender Key)
- Server **never sees plaintext** - zero-knowledge architecture

### Pagination

All list endpoints support pagination:
- `limit` - Items per page (default: 50, max: 100)
- `offset` - Skip N items (for page 2: offset = limit)
- Response includes `total_count` and `has_more` for client UX

**Example Pagination:**
```
Page 1: ?limit=50&offset=0   (items 1-50)
Page 2: ?limit=50&offset=50  (items 51-100)
Page 3: ?limit=50&offset=100 (items 101-150)
```

---

## Security Features

### Authentication
- ✅ JWT-based authentication
- ✅ 30-day token expiration
- ✅ Automatic token validation on protected routes
- ✅ Secure token generation with `jsonwebtoken`

### Authorization
- ✅ Group membership verification on all operations
- ✅ Users can only access threads in groups they belong to
- ✅ Users can only create threads/replies in their groups

### Input Validation
- ✅ Required field validation
- ✅ Type validation (UUIDs, strings)
- ✅ Pagination limits enforced (max 100 items)
- ✅ SQL injection prevention (parameterized queries)

### Rate Limiting
- ✅ API-wide: 100 requests per 15 minutes per IP
- ✅ Auth endpoints: 10 requests per 15 minutes per IP

### Error Handling
- ✅ Consistent JSON error format
- ✅ Appropriate HTTP status codes
- ✅ Error logging (Winston)
- ✅ Stack traces in development only

---

## Implementation Status

| Feature | Status | Notes |
|---------|--------|-------|
| POST /api/threads | ✅ Complete | Create thread with Signal message linking |
| GET /api/groups/:groupId/threads | ✅ Complete | Paginated thread listing |
| GET /api/threads/:threadId | ✅ Complete | Single thread details |
| GET /api/threads/:threadId/replies | ✅ Complete | Paginated reply listing |
| POST /api/threads/:threadId/replies | ✅ Complete | Reply creation |
| Authentication | ✅ Complete | JWT with 30-day expiration |
| Authorization | ✅ Complete | Group membership checks |
| Input Validation | ✅ Complete | Required fields validated |
| Pagination | ✅ Complete | limit/offset with max 100 |
| Error Handling | ✅ Complete | Consistent JSON responses |
| Rate Limiting | ✅ Complete | 100 req/15min (API), 10 req/15min (auth) |
| Logging | ✅ Complete | Winston logger with request tracking |
| API Tests | ⏳ Pending | Jest + Supertest tests needed |
| API Documentation | ✅ Complete | This file |

---

## Future Enhancements

### WebSocket Real-Time Updates
Currently, thread/reply creation has TODOs for WebSocket broadcasting:
```javascript
// TODO: Broadcast to WebSocket clients in group
```

**Planned:** Real-time thread/reply notifications via WebSocket

### Search
Not yet implemented:
- Full-text search across threads (encrypted, so limited)
- Thread filtering by author
- Date range filtering

### Media Attachments
Media endpoint exists (`/api/media`) but not yet integrated with threads:
- Attach images/videos to threads
- Attach media to replies
- 7-day server retention, permanent client storage

---

## Error Response Format

All errors return consistent JSON:

```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable error message",
  "details": {
    "additional": "context (optional)"
  },
  "stack": "Stack trace (development only)"
}
```

### Common Error Codes

- `UNAUTHORIZED` (401) - Missing or invalid authentication
- `FORBIDDEN` (403) - Authenticated but lacks permission
- `NOT_FOUND` (404) - Resource not found
- `VALIDATION_ERROR` (400) - Invalid input
- `DUPLICATE_ENTRY` (409) - Resource already exists
- `TOO_MANY_REQUESTS` (429) - Rate limit exceeded
- `INTERNAL_ERROR` (500) - Server error

---

## Testing the API

### Manual Testing with curl

**1. Login to get JWT token:**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","password":"password123"}'
```

**2. Create a thread:**
```bash
curl -X POST http://localhost:3000/api/threads \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "group_id":"GROUP_UUID",
    "encrypted_title":"ENCRYPTED_TITLE",
    "encrypted_body":"ENCRYPTED_BODY"
  }'
```

**3. List threads:**
```bash
curl http://localhost:3000/api/groups/GROUP_UUID/threads?limit=10&offset=0 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**4. Get thread details:**
```bash
curl http://localhost:3000/api/threads/THREAD_UUID \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**5. Create reply:**
```bash
curl -X POST http://localhost:3000/api/threads/THREAD_UUID/replies \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"encrypted_body":"ENCRYPTED_REPLY"}'
```

**6. Get replies:**
```bash
curl http://localhost:3000/api/threads/THREAD_UUID/replies?limit=50 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Automated Testing (Pending)

Jest + Supertest tests should cover:
- ✅ Authentication flows
- ✅ Thread CRUD operations
- ✅ Reply CRUD operations
- ✅ Pagination edge cases
- ✅ Authorization checks (non-members blocked)
- ✅ Input validation
- ✅ Error responses

**To implement:** Create `src/__tests__/threads.test.js`

---

## Database Schema Reference

### threads table
```sql
id              UUID PRIMARY KEY
group_id        UUID REFERENCES groups(id)
root_message_id UUID REFERENCES signal_messages(id) (optional)
author_id       UUID REFERENCES users(id)
encrypted_title TEXT
encrypted_body  TEXT
created_at      TIMESTAMPTZ
```

### replies table
```sql
id            UUID PRIMARY KEY
thread_id     UUID REFERENCES threads(id)
message_id    UUID REFERENCES signal_messages(id) (optional)
author_id     UUID REFERENCES users(id)
encrypted_body TEXT
created_at    TIMESTAMPTZ
```

---

## Related Documentation

- [Database Migrations](./migrations/README.md) - Migration system documentation
- [Backend README](./README.md) - General backend setup
- [WebSocket Protocol](./src/websocket/signalWebSocket.js) - Real-time features

---

**Last Updated:** November 7, 2024
**Maintained By:** Orbital Team
