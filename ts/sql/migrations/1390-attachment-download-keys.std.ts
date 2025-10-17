// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { type WritableDB } from '../Interface.std.js';

export default function updateToSchemaVersion1390(db: WritableDB): void {
  // TODO: DESKTOP-8879 Digest column is only used for deduplication purposes; here we
  // genericize its name to attachmentSignature to allow jobs to be added with
  // plaintextHash and no digest
  db.exec(`
      ALTER TABLE attachment_downloads
          RENAME COLUMN digest TO attachmentSignature;
  `);

  // We no longer these need columns due to the new mediaName derivation
  db.exec(`
    ALTER TABLE message_attachments
      DROP COLUMN iv;
    ALTER TABLE message_attachments
      DROP COLUMN isReencryptableToSameDigest;
    ALTER TABLE message_attachments
      DROP COLUMN reencryptionIv;
    ALTER TABLE message_attachments
      DROP COLUMN reencryptionKey;
    ALTER TABLE message_attachments
      DROP COLUMN reencryptionDigest;
    ALTER TABLE message_attachments
      DROP COLUMN backupMediaName;
  `);

  // Because mediaName has changed, backupCdnNumber is no longer accurate
  db.exec(`
    UPDATE message_attachments
      SET backupCdnNumber = NULL;
  `);
}
