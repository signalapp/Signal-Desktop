// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { app, ipcMain as ipc, Notification } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';

import { createLogger } from '../ts/logging/log.std.ts';
import type { MacNotificationData } from '../ts/services/notifications.preload.ts';
import { NotificationType } from '../ts/types/notifications.std.ts';
import { getAppRootDir } from '../ts/util/appRootDir.main.ts';
import { missingCaseError } from '../ts/util/missingCaseError.std.ts';
import OS from '../ts/util/os/osMain.node.ts';
import { getNotificationRouteUrl } from './getNotificationRouteUrl.std.ts';

const log = createLogger('MacNotifications');

const SOUND_FILES = {
  pop: 'signal-pop.caf',
  triTone: 'signal-tri-tone.caf',
} as const;

// Mirrors getSoundTypeFor() in services/notifications.preload.ts
export function soundFileFor(type: NotificationType): string {
  switch (type) {
    case NotificationType.Message:
    case NotificationType.Reaction:
    case NotificationType.UnreadReminder:
      return SOUND_FILES.pop;
    case NotificationType.IncomingCall:
    case NotificationType.IncomingGroupCall:
    case NotificationType.IsPresenting:
      return SOUND_FILES.triTone;
    default:
      throw missingCaseError(type);
  }
}

function installSounds(): void {
  const sourceDir = join(getAppRootDir(), 'sounds');
  const targetDir = join(app.getPath('home'), 'Library', 'Sounds');
  mkdirSync(targetDir, { recursive: true });
  for (const name of Object.values(SOUND_FILES)) {
    const bytes = readFileSync(join(sourceDir, name));
    const target = join(targetDir, name);
    if (!existsSync(target) || !readFileSync(target).equals(bytes)) {
      writeFileSync(target, bytes);
    }
  }
}

export function initialize({
  onNotificationClicked,
}: {
  onNotificationClicked: (notificationUrl: URL) => void;
}): void {
  if (!OS.isMacOS() || !Notification.isSupported()) {
    return;
  }

  // macOS does not resolve notification sound names from the app bundle, only
  //   from ~/Library/Sounds, so install the files there before the first
  //   notification; a failed lookup is cached by name until the daemon restarts.
  try {
    installSounds();
  } catch (error) {
    log.warn(`Mac Notifications: Failed to install sounds: ${error.stack}`);
  }

  // Electron removes a delivered notification from Notification Center when its
  //   object is destroyed, so keep a reference until it is replaced or cleared.
  let current: Notification | undefined;

  ipc.handle(
    'mac-notifications:show',
    (_event: IpcMainInvokeEvent, data: MacNotificationData) => {
      try {
        // Just one notification at a time
        current?.close();

        const n = new Notification({
          title: data.heading,
          body: data.body,
          icon: data.avatarPath,
          silent: data.silent,
          sound: soundFileFor(data.type),
        });

        // On Windows, clicking a toast makes the OS launch Signal with an sgnl://
        //   URL, which main already handles. On macOS the click only arrives as
        //   this event, so build the same URL here and hand it to main's
        //   callback; main.main.ts imports this module, so this module can't
        //   import showWindow/handleSignalRoute from it.
        n.on('click', () =>
          onNotificationClicked(getNotificationRouteUrl(data.type, data.token))
        );
        n.on('failed', (_e, error) => {
          log.warn(`Mac Notifications: Notification failed: ${error}`);
        });

        n.show();
        current = n;
      } catch (error) {
        log.error(
          `Mac Notifications: Failed to show notification: ${error.stack}`
        );
      }
    }
  );

  ipc.handle('mac-notifications:clear-all', () => {
    try {
      current?.close();
      current = undefined;
    } catch (error) {
      log.error(
        `Mac Notifications: Failed to clear notifications: ${error.stack}`
      );
    }
  });
}
