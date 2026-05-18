<!-- Copyright 2026 Signal Messenger, LLC -->
<!-- SPDX-License-Identifier: AGPL-3.0-only -->

# Database Schema

<details>
<summary>Table: attachment_backup_jobs</summary>

```sql
CREATE TABLE attachment_backup_jobs (
  mediaName TEXT NOT NULL PRIMARY KEY,
  type TEXT NOT NULL,
  data TEXT NOT NULL,
  receivedAt INTEGER NOT NULL,
  -- job manager fields
  attempts INTEGER NOT NULL,
  active INTEGER NOT NULL,
  retryAfter INTEGER,
  lastAttemptTimestamp INTEGER
) STRICT
```

<details>
<summary>Index: attachment_backup_jobs → attachment_backup_jobs_receivedAt</summary>

```sql
CREATE INDEX attachment_backup_jobs_receivedAt ON attachment_backup_jobs (receivedAt)
```

</details>

<details>
<summary>Index: attachment_backup_jobs → attachment_backup_jobs_type_receivedAt</summary>

```sql
CREATE INDEX attachment_backup_jobs_type_receivedAt ON attachment_backup_jobs (type, receivedAt)
```

</details>

<details>
<summary>Index: attachment_backup_jobs → sqlite_autoindex_attachment_backup_jobs_1</summary>

```text
(404: SQL Not Found)
```

</details>

---

</details>

<details>
<summary>Table: attachment_downloads</summary>

```sql
CREATE TABLE "attachment_downloads" (
  messageId TEXT NOT NULL REFERENCES messages (id) ON DELETE CASCADE,
  attachmentType TEXT NOT NULL,
  attachmentSignature TEXT NOT NULL,
  receivedAt INTEGER NOT NULL,
  sentAt INTEGER NOT NULL,
  contentType TEXT NOT NULL,
  size INTEGER NOT NULL,
  attachmentJson TEXT NOT NULL,
  active INTEGER NOT NULL,
  attempts INTEGER NOT NULL,
  retryAfter INTEGER,
  lastAttemptTimestamp INTEGER,
  source TEXT NOT NULL DEFAULT standard,
  ciphertextSize INTEGER NOT NULL DEFAULT 0,
  originalSource TEXT NOT NULL DEFAULT standard,
  PRIMARY KEY (
    messageId,
    attachmentType,
    attachmentSignature
  )
) STRICT
```

<details>
<summary>Index: attachment_downloads → attachment_downloads_active_messageId</summary>

```sql
CREATE INDEX attachment_downloads_active_messageId ON attachment_downloads (active, messageId)
```

</details>

<details>
<summary>Index: attachment_downloads → attachment_downloads_active_receivedAt</summary>

```sql
CREATE INDEX attachment_downloads_active_receivedAt ON attachment_downloads (active, receivedAt)
```

</details>

<details>
<summary>Index: attachment_downloads → attachment_downloads_active_source_receivedAt</summary>

```sql
CREATE INDEX attachment_downloads_active_source_receivedAt ON attachment_downloads (
  active,
  source,
  receivedAt
)
```

</details>

<details>
<summary>Index: attachment_downloads → attachment_downloads_messageId</summary>

```sql
CREATE INDEX attachment_downloads_messageId ON attachment_downloads (messageId)
```

</details>

<details>
<summary>Index: attachment_downloads → attachment_downloads_source_ciphertextSize</summary>

```sql
CREATE INDEX attachment_downloads_source_ciphertextSize ON attachment_downloads (
  source,
  ciphertextSize
)
```

</details>

<details>
<summary>Index: attachment_downloads → sqlite_autoindex_attachment_downloads_1</summary>

```text
(404: SQL Not Found)
```

</details>

<details>
<summary>Trigger: attachment_downloads → attachment_downloads_backup_job_delete</summary>

```sql
CREATE TRIGGER attachment_downloads_backup_job_delete AFTER DELETE ON attachment_downloads WHEN OLD.originalSource = 'backup_import' BEGIN
UPDATE attachment_downloads_backup_stats
SET
  completedBytes = completedBytes + OLD.ciphertextSize
WHERE
  id = 0;

END
```

</details>

<details>
<summary>Trigger: attachment_downloads → attachment_downloads_backup_job_insert</summary>

```sql
CREATE TRIGGER attachment_downloads_backup_job_insert AFTER INSERT ON attachment_downloads WHEN NEW.originalSource = 'backup_import' BEGIN
UPDATE attachment_downloads_backup_stats
SET
  totalBytes = totalBytes + NEW.ciphertextSize;

END
```

</details>

<details>
<summary>Trigger: attachment_downloads → attachment_downloads_backup_job_update</summary>

```sql
CREATE TRIGGER attachment_downloads_backup_job_update AFTER
UPDATE OF ciphertextSize ON attachment_downloads WHEN NEW.originalSource = 'backup_import' BEGIN
UPDATE attachment_downloads_backup_stats
SET
  totalBytes = MAX(
    0,
    totalBytes - OLD.ciphertextSize + NEW.ciphertextSize
  )
WHERE
  id = 0;

END
```

</details>

---

</details>

<details>
<summary>Table: attachment_downloads_backup_stats</summary>

```sql
CREATE TABLE attachment_downloads_backup_stats (
  id INTEGER PRIMARY KEY CHECK (id = 0),
  totalBytes INTEGER NOT NULL,
  completedBytes INTEGER NOT NULL
) STRICT
```

---

</details>

<details>
<summary>Table: attachments_protected_from_deletion</summary>

```sql
CREATE TABLE attachments_protected_from_deletion (
  path TEXT NOT NULL,
  messageId TEXT NOT NULL,
  PRIMARY KEY (path, messageId)
) STRICT
```

<details>
<summary>Index: attachments_protected_from_deletion → sqlite_autoindex_attachments_protected_from_deletion_1</summary>

```text
(404: SQL Not Found)
```

</details>

---

</details>

<details>
<summary>Table: backup_cdn_object_metadata</summary>

```sql
CREATE TABLE backup_cdn_object_metadata (
  mediaId TEXT NOT NULL PRIMARY KEY,
  cdnNumber INTEGER NOT NULL,
  sizeOnBackupCdn INTEGER
) STRICT
```

<details>
<summary>Index: backup_cdn_object_metadata → sqlite_autoindex_backup_cdn_object_metadata_1</summary>

```text
(404: SQL Not Found)
```

</details>

---

</details>

<details>
<summary>Table: badgeImageFiles</summary>

```sql
CREATE TABLE badgeImageFiles (
  badgeId TEXT REFERENCES badges (id) ON DELETE CASCADE ON UPDATE CASCADE,
  'order' INTEGER NOT NULL,
  url TEXT NOT NULL,
  localPath TEXT,
  theme TEXT NOT NULL
)
```

---

</details>

<details>
<summary>Table: badges</summary>

```sql
CREATE TABLE badges (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  descriptionTemplate TEXT NOT NULL
)
```

<details>
<summary>Index: badges → sqlite_autoindex_badges_1</summary>

```text
(404: SQL Not Found)
```

</details>

---

</details>

<details>
<summary>Table: callLinks</summary>

```sql
CREATE TABLE callLinks (
  roomId TEXT NOT NULL PRIMARY KEY,
  rootKey BLOB NOT NULL,
  adminKey BLOB,
  name TEXT NOT NULL,
  -- Enum which stores CallLinkRestrictions from ringrtc
  restrictions INTEGER NOT NULL,
  revoked INTEGER NOT NULL,
  expiration INTEGER,
  deleted INTEGER NOT NULL DEFAULT 0,
  storageID TEXT,
  storageVersion INTEGER,
  storageUnknownFields BLOB,
  storageNeedsSync INTEGER NOT NULL DEFAULT 0,
  deletedAt INTEGER
) STRICT
```

<details>
<summary>Index: callLinks → callLinks_adminKey</summary>

```sql
CREATE INDEX callLinks_adminKey ON callLinks (adminKey)
```

</details>

<details>
<summary>Index: callLinks → callLinks_deleted</summary>

```sql
CREATE INDEX callLinks_deleted ON callLinks (deleted, roomId)
```

</details>

<details>
<summary>Index: callLinks → sqlite_autoindex_callLinks_1</summary>

```text
(404: SQL Not Found)
```

