# Feature Removal Strategy for Orbital-Desktop
## Issue #3: Remove Unnecessary Signal Features

**Analysis Date:** 2025-11-07
**Codebase:** Signal-Desktop Fork for Orbital
**Analysis Tool:** `/scripts/cleanup/analyze-remaining-features.js`

---

## Executive Summary

All four target features are **STILL PRESENT** in the codebase. Issue #1 did NOT remove these features.

### Features to Remove:
1. **Badges** - 22 files (LOW RISK)
2. **Payments/Donations** - 211 files (MEDIUM RISK)
3. **Stories** - 255 files (MEDIUM-HIGH RISK)
4. **Calling/Video** - 439 files (HIGH RISK)

**Total Impact:** 927 files will be removed or modified

---

## Feature Analysis

### 1. BADGES (22 files) - REMOVE FIRST
**Status:** PRESENT
**Risk Level:** LOW
**Estimated Effort:** 2-3 hours

#### Key Components:
- **Directory:** `/ts/badges/` (8 TypeScript modules)
- **State Management:**
  - `ts/state/ducks/badges.preload.ts`
  - `ts/state/selectors/badges.preload.ts`
- **Services:** `ts/services/badgeLoader.preload.ts`
- **Types:** `ts/types/GiftBadgeStates.std.ts`
- **UI:** `ts/axo/AxoBadge.dom.tsx`

#### Database Impact:
- Tables: `badges`, `badgeImageFiles`
- No migrations to remove

#### Dependencies:
- None (no external packages)

#### Removal Strategy:
1. Remove `/ts/badges/` directory
2. Remove badge-related Redux state
3. Remove badge loader service
4. Remove badge UI component
5. Update database schema to drop badge tables
6. Search and remove all badge references in:
   - Conversation details
   - User profiles
   - Message rendering

#### Risk Assessment:
- **Low integration** - Badges are mostly cosmetic
- **No Signal Protocol impact**
- **Clear boundaries** - Well-isolated module

---

### 2. PAYMENTS/DONATIONS (211 files) - REMOVE SECOND
**Status:** PRESENT
**Risk Level:** MEDIUM
**Estimated Effort:** 8-12 hours

#### Key Components:
- **Components:**
  - `ts/components/PaymentEventNotification.dom.tsx`
  - `ts/components/DonationsErrorBoundary.dom.tsx`
  - `ts/components/PreferencesDonations.dom.tsx`
- **State Management:**
  - `ts/state/ducks/donations.preload.ts`
  - `ts/state/smart/PreferencesDonations.preload.tsx`
- **Services:**
  - `ts/services/donations.preload.ts`
  - `ts/services/donationsLoader.preload.ts`
- **Backend:**
  - `ts/sql/server/donationReceipts.std.ts`
  - `ts/messages/payments.std.ts`
- **Types:**
  - `ts/types/Payment.std.ts`
  - `ts/types/Donations.std.ts`
- **Utilities:**
  - `ts/util/currency.dom.ts`
  - `ts/util/generateDonationReceipt.dom.ts`
  - `ts/util/subscriptionConfiguration.preload.ts`

#### Database Impact:
- Tables: `donationReceipts`
- Migrations to remove:
  - `1380-donation-receipts.std.ts`
  - `1400-simplify-receipts.std.ts`

#### Dependencies to Remove:
```json
{
  "card-validator": "10.0.3",
  "credit-card-type": "10.0.2",
  "parsecurrency": "1.1.1"
}
```

#### Removal Strategy:
1. Remove payment/donation components from Preferences
2. Remove donation Redux state
3. Remove payment message handling
4. Remove donation services and loaders
5. Remove database tables and migrations
6. Remove npm dependencies (card-validator, credit-card-type, parsecurrency)
7. Remove payment-related protocol buffer definitions
8. Search and remove payment references in:
   - Message timeline rendering
   - WebAPI calls
   - Backup/export logic
   - Server sync logic

#### Risk Assessment:
- **Medium integration** - Payments touch messaging system
- **No Signal Protocol impact** - Payment is an application feature
- **Well-bounded** - Clear module boundaries
- **Message history concern** - Need to handle existing payment messages gracefully

