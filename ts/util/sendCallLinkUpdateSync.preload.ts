// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ContentHint } from '@signalapp/libsignal-client';

import * as Bytes from '../Bytes.std.ts';
import { CallLinkUpdateSyncType } from '../types/CallLink.std.ts';
import { createLogger } from '../logging/log.std.ts';
import * as Errors from '../types/errors.std.ts';
import { SignalService as Proto } from '../protobuf/index.std.ts';
import { singleProtoJobQueue } from '../jobs/singleProtoJobQueue.preload.ts';
import { MessageSender } from '../textsecure/SendMessage.preload.ts';
import { toAdminKeyBytes } from './callLinks.std.ts';
import { toRootKeyBytes } from './callLinksRingrtc.node.ts';
import { itemStorage } from '../textsecure/Storage.preload.ts';

const log = createLogger('sendCallLinkUpdateSync');

export type sendCallLinkUpdateSyncCallLinkType = {
  rootKey: string;
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

    const callLinkUpdate: Proto.SyncMessage.CallLinkUpdate.Params = {
      type: protoType,
      rootKey: toRootKeyBytes(callLink.rootKey),
      adminPasskey: callLink.adminKey
        ? toAdminKeyBytes(callLink.adminKey)
        : null,
    };

    const syncMessage = MessageSender.padSyncMessage({
      content: {
        callLinkUpdate,
      },
    });

    await singleProtoJobQueue.add({
      contentHint: ContentHint.Resendable,
      serviceId: ourAci,
      isSyncMessage: true,
      protoBase64: Bytes.toBase64(
        Proto.Content.encode({
          content: {
            syncMessage,
          },
          senderKeyDistributionMessage: null,
          pniSignatureMessage: null,
        })
      ),
      type: 'callLinkUpdateSync',
      urgent: false,
    });
  } catch (error) {
    log.error('Failed to queue sync message:', Errors.toLogFormat(error));
  }
}
