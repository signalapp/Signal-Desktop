// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { LoggerType } from '../../types/Logging';
import { type WritableDB } from '../Interface';

export const version = 1410;

export function updateToSchemaVersion1410(
  currentVersion: number,
  db: WritableDB,
  logger: LoggerType
): void {
  if (currentVersion >= 1410) {
    return;
  }

  db.transaction(() => {
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

    db.pragma('user_version = 1410');
  })();

  logger.info('updateToSchemaVersion1410: success!');
}
