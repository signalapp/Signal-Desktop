# Orbital Branch Strategy

**Branch Management:** Guide for working with Orbital's forked Signal repository.

---

## Branch Structure

```
Orbital-Desktop Repository
├── claude/orbital-repo-restructure-*  (Current feature branch)
├── develop                             (Integration branch)
├── main (future)                       (Production releases)
└── signal-upstream/main                (Track Signal updates)
```

---

## Remotes

### origin (Orbital Repository)

**URL:** `http://local_proxy@127.0.0.1:36788/git/alexg-g/Orbital-Desktop`

**Purpose:** Orbital's forked repository

**Branches:**
- `claude/orbital-repo-restructure-*` - Current feature work
- `develop` - Integration branch for Orbital features
- `main` (future) - Production releases

---

### signal-upstream (Signal-Desktop)

**URL:** `https://github.com/signalapp/Signal-Desktop.git`

**Purpose:** Track Signal's upstream repository for security updates and improvements

**Branches:**
- `signal-upstream/main` - Signal's main branch

---

## Branch Workflow

### Feature Development

**1. Create Feature Branch from `develop`:**

```bash
git checkout develop
git pull origin develop
git checkout -b feature/my-feature-name
```

**2. Develop and Commit:**

```bash
# Make changes
git add .
git commit -m "feat: add feature description"
```

**3. Push to Origin:**

```bash
git push -u origin feature/my-feature-name
```

**4. Create Pull Request:**
- Base: `develop`
- Compare: `feature/my-feature-name`

---

### Integration (develop branch)

**Purpose:** Integration branch for all Orbital-specific features

**Usage:**
- Merge feature branches here
- Test integration before merging to main
- Keep synchronized with main

**Merge Feature to Develop:**

```bash
git checkout develop
git merge feature/my-feature-name
git push origin develop
```

---

### Production Releases (main branch - future)

**Purpose:** Production-ready code

**Usage:**
- Only merge from `develop` after thorough testing
- Tag releases (e.g., `v1.0.0`, `v1.1.0`)
- Deploy to production from this branch

**Release Process:**

```bash
# Merge develop to main
git checkout main
git merge develop

# Tag release
git tag -a v1.0.0 -m "Release version 1.0.0"

# Push to origin
git push origin main --tags
```

---

## Tracking Signal Upstream

### Why Track Signal?

- **Security Updates:** Critical security patches
- **Bug Fixes:** Fixes for Signal Protocol or infrastructure
- **New Features:** Potentially useful Signal features to adapt

### Fetching Signal Updates

```bash
# Fetch Signal updates (without merging)
git fetch signal-upstream

# View Signal's commits
git log signal-upstream/main --oneline -20

# View diff between Orbital and Signal
git diff develop signal-upstream/main
```

### Merging Signal Updates

**⚠️ IMPORTANT:** Merging Signal updates requires careful review to avoid breaking Orbital-specific features.

**Process:**

1. **Create Merge Branch:**

```bash
git checkout develop
git checkout -b merge/signal-update-YYYY-MM-DD
```

2. **Merge Signal Main:**

```bash
git merge signal-upstream/main
```

3. **Resolve Conflicts:**

Signal updates may conflict with Orbital changes, especially in:
- UI components (we modified for threading)
- Database schema (we added custom tables)
- Build configuration

**Review conflicts carefully:**

```bash
# Check conflicted files
git status

# Resolve conflicts manually
# Keep Orbital changes for threading UI
# Accept Signal changes for security/crypto
```

4. **Test Thoroughly:**

```bash
# Run all tests
npm test

# Test manually:
# - Threading still works
# - Media upload/download
# - Encryption intact
# - Signal Protocol working
```

5. **Merge to Develop:**

```bash
git checkout develop
git merge merge/signal-update-YYYY-MM-DD
git push origin develop
```

---

## Branch Naming Conventions

### Feature Branches

```bash
feature/<issue-number>-<short-description>
```

**Examples:**
- `feature/1-fork-signal-desktop`
- `feature/6-thread-data-model`
- `feature/8-media-relay`

### Bug Fix Branches

```bash
fix/<issue-number>-<short-description>
```

**Examples:**
- `fix/23-thread-decryption-error`
- `fix/45-media-upload-timeout`

### Signal Merge Branches

```bash
merge/signal-update-YYYY-MM-DD
```

**Examples:**
- `merge/signal-update-2024-11-15`
- `merge/signal-security-patch-2024-12-01`

### Release Branches

```bash
release/vX.Y.Z
```

**Examples:**
- `release/v1.0.0`
- `release/v1.1.0`

---

