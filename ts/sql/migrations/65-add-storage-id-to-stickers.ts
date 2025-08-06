// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from '@signalapp/sqlcipher';

export default function updateToSchemaVersion65(db: Database): void {
  db.exec(
    `
    ALTER TABLE sticker_packs ADD COLUMN position INTEGER DEFAULT 0 NOT NULL;
    ALTER TABLE sticker_packs ADD COLUMN storageID STRING;
    ALTER TABLE sticker_packs ADD COLUMN storageVersion INTEGER;
    ALTER TABLE sticker_packs ADD COLUMN storageUnknownFields BLOB;
    ALTER TABLE sticker_packs
    ADD COLUMN storageNeedsSync
    INTEGER DEFAULT 0 NOT NULL;

    CREATE TABLE uninstalled_sticker_packs (
      id STRING NOT NULL PRIMARY KEY,
      uninstalledAt NUMBER NOT NULL,
      storageID STRING,
      storageVersion NUMBER,
      storageUnknownFields BLOB,
      storageNeedsSync INTEGER NOT NULL
    );

    -- Set initial position

    UPDATE sticker_packs
    SET
      position = (row_number - 1),
      storageNeedsSync = 1
    FROM (
      SELECT id, row_number() OVER (ORDER BY lastUsed DESC) as row_number
      FROM sticker_packs
    ) as ordered_pairs
    WHERE sticker_packs.id IS ordered_pairs.id;

    -- See: getAllStickerPacks

    CREATE INDEX sticker_packs_by_position_and_id ON sticker_packs (
      position ASC,
      id ASC
    );
    `
  );
}
