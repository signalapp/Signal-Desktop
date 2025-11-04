# Orbital MVP Overview

## Project Overview

**Vision:** A back-to-basics online social network for small groups of friends and family. No ads, no algorithms, no surveillance - just threaded conversations with people you trust, protected by end-to-end encryption.

**Core Principle:** "The internet used to be good. We're building that again."

**Key Innovation:** Signal-like video sharing that actually works for families - full quality videos that sync across all family devices without permanent server storage.

---

## MVP Scope

### Timeline
**Target:** 3-4 weeks to functional beta with video (31 days total: 24 core development + 7 buffer)

### Success Criteria
- Two people can have E2EE threaded discussions
- Family videos can be shared in full quality (up to 500MB)
- Database and server storage contains only encrypted data
- Videos relay through server then live on family devices
- Non-technical users can successfully join and share media

---

## Feature Scope

### ✅ IN SCOPE (MVP)
- User registration (username + password)
- Create/join groups via invite code
- Post new discussion threads
- Reply to existing threads
- Basic text formatting (markdown support)
- **Video/photo upload and sharing (Signal-style relay)**
- **Encrypted media transmission (7-day server retention)**
- **Local media storage on devices (IndexedDB)**
- End-to-end encryption for all content
- Simple web interface
- Chronological thread display
- Basic upload progress indicators
- **Real-time updates via WebSocket**
- **Group key distribution for offline members**

### ❌ OUT OF SCOPE (Post-MVP)
- Video transcoding/compression
- Video thumbnails
- Video streaming (must download fully)
- Peer-to-peer recovery
- GIF reactions
- Push notifications beyond basic browser notifications
- Native mobile apps
- Edit/delete posts
- Rich link previews
- User profiles
- Multiple group switching UI
- Password recovery
- Email verification

---

## Technical Architecture

### Technology Stack

```
Frontend:
├── Vue.js 3.x (via CDN, no build step)
├── IndexedDB (media & key storage)
├── Native WebCrypto API
└── Vanilla CSS (no framework)

Backend:
├── Node.js + Express
├── PostgreSQL (production-ready database from day 1)
├── pg (PostgreSQL client for Node.js)
├── bcrypt (password hashing)
├── jsonwebtoken (JWT auth)
├── multer (file uploads)
├── multer-s3 (optional S3 streaming)
├── node-cron (cleanup jobs)
├── express-rate-limit (rate limiting)
├── helmet (security headers)
├── cors (CORS configuration)
├── ws (WebSocket server)
└── winston (logging)

Encryption:
├── libsodium.js or TweetNaCl.js
├── RSA-OAEP (user keypairs)
├── AES-GCM (group & media encryption)
└── WebCrypto API (browser native)

Storage:
├── Local disk (MVP) → S3-compatible (production)
├── 7-day retention for relay
└── Permanent storage on client devices

Hosting:
├── Development: localhost + ngrok
└── Beta: $12 DigitalOcean droplet (upgrade as needed)
```

### Media Relay Architecture

```
Upload Flow:
1. Client encrypts video locally (AES-GCM with group key)
2. Chunks upload to server (5MB chunks)
3. Server stores encrypted blob temporarily
4. Notifies group members

Download Flow:
1. Members receive notification
2. Auto-download on WiFi (optional)
3. Decrypt and store in IndexedDB
4. Server deletes after 7 days

Result: Each family member has full copy, server has nothing permanent
```

### Storage Quotas
- **Per-group limits:** 10GB total storage, 100 media files maximum
- **Quota tracking:** Database-backed with warning thresholds at 80%
- **Enforcement:** Pre-upload validation, automatic cleanup on expiration

---

## Development Milestones

### Days 1-2: Foundation & Database
- PostgreSQL setup (install, configure, create database)
- Database schema implementation (all tables including media, quotas)
- Express server setup (routing, middleware, CORS, Helmet)
- Environment configuration (.env setup, config validation)
- Logging setup (Winston configuration, request logging)
- User registration/login endpoints (password validation)
- JWT authentication (30-day tokens, middleware)

