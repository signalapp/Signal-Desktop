// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { CallLinkRootKey } from '@signalapp/ringrtc';
import type { CallLinkUpdateSyncEvent } from '../textsecure/messageReceiverEvents.std.js';
import { createLogger } from '../logging/log.std.js';
import * as Errors from '../types/errors.std.js';
import { fromAdminKeyBytes } from './callLinks.std.js';
import {
  fromEpochBytes,
  getRoomIdFromRootKey,
} from './callLinksRingrtc.node.js';
import { strictAssert } from './assert.std.js';
import { CallLinkUpdateSyncType } from '../types/CallLink.std.js';
import { DataWriter } from '../sql/Client.preload.js';

const log = createLogger('onCallLinkUpdateSync');

export async function onCallLinkUpdateSync(
  syncEvent: CallLinkUpdateSyncEvent
): Promise<void> {
  const { callLinkUpdate, confirm } = syncEvent;
  const { type, rootKey, epoch, adminKey } = callLinkUpdate;

  if (!rootKey) {
    log.warn('Missing rootKey, invalid sync message');
    return;
  }

  let callLinkRootKey: CallLinkRootKey;
  let roomId: string;
  try {
    callLinkRootKey = CallLinkRootKey.fromBytes(rootKey as Buffer);
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
      const epochString = epoch ? fromEpochBytes(epoch) : null;
      const adminKeyString = adminKey ? fromAdminKeyBytes(adminKey) : null;
      window.reduxActions.calling.handleCallLinkUpdate({
        rootKey: rootKeyString,
        epoch: epochString,
        adminKey: adminKeyString,
      });
    } else if (type === CallLinkUpdateSyncType.Delete) {
      log.info(`${logId}: Deleting call link record ${roomId}`);
      await DataWriter.deleteCallLinkFromSync(roomId);
      window.reduxActions.calling.handleCallLinkDelete({ roomId });
    }

    confirm();
  } catch (err) {
    log.error(`${logId}: Failed to process`, Errors.toLogFormat(err));
  }
}
