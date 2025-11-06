# Orbital - Product Requirements Document (PRD)

**Version:** 1.0
**Last Updated:** 2025-11-05
**Status:** Active Development
**Target:** MVP Launch by 2025-11-26

---

## Executive Summary

**What:** Orbital is an end-to-end encrypted, threaded discussion platform for small groups of friends and family, built on Signal Protocol for maximum security.

**Why:** Families need a better way to share high-quality videos and have organized, findable conversations without ads, algorithms, or surveillance. SMS ruins video quality, WhatsApp compresses media, group chats are chaotic, and losing a phone means losing memories.

**How:** Fork Signal-Desktop to inherit battle-tested E2EE, then build a custom threading layer with distributed media storage where your family/friends ("orbit") collectively serve as backups for each other.

**Key Innovation:** Signal-quality video sharing with threaded conversations where media is permanently stored on all members' devices. Your orbit is your backup - when someone loses their phone, they can recover everything because the group collectively holds all media.

---

## Product Vision

### Core Principle
*"The internet used to be good. We're building that again."*

A back-to-basics social network that prioritizes:
- **Privacy First:** End-to-end encryption for all content
- **Quality Over Compression:** Full-quality video sharing (up to 500MB)
- **Threading Over Chat:** Organized discussions, not endless scrolling
- **Distributed Backup:** Your orbit holds your memories, not a company's servers
- **No Surveillance:** Zero-knowledge architecture, server can't read content
- **Family-Focused:** Built for trust circles, not viral growth

### The Problem We Solve
1. **SMS destroys video quality** - Videos are compressed beyond recognition
2. **WhatsApp compresses everything** - Family videos look terrible
3. **Group chats are chaos** - Conversations get lost, media disappears
4. **Platforms mine your data** - Tech companies monetize family moments
5. **Losing a phone = losing memories** - Your photos/videos are gone forever
6. **Content isn't yours** - Companies delete accounts, change rules, own your data

### Our Solution
- **Signal-level encryption** - Nobody (including us) can read your messages or watch your videos
- **7-day media relay** - Videos sync to all orbit members' devices in full quality, then server deletes
- **Permanent local storage** - Each member keeps full copy of all group media forever
- **Distributed backup** - If grandma loses her phone, the family has her memories
- **Threaded discussions** - Conversations have structure, media is findable
- **You own your data** - Permanent storage on your devices, not our servers
- **No ads, no tracking** - Subscription model ($99/year post-MVP)

### The "Orbit" Concept
Your **orbit** is your trusted group (family/friends). Everyone in your orbit:
- Receives all media in full quality
- Stores media permanently on their device
- Serves as a distributed backup for others
- Can recover their data from the group if they lose their device

*"Your orbit holds your memories together."*

---

## Target Users

### Primary: Families (MVP Focus)
- **Profile:** 3-20 family members across generations
- **Need:** Share baby/grandkid videos in full quality + never lose memories
- **Pain:** Videos get compressed, conversations get lost, lost phone = lost photos
- **Technical Level:** Low to medium (must work for grandparents)

### Secondary: Close Friend Groups (Post-MVP)
- **Profile:** 5-30 friends who want private discussions
- **Need:** Organized group chat with quality media + collective memory
- **Pain:** Signal/WhatsApp are linear chat, hard to find old content

### Tertiary: Remote Teams (Future)
- **Profile:** Small teams (5-15 people) who value privacy
- **Need:** Threaded work discussions with encrypted files + team knowledge base
- **Pain:** Slack costs money, isn't E2EE, has retention limits

---

## Core User Journeys

### Journey 1: First-Time User Onboarding (Signal-Style)
1. Downloads/opens Orbital app
2. Enters phone number
3. Receives and enters SMS verification code
4. (Optional) Sets display name and profile photo
5. Receives invite code from family member via SMS/text
6. Enters invite code → joins family orbit
7. **App begins auto-downloading all existing threads and media from orbit**
8. Sees full history once sync completes
9. Posts first reply or new thread

**Success:** User completes setup in <3 minutes and has full orbit history

**Design Goal:** Match Signal's friction-free setup - no passwords, no email, no forms

### Journey 2: Sharing a Video
1. User wants to share baby's first steps
2. Creates new thread with title "Emma's First Steps!"
3. Adds video (300MB, 2 minutes long)
4. Uploads with progress indicator
5. Server receives encrypted video, notifies orbit members
6. **Each orbit member's device downloads and permanently stores video**
7. After 7 days, server deletes its copy (orbit members still have it)
8. Video plays back in full quality from local storage anytime