</details>

---

</details>

<details>
<summary>Table: callsHistory</summary>

```sql
CREATE TABLE callsHistory (
  callId TEXT PRIMARY KEY,
  peerId TEXT NOT NULL, -- conversation id (legacy) | uuid | groupId | roomId
  ringerId TEXT DEFAULT NULL, -- ringer uuid
  mode TEXT NOT NULL, -- enum "Direct" | "Group"
  type TEXT NOT NULL, -- enum "Audio" | "Video" | "Group"
  direction TEXT NOT NULL, -- enum "Incoming" | "Outgoing
  -- Direct: enum "Pending" | "Missed" | "Accepted" | "Deleted"
  -- Group: enum "GenericGroupCall" | "OutgoingRing" | "Ringing" | "Joined" | "Missed" | "Declined" | "Accepted" | "Deleted"
  status TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  startedById TEXT DEFAULT NULL,
  endedTimestamp INTEGER DEFAULT NULL,
  UNIQUE (callId, peerId)
  ON CONFLICT FAIL
)
```

<details>
<summary>Index: callsHistory → callsHistory_byConversation_order</summary>

```sql
CREATE INDEX callsHistory_byConversation_order ON callsHistory (
  peerId,
  timestamp DESC,
  callId
)
```

</details>

<details>
<summary>Index: callsHistory → callsHistory_callAndGroupInfo_optimize</summary>

```sql
CREATE INDEX callsHistory_callAndGroupInfo_optimize on callsHistory (
  direction,
  peerId,
  timestamp DESC,
  status
)
```

</details>

<details>
<summary>Index: callsHistory → callsHistory_incoming_missed</summary>

```sql
CREATE INDEX callsHistory_incoming_missed ON callsHistory (
  callId,
  status,
  direction
)
WHERE
  status IS 'Missed'
  AND direction IS 'Incoming'
```

</details>

<details>
<summary>Index: callsHistory → callsHistory_order</summary>

```sql
CREATE INDEX callsHistory_order ON callsHistory (
  timestamp DESC,
  callId,
  peerId
)
```

</details>

<details>
<summary>Index: callsHistory → sqlite_autoindex_callsHistory_1</summary>

```text
(404: SQL Not Found)
```

</details>

<details>
<summary>Index: callsHistory → sqlite_autoindex_callsHistory_2</summary>

```text
(404: SQL Not Found)
```

</details>

---

</details>

<details>
<summary>Table: chatFolders</summary>

```sql
CREATE TABLE chatFolders (
  id TEXT NOT NULL PRIMARY KEY,
  folderType INTEGER NOT NULL,
  name TEXT NOT NULL,
  position INTEGER NOT NULL,
  showOnlyUnread INTEGER NOT NULL,
  showMutedChats INTEGER NOT NULL,
  includeAllIndividualChats INTEGER NOT NULL,
  includeAllGroupChats INTEGER NOT NULL,
  includedConversationIds TEXT NOT NULL,
  excludedConversationIds TEXT NOT NULL,
  deletedAtTimestampMs INTEGER NOT NULL,
  storageID TEXT,
  storageVersion INTEGER,
  storageUnknownFields BLOB,
  storageNeedsSync INTEGER NOT NULL
) STRICT
```

<details>
<summary>Index: chatFolders → chatFolders_by_position</summary>

```sql
CREATE INDEX chatFolders_by_position on chatFolders (position)
```

</details>

<details>
<summary>Index: chatFolders → sqlite_autoindex_chatFolders_1</summary>

```text
(404: SQL Not Found)
```

</details>

---

</details>

<details>
<summary>Table: conversations</summary>

```sql
CREATE TABLE conversations (
  id STRING PRIMARY KEY ASC,
  json TEXT,
  active_at INTEGER,
  type STRING,
  members TEXT,
  name TEXT,
  profileName TEXT,
  profileFamilyName TEXT,
  profileFullName TEXT,
  e164 TEXT,
  serviceId TEXT,
  groupId TEXT,
  profileLastFetchedAt INTEGER,
  expireTimerVersion INTEGER NOT NULL DEFAULT 1
)
```

<details>
<summary>Index: conversations → conversations_active</summary>

```sql
CREATE INDEX conversations_active ON conversations (active_at)
WHERE
  active_at IS NOT NULL
```

</details>

<details>
<summary>Index: conversations → conversations_e164</summary>

```sql
CREATE INDEX conversations_e164 ON conversations (e164)
```

</details>

<details>
<summary>Index: conversations → conversations_groupId</summary>

```sql
CREATE INDEX conversations_groupId ON conversations (groupId)
```

</details>

<details>
<summary>Index: conversations → conversations_serviceId</summary>

```sql
CREATE INDEX conversations_serviceId ON conversations (serviceId)
```

</details>

<details>
<summary>Index: conversations → conversations_type</summary>

```sql
CREATE INDEX conversations_type ON conversations (type)
WHERE
  type IS NOT NULL
```

</details>

<details>
<summary>Index: conversations → sqlite_autoindex_conversations_1</summary>

```text
(404: SQL Not Found)
```

</details>

---

</details>

<details>
<summary>Table: defunctCallLinks</summary>

```sql
CREATE TABLE defunctCallLinks (
  roomId TEXT NOT NULL PRIMARY KEY,
  rootKey BLOB NOT NULL,
  adminKey BLOB,
  storageID TEXT,
  storageVersion INTEGER,
  storageUnknownFields BLOB,
  storageNeedsSync INTEGER NOT NULL DEFAULT 0
) STRICT
```

<details>
<summary>Index: defunctCallLinks → sqlite_autoindex_defunctCallLinks_1</summary>

```text
(404: SQL Not Found)
```

</details>

---

</details>

<details>
<summary>Table: donationReceipts</summary>

```sql
CREATE TABLE donationReceipts (
  id TEXT NOT NULL PRIMARY KEY,
  currencyType TEXT NOT NULL,
  paymentAmount INTEGER NOT NULL,
  timestamp INTEGER NOT NULL
) STRICT
```

<details>
<summary>Index: donationReceipts → donationReceipts_byTimestamp</summary>

```sql
CREATE INDEX donationReceipts_byTimestamp on donationReceipts (timestamp)
```

</details>

<details>
<summary>Index: donationReceipts → sqlite_autoindex_donationReceipts_1</summary>

```text
(404: SQL Not Found)
```

</details>

---

</details>

<details>
<summary>Table: edited_messages</summary>

```sql
CREATE TABLE edited_messages (
  messageId STRING REFERENCES messages (id) ON DELETE CASCADE,
  sentAt INTEGER,
  readStatus INTEGER,
  conversationId STRING
)
```

<details>
<summary>Index: edited_messages → edited_messages_messageId</summary>

```sql
CREATE INDEX edited_messages_messageId ON edited_messages (messageId)
```

</details>

<details>
<summary>Index: edited_messages → edited_messages_sent_at</summary>

```sql
CREATE INDEX edited_messages_sent_at ON edited_messages (sentAt)
```

</details>

<details>
<summary>Index: edited_messages → edited_messages_unread</summary>

```sql
CREATE INDEX edited_messages_unread ON edited_messages (
  readStatus,
  conversationId
)
```

</details>

---

</details>

<details>
<summary>Table: groupCallRingCancellations</summary>

```sql
CREATE TABLE groupCallRingCancellations (
  ringId INTEGER PRIMARY KEY,
  createdAt INTEGER NOT NULL
)
```

---

</details>

<details>
<summary>Table: groupSendCombinedEndorsement</summary>

```sql
CREATE TABLE groupSendCombinedEndorsement (
  groupId TEXT NOT NULL PRIMARY KEY, -- Only one endorsement per group
  expiration INTEGER NOT NULL, -- Unix timestamp in seconds
  endorsement BLOB NOT NULL
) STRICT
```

<details>
<summary>Index: groupSendCombinedEndorsement → sqlite_autoindex_groupSendCombinedEndorsement_1</summary>

```text
(404: SQL Not Found)
```

</details>

---

</details>

<details>
<summary>Table: groupSendMemberEndorsement</summary>

