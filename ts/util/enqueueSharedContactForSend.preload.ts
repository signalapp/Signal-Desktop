// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationModel } from '../models/conversations.preload.ts';
import { createLogger } from '../logging/log.std.ts';
import { getPlaintextHashForInMemoryAttachment } from '../AttachmentCrypto.node.ts';
import type {
  Avatar,
  EmbeddedContactType,
} from '../types/EmbeddedContact.std.ts';
import { ContactFormType } from '../types/EmbeddedContact.std.ts';
import { IMAGE_JPEG } from '../types/MIME.std.ts';
import * as Errors from '../types/errors.std.ts';
import { getExistingAttachmentDataForReuse } from './attachments/deduplicateAttachment.preload.ts';
import { migrateDataToFileSystem } from './attachments/migrateDataToFilesystem.std.ts';
import {
  readAttachmentData,
  writeNewAttachmentData,
} from './migrations.preload.ts';
import type {
  ShareContactAvatarType,
  ShareContactType,
} from './shareContact.std.ts';
import { canShareContact } from './shareContact.std.ts';
import { sniffImageMimeType } from './sniffImageMimeType.std.ts';

const log = createLogger('enqueueSharedContactForSend');

async function copyAvatarForMessage(
  avatar: ShareContactAvatarType
): Promise<Avatar | undefined> {
  try {
    const data = await readAttachmentData(avatar.attachment);
    return {
      avatar: await migrateDataToFileSystem(
        {
          contentType: sniffImageMimeType(data) ?? IMAGE_JPEG,
          size: data.byteLength,
        },
        data,
        {
          writeNewAttachmentData,
          getExistingAttachmentDataForReuse,
          getPlaintextHashForInMemoryAttachment,
        }
      ),
      isProfile: avatar.isProfile,
    };
  } catch (error) {
    log.warn('Unable to copy avatar', Errors.toLogFormat(error));
    return undefined;
  }
}

export async function enqueueSharedContactForSend(
  conversation: ConversationModel,
  contact: ShareContactType
): Promise<void> {
  if (!canShareContact(contact)) {
    throw new Error(
      'enqueueSharedContactForSend: Needs a name and ACI, or an e164'
    );
  }

  const contactToSend: EmbeddedContactType = {
    aci: contact.aci ?? undefined,
    avatar:
      contact.avatar != null
        ? await copyAvatarForMessage(contact.avatar)
        : undefined,
    name: contact.name ?? undefined,
    organization: contact.organization ?? undefined,
    number:
      contact.e164 != null
        ? [{ value: contact.e164, type: ContactFormType.CUSTOM }]
        : [],
    nickname: contact.nickname ?? undefined,
    note: contact.note ?? undefined,
  };

  await conversation.enqueueMessageForSend(
    {
      attachments: [],
      body: undefined,
      contact: [contactToSend],
    },
    {
      timestamp: Date.now(),
      dontClearDraft: true,
    }
  );
}
