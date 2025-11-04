# Orbital API Specification

**Backend API Design:** REST API for Orbital's custom features + Signal Protocol relay endpoints

---

## API Overview

**Architecture:**
```
Orbital Backend API
├── Signal Protocol Relay (encrypted envelope routing)
├── Threading API (thread/reply management)
├── Media API (upload/download with encryption)
├── Group Management (invite codes, membership)
└── Authentication (JWT-based)
```

**Base URL:** `https://api.orbital.example.com` (production) or `http://localhost:3000` (development)

**API Version:** v1

---

## Authentication

### JWT-Based Authentication

**All endpoints (except signup/login) require authentication.**

**Headers:**
```http
Authorization: Bearer <jwt_token>
```

**Token Expiration:** 30 days (configurable)

**Token Payload:**
```json
{
  "userId": "uuid",
  "username": "string",
  "iat": 1234567890,
  "exp": 1237159890
}
```

---

## Authentication Endpoints

### POST /api/signup

**Description:** Register new user account

**Request:**
```json
{
  "username": "string (3-50 chars, alphanumeric + underscores)",
  "password": "string (min 12 chars, uppercase, lowercase, number)",
  "public_key": {
    "kty": "RSA",
    "n": "base64",
    "e": "AQAB",
    "alg": "RSA-OAEP-256",
    "ext": true
  }
}
```

**Response (201 Created):**
```json
{
  "user_id": "uuid",
  "username": "string",
  "token": "jwt_token"
}
```

**Errors:**
- `400 VALIDATION_ERROR` - Invalid username/password
- `409 USERNAME_TAKEN` - Username already exists

---

### POST /api/login

**Description:** Authenticate existing user

**Request:**
```json
{
  "username": "string",
  "password": "string"
}
```

**Response (200 OK):**
```json
{
  "user_id": "uuid",
  "username": "string",
  "public_key": {...},
  "token": "jwt_token"
}
```

**Errors:**
- `401 INVALID_CREDENTIALS` - Wrong username/password
- `429 TOO_MANY_REQUESTS` - Rate limit exceeded (10 attempts per 15 min)

---

## Signal Protocol Relay Endpoints

### POST /v1/messages

**Description:** Send encrypted Signal Protocol message envelope

**Authentication:** Required (JWT)

**Request:**
```json
{
  "conversation_id": "uuid (group_id)",
  "encrypted_envelope": "base64_encoded_protobuf",
  "timestamp": 1234567890000
}
```

**Response (200 OK):**
```json
{
  "message_id": "uuid",
  "server_timestamp": 1234567890000
}
```

**What Server Stores:**
- Encrypted envelope (opaque binary)
- Conversation/group ID
- Timestamp
- **NOT** plaintext content

**Errors:**
- `401 UNAUTHORIZED` - Invalid token
- `403 FORBIDDEN` - Not a member of group
- `413 PAYLOAD_TOO_LARGE` - Envelope exceeds limit

---

### GET /v1/messages

**Description:** Fetch encrypted message envelopes for user

**Authentication:** Required (JWT)

**Query Parameters:**
- `since` - Timestamp (fetch messages after this time)
- `limit` - Number of messages (default 100, max 500)

**Response (200 OK):**
```json
{
  "messages": [
    {
      "message_id": "uuid",
      "conversation_id": "uuid",
      "encrypted_envelope": "base64_encoded_protobuf",
      "server_timestamp": 1234567890000
    }
  ],
  "has_more": true
}
```

---

## Group Management

### POST /api/groups

**Description:** Create new group with invite code

**Authentication:** Required (JWT)

**Request:**
```json
{
  "encrypted_name": "base64_encrypted_string (encrypted with group key)",
  "encrypted_group_key": "base64 (group key encrypted with creator's public key)"
}
```

**Response (201 Created):**
```json
{
  "group_id": "uuid",
  "invite_code": "ABCD1234 (8-char alphanumeric)",
  "created_at": "2024-11-04T12:00:00Z"
}
```

**Server Actions:**
- Generates unique 8-character invite code
- Creates group record (encrypted name)
- Adds creator as first member
- Initializes quota (10GB, 100 files)

**Errors:**
- `401 UNAUTHORIZED` - Invalid token
- `400 VALIDATION_ERROR` - Invalid encrypted name

---