```sql
CREATE TABLE groupSendMemberEndorsement (
  groupId TEXT NOT NULL,
  memberAci TEXT NOT NULL,
  expiration INTEGER NOT NULL, -- Unix timestamp in seconds
  endorsement BLOB NOT NULL,
  PRIMARY KEY (groupId, memberAci) -- Only one endorsement per group member
) STRICT
```

<details>
<summary>Index: groupSendMemberEndorsement → sqlite_autoindex_groupSendMemberEndorsement_1</summary>

```text
(404: SQL Not Found)
```

</details>

---

</details>

<details>
<summary>Table: identityKeys</summary>

```sql
CREATE TABLE identityKeys (
  id STRING PRIMARY KEY ASC,
  json TEXT
)
```

<details>
<summary>Index: identityKeys → sqlite_autoindex_identityKeys_1</summary>

```text
(404: SQL Not Found)
```

</details>

---

</details>

<details>
<summary>Table: items</summary>

```sql
CREATE TABLE items (
  id STRING PRIMARY KEY ASC,
  json TEXT
)
```

<details>
<summary>Index: items → sqlite_autoindex_items_1</summary>

```text
(404: SQL Not Found)
```

</details>

---

</details>

<details>
<summary>Table: jobs</summary>

```sql
CREATE TABLE jobs (
  id TEXT PRIMARY KEY,
  queueType TEXT STRING NOT NULL,
  timestamp INTEGER NOT NULL,
  data STRING TEXT
)
```

<details>
<summary>Index: jobs → jobs_timestamp</summary>

```sql
CREATE INDEX jobs_timestamp ON jobs (timestamp)
```

</details>

<details>
<summary>Index: jobs → sqlite_autoindex_jobs_1</summary>

```text
(404: SQL Not Found)
```

</details>

---

</details>

<details>
<summary>Table: key_transparency_account_data</summary>

```sql
CREATE TABLE key_transparency_account_data (
  aci TEXT NOT NULL PRIMARY KEY,
  data BLOB NOT NULL
) STRICT
```

<details>
<summary>Index: key_transparency_account_data → sqlite_autoindex_key_transparency_account_data_1</summary>

```text
(404: SQL Not Found)
```

</details>

---

</details>

<details>
<summary>Table: kyberPreKey_triples</summary>

```sql
CREATE TABLE kyberPreKey_triples (
  id TEXT NOT NULL REFERENCES kyberPreKeys (id) ON DELETE CASCADE,
  signedPreKeyId INTEGER NOT NULL,
  baseKey BLOB NOT NULL,
  UNIQUE (
    id,
    signedPreKeyId,
    baseKey
  )
  ON CONFLICT FAIL
) STRICT
```

<details>
<summary>Index: kyberPreKey_triples → sqlite_autoindex_kyberPreKey_triples_1</summary>

```text
(404: SQL Not Found)
```

</details>

---

</details>

<details>
<summary>Table: kyberPreKeys</summary>

```sql
CREATE TABLE kyberPreKeys (
  id STRING PRIMARY KEY NOT NULL,
  json TEXT NOT NULL,
  ourServiceId NUMBER GENERATED ALWAYS AS (
    json_extract(
      json,
      '$.ourServiceId'
    )
  )
)
```

<details>
<summary>Index: kyberPreKeys → kyberPreKeys_ourServiceId</summary>

```sql
CREATE INDEX kyberPreKeys_ourServiceId ON kyberPreKeys (ourServiceId)
```

</details>

<details>
<summary>Index: kyberPreKeys → sqlite_autoindex_kyberPreKeys_1</summary>

```text
(404: SQL Not Found)
```

</details>

---

</details>

<details>
<summary>Table: megaphones</summary>

```sql
CREATE TABLE megaphones (
  id TEXT NOT NULL PRIMARY KEY,
  desktopMinVersion TEXT,
  priority INTEGER NOT NULL,
  dontShowBeforeEpochMs INTEGER NOT NULL,
  dontShowAfterEpochMs INTEGER NOT NULL,
  showForNumberOfDays INTEGER NOT NULL,
  primaryCtaId TEXT,
  secondaryCtaId TEXT,
  primaryCtaDataJson TEXT,
  secondaryCtaDataJson TEXT,
  conditionalId TEXT,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  primaryCtaText TEXT,
  secondaryCtaText TEXT,
  imagePath TEXT,
  localeFetched TEXT NOT NULL,
  shownAt INTEGER,
  snoozedAt INTEGER,
  snoozeCount INTEGER NOT NULL,
  isFinished INTEGER NOT NULL
) STRICT
```

<details>
<summary>Index: megaphones → sqlite_autoindex_megaphones_1</summary>

```text
(404: SQL Not Found)
```

</details>

---

</details>

<details>
<summary>Table: mentions</summary>

```sql
CREATE TABLE mentions (
  messageId REFERENCES messages (id) ON DELETE CASCADE,
  mentionAci STRING,
  start INTEGER,
  length INTEGER
)
```

<details>
<summary>Index: mentions → mentions_aci</summary>

```sql
CREATE INDEX mentions_aci ON mentions (mentionAci)
```

</details>

<details>
<summary>Index: mentions → mentions_messageId</summary>

```sql
CREATE INDEX mentions_messageId ON mentions (messageId)
```

</details>

---

</details>

<details>
<summary>Table: message_attachments</summary>

```sql
CREATE TABLE message_attachments (
  messageId TEXT NOT NULL REFERENCES messages (id) ON DELETE CASCADE,
  -- For editHistoryIndex to be part of the primary key, it cannot be NULL in strict tables.
  -- For that reason, we use a value of -1 to indicate that it is the root message (not in editHistory)
  editHistoryIndex INTEGER NOT NULL,
  attachmentType TEXT NOT NULL, -- 'long-message' | 'quote' | 'attachment' | 'preview' | 'contact' | 'sticker'
  orderInMessage INTEGER NOT NULL,
  conversationId TEXT NOT NULL,
  sentAt INTEGER NOT NULL,
  clientUuid TEXT,
  size INTEGER NOT NULL,
  contentType TEXT NOT NULL,
  path TEXT,
  plaintextHash TEXT,
  localKey TEXT,
  caption TEXT,
  fileName TEXT,
  blurHash TEXT,
  height INTEGER,
  width INTEGER,
  digest TEXT,
  key TEXT,
  downloadPath TEXT,
  version INTEGER,
  incrementalMac TEXT,
  incrementalMacChunkSize INTEGER,
  transitCdnKey TEXT,
  transitCdnNumber INTEGER,
  transitCdnUploadTimestamp INTEGER,
  backupCdnNumber INTEGER,
  thumbnailPath TEXT,
  thumbnailSize INTEGER,
  thumbnailContentType TEXT,
  thumbnailLocalKey TEXT,
  thumbnailVersion INTEGER,
  screenshotPath TEXT,
  screenshotSize INTEGER,
  screenshotContentType TEXT,
  screenshotLocalKey TEXT,
  screenshotVersion INTEGER,
  backupThumbnailPath TEXT,
  backupThumbnailSize INTEGER,
  backupThumbnailContentType TEXT,
  backupThumbnailLocalKey TEXT,
  backupThumbnailVersion INTEGER,
  storyTextAttachmentJson TEXT,
  localBackupPath TEXT,
  flags INTEGER,
  error INTEGER,
  wasTooBig INTEGER,
  isCorrupted INTEGER,
  copiedFromQuotedAttachment INTEGER,
  pending INTEGER,
  backfillError INTEGER,
  messageType TEXT,
  receivedAt INTEGER,
  receivedAtMs INTEGER,
  isViewOnce INTEGER,
  duration REAL,
  PRIMARY KEY (
    messageId,
    editHistoryIndex,
    attachmentType,
    orderInMessage
  )
) STRICT
```

<details>
<summary>Index: message_attachments → message_attachments_backupThumbnailPath</summary>

```sql
CREATE INDEX message_attachments_backupThumbnailPath ON message_attachments (backupThumbnailPath)
```

</details>

<details>
<summary>Index: message_attachments → message_attachments_getOlderMedia</summary>

```sql
CREATE INDEX message_attachments_getOlderMedia ON message_attachments (
  conversationId,
  attachmentType,
  receivedAt DESC,
  sentAt DESC
)
WHERE
  editHistoryIndex IS -1
  AND messageType IN (
    'incoming',
    'outgoing'
  )
  AND isViewOnce IS NOT 1
```