**Deliverable:** Server running with auth endpoints, database initialized

### Days 3-5: Encryption Layer
- Client-side key generation (RSA-OAEP keypair)
- IndexedDB key storage (private keys, group keys)
- Group key management (AES-GCM generation, distribution)
- Content encryption/decryption (text with AES-GCM)
- Media encryption functions (single IV per file)
- Group key distribution for offline members
- Test encryption roundtrip

**Deliverable:** Working E2EE for all content types, keys stored securely

### Days 6-8: Core Forum Features
- Create/join groups (invite codes, encrypted names)
- Group key exchange (offline member scenarios)
- Post threads endpoint (encrypted title/body)
- Reply to threads endpoint (encrypted replies)
- Fetch threads/replies endpoints (pagination)
- Rate limiting (all endpoints)

**Deliverable:** Functional threaded discussions with E2EE

### Days 9-11: Media Upload System
- Storage quota system (10GB/100 file limits)
- Multer configuration (multipart uploads)
- Chunked upload endpoint (5MB chunks, 500MB max)
- Media storage management (local disk or S3)
- Encryption before storage (single IV per file)
- Media metadata handling (encrypted metadata)
- Quota enforcement (pre-upload check, post-upload update)

**Deliverable:** Media upload working with encryption and quota tracking

### Days 12-14: Media Download & Display
- Download endpoint with auth
- IndexedDB media storage (local caching)
- Media decryption (download, decrypt, cache)
- Progress indicators (upload/download UI)
- Media display components (video player, image display)

**Deliverable:** End-to-end media sharing with relay architecture working

### Days 15-16: WebSocket & Real-Time Updates
- WebSocket server setup (ws library with Express)
- WebSocket authentication (JWT-based)
- Client WebSocket manager (connection management, reconnection)
- Heartbeat/ping mechanism (30s intervals)
- Real-time notifications (threads, replies, media)
- Browser notifications (request permission, display)

**Deliverable:** Real-time updates working for all content types

### Days 17-18: Frontend Application
- Vue 3 application setup (via CDN)
- Login/signup forms (password strength validation UI)
- Thread display with media
- Reply interface (new threads and replies)
- Media upload UI (file selection, progress bars, quota warnings)
- Video/image display components (IndexedDB playback)
- Markdown rendering (DOMPurify sanitization)

**Deliverable:** Fully functional web interface

### Days 19-21: Security, Testing & Polish
- Security audit (CSRF, XSS, SQL injection review)
- Jest test setup (configure Jest, test structure)
- Authentication tests (signup, login, validation)
- Encryption tests (encryption/decryption, tamper detection)
- Media upload tests (file size limits, quota enforcement)
- Cross-browser testing (Chrome, Firefox, Safari)
- Error handling (consistent errors, user-friendly messages)
- Performance optimization (database queries, caching)
- Storage cleanup job (cron job for expired media)

**Deliverable:** Tested, secure application ready for deployment

### Days 22-24: Deployment & Monitoring
- DigitalOcean setup (create droplet, configure firewall)
- PostgreSQL production setup (database config, backups)
- Deploy application (clone repo, install deps, configure env)
- PM2 process management (cluster mode, auto-restart)
- Nginx configuration (reverse proxy, WebSocket, SSL)
- SSL with Let's Encrypt (HTTPS, auto-renewal)
- Automated backups (daily PostgreSQL backups, 7-day retention)
- Monitoring setup (PM2 monitoring, log aggregation)
- Initial family beta test (onboard 3-5 users)
- Setup domain (optional DNS configuration)

**Deliverable:** Production deployment with monitoring and backups

### Buffer Week (Days 25-31): Iteration & Bug Fixes
- Address beta feedback
- Performance tuning based on real usage
- Documentation (user guide, deployment notes)
- Additional testing (stress test with more users)

