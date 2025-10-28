// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { v4 as generateUuid } from 'uuid';

import type { AttachmentType } from '../types/Attachment.std.js';
import { MessageModel } from '../models/messages.preload.js';
import { createLogger } from '../logging/log.std.js';
import { IMAGE_JPEG } from '../types/MIME.std.js';
import { ReadStatus } from '../messages/MessageReadStatus.std.js';
import { SeenStatus } from '../MessageSeenStatus.std.js';
import { findAndDeleteOnboardingStoryIfExists } from './findAndDeleteOnboardingStoryIfExists.preload.js';
import { saveNewMessageBatcher } from './messageBatcher.preload.js';
import {
  writeNewAttachmentData,
  processNewAttachment,
} from './migrations.preload.js';
import { incrementMessageCounter } from './incrementMessageCounter.preload.js';
import {
  getOnboardingStoryManifest,
  downloadOnboardingStories,
} from '../textsecure/WebAPI.preload.js';
import { itemStorage } from '../textsecure/Storage.preload.js';

const log = createLogger('downloadOnboardingStory');

// First, this function is meant to be run after a storage service sync

// * If onboarding story has been viewed and it's downloaded on this device,
//   delete & return.
// * Check if we've already downloaded the onboarding story.
// * Download onboarding story, create db entry, mark as downloaded.
// * If story has been viewed mark as viewed on AccountRecord.
// * If we viewed it >24 hours ago, delete.
export async function downloadOnboardingStory(): Promise<void> {
  const hasViewedOnboardingStory = itemStorage.get('hasViewedOnboardingStory');

  if (hasViewedOnboardingStory) {
    await findAndDeleteOnboardingStoryIfExists();
    return;
  }

  const existingOnboardingStoryMessageIds = itemStorage.get(
    'existingOnboardingStoryMessageIds'
  );

  if (existingOnboardingStoryMessageIds) {
    log.info('has existingOnboardingStoryMessageIds');
    return;
  }

  const userLocale = window.SignalContext.i18n.getLocale();

  const manifest = await getOnboardingStoryManifest();

  log.info('got manifest version:', manifest.version);

  const imageFilenames =
    userLocale in manifest.languages
      ? manifest.languages[userLocale]
      : manifest.languages.en;

  const imageBuffers = await downloadOnboardingStories(
    manifest.version,
    imageFilenames
  );

  log.info('downloaded stories:', imageBuffers.length);

  const attachments: Array<AttachmentType> = await Promise.all(
    imageBuffers.map(async data => {
      const local = await writeNewAttachmentData(data);
      const attachment: AttachmentType = {
        contentType: IMAGE_JPEG,
        ...local,
      };

      return processNewAttachment(attachment, 'attachment');
    })
  );

  log.info('getting signal conversation');
  const signalConversation =
    await window.ConversationController.getOrCreateSignalConversation();

  const storyMessages: Array<MessageModel> = attachments.map(
    (attachment, index) => {
      const timestamp = Date.now() + index;

      const message = new MessageModel({
        attachments: [attachment],
        canReplyToStory: false,
        conversationId: signalConversation.id,
        id: generateUuid(),
        readStatus: ReadStatus.Unread,
        received_at: incrementMessageCounter(),
        received_at_ms: timestamp,
        seenStatus: SeenStatus.Unseen,
        sent_at: timestamp,
        serverTimestamp: timestamp,
        sourceDevice: 1,
        sourceServiceId: signalConversation.getServiceId(),
        timestamp,
        type: 'story',
      });
      return window.MessageCache.register(message);
    }
  );

  await Promise.all(
    storyMessages.map(message => saveNewMessageBatcher.add(message.attributes))
  );

  await itemStorage.put(
    'existingOnboardingStoryMessageIds',
    storyMessages.map(message => message.id)
  );

  log.info('done');
}