---

### 3. STORIES (255 files) - REMOVE THIRD
**Status:** PRESENT
**Risk Level:** MEDIUM-HIGH
**Estimated Effort:** 12-16 hours

#### Key Components:
- **Components:**
  - `ts/components/StoryLinkPreview.dom.tsx`
  - Note: Most Story* components were already removed
- **State Management:**
  - `ts/state/ducks/stories.preload.ts`
  - `ts/state/ducks/storyDistributionLists.preload.ts`
  - `ts/state/selectors/stories.preload.ts`
  - `ts/state/selectors/stories2.dom.ts`
  - `ts/state/selectors/storyDistributionLists.dom.ts`
  - `ts/state/smart/StoriesSettingsModal.preload.tsx`
  - `ts/state/smart/StoriesTab.preload.tsx`
  - `ts/state/smart/StoryViewer.preload.tsx`
- **Services:**
  - `ts/services/storyLoader.preload.ts`
  - `ts/services/distributionListLoader.preload.ts`
- **Utilities:** (10+ files)
  - `ts/util/stories.preload.ts`
  - `ts/util/shouldDownloadStory.preload.ts`
  - `ts/util/shouldStoryReplyNotifyUser.preload.ts`
  - `ts/util/getStoryBackground.std.ts`
  - `ts/util/getStoryReplyText.std.ts`
  - `ts/util/hydrateStoryContext.preload.ts`
  - `ts/util/isGroupInStoryMode.std.ts`
  - `ts/util/findStoryMessage.preload.ts`
  - `ts/util/deleteAllMyStories.preload.ts`
  - `ts/util/downloadOnboardingStory.preload.ts`
  - `ts/util/onStoryRecipientUpdate.preload.ts`
  - `ts/util/findAndDeleteOnboardingStoryIfExists.preload.ts`
- **Types:**
  - `ts/types/Stories.std.ts`
  - `ts/types/StoryDistributionId.std.ts`
- **Jobs:**
  - `ts/jobs/helpers/sendDeleteStoryForEveryone.preload.ts`
  - `ts/jobs/helpers/sendStory.preload.ts`

#### Database Impact:
- Tables: `storyReads`, `storyDistributions`, `storyDistributionMembers`
- No specific migrations to remove (integrated into main migrations)

#### Dependencies:
- None (no external packages)

#### Removal Strategy:
1. Remove Stories tab from left pane
2. Remove story distribution lists
3. Remove story Redux state and selectors
4. Remove story services and loaders
5. Remove story message handling
6. Remove story utilities
7. Remove database tables
8. Remove story references in:
   - Message system (story replies)
   - Conversation settings (story mode)
   - WebAPI sync
   - Backup/restore logic
   - Notification system
   - Background loader system

#### Risk Assessment:
- **Medium-high integration** - Stories touch many systems
- **No Signal Protocol impact** - Stories are application-level
- **Group chat impact** - Need to handle "group story mode" settings
- **Message history** - Story replies may exist in message history
- **Distribution lists** - Separate from group management but related

---

### 4. CALLING (439 files) - REMOVE LAST (HIGHEST RISK)
**Status:** PRESENT
**Risk Level:** HIGH
**Estimated Effort:** 20-30 hours

#### Key Components:
- **Core Directory:** `/ts/calling/` (10 core modules)
  - `VideoSupport.preload.ts`
  - `constants.std.ts`
  - `findBestMatchingDevice.std.ts`
  - `truncateAudioLevel.std.ts`
  - `useGetCallingFrameBuffer.std.ts`

