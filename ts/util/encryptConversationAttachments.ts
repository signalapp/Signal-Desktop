// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import pMap from 'p-map';

import * as log from '../logging/log';
import { DataReader, DataWriter } from '../sql/Client';
import type { ConversationAttributesType } from '../model-types.d';
import { encryptLegacyAttachment } from './encryptLegacyAttachment';
import { AttachmentDisposition } from './getLocalAttachmentUrl';
import { isNotNil } from './isNotNil';
import { isSignalConversation } from './isSignalConversation';
import { getConversationIdForLogging } from './idForLogging';

const CONCURRENCY = 32;

type CleanupType = Array<() => Promise<void>>;

export async function encryptConversationAttachments(): Promise<void> {
  const all = await DataReader.getAllConversations();
  log.info(`encryptConversationAttachments: checking ${all.length}`);

  const updated = (
    await pMap(
      all,
      async convo => {
        try {
          return await encryptOne(convo);
        } catch (error) {
          log.error('encryptConversationAttachments: processing failed', error);
          return undefined;
        }
      },
      { concurrency: CONCURRENCY }
    )
  ).filter(isNotNil);

  if (updated.length !== 0) {
    log.info(`encryptConversationAttachments: updating ${updated.length}`);
    await DataWriter.updateConversations(
      updated.map(({ attributes }) => attributes)
    );

    const cleanup = updated.map(entry => entry.cleanup).flat();

    log.info(`encryptConversationAttachments: cleaning up ${cleanup.length}`);
    await pMap(
      cleanup,
      async fn => {
        try {
          await fn();
        } catch (error) {
          log.error('encryptConversationAttachments: cleanup failed', error);
        }
      },
      { concurrency: CONCURRENCY }
    );
  }
}

async function encryptOne(attributes: ConversationAttributesType): Promise<
  | {
      attributes: ConversationAttributesType;
      cleanup: CleanupType;
    }
  | undefined
> {
  if (isSignalConversation(attributes)) {
    return undefined;
  }

  const logId = getConversationIdForLogging(attributes);
  const result = { ...attributes };

  const {
    deleteAttachmentData,
    deleteAvatar,
    deleteDraftFile,
    readAttachmentData,
    readAvatarData,
    readDraftData,
    writeNewAttachmentData,
    writeNewAvatarData,
    writeNewDraftData,
  } = window.Signal.Migrations;

  const cleanup: CleanupType = [];

  if (attributes.profileAvatar?.path) {
    result.profileAvatar = await encryptLegacyAttachment(
      attributes.profileAvatar,
      {
        logId: `${logId}.profileAvatar`,
        readAttachmentData,
        writeNewAttachmentData,
        disposition: AttachmentDisposition.Attachment,
      }
    );
    if (result.profileAvatar !== attributes.profileAvatar) {
      const { path } = attributes.profileAvatar;
      cleanup.push(() => deleteAttachmentData(path));
    }
  }

  if (attributes.avatar?.path) {
    result.avatar = await encryptLegacyAttachment(attributes.avatar, {
      logId: `${logId}.avatar`,
      readAttachmentData,
      writeNewAttachmentData,
      disposition: AttachmentDisposition.Attachment,
    });
    if (result.avatar !== attributes.avatar) {
      const { path } = attributes.avatar;
      cleanup.push(() => deleteAttachmentData(path));
    }
  }

  if (attributes.avatars?.length) {
    result.avatars = await Promise.all(
      attributes.avatars.map(async (avatar, i) => {
        if (avatar.version === 2 || !avatar.imagePath) {
          return avatar;
        }

        const { path: imagePath, ...updated } = await encryptLegacyAttachment(
          {
            path: avatar.imagePath,
          },
          {
            logId: `${logId}.avatars[${i}]`,
            readAttachmentData: readAvatarData,
            writeNewAttachmentData: writeNewAvatarData,
            disposition: AttachmentDisposition.AvatarData,
          }
        );

        const path = avatar.imagePath;
        cleanup.push(() => deleteAvatar(path));

        return {
          ...avatar,
          ...updated,
          imagePath,
        };
      })
    );
  }

  if (attributes.draftAttachments?.length) {
    result.draftAttachments = await Promise.all(
      attributes.draftAttachments.map(async (draft, i) => {
        const updated = await encryptLegacyAttachment(draft, {
          logId: `${logId}.draft[${i}]`,
          readAttachmentData: readDraftData,
          writeNewAttachmentData: writeNewDraftData,
          disposition: AttachmentDisposition.Draft,
        });

        if (updated !== draft && draft.path) {
          const { path } = draft;
          cleanup.push(() => deleteDraftFile(path));
        }

        return updated;
      })
    );
  }

  if (attributes.draftEditMessage?.attachmentThumbnail) {
    const path = attributes.draftEditMessage?.attachmentThumbnail;

    // Just drop thumbnail reference. It is impossible to recover, and has
    // minimal UI impact.
    if (!path.startsWith('attachment://')) {
      await window.storage.put('needOrphanedAttachmentCheck', true);
      if (result.draftEditMessage) {
        result.draftEditMessage.attachmentThumbnail = undefined;
      }

      // Just to trigger the save
      cleanup.push(() => Promise.resolve());
    }
  }

  // Unchanged
  if (!cleanup.length) {
    return undefined;
  }

  return { attributes: result, cleanup };
}
