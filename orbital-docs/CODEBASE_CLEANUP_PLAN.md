# Signal Codebase Cleanup Plan

## Executive Summary

The Signal-Desktop fork contains 319,213 lines of TypeScript across 2,405 files. This document outlines our 4-day cleanup sprint to remove 40-60% of unnecessary Signal features while preserving core encryption functionality for the Orbital MVP launch on November 26.

## Current State Analysis

### Codebase Metrics
- **Total Size**: 319,213 lines of TypeScript
- **Files**: 2,405 TypeScript files
- **Components**: 400+ React components
- **Dependencies**: 100+ npm packages
- **Build Time**: >2 minutes
- **Signal Version**: 7.80.0-alpha.1

### Features to Remove
1. **Voice/Video Calling** (~40,000 lines)
   - `/ts/calling/` directory
   - `@signalapp/ringrtc` dependency
   - Calling UI components

2. **Stories** (~15,000 lines)
   - All `Stories*.tsx` components
   - Story composer and viewer

3. **Payment System** (~10,000 lines)
   - MobileCoin integration
   - Payment UI components
   - Payment database tables

4. **Sticker Creator** (~5,000 lines)
   - `/sticker-creator/` directory
   - Standalone app

5. **Phone Number Verification** (~8,000 lines)
   - SMS verification flow
   - Phone number registration

6. **Device Linking** (~5,000 lines)
   - QR code scanning
   - Multi-device sync

### Features to Preserve
- **Signal Protocol encryption** (core requirement)
- **SQLCipher database** (encrypted storage)
- **Message composition and display** (adapt for threads)
- **Media handling** (images, files, links)
- **WebSocket connection** (real-time updates)
- **Basic authentication** (adapt to username-based)

## Team Structure

### Core Cleanup Team
1. **Codebase Archaeologist** (Temporary Lead)
   - Automated analysis and tool creation
   - Dependency mapping
   - Safe removal scripts

2. **Frontend/UI-UX Engineer**
   - React component removal
   - UI simplification
   - Component adaptation

3. **Backend/Database Engineer**
   - Backend feature removal
   - Database cleanup
   - Auth simplification

4. **Signal Protocol Specialist**
   - Protocol preservation
   - Core module extraction
   - Encryption verification

### Support Team
- **DevOps/Infrastructure Engineer**: Build optimization
- **QA/Testing Specialist**: Continuous verification
- **Security Auditor**: Final security validation
- **Project Manager**: Coordination and tracking

## 4-Day Execution Plan

### Day 1: Analysis & Quick Wins

#### Morning (4 hours)
**Lead**: Codebase Archaeologist

1. **Setup Infrastructure**
   ```bash
   git checkout -b feature/orbital-cleanup
   mkdir -p scripts/cleanup/{reports,backups,tools}
   npm install --save-dev madge webpack-bundle-analyzer ts-morph depcheck
   ```

2. **Create Analysis Tools**
   - `scripts/analyze-components.js` - Component inventory
   - `scripts/find-dead-code.js` - Unused code detection
   - `scripts/generate-dep-graph.js` - Dependency visualization

3. **Run Comprehensive Analysis**
   ```bash
   node scripts/analyze-components.js > reports/component-inventory.json
   npx madge --circular --image reports/deps.svg ts/
   npx webpack-bundle-analyzer build/stats.json
   ```

#### Afternoon (4 hours)
**Lead**: Frontend/UI-UX Engineer + Archaeologist

4. **Surface-Level Removals**
   - Remove `/sticker-creator/` directory
   - Remove Stories components (`ts/components/Stories*.tsx`)
   - Remove Payment UI components
   - Remove obvious Calling UI components

5. **Verification**
   ```bash
   pnpm test
   pnpm build:dev
   git tag cleanup-day1-complete
   ```

**Expected Reduction**: 10-15% (~30,000-45,000 lines)

### Day 2: Backend Feature Removal

#### Morning (4 hours)
**Lead**: Backend/Database Engineer + Archaeologist

1. **Remove Calling Infrastructure**
   ```bash
   # Impact analysis
   node scripts/remove-feature.js --feature=calling --dry-run

   # Execute removal
   rm -rf ts/calling/
   npm uninstall @signalapp/ringrtc
   ```

