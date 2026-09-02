// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { CallLinkRootKey } from '@signalapp/ringrtc';
import { createLogger } from '../logging/log.std.ts';
import * as Errors from '../types/errors.std.ts';
import { fromAdminKeyBytes } from './callLinks.std.ts';
import { getRoomIdFromRootKey } from './callLinksRingrtc.node.ts';
import { strictAssert } from './assert.std.ts';
import { CallLinkUpdateSyncType } from '../types/CallLink.std.ts';
import { DataWriter, DataReader } from '../sql/Client.preload.ts';
import { drop } from './drop.std.ts';

import type { CallLinkUpdateSyncEvent } from '../textsecure/messageReceiverEvents.std.ts';
import { callLinkCleanupService } from '../services/expiring/callLinkCleanupService.preload.ts';
import { defunctCallLinkCleanupService } from '../services/expiring/defunctCallLinkCleanupService.preload.ts';

const log = createLogger('onCallLinkUpdateSync');

export async function onCallLinkUpdateSync(
  syncEvent: CallLinkUpdateSyncEvent
): Promise<void> {
  const { callLinkUpdate, confirm } = syncEvent;
  const { type, rootKey, adminKey, timestamp } = callLinkUpdate;

  if (!rootKey) {
    log.warn('Missing rootKey, invalid sync message');
    return;
  }

  let callLinkRootKey: CallLinkRootKey;
  let roomId: string;
  try {
    callLinkRootKey = CallLinkRootKey.fromBytes(rootKey);
    roomId = getRoomIdFromRootKey(callLinkRootKey);
    strictAssert(
      roomId,
      'onCallLinkUpdateSync: roomId is required in sync message'
    );
  } catch (err) {
    log.error('Could not parse root key');
    return;
  }

  const logId = `onCallLinkUpdateSync(${roomId}, ${type})`;
  log.info(`${logId}: Processing`);

  try {
    if (type === CallLinkUpdateSyncType.Update) {
      const rootKeyString = callLinkRootKey.toString();
      const adminKeyString = adminKey ? fromAdminKeyBytes(adminKey) : null;
      window.reduxActions.calling.handleCallLinkUpdate({
        rootKey: rootKeyString,
        adminKey: adminKeyString,
      });
    } else if (type === CallLinkUpdateSyncType.Delete) {
      if (await DataReader.callLinkExists(roomId)) {
        log.info(`${logId}: Marking call link ${roomId} deleted`);
        await DataWriter.markCallLinkDeleted(roomId, timestamp);
        drop(
          callLinkCleanupService.trigger('onCallLinkUpdateSync, marked deleted')
        );
      } else {
        const defunctCallLink =
          await DataReader.getDefunctCallLinkByRoomId(roomId);
        if (defunctCallLink && defunctCallLink.addedAt > timestamp) {
          log.info(
            `${logId}: Updating timestamp for defunct call link ${roomId}`
          );
          const updated = { ...defunctCallLink, addedAt: timestamp };
          await DataWriter.updateDefunctCallLink(updated);
          drop(
            defunctCallLinkCleanupService.trigger(
              'onCallLinkUpdateSync, updated addedAt'
            )
          );
        } else if (!defunctCallLink) {
          log.info(`${logId}: No local record for deleted call link ${roomId}`);
        }
      }

      window.reduxActions.calling.handleCallLinkDelete({ roomId });
    }

    confirm();
  } catch (err) {
    log.error(`${logId}: Failed to process`, Errors.toLogFormat(err));
  }
}
