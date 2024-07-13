// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { CallLinkRootKey } from '@signalapp/ringrtc';
import type { CallLinkUpdateSyncEvent } from '../textsecure/messageReceiverEvents';
import * as log from '../logging/log';
import * as Errors from '../types/errors';
import { fromAdminKeyBytes, getRoomIdFromRootKey } from './callLinks';
import { strictAssert } from './assert';
import { CallLinkUpdateSyncType } from '../types/CallLink';

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
      // TODO: DESKTOP-6951
      log.warn(`${logId}: Deleting call links is not supported`);
    }
  } catch (err) {
    log.error(`${logId}: Failed to process`, Errors.toLogFormat(err));
  }

  confirm();
}
