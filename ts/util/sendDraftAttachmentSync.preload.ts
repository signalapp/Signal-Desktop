// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ContentHint } from '@signalapp/libsignal-client';

import * as Bytes from '../Bytes.std.ts';
import * as Errors from '../types/errors.std.ts';
import { createLogger } from '../logging/log.std.ts';
import { SignalService as Proto } from '../protobuf/index.std.ts';
import { singleProtoJobQueue } from '../jobs/singleProtoJobQueue.preload.ts';
import { MessageSender } from '../textsecure/SendMessage.preload.ts';
import { itemStorage } from '../textsecure/Storage.preload.ts';
import { uploadAttachment } from './uploadAttachment.preload.ts';
import type { AttachmentWithHydratedData } from '../types/Attachment.std.ts';
import type { ServiceIdString } from '../types/ServiceId.std.ts';

const log = createLogger('sendDraftAttachmentSync');

// Emits a SyncMessage.DraftAttachment (proto field 27) to our other linked
// devices: either a `clear` tombstone or a draft attachment pointer.
// Mirrors sendCallLinkUpdateSync.preload.ts.
export async function sendDraftAttachmentSync({
  conversationServiceId,
  timestamp,
  clear,
  attachment,
}: {
  conversationServiceId: ServiceIdString;
  timestamp: number;
  clear: boolean;
  attachment?: Proto.AttachmentPointer.Params | null;
}): Promise<void> {
  if (!window.ConversationController.doWeHaveOtherDevices()) {
    log.info('We have no other devices; not sending draft sync');
    return;
  }

  try {
    const ourAci = itemStorage.user.getCheckedAci();

    const draftAttachment: Proto.SyncMessage.DraftAttachment.Params = {
      destinationServiceId: conversationServiceId,
      timestamp: BigInt(timestamp),
      clear,
      attachment: attachment ?? null,
    };

    const syncMessage = MessageSender.padSyncMessage({
      content: { draftAttachment },
    });

    await singleProtoJobQueue.add({
      contentHint: ContentHint.Resendable,
      serviceId: ourAci,
      isSyncMessage: true,
      protoBase64: Bytes.toBase64(
        Proto.Content.encode({
          content: { syncMessage },
          senderKeyDistributionMessage: null,
          pniSignatureMessage: null,
        })
      ),
      type: 'draftSync',
      urgent: false,
    });
  } catch (error) {
    log.error('Failed to queue draft sync:', Errors.toLogFormat(error));
  }
}

// Uploads a draft attachment to the CDN, then syncs the resulting pointer.
// `UploadedAttachmentType` is structurally an AttachmentPointer.Params.
export async function uploadAndSendDraftAttachment({
  conversationServiceId,
  attachment,
  timestamp,
}: {
  conversationServiceId: ServiceIdString;
  attachment: AttachmentWithHydratedData;
  timestamp: number;
}): Promise<void> {
  if (!window.ConversationController.doWeHaveOtherDevices()) {
    return;
  }

  try {
    const uploaded = await uploadAttachment(attachment);
    await sendDraftAttachmentSync({
      conversationServiceId,
      timestamp,
      clear: false,
      attachment: uploaded,
    });
  } catch (error) {
    log.error(
      'Failed to upload+send draft attachment:',
      Errors.toLogFormat(error)
    );
  }
}