### POST /api/groups/join

**Description:** Join existing group via invite code

**Authentication:** Required (JWT)

**Request:**
```json
{
  "invite_code": "ABCD1234",
  "encrypted_group_key": "base64 (group key encrypted with joiner's public key)"
}
```

**Response (200 OK):**
```json
{
  "group_id": "uuid",
  "encrypted_name": "base64",
  "member_count": 5,
  "joined_at": "2024-11-04T12:00:00Z"
}
```

**Errors:**
- `404 NOT_FOUND` - Invalid invite code
- `409 ALREADY_MEMBER` - Already in group

---

### GET /api/groups

**Description:** List user's groups

**Authentication:** Required (JWT)

**Response (200 OK):**
```json
{
  "groups": [
    {
      "group_id": "uuid",
      "encrypted_name": "base64",
      "encrypted_group_key": "base64",
      "member_count": 5,
      "invite_code": "ABCD1234",
      "joined_at": "2024-11-04T12:00:00Z"
    }
  ]
}
```

---

### GET /api/groups/:groupId/members

**Description:** List group members

**Authentication:** Required (JWT)

**Response (200 OK):**
```json
{
  "members": [
    {
      "user_id": "uuid",
      "username": "string",
      "public_key": {...},
      "joined_at": "2024-11-04T12:00:00Z"
    }
  ]
}
```

**Errors:**
- `403 FORBIDDEN` - Not a group member

---

## Threading API

### POST /api/threads

**Description:** Create new discussion thread

**Authentication:** Required (JWT)

**Request:**
```json
{
  "group_id": "uuid",
  "encrypted_title": "base64 (encrypted with group key)",
  "encrypted_body": "base64 (encrypted with group key)"
}
```

**Response (201 Created):**
```json
{
  "thread_id": "uuid",
  "group_id": "uuid",
  "created_at": "2024-11-04T12:00:00Z"
}
```

**Server Actions:**
- Creates thread record
- Associates with Signal message (encrypted envelope)
- Notifies group members via WebSocket

**Errors:**
- `403 FORBIDDEN` - Not a group member
- `400 VALIDATION_ERROR` - Missing title/body

---

### GET /api/groups/:groupId/threads

**Description:** List threads in group (paginated)

**Authentication:** Required (JWT)

**Query Parameters:**
- `limit` - Number of threads (default 50, max 100)
- `offset` - Pagination offset (default 0)
- `sort` - Sort order: `created_desc` (default), `created_asc`

**Response (200 OK):**
```json
{
  "threads": [
    {
      "thread_id": "uuid",
      "group_id": "uuid",
      "author_id": "uuid",
      "author_username": "string",
      "encrypted_title": "base64",
      "encrypted_body": "base64",
      "reply_count": 12,
      "created_at": "2024-11-04T12:00:00Z",
      "media_count": 3
    }
  ],
  "total_count": 150,
  "has_more": true
}
```

---

### GET /api/threads/:threadId

**Description:** Get single thread with details

**Authentication:** Required (JWT)

**Response (200 OK):**
```json
{
  "thread_id": "uuid",
  "group_id": "uuid",
  "author_id": "uuid",
  "author_username": "string",
  "encrypted_title": "base64",
  "encrypted_body": "base64",
  "reply_count": 12,
  "created_at": "2024-11-04T12:00:00Z",
  "media": [
    {
      "media_id": "uuid",
      "encrypted_metadata": "base64",
      "size_bytes": 52428800,
      "uploaded_at": "2024-11-04T12:05:00Z",
      "expires_at": "2024-11-11T12:05:00Z"
    }
  ]
}
```

**Errors:**
- `404 NOT_FOUND` - Thread doesn't exist
- `403 FORBIDDEN` - Not a group member

---

### GET /api/threads/:threadId/replies

**Description:** Get replies to thread

**Authentication:** Required (JWT)

**Query Parameters:**
- `limit` - Number of replies (default 50, max 100)
- `offset` - Pagination offset

**Response (200 OK):**
```json
{
  "replies": [
    {
      "reply_id": "uuid",
      "thread_id": "uuid",
      "author_id": "uuid",
      "author_username": "string",
      "encrypted_body": "base64",
      "created_at": "2024-11-04T12:10:00Z",
      "media_count": 1
    }
  ],
  "total_count": 45,
  "has_more": false
}
```