2. **Remove Payment System**
   - Delete payment backend logic
   - Remove MobileCoin integration
   - Clean payment tables from database

#### Afternoon (4 hours)
3. **Simplify Authentication**
   - Remove phone number verification
   - Stub username-based auth
   - Remove SMS providers

4. **Database Cleanup**
   - Remove unused tables
   - Simplify schema
   - Update migrations

**Expected Reduction**: 25-30% total (~80,000-95,000 lines)

### Day 3: Build Optimization & Restructuring

#### Morning (4 hours)
**Lead**: DevOps/Infrastructure Engineer + Archaeologist

1. **Build System Simplification**
   ```bash
   # Remove Storybook
   npm uninstall @storybook/react @storybook/addon-*
   rm -rf .storybook/ stories/

   # Consolidate webpack configs
   node scripts/merge-webpack-configs.js

   # Remove unused dependencies
   npx depcheck --json | node scripts/remove-unused-deps.js
   ```

2. **Dependency Pruning**
   - Remove unused npm packages
   - Update outdated dependencies
   - Consolidate duplicate packages

#### Afternoon (4 hours)
**Lead**: Archaeologist

3. **Module Restructuring**
   ```bash
   # Create new structure
   mkdir -p orbital-core/{signal-protocol,components,utils,database}

   # Extract core modules
   node scripts/extract-core-modules.js

   # Update import paths
   node scripts/update-imports.js --new-structure
   ```

4. **Component Organization**
   - Move reusable components to `/orbital-core/components/`
   - Archive Signal-specific components
   - Create component index

**Expected Reduction**: 40% total (~130,000 lines)

### Day 4: Core Extraction & Verification

#### Morning (4 hours)
**Lead**: Signal Protocol Specialist + Archaeologist

1. **Signal Protocol Isolation**
   ```bash
   # Identify protocol dependencies
   node scripts/find-protocol-deps.js > reports/protocol-deps.json

   # Extract core protocol
   node scripts/extract-protocol.js --target=orbital-core/signal-protocol

   # Verify extraction
   pnpm test:protocol
   ```

2. **Create Protocol Test Suite**
   - Encryption/decryption tests
   - Key exchange verification
   - Message handling tests
   - Database encryption tests

#### Afternoon (4 hours)
**Lead**: Security Auditor + QA Specialist

3. **Security Verification**
   - Audit extracted modules
   - OWASP dependency check
   - Verify no credentials exposed
   - Check for security anti-patterns

4. **Final Integration Testing**
   ```bash
   # Full build
   pnpm build:prod

   # Run all tests
   pnpm test

   # Smoke tests
   node scripts/smoke-test.js

   # Tag final state
   git tag cleanup-complete
   ```

**Final Reduction**: 40-60% (~130,000-190,000 lines)

## Scripts and Tools

### 1. Component Analyzer
**File**: `scripts/analyze-components.js`
```javascript
// Analyzes React components for usage and dependencies
// Outputs: component-inventory.json
// Categories: KEEP, REMOVE, ADAPT, UNKNOWN
```

### 2. Feature Removal Tool
**File**: `scripts/remove-feature.js`
```javascript
// Safe feature removal with dry-run mode
// Usage: node scripts/remove-feature.js --feature=calling --dry-run
// Features: calling, stories, payments, stickers, phone-auth
```

### 3. Dependency Graph Generator
**File**: `scripts/generate-dep-graph.js`
```javascript
// Creates interactive dependency visualization
// Outputs: dependency-graph.html
// Identifies circular dependencies
```

### 4. Import Path Updater
**File**: `scripts/update-imports.js`
```javascript
// Updates all imports after module moves
// Handles relative and absolute paths
// Creates backup before changes
```

### 5. Dead Code Detector
**File**: `scripts/find-dead-code.js`
```javascript
// Identifies unused code
// Outputs: dead-code-report.json
// Includes exports, functions, components
```

## Risk Management

### Rollback Strategy
```bash
# Before each major removal
git tag pre-removal-[feature]
git push origin --tags

# If removal breaks functionality
git reset --hard pre-removal-[feature]
```