**Success:** Video looks perfect, all orbit members have permanent copy

### Journey 3: Finding Old Content
1. User wants to find video from 3 months ago
2. Scrolls through thread list (chronological)
3. Finds thread by title or date
4. Opens thread, video plays immediately from local storage
5. Adds new reply to thread

**Success:** User finds content in <30 seconds, plays instantly (no download)

### Journey 4: Recovering After Lost Phone (Key Innovation)
1. Grandma loses her phone with all her photos
2. Gets new phone, downloads Orbital
3. Enters her phone number + verification code
4. Re-enters orbit invite code (or family re-invites her)
5. **App automatically downloads all orbit content from other members**
6. All her photos/videos reappear (because family had copies)
7. No memories lost

**Success:** Complete recovery of all orbit content within 30 minutes

**Key Insight:** Your orbit is your backup. Losing a device doesn't mean losing memories.

---

## Technical Architecture

### Architecture Decision: Signal Fork + Distributed Storage
**Rationale:** Inherit battle-tested E2EE + add distributed backup model
- Gets forward secrecy via Double Ratchet
- Gets X3DH for offline key distribution
- Gets SQLCipher for encrypted local storage
- Gets proven media encryption with attachment keys
- Gets Signal's phone number verification system
- **Add:** Permanent local storage (not temporary cache)
- **Add:** Distributed backup/recovery mechanism

**Trade-offs Accepted:**
- Build process (webpack) instead of no-build Vue CDN
- React + TypeScript instead of Vue 3
- Larger initial codebase to understand and strip down
- Phone number requirement (inherent to Signal Protocol)
- Local disk usage (users store all orbit media permanently)

### Media Storage Model

