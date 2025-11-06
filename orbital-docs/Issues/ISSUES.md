# Orbital GitHub Issues - Signal Fork Implementation

This file contains all GitHub issues for the Signal fork implementation, organized by milestone/phase.

**How to use:**
1. Create the 4 milestones in GitHub (Phase 1-4)
2. Copy each issue below into GitHub Issues
3. Assign to appropriate milestone
4. Add labels as indicated

---

## Milestone 1: Signal Foundation (Days 1-7)

**Milestone Description:** Fork Signal-Desktop, extract core modules, build threading layer

**Timeline:** Week 1
**Dependencies:** None (start immediately)

---

### Issue #1: Fork and Setup Signal-Desktop Repository

**Labels:** `setup`, `phase-1`, `dependencies`

**Description:**

Fork the Signal-Desktop repository and configure our development environment.

**Tasks:**
- [ ] Fork Signal-Desktop repository to `orbital` organization
- [ ] Clone forked repository locally
- [ ] Install all dependencies (`yarn install`)
- [ ] Verify build works (`yarn build`)
- [ ] Run Signal-Desktop to understand current functionality
- [ ] Document Signal-Desktop architecture in wiki/notes

**Acceptance Criteria:**
- Signal-Desktop fork compiles and runs successfully
- Development environment is fully configured
- Team understands basic Signal-Desktop architecture

**Estimated Time:** 1 day

**References:**
- Signal-Desktop: https://github.com/signalapp/Signal-Desktop
- Docs: project-docs/signal-fork-strategy.md (Days 1-2)

---

### Issue #2: Remove Unnecessary Signal Features

**Labels:** `cleanup`, `phase-1`, `refactoring`

**Description:**

Strip out Signal features we don't need to simplify the codebase.

**Features to Remove:**
- [ ] Voice/video calling infrastructure
- [ ] Stories functionality
- [ ] Payment integration
- [ ] Phone number verification (replace with username-based)
- [ ] Contacts sync
- [ ] Link device functionality
- [ ] App badges/notification counts (will re-implement for threads)

**Tasks:**
- [ ] Identify files/modules for each feature
- [ ] Remove UI components
- [ ] Remove backend logic
- [ ] Remove database migrations for removed features
- [ ] Update build configuration
- [ ] Test that app still compiles
- [ ] Document what was removed (for reference)

**Acceptance Criteria:**
- App compiles and runs without removed features
- Codebase is 30-40% smaller
- Core Signal Protocol functionality intact
- Document created listing removed features

**Estimated Time:** 1-2 days

**References:**
- project-docs/signal-fork-strategy.md (Days 1-2)

---

### Issue #3: Extract Core Signal Protocol Modules

**Labels:** `refactoring`, `phase-1`, `architecture`

**Description:**

Identify and isolate the core Signal Protocol modules we need to keep.

**Core Modules to Keep:**
- [ ] libsignal (WASM bindings)
- [ ] Signal Protocol implementation
- [ ] SQLCipher (encrypted database)
- [ ] Message encryption/decryption
- [ ] Media encryption (attachment keys)
- [ ] Group key management (Sender Keys)
- [ ] WebSocket protocol handlers

**Tasks:**
- [ ] Map dependency tree for core modules
- [ ] Create architecture diagram showing module relationships
- [ ] Document key classes and their purposes
- [ ] Identify entry points for threading layer integration
- [ ] Test core modules still work after feature removal

**Acceptance Criteria:**
- Clear documentation of core modules
- Architecture diagram created
- Core E2EE functionality verified working
- Integration points identified for threading

**Estimated Time:** 1 day

**References:**
- project-docs/signal-fork-strategy.md (Day 3)

---

### Issue #4: Setup Node.js Backend with Signal Relay

**Labels:** `backend`, `phase-1`, `infrastructure`

**Description:**

Create the Node.js backend server that will relay Signal Protocol messages and serve our threading API.

**Tasks:**
- [ ] Initialize Node.js + Express project
- [ ] Install dependencies (Express, PostgreSQL, ws, etc.)
- [ ] Setup Signal Protocol relay endpoints (protobuf)
- [ ] Implement WebSocket server compatible with Signal protocol
- [ ] Setup basic authentication middleware
- [ ] Configure CORS for Signal-Desktop client
- [ ] Setup logging (Winston)
- [ ] Create development environment config

**API Endpoints (Signal Relay):**
- [ ] `POST /v1/messages` - Send encrypted message envelope
- [ ] `GET /v1/messages` - Fetch encrypted messages
- [ ] WebSocket `/v1/websocket` - Real-time message delivery

