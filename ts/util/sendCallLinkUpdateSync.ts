// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import * as Bytes from '../Bytes';
import { CallLinkUpdateSyncType } from '../types/CallLink';
import * as log from '../logging/log';
import * as Errors from '../types/errors';
import { SignalService as Proto } from '../protobuf';
import { singleProtoJobQueue } from '../jobs/singleProtoJobQueue';
import MessageSender from '../textsecure/SendMessage';
import { toAdminKeyBytes } from './callLinks';
import { toRootKeyBytes } from './callLinksRingrtc';

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

  log.info(`sendCallLinkUpdateSync: Sending CallLinkUpdate type=${type}`);

  try {
    const ourAci = window.textsecure.storage.user.getCheckedAci();

    const callLinkUpdate = new Proto.SyncMessage.CallLinkUpdate({
      type: protoType,
      rootKey: toRootKeyBytes(callLink.rootKey),
      adminPasskey: callLink.adminKey
        ? toAdminKeyBytes(callLink.adminKey)
        : null,
    });

    const syncMessage = MessageSender.createSyncMessage();
    syncMessage.callLinkUpdate = callLinkUpdate;

    const contentMessage = new Proto.Content();
    contentMessage.syncMessage = syncMessage;

    const { ContentHint } = Proto.UnidentifiedSenderMessage.Message;

    await singleProtoJobQueue.add({
      contentHint: ContentHint.RESENDABLE,
      serviceId: ourAci,
      isSyncMessage: true,
      protoBase64: Bytes.toBase64(
        Proto.Content.encode(contentMessage).finish()
      ),
      type: 'callLinkUpdateSync',
      urgent: false,
    });
  } catch (error) {
    log.error(
      'sendCallLinkUpdateSync: Failed to queue sync message:',
      Errors.toLogFormat(error)
    );
  }
}
