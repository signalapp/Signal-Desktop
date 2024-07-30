// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { AttachmentDraftType } from '../types/Attachment';
import { DataWriter } from '../sql/Client';
import { strictAssert } from './assert';
import { deleteDraftAttachment } from './deleteDraftAttachment';

export async function clearConversationDraftAttachments(
  conversationId: string,
  draftAttachments: ReadonlyArray<AttachmentDraftType> = []
): Promise<void> {
  const conversation = window.ConversationController.get(conversationId);
  strictAssert(conversation, 'no conversation found');

  conversation.set({
    draftAttachments: [],
    draftChanged: true,
  });

  window.reduxActions.composer.replaceAttachments(conversationId, []);

  // We're fine doing this all at once; at most it should be 32 attachments
  await Promise.all([
    DataWriter.updateConversation(conversation.attributes),
    Promise.all(
      draftAttachments.map(attachment => deleteDraftAttachment(attachment))
    ),
  ]);
}