</details>

<details>
<summary>Index: message_attachments → message_attachments_path</summary>

```sql
CREATE INDEX message_attachments_path ON message_attachments (path)
```

</details>

<details>
<summary>Index: message_attachments → message_attachments_plaintextHash</summary>

```sql
CREATE INDEX message_attachments_plaintextHash ON message_attachments (plaintextHash)
```

</details>

<details>
<summary>Index: message_attachments → message_attachments_screenshotPath</summary>

```sql
CREATE INDEX message_attachments_screenshotPath ON message_attachments (screenshotPath)
```

</details>

<details>
<summary>Index: message_attachments → message_attachments_sortBiggerMedia</summary>

```sql
CREATE INDEX message_attachments_sortBiggerMedia ON message_attachments (
  conversationId,
  attachmentType,
  size DESC,
  receivedAt DESC,
  sentAt DESC
)
WHERE
  editHistoryIndex IS -1
  AND messageType IN (
    'incoming',
    'outgoing'
  )
  AND isViewOnce IS NOT 1
```

</details>

<details>
<summary>Index: message_attachments → message_attachments_thumbnailPath</summary>

```sql
CREATE INDEX message_attachments_thumbnailPath ON message_attachments (thumbnailPath)
```

</details>

<details>
<summary>Index: message_attachments → sqlite_autoindex_message_attachments_1</summary>

```text
(404: SQL Not Found)
```

</details>

<details>
<summary>Trigger: message_attachments → stop_protecting_attachments_after_insert</summary>

```sql
CREATE TRIGGER stop_protecting_attachments_after_insert AFTER INSERT ON message_attachments BEGIN
DELETE FROM attachments_protected_from_deletion
WHERE
  messageId IS NEW.messageId
  AND path IN (
    NEW.path,
    NEW.thumbnailPath,
    NEW.screenshotPath,
    NEW.backupThumbnailPath
  );

END
```

</details>

<details>
<summary>Trigger: message_attachments → stop_protecting_attachments_after_update</summary>

```sql
CREATE TRIGGER stop_protecting_attachments_after_update AFTER
UPDATE OF path,
thumbnailPath,
screenshotPath,
backupThumbnailPath ON message_attachments WHEN OLD.path IS NOT NEW.path
OR OLD.thumbnailPath IS NOT NEW.thumbnailPath
OR OLD.screenshotPath IS NOT NEW.screenshotPath
OR OLD.backupThumbnailPath IS NOT NEW.backupThumbnailPath BEGIN
DELETE FROM attachments_protected_from_deletion
WHERE
  messageId IS NEW.messageId
  AND path IN (
    NEW.path,
    NEW.thumbnailPath,
    NEW.screenshotPath,
    NEW.backupThumbnailPath
  );

END
```

</details>

---

</details>

<details>
<summary>Table: messages</summary>

```sql
CREATE TABLE messages (
  rowid INTEGER PRIMARY KEY ASC,
  id STRING UNIQUE,
  json TEXT,
  readStatus INTEGER,
  expires_at INTEGER,
  sent_at INTEGER,
  schemaVersion INTEGER,
  conversationId STRING,
  received_at INTEGER,
  hasAttachments INTEGER,
  hasFileAttachments INTEGER,
  hasVisualMediaAttachments INTEGER,
  expireTimer INTEGER,
  expirationStartTimestamp INTEGER,
  type STRING,
  body TEXT,
  messageTimer INTEGER,
  messageTimerStart INTEGER,
  messageTimerExpiresAt INTEGER,
  isErased INTEGER,
  isViewOnce INTEGER,
  sourceServiceId TEXT,
  serverGuid STRING NULL,
  sourceDevice INTEGER,
  storyId STRING,
  isStory INTEGER GENERATED ALWAYS AS (type IS 'story'),
  isChangeCreatedByUs INTEGER NOT NULL DEFAULT 0,
  isTimerChangeFromSync INTEGER GENERATED ALWAYS AS (
    json_extract(
      json,
      '$.expirationTimerUpdate.fromSync'
    ) IS 1
  ),
  seenStatus NUMBER default 0,
  storyDistributionListId STRING,
  expiresAt INT GENERATED ALWAYS AS (
    ifnull(
      expirationStartTimestamp + (expireTimer * 1000),
      9007199254740991
    )
  ),
  isUserInitiatedMessage INTEGER GENERATED ALWAYS AS (
    type IS NULL
    OR type NOT IN (
      'change-number-notification',
      'contact-removed-notification',
      'conversation-merge',
      'group-v1-migration',
      'group-v2-change',
      'keychange',
      'message-history-unsynced',
      'profile-change',
      'story',
      'universal-timer-notification',
      'verified-change'
    )
  ),
  mentionsMe INTEGER NOT NULL DEFAULT 0,
  isGroupLeaveEvent INTEGER GENERATED ALWAYS AS (
    type IS 'group-v2-change'
    AND json_array_length(
      json_extract(
        json,
        '$.groupV2Change.details'
      )
    ) IS 1
    AND json_extract(
      json,
      '$.groupV2Change.details[0].type'
    ) IS 'member-remove'
    AND json_extract(
      json,
      '$.groupV2Change.from'
    ) IS NOT NULL
    AND json_extract(
      json,
      '$.groupV2Change.from'
    ) IS json_extract(
      json,
      '$.groupV2Change.details[0].aci'
    )
  ),
  isGroupLeaveEventFromOther INTEGER GENERATED ALWAYS AS (
    isGroupLeaveEvent IS 1
    AND isChangeCreatedByUs IS 0
  ),
  callId TEXT GENERATED ALWAYS AS (
    json_extract(json, '$.callId')
  ),
  shouldAffectPreview INTEGER GENERATED ALWAYS AS (
    type IS NULL
    OR type NOT IN (
      'change-number-notification',
      'contact-removed-notification',
      'conversation-merge',
      'group-v1-migration',
      'keychange',
      'message-history-unsynced',
      'profile-change',
      'story',
      'universal-timer-notification',
      'verified-change'
    )
    AND NOT (
      type IS 'message-request-response-event'
      AND json_extract(
        json,
        '$.messageRequestResponseEvent'
      ) IN (
        'ACCEPT',
        'BLOCK',
        'UNBLOCK'
      )
    )
  ),
  shouldAffectActivity INTEGER GENERATED ALWAYS AS (
    type IS NULL
    OR type NOT IN (
      'change-number-notification',
      'contact-removed-notification',
      'conversation-merge',
      'group-v1-migration',
      'keychange',
      'message-history-unsynced',
      'profile-change',
      'story',
      'universal-timer-notification',
      'verified-change'
    )
    AND NOT (
      type IS 'message-request-response-event'
      AND json_extract(
        json,
        '$.messageRequestResponseEvent'
      ) IN (
        'ACCEPT',
        'BLOCK',
        'UNBLOCK'
      )
    )
  ),
  isAddressableMessage INTEGER GENERATED ALWAYS AS (
    type IS NULL
    OR type IN (
      'incoming',
      'outgoing'
    )
  ),
  timestamp INTEGER,
  received_at_ms INTEGER,
  unidentifiedDeliveryReceived INTEGER,
  serverTimestamp INTEGER,
  source TEXT,
  isSearchable INT GENERATED ALWAYS AS (
    isViewOnce IS NOT 1
    AND storyId IS NULL
  ) VIRTUAL,
  searchableText TEXT GENERATED ALWAYS AS (
    CASE
      WHEN json -> 'poll' IS NOT NULL THEN json -> 'poll' ->> 'question'
      ELSE body
    END
  ) VIRTUAL,
  hasUnreadPollVotes INTEGER NOT NULL DEFAULT 0,
  hasExpireTimer INTEGER NOT NULL GENERATED ALWAYS AS (
    COALESCE(expireTimer, 0) > 0
  ) VIRTUAL,
  hasPreviews INTEGER NOT NULL GENERATED ALWAYS AS (
    IFNULL(
      json_array_length(json, '$.preview'),
      0
    ) > 0
  ),
  hasContacts INTEGER NOT NULL GENERATED ALWAYS AS (
    IFNULL(
      json_array_length(json, '$.contact'),
      0
    ) > 0
  )
)
```

<details>
<summary>Index: messages → expiring_message_by_conversation_and_received_at</summary>

