// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ContentHint } from '@signalapp/libsignal-client';

import * as Bytes from '../Bytes.std.js';
import { CallLinkUpdateSyncType } from '../types/CallLink.std.js';
import { createLogger } from '../logging/log.std.js';
import * as Errors from '../types/errors.std.js';
import { SignalService as Proto } from '../protobuf/index.std.js';
import { singleProtoJobQueue } from '../jobs/singleProtoJobQueue.preload.js';
import { MessageSender } from '../textsecure/SendMessage.preload.js';
import { toAdminKeyBytes } from './callLinks.std.js';
import { toEpochBytes, toRootKeyBytes } from './callLinksRingrtc.node.js';
import { itemStorage } from '../textsecure/Storage.preload.js';

const log = createLogger('sendCallLinkUpdateSync');

export type sendCallLinkUpdateSyncCallLinkType = {
  rootKey: string;
  epoch: string | null;
  adminKey: string | null;
};

export async function sendCallLinkUpdateSync(
  callLink: sendCallLinkUpdateSyncCallLinkType
): Promise<void> {
  return _sendCallLinkUpdateSync(callLink, CallLinkUpdateSyncType.Update);
}

async function _sendCallLinkUpdateSync(
  callLink: sendCallLinkUpdateSyncCallLinkType,
  type: CallLinkUpdateSyncType
): Promise<void> {
  let protoType: Proto.SyncMessage.CallLinkUpdate.Type;
  if (type === CallLinkUpdateSyncType.Update) {
    protoType = Proto.SyncMessage.CallLinkUpdate.Type.UPDATE;
  } else {
    throw new Error(`sendCallLinkUpdateSync: unknown type ${type}`);
  }

  log.info(`Sending CallLinkUpdate type=${type}`);

  try {
    const ourAci = itemStorage.user.getCheckedAci();

    const callLinkUpdate = new Proto.SyncMessage.CallLinkUpdate({
      type: protoType,
      rootKey: toRootKeyBytes(callLink.rootKey),
      epoch: callLink.epoch ? toEpochBytes(callLink.epoch) : null,
      adminPasskey: callLink.adminKey
        ? toAdminKeyBytes(callLink.adminKey)
        : null,
    });

    const syncMessage = MessageSender.createSyncMessage();
    syncMessage.callLinkUpdate = callLinkUpdate;

    const contentMessage = new Proto.Content();
    contentMessage.syncMessage = syncMessage;

    await singleProtoJobQueue.add({
      contentHint: ContentHint.Resendable,
      serviceId: ourAci,
      isSyncMessage: true,
      protoBase64: Bytes.toBase64(
        Proto.Content.encode(contentMessage).finish()
      ),
      type: 'callLinkUpdateSync',
      urgent: false,
    });
  } catch (error) {
    log.error('Failed to queue sync message:', Errors.toLogFormat(error));
  }
}