- **UI Components (58 total):**
  - Call Screen: `CallScreen.dom.tsx`, `CallManager.dom.tsx`
  - Call Links: `CallLink*.tsx` (7 components)
  - Calling UI: `Calling*.tsx` (30+ components)
    - CallingLobby, CallingHeader, CallingButton, CallingPip
    - CallingDeviceSelection, CallingAudioIndicator
    - CallingParticipantsList, CallingPendingParticipants
    - CallingRaisedHandsList, CallingPreCallInfo
    - CallingScreenSharingController, CallingSelectPresentingSourcesModal
    - CallingToast, CallingToastManager
  - Group Calls: `GroupCall*.tsx` (5 components)
  - Direct Calls: `DirectCallRemoteParticipant.dom.tsx`
  - Call Reactions: `CallReaction*.tsx`
  - Calls Tab: `CallsTab.preload.tsx`, `CallsList.preload.tsx`, `CallsNewCallButton.dom.tsx`

- **State Management:**
  - `ts/state/ducks/calling.preload.ts` (main Redux module)
  - `ts/state/ducks/callingHelpers.std.ts`
  - `ts/state/selectors/calling.std.ts`
  - `ts/state/smart/Call*.tsx` (7 smart containers)
  - `ts/state/smart/ConfirmLeaveCallModal.preload.tsx`

- **Services:**
  - `ts/services/calling.preload.ts` (main calling service)
  - `ts/jobs/helpers/sendCallingMessage.preload.ts`
  - `ts/jobs/callLinkRefreshJobQueue.preload.ts`

- **Backend/Database:**
  - `ts/sql/server/callLinks.node.ts`
  - `ts/sql/migrations/89-call-history.node.ts`

- **Utilities (11+ files):**
  - `ts/util/callingMessageToProto.node.ts`
  - `ts/util/callDisposition.preload.ts`
  - `ts/util/onCallLinkUpdateSync.preload.ts`
  - `ts/util/callingIsReconnecting.std.ts`
  - `ts/util/callingNotification.std.ts`
  - `ts/util/callingTones.preload.ts`
  - `ts/util/desktopCapturer.preload.ts`
  - `ts/util/getConversation.preload.ts` (partially calling-related)
  - `ts/util/isGroupOrAdhocCall.std.ts`

- **Types:**
  - `ts/types/Calling.std.ts`

- **Tests (24+ files):**
  - `ts/test-electron/state/ducks/calling_test.preload.ts`
  - `ts/test-electron/backup/calling_test.preload.ts`
  - `ts/test-electron/state/selectors/calling_test.preload.ts`
  - `ts/test-node/calling/findBestMatchingDevice_test.std.ts`
  - `ts/test-node/util/callingNotification_test.preload.ts`
  - `ts/test-node/util/callingGetParticipantName_test.std.ts`
  - `ts/test-node/util/callingMessageToProto_test.node.ts`
  - `ts/test-mock/pnp/calling_test.node.ts`
  - `ts/test-mock/calling/callLinkAdmin_test.node.ts`
  - `ts/test-mock/calling/callMessages_test.docker.node.ts`
  - `ts/test-mock/calling/helpers.node.ts`

- **HTML Pages:**
  - `calling_tools.html`

#### Database Impact:
- Tables: `callsHistory`, `callLinks`
- Migrations: `89-call-history.node.ts`

#### Dependencies to Remove:
```json
{
  "@signalapp/ringrtc": "2.59.2"
}
```
**CRITICAL:** RingRTC is a large native dependency (~50MB compiled)

#### Protocol Buffer Impact:
- Remove calling-related protobuf definitions from `protos/SignalService.proto`
- Call messages, call links, group call state

#### Removal Strategy:
1. **Phase 1: UI Removal (Day 1)**
   - Remove calling components from UI
   - Remove CallsTab from left pane
   - Remove call notification bars
   - Remove calling modals and screens
   - Update Timeline to skip rendering call events

2. **Phase 2: State & Services (Day 2)**
   - Remove calling Redux state
   - Remove calling service
   - Remove call link management
   - Remove calling job queues
   - Remove calling utilities

3. **Phase 3: Backend & Protocol (Day 3)**
   - Remove call message handlers
   - Remove RingRTC integration
   - Remove calling protobuf definitions
   - Update MessageReceiver to skip call messages
   - Remove database tables and migrations

4. **Phase 4: Dependencies & Cleanup (Day 4)**
   - Remove @signalapp/ringrtc from package.json
   - Remove calling tests
   - Remove calling_tools.html
   - Clean up imports across codebase
   - Verify no broken references

