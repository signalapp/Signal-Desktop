# Feature Removal Summary - Issue #3

## Current Status: ALL FEATURES STILL PRESENT

Issue #1 did NOT remove these features. All removal work remains to be done.

---

## What Needs to be Removed

| Feature | Files | Risk | Effort | Dependencies | DB Tables |
|---------|-------|------|--------|--------------|-----------|
| **Badges** | 22 | LOW | 2-3h | None | 2 |
| **Payments** | 211 | MEDIUM | 8-12h | 3 npm packages | 1 |
| **Stories** | 255 | MEDIUM-HIGH | 12-16h | None | 3 |
| **Calling** | 439 | HIGH | 20-30h | RingRTC (50MB) | 2 |
| **TOTAL** | **927** | - | **42-61h** | **4 packages** | **10 tables** |

---

## Recommended Order

```
1. Badges (22 files)
   └─> Smallest, safest, clear boundaries

2. Payments (211 files)
   └─> Medium complexity, no protocol impact

3. Stories (255 files)
   └─> More integrated, but still app-level

4. Calling (439 files)
   └─> Largest, most integrated, highest risk
```

---

## Key Locations

### Badges (REMOVE FIRST)
```
ts/badges/                          - Core module (8 files)
ts/state/ducks/badges.preload.ts    - Redux state
ts/services/badgeLoader.preload.ts  - Service
ts/axo/AxoBadge.dom.tsx            - UI component
```

### Payments (REMOVE SECOND)
```
ts/components/PaymentEventNotification.dom.tsx
ts/components/PreferencesDonations.dom.tsx
ts/state/ducks/donations.preload.ts
ts/services/donations.preload.ts
ts/messages/payments.std.ts
ts/sql/server/donationReceipts.std.ts
```

**Dependencies to remove:**
- `card-validator`
- `credit-card-type`
- `parsecurrency`

### Stories (REMOVE THIRD)
```
ts/state/ducks/stories.preload.ts
ts/state/ducks/storyDistributionLists.preload.ts
ts/state/smart/Stories*.tsx (3 components)
ts/services/storyLoader.preload.ts
ts/services/distributionListLoader.preload.ts
ts/util/*story*.ts (13+ utilities)
```

### Calling (REMOVE LAST)
```
ts/calling/                         - Core module (10 files)
ts/components/Call*.tsx             - 52 components
ts/components/Calling*.tsx          - 30 components
ts/state/ducks/calling.preload.ts   - Main Redux module
ts/services/calling.preload.ts      - Main service
ts/sql/server/callLinks.node.ts     - Database
calling_tools.html                  - HTML page
```

**Dependencies to remove:**
- `@signalapp/ringrtc` (LARGE: ~50MB native module)

---

## Critical Risks

### Calling Removal (Highest Risk)
- ⚠️ Touches almost every system (UI, state, services, protocol, database)
- ⚠️ Large native dependency (RingRTC)
- ⚠️ Call events in message timeline history
- ⚠️ Protocol integration (call signaling messages)
- ⚠️ Build configuration impact

### Stories Removal
- ⚠️ Story replies in message history
- ⚠️ Group "story mode" settings
- ⚠️ Distribution lists vs group management

### Payments Removal
- ⚠️ Payment messages in timeline history
- ⚠️ Need to handle existing payment receipts gracefully

### Badges Removal
- ✅ Low risk - mostly cosmetic
- ✅ Well isolated

---

## Signal Protocol Impact

| Feature | Protocol Impact | Risk to E2EE |
|---------|----------------|--------------|
| Badges | NONE | ✅ Zero |
| Payments | NONE | ✅ Zero |
| Stories | MINIMAL | ✅ Low (story replies only) |
| Calling | MODERATE | ⚠️ Medium (call signaling) |

**Critical:** Must ensure removal doesn't break core message encryption/decryption.

---

## Expected Outcomes

### Code Reduction
- **Files removed/modified:** ~927
- **Lines of code removed:** ~40k-60k (30-40% reduction)
- **Target final codebase:** ~130k-150k lines

