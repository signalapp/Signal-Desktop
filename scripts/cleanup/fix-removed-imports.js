#!/usr/bin/env node
// Fix imports for removed badges and donations features

const fs = require('fs');
const path = require('path');

const badImportPatterns = [
  // Badge selector imports
  /import\s+.*from\s+['"].*badges\.preload['"]\s*;?\s*\n/g,
  /import\s+.*from\s+['"].*\/badges\.preload['"]\s*;?\s*\n/g,
  /import\s+.*from\s+['"]\.\.\/selectors\/badges\.preload['"]\s*;?\s*\n/g,

  // Donation imports
  /import\s+.*from\s+['"].*donations\.preload['"]\s*;?\s*\n/g,
  /import\s+.*from\s+['"].*\/donations\.preload['"]\s*;?\s*\n/g,
  /import\s+.*from\s+['"].*PreferencesDonations\.preload['"]\s*;?\s*\n/g,

  // Payment imports
  /import\s+.*from\s+['"].*Payment\.std['"]\s*;?\s*\n/g,
  /import\s+.*from\s+['"].*payments\.std['"]\s*;?\s*\n/g,
  /import\s+.*from\s+['"].*Donations\.std['"]\s*;?\s*\n/g,
  /import\s+.*from\s+['"].*currency\.dom['"]\s*;?\s*\n/g,
  /import\s+.*from\s+['"].*generateDonationReceipt\.dom['"]\s*;?\s*\n/g,
  /import\s+.*from\s+['"].*DonationsErrorBoundary\.dom['"]\s*;?\s*\n/g,
];

// Also remove variable declarations for badges/donations
const variablePatterns = [
  /const\s+badge\s*=.*;\s*\n/g,
  /const\s+badgeSelector\s*=.*;\s*\n/g,
  /const\s+getPreferredBadge\s*=.*;\s*\n/g,
  /const\s+getPreferredBadgeSelector\s*=.*;\s*\n/g,
  /donations:\s*getDonationsForRedux\(\),?\s*\n/g,
];

function fixImports(content) {
  let modified = content;

  // Remove bad imports
  badImportPatterns.forEach(pattern => {
    modified = modified.replace(pattern, '');
  });

  // Remove variable declarations
  variablePatterns.forEach(pattern => {
    modified = modified.replace(pattern, '');
  });

  // Remove badge prop from object spreads
  modified = modified.replace(/badge,?\s*\n/g, '');
  modified = modified.replace(/badge:\s*[^,\n}]+,?\s*\n/g, '');

  return modified;
}

const filesToFix = [
  // Smart components with badge imports
  'ts/state/smart/PendingInvites.preload.tsx',
  'ts/state/smart/PreferencesEditChatFolderPage.preload.tsx',
  'ts/state/smart/ContactModal.preload.tsx',
  'ts/state/smart/TimelineItem.preload.tsx',
  'ts/state/smart/ConversationHeader.preload.tsx',
  'ts/state/smart/GV1Members.preload.tsx',
  'ts/state/smart/SendAnywayDialog.preload.tsx',
  'ts/state/smart/LeftPane.preload.tsx',
  'ts/state/smart/PreferencesNotificationProfiles.preload.tsx',
  'ts/state/smart/CompositionArea.preload.tsx',
  'ts/state/smart/ConversationDetails.preload.tsx',
  'ts/state/smart/ContactSpoofingReviewDialog.preload.tsx',
  'ts/state/smart/Timeline.preload.tsx',
  'ts/state/smart/HeroRow.preload.tsx',
  'ts/state/smart/NavTabs.preload.tsx',
  'ts/state/smart/EditHistoryMessagesModal.preload.tsx',
  'ts/state/smart/ForwardMessagesModal.preload.tsx',
  'ts/state/smart/GroupV1MigrationDialog.preload.tsx',
  'ts/state/smart/CompositionTextArea.preload.tsx',
  'ts/state/smart/Preferences.preload.tsx',
  'ts/state/smart/MessageDetail.preload.tsx',
  'ts/state/smart/MessageSearchResult.preload.tsx',
  'ts/state/smart/ToastManager.preload.tsx',

  // Files with donation/payment imports
  'ts/textsecure/WebAPI.preload.ts',
  'ts/textsecure/processDataMessage.preload.ts',
  'ts/util/getNotificationDataForMessage.preload.ts',
  'ts/util/isMessageEmpty.preload.ts',
  'ts/windows/main/phase1-ipc.preload.ts',
  'ts/windows/main/preload_test.preload.ts',
  'ts/test-electron/backup/non_bubble_test.preload.ts',
];

let fixedCount = 0;
console.log('🔧 Fixing imports in files...\n');

filesToFix.forEach(filePath => {
  const fullPath = path.join(process.cwd(), filePath);

  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  File not found: ${filePath}`);
    return;
  }

  const content = fs.readFileSync(fullPath, 'utf8');
  const modified = fixImports(content);

  if (content !== modified) {
    fs.writeFileSync(fullPath, modified, 'utf8');
    console.log(`✅ Fixed: ${filePath}`);
    fixedCount++;
  }
});

console.log(`\n✨ Done! Fixed ${fixedCount} files.`);