#### Files Requiring Special Attention:
- `ts/background.preload.ts` - Central app initialization
- `ts/textsecure/MessageReceiver.preload.ts` - Message handling
- `ts/util/createIPCEvents.preload.ts` - IPC event routing
- `ts/components/conversation/TimelineItem.dom.tsx` - Call history rendering
- `ts/components/LeftPane.dom.tsx` - Calls tab
- `ts/state/reducer.preload.ts` - Redux root reducer
- `ts/state/actions.preload.ts` - Action creators
- `ts/sql/Server.node.ts` - Database queries

#### Risk Assessment:
- **HIGHEST integration** - Calling touches almost every system
- **Protocol involvement** - Call signaling messages use Signal Protocol
- **Native dependency** - RingRTC removal requires native rebuild
- **Real-time communication** - WebRTC, media devices, network management
- **Message history** - Call events in conversation history
- **IPC complexity** - Calling uses extensive main/renderer IPC
- **Notifications** - System notifications for calls
- **Performance impact** - Large dependency removal may improve build time

#### Critical Risks:
1. **Breaking Signal Protocol** - Must ensure call message handling removal doesn't affect regular messages
2. **Database migration issues** - Call history tables may have foreign keys
3. **Build failures** - RingRTC is a core dependency that may affect build configuration
4. **Type errors** - Calling types are used in many type definitions
5. **Timeline rendering** - Call events integrated into message timeline

---

## Dependency Map

### Cross-Feature Dependencies:
```
Messages
  ├── Payments (payment messages in timeline)
  ├── Stories (story replies in timeline)
  └── Calling (call events in timeline)

Conversations
  ├── Stories (group story mode)
  ├── Calling (call history per conversation)
  └── Badges (profile badges)

Preferences/Settings
  ├── Donations
  ├── Stories
  └── Calling (device selection)

Redux State
  ├── badges
  ├── donations
  ├── stories
  ├── storyDistributionLists
  └── calling (largest state module)

Database
  ├── badges (2 tables)
  ├── donationReceipts (1 table)
  ├── storyReads, storyDistributions, storyDistributionMembers (3 tables)
  └── callsHistory, callLinks (2 tables)
```

### Signal Protocol Impact Assessment:
- **Badges:** NO IMPACT - Cosmetic only
- **Payments:** NO IMPACT - Application-level feature
- **Stories:** MINIMAL IMPACT - Story messages use encrypted channels but not core protocol
- **Calling:** MODERATE IMPACT - Call signaling uses Signal Protocol encryption, but actual A/V uses WebRTC/RingRTC

---

## Recommended Removal Order

### Day 1: Badges (2-3 hours)
**Why first?** Smallest, lowest risk, clear boundaries

1. Remove `/ts/badges/` directory
2. Remove badge state management
3. Update UI to remove badge displays
4. Update database schema
5. Test build
6. **Commit:** "feat: Remove Signal badges feature"

### Day 2: Payments (8-12 hours)
**Why second?** Medium complexity, no protocol involvement

1. Remove payment UI components
2. Remove donation preferences
3. Remove payment message handlers
4. Remove services and loaders
5. Remove database tables
6. Remove npm dependencies
7. Test build
8. **Commit:** "feat: Remove Signal payments and donations"

### Day 3: Stories (12-16 hours)
**Why third?** More integrated but still application-level

1. Remove Stories tab
2. Remove story Redux state
3. Remove story services
4. Remove story utilities
5. Remove distribution lists
6. Update message handling to skip story replies
7. Remove database tables
8. Test build
9. **Commit:** "feat: Remove Signal Stories feature"

### Day 4-5: Calling (20-30 hours)
**Why last?** Largest, most integrated, highest risk

1. **Day 4 Morning:** Remove calling UI components
2. **Day 4 Afternoon:** Remove calling state and services
3. **Day 4 Evening:** Test build and fix issues
4. **Day 5 Morning:** Remove RingRTC and backend
5. **Day 5 Afternoon:** Clean up and final testing
6. **Commit:** "feat: Remove Signal calling infrastructure"

