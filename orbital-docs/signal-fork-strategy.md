# Orbital: Signal Fork Implementation Strategy

> **Status:** Revised architectural approach based on forking Signal instead of building from scratch

---

## Executive Summary

**Decision:** Pivot from building a custom E2EE platform to forking and extending Signal's proven codebase.

**Why Fork Signal:**
- 10+ years of battle-tested E2EE implementation
- Signal Protocol provides forward secrecy (current plan doesn't)
- Existing infrastructure for media handling, key distribution, and group management
- Reduces development time from 31 days to ~14-21 days for MVP
- Inherits security audits and best practices
- Active maintenance and community support

**Key Trade-off:** Accept Signal's architecture and extend it, rather than building exactly to custom specs.

---

## Evaluation of Current Build-From-Scratch Plan

### ✅ Strengths of Current Plan

1. **Clear Vision**: Threaded discussions + Signal-style media relay is compelling
2. **Security-First**: E2EE from day one
3. **Simple Tech Stack**: Node.js, Vue 3, PostgreSQL - easy to understand
4. **No Build Step**: Vue via CDN keeps frontend simple
5. **Well-Documented**: Comprehensive specifications across all components

### ⚠️ Challenges & Risks

1. **Encryption Complexity**
   - **Current:** Custom RSA-OAEP + AES-GCM implementation
   - **Risk:** No forward secrecy, no protection against key compromise
   - **Risk:** Key distribution for offline members requires custom protocol
   - **Risk:** No sender authentication (messages aren't signed)

2. **Security Gaps**
   - **Issue:** 30-day JWT tokens (long-lived = security risk)
   - **Issue:** Private keys in IndexedDB vulnerable to XSS
   - **Issue:** No key verification ("trust on first use" = MITM risk)
   - **Issue:** No protection against replay attacks

3. **Reinventing the Wheel**
   - **Time:** 5 days (Days 3-5) just for encryption layer
   - **Reality:** Signal Protocol took years to perfect
   - **Benefit:** Signal's protocol is peer-reviewed and audited

4. **WebSocket Custom Protocol**
   - **Current:** Building custom WebSocket message protocol
   - **Reality:** Signal already has proven real-time infrastructure

5. **Media Encryption**
   - **Current:** Single IV per file with AES-GCM
   - **Better:** Signal's media encryption includes sender authentication

6. **Group Key Distribution**
   - **Current:** "MVP Solution: Database-backed key exchange"
   - **Better:** Signal's Sender Keys protocol handles this elegantly

7. **Timeline Risk**
   - **Estimate:** 24 days core development + 7 buffer = 31 days
   - **Reality:** Security bugs post-launch could derail everything
   - **Signal:** Inherits 10+ years of hardening

---

## Signal Fork Strategy: Which Codebase?

### Signal Repositories Overview

| Repository | Language | Purpose | Fork Viability for Orbital |
|-----------|----------|---------|---------------------------|
| **Signal-Server** | Java | Backend services | ❌ Too heavyweight, requires infrastructure |
| **Signal-Android** | Kotlin/Java | Mobile app | ⚠️ Mobile-only, hard to extend for web |
| **Signal-iOS** | Swift | Mobile app | ⚠️ Mobile-only, hard to extend for web |
| **Signal-Desktop** | TypeScript/Electron | Desktop/web app | ✅ **Best fit** - web-based, extensible |
| **libsignal** | Rust (+ JS bindings) | Core crypto library | ✅ Use alongside Signal-Desktop |

### Recommended Approach: Fork Signal-Desktop

**Why Signal-Desktop:**
1. **Web-First**: Built with Electron, already runs in browsers via web technologies
2. **TypeScript**: Modern, maintainable codebase
3. **React**: Well-structured UI components we can adapt
4. **Complete E2EE Stack**: Signal Protocol fully implemented
5. **Media Handling**: Already handles video/image encryption and storage
6. **IndexedDB**: Uses same storage approach as Orbital's current plan
7. **SQLCipher**: Encrypted database for local storage (better than plain IndexedDB)
8. **Group Management**: Proven group key distribution with Sender Keys

**Architecture:**
```
Signal-Desktop (Fork)
├── Electron App (we keep for desktop)
├── Web Frontend (React)
│   ├── Extract core components
│   ├── Adapt UI for threaded forum style
│   └── Keep E2EE, media, crypto modules
├── libsignal (Rust → WASM)
│   └── Signal Protocol implementation
└── Backend Integration
    ├── Keep: Signal Protocol, encryption
    ├── Replace: Message storage (Signal Server → our PostgreSQL + Node.js API)
    └── Add: Threading, forum-style discussions
```

---

## Revised Architecture: Orbital on Signal Foundation

### Component Breakdown

#### **1. Frontend: Signal-Desktop Fork → Orbital UI**

**Keep from Signal-Desktop:**
- Signal Protocol implementation (libsignal WASM bindings)
- Media encryption/decryption
- Key management and storage (SQLCipher for IndexedDB)
- Sealed sender (metadata protection)
- Group key distribution (Sender Keys)
- Real-time message delivery infrastructure

**Modify/Replace:**
- **UI Layer**: Replace chat interface with threaded forum UI
  - Convert Signal's conversation list → group list
  - Convert message bubbles → thread/reply cards
  - Keep media gallery, video player components
  - Add markdown rendering (already has basic formatting)

- **Storage Schema**: Extend SQLCipher tables for threads/replies
  - Add `threads` table
  - Add `replies` table
  - Keep `messages`, `groups`, `keys` tables
  - Maintain full client-side encryption

**Tech Stack Changes:**
| Current Plan | Signal Fork Approach |
|--------------|---------------------|
| Vue 3 (CDN) | React (Signal-Desktop's stack) |
| Vanilla JavaScript | TypeScript |
| IndexedDB | SQLCipher (encrypted SQLite) |
| Custom WebCrypto | libsignal (Signal Protocol) |
| Custom WebSocket | Signal's WebSocket protocol |

**Build Tool Trade-off:**
- **Current Plan:** No build step (Vue CDN)
- **Signal Fork:** Requires Webpack/build process (Electron app)
- **Mitigation:** Can extract web-only build without Electron wrapper

---

#### **2. Backend: Node.js + PostgreSQL + Signal Protocol**

**Architecture:**
```
┌─────────────────────────────────────────────┐
│   Orbital Backend (Node.js + Express)       │
├─────────────────────────────────────────────┤
│  Signal Protocol Message Relay              │
│  ├── WebSocket Server (Signal protocol)     │
│  ├── Message Queue (encrypted envelopes)    │
│  └── Push Notifications (via Signal)        │
├─────────────────────────────────────────────┤
│  Custom Orbital Features                    │
│  ├── Thread Management (PostgreSQL)         │
│  ├── Reply Hierarchy                        │
│  ├── Media Relay (7-day storage)           │
│  └── Group Quotas                          │
├─────────────────────────────────────────────┤
│  PostgreSQL Database                        │
│  ├── Encrypted Messages (Signal envelopes) │
│  ├── Threads (metadata only)               │
│  ├── Media (encrypted blobs)               │
│  └── Group Info (encrypted)                │
└─────────────────────────────────────────────┘
```

**What We Build:**
1. **Signal Protocol Relay** (3-5 days)
   - Implement Signal Server's message relay endpoints
   - Handle encrypted envelope routing
   - WebSocket server for real-time delivery
   - Use Signal's protobuf message format

2. **Forum Layer on Top** (5-7 days)
   - Thread creation/listing APIs
   - Reply hierarchy management
   - Thread-to-message mapping
   - Pagination for threads

3. **Media Relay** (3-4 days)
   - 7-day temporary storage (keep current plan)
   - Encrypted upload/download (use Signal's media encryption)
   - Quota enforcement

**What We Skip:**
- ❌ Building custom E2EE (use Signal Protocol)
- ❌ Custom key distribution (use Sender Keys)
- ❌ Custom WebSocket protocol (use Signal's)
- ❌ Password-based auth (use Signal's registration)

---

#### **3. Database Schema: Hybrid Approach**

**Signal Messages Table (for compatibility):**
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

**Orbital Threads Layer:**
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

**Media (keep current approach):**
```sql
CREATE TABLE media (
    id UUID PRIMARY KEY,
    message_id UUID REFERENCES signal_messages(id),
    encrypted_blob_path TEXT NOT NULL,
    encryption_key BYTEA NOT NULL, -- Signal's media key
    size_bytes BIGINT NOT NULL,
    uploaded_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL -- 7 days
);
```

---

### Key Technical Differences

| Aspect | Build From Scratch | Signal Fork |
|--------|-------------------|-------------|
| **Encryption** | RSA-OAEP + AES-GCM | Signal Protocol (Double Ratchet, X3DH) |
| **Forward Secrecy** | ❌ No | ✅ Yes (rotates keys per message) |
| **Key Distribution** | Custom database-backed | X3DH (asynchronous, offline-friendly) |
| **Message Authentication** | ❌ No signatures | ✅ Ed25519 signatures |
| **Metadata Protection** | ❌ Server sees who messages whom | ✅ Sealed Sender (optional) |
| **Group Keys** | Single AES key | Sender Keys (efficient multicast) |
| **Storage** | IndexedDB | SQLCipher (encrypted SQLite) |
| **Frontend** | Vue 3 (no build) | React + TypeScript (webpack build) |
| **Backend Auth** | JWT (30 days) | Signal's registration + short-lived tokens |
| **Development Time** | 24+ days | 14-21 days |
| **Security Audit** | ❌ None | ✅ Inherited from Signal |

---

## Revised Implementation Timeline

### Phase 1: Signal Desktop Fork & Setup (Days 1-3)

**Day 1-2: Environment Setup**
- Fork Signal-Desktop repository
- Remove unnecessary features:
  - Voice/video calling
  - Stories
  - Payment integration
  - Contacts sync with phone
- Extract core Signal Protocol modules
- Configure build for web-only (no Electron wrapper for MVP)

**Day 3: Backend Foundation**
- Setup Node.js server
- Implement Signal Protocol relay endpoints
- PostgreSQL with Signal message table schema
- WebSocket server with Signal's protocol

**Deliverable:** Signal-Desktop fork running locally, backend accepting Signal protocol messages

---

### Phase 2: Threading Layer (Days 4-7)

**Day 4-5: Thread Data Model**
- Add threads/replies tables to PostgreSQL
- Map Signal messages to threads
- Thread creation API
- Thread listing with pagination

**Day 6-7: UI Adaptation**
- Modify Signal's conversation view → thread view
- Replace message bubbles → thread cards
- Add reply UI components
- Keep Signal's media display components

**Deliverable:** Can create threads, post replies, view threaded discussions

---

### Phase 3: Media Integration (Days 8-11)

**Day 8-9: Media Relay**
- Implement 7-day media storage
- Use Signal's media encryption (attachment keys)
- Upload endpoint with chunking
- Download endpoint

**Day 10-11: UI & Quotas**
- Media upload UI (adapt Signal's attachment UI)
- Progress indicators
- Quota tracking (10GB/100 files)
- Local storage in SQLCipher

**Deliverable:** Full-quality video/photo sharing with encryption working

---

### Phase 4: Polish & Testing (Days 12-14)

**Day 12: Group Management**
- Adapt Signal's group creation flow
- Invite code generation (custom addition)
- Use Signal's Sender Keys for group key distribution

**Day 13: Security Audit**
- Verify Signal Protocol implementation intact
- Test key rotation
- Verify encrypted storage
- Check for plaintext leaks

**Day 14: Production Deployment**
- Deploy to DigitalOcean
- Nginx configuration
- SSL setup
- Initial testing

**Deliverable:** Deployable MVP ready for beta testing

---

### Buffer Week (Days 15-21): Iteration

- Address beta feedback
- Performance tuning
- Bug fixes
- Documentation
- Family testing

**Total Timeline:** 14 days core + 7 buffer = **21 days** (vs 31 days)

---

## Trade-offs & Considerations

### ✅ Advantages of Signal Fork

1. **Security:**
   - Battle-tested E2EE (10+ years, peer-reviewed)
   - Forward secrecy out of the box
   - Protection against key compromise
   - Sender authentication
   - Optional metadata protection

2. **Development Speed:**
   - Saves 10+ days of encryption implementation
   - Inherits media handling infrastructure
   - No need to build key distribution from scratch

3. **Reliability:**
   - Signal Protocol handles edge cases we'd miss
   - Proven at scale (millions of users)
   - Active maintenance

4. **Future-Proofing:**
   - Easy to merge upstream Signal improvements
   - Benefits from Signal's ongoing security updates
   - Community support

### ⚠️ Disadvantages & Mitigations

1. **Complexity:**
   - **Issue:** Signal-Desktop is a large codebase (>100k LOC)
   - **Mitigation:** Extract only core modules (Signal Protocol, crypto, storage)
   - **Mitigation:** Remove features we don't need (calling, stories, etc.)

2. **Build Process:**
   - **Issue:** Requires webpack build (vs no-build Vue CDN)
   - **Mitigation:** Still simpler than building E2EE from scratch
   - **Mitigation:** Can create web-optimized build separate from Electron

3. **Learning Curve:**
   - **Issue:** Need to understand Signal's architecture
   - **Mitigation:** Signal-Desktop is well-documented
   - **Mitigation:** Strong TypeScript typing helps navigation
   - **Mitigation:** Days 1-3 dedicated to understanding codebase

4. **Dependency on Signal:**
   - **Issue:** Reliant on Signal's protocol and libraries
   - **Mitigation:** Signal Protocol is open-source and stable
   - **Mitigation:** Can fork libsignal if needed
   - **Acceptance:** This is a feature, not a bug (leverage their expertise)

5. **Registration Flow:**
   - **Issue:** Signal requires phone number verification
   - **Mitigation:** Can modify to use email or username-only (break Signal compatibility)
   - **Decision:** Keep phone-based registration for MVP (simplifies spam prevention)

---

## What Changes from Original Plan

### Keep These Great Ideas ✅

1. **Threading over chat** - This is Orbital's core innovation
2. **7-day media relay** - Still the best approach for family video sharing
3. **No ads, no algorithms** - Keep the philosophy
4. **Storage quotas (10GB/100 files)** - Still needed
5. **PostgreSQL database** - Still valid
6. **DigitalOcean hosting** - Still cost-effective

### Replace These Components 🔄

1. **Custom E2EE → Signal Protocol**
   - Better security, less work

2. **Vue 3 (no-build) → React + TypeScript (build process)**
   - Trade-off: More tooling complexity for better security foundation

3. **IndexedDB → SQLCipher**
   - Encrypted database better protects keys and messages

4. **Custom WebSocket → Signal's WebSocket protocol**
   - Proven reliability

5. **30-day JWT → Signal's registration + session management**
   - More secure short-lived tokens

6. **Custom key distribution → X3DH + Sender Keys**
   - Works offline, battle-tested

---

## Migration Path from Docs to Implementation

### Update Required Documents

1. **encryption-and-security.md**
   - Replace custom crypto sections with Signal Protocol overview
   - Document libsignal integration
   - Update key management (X3DH instead of custom RSA)

2. **frontend-architecture.md**
   - Replace Vue 3 with React + TypeScript
   - Update to use Signal-Desktop components
   - Document SQLCipher instead of IndexedDB

3. **api-specification.md**
   - Add Signal Protocol envelope endpoints
   - Update message format (protobuf)
   - Document thread-to-message mapping

4. **websocket-realtime.md**
   - Replace custom protocol with Signal's WebSocket protocol
   - Update authentication flow

5. **database-schema.md**
   - Add signal_messages table
   - Update relationships (threads → messages)

6. **deployment-operations.md**
   - Add build process instructions (webpack)
   - Update dependencies (libsignal, protobuf)

### Implementation Checklist

- [ ] Fork Signal-Desktop repository
- [ ] Remove unnecessary features (calling, stories, etc.)
- [ ] Extract core Signal Protocol modules
- [ ] Setup backend with Signal message relay
- [ ] Add thread/reply data model
- [ ] Modify UI for threaded discussions
- [ ] Integrate media relay with Signal's encryption
- [ ] Implement invite code system
- [ ] Deploy MVP
- [ ] Beta test with families

---

## Recommendation

**Strongly recommend forking Signal-Desktop** for the following reasons:

1. **Security is paramount** - Orbital promises E2EE. Signal Protocol provides battle-tested security that would take years to replicate.

2. **Faster time to market** - 21 days vs 31 days, with higher security confidence.

3. **Lower risk** - Building E2EE from scratch is error-prone. Signal's protocol is peer-reviewed and audited.

4. **Better user protection** - Forward secrecy protects users even if keys are later compromised.

5. **Innovation where it matters** - Spend time on threading/forum UX (Orbital's unique value), not reinventing encryption.

The trade-off (build process, React vs Vue) is worthwhile for the security and reliability gains.

---

## Next Steps

1. **Review this strategy** - Discuss trade-offs with stakeholders
2. **Decision point** - Approve Signal fork approach
3. **Setup fork** - Fork Signal-Desktop, create development branch
4. **Begin Phase 1** - 3 days to understand Signal codebase and extract core modules
5. **Update all project docs** - Reflect new architecture
6. **Start building** - Follow revised 21-day timeline

**Question to answer:** Are we comfortable with the trade-offs (build process, larger codebase) in exchange for battle-tested security and faster development?

**My recommendation:** Yes. The security and reliability benefits far outweigh the complexity of a build process.