**Acceptance Criteria:**
- Backend server runs and accepts Signal protocol messages
- WebSocket connection works from Signal-Desktop client
- Messages can be sent and received (encrypted envelopes)
- Logging configured and working

**Estimated Time:** 1-2 days

**References:**
- project-docs/signal-fork-strategy.md (Day 3)
- project-docs/database-schema.md (needs update)

**Dependencies:**
- Issue #3 (need to understand Signal protocol)

---

### Issue #5: PostgreSQL Schema for Hybrid Architecture

**Labels:** `database`, `phase-1`, `setup`

**Description:**

Create PostgreSQL database schema that supports both Signal messages and Orbital threading.

**Tables to Create:**

**Signal Messages (for compatibility):**
```sql
CREATE TABLE signal_messages (
    id UUID PRIMARY KEY,
    conversation_id UUID NOT NULL,
    sender_uuid UUID,
    encrypted_envelope BYTEA NOT NULL,
    server_timestamp TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ
);
```

**Orbital Threading:**
```sql
CREATE TABLE threads (
    id UUID PRIMARY KEY,
    group_id UUID NOT NULL,
    root_message_id UUID REFERENCES signal_messages(id),
    encrypted_title TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE replies (
    id UUID PRIMARY KEY,
    thread_id UUID REFERENCES threads(id),
    message_id UUID REFERENCES signal_messages(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Tasks:**
- [ ] Create database migration files
- [ ] Add Signal messages table
- [ ] Add threads table
- [ ] Add replies table
- [ ] Add media table (7-day retention)
- [ ] Add group_quotas table
- [ ] Create indexes for performance
- [ ] Setup database connection pool in Node.js
- [ ] Test migrations up/down

**Acceptance Criteria:**
- All tables created successfully
- Migrations work both up and down
- Indexes created for performance
- Database connection working from backend

**Estimated Time:** 1 day

**References:**
- project-docs/signal-fork-strategy.md (Database Schema section)
- project-docs/database-schema.md (base schema)

---

### Issue #6: Thread Data Model and API

**Labels:** `backend`, `phase-1`, `api`, `threading`

**Description:**

Implement the threading layer that maps Signal messages to Orbital threads.

**Tasks:**

**Data Model:**
- [ ] Thread creation logic (map to Signal conversation)
- [ ] Reply association logic (link to thread + Signal message)
- [ ] Thread-to-message ID mapping
- [ ] Pagination logic for thread lists

**API Endpoints:**
- [ ] `POST /api/threads` - Create new thread
- [ ] `GET /api/groups/:groupId/threads` - List threads (paginated)
- [ ] `GET /api/threads/:threadId/replies` - Get thread replies
- [ ] `POST /api/threads/:threadId/replies` - Post reply
- [ ] `GET /api/threads/:threadId` - Get single thread

**Tasks:**
- [ ] Implement thread creation endpoint
- [ ] Implement thread listing with pagination
- [ ] Implement reply posting
- [ ] Implement reply fetching
- [ ] Add validation for all endpoints
- [ ] Add authentication checks
- [ ] Write API tests (Jest + Supertest)

**Acceptance Criteria:**
- All thread API endpoints working
- Threads properly map to Signal messages
- Pagination works correctly
- All endpoints have tests (>70% coverage)
- API documented

**Estimated Time:** 2 days

**References:**
- project-docs/signal-fork-strategy.md (Days 4-5)

**Dependencies:**
- Issue #4 (backend setup)
- Issue #5 (database schema)

---

### Issue #7: Modify Signal UI for Threaded Discussions

**Labels:** `frontend`, `phase-1`, `ui`, `threading`

**Description:**

Adapt Signal-Desktop's conversation UI to display threaded forum-style discussions.

**UI Changes:**

**Conversation List → Group List:**
- [ ] Modify conversation list to show groups only
- [ ] Remove 1:1 conversation UI
- [ ] Add group invitation display

**Message View → Thread View:**
- [ ] Replace message bubbles with thread cards
- [ ] Show thread title prominently
- [ ] Display reply count
- [ ] Add expand/collapse for threads
- [ ] Show thread metadata (author, date, reply count)

**Message Composer → Thread/Reply Composer:**
- [ ] Add thread title input
- [ ] Keep message body composer
- [ ] Add markdown formatting toolbar
- [ ] Context switcher (new thread vs reply)

**Tasks:**
- [ ] Identify React components to modify
- [ ] Create ThreadCard component
- [ ] Create ThreadList component
- [ ] Create ReplyComposer component
- [ ] Update state management for threading
- [ ] Wire up to threading API endpoints
- [ ] Add loading states
- [ ] Add error handling

**Acceptance Criteria:**
- Thread view displays correctly
- Can create new threads with title + body
- Can post replies to threads
- Thread list shows all threads in group
- UI feels like a forum, not a chat
- Signal's media display components still work

**Estimated Time:** 2-3 days

**References:**
- project-docs/signal-fork-strategy.md (Days 6-7)

**Dependencies:**
- Issue #6 (threading API must exist)

---

## Milestone 2: Media Integration (Days 8-14)

**Milestone Description:** Implement 7-day media relay with Signal encryption and storage quotas

**Timeline:** Week 2 (Days 8-14)
**Dependencies:** Milestone 1 complete

---

### Issue #8: Media Relay with Signal Encryption

**Labels:** `backend`, `phase-2`, `media`, `encryption`

**Description:**

Implement media upload/download with Signal's attachment encryption and 7-day relay storage.

**Tasks:**

**Signal Media Encryption:**
- [ ] Use Signal's attachment key generation
- [ ] Implement chunked upload (5MB chunks)
- [ ] Store encrypted blobs (local disk or S3)
- [ ] Generate download URLs with auth
- [ ] Implement 7-day expiration

**API Endpoints:**
- [ ] `POST /api/media/upload` - Upload encrypted chunk
- [ ] `POST /api/media/upload/complete` - Finalize upload
- [ ] `GET /api/media/:mediaId/download` - Download encrypted file
- [ ] `GET /api/media/:mediaId/info` - Get metadata
- [ ] `GET /api/threads/:threadId/media` - List thread media

**Storage Management:**
- [ ] Configure local disk storage (MVP)
- [ ] Add S3 configuration (optional, for production)
- [ ] Implement cleanup cron job (delete after 7 days)
- [ ] Add media metadata to database

**Tasks:**
- [ ] Implement chunked upload endpoint
- [ ] Implement download endpoint
- [ ] Setup media storage (disk or S3)
- [ ] Create cleanup job
- [ ] Add media database table
- [ ] Test with 500MB video file
- [ ] Test 7-day expiration
- [ ] Write media upload/download tests

**Acceptance Criteria:**
- Can upload media up to 500MB
- Chunked upload works reliably
- Media encrypted with Signal's attachment keys
- Download works with authentication
- 7-day expiration deletes files automatically
- Tests cover upload/download flows

**Estimated Time:** 2-3 days

**References:**
- project-docs/signal-fork-strategy.md (Days 8-9)
- Signal's attachment encryption docs

**Dependencies:**
- Issue #6 (threading API for associating media with threads)

---

### Issue #9: Storage Quota System

**Labels:** `backend`, `phase-2`, `quotas`, `database`

**Description:**

Implement per-group storage quotas (10GB storage, 100 files max).

**Quota Configuration:**
- Max storage: 10GB per group
- Max files: 100 media files per group
- Warning threshold: 80% of limit

**Tasks:**

**Database:**
- [ ] Ensure group_quotas table exists (from Issue #5)
- [ ] Add triggers/procedures for quota updates
- [ ] Add quota check function

**API Logic:**
- [ ] Pre-upload quota check
- [ ] Update quota after successful upload
- [ ] Decrement quota after expiration/deletion
- [ ] Quota warning endpoint (`GET /api/groups/:groupId/quota`)

**Enforcement:**
- [ ] Reject uploads if quota exceeded
- [ ] Return quota info in API responses
- [ ] Add quota warnings at 80%

**Tasks:**
- [ ] Implement quota checking function
- [ ] Add quota update logic to upload endpoint
- [ ] Add quota decrement to cleanup job
- [ ] Create quota info endpoint
- [ ] Test quota enforcement
- [ ] Test quota updates
- [ ] Write quota tests

**Acceptance Criteria:**
- Quota enforced on all uploads
- Quota accurately tracked in database
- Quota warnings work at 80%
- Upload blocked when quota exceeded
- Quota decrements when media expires
- Tests verify quota logic

**Estimated Time:** 1-2 days

**References:**
- project-docs/signal-fork-strategy.md (Days 10-11)
- project-docs/orbital-mvp-overview.md (quota specs)

**Dependencies:**
- Issue #8 (media upload must exist)

---

### Issue #10: Media Upload UI in Signal-Desktop

**Labels:** `frontend`, `phase-2`, `ui`, `media`

**Description:**

Adapt Signal's attachment UI for Orbital's media upload with quotas and progress.

**UI Components:**

**Media Picker:**
- [ ] File selection dialog (video/images)
- [ ] Multiple file selection
- [ ] Preview selected files
- [ ] Show file sizes
- [ ] Quota warning display

**Upload Progress:**
- [ ] Progress bar for each file
- [ ] Overall upload progress
- [ ] Cancel upload button
- [ ] Error display
- [ ] Success confirmation

**Media Display:**
- [ ] Keep Signal's video player component
- [ ] Keep Signal's image gallery component
- [ ] Add "Download" button for undownloaded media
- [ ] Show expiration date
- [ ] Show file size

**Tasks:**
- [ ] Adapt Signal's AttachmentPicker component
- [ ] Create UploadProgress component
- [ ] Wire up to media upload API
- [ ] Add chunked upload logic
- [ ] Handle upload errors gracefully
- [ ] Display quota warnings
- [ ] Test with large files (500MB)
- [ ] Test multiple file uploads

**Acceptance Criteria:**
- Can select and upload media files
- Progress indicators work accurately
- Quota warnings display at 80%
- Upload blocks when quota exceeded
- Video playback works after download
- Images display correctly
- Handles errors gracefully

**Estimated Time:** 2 days

**References:**
- project-docs/signal-fork-strategy.md (Days 10-11)

**Dependencies:**
- Issue #8 (media API must exist)
- Issue #9 (quota system must exist)

---

### Issue #11: Local Media Storage in SQLCipher

**Labels:** `frontend`, `phase-2`, `storage`, `encryption`

**Description:**

Implement permanent client-side storage for downloaded media using Signal's SQLCipher.

**Tasks:**

**SQLCipher Schema:**
- [ ] Add media table to client database
- [ ] Store decrypted media blobs
- [ ] Store media metadata
- [ ] Index by thread_id for fast retrieval

**Download & Storage Logic:**
- [ ] Download encrypted media from server
- [ ] Decrypt using Signal's attachment keys
- [ ] Store decrypted in SQLCipher
- [ ] Create blob URL for playback
- [ ] Auto-download on WiFi (optional setting)

**Retrieval:**
- [ ] Check local storage before downloading
- [ ] Display from local storage if available
- [ ] Show download button if not cached
- [ ] Handle storage errors

**Tasks:**
- [ ] Extend SQLCipher schema for media
- [ ] Implement download + decrypt + store logic
- [ ] Implement retrieval from local storage
- [ ] Add auto-download setting
- [ ] Test with large files
- [ ] Test offline playback
- [ ] Handle storage quota exceeded (device)

**Acceptance Criteria:**
- Downloaded media stored in SQLCipher
- Media plays from local storage
- Auto-download works on WiFi
- Offline playback works
- Storage errors handled gracefully
- Can retrieve media without re-downloading

**Estimated Time:** 1-2 days

**References:**
- project-docs/signal-fork-strategy.md (Days 12-14)
- Signal's media storage implementation

**Dependencies:**
- Issue #8 (media API for download)

---

## Milestone 3: Groups & Polish (Days 12-14)

**Milestone Description:** Group management, invite codes, security audit, deployment

**Timeline:** Week 2 (Days 12-14)
**Dependencies:** Milestone 1-2 complete

---

### Issue #12: Group Creation with Invite Codes

**Labels:** `backend`, `phase-3`, `groups`, `api`

**Description:**

Implement group creation with invite code system (custom addition to Signal).

**Tasks:**

**Backend:**
- [ ] Group creation endpoint (`POST /api/groups`)
- [ ] Generate 8-character invite code (alphanumeric)
- [ ] Store group with encrypted name
- [ ] Join group endpoint (`POST /api/groups/join`)
- [ ] Validate invite code
- [ ] Add member to group
- [ ] Use Signal's Sender Keys for group key distribution

**Database:**
- [ ] Groups table (encrypted_name, invite_code)
- [ ] Members table (group_id, user_id, encrypted_group_key)

**Group Key Distribution:**
- [ ] Use Signal's Sender Keys protocol
- [ ] Handle offline members (X3DH)
- [ ] Key rotation logic (if needed)

**Tasks:**
- [ ] Implement group creation endpoint
- [ ] Implement invite code generation
- [ ] Implement join group endpoint
- [ ] Implement key distribution with Sender Keys
- [ ] Add group member listing endpoint
- [ ] Write group API tests
- [ ] Test with multiple members
- [ ] Test offline member scenarios

**Acceptance Criteria:**
- Can create group with encrypted name
- Invite code generated (8 chars)
- Can join group with invite code
- Group keys distributed via Sender Keys
- Works for offline members (X3DH)
- All endpoints tested

**Estimated Time:** 1-2 days

**References:**
- project-docs/signal-fork-strategy.md (Day 12)
- Signal Protocol - Sender Keys documentation

**Dependencies:**
- Must understand Signal's Sender Keys (Issue #3)

---

### Issue #13: Group Management UI

**Labels:** `frontend`, `phase-3`, `ui`, `groups`

**Description:**

Create UI for group creation, joining, and management.

**UI Components:**

**Group Selector:**
- [ ] List all user's groups
- [ ] Show member count
- [ ] Create group button
- [ ] Join group button

**Create Group Modal:**
- [ ] Group name input
- [ ] Create button
- [ ] Display generated invite code
- [ ] Copy invite code button

**Join Group Modal:**
- [ ] Invite code input
- [ ] Join button
- [ ] Error handling (invalid code)

**Group Settings (future):**
- [ ] Placeholder for group settings
- [ ] Member list (view only for MVP)

**Tasks:**
- [ ] Create GroupSelector component
- [ ] Create CreateGroupModal component
- [ ] Create JoinGroupModal component
- [ ] Wire up to group API endpoints
- [ ] Add clipboard copy for invite codes
- [ ] Add validation and error handling
- [ ] Test group creation flow
- [ ] Test group joining flow

**Acceptance Criteria:**
- Can create group and see invite code
- Can copy invite code to clipboard
- Can join group with invite code
- Group list updates after create/join
- Error messages clear and helpful

**Estimated Time:** 1 day

**References:**
- project-docs/signal-fork-strategy.md (Day 12)

**Dependencies:**
- Issue #12 (group API must exist)

---

### Issue #14: Security Audit

**Labels:** `security`, `phase-3`, `audit`, `testing`

**Description:**

Comprehensive security audit of the Signal fork and custom additions.

**Signal Protocol Verification:**
- [ ] Verify Signal Protocol implementation intact
- [ ] Test key rotation (Double Ratchet)
- [ ] Verify forward secrecy working
- [ ] Test X3DH key agreement
- [ ] Verify Sender Keys for groups

**Encryption Verification:**
- [ ] Database inspection (all content encrypted)
- [ ] Network traffic inspection (no plaintext)
- [ ] Media files encrypted on server
- [ ] SQLCipher encrypted on client
- [ ] Verify metadata protection (Sealed Sender if enabled)

**Custom Code Security:**
- [ ] Review threading API for SQL injection
- [ ] Review media upload for path traversal
- [ ] Test authentication on all endpoints
- [ ] Test authorization (group membership checks)
- [ ] Review rate limiting
- [ ] Test CSRF protection
- [ ] Review XSS prevention

**Penetration Testing:**
- [ ] Attempt SQL injection attacks
- [ ] Attempt XSS attacks
- [ ] Attempt CSRF attacks
- [ ] Test rate limiting bypass
- [ ] Test authentication bypass
- [ ] Test media access without auth

**Tasks:**
- [ ] Run automated security scanners
- [ ] Manual code review of custom endpoints
- [ ] Database inspection for plaintext
- [ ] Network traffic capture and analysis
- [ ] Test all attack vectors
- [ ] Document findings
- [ ] Fix all critical/high issues
- [ ] Re-test after fixes

**Acceptance Criteria:**
- Signal Protocol verified working correctly
- No plaintext in database or network traffic
- No critical or high security issues
- All custom code reviewed and tested
- Security audit report documented

**Estimated Time:** 1-2 days

**References:**
- project-docs/signal-fork-strategy.md (Day 13)
- project-docs/testing-strategy.md (security testing)

**Dependencies:**
- All implementation complete (Issues #1-13)

---

### Issue #15: Production Deployment to DigitalOcean

**Labels:** `deployment`, `phase-3`, `infrastructure`, `devops`

**Description:**

Deploy Orbital MVP to DigitalOcean for beta testing.

**Infrastructure:**
- DigitalOcean Droplet: $12/month (2GB RAM)
- PostgreSQL: On droplet
- Nginx: Reverse proxy + SSL
- PM2: Process manager

**Tasks:**

**Server Setup:**
- [ ] Create DigitalOcean droplet (Ubuntu 22.04)
- [ ] Configure firewall (UFW: 22, 80, 443)
- [ ] Install Node.js 18
- [ ] Install PostgreSQL 15
- [ ] Install Nginx
- [ ] Install PM2
- [ ] Setup non-root user

**Application Deployment:**
- [ ] Clone repository
- [ ] Install dependencies
- [ ] Build Signal-Desktop (production mode)
- [ ] Build backend
- [ ] Configure environment variables (.env)
- [ ] Run database migrations
- [ ] Setup PM2 (cluster mode)
- [ ] Configure PM2 auto-restart

**Nginx Configuration:**
- [ ] Reverse proxy to Node.js
- [ ] WebSocket support
- [ ] SSL with Let's Encrypt
- [ ] Static file serving (Signal-Desktop build)
- [ ] Rate limiting
- [ ] HTTPS redirect

**Database:**
- [ ] Create production database
- [ ] Configure connection pooling
- [ ] Setup automated backups (daily, 7-day retention)
- [ ] Test backup restoration

**Monitoring:**
- [ ] PM2 monitoring dashboard
- [ ] Log aggregation (Winston)
- [ ] Disk space monitoring
- [ ] Database connection monitoring

**Tasks:**
- [ ] Complete all server setup steps
- [ ] Deploy and test application
- [ ] Configure Nginx with SSL
- [ ] Setup automated backups
- [ ] Configure monitoring
- [ ] Test production deployment
- [ ] Document deployment process
- [ ] Create deployment checklist

**Acceptance Criteria:**
- Application running on DigitalOcean
- SSL/HTTPS working (Let's Encrypt)
- WebSocket working over WSS
- Automated backups running daily
- PM2 auto-restart working
- Monitoring in place
- Deployment documented

**Estimated Time:** 1-2 days

**References:**
- project-docs/deployment-operations.md
- project-docs/signal-fork-strategy.md (Day 14)

**Dependencies:**
- Issue #14 (security audit passed)

---

## Milestone 4: Beta Testing & Iteration (Days 15-21)

**Milestone Description:** Beta testing with real families, bug fixes, performance tuning

**Timeline:** Week 3 (Days 15-21)
**Dependencies:** Milestone 3 complete (deployed to production)

---

### Issue #16: Beta Testing with Families

**Labels:** `testing`, `phase-4`, `beta`, `user-feedback`

**Description:**

Conduct beta testing with 3-5 families to validate product and identify bugs.

**Beta Testing Plan:**

**Recruit Families:**
- [ ] Recruit 3-5 families (10-15 people total)
- [ ] Mix of technical and non-technical users
- [ ] Provide onboarding instructions
- [ ] Setup feedback channels (email, form, or Slack)

**Test Scenarios:**
- [ ] User registration and login
- [ ] Create first group
- [ ] Invite family members via code
- [ ] Post threaded discussions
- [ ] Reply to threads
- [ ] Upload photos (various sizes)
- [ ] Upload videos (up to 500MB)
- [ ] Download and play media
- [ ] Real-time notifications
- [ ] Multi-device usage
- [ ] Offline scenarios

**Metrics to Track:**
- [ ] Daily active users
- [ ] Threads created per day
- [ ] Media uploaded (count and size)
- [ ] Media downloaded
- [ ] Average session duration
- [ ] Error rates
- [ ] Crash reports

**Feedback Collection:**
- [ ] Usability feedback (what's confusing?)
- [ ] Feature requests (what's missing?)
- [ ] Bug reports (what's broken?)
- [ ] Performance issues (what's slow?)
- [ ] Value proposition (would they pay $99/year?)

**Tasks:**
- [ ] Recruit beta families
- [ ] Send onboarding instructions
- [ ] Monitor usage metrics
- [ ] Collect daily feedback
- [ ] Triage bugs (critical, high, medium, low)
- [ ] Track feature requests
- [ ] Daily standup with findings
- [ ] End-of-week survey

**Acceptance Criteria:**
- 10+ people actively testing for 7 days
- 50+ threads created
- 20+ videos shared
- No data loss incidents
- Feedback collected from all testers
- Bugs triaged and prioritized

**Estimated Time:** 7 days (full week)

**References:**
- project-docs/orbital-mvp-overview.md (success criteria)
- project-docs/testing-strategy.md (manual testing)

**Dependencies:**
- Issue #15 (production deployment)

---

### Issue #17: Bug Fixes from Beta Testing

**Labels:** `bug`, `phase-4`, `beta-feedback`

**Description:**

Fix critical and high-priority bugs discovered during beta testing.

**Bug Triage:**
- **Critical:** Data loss, crashes, security issues → Fix immediately
- **High:** Core features broken, bad UX → Fix within 1-2 days
- **Medium:** Minor bugs, edge cases → Fix if time allows
- **Low:** Polish, nice-to-haves → Defer to post-MVP

**Common Expected Issues:**
- [ ] WebSocket reconnection issues
- [ ] Media upload failures on slow connections
- [ ] Video playback issues on certain browsers
- [ ] UI rendering bugs on different screen sizes
- [ ] Notification issues
- [ ] Group joining edge cases
- [ ] Offline mode bugs

**Process:**
- [ ] Create sub-issues for each critical/high bug
- [ ] Assign priority and owner
- [ ] Fix and deploy ASAP
- [ ] Verify fix in production
- [ ] Communicate to beta testers
- [ ] Re-test affected flows

**Tasks:**
- [ ] Create GitHub issue for each bug
- [ ] Prioritize bugs (critical → high → medium → low)
- [ ] Fix critical bugs immediately
- [ ] Fix high bugs within 1-2 days
- [ ] Deploy fixes to production
- [ ] Verify fixes with beta testers
- [ ] Update bug tracker

**Acceptance Criteria:**
- All critical bugs fixed
- All high bugs fixed (or triaged to post-MVP)
- Fixes deployed and verified
- Beta testers confirm fixes

**Estimated Time:** 3-5 days (ongoing during beta)

**References:**
- Linked to Issue #16 (beta testing)

**Dependencies:**
- Issue #16 (bugs come from beta testing)

---

### Issue #18: Performance Optimization

**Labels:** `performance`, `phase-4`, `optimization`

**Description:**

Optimize performance based on beta testing usage patterns.

**Areas to Optimize:**

**Frontend:**
- [ ] Thread list rendering (virtual scrolling if needed)
- [ ] Image lazy loading
- [ ] Bundle size optimization
- [ ] SQLCipher query optimization
- [ ] Reduce re-renders (React.memo, useMemo)

**Backend:**
- [ ] Database query optimization
- [ ] Add indexes where needed
- [ ] Connection pool tuning
- [ ] WebSocket connection management
- [ ] Media upload chunking performance

**Network:**
- [ ] Reduce API payload sizes
- [ ] Enable gzip compression
- [ ] Optimize media chunk sizes
- [ ] Cache static assets (Nginx)

**Performance Targets:**
- Thread list load: <500ms
- Thread detail load: <500ms
- Post thread/reply: <1s
- Video upload (50MB): <30s on decent connection
- Video playback start: <3s

**Tasks:**
- [ ] Profile frontend performance (React DevTools)
- [ ] Profile backend performance (query analysis)
- [ ] Identify bottlenecks
- [ ] Optimize slow queries
- [ ] Optimize React components
- [ ] Test before/after performance
- [ ] Document optimizations

**Acceptance Criteria:**
- All performance targets met
- No performance regressions
- Optimizations documented

**Estimated Time:** 2-3 days

**References:**
- project-docs/orbital-mvp-overview.md (performance criteria)

**Dependencies:**
- Issue #16 (real usage data reveals bottlenecks)

---

### Issue #19: Documentation Updates

**Labels:** `documentation`, `phase-4`

**Description:**

Update all documentation to reflect final implementation.

**Documentation to Update:**

**Architecture Docs:**
- [ ] Update database-schema.md with Signal messages table
- [ ] Create signal-protocol-integration.md (how we use Signal)
- [ ] Update deployment-operations.md with build process
- [ ] Update testing-strategy.md for React/TypeScript

**Developer Docs:**
- [ ] Create CONTRIBUTING.md
- [ ] Create DEVELOPMENT.md (local setup)
- [ ] Document API endpoints (actual implementation)
- [ ] Document database schema (final version)
- [ ] Add architecture diagrams

**User Docs:**
- [ ] User guide (how to use Orbital)
- [ ] FAQ (common questions)
- [ ] Privacy policy (E2EE explanation)
- [ ] Troubleshooting guide

**Deployment Docs:**
- [ ] Production deployment checklist
- [ ] Backup/restore procedures
- [ ] Monitoring setup
- [ ] Incident response plan

**Tasks:**
- [ ] Review all existing docs
- [ ] Update outdated information
- [ ] Create missing documentation
- [ ] Add screenshots to user guide
- [ ] Review and merge doc updates

**Acceptance Criteria:**
- All documentation current and accurate
- New developers can setup locally from docs
- Users can understand how to use Orbital
- Deployment process fully documented

**Estimated Time:** 1-2 days

**References:**
- All project-docs/ files

**Dependencies:**
- Implementation complete (Issues #1-18)

---

### Issue #20: MVP Launch Readiness

**Labels:** `milestone`, `phase-4`, `launch`

**Description:**

Final checklist before declaring MVP complete and launching v1.0.

**MVP Exit Criteria (from orbital-mvp-overview.md):**

**Technical Success:**
- [ ] Database inspection shows only encrypted content
- [ ] Media files on server are encrypted and unreadable
- [ ] No plaintext visible in network requests
- [ ] Sub-second response times for text
- [ ] <30 second upload for 50MB video on decent connection
- [ ] Videos play smoothly after download
- [ ] 7-day expiration working correctly
- [ ] No critical security vulnerabilities
- [ ] Real-time updates delivered within 1 second
- [ ] Storage quotas enforced correctly

**Product Success:**
- [ ] 10 people using daily for 1 week
- [ ] 50+ videos shared without data loss
- [ ] Non-technical users can successfully use it
- [ ] Feature requests focus on enhancements not fixes
- [ ] At least 3 families say they'd pay $99/year
- [ ] Storage costs sustainable (<$0.20 per family per month)

**Launch Checklist:**
- [ ] All critical bugs fixed
- [ ] Security audit passed
- [ ] Performance targets met
- [ ] Documentation complete
- [ ] Backup/restore tested
- [ ] Monitoring in place
- [ ] Support process defined
- [ ] Privacy policy published
- [ ] Terms of service published

**Tasks:**
- [ ] Run through entire checklist
- [ ] Fix any remaining blockers
- [ ] Get final stakeholder approval
- [ ] Prepare launch announcement
- [ ] Plan post-MVP roadmap

**Acceptance Criteria:**
- All MVP exit criteria met
- All launch checklist items complete
- Stakeholder approval obtained
- Ready to onboard more families

**Estimated Time:** 1 day (final review)

**References:**
- project-docs/orbital-mvp-overview.md (MVP Exit Criteria)

**Dependencies:**
- All previous issues complete

---

## Labels to Create in GitHub

Create these labels for issue organization:

**By Phase:**
- `phase-1` (Week 1)
- `phase-2` (Week 2: Media)
- `phase-3` (Week 2: Groups & Deploy)
- `phase-4` (Week 3: Beta)

**By Type:**
- `setup` (Initial configuration)
- `backend` (Node.js/API work)
- `frontend` (React/UI work)
- `database` (PostgreSQL/schema)
- `infrastructure` (Deployment/DevOps)
- `security` (Security audit/testing)
- `testing` (Testing/QA)
- `bug` (Bug fixes)
- `documentation` (Docs)
- `performance` (Optimization)

**By Priority:**
- `critical` (Must fix immediately)
- `high` (Fix within 1-2 days)
- `medium` (Fix if time allows)
- `low` (Defer to post-MVP)

**Special:**
- `milestone` (Milestone tracking issues)
- `dependencies` (Has dependencies)
- `blocked` (Blocked by something)

---

## Milestone Deadlines

If starting **2025-11-05**:

- **Milestone 1:** Complete by 2025-11-12 (Week 1)
- **Milestone 2:** Complete by 2025-11-15 (Week 2, Days 8-11)
- **Milestone 3:** Complete by 2025-11-19 (Week 2, Days 12-14)
- **Milestone 4:** Complete by 2025-11-26 (Week 3)

**MVP Launch:** 2025-11-26 (21 days from start)

---

## Notes for Project Management

1. **Issue Dependencies:** Some issues depend on others. Check "Dependencies" section before starting.

2. **Parallel Work:** Many issues can be worked in parallel:
   - Backend and Frontend can proceed simultaneously once APIs are defined
   - Documentation can be written alongside implementation

3. **Daily Standups:** Recommended during beta week to triage bugs quickly

4. **Flexible Buffer:** Days 15-21 are buffer time. If ahead of schedule, can expand beta testing or add polish.

5. **Post-MVP:** Create separate milestone for post-MVP features from roadmap

---

**Total Issues:** 20
**Total Milestones:** 4
**Timeline:** 21 days (Nov 5 - Nov 26, 2025)
