# Orbital Architecture Decision: Signal Fork vs Build From Scratch

**Date:** 2025-11-04
**Status:** Proposed
**Decision:** Fork Signal-Desktop instead of building E2EE from scratch

---

## TL;DR

**Recommendation:** Fork Signal-Desktop and build Orbital's threading features on top of Signal's proven E2EE foundation.

**Why:**
- ✅ Save 10 days development time (21 days vs 31 days)
- ✅ Inherit battle-tested E2EE with forward secrecy
- ✅ Avoid security pitfalls in custom crypto implementation
- ✅ Focus innovation on threading/forum UX (Orbital's actual differentiator)

**Trade-off:**
- ⚠️ Accept build process (webpack) instead of no-build Vue CDN
- ⚠️ React + TypeScript instead of Vue 3
- ⚠️ Larger initial codebase to understand

**Verdict:** Security and reliability benefits far outweigh complexity trade-offs.

---

## Quick Comparison

| Aspect | Build From Scratch | Fork Signal |
|--------|-------------------|-------------|
| **Timeline** | 31 days (24 + 7 buffer) | 21 days (14 + 7 buffer) |
| **E2EE Quality** | Custom (unaudited) | Battle-tested (10+ years) |
| **Forward Secrecy** | ❌ No | ✅ Yes |
| **Key Distribution** | Custom database protocol | X3DH (proven, offline-capable) |
| **Frontend Stack** | Vue 3 (no build) | React + TypeScript (build required) |
| **Storage** | IndexedDB | SQLCipher (encrypted SQLite) |
| **Security Audit** | Required post-launch | Inherited from Signal |
| **Risk Level** | High (crypto is hard) | Low (proven foundation) |

---

## Core Problem with Build-From-Scratch Approach

### Security Gaps in Current Plan

1. **No Forward Secrecy**
   - Current: Single AES key per group
   - Problem: If key compromised, all past messages readable
   - Signal: Rotates keys per message with Double Ratchet

2. **Weak Key Distribution**
   - Current: "MVP Solution: Database-backed key exchange"
   - Problem: Requires online members, server intermediation
   - Signal: X3DH works asynchronously, even if recipient offline

3. **No Message Authentication**
   - Current: No digital signatures on messages
   - Problem: Can't cryptographically verify sender
   - Signal: Ed25519 signatures on every message

4. **XSS Vulnerability**
   - Current: Private keys in plain IndexedDB
   - Problem: XSS attack = key theft = game over
   - Signal: SQLCipher encrypts entire database

5. **No Sender Anonymity**
   - Current: Server sees who messages whom
   - Problem: Metadata leakage
   - Signal: Sealed Sender hides sender from server

### Development Time Risk

**Current Plan:** 5 days just for encryption layer (Days 3-5)

**Reality Check:**
- Signal Protocol took PhD cryptographers years to design
- Implementing Double Ratchet correctly is complex
- Key distribution edge cases (offline, group changes) are subtle
- One mistake = catastrophic security failure

**Question:** Is 5 days realistic to build what took Signal's team years?

---

## What We Gain from Signal Fork

### 1. Signal Protocol (libsignal)

**Replaces 5 days of custom crypto work** with:
- Double Ratchet Algorithm (forward & backward secrecy)
- X3DH (Extended Triple Diffie-Hellman) for key agreement
- Sender Keys for efficient group messaging
- Ed25519 signatures for authentication
- Curve25519 for key exchange

### 2. Signal-Desktop Infrastructure

**Replaces weeks of infrastructure work** with:
- SQLCipher (encrypted database)
- Media encryption (attachment keys)
- Key management (stores keys securely)
- WebSocket protocol (real-time message delivery)
- Registration and session management

### 3. Proven Security

**Inherits 10+ years of:**
- Security audits
- Peer review
- Real-world hardening
- Bug fixes
- Community scrutiny

---

## What We Build on Top

**Orbital's Unique Value** (this is where we innovate):

1. **Threading Layer**
   - Convert Signal's linear chat → threaded discussions
   - Thread creation, reply hierarchy
   - Chronological display

2. **Forum UI**
   - Replace chat bubbles with thread cards
   - Keep Signal's media display components
   - Add markdown rendering

3. **Invite Codes**
   - Custom addition for easy group joining
   - Built on Signal's group infrastructure

4. **7-Day Media Relay**
   - Use Signal's media encryption
   - Add temporary server storage + quota limits
   - Keep permanent client storage model

---

## Revised 21-Day Timeline

### Week 1: Signal Foundation (Days 1-7)

**Days 1-3:** Fork Setup
- Fork Signal-Desktop, remove calling/stories/payments
- Extract core Signal Protocol modules
- Setup Node.js backend with Signal relay

**Days 4-7:** Threading Layer
- Add threads/replies PostgreSQL tables
- Thread creation API
- Modify UI: conversation view → thread view

### Week 2: Media & Polish (Days 8-14)

**Days 8-11:** Media Relay
- 7-day storage with Signal's encryption
- Upload/download with chunking
- Quota enforcement

**Days 12-14:** Production Ready
- Group management (invite codes)
- Security audit
- Deploy to DigitalOcean

### Week 3: Buffer (Days 15-21)

- Beta testing
- Bug fixes
- Performance tuning
- Family testing

**Total:** 21 days (vs 31 days original plan)

---

## Addressing Concerns

### "But we lose the simplicity of Vue with no build step"

**Response:**
- True, but security > convenience
- Build process is one-time setup cost
- TypeScript helps avoid bugs (type safety)
- React is widely known (easier to hire)

**Question:** Would you rather explain a build process or a security breach?

### "Signal-Desktop is a huge codebase"

**Response:**
- We extract only what we need (Signal Protocol, storage, crypto)
- Remove 60%+ of features (calling, stories, etc.)
- Days 1-3 dedicated to understanding and stripping down
- Once extracted, we maintain just the core

### "We're dependent on Signal"

**Response:**
- This is a feature, not a bug
- Signal Protocol is open-source and stable
- We benefit from their ongoing security work
- Can fork libsignal if needed (Rust, we control it)

**Alternative:** Depend on our own unaudited crypto implementation?

### "Our users don't need forward secrecy"

**Response:**
- **Families deserve the best security**, especially for private videos
- "Good enough" security is how breaches happen
- Signal's security is a competitive advantage
- If Signal is good enough for whistleblowers, it's good enough for families

---

## Key Decision Factors

### Choose Signal Fork If:
- ✅ You value security and reliability over simplicity
- ✅ You want to focus on product innovation (threading) not crypto
- ✅ You want faster time to market (21 vs 31 days)
- ✅ You're OK with a build process

### Choose Build From Scratch If:
- ⚠️ You absolutely need no-build deployment
- ⚠️ You're confident in implementing secure E2EE from scratch
- ⚠️ You have 6+ months for security audits post-launch
- ⚠️ You're willing to accept security risks

---

## Final Recommendation

**Fork Signal-Desktop.** Here's why:

1. **Security is non-negotiable** for family photos/videos
2. **Faster development** = sooner to market
3. **Lower risk** = higher confidence at launch
4. **Focus on innovation** where Orbital is unique (threading)

The original build-from-scratch plan is well-thought-out, but **E2EE is too important to reinvent**. Signal Protocol represents the collective work of top cryptographers over a decade. We should stand on their shoulders, not rebuild the foundation.

**Orbital's innovation** is threading for families, not cryptography. Let's use Signal for crypto and innovate on UX.

---

## Next Steps

### Immediate (Days 1-3)
1. ✅ Fork Signal-Desktop repository
2. ✅ Setup development environment
3. ✅ Remove unnecessary features
4. ✅ Extract core Signal Protocol modules
5. ✅ Setup Node.js backend with Signal relay endpoints

### Week 1 (Days 4-7)
6. ✅ Add threading data model to PostgreSQL
7. ✅ Build thread creation/listing APIs
8. ✅ Modify Signal UI for threaded view

### Week 2 (Days 8-14)
9. ✅ Integrate media relay with 7-day storage
10. ✅ Implement invite code system
11. ✅ Deploy MVP to production

### Week 3 (Days 15-21)
12. ✅ Beta test with families
13. ✅ Fix bugs and iterate
14. ✅ Launch v1.0

---

## Questions for Discussion

1. **Are we comfortable with a build process** in exchange for better security?
2. **Can we allocate Days 1-3** to understanding Signal's codebase?
3. **Do we want to support phone-based registration** (Signal's default) or modify to username-only?
4. **Should we maintain Signal compatibility** or break it for our use case?

**Recommendation:** Accept build process, allocate learning time, keep phone registration for MVP, break Signal compatibility (we don't need interop with Signal network).

---

## Documentation Updates Required

If we proceed with Signal fork, update these files:

- [ ] encryption-and-security.md → Replace with Signal Protocol docs
- [ ] frontend-architecture.md → Update to React + TypeScript
- [ ] api-specification.md → Add Signal envelope endpoints
- [ ] websocket-realtime.md → Document Signal's WebSocket protocol
- [ ] database-schema.md → Add signal_messages table
- [ ] deployment-operations.md → Add build process steps

---

## Full Analysis

For detailed technical analysis, see: [signal-fork-strategy.md](signal-fork-strategy.md)

---

**Decision Owner:** [Your Name]
**Stakeholders:** Engineering team, product
**Review Date:** [Today's date]
**Deadline for Decision:** [Set date]

---

## Approval

- [ ] Engineering Lead
- [ ] Product Owner
- [ ] Security Review (if applicable)

**Once approved, begin Phase 1 immediately.**
