# Orbital Desktop

**A private social network for families, built on Signal's proven E2EE foundation**

Orbital transforms Signal's chat into threaded discussions for small groups. Share full-quality family videos that relay through servers for 7 days, then live permanently on family devices. No ads, no algorithms, no surveillance.

---

## 🎯 Project Overview

**What is Orbital?**
- Threaded discussions instead of linear chat
- Signal-grade end-to-end encryption
- Full-quality video/photo sharing (up to 500MB)
- 7-day server relay + permanent client storage
- Distributed backup: Your orbit holds your memories
- Built for families, not corporations

**Why fork Signal?**
- Inherit 10+ years of battle-tested E2EE (Signal Protocol)
- Forward secrecy, sealed sender, proven security
- Focus our innovation on threading and family UX
- 40-60% codebase reduction (stories, stickers, payments removed)

**Current Status:** Active development - Signal fork cleanup complete (Phase 1D), implementing threading features.

---

## 📚 Essential Documentation

**All Orbital-specific documentation lives in [`planning-docs/`](planning-docs/)** (local-only, not in git)

### Start Here - Read in This Order

1. **[Product Requirements Document](planning-docs/PRODUCT-REQUIREMENTS-DOCUMENT.md)** (20 min)
   - **Single source of truth** for all product decisions
   - Complete product vision, user journeys, and MVP scope
   - Target launch: 2025-11-26
   - All team members reference this as the master document

2. **[Signal Fork Strategy](planning-docs/signal-fork-strategy.md)** (20 min)
   - Complete implementation plan and 21-day timeline
   - Technical architecture and component breakdown
   - Database schema for hybrid approach

3. **[Branch Strategy](planning-docs/BRANCH_STRATEGY.md)** (10 min)
   - Git workflow and branch management
   - Feature development process
   - Upstream Signal tracking

### Additional Documentation

**Architecture & Strategy:**
- **[ARCHITECTURE-DECISION.md](planning-docs/ARCHITECTURE-DECISION.md)** - Why we're forking Signal
- **[orbital-mvp-overview.md](planning-docs/orbital-mvp-overview.md)** - Product vision & goals
- **[CODEBASE_CLEANUP_PLAN.md](planning-docs/CODEBASE_CLEANUP_PLAN.md)** - Phase 1 cleanup strategy (✅ completed)

**Implementation Guides:**
- **[database-schema.md](planning-docs/database-schema.md)** - PostgreSQL schema
- **[testing-strategy.md](planning-docs/testing-strategy.md)** - Testing approach
- **[deployment-operations.md](planning-docs/deployment-operations.md)** - DigitalOcean deployment
- **[encryption-and-security.md](planning-docs/encryption-and-security.md)** - Signal Protocol integration
- **[api-specification.md](planning-docs/api-specification.md)** - Backend API design
- **[frontend-architecture.md](planning-docs/frontend-architecture.md)** - React/TypeScript UI
- **[websocket-realtime.md](planning-docs/websocket-realtime.md)** - Real-time updates

---

## 🔧 Project Management

**We use GitHub Issues for all project management and task tracking.**

- **Issues** - All features, tasks, and bugs tracked in GitHub Issues
- **Milestones** - Organized by development phases (Phase 1, Phase 2, etc.)
- **Pull Requests** - All changes reviewed and merged to `develop` branch
- **Branch Strategy** - See [BRANCH_STRATEGY.md](planning-docs/BRANCH_STRATEGY.md) for workflow

**Current Milestone:** Phase 2 - Threading Implementation

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ LTS
- PostgreSQL 15+
- Git

### Development Setup

```bash
# Clone repository
git clone https://github.com/alexg-g/Orbital-Desktop.git
cd Orbital-Desktop

# Install dependencies
pnpm install

# Setup PostgreSQL (coming soon)
# createdb orbital
# psql orbital < schema.sql

# Configure environment
cp .env.example .env
# Edit .env with your settings

# Start development
pnpm start
```

For detailed setup, see [planning-docs/deployment-operations.md](planning-docs/deployment-operations.md)

---

## 🛠️ Technology Stack