```sql
CREATE INDEX expiring_message_by_conversation_and_received_at ON messages (
  conversationId,
  storyId,
  expirationStartTimestamp,
  expireTimer,
  received_at
)
WHERE
  isStory IS 0
  AND type IS 'incoming'
```

</details>

<details>
<summary>Index: messages → message_user_initiated</summary>

```sql
CREATE INDEX message_user_initiated ON messages (
  conversationId,
  isUserInitiatedMessage
)
```

</details>

<details>
<summary>Index: messages → messages_activity</summary>

```sql
CREATE INDEX messages_activity ON messages (
  conversationId,
  shouldAffectActivity,
  isTimerChangeFromSync,
  isGroupLeaveEventFromOther,
  received_at,
  sent_at
)
```

</details>

<details>
<summary>Index: messages → messages_by_date_addressable</summary>

```sql
CREATE INDEX messages_by_date_addressable ON messages (
  conversationId,
  isAddressableMessage,
  received_at,
  sent_at
)
```

</details>

<details>
<summary>Index: messages → messages_by_date_addressable_nondisappearing</summary>

```sql
CREATE INDEX messages_by_date_addressable_nondisappearing ON messages (
  conversationId,
  isAddressableMessage,
  received_at,
  sent_at
)
WHERE
  expireTimer IS NULL
```

</details>

<details>
<summary>Index: messages → messages_by_distribution_list</summary>

```sql
CREATE INDEX messages_by_distribution_list ON messages (
  storyDistributionListId,
  received_at
)
WHERE
  storyDistributionListId IS NOT NULL
```

</details>

<details>
<summary>Index: messages → messages_by_storyId</summary>

```sql
CREATE INDEX messages_by_storyId ON messages (storyId)
```

</details>

<details>
<summary>Index: messages → messages_call</summary>

```sql
CREATE INDEX messages_call ON messages (
  type,
  conversationId,
  callId,
  sent_at
)
WHERE
  type IS 'call-history'
```

</details>

<details>
<summary>Index: messages → messages_callHistory_markReadBefore</summary>

```sql
CREATE INDEX messages_callHistory_markReadBefore ON messages (
  type,
  seenStatus,
  received_at DESC
)
WHERE
  type IS 'call-history'
```

</details>

<details>
<summary>Index: messages → messages_callHistory_markReadByConversationBefore</summary>

```sql
CREATE INDEX messages_callHistory_markReadByConversationBefore ON messages (
  type,
  conversationId,
  seenStatus,
  sent_at DESC
)
WHERE
  type IS 'call-history'
```

</details>

<details>
<summary>Index: messages → messages_callHistory_seenStatus</summary>

```sql
CREATE INDEX messages_callHistory_seenStatus ON messages (type, seenStatus)
WHERE
  type IS 'call-history'
```

</details>

<details>
<summary>Index: messages → messages_conversation</summary>

```sql
CREATE INDEX messages_conversation ON messages (
  conversationId,
  isStory,
  storyId,
  received_at,
  sent_at
)
```

</details>

<details>
<summary>Index: messages → messages_conversation_no_story_id</summary>

```sql
CREATE INDEX messages_conversation_no_story_id ON messages (
  conversationId,
  isStory,
  received_at,
  sent_at
)
```

</details>

<details>
<summary>Index: messages → messages_conversationId_expirationStartTimestamp</summary>

```sql
CREATE INDEX messages_conversationId_expirationStartTimestamp ON messages (
  conversationId,
  expirationStartTimestamp
)
WHERE
  hasExpireTimer IS 1
```

</details>

<details>
<summary>Index: messages → messages_expires_at</summary>

```sql
CREATE INDEX messages_expires_at ON messages (expiresAt)
```

</details>

<details>
<summary>Index: messages → messages_hasAttachments</summary>

```sql
CREATE INDEX messages_hasAttachments ON messages (
  conversationId,
  hasAttachments,
  received_at
)
WHERE
  type IS NOT 'story'
  AND storyId IS NULL
```

</details>

<details>
<summary>Index: messages → messages_hasContacts</summary>

```sql
CREATE INDEX messages_hasContacts ON messages (
  conversationId,
  received_at DESC,
  sent_at DESC
)
WHERE
  hasContacts IS 1
  AND isViewOnce IS NOT 1
  AND type IN (
    'incoming',
    'outgoing'
  )
```

</details>

<details>
<summary>Index: messages → messages_hasFileAttachments</summary>

```sql
CREATE INDEX messages_hasFileAttachments ON messages (
  conversationId,
  hasFileAttachments,
  received_at
)
WHERE
  type IS NOT 'story'
  AND storyId IS NULL
```

</details>

<details>
<summary>Index: messages → messages_hasPreviews</summary>

```sql
CREATE INDEX messages_hasPreviews ON messages (
  conversationId,
  received_at DESC,
  sent_at DESC
)
WHERE
  hasPreviews IS 1
  AND isViewOnce IS NOT 1
  AND type IN (
    'incoming',
    'outgoing'
  )
```

</details>

<details>
<summary>Index: messages → messages_hasVisualMediaAttachments</summary>

```sql
CREATE INDEX messages_hasVisualMediaAttachments ON messages (
  conversationId,
  isStory,
  storyId,
  hasVisualMediaAttachments,
  received_at,
  sent_at
)
WHERE
  hasVisualMediaAttachments IS 1
```

</details>

<details>
<summary>Index: messages → messages_id</summary>

```sql
CREATE INDEX messages_id ON messages (id ASC)
```

</details>

<details>
<summary>Index: messages → messages_isStory</summary>

```sql
CREATE INDEX messages_isStory ON messages (
  received_at,
  sent_at
)
WHERE
  isStory = 1
```

</details>

<details>
<summary>Index: messages → messages_preview</summary>

```sql
CREATE INDEX messages_preview ON messages (
  conversationId,
  shouldAffectPreview,
  isGroupLeaveEventFromOther,
  received_at,
  sent_at
)
```

</details>

<details>
<summary>Index: messages → messages_preview_without_story</summary>

```sql
CREATE INDEX messages_preview_without_story ON messages (
  conversationId,
  shouldAffectPreview,
  isGroupLeaveEventFromOther,
  received_at,
  sent_at
)
WHERE
  storyId IS NULL
```

</details>

<details>
<summary>Index: messages → messages_receipt</summary>

```sql
CREATE INDEX messages_receipt ON messages (sent_at)
```

</details>

<details>
<summary>Index: messages → messages_schemaVersion</summary>

```sql
CREATE INDEX messages_schemaVersion ON messages (schemaVersion)
```

</details>

<details>
<summary>Index: messages → messages_searchOrder</summary>

```sql
CREATE INDEX messages_searchOrder on messages (
  received_at,
  sent_at
)
```

</details>

<details>
<summary>Index: messages → messages_sourceServiceId</summary>

```sql
CREATE INDEX messages_sourceServiceId on messages (sourceServiceId)
```

</details>

<details>
<summary>Index: messages → messages_story_replies</summary>

```sql
CREATE INDEX messages_story_replies ON messages (
  storyId,
  received_at,
  sent_at
)
WHERE
  isStory IS 0
```

</details>

<details>
<summary>Index: messages → messages_unexpectedly_missing_expiration_start_timestamp</summary>

```sql
CREATE INDEX messages_unexpectedly_missing_expiration_start_timestamp ON messages (
  expireTimer,
  expirationStartTimestamp,
  type
)
WHERE
  expireTimer IS NOT NULL
  AND expirationStartTimestamp IS NULL
```

</details>

<details>
<summary>Index: messages → messages_unread</summary>

```sql
CREATE INDEX messages_unread ON messages (
  conversationId,
  readStatus,
  isStory,
  storyId,
  received_at,
  sent_at
)
WHERE
  readStatus IS NOT NULL
```

</details>

<details>
<summary>Index: messages → messages_unread_mentions</summary>

```sql
CREATE INDEX messages_unread_mentions ON messages (
  conversationId,
  readStatus,
  mentionsMe,
  isStory,
  storyId,
  received_at,
  sent_at
)
WHERE
  readStatus IS NOT NULL
```

</details>

<details>
<summary>Index: messages → messages_unread_mentions_no_story_id</summary>