## GitHub Issues Integration

**Link commits to issues:**

```bash
# Reference issue in commit
git commit -m "feat: implement thread listing (#6)"

# Close issue with commit
git commit -m "fix: resolve decryption error (closes #23)"
```

**Link PR to issues:**

In PR description:
```markdown
Closes #6
Closes #7

This PR implements the threading layer as described in issues #6 and #7.
```

---

## Protected Branch Rules (Future)

**When setting up main/develop as protected:**

**develop branch:**
- ✅ Require pull request before merging
- ✅ Require 1 approval (for team collaboration)
- ✅ Require status checks to pass (CI/CD)
- ❌ Don't require linear history (allow merge commits)

**main branch:**
- ✅ Require pull request before merging
- ✅ Require 2 approvals (higher bar for production)
- ✅ Require status checks to pass
- ✅ Require branches to be up to date
- ✅ Require linear history (rebase before merge)
- ✅ Lock branch (admins only for hotfixes)

---

## Signal Update Schedule

**Recommended Schedule:**

- **Weekly Review:** Check Signal commits for security updates
- **Monthly Merge:** Merge non-breaking Signal updates
- **Immediate:** Security patches (as soon as announced)
- **Quarterly:** Major Signal version updates (after thorough testing)

**Monitoring Signal:**

```bash
# Add to crontab (weekly check)
0 9 * * 1 cd /path/to/Orbital-Desktop && git fetch signal-upstream && git log signal-upstream/main --oneline --since="7 days ago" | mail -s "Signal Updates" team@orbital.com
```

**Or use GitHub notifications:**
1. Watch Signal-Desktop repository
2. Enable notifications for releases only
3. Review release notes for security updates

---

## Workflow Diagram

```
┌─────────────────────────────────────────┐
│  Signal-Desktop (upstream)              │
│  github.com/signalapp/Signal-Desktop    │
└──────────────┬──────────────────────────┘
               │ Fetch periodically
               ↓
┌─────────────────────────────────────────┐
│  signal-upstream/main (local tracking)  │
└──────────────┬──────────────────────────┘
               │ Merge carefully
               ↓
┌─────────────────────────────────────────┐
│  develop (integration branch)           │
│  - Merge feature branches               │
│  - Merge Signal updates                 │
│  - Test before main                     │
└──────────────┬──────────────────────────┘
               │ Merge after testing
               ↓
┌─────────────────────────────────────────┐
│  main (production releases)             │
│  - Tagged releases only                 │
│  - Deploy to production                 │
└─────────────────────────────────────────┘

Feature Branches:
┌─────────────────────────────────────────┐
│  feature/1-threading                    │
└──────────────┬──────────────────────────┘
               │ PR + merge
               ↓
┌─────────────────────────────────────────┐
│  develop                                │
└─────────────────────────────────────────┘
```

---

## Common Commands Cheat Sheet

```bash
# Setup remotes (one-time)
git remote add signal-upstream https://github.com/signalapp/Signal-Desktop.git

# Start new feature
git checkout develop
git pull origin develop
git checkout -b feature/123-my-feature

# Commit changes
git add .
git commit -m "feat: description (#123)"
git push -u origin feature/123-my-feature

# Update feature branch with develop
git checkout feature/123-my-feature
git fetch origin
git rebase origin/develop

# Check Signal updates
git fetch signal-upstream
git log signal-upstream/main --oneline -10

# Merge Signal update
git checkout develop
git checkout -b merge/signal-update-$(date +%Y-%m-%d)
git merge signal-upstream/main
# Resolve conflicts, test
git push origin merge/signal-update-$(date +%Y-%m-%d)

# Release to production
git checkout main
git merge develop
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin main --tags
```

---

## Next Steps

1. ✅ **Current:** Feature work on `claude/orbital-repo-restructure-*`
2. ⏭️ **Next:** Create GitHub issues (20 issues from `orbital-docs/Issues/ISSUES.md`)
3. ⏭️ **Then:** Start Phase 1 implementation (Issue #1-7)
4. ⏭️ **Future:** Set up CI/CD with branch protection

---

## Related Documentation

- **[Signal Fork Strategy](signal-fork-strategy.md)** - Why we forked Signal
- **[Issues](Issues/ISSUES.md)** - Implementation issues for GitHub
- **[Setup Instructions](Issues/SETUP-INSTRUCTIONS.md)** - GitHub project setup

---

**Last Updated:** 2025-11-04
**Current Branch:** `claude/orbital-repo-restructure-011CUoPL4nBQqtipL9CfK3i6`
**Remotes:** `origin` (Orbital) + `signal-upstream` (Signal)
