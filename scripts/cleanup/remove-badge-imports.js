#!/usr/bin/env node
// Script to automatically remove badge-related imports and code

const fs = require('fs');
const path = require('path');

const badgeImportPatterns = [
  /import\s+.*from\s+['"].*badges.*['"]\s*;?\s*\n/g,
  /import\s+.*from\s+['"].*Badge.*['"]\s*;?\s*\n/g,
  /import\s+.*from\s+['"].*GiftBadge.*['"]\s*;?\s*\n/g,
  /import\s+.*from\s+['"].*getFakeBadge.*['"]\s*;?\s*\n/g,
  /import\s+.*BadgeCategory.*from.*\n/g,
  /import\s+.*BadgeImageTheme.*from.*\n/g,
];

const filesToFix = [
  // Axo components
  'ts/axo/_internal/AxoBaseSegmentedControl.dom.tsx',
  'ts/axo/AxoSelect.dom.tsx',
  // Background
  'ts/background.preload.ts',
  // Components
  'ts/components/Avatar.dom.tsx',
  'ts/components/Avatar.dom.stories.tsx',
  'ts/components/CompositionInput.dom.tsx',
  'ts/components/CompositionTextArea.dom.tsx',
  'ts/components/ConversationList.dom.tsx',
  'ts/components/NavTabs.dom.tsx',
  'ts/components/Preferences.dom.tsx',
  // Conversation components
  'ts/components/conversation/ContactModal.dom.tsx',
  'ts/components/conversation/ContactModal.dom.stories.tsx',
  'ts/components/conversation/ContactSpoofingReviewDialog.dom.tsx',
  'ts/components/conversation/ContactSpoofingReviewDialogPerson.dom.tsx',
  'ts/components/conversation/ConversationHeader.dom.tsx',
  'ts/components/conversation/GroupV1Migration.dom.tsx',
  'ts/components/conversation/Message.dom.tsx',
  'ts/components/conversation/MessageDetail.dom.tsx',
  'ts/components/conversation/MessageDetail.dom.stories.tsx',
  'ts/components/conversation/ReactionViewer.dom.tsx',
  'ts/components/conversation/Timeline.dom.tsx',
  'ts/components/conversation/TimelineMessage.dom.stories.tsx',
  'ts/components/conversation/TypingBubble.dom.tsx',
  'ts/components/conversation/TypingBubble.dom.stories.tsx',
  // Conversation details
  'ts/components/conversation/conversation-details/ConversationDetails.dom.tsx',
  'ts/components/conversation/conversation-details/ConversationDetailsHeader.dom.tsx',
  'ts/components/conversation/conversation-details/ConversationDetailsHeader.dom.stories.tsx',
  'ts/components/conversation/conversation-details/ConversationDetailsMembershipList.dom.tsx',
  'ts/components/conversation/conversation-details/PendingInvites.dom.tsx',
  'ts/components/conversation/conversation-details/PendingInvites.dom.stories.tsx',
  // Conversation list
  'ts/components/conversationList/BaseConversationListItem.dom.tsx',
  'ts/components/conversationList/ContactCheckbox.dom.tsx',
  'ts/components/conversationList/ContactListItem.dom.tsx',
  'ts/components/conversationList/ConversationListItem.dom.tsx',
  'ts/components/conversationList/MessageSearchResult.dom.tsx',
  'ts/components/conversationList/MessageSearchResult.dom.stories.tsx',
  // Other components
  'ts/components/EditHistoryMessagesModal.dom.tsx',
  'ts/components/ForwardMessagesModal.dom.tsx',
  'ts/components/GroupDialog.dom.tsx',
  'ts/components/GroupV1MigrationDialog.dom.tsx',
  'ts/components/LeftPane.dom.tsx',
  'ts/components/NewlyCreatedGroupInvitedContactsDialog.dom.tsx',
  'ts/components/SafetyNumberChangeDialog.dom.tsx',
  'ts/components/SafetyNumberChangeDialog.dom.stories.tsx',
  // Preferences
  'ts/components/preferences/chatFolders/PreferencesEditChatFoldersPage.dom.tsx',
  'ts/components/preferences/PreferencesSelectChatsDialog.dom.tsx',
  'ts/components/PreferencesNotificationProfiles.dom.tsx',
  // Messages
  'ts/messages/handleDataMessage.preload.ts',
  'ts/messageModifiers/ViewSyncs.preload.ts',
  // Quill
  'ts/quill/mentions/completion.dom.tsx',
  // Services
  'ts/services/backups/export.preload.ts',
  'ts/services/backups/import.preload.ts',
  'ts/services/profiles.preload.ts',
  // SQL
  'ts/sql/Interface.std.ts',
  'ts/sql/Server.node.ts',
];

function removeBadgeImports(content) {
  let modified = content;
  badgeImportPatterns.forEach(pattern => {
    modified = modified.replace(pattern, '');
  });
  return modified;
}

function fixFile(filePath) {
  const fullPath = path.join(process.cwd(), filePath);

  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  File not found: ${filePath}`);
    return false;
  }

  const content = fs.readFileSync(fullPath, 'utf8');
  const modified = removeBadgeImports(content);

  if (content !== modified) {
    fs.writeFileSync(fullPath, modified, 'utf8');
    console.log(`✅ Fixed: ${filePath}`);
    return true;
  }

  return false;
}

console.log('🧹 Removing badge imports from files...\n');

let fixedCount = 0;
filesToFix.forEach(file => {
  if (fixFile(file)) {
    fixedCount++;
  }
});

console.log(`\n✨ Done! Fixed ${fixedCount} files.`);
console.log('\n⚠️  Note: You may need to manually fix badge-related code that references badge variables/types.');
