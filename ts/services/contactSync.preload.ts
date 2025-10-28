// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import PQueue from 'p-queue';
import lodash from 'lodash';

import { DataWriter } from '../sql/Client.preload.js';
import type { ContactSyncEvent } from '../textsecure/messageReceiverEvents.std.js';
import {
  parseContactsV2,
  type ContactDetailsWithAvatar,
} from '../textsecure/ContactsParser.preload.js';
import {
  isOnline,
  getAttachment,
  getAttachmentFromBackupTier,
} from '../textsecure/WebAPI.preload.js';
import * as Conversation from '../types/Conversation.node.js';
import * as Errors from '../types/errors.std.js';
import type { ValidateConversationType } from '../model-types.d.ts';
import type { ConversationModel } from '../models/conversations.preload.js';
import { validateConversation } from '../util/validateConversation.dom.js';
import {
  writeNewAttachmentData,
  deleteAttachmentData,
  doesAttachmentExist,
} from '../util/migrations.preload.js';
import {
  isDirectConversation,
  isMe,
} from '../util/whatTypeOfConversation.dom.js';
import { createLogger } from '../logging/log.std.js';
import { dropNull } from '../util/dropNull.std.js';
import type { ProcessedAttachment } from '../textsecure/Types.d.ts';
import { downloadAttachment } from '../textsecure/downloadAttachment.preload.js';
import type { ReencryptedAttachmentV2 } from '../AttachmentCrypto.node.js';
import { SECOND } from '../util/durations/index.std.js';
import { AttachmentVariant } from '../types/Attachment.std.js';
import { MediaTier } from '../types/AttachmentDownload.std.js';
import { waitForOnline } from '../util/waitForOnline.dom.js';
import { itemStorage } from '../textsecure/Storage.preload.js';

const { noop } = lodash;

const log = createLogger('contactSync');

// When true - we are running the very first storage and contact sync after
// linking.
let isInitialSync = false;

export function setIsInitialContactSync(newValue: boolean): void {
  log.info(`setIsInitialContactSync(${newValue})`);
  isInitialSync = newValue;
}
export function getIsInitialContactSync(): boolean {
  return isInitialSync;
}

async function updateConversationFromContactSync(
  conversation: ConversationModel,
  details: ContactDetailsWithAvatar,
  receivedAtCounter: number,
  sentAt: number
): Promise<void> {
  const logId = `updateConversationFromContactSync(${conversation.idForLogging()}`;

  conversation.set({
    name: dropNull(details.name),
    inbox_position: dropNull(details.inboxPosition),
  });

  // Update the conversation avatar only if new avatar exists and hash differs
  const { avatar } = details;
  if (avatar && avatar.path) {
    const newAttributes = await Conversation.maybeUpdateAvatar(
      conversation.attributes,
      {
        newAvatar: avatar,
        writeNewAttachmentData,
        deleteAttachmentData,
        doesAttachmentExist,
      }
    );
    conversation.set(newAttributes);
  } else {
    const { attributes } = conversation;
    if (attributes.avatar && attributes.avatar.path) {
      await deleteAttachmentData(attributes.avatar.path);
    }
    conversation.set({ avatar: null });
  }

  if (isInitialSync) {
    // expireTimer isn't in Storage Service so we have to rely on contact sync.
    await conversation.updateExpirationTimer(details.expireTimer, {
      // Note: because it's our conversationId, this notification will be marked read. But
      //   setting this will make 'isSetByOther' check true.
      source: window.ConversationController.getOurConversationId(),
      receivedAt: receivedAtCounter,
      version: details.expireTimerVersion ?? 1,
      fromSync: true,
      isInitialSync,
      reason: `contact sync (sent=${sentAt})`,
    });
  } else if (
    (details.expireTimer ?? 0) !== (conversation.get('expireTimer') ?? 0)
  ) {
    log.warn(
      `${logId}: Expire timer from contact sync is different from our data, but isInitialSync=${isInitialSync} so we won't apply it.`
    );
  }

  window.Whisper.events.emit('incrementProgress');
}

const queue = new PQueue({ concurrency: 1 });

async function downloadAndParseContactAttachment(
  contactAttachment: ProcessedAttachment
) {
  let downloaded: ReencryptedAttachmentV2 | undefined;
  try {
    const abortController = new AbortController();
    downloaded = await downloadAttachment(
      {
        getAttachment,
        getAttachmentFromBackupTier,
      },
      { attachment: contactAttachment, mediaTier: MediaTier.STANDARD },
      {
        variant: AttachmentVariant.Default,
        onSizeUpdate: noop,
        disableRetries: true,
        timeout: 90 * SECOND,
        abortSignal: abortController.signal,
        logId: 'downloadContactAttachment',
      }
    );

    return await parseContactsV2({
      ...contactAttachment,
      ...downloaded,
    });
  } finally {
    if (downloaded?.path) {
      await deleteAttachmentData(downloaded.path);
    }
  }
}

