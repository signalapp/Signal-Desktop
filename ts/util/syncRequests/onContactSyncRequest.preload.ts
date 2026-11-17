// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createLogger } from '../../logging/log.std.ts';
import { toLogFormat } from '../../types/errors.std.ts';
import { singleProtoJobQueue } from '../../jobs/singleProtoJobQueue.preload.ts';
import { MessageSender } from '../../textsecure/SendMessage.preload.ts';
import { encodeContactsV2 } from '../../textsecure/ContactsParser.preload.ts';
import { uploadAttachment } from '../uploadAttachment.preload.ts';
import { maybeDeleteAttachmentFile } from '../migrations.preload.ts';
import { isDirectConversation } from '../whatTypeOfConversation.dom.ts';

import type { SignalService as Proto } from '../../protobuf/index.std.ts';
import type { ContactSyncRequestEvent } from '../../textsecure/messageReceiverEvents.std.ts';
import type { AttachmentType } from '../../types/Attachment.std.ts';

const log = createLogger('onContactSyncRequest');

export async function onContactSyncRequest(
  event: ContactSyncRequestEvent
): Promise<void> {
  const logId = `${event.sentAt}`;
  let attachment: AttachmentType | undefined;

  try {
    const ourConversation =
      window.ConversationController.getOurConversationOrThrow();
    const otherConversations = window.ConversationController.getAll().filter(
      conversation =>
        conversation.id !== ourConversation.id &&
        isDirectConversation(conversation.attributes) &&
        conversation.getAci() &&
        conversation.get('profileSharing') &&
        !conversation.isUnregistered()
    );
    const contacts = [ourConversation, ...otherConversations];

    log.info(
      `${logId}: Sending response to contact sync request with ${contacts.length} contacts`
    );

    attachment = await encodeContactsV2(contacts);

    const uploadedAttachment = await uploadAttachment(attachment);

    // Note: at this point we can delete the on-disk attachment, because all we need is
    // the attachment metadata and CDN info. We'll wait to delete it in the finally.

    const attachmentPointer: Proto.AttachmentPointer = {
      ...uploadedAttachment,
      $unknown: [],
    };
    const complete = true;
    await singleProtoJobQueue.add(
      MessageSender.getContactSyncMessage(attachmentPointer, complete)
    );

    event.confirm();
  } catch (error) {
    log.error(`${logId}: Failed to respond`, toLogFormat(error));
  } finally {
    if (attachment?.path) {
      log.info(`${logId}: Removing contact sync attachment from disk`);
      await maybeDeleteAttachmentFile(attachment.path);
    }
  }
}
