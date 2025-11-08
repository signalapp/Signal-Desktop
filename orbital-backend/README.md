# Orbital Backend Server

**Status:** MVP Infrastructure Complete

Node.js + Express backend server for Orbital MVP. Provides Signal Protocol message relay, threading API, group management, and media relay with 7-day storage.

---

## Architecture Overview

```
Orbital Backend
├── Signal Protocol Relay (v1/messages)
│   ├── Encrypted message envelope storage
│   ├── WebSocket real-time delivery
│   └── Zero-knowledge server (cannot decrypt)
├── Threading API (api/threads)
│   ├── Thread creation and listing
│   ├── Reply management
│   └── Encrypted content (Signal Sender Keys)
├── Group Management (api/groups)
│   ├── Group creation with invite codes
│   ├── Member management
│   └── Storage quotas (10GB/100 files)
└── Media Relay (api/media)
    ├── 7-day temporary storage
    ├── Encrypted upload/download
    └── Quota enforcement
```

---

## Tech Stack

- **Runtime:** Node.js 18+
- **Framework:** Express 4.x
- **Database:** PostgreSQL 15+
- **WebSocket:** ws library
- **Authentication:** JWT (jsonwebtoken)
- **Password Hashing:** bcrypt
- **Logging:** Winston
- **Security:** Helmet, CORS, Rate Limiting

---

## Setup Instructions

### Prerequisites

1. **Node.js 18+** and npm installed
2. **PostgreSQL 15+** installed and running
3. **Git** installed

### 1. Install Dependencies

```bash
cd orbital-backend
npm install
```

### 2. Setup Database

```bash
# Create PostgreSQL database
psql postgres

CREATE DATABASE orbital;
CREATE USER orbital_user WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE orbital TO orbital_user;
\c orbital
GRANT ALL ON SCHEMA public TO orbital_user;
\q

# Run database schema
psql -U orbital_user -d orbital -f ../planning-docs/database-schema.sql
```

### 3. Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Edit .env with your values
nano .env
```

**Required environment variables:**

```env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://orbital_user:your_password@localhost:5432/orbital
JWT_SECRET=generate-a-secure-random-string-here
JWT_EXPIRATION=30d
FRONTEND_URL=http://localhost:5173
MEDIA_STORAGE_PATH=./uploads
LOG_LEVEL=debug
```

### 4. Start Server

```bash
# Development mode (with auto-restart)
npm run dev

# Production mode
npm start
```

Server will start on `http://localhost:3000` (or your configured PORT).

---

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/signup` | Register new user |
| POST | `/api/login` | Authenticate user |
| POST | `/api/verify-token` | Verify JWT token validity |
| GET | `/api/users/:username/public-key` | Get user's public key |

### Signal Protocol Relay

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/v1/messages` | Send encrypted message envelope |
| GET | `/v1/messages` | Fetch encrypted messages |
| DELETE | `/v1/messages/:messageId` | Delete message (sender only) |
| GET | `/v1/conversations/:id/messages/count` | Get message count |

### Threading API

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/threads` | Create new thread |
| GET | `/api/groups/:groupId/threads` | List threads (paginated) |
| GET | `/api/threads/:threadId` | Get thread details |
| GET | `/api/threads/:threadId/replies` | Get replies (paginated) |
| POST | `/api/threads/:threadId/replies` | Post reply |

### Group Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/groups` | Create new group |
| POST | `/api/groups/join` | Join via invite code |
| GET | `/api/groups` | List user's groups |
| GET | `/api/groups/:groupId/members` | List group members |
| GET | `/api/groups/:groupId/quota` | Get storage quota status |
| DELETE | `/api/groups/:groupId/members/:userId` | Remove member (creator only) |

### Media Relay

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/media/upload` | Upload encrypted media |
| GET | `/api/media/:mediaId/download` | Download encrypted media |
| GET | `/api/media/:mediaId/info` | Get media metadata |
| GET | `/api/threads/:threadId/media` | List thread media |

### WebSocket

**Endpoint:** `ws://localhost:3000/v1/websocket`

**Authentication:** JWT token in query parameter `?token=<jwt>`

**Events:**
- `connection_ack` - Connection established
- `new_message` - New message in conversation
- `new_thread` - New thread created
- `new_reply` - New reply posted

---

## Database Schema

See `/planning-docs/database-schema.md` for complete schema definition.

**Core Tables:**
- `signal_messages` - Encrypted Signal Protocol envelopes
- `users` - User accounts with public keys
- `groups` - Discussion groups
- `members` - Group memberships
- `threads` - Discussion threads
- `replies` - Thread replies
- `media` - Media files (7-day expiry)
- `group_quotas` - Storage quotas

---

## Signal Protocol Integration

### Zero-Knowledge Architecture

The backend server **cannot decrypt** message contents. All encryption/decryption happens client-side using Signal Protocol.

**Message Flow:**
1. Client encrypts message with Signal Protocol (Double Ratchet)
2. Client sends encrypted envelope (protobuf binary) to server
3. Server stores envelope as opaque binary data
4. Server routes envelope to recipients via WebSocket
5. Recipients decrypt envelope client-side