async function doContactSync({
  contactAttachment,
  complete: isFullSync,
  receivedAtCounter,
  sentAt,
}: ContactSyncEvent): Promise<void> {
  const logId =
    `doContactSync(sent=${sentAt}, ` +
    `receivedAt=${receivedAtCounter}, isFullSync=${isFullSync})`;

  log.info(`${logId}: downloading contact attachment`);
  let contacts: ReadonlyArray<ContactDetailsWithAvatar> | undefined;
  let attempts = 0;
  const ATTEMPT_LIMIT = 3;
  while (contacts === undefined) {
    attempts += 1;
    try {
      if (!isOnline()) {
        log.info(`${logId}: We are not online; waiting until we are online`);
        // eslint-disable-next-line no-await-in-loop
        await waitForOnline({ server: { isOnline } });
        log.info(`${logId}: We are back online; starting up again`);
      }

      // eslint-disable-next-line no-await-in-loop
      contacts = await downloadAndParseContactAttachment(contactAttachment);
    } catch (error) {
      if (attempts >= ATTEMPT_LIMIT) {
        throw error;
      }

      log.warn(
        `${logId}: Failed to download attachment, attempt ${attempts}`,
        Errors.toLogFormat(error)
      );
      // continue
    }
  }

  log.info(`${logId}: got ${contacts.length} contacts`);
  const updatedConversations = new Set<ConversationModel>();

  let promises = new Array<Promise<void>>();
  for (const details of contacts) {
    const partialConversation: ValidateConversationType = {
      e164: details.number,
      serviceId: details.aci,
      type: 'private',
    };

    const validationErrorString = validateConversation(partialConversation);
    if (validationErrorString) {
      log.error(
        `${logId}: Invalid contact received`,
        Errors.toLogFormat(validationErrorString)
      );
      continue;
    }

    const { conversation } = window.ConversationController.maybeMergeContacts({
      e164: details.number,
      aci: details.aci,
      reason: logId,
    });

    // It's important to use queueJob here because we might update the expiration timer
    //   and we don't want conflicts with incoming message processing happening on the
    //   conversation queue.
    const job = conversation.queueJob(`${logId}.set`, async () => {
      try {
        await updateConversationFromContactSync(
          conversation,
          details,
          receivedAtCounter,
          sentAt
        );

        updatedConversations.add(conversation);
      } catch (error) {
        log.error(
          'updateConversationFromContactSync error:',
          Errors.toLogFormat(error)
        );
      }
    });

    promises.push(job);
  }

  // updatedConversations are not populated until the promises are resolved
  await Promise.all(promises);
  promises = [];

  // Erase data in conversations that are not the part of contact sync only
  // if we received a full contact sync (and not a one-off contact update).
  const notUpdated = isFullSync
    ? window.ConversationController.getAll().filter(
        convo =>
          (convo.get('name') !== undefined ||
            convo.get('inbox_position') !== undefined) &&
          !updatedConversations.has(convo) &&
          isDirectConversation(convo.attributes) &&
          !isMe(convo.attributes)
      )
    : [];

  log.info(
    `${logId}: ` +
      `updated ${updatedConversations.size} ` +
      `resetting ${notUpdated.length}`
  );

  for (const conversation of notUpdated) {
    conversation.set({
      name: undefined,
      inbox_position: undefined,
    });
  }

  // Save new conversation attributes
  promises.push(
    DataWriter.updateConversations(
      [...updatedConversations, ...notUpdated].map(convo => convo.attributes)
    )
  );

  await Promise.all(promises);

  await itemStorage.put('synced_at', Date.now());
  window.Whisper.events.emit('contactSync:complete');
  if (isInitialSync) {
    isInitialSync = false;
  }
  window.SignalCI?.handleEvent('contactSync', isFullSync);

  log.info(`${logId}: done`);
}

export async function onContactSync(ev: ContactSyncEvent): Promise<void> {
  log.info(
    `onContactSync(sent=${ev.sentAt}, receivedAt=${ev.receivedAtCounter}): queueing sync`
  );

  const promise = queue.add(() => doContactSync(ev));

  // Returning the promise blocks MessageReceiver.appQueue, which we only want to do on
  // initial sync
  if (isInitialSync) {
    return promise;
  }
}