**Frontend (Inherited from Signal):**
- React + TypeScript
- Electron
- SQLCipher (encrypted client storage)
- Signal Protocol (libsignal WASM)

**Backend (Custom):**
- Node.js + Express
- PostgreSQL 15+
- Signal Protocol message relay

**Encryption:**
- Signal Protocol (Double Ratchet, X3DH, Sender Keys)
- Media encryption with attachment keys
- Forward secrecy & sealed sender

---

## 📋 Development Progress

### ✅ Completed (Phase 1)
- Fork Signal-Desktop repository
- Cleanup: Remove stories, stickers, donation features (40-60% reduction)
- Achieve zero TypeScript errors (88 → 0)
- Establish branch strategy and workflow
- Setup project documentation

### 🔄 In Progress (Phase 2)
- Threading data model implementation
- Thread UI components
- Backend API for threading

### ⏳ Upcoming (Phase 3+)
- Media relay with 7-day retention
- Distributed backup system
- Group management with invite codes
- Production deployment

See **GitHub Issues** for detailed task breakdown.

---

## 🤝 Contributing

We welcome contributions! Please:

1. Read [PRODUCT-REQUIREMENTS-DOCUMENT.md](planning-docs/PRODUCT-REQUIREMENTS-DOCUMENT.md) to understand our vision
2. Review [BRANCH_STRATEGY.md](planning-docs/BRANCH_STRATEGY.md) for workflow
3. Check GitHub Issues for available tasks
4. Follow Signal's code style (see [SIGNAL_README.md](SIGNAL_README.md))
5. Submit PRs to the `develop` branch

For Signal-Desktop specific contributions, see [SIGNAL_README.md](SIGNAL_README.md).

---

## 🔐 Security & Privacy

**Orbital inherits Signal's security model:**
- End-to-end encryption for all content (Signal Protocol)
- Forward secrecy (keys rotate per message)
- Sealed sender (metadata protection)
- No server access to plaintext content

**Additional Orbital features:**
- Media relay (7-day server retention, permanent client storage)
- Distributed backup (your orbit holds your memories)
- Storage quotas (10GB/100 files per group)
- Threading metadata (encrypted)

Security audits welcome! Report vulnerabilities privately to [security contact].

---

## 📦 Relationship to Signal

**This is a fork of [Signal-Desktop](https://github.com/signalapp/Signal-Desktop).**

- ✅ We use Signal's E2EE, crypto libraries, and core infrastructure
- ✅ We modify the UI for threading instead of chat
- ✅ We add custom features: threading, invite codes, media relay
- ❌ We do NOT connect to Signal's servers
- ❌ We do NOT maintain compatibility with Signal network

**For Signal-specific documentation:** See [SIGNAL_README.md](SIGNAL_README.md)

**Upstream Signal tracking:**
```bash
# Signal upstream is tracked as remote
git remote add signal-upstream https://github.com/signalapp/Signal-Desktop.git
git fetch signal-upstream
```

---

## 📄 License

**Orbital-specific code:** GNU AGPLv3 (same as Signal)

**Signal Desktop code:** Copyright 2013-2024 Signal Messenger, LLC
Licensed under GNU AGPLv3: https://www.gnu.org/licenses/agpl-3.0.html

See [LICENSE](LICENSE) for full text.

---

## 🆘 Support & Questions

- **Documentation:** [planning-docs/](planning-docs/)
- **Issues:** [GitHub Issues](https://github.com/alexg-g/Orbital-Desktop/issues)
- **PRD (Product Requirements):** [PRODUCT-REQUIREMENTS-DOCUMENT.md](planning-docs/PRODUCT-REQUIREMENTS-DOCUMENT.md)

---

## 🎉 Project Timeline

**Target MVP Launch:** 2025-11-26 (21 days from kickoff)

**Development Phases:**
- ✅ **Phase 1 (Days 1-7):** Cleanup & Foundation
- 🔄 **Phase 2 (Days 8-14):** Threading Implementation
- ⏳ **Phase 3 (Days 15-21):** Media, Deployment & Testing

**Current Phase:** Phase 2 - Threading Implementation

---

**Built with ❤️ for families who deserve better social networks**
