# Orbital Project Documentation

**Architecture:** Signal-Desktop Fork + Custom Threading Layer

This directory contains all planning, design, and implementation documentation for Orbital.

---

## 🚀 Start Here

**New to the project? Read these in order:**

1. **[ARCHITECTURE-DECISION.md](ARCHITECTURE-DECISION.md)** (10 min)
   - Executive summary of why we're forking Signal
   - Quick comparison: Build vs Fork
   - Key benefits and trade-offs

2. **[signal-fork-strategy.md](signal-fork-strategy.md)** (20 min)
   - Detailed technical analysis
   - Revised 21-day implementation timeline
   - Component-by-component breakdown
   - Database schema for hybrid approach

3. **[orbital-mvp-overview.md](orbital-mvp-overview.md)** (15 min)
   - Original vision and goals (still valid!)
   - Success criteria
   - Product philosophy

---

## 📁 Active Documentation

### Architecture & Strategy
- **[ARCHITECTURE-DECISION.md](ARCHITECTURE-DECISION.md)** - Why we're forking Signal
- **[signal-fork-strategy.md](signal-fork-strategy.md)** - Complete implementation plan

### Vision & Goals
- **[orbital-mvp-overview.md](orbital-mvp-overview.md)** - Product vision, success criteria, philosophy

### Implementation Guides
- **[database-schema.md](database-schema.md)** - PostgreSQL schema (needs update for Signal messages)
- **[deployment-operations.md](deployment-operations.md)** - DigitalOcean deployment (mostly applicable)
- **[testing-strategy.md](testing-strategy.md)** - Testing philosophy and approach

---

## 📦 Archived Documentation

**[archive-build-from-scratch/](archive-build-from-scratch/)**

Contains original "build from scratch" documentation that has been superseded by the Signal fork approach:
- encryption-and-security.md (replaced by Signal Protocol)
- frontend-architecture.md (replaced by Signal-Desktop/React)
- api-specification.md (replaced by Signal relay + threading API)
- websocket-realtime.md (replaced by Signal's WebSocket)

Kept for historical reference only. **Not for implementation.**

---

## 🎯 Implementation Phases

Based on [signal-fork-strategy.md](signal-fork-strategy.md), here's the 21-day timeline:

### Week 1: Signal Foundation (Days 1-7)
- **Days 1-3:** Fork Signal-Desktop, extract core modules, setup backend
- **Days 4-7:** Build threading data model, modify UI for threaded view

### Week 2: Media & Polish (Days 8-14)
- **Days 8-11:** Media relay with Signal encryption, quotas
- **Days 12-14:** Group management, security audit, deploy

### Week 3: Buffer (Days 15-21)
- Beta testing, bug fixes, family testing

**See GitHub Issues for detailed task breakdown.**

---

## 🔧 What We're Building

### From Signal-Desktop (Fork & Adapt)
- ✅ Signal Protocol (E2EE with forward secrecy)
- ✅ libsignal (Rust crypto library)
- ✅ SQLCipher (encrypted database)
- ✅ Media encryption (attachment keys)
- ✅ WebSocket protocol
- ✅ Key management

### Custom Orbital Features (Build on Top)
- 🧵 Threading layer (convert chat → forum discussions)
- 🎨 Forum UI (thread cards, reply hierarchy)
- 🎟️ Invite codes (easy group joining)
- 📹 7-day media relay (temporary server + permanent client)
- 📊 Storage quotas (10GB/100 files per group)

---

## 📊 Documentation Status

| Document | Status | Notes |
|----------|--------|-------|
| ARCHITECTURE-DECISION.md | ✅ Current | Executive summary |
| signal-fork-strategy.md | ✅ Current | Implementation plan |
| orbital-mvp-overview.md | ✅ Current | Vision still valid |
| database-schema.md | ⚠️ Needs Update | Add Signal messages table |
| deployment-operations.md | ⚠️ Needs Update | Add build process steps |
| testing-strategy.md | ⚠️ Needs Update | Update for React/TypeScript |

---

## 🔄 Next Steps

1. ✅ Architecture decision approved
2. ⏳ **Create GitHub Issues** (in progress)
3. ⏳ Fork Signal-Desktop repository
4. ⏳ Begin Phase 1 implementation

---

## 📝 Contributing to Documentation

When updating docs:
- Keep vision and goals in orbital-mvp-overview.md
- Keep technical strategy in signal-fork-strategy.md
- Update implementation guides as we learn
- Archive outdated content, don't delete

---

## 🆘 Questions?

- **Vision/Product:** See orbital-mvp-overview.md
- **Architecture:** See ARCHITECTURE-DECISION.md
- **Implementation:** See signal-fork-strategy.md
- **Original Plan:** See archive-build-from-scratch/ (reference only)

---

**Last Updated:** 2025-11-04
**Current Phase:** Pre-implementation (planning complete, ready to fork)
