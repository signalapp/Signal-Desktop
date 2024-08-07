// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { CallLinkRootKey } from '@signalapp/ringrtc';
import type { CallLinkUpdateSyncEvent } from '../textsecure/messageReceiverEvents';
import * as log from '../logging/log';
import * as Errors from '../types/errors';
import { fromAdminKeyBytes } from './callLinks';
import { getRoomIdFromRootKey } from './callLinksRingrtc';
import { strictAssert } from './assert';
import { CallLinkUpdateSyncType } from '../types/CallLink';
import { DataWriter } from '../sql/Client';

export async function onCallLinkUpdateSync(
  syncEvent: CallLinkUpdateSyncEvent
): Promise<void> {
  const { callLinkUpdate, confirm } = syncEvent;
  const { type, rootKey, adminKey } = callLinkUpdate;

  if (!rootKey) {
    log.warn('onCallLinkUpdateSync: Missing rootKey, invalid sync message');
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
    log.error('onCallLinkUpdateSync: Could not parse root key');
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
      log.info(`${logId}: Deleting call link record ${roomId}`);
      await DataWriter.deleteCallLinkFromSync(roomId);
      window.reduxActions.calling.handleCallLinkDelete({ roomId });
    }

    confirm();
  } catch (err) {
    log.error(`${logId}: Failed to process`, Errors.toLogFormat(err));
  }
}
