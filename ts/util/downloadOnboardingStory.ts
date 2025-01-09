// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { v4 as generateUuid } from 'uuid';

import type { AttachmentType } from '../types/Attachment';
import { MessageModel } from '../models/messages';
import * as log from '../logging/log';
import { IMAGE_JPEG } from '../types/MIME';
import { ReadStatus } from '../messages/MessageReadStatus';
import { SeenStatus } from '../MessageSeenStatus';
import { findAndDeleteOnboardingStoryIfExists } from './findAndDeleteOnboardingStoryIfExists';
import { saveNewMessageBatcher } from './messageBatcher';
import { strictAssert } from './assert';
import { incrementMessageCounter } from './incrementMessageCounter';

// First, this function is meant to be run after a storage service sync

// * If onboarding story has been viewed and it's downloaded on this device,
//   delete & return.
// * Check if we've already downloaded the onboarding story.
// * Download onboarding story, create db entry, mark as downloaded.
// * If story has been viewed mark as viewed on AccountRecord.
// * If we viewed it >24 hours ago, delete.
export async function downloadOnboardingStory(): Promise<void> {
  const { server } = window.textsecure;

  strictAssert(server, 'server not initialized');

  const hasViewedOnboardingStory = window.storage.get(
    'hasViewedOnboardingStory'
  );

  if (hasViewedOnboardingStory) {
    await findAndDeleteOnboardingStoryIfExists();
    return;
  }

  const existingOnboardingStoryMessageIds = window.storage.get(
    'existingOnboardingStoryMessageIds'
  );

  if (existingOnboardingStoryMessageIds) {
    log.info('downloadOnboardingStory: has existingOnboardingStoryMessageIds');
    return;
  }

  const userLocale = window.i18n.getLocale();

  const manifest = await server.getOnboardingStoryManifest();

  log.info('downloadOnboardingStory: got manifest version:', manifest.version);

  const imageFilenames =
    userLocale in manifest.languages
      ? manifest.languages[userLocale]
      : manifest.languages.en;

  const imageBuffers = await server.downloadOnboardingStories(
    manifest.version,
    imageFilenames
  );

  log.info('downloadOnboardingStory: downloaded stories:', imageBuffers.length);

  const attachments: Array<AttachmentType> = await Promise.all(
    imageBuffers.map(async data => {
      const local = await window.Signal.Migrations.writeNewAttachmentData(data);
      const attachment: AttachmentType = {
        contentType: IMAGE_JPEG,
        ...local,
      };

      return window.Signal.Migrations.processNewAttachment(attachment);
    })
  );

  log.info('downloadOnboardingStory: getting signal conversation');
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

  await window.storage.put(
    'existingOnboardingStoryMessageIds',
    storyMessages.map(message => message.id)
  );

  log.info('downloadOnboardingStory: done');
}