```sql
CREATE INDEX messages_unread_mentions_no_story_id ON messages (
  conversationId,
  readStatus,
  mentionsMe,
  isStory,
  received_at,
  sent_at
)
WHERE
  isStory IS 0
  AND readStatus IS NOT NULL
```

</details>

<details>
<summary>Index: messages → messages_unread_no_story_id</summary>

```sql
CREATE INDEX messages_unread_no_story_id ON messages (
  conversationId,
  readStatus,
  isStory,
  received_at,
  sent_at
)
WHERE
  readStatus IS NOT NULL
```

</details>

<details>
<summary>Index: messages → messages_unread_poll_votes</summary>

```sql
CREATE INDEX messages_unread_poll_votes ON messages (
  conversationId,
  received_at
)
WHERE
  hasUnreadPollVotes = 1
  AND type IS 'outgoing'
```

</details>

<details>
<summary>Index: messages → messages_unseen_no_story</summary>

```sql
CREATE INDEX messages_unseen_no_story ON messages (
  conversationId,
  seenStatus,
  isStory,
  received_at,
  sent_at
)
WHERE
  seenStatus IS NOT NULL
```

</details>

<details>
<summary>Index: messages → messages_unseen_with_story</summary>

```sql
CREATE INDEX messages_unseen_with_story ON messages (
  conversationId,
  seenStatus,
  isStory,
  storyId,
  received_at,
  sent_at
)
WHERE
  seenStatus IS NOT NULL
```

</details>

<details>
<summary>Index: messages → messages_view_once</summary>

```sql
CREATE INDEX messages_view_once ON messages (isErased)
WHERE
  isViewOnce = 1
```

</details>

<details>
<summary>Index: messages → sqlite_autoindex_messages_1</summary>

```text
(404: SQL Not Found)
```

</details>

<details>
<summary>Trigger: messages → messages_on_delete</summary>

```sql
CREATE TRIGGER messages_on_delete AFTER DELETE ON messages BEGIN
DELETE FROM messages_fts
WHERE
  rowid = old.rowid;

DELETE FROM sendLogPayloads
WHERE
  id IN (
    SELECT
      payloadId
    FROM
      sendLogMessageIds
    WHERE
      messageId = old.id
  );

DELETE FROM reactions
WHERE
  rowid IN (
    SELECT
      rowid
    FROM
      reactions
    WHERE
      messageId = old.id
  );

DELETE FROM storyReads
WHERE
  storyId = old.storyId;

END
```

</details>

<details>
<summary>Trigger: messages → messages_on_insert</summary>

```sql
CREATE TRIGGER messages_on_insert AFTER INSERT ON messages WHEN new.isSearchable IS 1 BEGIN
INSERT INTO
  messages_fts (rowid, body)
VALUES
  (
    new.rowid,
    new.searchableText
  );

END
```

</details>

<details>
<summary>Trigger: messages → messages_on_insert_insert_mentions</summary>

```sql
CREATE TRIGGER messages_on_insert_insert_mentions AFTER INSERT ON messages BEGIN
INSERT INTO
  mentions (
    messageId,
    mentionAci,
    start,
    length
  )
SELECT
  messages.id,
  bodyRanges.value ->> 'mentionAci' as mentionAci,
  bodyRanges.value ->> 'start' as start,
  bodyRanges.value ->> 'length' as length
FROM
  messages,
  json_each(
    messages.json ->> 'bodyRanges'
  ) as bodyRanges
WHERE
  bodyRanges.value ->> 'mentionAci' IS NOT NULL
  AND messages.id = new.id;

END
```

</details>

<details>
<summary>Trigger: messages → messages_on_update</summary>

```sql
CREATE TRIGGER messages_on_update AFTER
UPDATE ON messages WHEN new.isSearchable IS 1
AND old.searchableText IS NOT new.searchableText BEGIN
UPDATE messages_fts
SET
  body = new.searchableText
WHERE
  rowId = new.rowId;

END
```

</details>

<details>
<summary>Trigger: messages → messages_on_update_update_mentions</summary>

```sql
CREATE TRIGGER messages_on_update_update_mentions AFTER
UPDATE ON messages BEGIN
DELETE FROM mentions
WHERE
  messageId = new.id;

INSERT INTO
  mentions (
    messageId,
    mentionAci,
    start,
    length
  )
SELECT
  messages.id,
  bodyRanges.value ->> 'mentionAci' as mentionAci,
  bodyRanges.value ->> 'start' as start,
  bodyRanges.value ->> 'length' as length
FROM
  messages,
  json_each(
    messages.json ->> 'bodyRanges'
  ) as bodyRanges
WHERE
  bodyRanges.value ->> 'mentionAci' IS NOT NULL
  AND messages.id = new.id;

END
```

</details>

<details>
<summary>Trigger: messages → messages_on_view_once_update</summary>

```sql
CREATE TRIGGER messages_on_view_once_update AFTER
UPDATE ON messages WHEN new.body IS NOT NULL
AND new.isViewOnce = 1 BEGIN
DELETE FROM messages_fts
WHERE
  rowid = old.rowid;

END
```

</details>

---

</details>

<details>
<summary>Table: messages_fts</summary>

```sql
CREATE VIRTUAL TABLE messages_fts USING fts5 (
  body,
  tokenize = 'signal_tokenizer'
)
```

---

</details>

<details>
<summary>Table: messages_fts_config</summary>

```sql
CREATE TABLE 'messages_fts_config' (k PRIMARY KEY, v) WITHOUT ROWID
```

<details>
<summary>Index: messages_fts_config → sqlite_autoindex_messages_fts_config_1</summary>

```text
(404: SQL Not Found)
```

</details>

---

</details>

<details>
<summary>Table: messages_fts_content</summary>

```sql
CREATE TABLE 'messages_fts_content' (
  id INTEGER PRIMARY KEY,
  c0
)
```

---

</details>

<details>
<summary>Table: messages_fts_data</summary>

```sql
CREATE TABLE 'messages_fts_data' (
  id INTEGER PRIMARY KEY,
  block BLOB
)
```

---

</details>

<details>
<summary>Table: messages_fts_docsize</summary>

```sql
CREATE TABLE 'messages_fts_docsize' (
  id INTEGER PRIMARY KEY,
  sz BLOB
)
```

---

</details>

<details>
<summary>Table: messages_fts_idx</summary>

```sql
CREATE TABLE 'messages_fts_idx' (
  segid,
  term,
  pgno,
  PRIMARY KEY (segid, term)
) WITHOUT ROWID
```

<details>
<summary>Index: messages_fts_idx → sqlite_autoindex_messages_fts_idx_1</summary>

```text
(404: SQL Not Found)
```

</details>

---

</details>

<details>
<summary>Table: notificationProfiles</summary>

```sql
CREATE TABLE notificationProfiles (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  emoji TEXT,
  /* A numeric representation of a color, like 0xAARRGGBB */
  color INTEGER NOT NULL,
  createdAtMs INTEGER NOT NULL,
  allowAllCalls INTEGER NOT NULL,
  allowAllMentions INTEGER NOT NULL,
  /* A JSON array of conversationId strings */
  allowedMembersJson TEXT NOT NULL,
  scheduleEnabled INTEGER NOT NULL,
  /* 24-hour clock int, 0000-2359 (e.g., 15, 900, 1130, 2345) */
  scheduleStartTime INTEGER,
  scheduleEndTime INTEGER,
  /* A JSON object with true/false for each of the numbers in the Protobuf enum */
  scheduleDaysEnabledJson TEXT,
  deletedAtTimestampMs INTEGER,
  storageID TEXT,
  storageVersion INTEGER,
  storageUnknownFields BLOB,
  storageNeedsSync INTEGER NOT NULL DEFAULT 0
) STRICT
```

<details>
<summary>Index: notificationProfiles → sqlite_autoindex_notificationProfiles_1</summary>

```text
(404: SQL Not Found)
```

</details>

---

</details>

<details>
<summary>Table: pinnedMessages</summary>

```sql
CREATE TABLE pinnedMessages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversationId TEXT NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
  messageId TEXT NOT NULL REFERENCES messages (id) ON DELETE CASCADE,
  pinnedAt INTEGER NOT NULL,
  expiresAt INTEGER,
  UNIQUE (
    conversationId,
    messageId
  )
) STRICT
```