### Testing Protocol
- Run tests after EVERY removal
- Keep test suite green throughout
- Create smoke tests for critical paths
- Document any temporarily disabled tests

### Communication Plan
- **9:00 AM**: Daily standup (15 min)
- **12:00 PM**: Progress check
- **5:00 PM**: End-of-day commit and tag
- **Blockers**: Immediate Slack/Discord notification

## Success Metrics

### Minimum Viable Cleanup (Must Have)
- [ ] App compiles and runs
- [ ] Signal Protocol encryption works
- [ ] 30% minimum code reduction
- [ ] All tests passing
- [ ] Build time <1 minute

### Target Goals (Should Have)
- [ ] 40-50% code reduction
- [ ] Build time <30 seconds
- [ ] Clean module boundaries
- [ ] Comprehensive documentation
- [ ] 30% dependency reduction

### Stretch Goals (Nice to Have)
- [ ] 60% code reduction
- [ ] Build time <15 seconds
- [ ] Zero npm audit warnings
- [ ] 100% test coverage for core
- [ ] Automated cleanup scripts for future use

## Daily Checkpoints

### Day 1 Checkpoint
- [ ] Analysis tools created
- [ ] Component inventory complete
- [ ] Surface removals done (10-15% reduction)
- [ ] Tests passing

### Day 2 Checkpoint
- [ ] Calling infrastructure removed
- [ ] Payment system removed
- [ ] Auth simplified
- [ ] 25-30% reduction achieved

### Day 3 Checkpoint
- [ ] Build system optimized
- [ ] Dependencies reduced
- [ ] Modules restructured
- [ ] 40% reduction achieved

### Day 4 Checkpoint
- [ ] Signal Protocol isolated
- [ ] Security audit complete
- [ ] All tests passing
- [ ] 40-60% final reduction

## Post-Cleanup Actions

### Documentation
1. Create `REMOVED_FEATURES.md`
2. Update `README.md` with Orbital info
3. Document new module structure
4. Archive analysis reports

### Knowledge Transfer
1. Archaeologist transfers tools to DevOps
2. Document lessons learned
3. Create maintenance guide
4. Record cleanup patterns for future

### GitHub Updates
1. Close cleanup issues (#2, #3)
2. Create tech debt issues for remaining cleanup
3. Update project milestones
4. Merge cleanup branch to main

## Contingency Plans

### If Behind Schedule
- Accept 30% reduction instead of 40-60%
- Focus on UI removal, defer backend cleanup
- Document remaining work as tech debt
- Prioritize Signal Protocol integrity over reduction

### If Breaking Changes Found
- Immediate rollback to last working tag
- Reassess removal strategy
- Smaller, incremental removals
- More thorough testing between changes

### If Team Blocked
- Project Manager escalates immediately
- Pull in additional expertise if needed
- Consider "Orbital-First" approach (fresh start)
- Document blockers for post-MVP resolution

## Appendix: File Structure After Cleanup

```
Orbital-Desktop/
├── orbital-core/              # New: Extracted core modules
│   ├── signal-protocol/       # Signal encryption (preserved)
│   ├── components/            # Reusable React components
│   ├── database/             # SQLCipher integration
│   └── utils/                # Shared utilities
├── ts/                       # Reduced Signal codebase
│   ├── components/           # ~200 components (from 400+)
│   ├── state/               # Redux store (simplified)
│   └── util/                # Utilities
├── orbital-backend/          # New: Orbital-specific backend
│   ├── threading/           # Thread management
│   ├── api/                # REST/WebSocket APIs
│   └── models/             # Data models
├── app/                    # Electron main process
├── scripts/                # Build and cleanup scripts
│   └── cleanup/           # Cleanup tools and reports
└── orbital-docs/          # Orbital documentation
```

## Approval and Sign-off

- [ ] **Codebase Archaeologist**: Plan reviewed and feasible
- [ ] **Project Manager**: Timeline and resources approved
- [ ] **Signal Protocol Specialist**: Protocol preservation verified
- [ ] **Team Lead**: Overall approach approved

---

**Document Version**: 1.0
**Created**: November 5, 2024
**Last Updated**: November 5, 2024
**Status**: Ready for Execution