```
┌─────────────────────────────────────────────────────┐
│              Media Lifecycle                        │
└─────────────────────────────────────────────────────┘

1. UPLOAD (Day 0)
   User uploads video → Server stores encrypted blob

2. RELAY (Days 0-7)
   ├─ Server notifies all orbit members
   ├─ Each member downloads encrypted media
   ├─ Each member decrypts and stores permanently in SQLCipher
   └─ Server keeps encrypted copy for 7 days

3. PERMANENT (Day 7+)
   ├─ Server deletes its copy (7-day retention)
   ├─ All orbit members still have decrypted copy locally
   └─ Media plays from local storage (instant, no download)

4. RECOVERY (Any time)
   ├─ New member joins → downloads all historical media
   ├─ Member loses device → re-joins orbit
   └─ App syncs all media from other orbit members
```

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                 Orbital Client (Member Device)              │
│          (Signal-Desktop Fork with Threading UI)            │
│                                                              │
│  ┌──────────────────────┐  ┌──────────────────────────┐   │
│  │   React Frontend     │  │    SQLCipher DB          │   │
│  │   - Thread UI        │  │    - Messages (E2EE)     │   │
│  │   - Media Display    │  │    - Keys                │   │
│  │   - Compose          │  │    - Media (permanent)   │   │
│  │   - Sync Manager     │  │    - Full orbit history  │   │
│  └──────────────────────┘  └──────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         Signal Protocol Layer (libsignal)            │  │
│  │  - X3DH (key agreement)                               │  │
│  │  - Double Ratchet (message encryption)                │  │
│  │  - Sender Keys (group encryption)                     │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                 WebSocket + REST API (Encrypted)
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│             Orbital Backend (Temporary Relay)                │
│          (Node.js + Express + PostgreSQL)                    │
│                                                              │
│  ┌──────────────────────┐  ┌──────────────────────────┐   │
│  │  Signal Relay        │  │  Threading API           │   │
│  │  - Encrypted msgs    │  │  - POST /api/threads     │   │
│  │  - WebSocket         │  │  - GET /api/threads      │   │
│  │  - Media relay       │  │  - POST /api/replies     │   │
│  │  - 7-day retention   │  │  - GET /api/groups       │   │
│  └──────────────────────┘  └──────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         PostgreSQL Database                           │  │
│  │  - signal_messages (encrypted, 7-day retention)       │  │
│  │  - threads (encrypted metadata)                       │  │
│  │  - media (encrypted blobs, 7-day retention)           │  │
│  │  - groups (encrypted names, invite codes)             │  │
│  │  - group_quotas (10GB/100 file limits)                │  │
│  │  - accounts (phone numbers, device keys)              │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  📝 Server storage is TEMPORARY (7 days only)               │
│  📝 Server cannot read any content (all encrypted)          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│         Distributed Backup (Across All Orbit Members)       │
│                                                              │
│  Each member's device = permanent backup                    │
│  ├─ Grandma's Device: Full orbit history                    │
│  ├─ Mom's Device: Full orbit history                        │
│  ├─ Dad's Device: Full orbit history                        │
│  ├─ Uncle's Device: Full orbit history                      │
│  └─ Cousin's Device: Full orbit history                     │
│                                                              │
│  If anyone loses device → recovers from others              │
└─────────────────────────────────────────────────────────────┘
```

### Technology Stack

**Frontend (Signal-Desktop Fork):**
- React 18
- TypeScript
- Electron (desktop app)
- SQLCipher (encrypted SQLite with unlimited storage)
- libsignal (WASM bindings)

**Backend:**
- Node.js 18+
- Express
- PostgreSQL 15
- ws (WebSocket)
- Winston (logging)

**Encryption:**
- Signal Protocol (libsignal)
- X3DH (key agreement)
- Double Ratchet (message encryption)
- Sender Keys (group encryption)
- AES-GCM (media encryption with attachment keys)

**Infrastructure:**
- DigitalOcean Droplet ($12/month - 2GB RAM)
- Nginx (reverse proxy + SSL)
- PM2 (process management)
- Let's Encrypt (SSL)

---

## Core Features & Requirements

### MVP Features (Must Have for Launch)

#### 1. User Authentication (Signal-Style)
- **Phone Verification:** SMS-based verification (like Signal)
- **Display Name:** Optional display name (default: phone number)
- **Profile Photo:** Optional profile photo
- **Device Registration:** Link device to phone number via X3DH
- **No Passwords:** Phone number is the identifier (Signal model)
- **Session Management:** Persistent sessions on registered devices
- **Out of Scope:** Email verification, password recovery, 2FA, linking multiple devices

#### 2. Orbit (Group) Management
- **Create Orbit:** User creates orbit with encrypted name
- **Invite Code:** 8-character alphanumeric code generated
- **Join Orbit:** User enters invite code to join
- **Key Distribution:** Signal's Sender Keys for orbit encryption
- **Offline Support:** X3DH for adding members who are offline
- **Full Sync on Join:** New member downloads entire orbit history
- **Re-join Recovery:** Lost device → re-join orbit → recover all content
- **Out of Scope:** Leave orbit, remove members, orbit settings, admin roles

#### 3. Threaded Discussions
- **Create Thread:** Title (required) + body (markdown supported)
- **Reply to Thread:** Add replies with text/media
- **View Threads:** Chronological list, paginated
- **View Thread Detail:** See all replies in thread
- **Encryption:** All text encrypted with Signal Protocol
- **Persistent History:** All threads stored permanently on each member's device
- **Out of Scope:** Edit/delete, search, reactions, read receipts

#### 4. Media Sharing with Distributed Backup (Killer Feature)
- **Upload:** Videos up to 500MB, images up to 50MB
- **Encryption:** Signal's attachment key encryption
- **Chunked Upload:** 5MB chunks with progress indicator
- **7-Day Server Relay:** Server stores encrypted media for 7 days only
- **Permanent Local Storage:** Each orbit member stores decrypted media forever
- **Auto-Sync:** On WiFi, media downloads to all orbit members automatically
- **Distributed Backup:** All members hold full copy, serve as each other's backup
- **Recovery Mechanism:** Lost device → re-join orbit → download all media from other members
- **Playback:** Video/image playback from local storage (instant, no download)
- **Quota:** 10GB storage, 100 files max per orbit
- **Out of Scope:** Transcoding, thumbnails, streaming, P2P transfer

#### 5. Real-Time Updates
- **WebSocket:** Persistent connection for notifications
- **Notifications:** New threads, replies, media available
- **Browser Notifications:** Desktop notifications (if permitted)
- **Out of Scope:** Push notifications, mobile apps

### Post-MVP Features (Phase 2+)

#### Phase 2: Enhanced Media & UX
- Video transcoding for bandwidth optimization
- Thumbnail generation
- Photo galleries/albums
- Drag-and-drop uploads
- Edit/delete posts
- Email notifications
- Search within orbit

#### Phase 3: Advanced Features
- Native mobile apps (iOS/Android)
- Rich link previews
- GIF picker
- Markdown editor with preview
- Encrypted search
- Reactions/emoji
- Voice messages
- Link multiple devices (like Signal)
- P2P media transfer (faster sync between orbit members)

#### Phase 4: Scale & Polish
- Redis caching
- CDN for global delivery (relay only)
- S3 storage migration (server relay storage)
- Backup/export tools (export your orbit archive)
- Payment integration (Stripe)
- Key verification (safety numbers)
- Orbit analytics (storage usage per member)

---

## Functional Requirements

### FR-1: Authentication (Signal-Style)
- **FR-1.1:** System shall allow user registration with phone number only
- **FR-1.2:** System shall send SMS verification code to phone number
- **FR-1.3:** System shall verify 6-digit SMS code within 10 minutes of issuance
- **FR-1.4:** System shall allow user to set optional display name (default: phone number)
- **FR-1.5:** System shall allow user to set optional profile photo
- **FR-1.6:** System shall register device using X3DH key exchange protocol
- **FR-1.7:** System shall maintain persistent session on registered device
- **FR-1.8:** System shall rate-limit verification requests (3 per phone per hour)

### FR-2: Orbits (Groups)
- **FR-2.1:** User shall be able to create an orbit with an encrypted name
- **FR-2.2:** System shall generate unique 8-character invite code per orbit
- **FR-2.3:** User shall be able to join orbit by entering invite code
- **FR-2.4:** System shall distribute orbit keys via Signal's Sender Keys protocol
- **FR-2.5:** System shall support offline member key distribution via X3DH
- **FR-2.6:** System shall sync full orbit history when new member joins
- **FR-2.7:** System shall allow member to re-join orbit after losing device
- **FR-2.8:** System shall sync all content from other members during recovery

### FR-3: Threading
- **FR-3.1:** User shall be able to create thread with title (required) and body (optional)
- **FR-3.2:** Thread title shall be max 200 characters
- **FR-3.3:** Thread body shall support markdown formatting
- **FR-3.4:** User shall be able to reply to threads
- **FR-3.5:** System shall display threads chronologically (newest first)
- **FR-3.6:** System shall paginate thread list (20 threads per page)
- **FR-3.7:** All text content shall be encrypted with Signal Protocol before storage
- **FR-3.8:** Client shall store all thread history permanently in SQLCipher

### FR-4: Media (Distributed Backup Model)
- **FR-4.1:** User shall be able to upload videos up to 500MB
- **FR-4.2:** User shall be able to upload images up to 50MB
- **FR-4.3:** System shall encrypt media with Signal's attachment keys before storage
- **FR-4.4:** System shall chunk uploads in 5MB pieces
- **FR-4.5:** System shall show upload progress indicator
- **FR-4.6:** Server shall store encrypted media for exactly 7 days
- **FR-4.7:** Server shall delete media after 7 days automatically
- **FR-4.8:** Server shall notify all orbit members when new media available
- **FR-4.9:** Client shall auto-download media on WiFi (configurable)
- **FR-4.10:** Client shall decrypt and store media permanently in SQLCipher
- **FR-4.11:** Client shall store full orbit media history (no expiration)
- **FR-4.12:** System shall enforce 10GB storage quota per orbit
- **FR-4.13:** System shall enforce 100 file limit per orbit
- **FR-4.14:** System shall warn at 80% of quota limits
- **FR-4.15:** System shall reject uploads if quota exceeded
- **FR-4.16:** Client shall serve media from local storage (instant playback)
- **FR-4.17:** System shall enable recovery of all media when member re-joins orbit

### FR-5: Real-Time
- **FR-5.1:** Client shall maintain WebSocket connection to server
- **FR-5.2:** Server shall send notifications for new threads within 1 second
- **FR-5.3:** Server shall send notifications for new replies within 1 second
- **FR-5.4:** Server shall send notifications for new media within 1 second
- **FR-5.5:** Client shall display browser notifications (if user permitted)
- **FR-5.6:** Client shall reconnect automatically if WebSocket drops

---

## Non-Functional Requirements

### NFR-1: Security
- **NFR-1.1:** All message content SHALL be end-to-end encrypted
- **NFR-1.2:** Server SHALL NOT be able to decrypt any user content
- **NFR-1.3:** System SHALL use Signal Protocol for all encryption
- **NFR-1.4:** System SHALL provide forward secrecy via Double Ratchet
- **NFR-1.5:** System SHALL provide post-compromise security
- **NFR-1.6:** Database inspection SHALL show only encrypted data
- **NFR-1.7:** Network inspection SHALL show only encrypted envelopes
- **NFR-1.8:** System SHALL pass security audit with no critical vulnerabilities
- **NFR-1.9:** System SHALL sanitize all user input to prevent XSS
- **NFR-1.10:** System SHALL use parameterized queries to prevent SQL injection

### NFR-2: Performance
- **NFR-2.1:** Thread list SHALL load in <500ms
- **NFR-2.2:** Thread detail SHALL load in <500ms
- **NFR-2.3:** Post thread/reply SHALL complete in <1 second
- **NFR-2.4:** 50MB video upload SHALL complete in <30 seconds on broadband
- **NFR-2.5:** Video playback SHALL start in <3 seconds (from local storage)
- **NFR-2.6:** Real-time notifications SHALL arrive within 1 second
- **NFR-2.7:** System SHALL handle 100 concurrent users (MVP scale)
- **NFR-2.8:** Full orbit sync for new member SHALL complete within 30 minutes (10GB max)

### NFR-3: Reliability
- **NFR-3.1:** System SHALL have 99% uptime during beta
- **NFR-3.2:** Data loss incidents SHALL be zero
- **NFR-3.3:** Failed uploads SHALL not corrupt orbit quota
- **NFR-3.4:** WebSocket SHALL reconnect automatically on disconnect
- **NFR-3.5:** System SHALL have daily database backups with 7-day retention
- **NFR-3.6:** Lost device recovery SHALL restore 100% of orbit content
- **NFR-3.7:** Client storage SHALL handle orbit quotas without corruption

### NFR-4: Usability
- **NFR-4.1:** Non-technical users SHALL complete onboarding in <3 minutes (Signal benchmark)
- **NFR-4.2:** Onboarding SHALL require only phone number and invite code (no forms)
- **NFR-4.3:** Video upload SHALL show clear progress indicator
- **NFR-4.4:** Error messages SHALL be user-friendly, not technical
- **NFR-4.5:** UI SHALL work on Chrome, Firefox, Safari (latest versions)
- **NFR-4.6:** Grandparents SHALL watch videos without help
- **NFR-4.7:** Lost device recovery SHALL be self-service (no support needed)
- **NFR-4.8:** Users SHALL understand they are their orbit's backup

### NFR-5: Storage & Scalability
- **NFR-5.1:** Client SHALL handle 10GB of local media storage
- **NFR-5.2:** Server SHALL delete media after exactly 7 days (cost control)
- **NFR-5.3:** Architecture SHALL support 10,000+ users in future
- **NFR-5.4:** Media storage SHALL be migratable to S3
- **NFR-5.5:** Database SHALL be separable from app server

---

## Success Criteria

### MVP Exit Criteria (Ship v1.0 When)
1. ✅ **10 people using daily for 1 week** - Demonstrates product-market fit
2. ✅ **50+ videos shared without data loss** - Validates media relay
3. ✅ **Zero data loss incidents** - Security and reliability proven
4. ✅ **Non-technical users successfully use it** - Usability validated
5. ✅ **At least 1 successful device recovery** - Distributed backup works
6. ✅ **At least 3 families say they'd pay $99/year** - Pricing validated
7. ✅ **Storage costs <$0.20 per family per month** - Unit economics work (7-day deletion)

### Technical Success Metrics
- Database shows only encrypted content ✅
- Media files on server are encrypted and unreadable ✅
- No plaintext in network requests ✅
- Sub-second response times for text ✅
- <30 second upload for 50MB video ✅
- Videos play instantly from local storage ✅
- 7-day server deletion works correctly ✅
- Orbit members have full permanent copies ✅
- Lost device recovery completes successfully ✅
- No critical security vulnerabilities ✅
- Real-time updates within 1 second ✅
- Storage quotas enforced correctly ✅

### Product Success Metrics
- Users post daily without prompting
- Families successfully share videos SMS would compress
- "Aha!" moment when users realize server can't read their data
- "Aha!" moment when users realize their orbit is their backup
- Grandparents successfully view grandkid videos
- Someone successfully recovers content after losing device
- Feature requests focus on enhancements not fixes
- At least one user says "better than WhatsApp for videos"
- At least one user says "I love that we're each other's backup"

---

## Constraints & Assumptions

### Constraints
1. **Timeline:** Must ship MVP within 3 weeks
2. **Budget:** $12/month DigitalOcean droplet for MVP
3. **Scale:** Support 10-15 users initially (3-5 families)
4. **Platform:** Desktop only (web/Electron), no mobile apps for MVP
5. **Team:** Small team, need efficient development
6. **Phone Numbers:** Required for Signal Protocol (can't avoid)
7. **Client Storage:** Users must have disk space (10GB+ recommended)

### Assumptions
1. Signal Protocol is stable and well-documented
2. Signal's phone verification system can be replicated/adapted
3. Users will accept phone number requirement (like Signal/WhatsApp)
4. Users have sufficient local disk space (10GB+)
5. Users will accept desktop-only app for MVP
6. Users understand their orbit members serve as mutual backups
7. 10GB/100 file quotas are sufficient for families
8. 7-day server relay is acceptable (users have permanent copies)
9. $99/year pricing is acceptable to target users
10. DigitalOcean droplet can handle 10-15 concurrent users

---

## Risks & Mitigations

### Risk 1: Users Don't Understand Distributed Backup Model
**Impact:** High - Core value proposition
**Probability:** Medium
**Mitigation:**
- Clear onboarding messaging about orbit = backup
- Visual indicator showing which members have content
- Success stories in user guide ("Grandma recovered everything")
- Test messaging with beta families

### Risk 2: Local Storage Fills Up User's Disk
**Impact:** Medium - Could cause frustration
**Probability:** Low (10GB is small by modern standards)
**Mitigation:**
- Clear storage requirements during onboarding
- Storage usage indicator in UI
- Warning at 80% of device capacity
- Option to delete local media (with warning about backup loss)

### Risk 3: Signal Codebase Too Complex
**Impact:** High - Could delay initial setup
**Probability:** Medium
**Mitigation:**
- Allocate sufficient time to understanding codebase
- Focus on extracting only what we need
- Remove 60% of features to simplify
- Document architecture as we learn

### Risk 4: Phone Verification Implementation
**Impact:** High - Core to Signal's security model
**Probability:** Medium
**Mitigation:**
- Use Twilio or similar SMS service (well-documented)
- Implement rate limiting to prevent abuse
- Consider development mode bypass for testing
- Plan for international SMS costs

### Risk 5: Media Sync Takes Too Long
**Impact:** Medium - Recovery experience could frustrate
**Probability:** Medium
**Mitigation:**
- Progressive sync (most recent first)
- Background sync so user can use app while syncing
- Clear progress indicator during recovery
- WiFi-only default to avoid data charges

### Risk 6: Security Vulnerability
**Impact:** Critical - Would destroy trust
**Probability:** Low (thanks to Signal Protocol)
**Mitigation:**
- Inherit Signal's security model
- Conduct thorough security audit
- Test for SQL injection, XSS, CSRF
- Network traffic inspection for plaintext
- Database inspection for plaintext

---

## Dependencies

### External Dependencies
1. **Signal-Desktop repository** - Must remain accessible for forking
2. **libsignal** - Signal Protocol implementation
3. **SMS service** - Twilio or similar for phone verification
4. **DigitalOcean** - Hosting provider
5. **PostgreSQL** - Database
6. **Let's Encrypt** - SSL certificates

### Internal Dependencies
See GitHub Issues for detailed dependency tracking between tasks.

---

## Out of Scope (Explicitly Excluded from MVP)

### Features
- Mobile apps (iOS/Android)
- Linking multiple devices (Signal's multi-device feature)
- P2P media transfer (direct orbit member to member)
- Video transcoding or compression
- Video thumbnails
- Video streaming (progressive download)
- Edit or delete posts
- Search functionality
- Rich link previews
- User profiles beyond display name/photo
- GIF reactions
- Email notifications
- Password recovery (no passwords in Signal model)
- Email verification
- Multiple orbit switching UI (single orbit for MVP)
- Read receipts
- Typing indicators
- Voice/video calling
- Stories
- Payments
- Selective media download (must download all)
- Storage quotas per member (quota is per orbit)

### Technical
- Redis caching
- CDN integration (relay is centralized for MVP)
- S3 storage (use local disk for MVP)
- Horizontal scaling
- Load balancing
- Multi-region deployment
- Media deduplication
- Compression algorithms

---

## Project Management

### Task Tracking
All development tasks are tracked in GitHub Issues:
- 4 Milestones created with due dates
- 20 Issues created covering all MVP work
- Issues tagged with phase, type, priority labels
- Dependencies documented in issue descriptions

**View Issues:** https://github.com/alexg-g/Orbital-Desktop/issues

### Milestones
1. **Signal Foundation (Days 1-7)** - Due: 2025-11-12
2. **Media Integration (Days 8-11)** - Due: 2025-11-15
3. **Groups & Polish (Days 12-14)** - Due: 2025-11-19
4. **Beta Testing & Iteration (Days 15-21)** - Due: 2025-11-26

---

## Documentation

### For Developers
- **Architecture:** [ARCHITECTURE-DECISION.md](ARCHITECTURE-DECISION.md)
- **Signal Fork Strategy:** [signal-fork-strategy.md](signal-fork-strategy.md)
- **Database Schema:** [database-schema.md](database-schema.md)
- **API Specification:** [api-specification.md](api-specification.md)
- **Testing Strategy:** [testing-strategy.md](testing-strategy.md)
- **Deployment:** [deployment-operations.md](deployment-operations.md)

### For Users (Post-MVP)
- User guide (how to use Orbital)
- FAQ (common questions)
- Privacy policy (E2EE explanation)
- Troubleshooting guide
- "Your Orbit is Your Backup" explainer

---

## Key Principles

### Product Principles
1. **Privacy First** - E2EE is non-negotiable
2. **Simplicity Over Features** - Do less, do it better
3. **Quality Over Compression** - Never compromise media quality
4. **User Owns Data** - Permanent client storage, temporary server relay
5. **Your Orbit is Your Backup** - Distributed trust, not centralized storage
6. **No Surveillance Capitalism** - Subscription model, not ads
7. **Low Friction** - Match Signal's easy onboarding (phone number only)

### Engineering Principles
1. **Security by Design** - Inherit Signal Protocol, don't reinvent
2. **Pragmatic Choices** - Fork Signal instead of building from scratch
3. **Ship Fast, Iterate** - MVP first, then improve
4. **Test Critical Paths** - Security, media upload, E2EE, recovery must be bulletproof
5. **Document as We Go** - Each specialist documents their work

### Development Principles
1. **Focus on Innovation** - Threading + distributed backup are our differentiators
2. **Stand on Shoulders of Giants** - Use Signal Protocol, don't rebuild
3. **Fail Securely** - Errors should never expose plaintext
4. **Zero Knowledge** - Server should be untrusted and temporary
5. **Transparent Security** - Encryption should be auditable

---

## Glossary

- **E2EE:** End-to-end encryption (only sender and recipients can decrypt)
- **Signal Protocol:** Encryption protocol used by Signal, WhatsApp, etc.
- **X3DH:** Extended Triple Diffie-Hellman (key agreement protocol)
- **Double Ratchet:** Algorithm providing forward secrecy in Signal Protocol
- **Sender Keys:** Efficient group encryption mechanism in Signal Protocol
- **SQLCipher:** Encrypted SQLite database
- **libsignal:** Signal's cryptography library (Rust, with WASM bindings)
- **Threading:** Organizing messages into discussions with replies (like forum)
- **Media Relay:** Temporary server storage (7 days) that syncs to client devices
- **Attachment Keys:** Encryption keys for media files in Signal Protocol
- **Sealed Sender:** Feature hiding sender identity from server
- **Phone Verification:** SMS-based registration (Signal's approach)
- **Orbit:** Your trusted group (family/friends) who collectively hold your memories
- **Distributed Backup:** Each orbit member stores full copy, serving as backup for others
- **Recovery:** Process of re-joining orbit and syncing all content after losing device

---

## Approval & Sign-Off

**Document Owner:** Project Lead
**Reviewers:** Engineering Team, Product Team
**Status:** Approved ✅
**Date Approved:** 2025-11-05

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-11-05 | Project Lead | Initial PRD - Signal-style auth, distributed backup model |

---

**This document is the single source of truth for Orbital. All agents and team members should reference this PRD for product requirements, technical constraints, and success criteria.**
