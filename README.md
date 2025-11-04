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
- Built for families, not corporations

**Why fork Signal?**
- Inherit 10+ years of battle-tested E2EE (Signal Protocol)
- Forward secrecy, sealed sender, proven security
- Focus our innovation on threading and family UX
- Save 10+ days of development time

Read the full architectural decision: [orbital-docs/ARCHITECTURE-DECISION.md](orbital-docs/ARCHITECTURE-DECISION.md)

---

## 📚 Documentation

**All Orbital-specific documentation lives in [`orbital-docs/`](orbital-docs/)**

### Start Here
1. **[Architecture Decision](orbital-docs/ARCHITECTURE-DECISION.md)** (10 min) - Why we're forking Signal
2. **[Signal Fork Strategy](orbital-docs/signal-fork-strategy.md)** (20 min) - Implementation plan & timeline
3. **[MVP Overview](orbital-docs/orbital-mvp-overview.md)** (15 min) - Product vision & goals

### Implementation Guides
- **[Database Schema](orbital-docs/database-schema.md)** - PostgreSQL schema for hybrid architecture
- **[Deployment & Operations](orbital-docs/deployment-operations.md)** - DigitalOcean deployment
- **[Testing Strategy](orbital-docs/testing-strategy.md)** - Testing approach
- **[Encryption & Security](orbital-docs/encryption-and-security.md)** - Signal Protocol integration
- **[API Specification](orbital-docs/api-specification.md)** - Backend API design
- **[Frontend Architecture](orbital-docs/frontend-architecture.md)** - React/TypeScript UI
- **[WebSocket & Real-Time](orbital-docs/websocket-realtime.md)** - Real-time updates

### GitHub Issues & Setup
- **[Issues](orbital-docs/Issues/ISSUES.md)** - 20 detailed implementation issues
- **[Setup Instructions](orbital-docs/Issues/SETUP-INSTRUCTIONS.md)** - GitHub project setup

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ LTS
- PostgreSQL 15+
- Git

### Development Setup

```bash
# Clone repository
git clone https://github.com/your-org/Orbital-Desktop.git
cd Orbital-Desktop

# Install dependencies
npm install

# Setup PostgreSQL
createdb orbital
psql orbital < orbital-docs/schema.sql

# Configure environment
cp .env.example .env
# Edit .env with your settings

# Start development server
npm run dev
```

For detailed setup instructions, see [orbital-docs/deployment-operations.md](orbital-docs/deployment-operations.md)

---

## 🛠️ Technology Stack

**Frontend:**
- React + TypeScript (from Signal-Desktop)
- SQLCipher (encrypted client storage)
- Signal Protocol (libsignal WASM)

**Backend:**
- Node.js + Express
- PostgreSQL 15+
- Signal Protocol message relay

**Encryption:**
- Signal Protocol (Double Ratchet, X3DH, Sender Keys)
- Media encryption with Signal's attachment keys
- Forward secrecy & sealed sender

---

## 📋 Development Timeline

**21-day MVP implementation:**
- **Week 1 (Days 1-7):** Signal foundation & threading layer
- **Week 2 (Days 8-14):** Media integration & deployment
- **Week 3 (Days 15-21):** Beta testing & iteration

See [orbital-docs/signal-fork-strategy.md](orbital-docs/signal-fork-strategy.md) for detailed timeline.

---

## 🤝 Contributing

We welcome contributions! Please:

1. Read [orbital-docs/ARCHITECTURE-DECISION.md](orbital-docs/ARCHITECTURE-DECISION.md) to understand our approach
2. Check [orbital-docs/Issues/ISSUES.md](orbital-docs/Issues/ISSUES.md) for available tasks
3. Follow Signal's code style (see [SIGNAL_README.md](SIGNAL_README.md))
4. Submit PRs to the `develop` branch

For Signal-Desktop specific contributions, see [Signal's Contributing Guide](SIGNAL_README.md#contributing-code).

---

## 🔐 Security & Privacy

**Orbital inherits Signal's security model:**
- End-to-end encryption for all content (Signal Protocol)
- Forward secrecy (keys rotate per message)
- Sealed sender (metadata protection)
- No server access to plaintext content

**Additional Orbital features:**
- Media relay (7-day server retention, permanent client storage)
- Storage quotas (10GB/100 files per group)
- Threading metadata (encrypted)

Security audits welcome! Report vulnerabilities privately to [security contact].

---

## 📦 Relationship to Signal

**This is a fork of [Signal-Desktop](https://github.com/signalapp/Signal-Desktop).**

- We use Signal's E2EE, crypto libraries, and core infrastructure
- We modify the UI for threading instead of chat
- We add custom features: threading, invite codes, media relay
- We do NOT connect to Signal's servers
- We do NOT maintain compatibility with Signal network

**For Signal-specific documentation:** See [SIGNAL_README.md](SIGNAL_README.md)

**Upstream Signal:** We track Signal's releases for security updates
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

- **Documentation:** [orbital-docs/](orbital-docs/)
- **Issues:** [GitHub Issues](https://github.com/your-org/Orbital-Desktop/issues)
- **Discussions:** [GitHub Discussions](https://github.com/your-org/Orbital-Desktop/discussions)

---

## 🎉 Project Status

**Current Phase:** Pre-implementation (planning complete, ready to fork)

**Next Steps:**
1. ✅ Fork Signal-Desktop repository
2. ⏳ Create GitHub Issues
3. ⏳ Begin Phase 1 implementation (Days 1-7)

**Target MVP Launch:** [Set date - 21 days from start]

---

**Built with ❤️ for families who deserve better social networks**
