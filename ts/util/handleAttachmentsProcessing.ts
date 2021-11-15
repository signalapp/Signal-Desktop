// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import {
  getPendingAttachment,
  preProcessAttachment,
  processAttachment,
} from './processAttachment';
import type {
  AttachmentDraftType,
  InMemoryAttachmentDraftType,
} from '../types/Attachment';
import { AttachmentToastType } from '../types/AttachmentToastType';
import * as log from '../logging/log';

export type AddAttachmentActionType = (
  conversationId: string,
  attachment: InMemoryAttachmentDraftType
) => unknown;
export type AddPendingAttachmentActionType = (
  conversationId: string,
  pendingAttachment: AttachmentDraftType
) => unknown;
export type RemoveAttachmentActionType = (
  conversationId: string,
  filePath: string
) => unknown;

export type HandleAttachmentsProcessingArgsType = {
  addAttachment: AddAttachmentActionType;
  addPendingAttachment: AddPendingAttachmentActionType;
  conversationId: string;
  draftAttachments: ReadonlyArray<AttachmentDraftType>;
  files: ReadonlyArray<File>;
  onShowToast: (toastType: AttachmentToastType) => unknown;
  removeAttachment: RemoveAttachmentActionType;
};

export async function handleAttachmentsProcessing({
  addAttachment,
  addPendingAttachment,
  conversationId,
  draftAttachments,
  files,
  onShowToast,
  removeAttachment,
}: HandleAttachmentsProcessingArgsType): Promise<void> {
  if (!files.length) {
    return;
  }

  const nextDraftAttachments = [...draftAttachments];
  const filesToProcess: Array<File> = [];
  for (let i = 0; i < files.length; i += 1) {
    const file = files[i];
    const processingResult = preProcessAttachment(file, nextDraftAttachments);
    if (processingResult) {
      onShowToast(processingResult);
    } else {
      const pendingAttachment = getPendingAttachment(file);
      if (pendingAttachment) {
        addPendingAttachment(conversationId, pendingAttachment);
        filesToProcess.push(file);
        // we keep a running count of the draft attachments so we can show a
        // toast in case we add too many attachments at once
        nextDraftAttachments.push(pendingAttachment);
      }
    }
  }

  await Promise.all(
    filesToProcess.map(async file => {
      try {
        const attachment = await processAttachment(file);
        if (!attachment) {
          removeAttachment(conversationId, file.path);
          return;
        }
        addAttachment(conversationId, attachment);
      } catch (err) {
        log.error(
          'handleAttachmentsProcessing: failed to process attachment:',
          err.stack
        );
        removeAttachment(conversationId, file.path);
        onShowToast(AttachmentToastType.ToastUnableToLoadAttachment);
      }
    })
  );
}