<details>
<summary>Index: pinnedMessages → pinnedMessages_byConversation</summary>

```sql
CREATE INDEX pinnedMessages_byConversation ON pinnedMessages (
  conversationId,
  pinnedAt DESC,
  messageId
)
```

</details>

<details>
<summary>Index: pinnedMessages → pinnedMessages_byExpiresAt</summary>

```sql
CREATE INDEX pinnedMessages_byExpiresAt ON pinnedMessages (expiresAt ASC)
WHERE
  expiresAt IS NOT NULL
```

</details>

<details>
<summary>Index: pinnedMessages → sqlite_autoindex_pinnedMessages_1</summary>

```text
(404: SQL Not Found)
```

</details>

---

</details>

<details>
<summary>Table: preKeys</summary>

```sql
CREATE TABLE preKeys (
  id STRING PRIMARY KEY ASC,
  json TEXT,
  ourServiceId NUMBER GENERATED ALWAYS AS (
    json_extract(
      json,
      '$.ourServiceId'
    )
  )
)
```

<details>
<summary>Index: preKeys → preKeys_ourServiceId</summary>

```sql
CREATE INDEX preKeys_ourServiceId ON preKeys (ourServiceId)
```

</details>

<details>
<summary>Index: preKeys → sqlite_autoindex_preKeys_1</summary>

```text
(404: SQL Not Found)
```

</details>

---

</details>

<details>
<summary>Table: reactions</summary>

```sql
CREATE TABLE reactions (
  conversationId STRING,
  emoji STRING,
  fromId STRING,
  messageReceivedAt INTEGER,
  targetAuthorAci STRING,
  targetTimestamp INTEGER,
  unread INTEGER,
  messageId STRING,
  timestamp NUMBER
)
```

<details>
<summary>Index: reactions → reaction_identifier</summary>

```sql
CREATE INDEX reaction_identifier ON reactions (
  emoji,
  targetAuthorAci,
  targetTimestamp
)
```

</details>

<details>
<summary>Index: reactions → reactions_byTimestamp</summary>

```sql
CREATE INDEX reactions_byTimestamp ON reactions (fromId, timestamp)
```

</details>

<details>
<summary>Index: reactions → reactions_messageId</summary>

```sql
CREATE INDEX reactions_messageId ON reactions (messageId)
```

</details>

<details>
<summary>Index: reactions → reactions_unread</summary>

```sql
CREATE INDEX reactions_unread ON reactions (
  conversationId,
  unread
)
```

</details>

---

</details>

<details>
<summary>Table: recentEmojis</summary>

```sql
CREATE TABLE recentEmojis (
  emoji TEXT NOT NULL PRIMARY KEY,
  lastUsedAt INTEGER NOT NULL
) STRICT
```

<details>
<summary>Index: recentEmojis → recentEmojis_order</summary>

```sql
CREATE INDEX recentEmojis_order ON recentEmojis (lastUsedAt DESC)
```

</details>

<details>
<summary>Index: recentEmojis → sqlite_autoindex_recentEmojis_1</summary>

```text
(404: SQL Not Found)
```

</details>

---

</details>

<details>
<summary>Table: recentGifs</summary>

```sql
CREATE TABLE recentGifs (
  id TEXT NOT NULL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  previewMedia_url TEXT NOT NULL,
  previewMedia_width INTEGER NOT NULL,
  previewMedia_height INTEGER NOT NULL,
  attachmentMedia_url TEXT NOT NULL,
  attachmentMedia_width INTEGER NOT NULL,
  attachmentMedia_height INTEGER NOT NULL,
  lastUsedAt INTEGER NOT NULL
) STRICT
```

<details>
<summary>Index: recentGifs → recentGifs_order</summary>

```sql
CREATE INDEX recentGifs_order ON recentGifs (lastUsedAt DESC)
```

</details>

<details>
<summary>Index: recentGifs → sqlite_autoindex_recentGifs_1</summary>

```text
(404: SQL Not Found)
```

</details>

---

</details>

<details>
<summary>Table: senderKeys</summary>

```sql
CREATE TABLE senderKeys (
  id TEXT PRIMARY KEY NOT NULL,
  senderId TEXT NOT NULL,
  distributionId TEXT NOT NULL,
  data BLOB NOT NULL,
  lastUpdatedDate NUMBER NOT NULL
)
```

<details>
<summary>Index: senderKeys → sqlite_autoindex_senderKeys_1</summary>

```text
(404: SQL Not Found)
```

</details>

---

</details>

<details>
<summary>Table: sendLogMessageIds</summary>

```sql
CREATE TABLE sendLogMessageIds (
  payloadId INTEGER NOT NULL,
  messageId STRING NOT NULL,
  PRIMARY KEY (
    payloadId,
    messageId
  ),
  CONSTRAINT sendLogMessageIdsForeignKey FOREIGN KEY (payloadId) REFERENCES sendLogPayloads (id) ON DELETE CASCADE
)
```

<details>
<summary>Index: sendLogMessageIds → sendLogMessageIdsByMessage</summary>

```sql
CREATE INDEX sendLogMessageIdsByMessage ON sendLogMessageIds (messageId)
```

</details>

<details>
<summary>Index: sendLogMessageIds → sqlite_autoindex_sendLogMessageIds_1</summary>

```text
(404: SQL Not Found)
```

</details>

---

</details>

<details>
<summary>Table: sendLogPayloads</summary>

```sql
CREATE TABLE sendLogPayloads (
  id INTEGER PRIMARY KEY ASC,
  timestamp INTEGER NOT NULL,
  contentHint INTEGER NOT NULL,
  proto BLOB NOT NULL,
  urgent INTEGER,
  hasPniSignatureMessage INTEGER DEFAULT 0 NOT NULL
)
```

<details>
<summary>Index: sendLogPayloads → sendLogPayloadsByTimestamp</summary>

```sql
CREATE INDEX sendLogPayloadsByTimestamp ON sendLogPayloads (timestamp)
```

</details>

---

</details>

<details>
<summary>Table: sendLogRecipients</summary>

```sql
CREATE TABLE sendLogRecipients (
  payloadId INTEGER NOT NULL,
  recipientServiceId STRING NOT NULL,
  deviceId INTEGER NOT NULL,
  PRIMARY KEY (
    payloadId,
    recipientServiceId,
    deviceId
  ),
  CONSTRAINT sendLogRecipientsForeignKey FOREIGN KEY (payloadId) REFERENCES sendLogPayloads (id) ON DELETE CASCADE
)
```

<details>
<summary>Index: sendLogRecipients → sendLogRecipientsByRecipient</summary>

```sql
CREATE INDEX sendLogRecipientsByRecipient ON sendLogRecipients (
  recipientServiceId,
  deviceId
)
```

</details>

<details>
<summary>Index: sendLogRecipients → sqlite_autoindex_sendLogRecipients_1</summary>

```text
(404: SQL Not Found)
```

</details>

---

</details>

<details>
<summary>Table: sessions</summary>

```sql
CREATE TABLE sessions (
  id TEXT NOT NULL PRIMARY KEY,
  ourServiceId TEXT NOT NULL,
  serviceId TEXT NOT NULL,
  conversationId TEXT NOT NULL,
  deviceId INTEGER NOT NULL,
  record BLOB NOT NULL
) STRICT
```

<details>
<summary>Index: sessions → sqlite_autoindex_sessions_1</summary>

```text
(404: SQL Not Found)
```

</details>

---

</details>

<details>
<summary>Table: signedPreKeys</summary>

```sql
CREATE TABLE signedPreKeys (
  id STRING PRIMARY KEY ASC,
  json TEXT,
  ourServiceId NUMBER GENERATED ALWAYS AS (
    json_extract(
      json,
      '$.ourServiceId'
    )
  )
)
```

<details>
<summary>Index: signedPreKeys → signedPreKeys_ourServiceId</summary>

```sql
CREATE INDEX signedPreKeys_ourServiceId ON signedPreKeys (ourServiceId)
```

</details>

<details>
<summary>Index: signedPreKeys → sqlite_autoindex_signedPreKeys_1</summary>

```text
(404: SQL Not Found)
```

</details>

---

</details>

<details>
<summary>Table: sqlite_sequence</summary>

```sql
CREATE TABLE sqlite_sequence (name, seq)
```

