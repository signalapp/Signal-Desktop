// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { Readable } from 'node:stream';
import { createGzip } from 'node:zlib';
import { createCipheriv, randomBytes } from 'node:crypto';
import { Buffer } from 'node:buffer';
import Long from 'long';
import {
  AccountEntropyPool,
  BackupKey,
} from '@signalapp/libsignal-client/dist/AccountKeys.js';
import { MessageBackupKey } from '@signalapp/libsignal-client/dist/MessageBackup.js';

import type { AciString } from '../types/ServiceId.std.js';
import { generateAci } from '../types/ServiceId.std.js';
import { CipherType } from '../types/Crypto.std.js';
import { appendPaddingStream } from '../util/logPadding.node.js';
import { prependStream } from '../util/prependStream.node.js';
import { appendMacStream } from '../util/appendMacStream.node.js';
import { toAciObject } from '../util/ServiceId.node.js';
import { BACKUP_VERSION } from '../services/backups/constants.std.js';
import { Backups } from '../protobuf/index.std.js';

export type BackupGeneratorConfigType = Readonly<
  {
    aci: AciString;
    profileKey: Uint8Array;
    conversations: number;
    conversationAcis?: ReadonlyArray<AciString>;
    messages: number;
    mediaRootBackupKey: Uint8Array;
  } & (
    | {
        accountEntropyPool: string;
      }
    | {
        backupKey: Uint8Array;
      }
  )
>;

const IV_LENGTH = 16;

export type GenerateBackupResultType = Readonly<{
  backupId: Uint8Array;
  stream: Readable;
}>;

export function generateBackup(
  options: BackupGeneratorConfigType
): GenerateBackupResultType {
  const { aci } = options;
  let backupKey: BackupKey;
  if ('accountEntropyPool' in options) {
    backupKey = AccountEntropyPool.deriveBackupKey(options.accountEntropyPool);
  } else {
    backupKey = new BackupKey(options.backupKey);
  }
  const aciObj = toAciObject(aci);
  const backupId = backupKey.deriveBackupId(aciObj);
  const { aesKey, hmacKey } = new MessageBackupKey({
    backupKey,
    backupId,
  });

  const iv = randomBytes(IV_LENGTH);

  const stream = Readable.from(createRecords(options))
    .pipe(createGzip())
    .pipe(appendPaddingStream())
    .pipe(createCipheriv(CipherType.AES256CBC, aesKey, iv))
    .pipe(prependStream(iv))
    .pipe(appendMacStream(hmacKey));

  return { backupId, stream };
}

function frame(data: Backups.IFrame): Buffer {
  return Buffer.from(Backups.Frame.encodeDelimited(data).finish());
}

let now = Date.now();
function getTimestamp(): Long {
  now += 1;
  return Long.fromNumber(now);
}

function* createRecords({
  profileKey,
  conversations,
  conversationAcis = [],
  messages,
  mediaRootBackupKey,
}: BackupGeneratorConfigType): Iterable<Buffer> {
  yield Buffer.from(
    Backups.BackupInfo.encodeDelimited({
      version: Long.fromNumber(BACKUP_VERSION),
      backupTimeMs: getTimestamp(),
      mediaRootBackupKey,
    }).finish()
  );

  // Account data
  yield frame({
    account: {
      profileKey,
      givenName: 'Backup',
      familyName: 'Benchmark',
      accountSettings: {
        readReceipts: false,
        sealedSenderIndicators: false,
        typingIndicators: false,
        linkPreviews: false,
        notDiscoverableByPhoneNumber: false,
        preferContactAvatars: false,
        universalExpireTimerSeconds: 0,
        preferredReactionEmoji: [],
        displayBadgesOnProfile: true,
        keepMutedChatsArchived: false,
        hasSetMyStoriesPrivacy: true,
        hasViewedOnboardingStory: true,
        storiesDisabled: false,
        hasSeenGroupStoryEducationSheet: true,
        hasCompletedUsernameOnboarding: true,
        phoneNumberSharingMode:
          Backups.AccountData.PhoneNumberSharingMode.EVERYBODY,
        defaultChatStyle: {
          autoBubbleColor: {},
          dimWallpaperInDarkMode: false,
        },
        customChatColors: [],
      },
    },
  });

  const selfId = Long.fromNumber(0);

  yield frame({
    recipient: {
      id: selfId,
      self: {},
    },
  });

  const chats = new Array<{
    id: Long;
    aci: Uint8Array;
  }>();

  for (let i = 1; i <= conversations; i += 1) {
    const id = Long.fromNumber(i);
    const chatAci = toAciObject(
      conversationAcis.at(i - 1) ?? generateAci()
    ).getRawUuidBytes();

    chats.push({
      id,
      aci: chatAci,
    });

    yield frame({
      recipient: {
        id,
        contact: {
          aci: chatAci,
          blocked: false,
          visibility: Backups.Contact.Visibility.VISIBLE,
          registered: {},
          profileKey: randomBytes(32),
          profileSharing: true,
          profileGivenName: `Contact ${i}`,
          profileFamilyName: 'Generated',
          hideStory: false,
        },
      },
    });

    yield frame({
      chat: {
        id,
        recipientId: id,
        archived: false,
        pinnedOrder: 0,
        expirationTimerMs: Long.fromNumber(0),
        muteUntilMs: Long.fromNumber(0),
        markedUnread: false,
        dontNotifyForMentionsIfMuted: false,
        style: {
          autoBubbleColor: {},
          dimWallpaperInDarkMode: false,
        },
        expireTimerVersion: 1,
      },
    });
  }

  for (let i = 0; i < messages; i += 1) {
    const chat = chats[i % chats.length];

    const isIncoming = i % 2 === 0;

    const dateSent = getTimestamp();

    yield frame({
      chatItem: {
        chatId: chat.id,
        authorId: isIncoming ? chat.id : selfId,
        dateSent,
        revisions: [],
        sms: false,

        ...(isIncoming
          ? {
              incoming: {
                dateReceived: getTimestamp(),
                dateServerSent: getTimestamp(),
                read: true,
                sealedSender: true,
              },
            }
          : {
              outgoing: {
                sendStatus: [
                  {
                    recipientId: chat.id,
                    timestamp: dateSent,
                    delivered: { sealedSender: true },
                  },
                ],
              },
            }),

        standardMessage: {
          text: {
            body: `Message ${i}`,
          },
        },
      },
    });
  }
}