**Total Timeline:** 24 days core development + 7 days buffer = **31 days (~4.5 weeks)**

### Parallel Workstreams
- **Backend development** (Days 1-14)
- **Frontend development** (Days 15-18, but can start earlier)
- **Testing** (Continuous throughout, Days 19-21 for comprehensive suite)

---

## Success Criteria

### Technical Success
- Database inspection shows only encrypted content
- Media files on server are encrypted and unreadable
- No plaintext visible in network requests
- Sub-second response times for text
- <30 second upload for 50MB video on decent connection
- Videos play smoothly after download
- 7-day expiration working correctly
- No critical security vulnerabilities
- Real-time updates delivered within 1 second
- Storage quotas enforced correctly

### Product Success
- Users post daily without prompting
- Families successfully share videos that SMS would compress
- "Aha!" moment when users realize you can't read their data OR watch their videos
- Grandparents can successfully view grandkid videos
- Feature requests focus on enhancements not fixes
- At least one user says "this is so much better than WhatsApp for videos"
- At least 3 users say they'd pay for it

### MVP Exit Criteria
**Ship v1.0 when:**
- 10 people using daily for 1 week
- Successfully shared 50+ videos without data loss
- Zero data loss incidents
- Core features work reliably
- Video sharing works on all major browsers
- At least 3 families say they'd pay $99/year
- Storage costs are sustainable (<$0.20 per family per month)

---

## Post-MVP Roadmap

### Phase 1: Enhanced Media & UX
- Video transcoding for bandwidth optimization
- Thumbnail generation for videos
- Photo galleries and albums
- Drag-and-drop media uploads
- Edit/delete posts
- Email notifications for new content
- Password recovery
- Mobile web optimization

### Phase 2: Advanced Features
- Native mobile apps (iOS/Android)
- Rich link previews
- GIF picker integration
- Markdown editor toolbar with preview
- Search within group (encrypted search)
- Reactions and emoji responses
- Voice messages
- Read receipts

### Phase 3: Scale & Polish
- Redis caching for performance
- CDN integration for global media delivery
- S3-compatible storage migration
- Backup/export tools (full family archive download)
- Payment integration (Stripe)
- Family shared calendar
- Shared document storage
- P2P media recovery between family devices
- Advanced encryption (forward secrecy, Double Ratchet)
- Key verification (safety numbers)

---

## Notes

**Remember the core philosophy:** This is nostalgia-driven software with a modern twist. Every feature should be evaluated against "does this make it feel more like the old internet, but better?" When in doubt, choose simplicity.

**The killer feature:** High-quality family video sharing that actually works. SMS ruins videos. WhatsApp compresses them. We relay them perfectly, encrypted, to every family member's device.

**The MVP's job** is to prove that:
1. E2EE forums with media are technically feasible
2. Families desperately want better video sharing
3. Threading > chat for family conversations
4. The relay model (temporary server, permanent client) works
5. Someone will pay $99/year for this

**Critical insight:** You're not competing with WhatsApp on features. You're solving the specific problem of "I want to share this video of the baby with grandma and have it look good and be findable later."

Everything else can wait.

---

## Quick Reference Links

For detailed implementation guidance, see:
- **[Database Schema](database-schema.md)** - PostgreSQL tables, indexes, constraints
- **[API Specification](api-specification.md)** - REST endpoints, authentication, error handling
- **[Encryption & Security](encryption-and-security.md)** - WebCrypto implementation, key management
- **[WebSocket & Real-Time](websocket-realtime.md)** - WebSocket server, client manager, notifications
- **[Frontend Architecture](frontend-architecture.md)** - Vue 3 components, IndexedDB, UI structure
- **[Deployment & Operations](deployment-operations.md)** - DigitalOcean, Nginx, PM2, monitoring
- **[Testing Strategy](testing-strategy.md)** - Jest tests, coverage goals, test plans