---

</details>

<details>
<summary>Table: sqlite_stat1</summary>

```sql
CREATE TABLE sqlite_stat1 (tbl, idx, stat)
```

---

</details>

<details>
<summary>Table: sqlite_stat4</summary>

```sql
CREATE TABLE sqlite_stat4 (
  tbl,
  idx,
  neq,
  nlt,
  ndlt,
  sample
)
```

---

</details>

<details>
<summary>Table: sticker_packs</summary>

```sql
CREATE TABLE sticker_packs (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL,
  author STRING,
  coverStickerId INTEGER,
  createdAt INTEGER,
  downloadAttempts INTEGER,
  installedAt INTEGER,
  lastUsed INTEGER,
  status STRING,
  stickerCount INTEGER,
  title STRING,
  attemptedStatus STRING,
  position INTEGER DEFAULT 0 NOT NULL,
  storageID STRING,
  storageVersion INTEGER,
  storageUnknownFields BLOB,
  storageNeedsSync INTEGER DEFAULT 0 NOT NULL
)
```

<details>
<summary>Index: sticker_packs → sqlite_autoindex_sticker_packs_1</summary>

```text
(404: SQL Not Found)
```

</details>

<details>
<summary>Index: sticker_packs → sticker_packs_by_position_and_id</summary>

```sql
CREATE INDEX sticker_packs_by_position_and_id ON sticker_packs (
  position ASC,
  id ASC
)
```

</details>

---

</details>

<details>
<summary>Table: sticker_references</summary>

```sql
CREATE TABLE sticker_references (
  messageId STRING,
  packId TEXT,
  stickerId INTEGER NOT NULL DEFAULT -1,
  isUnresolved INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT sticker_references_fk FOREIGN KEY (packId) REFERENCES sticker_packs (id) ON DELETE CASCADE
)
```

<details>
<summary>Index: sticker_references → unresolved_sticker_refs</summary>

```sql
CREATE INDEX unresolved_sticker_refs ON sticker_references (packId, stickerId)
WHERE
  isUnresolved IS 1
```

</details>

---

</details>

<details>
<summary>Table: stickers</summary>

```sql
CREATE TABLE stickers (
  id INTEGER NOT NULL,
  packId TEXT NOT NULL,
  emoji STRING,
  height INTEGER,
  isCoverOnly INTEGER,
  lastUsed INTEGER,
  path STRING,
  width INTEGER,
  version INTEGER NOT NULL DEFAULT 1,
  localKey TEXT,
  size INTEGER,
  PRIMARY KEY (id, packId),
  CONSTRAINT stickers_fk FOREIGN KEY (packId) REFERENCES sticker_packs (id) ON DELETE CASCADE
)
```

<details>
<summary>Index: stickers → sqlite_autoindex_stickers_1</summary>

```text
(404: SQL Not Found)
```

</details>

<details>
<summary>Index: stickers → stickers_recents</summary>

```sql
CREATE INDEX stickers_recents ON stickers (lastUsed)
WHERE
  lastUsed IS NOT NULL
```

</details>

---

</details>

<details>
<summary>Table: storyDistributionMembers</summary>

```sql
CREATE TABLE storyDistributionMembers (
  listId STRING NOT NULL REFERENCES storyDistributions (id) ON DELETE CASCADE ON UPDATE CASCADE,
  serviceId STRING NOT NULL,
  PRIMARY KEY (listId, serviceId)
)
```

<details>
<summary>Index: storyDistributionMembers → sqlite_autoindex_storyDistributionMembers_1</summary>

```text
(404: SQL Not Found)
```

</details>

---

</details>

<details>
<summary>Table: storyDistributions</summary>

```sql
CREATE TABLE storyDistributions (
  id STRING PRIMARY KEY NOT NULL,
  name TEXT,
  senderKeyInfoJson STRING,
  deletedAtTimestamp INTEGER,
  allowsReplies INTEGER,
  isBlockList INTEGER,
  storageID STRING,
  storageVersion INTEGER,
  storageUnknownFields BLOB,
  storageNeedsSync INTEGER
)
```

<details>
<summary>Index: storyDistributions → sqlite_autoindex_storyDistributions_1</summary>

```text
(404: SQL Not Found)
```

</details>

---

</details>

<details>
<summary>Table: storyReads</summary>

```sql
CREATE TABLE storyReads (
  authorId STRING NOT NULL,
  conversationId STRING NOT NULL,
  storyId STRING NOT NULL,
  storyReadDate NUMBER NOT NULL,
  PRIMARY KEY (authorId, storyId)
)
```

<details>
<summary>Index: storyReads → sqlite_autoindex_storyReads_1</summary>

```text
(404: SQL Not Found)
```

</details>

<details>
<summary>Index: storyReads → storyReads_data</summary>

```sql
CREATE INDEX storyReads_data ON storyReads (
  storyReadDate,
  authorId,
  conversationId
)
```

</details>

<details>
<summary>Index: storyReads → storyReads_storyId</summary>

```sql
CREATE INDEX storyReads_storyId ON storyReads (storyId)
```

</details>

---

</details>

<details>
<summary>Table: syncTasks</summary>

```sql
CREATE TABLE syncTasks (
  id TEXT PRIMARY KEY NOT NULL,
  attempts INTEGER NOT NULL,
  createdAt INTEGER NOT NULL,
  data TEXT NOT NULL,
  envelopeId TEXT NOT NULL,
  sentAt INTEGER NOT NULL,
  type TEXT NOT NULL
) STRICT
```

<details>
<summary>Index: syncTasks → sqlite_autoindex_syncTasks_1</summary>

```text
(404: SQL Not Found)
```

</details>

<details>
<summary>Index: syncTasks → syncTasks_delete</summary>

```sql
CREATE INDEX syncTasks_delete ON syncTasks (attempts DESC)
```

</details>

<details>
<summary>Index: syncTasks → syncTasks_type</summary>

```sql
CREATE INDEX syncTasks_type ON syncTasks (type)
```

</details>

---

</details>

<details>
<summary>Table: uninstalled_sticker_packs</summary>

```sql
CREATE TABLE uninstalled_sticker_packs (
  id STRING NOT NULL PRIMARY KEY,
  uninstalledAt NUMBER NOT NULL,
  storageID STRING,
  storageVersion NUMBER,
  storageUnknownFields BLOB,
  storageNeedsSync INTEGER NOT NULL
)
```

<details>
<summary>Index: uninstalled_sticker_packs → sqlite_autoindex_uninstalled_sticker_packs_1</summary>

```text
(404: SQL Not Found)
```

</details>

---

</details>

<details>
<summary>Table: unprocessed</summary>

```sql
CREATE TABLE unprocessed (
  id TEXT NOT NULL PRIMARY KEY ASC,
  type INTEGER NOT NULL,
  timestamp INTEGER NOT NULL,
  attempts INTEGER NOT NULL,
  receivedAtCounter INTEGER NOT NULL,
  urgent INTEGER NOT NULL,
  story INTEGER NOT NULL,
  serverGuid TEXT NOT NULL,
  serverTimestamp INTEGER NOT NULL,
  isEncrypted INTEGER NOT NULL,
  content BLOB NOT NULL,
  messageAgeSec INTEGER NOT NULL,
  destinationServiceId TEXT NOT NULL,
  -- Not present for 1:1 messages and not sealed messages
  groupId TEXT,
  -- Not present for sealed envelopes
  reportingToken BLOB,
  source TEXT,
  sourceServiceId TEXT,
  updatedPni TEXT,
  sourceDevice INTEGER,
  receivedAtDate INTEGER DEFAULT 0 NOT NULL
) STRICT
```

<details>
<summary>Index: unprocessed → sqlite_autoindex_unprocessed_1</summary>

```text
(404: SQL Not Found)
```

</details>

<details>
<summary>Index: unprocessed → unprocessed_byReceivedAtCounter</summary>

```sql
CREATE INDEX unprocessed_byReceivedAtCounter ON unprocessed (receivedAtCounter)
```

</details>

<details>
<summary>Index: unprocessed → unprocessed_byReceivedAtDate</summary>

```sql
CREATE INDEX unprocessed_byReceivedAtDate ON unprocessed (receivedAtDate)
```

</details>

---

</details>