**Key Properties:**
- **Forward Secrecy:** Keys rotate per message
- **Sender Authentication:** Messages signed with Ed25519
- **Metadata Protection:** Optional sealed sender
- **Group Keys:** Efficient multicast with Sender Keys

---

## Development

### Project Structure

```
orbital-backend/
├── src/
│   ├── server.js              # Main entry point
│   ├── config/
│   │   └── database.js        # PostgreSQL connection pool
│   ├── routes/
│   │   ├── auth.js            # Authentication endpoints
│   │   ├── signal-relay.js    # Signal Protocol relay
│   │   ├── threads.js         # Threading API
│   │   ├── groups.js          # Group management
│   │   └── media.js           # Media upload/download
│   ├── middleware/
│   │   ├── auth.js            # JWT validation
│   │   ├── cors.js            # CORS configuration
│   │   └── errorHandler.js   # Error handling
│   ├── websocket/
│   │   └── signalWebSocket.js # WebSocket server
│   └── utils/
│       └── logger.js          # Winston logging
├── package.json
├── .env.example
└── README.md
```

### Running Tests

```bash
npm test
```

### Linting

```bash
npm run lint
```

### Database Migrations

```bash
# Create migration
npm run migrate create <migration-name>

# Run migrations
npm run migrate up

# Rollback migration
npm run migrate down
```

---

## Security Considerations

### Authentication
- JWT tokens with 30-day expiration (configurable)
- bcrypt password hashing (cost factor 12)
- Rate limiting on auth endpoints (10 req/15min)

### API Security
- Helmet.js security headers
- CORS configured for trusted origins
- Rate limiting (100 req/15min per IP)
- Input validation on all endpoints
- SQL injection prevention (parameterized queries)

### Encryption
- All message content encrypted client-side (Signal Protocol)
- Server stores only encrypted envelopes
- Media files encrypted before upload
- Database connections use SSL in production

### Storage
- 7-day automatic media deletion
- Storage quotas per group (10GB/100 files)
- Uploaded files stored outside web root

---

## Deployment

### Production Setup

1. **Environment Configuration**
   ```bash
   NODE_ENV=production
   DATABASE_URL=postgresql://user:pass@host:5432/orbital
   JWT_SECRET=<strong-random-secret>
   FRONTEND_URL=https://orbital.example.com
   ```

2. **Database SSL**
   - Enable SSL connections in production
   - Configure in `src/config/database.js`

3. **Reverse Proxy (Nginx)**
   ```nginx
   server {
       listen 443 ssl http2;
       server_name api.orbital.example.com;

       ssl_certificate /path/to/cert.pem;
       ssl_certificate_key /path/to/key.pem;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }

       location /v1/websocket {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "Upgrade";
       }
   }
   ```

4. **Process Manager (PM2)**
   ```bash
   npm install -g pm2
   pm2 start src/server.js --name orbital-backend
   pm2 startup
   pm2 save
   ```

5. **Monitoring**
   - Check logs: `pm2 logs orbital-backend`
   - Monitor status: `pm2 status`
   - Restart: `pm2 restart orbital-backend`

---

## Logging

### Log Levels
- `error` - Critical errors
- `warn` - Warning messages
- `info` - General information
- `http` - HTTP requests
- `debug` - Debug information

### Log Files (Production)
- `logs/error.log` - Error logs only
- `logs/combined.log` - All logs

### Console Output (Development)
- Colorized output
- Human-readable format

---

## Troubleshooting

### Database Connection Issues

```bash
# Test connection
psql -U orbital_user -d orbital -h localhost

# Check PostgreSQL is running
systemctl status postgresql
```

### Port Already in Use

```bash
# Find process using port 3000
lsof -i :3000

# Kill process
kill -9 <PID>
```

### WebSocket Connection Failed

- Verify WebSocket endpoint: `ws://localhost:3000/v1/websocket`
- Check JWT token is valid
- Ensure server is running

### Media Upload Fails

- Check `MEDIA_STORAGE_PATH` directory exists and is writable
- Verify file size under 500MB limit
- Check group quota not exceeded

---

## Next Steps

### Phase 2: Threading Implementation

- [ ] Test Signal Protocol message relay with Signal-Desktop client
- [ ] Implement WebSocket message broadcasting
- [ ] Add thread metadata to Signal messages
- [ ] Test end-to-end message flow
- [ ] Implement media cleanup job (delete expired files)

### Future Enhancements

- [ ] Redis caching for frequently accessed data
- [ ] Background job queue for media cleanup
- [ ] Prometheus metrics endpoint
- [ ] Admin API for moderation
- [ ] Backup automation

---

## API Documentation

For complete API specification, see:
- `/planning-docs/api-specification.md` - Full API reference
- `/planning-docs/websocket-realtime.md` - WebSocket protocol

---

## Support

For issues or questions:
1. Check this README
2. Review API documentation
3. Check logs for error messages
4. Open an issue on GitHub

---

## License

AGPL-3.0 (same as Signal-Desktop)