---

### POST /api/threads/:threadId/replies

**Description:** Post reply to thread

**Authentication:** Required (JWT)

**Request:**
```json
{
  "encrypted_body": "base64 (encrypted with group key)"
}
```

**Response (201 Created):**
```json
{
  "reply_id": "uuid",
  "thread_id": "uuid",
  "created_at": "2024-11-04T12:10:00Z"
}
```

**Errors:**
- `404 NOT_FOUND` - Thread doesn't exist
- `403 FORBIDDEN` - Not a group member

---

## Media API

### POST /api/media/upload

**Description:** Upload encrypted media chunk (chunked upload for large files)

**Authentication:** Required (JWT)

**Content-Type:** `multipart/form-data`

**Form Fields:**
```
media_id: uuid (same for all chunks)
thread_id: uuid
chunk_index: integer (0-based)
total_chunks: integer
chunk: binary (encrypted file chunk, max 5MB)
encrypted_metadata: base64 (filename, size, mime type - encrypted)
encryption_iv: base64 (IV for media encryption)
```

**Response (200 OK - chunk received):**
```json
{
  "media_id": "uuid",
  "chunk_index": 0,
  "chunks_received": 1,
  "total_chunks": 10
}
```

**Response (201 Created - upload complete):**
```json
{
  "media_id": "uuid",
  "size_bytes": 52428800,
  "uploaded_at": "2024-11-04T12:00:00Z",
  "expires_at": "2024-11-11T12:00:00Z"
}
```

**Errors:**
- `413 FILE_TOO_LARGE` - File exceeds 500MB
- `413 QUOTA_EXCEEDED` - Group storage quota exceeded
- `400 INVALID_CHUNK` - Chunk index/total mismatch
- `403 FORBIDDEN` - Not a group member

---

### POST /api/media/upload/complete

**Description:** Finalize chunked upload

**Authentication:** Required (JWT)

**Request:**
```json
{
  "media_id": "uuid"
}
```

**Response (200 OK):**
```json
{
  "media_id": "uuid",
  "status": "complete",
  "size_bytes": 52428800,
  "expires_at": "2024-11-11T12:00:00Z"
}
```

---

### GET /api/media/:mediaId/download

**Description:** Download encrypted media file

**Authentication:** Required (JWT)

**Response (200 OK):**
- **Content-Type:** `application/octet-stream`
- **Body:** Encrypted binary blob
- **Headers:**
  - `Content-Length: <bytes>`
  - `Content-Disposition: attachment; filename="media.enc"`
  - `X-Encryption-IV: <base64_iv>`
  - `X-Expires-At: <iso8601_timestamp>`

**Errors:**
- `404 NOT_FOUND` - Media expired or doesn't exist
- `403 FORBIDDEN` - Not a group member
- `410 GONE` - Media expired (past 7 days)

---

### GET /api/media/:mediaId/info

**Description:** Get media metadata (without downloading)

**Authentication:** Required (JWT)

**Response (200 OK):**
```json
{
  "media_id": "uuid",
  "thread_id": "uuid",
  "encrypted_metadata": "base64",
  "size_bytes": 52428800,
  "encryption_iv": "base64",
  "uploaded_at": "2024-11-04T12:00:00Z",
  "expires_at": "2024-11-11T12:00:00Z",
  "download_url": "/api/media/:mediaId/download"
}
```

---

### GET /api/threads/:threadId/media

**Description:** List all media in thread

**Authentication:** Required (JWT)

**Response (200 OK):**
```json
{
  "media": [
    {
      "media_id": "uuid",
      "encrypted_metadata": "base64",
      "size_bytes": 52428800,
      "uploaded_at": "2024-11-04T12:00:00Z",
      "expires_at": "2024-11-11T12:00:00Z"
    }
  ]
}
```

---

## Storage Quota

### GET /api/groups/:groupId/quota

**Description:** Get group storage quota status

**Authentication:** Required (JWT)

**Response (200 OK):**
```json
{
  "group_id": "uuid",
  "total_bytes": 5368709120,
  "max_bytes": 10737418240,
  "media_count": 45,
  "max_media_count": 100,
  "usage_percent": 50,
  "warning_threshold": 80,
  "is_warning": false,
  "is_full": false
}
```

---