---

## Testing Strategy

### After Each Feature Removal:
1. **Build Test:** `pnpm run build:dev`
2. **Type Check:** `pnpm run check:types`
3. **Unit Tests:** `pnpm run test-node`
4. **Lint:** `pnpm run lint`
5. **Manual Test:**
   - Launch app
   - Send/receive messages
   - View conversation history
   - Check preferences

### Final Integration Test (After All Removals):
1. Full build: `pnpm run build`
2. All tests: `pnpm run test`
3. Message encryption/decryption
4. Database migrations
5. App launch and basic functionality

---

## Rollback Strategy

### Per-Feature Rollback:
1. **Git Tags:** Create tag before each feature removal
   ```bash
   git tag pre-badges-removal
   git tag pre-payments-removal
   git tag pre-stories-removal
   git tag pre-calling-removal
   ```

2. **Backups:** Automated by removal tool to `/scripts/cleanup/backups/`

3. **Rollback Command:**
   ```bash
   git reset --hard pre-[feature]-removal
   ```

### Database Rollback:
- Database schema changes should be reversible
- Keep SQL backup before schema modifications
- Test migrations in both directions

---

## Success Criteria

### Per-Feature:
- ✅ All feature files removed or modified
- ✅ No broken TypeScript references
- ✅ Build completes successfully
- ✅ Tests pass
- ✅ App launches without errors
- ✅ Core messaging works

### Overall (After All Removals):
- ✅ ~927 files removed or modified
- ✅ Code reduction: ~30-40% (target: 40k-60k lines removed)
- ✅ Dependencies removed: 4 packages (@signalapp/ringrtc, card-validator, credit-card-type, parsecurrency)
- ✅ Database tables removed: 10 tables
- ✅ Build time improved: Target <60 seconds (from ~90 seconds)
- ✅ Bundle size reduced: Target 20-30% reduction
- ✅ Zero Signal Protocol functionality broken
- ✅ All tests passing

---

## Risk Mitigation

### High-Risk Areas:
1. **Message Timeline Rendering**
   - Keep logic to gracefully skip payment/call/story events
   - Don't crash on historical messages

2. **Redux State**
   - Remove reducers without breaking root reducer
   - Update selectors that depend on removed state

3. **Database Schema**
   - Test migrations on copy of production database
   - Verify no foreign key violations

4. **Signal Protocol**
   - Never remove message encryption/decryption
   - Keep all libsignal dependencies
   - Preserve message handling core

5. **Build Configuration**
   - RingRTC removal may affect webpack config
   - Native modules require rebuild

---

## Tools Available

1. **Feature Analyzer:** `/scripts/cleanup/analyze-remaining-features.js`
   - Run to check current state
   - Generates detailed JSON report

2. **Feature Remover:** `/scripts/cleanup/tools/remove-feature.js`
   - Safe removal with dry-run
   - Automatic backups
   - Rollback capability

3. **Component Analyzer:** `/scripts/cleanup/tools/analyze-components.js`
   - Categorize components
   - Find orphaned code

---

## Next Steps

1. **Review this strategy** with team
2. **Create GitHub issues** for each feature removal
3. **Set up testing environment** with sample data
4. **Start with badges** (easiest, lowest risk)
5. **Document lessons learned** after each removal
6. **Coordinate with Signal Protocol Specialist** before touching protocol code

---

## Appendix: File Counts by Category

### Calling (439 files):
- Components: 58
- State management: 9
- Services: 3
- Utilities: 11
- Tests: 24
- Database: 2
- Other: 332

### Stories (255 files):
- Components: 1
- State management: 7
- Services: 2
- Utilities: 13
- Types: 2
- Other: 230

### Payments (211 files):
- Components: 3
- State management: 2
- Services: 2
- Utilities: 3
- Database: 1
- Types: 2
- Other: 198

### Badges (22 files):
- Core modules: 8
- State management: 2
- Services: 1
- Components: 1
- Types: 1
- Other: 9

**Total: 927 files**