### Build Improvements
- **Current build time:** ~90 seconds
- **Target build time:** <60 seconds (30-40% faster)
- **Bundle size reduction:** 20-30% smaller

### Dependencies
- **Current dependencies:** ~100+
- **Removing:** 4 packages
- **RingRTC alone:** ~50MB saved

---

## Testing Checklist

After each feature removal:
- [ ] `pnpm run build:dev` - Build succeeds
- [ ] `pnpm run check:types` - No TypeScript errors
- [ ] `pnpm run test-node` - Unit tests pass
- [ ] `pnpm run lint` - No lint errors
- [ ] Manual test - App launches
- [ ] Manual test - Send/receive messages
- [ ] Manual test - View history
- [ ] Manual test - Check preferences

---

## Rollback Plan

Create git tags before each removal:
```bash
git tag pre-badges-removal
git tag pre-payments-removal
git tag pre-stories-removal
git tag pre-calling-removal
```

Automatic backups saved to: `/scripts/cleanup/backups/`

Rollback: `git reset --hard pre-[feature]-removal`

---

## Timeline Estimate

### Conservative (61 hours = ~8 days solo)
- Day 1: Badges (3h)
- Days 2-3: Payments (12h)
- Days 4-5: Stories (16h)
- Days 6-8: Calling (30h)

### Optimistic (42 hours = ~5 days solo)
- Day 1: Badges (2h)
- Day 2: Payments (8h)
- Days 3-4: Stories (12h)
- Days 5-6: Calling (20h)

### With Team (Parallel work)
- Day 1: Badges + Payments (can be parallel)
- Days 2-3: Stories + Calling prep
- Days 4-5: Calling removal
- **Total: 5 days with 2-3 people**

---

## Available Tools

1. **Feature Analyzer**
   ```bash
   node scripts/cleanup/analyze-remaining-features.js
   ```
   - Scans codebase
   - Generates detailed report
   - Identifies all feature files

2. **Feature Remover**
   ```bash
   node scripts/cleanup/tools/remove-feature.js [feature] --dry-run
   ```
   - Safe removal with dry-run mode
   - Automatic backups
   - Rollback capability

3. **Component Analyzer**
   ```bash
   node scripts/cleanup/tools/analyze-components.js
   ```
   - Categorizes React components
   - Finds orphaned code

---

## Next Actions

1. **Review this summary** with the team
2. **Create separate GitHub issues** for each feature:
   - Issue #3.1: Remove Badges
   - Issue #3.2: Remove Payments
   - Issue #3.3: Remove Stories
   - Issue #3.4: Remove Calling
3. **Coordinate with Signal Protocol Specialist** before starting
4. **Set up test environment** with sample database
5. **Start with badges** (quick win, low risk)

---

## Documentation

- **Full Strategy:** `/scripts/cleanup/REMOVAL_STRATEGY.md` (detailed 4,000+ word document)
- **Analysis Report:** `/scripts/cleanup/removal-analysis.json` (machine-readable)
- **This Summary:** `/scripts/cleanup/REMOVAL_SUMMARY.md` (quick reference)

---

## Questions to Resolve

1. **Historical messages:** How to handle existing payment/call/story events in databases?
   - Option A: Keep in DB, skip rendering
   - Option B: Migrate to generic "unsupported message" type
   - **Recommendation:** Option A (safer, reversible)

2. **Protocol messages:** Should we keep handlers for incoming call/payment/story messages?
   - To support interop with Signal users?
   - **Recommendation:** Keep minimal handlers that ack but don't process

3. **Database migrations:** Remove old migrations or keep for historical DB compatibility?
   - **Recommendation:** Keep migrations, just remove code that uses those tables

4. **Build configuration:** Test RingRTC removal impact on webpack/esbuild?
   - **Recommendation:** Test in branch first

---

**Analysis completed:** 2025-11-07
**Tool used:** `/scripts/cleanup/analyze-remaining-features.js`
**Status:** Ready to begin removal work