## Error Responses

### Standard Error Format

```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable error message",
  "details": {
    "field": "Additional context (optional)"
  }
}
```

### HTTP Status Codes

| Code | Meaning | Usage |
|------|---------|-------|
| `200` | OK | Successful GET/POST/PUT |
| `201` | Created | Resource created successfully |
| `204` | No Content | Successful DELETE |
| `400` | Bad Request | Validation error, invalid input |
| `401` | Unauthorized | Missing/invalid authentication token |
| `403` | Forbidden | Authenticated but not authorized |
| `404` | Not Found | Resource doesn't exist |
| `409` | Conflict | Duplicate resource (e.g., username taken) |
| `410` | Gone | Resource expired (e.g., media past 7 days) |
| `413` | Payload Too Large | File size or quota exceeded |
| `429` | Too Many Requests | Rate limit exceeded |
| `500` | Internal Server Error | Server-side error |

### Common Error Codes

```
VALIDATION_ERROR - Input validation failed
UNAUTHORIZED - Invalid or missing token
FORBIDDEN - Not authorized for resource
NOT_FOUND - Resource doesn't exist
USERNAME_TAKEN - Username already exists
INVALID_CREDENTIALS - Wrong username/password
QUOTA_EXCEEDED - Storage quota exceeded
FILE_TOO_LARGE - File exceeds size limit
TOO_MANY_REQUESTS - Rate limit exceeded
INTERNAL_ERROR - Server error
```

---

## Rate Limiting

### Rate Limit Headers

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1699123456
```

### Limits by Endpoint Type

| Endpoint Type | Limit | Window |
|--------------|-------|--------|
| Authentication (`/api/login`, `/api/signup`) | 10 requests | 15 minutes |
| API Endpoints (`/api/*`) | 100 requests | 15 minutes |
| Media Upload | 10 uploads | 1 hour |
| WebSocket connections | 5 connections | 1 minute |

**429 Response:**
```json
{
  "error": "TOO_MANY_REQUESTS",
  "message": "Rate limit exceeded. Try again in 300 seconds.",
  "retry_after": 300
}
```

---

## Pagination

### Query Parameters

```
?limit=50&offset=0
```

### Response Format

```json
{
  "items": [...],
  "total_count": 150,
  "has_more": true,
  "pagination": {
    "limit": 50,
    "offset": 0,
    "next_offset": 50
  }
}
```

---

## WebSocket API

**See:** [websocket-realtime.md](websocket-realtime.md) for full WebSocket documentation

**Endpoint:** `wss://api.orbital.example.com/ws`

**Authentication:** JWT token in query parameter or upgrade header

**Events:**
- `new_message` - New encrypted message envelope
- `new_thread` - New thread created
- `new_reply` - New reply posted
- `media_uploaded` - Media upload completed
- `member_joined` - New member joined group

---

## Security Headers

### Required Request Headers

```http
Authorization: Bearer <token>
Content-Type: application/json
X-CSRF-Token: <csrf_token> (for state-changing operations)
```

### Response Security Headers

```http
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Security-Policy: default-src 'self'
```

---

## CORS Configuration

**Allowed Origins:**
- `https://orbital.example.com` (production)
- `http://localhost:3000` (development)

**Allowed Methods:** `GET, POST, PUT, DELETE, OPTIONS`

**Allowed Headers:** `Authorization, Content-Type, X-CSRF-Token`

---

## Testing the API

### Using cURL

```bash
# Signup
curl -X POST http://localhost:3000/api/signup \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"SecurePassword123!","public_key":{}}'

# Login
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"SecurePassword123!"}'

# Create Group (authenticated)
curl -X POST http://localhost:3000/api/groups \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"encrypted_name":"base64","encrypted_group_key":"base64"}'

# List Threads
curl -X GET http://localhost:3000/api/groups/<group_id>/threads \
  -H "Authorization: Bearer <token>"
```

---

## Related Documentation

- **[WebSocket & Real-Time](websocket-realtime.md)** - WebSocket API specification
- **[Database Schema](database-schema.md)** - Backend database structure
- **[Encryption & Security](encryption-and-security.md)** - How API handles encryption
- **[Frontend Architecture](frontend-architecture.md)** - How frontend calls these APIs
- **[Testing Strategy](testing-strategy.md)** - API testing approach
