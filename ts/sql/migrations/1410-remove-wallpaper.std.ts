// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { type WritableDB } from '../Interface.std.js';

export default function updateToSchemaVersion1410(db: WritableDB): void {
  db.exec(`
    UPDATE conversations
      SET json = json_remove(json,
        '$.wallpaperPreset',
        '$.wallpaperPhotoPointerBase64',
        '$.dimWallpaperInDarkMode',
        '$.autoBubbleColor'
      );

    DELETE FROM items
      WHERE id IN (
        'defaultWallpaperPhotoPointer',
        'defaultWallpaperPreset',
        'defaultDimWallpaperInDarkMode',
        'defaultAutoBubbleColor'
      );
  `);
}
